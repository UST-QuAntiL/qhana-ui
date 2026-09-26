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
    private currentMarkdown: string = '';
    private destroyed = false;
    private editorVersion = 0;
    private hasEmittedReady = false;

    constructor(
        public dialog: MatDialog,
        private backend: QhanaBackendService,
    ) {}

    async ngAfterViewInit(): Promise<void> {
        this.currentMarkdown = this.markdown;
        await this.recreateEditor();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.markdown != null) {
            this.currentMarkdown = this.markdown;
            this.editor?.updateMarkdown(this.currentMarkdown);
        }

        if (
            changes.editable != null &&
            this.editor != null
        ) {
            void this.recreateEditor();
        }
    }

    ngOnDestroy(): void {
        this.destroyed = true;
        this.editorVersion += 1;

        const editor = this.editor;
        this.editor = null;

        editor?.destroy();
    }

    showPreview(): void {
        if (this.editable) {
            this.showAsPreview = true;
            void this.recreateEditor();
        }
    }

    resetEditMode(): void {
        if (this.editable) {
            this.showAsPreview = false;
            void this.recreateEditor();
        }
    }

    showMarkdownHelp(): void {
        this.dialog.open(MarkdownHelpDialog, {});
    }

    private async recreateEditor(): Promise<void> {
        const nativeElement = this.editorRef?.nativeElement;

        if (nativeElement == null || this.destroyed) {
            return;
        }

        const version = ++this.editorVersion;

        const previousEditor = this.editor;
        this.editor = null;

        previousEditor?.destroy();
        nativeElement.replaceChildren();

        try {
            const { createMarkdownEditor } =
                await import('./markdown-editor');

            if (
                this.destroyed ||
                version !== this.editorVersion
            ) {
                return;
            }

            this.editor = createMarkdownEditor({
                root: nativeElement,
                markdown: this.currentMarkdown,
                readonly: !this.editable || this.showAsPreview,
                latexRendererUrl: this.backend.latexRendererUrl,
                onMarkdownUpdated: (markdown) => {
                    this.currentMarkdown = markdown;

                    if (this.editable) {
                        this.markdownChanges.emit(markdown);
                    }
                },
                onReady: (markdown) => {
                    this.currentMarkdown = markdown;

                    if (!this.hasEmittedReady) {
                        this.hasEmittedReady = true;
                        this.markdownChanges.emit(markdown);
                    }
                },
            });
        } catch (error) {
            console.error(
                'Could not load Markdown editor.',
                error,
            );
        }
    }
}