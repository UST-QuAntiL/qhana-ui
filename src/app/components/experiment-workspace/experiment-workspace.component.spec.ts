import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    Output
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';

import { ExperimentWorkspaceComponent } from './experiment-workspace.component';

@Component({
    selector: 'qhana-plugin-sidebar',
    template: '',
    standalone: false
})
class PluginSidebarStubComponent {}

@Component({
    selector: 'qhana-plugin-last-used',
    template: '',
    standalone: false
})
class PluginLastUsedStubComponent {
    @Input() plugin: any;
    @Input() spinner: any;
}

@Component({
    selector: 'qhana-markdown',
    template: '',
    standalone: false
})
class MarkdownStubComponent {
    @Input() markdown: any;
    @Input() editable: any;
}

@Component({
    selector: 'qhana-plugin-uiframe',
    template: '',
    standalone: false
})
class PluginUiframeStubComponent {
    @Input() url: any;
    @Input() plugin: any;
    @Input() context: any;

    @Output() formDataSubmit = new EventEmitter<any>();
    @Output() requestDataPreview = new EventEmitter<any>();
}

@Component({
    selector: 'qhana-data-preview',
    template: '<ng-content></ng-content>',
    standalone: false
})
class DataPreviewStubComponent {
    @Input() data: any;
    @Input() context: any;
}

@Component({
    selector: 'qhana-experiment-workspace-detail',
    template: '',
    standalone: false
})
class ExperimentWorkspaceDetailStubComponent {}

describe('ExperimentWorkspaceComponent', () => {
    let component: ExperimentWorkspaceComponent;
    let fixture: ComponentFixture<ExperimentWorkspaceComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CommonModule,
                MatCardModule,
                MatChipsModule,
                MatIconModule
            ],
            declarations: [
                ExperimentWorkspaceComponent,
                PluginSidebarStubComponent,
                PluginLastUsedStubComponent,
                MarkdownStubComponent,
                PluginUiframeStubComponent,
                DataPreviewStubComponent,
                ExperimentWorkspaceDetailStubComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ExperimentWorkspaceComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});