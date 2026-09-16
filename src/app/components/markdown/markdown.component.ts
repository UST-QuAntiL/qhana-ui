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

import { MarkdownHelpDialog } from 'src/app/dialogs/markdown-help/markdown-help.dialog';
import { QhanaBackendService } from 'src/app/services/qhana-backend.service';

type MarkdownEditorHandle = {
    updateMarkdown: (markdown: string) => void;
    setReadonly: (readonly: boolean) => void;
    destroy: () => void;
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

    private editor: MarkdownEditorHandle | null = null;
    private destroyed = false;

    constructor(
        public dialog: MatDialog,
        private backend: QhanaBackendService,
    ) {}

    async ngAfterViewInit(): Promise<void> {
        const nativeElement = this.editorRef?.nativeElement;

        if (nativeElement == null) {
            return;
        }

        try {
            const { createMarkdownEditor } =
                await import('./markdown-editor');

            if (this.destroyed) {
                return;
            }

            this.editor = createMarkdownEditor({
                root: nativeElement,
                markdown: this.markdown,
                readonly: !this.editable || this.showAsPreview,
                latexRendererUrl: this.backend.latexRendererUrl,
                onMarkdownUpdated: (markdown) => {
                    if (this.editable) {
                        this.markdownChanges.emit(markdown);
                    }
                },
                onReady: (markdown) => {
                    this.markdownChanges.emit(markdown);
                },
            });
        } catch (error) {
            console.error(
                'Could not load Markdown editor.',
                error,
            );
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.markdown != null) {
            this.editor?.updateMarkdown(this.markdown);
        }

        if (changes.editable != null) {
            this.updateReadonlyState();
        }
    }

    ngOnDestroy(): void {
        this.destroyed = true;

        const editor = this.editor;
        this.editor = null;

        editor?.destroy();
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
        this.editor?.setReadonly(
            !this.editable || this.showAsPreview,
        );
    }
}