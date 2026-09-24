import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    Output
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';

import { ApiLink } from 'src/app/services/api-data-types';
import {
    ExperimentDataApiObject
} from 'src/app/services/qhana-backend.service';

import {
    FormSubmitData
} from '../plugin-uiframe/plugin-uiframe.component';
import { PluginTabComponent } from './plugin-tab.component';

@Component({
    selector: 'qhana-growing-list',
    template: '',
    standalone: false
})
class GrowingListStubComponent {
    @Input() apiLink: ApiLink | null = null;
    @Input() highlighted: Set<string> = new Set();
    @Input() highlightByKey: string | null = null;

    @Output() clickItem = new EventEmitter<ApiLink>();
}

@Component({
    selector: 'qhana-plugin-uiframe',
    template: '',
    standalone: false
})
class PluginUiframeStubComponent {
    @Input() url: string | null = null;
    @Input() context: unknown = null;

    @Output() formDataSubmit = new EventEmitter<FormSubmitData>();
    @Output() requestDataPreview =
        new EventEmitter<ExperimentDataApiObject>();
}

@Component({
    selector: 'qhana-data-preview',
    template: '<ng-content></ng-content>',
    standalone: false
})
class DataPreviewStubComponent {
    @Input() data: unknown = null;
    @Input() context: unknown = null;
}

describe('PluginTabComponent', () => {
    let component: PluginTabComponent;
    let fixture: ComponentFixture<PluginTabComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CommonModule,
                MatCardModule,
                MatIconModule,
                MatTabsModule
            ],
            declarations: [
                PluginTabComponent,
                GrowingListStubComponent,
                PluginUiframeStubComponent,
                DataPreviewStubComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(PluginTabComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});