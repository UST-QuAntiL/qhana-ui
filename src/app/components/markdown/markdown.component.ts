import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { defaultValueCtx, Editor, editorViewOptionsCtx, rootCtx } from '@milkdown/core';
import { clipboard } from '@milkdown/plugin-clipboard';
import { cursor } from '@milkdown/plugin-cursor';
import { emoji } from '@milkdown/plugin-emoji';
import { history } from '@milkdown/plugin-history';
import { indent } from '@milkdown/plugin-indent';
import { Listener, listener, listenerCtx } from '@milkdown/plugin-listener';
import { math } from '@milkdown/plugin-math';
import { defaultActions, slash, slashPlugin } from '@milkdown/plugin-slash';
import { tooltip } from '@milkdown/plugin-tooltip';
import { gfm } from '@milkdown/preset-gfm';
import { nord } from '@milkdown/theme-nord';
//import { } from '@milkdown/utils';

@Component({
    selector: 'qhana-markdown',
    templateUrl: './markdown.component.html',
    styleUrls: ['./markdown.component.sass']
})
export class MarkdownComponent implements OnChanges {

    @Input() markdown: string = "";
    @Input() editable: boolean = false;

    @Output() markdownChanges: EventEmitter<string> = new EventEmitter();

    @ViewChild('milkdown') editorRef: ElementRef | null = null;

    private editor: Editor | null = null;

    constructor() { }

    ngAfterViewInit() {
        const nativeElement = this.editorRef?.nativeElement;
        console.log(this.editorRef)

        if (nativeElement != null) {
            const listeners: Listener = {
                markdown: [
                    (getMarkdown) => {
                        if (this.editable) {
                            this.markdownChanges.emit(getMarkdown())
                        }
                    },
                ],
            };

            Editor.make()
                .config((ctx) => {
                    ctx.set(rootCtx, nativeElement);
                    ctx.set(editorViewOptionsCtx, { editable: () => this.editable ?? false });
                    ctx.set(defaultValueCtx, this.markdown);
                    ctx.set(listenerCtx, listeners);
                })
                .use(nord)
                .use(gfm)
                .use(math)
                .use(clipboard)
                .use(listener)
                .use(history)
                .use(cursor)
                .use(emoji)
                .use(indent)
                .use(tooltip)
                .use(slash.configure(slashPlugin, {
                    config: (ctx) => {
                        // Get default slash plugin items
                        const actions = defaultActions(ctx);

                        // Define a status builder
                        return ({ isTopLevel, content, parentNode, state }) => {
                            // You can only show something at root level
                            if (!isTopLevel) return null;

                            // Empty content ? Set your custom empty placeholder !
                            if (!content) {
                                const node = state.selection.$from.node();
                                if (state.selection.$from.node().content.size === 0) {
                                    return { placeholder: 'Type / to use the slash commands...' };
                                }
                            }

                            // Define the placeholder & actions (dropdown items) you want to display depending on content
                            if (content.startsWith('/')) {

                                return content === '/'
                                    ? {
                                        placeholder: 'Type to filter...',
                                        actions,
                                    }
                                    : {
                                        actions: actions.filter(({ keyword }) =>
                                            keyword.some((key) => key.includes(content.slice(1).toLocaleLowerCase())),
                                        ),
                                    };
                            }

                            return null;
                        };
                    }
                }))
                .create()
                .then(editor => this.editor = editor);
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.editable != null) {
            this.editor?.config((ctx) => ctx.set(editorViewOptionsCtx, { editable: () => this.editable ?? false }));
        }
        if (changes.markdown != null) {
            this.editor?.config((ctx) => ctx.set(defaultValueCtx, this.markdown));
        }
    }

}
