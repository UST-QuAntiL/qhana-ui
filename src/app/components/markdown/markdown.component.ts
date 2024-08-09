import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { commandsCtx, CommandsReady, createCmdKey, defaultValueCtx, Editor, editorViewOptionsCtx, MilkdownPlugin, rootCtx, schemaCtx, themeManagerCtx } from '@milkdown/core';
import { clipboard } from '@milkdown/plugin-clipboard';
import { cursor } from '@milkdown/plugin-cursor';
import { diagram, TurnIntoDiagram } from '@milkdown/plugin-diagram';
import { emoji } from '@milkdown/plugin-emoji';
import { history } from '@milkdown/plugin-history';
import { indent } from '@milkdown/plugin-indent';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { math } from '@milkdown/plugin-math';
import { menu, menuPlugin } from '@milkdown/plugin-menu';
import { prism } from '@milkdown/plugin-prism';
import { createDropdownItem, defaultActions, slash, slashPlugin } from '@milkdown/plugin-slash';
import { WrappedAction } from '@milkdown/plugin-slash/src/item';
import { tooltip } from '@milkdown/plugin-tooltip';
import { gfm } from '@milkdown/preset-gfm';
import { EditorState, liftListItem, MarkType, redo, setBlockType, sinkListItem, TextSelection, undo, wrapIn } from '@milkdown/prose';
import { forceUpdate, replaceAll } from '@milkdown/utils';
import { MarkdownHelpDialog } from 'src/app/dialogs/markdown-help/markdown-help.dialog';
import { QhanaBackendService } from 'src/app/services/qhana-backend.service';
import { latex, latexNode } from './milkdown-latex';
import { QhanaTheme } from './milkdown-utils';

// function copied from @milkdown/plugin-menu
const hasMark = (state: EditorState, type: MarkType): boolean => {
    if (!type) return false;
    const { from, $from, to, empty } = state.selection;
    if (empty) {
        return !!type.isInSet(state.storedMarks || $from.marks());
    }
    return state.doc.rangeHasMark(from, to, type);
};

const showHelpCmd = createCmdKey("ShowHelp");
const toggleEditableCmd = createCmdKey("ToggleEditable");

@Component({
    selector: 'qhana-markdown',
    templateUrl: './markdown.component.html',
    styleUrls: ['./markdown.component.sass']
})
export class MarkdownComponent implements OnChanges {

    @Input() markdown: string = "";
    @Input() editable: boolean = false;
    @Input() showHelp: boolean = true;

    @Output() markdownChanges: EventEmitter<string> = new EventEmitter();

    @ViewChild('milkdown') editorRef: ElementRef | null = null;

    showAsPreview: boolean = false;

    private editor: Editor | null = null;

    constructor(public dialog: MatDialog, private backend: QhanaBackendService) { }

    ngAfterViewInit() {
        try {
            // try to fix problems with whitespace in css variables declaration...
            // whitespace trips up mermaid diagram rendering but there is no clear place
            // where that whitespace is introduced...
            const styleRoot = getComputedStyle(document.documentElement);
            const bg = styleRoot.getPropertyValue("--background");
            if (bg.length > bg.trim().length) {
                document.documentElement.style.setProperty("--background", bg.trim())
            }
        } catch { /* I don't care about errors here */ }

        const nativeElement = this.editorRef?.nativeElement;

        if (nativeElement != null) {

            const showHelpDialog = () => {
                if (this.showHelp) {
                    this.showMarkdownHelp();
                }
                return false;
            }

            const showHelpPlugin: MilkdownPlugin = () => async (ctx) => {
                // wait for command manager ready
                await ctx.wait(CommandsReady);

                const commandManager = ctx.get(commandsCtx);

                commandManager.create(showHelpCmd, () => showHelpDialog);
            };

            const toggleEditablePlugin: MilkdownPlugin = () => async (ctx) => {
                // wait for command manager ready
                await ctx.wait(CommandsReady);

                const commandManager = ctx.get(commandsCtx);

                commandManager.create(toggleEditableCmd, () => () => {
                    this.showAsPreview = !this.showAsPreview; // FIXME non editable editor has no menu buttons...
                    this.editor?.action(forceUpdate());
                    return true;
                });
            };

            Editor.make()
                .config((ctx) => {
                    ctx.set(rootCtx, nativeElement);
                    ctx.set(editorViewOptionsCtx, { editable: () => (this.editable ?? false) && !this.showAsPreview });
                    ctx.set(defaultValueCtx, this.markdown);
                    this.markdownChanges.emit(this.markdown);
                    ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
                        if (this.editable) {
                            this.markdownChanges.emit(markdown)
                        }
                    });
                })
                .use(showHelpPlugin)
                .use(toggleEditablePlugin)
                .use(QhanaTheme)
                .use(gfm)
                .use(prism)
                .use(diagram)
                .use(latex.configure(latexNode, {
                    latexRendererUrl: this.backend.latexRendererUrl, // TODO load latex renderer URL from some config!
                }))
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

                        const extraActions: Array<WrappedAction & { keyword: string[]; typeName: string }> = [
                            {
                                id: 'diagram',
                                dom: createDropdownItem(ctx.get(themeManagerCtx), 'Diagram', ('diagram' as any)),
                                command: () => ctx.get(commandsCtx).call(TurnIntoDiagram),
                                keyword: ['diagram', 'mermaid'],
                                typeName: 'diagram',
                            },
                        ]

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
                                const { nodes } = ctx.get(schemaCtx);
                                const userInput = content.slice(1).toLocaleLowerCase();
                                const filteredActions = extraActions.filter((action) => !!nodes[action.typeName] && action.keyword.some((keyword: any) => keyword.includes(userInput)))
                                    .map(({ keyword, typeName, ...action }) => action);

                                return content === '/'
                                    ? {
                                        placeholder: 'Type to filter...',
                                        // Get default slash plugin items
                                        actions: [...defaultActions(ctx), ...filteredActions],
                                    }
                                    : {
                                        // get the filtered actions list
                                        actions: [...defaultActions(ctx, content), ...filteredActions],
                                    };
                            }

                            return null;
                        };
                    }
                }))
                .use(menu.configure(menuPlugin, {
                    config: [
                        [
                            {
                                type: 'select',
                                text: 'Heading',
                                options: [
                                    { id: '1', text: 'Large Heading' },
                                    { id: '2', text: 'Medium Heading' },
                                    { id: '3', text: 'Small Heading' },
                                    { id: '0', text: 'Plain Text' },
                                ],
                                disabled: (view) => {
                                    const { state } = view;
                                    const setToHeading = (level: number) => setBlockType(state.schema.nodes.heading, { level })(state);
                                    return (
                                        !(view.state.selection instanceof TextSelection) ||
                                        !(setToHeading(1) || setToHeading(2) || setToHeading(3))
                                    );
                                },
                                onSelect: (id) => (Number(id) ? ['TurnIntoHeading', Number(id)] : ['TurnIntoText', null]),
                            },
                        ],
                        [
                            {
                                type: 'button',
                                icon: 'undo',
                                key: 'Undo',
                                disabled: (view) => {
                                    return !undo(view.state);
                                },
                            },
                            {
                                type: 'button',
                                icon: 'redo',
                                key: 'Redo',
                                disabled: (view) => {
                                    return !redo(view.state);
                                },
                            },
                        ],
                        [
                            {
                                type: 'button',
                                icon: 'bold',
                                key: 'ToggleBold',
                                active: (view) => hasMark(view.state, view.state.schema.marks.strong),
                                disabled: (view) => !view.state.schema.marks.strong,
                            },
                            {
                                type: 'button',
                                icon: 'italic',
                                key: 'ToggleItalic',
                                active: (view) => hasMark(view.state, view.state.schema.marks.em),
                                disabled: (view) => !view.state.schema.marks.em,
                            },
                            {
                                type: 'button',
                                icon: 'strikeThrough',
                                key: 'ToggleStrikeThrough',
                                active: (view) => hasMark(view.state, view.state.schema.marks.strike_through),
                                disabled: (view) => !view.state.schema.marks.strike_through,
                            },
                        ],
                        [
                            {
                                type: 'button',
                                icon: 'bulletList',
                                key: 'WrapInBulletList',
                                disabled: (view) => {
                                    const { state } = view;
                                    return !wrapIn(state.schema.nodes.bullet_list)(state);
                                },
                            },
                            {
                                type: 'button',
                                icon: 'orderedList',
                                key: 'WrapInOrderedList',
                                disabled: (view) => {
                                    const { state } = view;
                                    return !wrapIn(state.schema.nodes.ordered_list)(state);
                                },
                            },
                            {
                                type: 'button',
                                icon: 'taskList',
                                key: 'TurnIntoTaskList',
                                disabled: (view) => {
                                    const { state } = view;
                                    return !wrapIn(state.schema.nodes.task_list_item)(state);
                                },
                            },
                            {
                                type: 'button',
                                icon: 'liftList',
                                key: 'LiftListItem',
                                disabled: (view) => {
                                    const { state } = view;
                                    return !liftListItem(state.schema.nodes.list_item)(state);
                                },
                            },
                            {
                                type: 'button',
                                icon: 'sinkList',
                                key: 'SinkListItem',
                                disabled: (view) => {
                                    const { state } = view;
                                    return !sinkListItem(state.schema.nodes.list_item)(state);
                                },
                            },
                        ],
                        [
                            {
                                type: 'button',
                                icon: 'link',
                                key: 'ToggleLink',
                                active: (view) => hasMark(view.state, view.state.schema.marks.link),
                            },
                            {
                                type: 'button',
                                icon: 'table',
                                key: 'InsertTable',
                            },
                            {
                                type: 'button',
                                icon: 'quote',
                                key: 'WrapInBlockquote',
                            },
                            {
                                type: 'button',
                                icon: ('diagram' as any),
                                key: 'TurnIntoDiagram',
                            },
                            {
                                type: 'button',
                                icon: 'code',
                                key: 'TurnIntoCodeFence',
                            },
                        ],
                        [
                            {
                                type: 'button',
                                icon: ('help' as any),
                                key: 'ShowHelp',
                                disabled: (view) => !this.showHelp,
                            },
                            {
                                type: 'button',
                                icon: ('edit' as any),
                                key: 'ToggleEditable',
                                active: (view) => this.editable,
                            }
                        ]
                    ],
                }))
                .create()
                .then(editor => this.editor = editor);
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        // FIXME add forced state update once milkdown is updated
        if (changes.markdown != null) {
            this.editor?.action(replaceAll(this.markdown, true));
            // FIXME use provided milkdown action to replace the document once milkdown is updated
            // this.editor?.action((ctx) => {
            //     const parser = ctx.get(parserCtx); // get parser and parse markdown
            //     const nodes = parser(this.markdown);
            //     if (nodes != null) {
            //         const oldState = ctx.get(editorStateCtx);
            //         const transaction = oldState.tr // create new transaction
            //         transaction.replaceWith(0, transaction.doc.content.size - 1, nodes); // replace the whole document
            //         const view = ctx.get(editorViewCtx);
            //         view.dispatch(transaction); // update view
            //         ctx.set(editorStateCtx, oldState.apply(transaction)) // update editor state seperately
            //     }
            // });
        }
        if (changes.editable != null) {
            this.editor?.action(forceUpdate());
        }
    }

    resetEditMode() {
        if (this.editable) {
            this.showAsPreview = false;
            this.editor?.action(forceUpdate());
        }
    }

    showMarkdownHelp() {
        this.dialog.open(MarkdownHelpDialog, {});
    }

}
