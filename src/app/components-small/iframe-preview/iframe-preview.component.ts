import { Component, Input, OnChanges, SecurityContext, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
    selector: 'qhana-iframe-preview',
    templateUrl: './iframe-preview.component.html',
    styleUrls: ['./iframe-preview.component.sass'],
    standalone: false
})
export class IframePreviewComponent implements OnChanges {

    @Input() src: string | null = null;
    @Input() isHtml: boolean = false;

    previewUrl: SafeResourceUrl | null = null;

    constructor(private sanitizer: DomSanitizer) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.src == null) {
            this.previewUrl = null;
            return;
        }

        // TODO use an actual sanitization here
        this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.src);
    }

}
