export type LatexOptions = {
    placeholder?: {
        empty?: string;
        error?: string;
    };
    latexRendererUrl: string | null;
    latexPackages?: string[];
    imageFormat?: string;
};

export const createLatexPreviewRenderer = (options: LatexOptions) => {
    const placeholder = {
        empty: 'Empty',
        error: 'LaTeX Syntax Error',
        ...(options.placeholder ?? {}),
    };

    const defaultPackages = options.latexPackages ?? [
        '\\usepackage{tikz}',
        '\\usetikzlibrary{quantikz}',
    ];

    const defaultImageFormat = options.imageFormat ?? 'svg';

    return (
        language: string,
        content: string,
    ): HTMLElement | string | null => {
        if (language.toLowerCase() !== 'latex') {
            return null;
        }

        if (!content.trim()) {
            return placeholder.empty;
        }

        if (!options.latexRendererUrl) {
            return placeholder.error;
        }

        try {
            const packagesRegex =
                /(?:^[\t ]*)(\\use[a-zA-Z]+(?:\[[^\]]*\])?(?:\{[^\}]+\}))/gm;

            const foundPackages: string[] = [];
            let currentPackage = packagesRegex.exec(content);

            while (currentPackage !== null) {
                foundPackages.push(currentPackage[1]);
                currentPackage = packagesRegex.exec(content);
            }

            const packages =
                foundPackages.length > 0 ? foundPackages : defaultPackages;

            const imageFormatRegex =
                /(?:%[\t ]*format\s*[:=]\s*)([a-zA-Z-]+)(?:[\t ]*$)/gm;

            const outputFormat =
                imageFormatRegex.exec(content)?.[1] ?? defaultImageFormat;

            const stripImageFormatRegex = /%[^\n]*$/gm;

            const processedCode = content
                .replace(packagesRegex, '')
                .replace(stripImageFormatRegex, '');

            const imageUrl = new URL(options.latexRendererUrl);
            imageUrl.searchParams.set('content', processedCode);
            imageUrl.searchParams.set('output', outputFormat);

            packages.forEach((latexPackage) => {
                imageUrl.searchParams.append('packages', latexPackage);
            });

            const image = document.createElement('img');
            image.src = imageUrl.toString();
            image.alt = 'LaTeX preview';

            return image;
        } catch (error) {
            console.error('Could not render LaTeX preview.', error);
            return placeholder.error;
        }
    };
};
