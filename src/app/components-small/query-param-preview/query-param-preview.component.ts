import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { QhanaBackendService } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-query-param-preview',
    templateUrl: './query-param-preview.component.html',
    styleUrls: ['./query-param-preview.component.sass']
})
export class QueryParamPreviewComponent implements OnChanges {

    @Input() src: string | null = null;

    content: string | null = null;

    constructor(private backend: QhanaBackendService) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.src == null) {
            this.content = "";
            return;
        }
        this.backend.getExperimentDataContent(this.src).subscribe((blob) => {
            if (blob.type === "application/x-www-form-urlencoded" && blob.size < 1048576) {
                // preview must be of the correct mimetype and not too large!
                blob.text().then((text) => {
                    const params = new URLSearchParams(text);
                    let mdString = "| **Parameter** | **Value** |\n|:---|:----|\n";
                    let lastParam: string = "";
                    params.forEach((value, key) => {
                        if (key === lastParam) {
                            mdString += `|   | ${value.replace(/\|/g, "\\|").replace(/\n/g, "&#10;")} |\n`;
                            return;
                        }
                        lastParam = key;
                        mdString += `| ${key} | ${value.replace(/\|/g, "\\|").replace(/\n/g, "&#10;")} |\n`;
                    });
                    this.content = mdString;
                });
            } else {
                this.content = ":warning: The urlencoded string is too large to preview.";
            }
        });
    }

}
