import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    Output,
    SimpleChanges,
    ViewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Crepe } from '@milkdown/crepe';
import { codeBlockConfig } from '@milkdown/kit/component/code-block';
import { EditorStatus } from '@milkdown/kit/core';
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';
import { replaceAll } from '@milkdown/kit/utils';
import mermaid from 'mermaid';

import { MarkdownHelpDialog } from 'src/app/dialogs/markdown-help/markdown-help.dialog';
import { QhanaBackendService } from 'src/app/services/qhana-backend.service';

import { createLatexPreviewRenderer } from './milkdown-latex';

const QHANA_BACKEND_LATEX_LANGUAGE = 'latex';

type ApplyCodeBlockPreview =
    (value: null | string | HTMLElement) => void;

/**
 * QHAna reserves the exact lowercase "latex" language for fenced blocks
 * rendered by the external backend renderer. Crepe uses other casing, such
 * as "LaTeX", for its own $$ math blocks.
 */
const isCrepeMathLanguage = (language: string): boolean =>
    language !== QHANA_BACKEND_LATEX_LANGUAGE &&
    language.toLowerCase() === QHANA_BACKEND_LATEX_LANGUAGE;

const qhanaCodeBlockSchema = codeBlockSchema.extendSchema(
    (previousSchema) => (ctx) => {
        const baseSchema = previousSchema(ctx);

        return {
            ...baseSchema,
            toMarkdown: {
                match: baseSchema.toMarkdown.match,
                runner: (state, node) => {
                    const language = node.attrs.language ?? '';

                    if (isCrepeMathLanguage(language)) {
                        state.addNode(
                            'math',
                            undefined,
                            node.content.firstChild?.text || '',
                        );
                        return;
                    }

                    return baseSchema.toMarkdown.runner(
                        state,
                        node,
                    );
                },
            },
        };
    },
);

let mermaidRenderId = 0;

const renderMermaidPreview = (
    content: string,
    applyPreview: ApplyCodeBlockPreview,
): string | void => {
    if (!content.trim()) {
        return 'Empty';
    }

    /*
     * Mermaid uses the ID for temporary rendering DOM. It must be unique so
     * concurrent diagram previews cannot collide. Mermaid removes its
     * temporary DOM after rendering; suppressErrorRendering also removes it
     * when rendering fails.
     */
    mermaidRenderId += 1;
    const id = `qhana-mermaid-${mermaidRenderId}`;

    void mermaid.render(id, content)
        .then(({ svg }) => {
            const container =
                document.createElement('div');

            container.classList.add(
                'qhana-mermaid-preview',
            );
            container.innerHTML = svg;

            applyPreview(container);
        })
        .catch((error: unknown) => {
            console.error(
                'Could not render Mermaid diagram.',
                error,
            );

            const errorElement =
                document.createElement('span');

            errorElement.textContent =
                'Mermaid syntax error';

            applyPreview(errorElement);
        });
};

@Component({
    selector: 'qhana-markdown',
    templateUrl: './markdown.component.html',
    styleUrls: ['./markdown.component.sass'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false,
})
export class MarkdownComponent implements OnChanges, OnDestroy {

    @Input() markdown: string = '';
    @Input() editable: boolean = false;
    @Input() showHelp: boolean = true;

    @Output() markdownChanges: EventEmitter<string> = new EventEmitter();

    @ViewChild('milkdown') editorRef: ElementRef<HTMLElement> | null = null;

    showAsPreview: boolean = false;

    private crepe: Crepe | null = null;

    constructor(
        public dialog: MatDialog,
        private backend: QhanaBackendService,
    ) {}

    ngAfterViewInit(): void {
        const nativeElement = this.editorRef?.nativeElement;

        if (nativeElement == null) {
            return;
        }

        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrorRendering: true,
        });

        const latexPreview = createLatexPreviewRenderer({
            latexRendererUrl: this.backend.latexRendererUrl,
        });

        const initialMarkdown = this.markdown;

        const crepe = new Crepe({
            root: nativeElement,
            defaultValue: initialMarkdown,
        });

        crepe.editor.use(qhanaCodeBlockSchema);

        crepe.setReadonly(
            !this.editable || this.showAsPreview,
        );

        crepe.editor.config((ctx) => {
            ctx.update(codeBlockConfig.key, (previousConfig) => ({
                ...previousConfig,
                renderPreview: (
                    language,
                    content,
                    applyPreview,
                ) => {
                    if (language.toLowerCase() === 'mermaid') {
                        return renderMermaidPreview(
                            content,
                            applyPreview,
                        );
                    }

                    if (
                        language ===
                        QHANA_BACKEND_LATEX_LANGUAGE
                    ) {
                        return latexPreview(
                            language,
                            content,
                        );
                    }

                    return previousConfig.renderPreview(
                        language,
                        content,
                        applyPreview,
                    );
                },
            }));
        });

        crepe.on((listener) => {
            listener.markdownUpdated(
                (_ctx, markdown, previousMarkdown) => {
                    if (
                        this.editable &&
                        markdown !== previousMarkdown
                    ) {
                        this.markdownChanges.emit(markdown);
                    }
                },
            );
        });

        this.crepe = crepe;

        crepe.create()
            .then(() => {
                /*
                 * Crepe creation is asynchronous. The Angular component can
                 * already have been destroyed while create() was pending.
                 */
                if (this.crepe !== crepe) {
                    return;
                }

                if (this.markdown !== initialMarkdown) {
                    crepe.editor.action(
                        replaceAll(this.markdown, true),
                    );
                }

                this.markdownChanges.emit(this.markdown);
            })
            .catch((error: unknown) => {
                console.error(
                    'Could not initialize Markdown editor.',
                    error,
                );
            });
    }

    ngOnChanges(changes: SimpleChanges): void {
        const crepe = this.crepe;

        if (
            changes.markdown != null &&
            crepe?.editor.status === EditorStatus.Created
        ) {
            crepe.editor.action(
                replaceAll(this.markdown, true),
            );
        }

        if (changes.editable != null) {
            this.updateReadonlyState();
        }
    }

    ngOnDestroy(): void {
        const crepe = this.crepe;

        /*
         * Invalidate pending create() completion before destroying the editor
         * so its asynchronous continuation cannot update this component.
         */
        this.crepe = null;
        crepe?.destroy();
    }

    showPreview(): void {
        if (this.editable) {
            this.showAsPreview = true;
            this.updateReadonlyState();
        }
    }

    resetEditMode(): void {
        if (this.editable) {
            this.showAsPreview = false;
            this.updateReadonlyState();
        }
    }

    showMarkdownHelp(): void {
        this.dialog.open(MarkdownHelpDialog, {});
    }

    private updateReadonlyState(): void {
        this.crepe?.setReadonly(
            !this.editable || this.showAsPreview,
        );
    }
}
