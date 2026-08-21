import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'qhana-markdown-help',
    templateUrl: './markdown-help.dialog.html',
    styleUrls: ['./markdown-help.dialog.sass'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class MarkdownHelpDialog {

    helptext = `
## Headings

Markdown headings begin with 1 to 6 \`#\`-symbols followed by a space:

\`# first level heading (h1)\`
\`### third level heading (h3)\`


## Text Formatting

To format text **bold**, *cursive*, ~strike through~ or as \`inline code\` mark the text with the mouse and select the formatting.
Links can be inserted the same way.


## Math

Math formulas can be inserted inline by typing \`$\` followed by the formula and closing with \`$\` again.
Clicking on the formula opens a popup where the content can be edited.
Example of an inline formula: $A = \\pi \\cdot r^2$

Starting a new line with two \`$$\` and pressing enter creates a new math block. Clicking on the math block allows editing its content.

$$
A = \\pi \\cdot r^2\\\\
U = 2 \\pi r
$$

Math is rendered using KaTeX and allows the use of LaTeX math characters.


## Slash Commands

Typing \`/\` in an empty line opens the slash command menu that can be used to insert Markdown elements like lists, tables, code blocks and math blocks.

\`\`\`
Example code block.

The dropdown at the start can be used to select a language for code highlighting.
To exit a code block while editing press [strg]+[enter] on the last line.
\`\`\`


## Mermaid Diagrams

The markdown editor supports mermaid.js diagrams. See [mermaid.js.org](https://mermaid.js.org/)

Create a code block and select \`mermaid\` as its language, or use a fenced Markdown code block with the language \`mermaid\`:

\`\`\`mermaid
graph LR;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
\`\`\`
    `;

    constructor(public dialogRef: MatDialogRef<MarkdownHelpDialog>) { }

    onCancel(): void {
        this.dialogRef.close();
    }

    onOk(): void {
        this.dialogRef.close();
    }
}
