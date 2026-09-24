import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatCardModule } from '@angular/material/card';

import { SubstepsDetailsComponent } from './substeps-details.component';

@Component({
    selector: 'qhana-data-preview',
    template: '',
    standalone: false
})
class DataPreviewStubComponent {
    @Input() data: any = null;
    @Input() context: any = null;
}

@Component({
    selector: 'qhana-preview-list',
    template: '',
    standalone: false
})
class PreviewListStubComponent {
    @Input() dataList: any = null;
    @Input() context: any = null;
}

describe('SubstepsDetailsComponent', () => {
    let component: SubstepsDetailsComponent;
    let fixture: ComponentFixture<SubstepsDetailsComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CommonModule,
                MatCardModule
            ],
            declarations: [
                SubstepsDetailsComponent,
                DataPreviewStubComponent,
                PreviewListStubComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(SubstepsDetailsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});