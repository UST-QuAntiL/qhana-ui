import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'qhana-markdown-help',
    templateUrl: './markdown-help.dialog.html',
    styleUrls: ['./markdown-help.dialog.sass'],
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

Typing \`/\` in an empty line opens the slash command menue that can be used to insert other markdown elements like lists, tables, code blocks (named "code fences") and mermaid diagrams.

\`\`\`
Example code block.

The dropdown at the start can be used to select a language for code highlighting.
To exit a code block while editing press [strg]+[enter] on the last line.
\`\`\`


## Mermaid Diagrams

The markdown editor supports mermaid.js diagrams. See [mermaid-js.github.io](https://mermaid-js.github.io/mermaid/#/?id=diagram-types)

First create a new diagram with the slash commands, then click on the diagram box (showing "[empty]") to edit the diagram.

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
