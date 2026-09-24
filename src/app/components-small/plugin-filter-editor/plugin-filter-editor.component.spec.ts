import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    Output
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TextFieldModule } from '@angular/cdk/text-field';

import { PluginFilterEditorComponent } from './plugin-filter-editor.component';

@Component({
    selector: 'qhana-plugin-filter-node',
    template: '',
    standalone: false
})
class PluginFilterNodeStubComponent {
    @Input() filterIn: any;

    @Output() filterOut = new EventEmitter<any>();
    @Output() delete = new EventEmitter<void>();
}

describe('PluginFilterEditorComponent', () => {
    let component: PluginFilterEditorComponent;
    let fixture: ComponentFixture<PluginFilterEditorComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CommonModule,
                FormsModule,
                ReactiveFormsModule,
                TextFieldModule,
                MatButtonModule,
                MatDividerModule,
                MatFormFieldModule,
                MatIconModule,
                MatInputModule,
                MatSlideToggleModule
            ],
            declarations: [
                PluginFilterEditorComponent,
                PluginFilterNodeStubComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(PluginFilterEditorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});