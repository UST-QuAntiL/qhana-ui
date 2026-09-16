import { Crepe } from '@milkdown/crepe';
import { codeBlockConfig } from '@milkdown/kit/component/code-block';
import type { Ctx } from '@milkdown/kit/ctx';
import {
    commandsCtx,
    EditorStatus,
    editorViewCtx,
} from '@milkdown/kit/core';
import {
    codeBlockSchema,
    liftListItemCommand,
    setBlockTypeCommand,
    sinkListItemCommand,
} from '@milkdown/kit/preset/commonmark';
import { redo, undo } from '@milkdown/kit/prose/history';
import { replaceAll } from '@milkdown/kit/utils';
import mermaid from 'mermaid';

import { createLatexPreviewRenderer } from './milkdown-latex';

const QHANA_BACKEND_LATEX_LANGUAGE = 'latex';

const UNDO_ICON = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 7 4 12l5 5"/>
    <path d="M4 12h9a6 6 0 0 1 6 6"/>
</svg>`;

const REDO_ICON = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m15 7 5 5-5 5"/>
    <path d="M20 12h-9a6 6 0 0 0-6 6"/>
</svg>`;

const OUTDENT_ICON = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 6h11"/>
    <path d="M9 10h11"/>
    <path d="M9 14h11"/>
    <path d="M9 18h11"/>
    <path d="m6 9-3 3 3 3"/>
</svg>`;

const INDENT_ICON = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 6h11"/>
    <path d="M9 10h11"/>
    <path d="M9 14h11"/>
    <path d="M9 18h11"/>
    <path d="m3 9 3 3-3 3"/>
</svg>`;

const DIAGRAM_ICON = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="6" height="5" rx="1"/>
    <rect x="15" y="16" width="6" height="5" rx="1"/>
    <rect x="3" y="16" width="6" height="5" rx="1"/>
    <path d="M6 8v4h12v4"/>
    <path d="M6 12v4"/>
</svg>`;

type ApplyCodeBlockPreview =
    (value: null | string | HTMLElement) => void;

type MarkdownEditorOptions = {
    root: HTMLElement;
    markdown: string;
    readonly: boolean;
    latexRendererUrl: string | null;
    onMarkdownUpdated: (markdown: string) => void;
    onReady: (markdown: string) => void;
};

export type MarkdownEditorHandle = {
    updateMarkdown: (markdown: string) => void;
    setReadonly: (readonly: boolean) => void;
    destroy: () => void;
};

const isCrepeMathLanguage = (language: string): boolean => {
    return language !== QHANA_BACKEND_LATEX_LANGUAGE &&
        language.toLowerCase() === QHANA_BACKEND_LATEX_LANGUAGE;
};

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

export const createMarkdownEditor = (
    options: MarkdownEditorOptions,
): MarkdownEditorHandle => {
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
    });

    const latexPreview = createLatexPreviewRenderer({
        latexRendererUrl: options.latexRendererUrl,
    });

    const initialMarkdown = options.markdown;
    let currentMarkdown = initialMarkdown;
    let destroyed = false;

    const crepe = new Crepe({
        root: options.root,
        defaultValue: initialMarkdown,
        features: {
            [Crepe.Feature.TopBar]: true,
        },
        featureConfigs: {
            [Crepe.Feature.TopBar]: {
                headingOptions: [
                    {
                        label: 'Plain Text',
                        level: null,
                    },
                    {
                        label: 'Large Heading',
                        level: 1,
                    },
                    {
                        label: 'Medium Heading',
                        level: 2,
                    },
                    {
                        label: 'Small Heading',
                        level: 3,
                    },
                ],

                buildTopBar: (builder) => {
                    builder
                        .addGroup('history', 'History')
                        .addItem('undo', {
                            icon: UNDO_ICON,
                            active: () => false,
                            onRun: (ctx: Ctx) => {
                                const view = ctx.get(editorViewCtx);

                                undo(
                                    view.state,
                                    view.dispatch,
                                );
                            },
                        })
                        .addItem('redo', {
                            icon: REDO_ICON,
                            active: () => false,
                            onRun: (ctx: Ctx) => {
                                const view = ctx.get(editorViewCtx);

                                redo(
                                    view.state,
                                    view.dispatch,
                                );
                            },
                        });

                    builder
                        .getGroup('list')
                        .addItem('lift-list-item', {
                            icon: OUTDENT_ICON,
                            active: () => false,
                            onRun: (ctx: Ctx) => {
                                const commands =
                                    ctx.get(commandsCtx);

                                commands.call(
                                    liftListItemCommand.key,
                                );
                            },
                        })
                        .addItem('sink-list-item', {
                            icon: INDENT_ICON,
                            active: () => false,
                            onRun: (ctx: Ctx) => {
                                const commands =
                                    ctx.get(commandsCtx);

                                commands.call(
                                    sinkListItemCommand.key,
                                );
                            },
                        });

                    builder
                        .getGroup('block')
                        .addItem('diagram', {
                            icon: DIAGRAM_ICON,
                            active: () => false,
                            onRun: (ctx: Ctx) => {
                                const commands =
                                    ctx.get(commandsCtx);

                                commands.call(
                                    setBlockTypeCommand.key,
                                    {
                                        nodeType:
                                            codeBlockSchema.type(ctx),
                                        attrs: {
                                            language: 'mermaid',
                                        },
                                    },
                                );
                            },
                        });
                },
            },
        },
    });

    crepe.editor.use(qhanaCodeBlockSchema);

    crepe.setReadonly(options.readonly);

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
                if (markdown !== previousMarkdown) {
                    options.onMarkdownUpdated(markdown);
                }
            },
        );
    });

    crepe.create()
        .then(() => {
            if (destroyed) {
                return;
            }

            if (currentMarkdown !== initialMarkdown) {
                crepe.editor.action(
                    replaceAll(currentMarkdown, true),
                );
            }

            options.onReady(currentMarkdown);
        })
        .catch((error: unknown) => {
            console.error(
                'Could not initialize Markdown editor.',
                error,
            );
        });

    return {
        updateMarkdown: (markdown: string): void => {
            currentMarkdown = markdown;

            if (crepe.editor.status === EditorStatus.Created) {
                crepe.editor.action(
                    replaceAll(markdown, true),
                );
            }
        },

        setReadonly: (readonly: boolean): void => {
            crepe.setReadonly(readonly);
        },

        destroy: (): void => {
            destroyed = true;
            crepe.destroy();
        },
    };
};