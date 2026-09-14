import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    Output
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';

import { ApiLink } from 'src/app/services/api-data-types';

import { TemplateDetailsComponent } from './template-details.component';

@Component({
    selector: 'qhana-plugin-filter-editor',
    template: '',
    standalone: false
})
class PluginFilterEditorStubComponent {
    @Input() tabLink: ApiLink | null = null;
    @Output() filterEmitter = new EventEmitter<string>();
}

describe('TemplateTabFormComponent', () => {
    let component: TemplateDetailsComponent;
    let fixture: ComponentFixture<TemplateDetailsComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CommonModule,
                ReactiveFormsModule,
                MatButtonModule,
                MatFormFieldModule,
                MatIconModule,
                MatInputModule,
                MatRadioModule
            ],
            declarations: [
                TemplateDetailsComponent,
                PluginFilterEditorStubComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(TemplateDetailsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});