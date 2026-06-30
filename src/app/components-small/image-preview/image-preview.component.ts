import { Component, Input, OnChanges, SecurityContext, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
    selector: 'qhana-image-preview',
    templateUrl: './image-preview.component.html',
    styleUrls: ['./image-preview.component.sass'],
    standalone: false
})
export class ImagePreviewComponent implements OnChanges {

    @Input() src: string | null = null;

    previewUrl: SafeUrl | null = null;

    constructor(private sanitizer: DomSanitizer) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.src == null) {
            this.previewUrl = null;
            return;
        }
        this.previewUrl = this.sanitizer.sanitize(SecurityContext.URL, this.src);
    }

}
