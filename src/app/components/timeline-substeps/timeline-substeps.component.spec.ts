import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    Output
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatExpansionModule } from '@angular/material/expansion';

import { TimelineSubstepsComponent } from './timeline-substeps.component';

@Component({
    selector: 'qhana-plugin-uiframe',
    template: '',
    standalone: false
})
class PluginUiframeStubComponent {
    @Input() url: string | null = null;
    @Input() context: unknown = null;

    @Output() formDataSubmit = new EventEmitter<any>();
    @Output() requestDataPreview = new EventEmitter<any>();
}

@Component({
    selector: 'qhana-substeps-details',
    template: '',
    standalone: false
})
class SubstepsDetailsStubComponent {
    @Input() experimentId: string | number | null = null;
    @Input() substepRef: unknown = null;
}

describe('TimelineSubstepsComponent', () => {
    let component: TimelineSubstepsComponent;
    let fixture: ComponentFixture<TimelineSubstepsComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CommonModule,
                MatExpansionModule
            ],
            declarations: [
                TimelineSubstepsComponent,
                PluginUiframeStubComponent,
                SubstepsDetailsStubComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(TimelineSubstepsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});