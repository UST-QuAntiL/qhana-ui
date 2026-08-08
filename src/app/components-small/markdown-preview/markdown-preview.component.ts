import { Component, Input, OnChanges, OnInit, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { QhanaBackendService } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-markdown-preview',
    templateUrl: './markdown-preview.component.html',
    styleUrls: ['./markdown-preview.component.sass'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class MarkdownPreviewComponent implements OnChanges {

    @Input() src: string | null = null;

    content: string | null = null;

    constructor(private backend: QhanaBackendService) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.src == null) {
            this.content = "";
            return;
        }
        this.backend.getExperimentDataContent(this.src).subscribe((blob) => {
            if (blob.type === "text/markdown" && blob.size < 1048576) {
                // preview must be markdown and not too large!
                blob.text().then((text) => this.content = text);
            } else {
                this.content = ":warning: The data content is not of type markdown or too large to preview.";
            }
        });
    }

}
