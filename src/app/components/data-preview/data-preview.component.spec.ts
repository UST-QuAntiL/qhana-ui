import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { DataPreviewComponent } from './data-preview.component';

@Component({
    selector: 'qhana-plugin-preview',
    template: '',
    standalone: false
})
class PluginPreviewStubComponent {
    @Input() src: string | null = null;
    @Input() dataType: string | null = null;
    @Input() contentType: string | null = null;
    @Input() plugin: unknown = null;
    @Input() context: unknown = null;
}

@Component({
    selector: 'qhana-raw-text-preview',
    template: '',
    standalone: false
})
class RawTextPreviewStubComponent {
    @Input() src: string | null = null;
}

@Component({
    selector: 'qhana-iframe-preview',
    template: '',
    standalone: false
})
class IframePreviewStubComponent {
    @Input() src: string | null = null;
    @Input() isHtml = false;
}

@Component({
    selector: 'qhana-markdown-preview',
    template: '',
    standalone: false
})
class MarkdownPreviewStubComponent {
    @Input() src: string | null = null;
}

@Component({
    selector: 'qhana-query-param-preview',
    template: '',
    standalone: false
})
class QueryParamPreviewStubComponent {
    @Input() src: string | null = null;
}

@Component({
    selector: 'qhana-image-preview',
    template: '',
    standalone: false
})
class ImagePreviewStubComponent {
    @Input() src: string | null = null;
}

describe('DataPreviewComponent', () => {
    let component: DataPreviewComponent;
    let fixture: ComponentFixture<DataPreviewComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CommonModule,
                FormsModule,
                MatCardModule,
                MatFormFieldModule,
                MatSelectModule
            ],
            declarations: [
                DataPreviewComponent,
                PluginPreviewStubComponent,
                RawTextPreviewStubComponent,
                IframePreviewStubComponent,
                MarkdownPreviewStubComponent,
                QueryParamPreviewStubComponent,
                ImagePreviewStubComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(DataPreviewComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});