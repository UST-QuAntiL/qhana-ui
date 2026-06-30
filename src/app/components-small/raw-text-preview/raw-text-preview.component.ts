import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { QhanaBackendService } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-raw-text-preview',
    templateUrl: './raw-text-preview.component.html',
    styleUrls: ['./raw-text-preview.component.sass'],
    standalone: false
})
export class RawTextPreviewComponent implements OnChanges {

    @Input() src: string | null = null;

    content: string | null = null;

    constructor(private backend: QhanaBackendService) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.src == null) {
            this.content = "";
            return;
        }
        this.backend.getExperimentDataContent(this.src).subscribe((blob) => {
            if (blob.size < 1048576) {
                // preview must be markdown and not too large!
                blob.text().then((text) => this.content = text);
            } else {
                blob.slice(0, 1048576).text().then((text) => {
                    this.content = text + "\n\n... content omitted in preview";
                });
            }
        });
    }

}
