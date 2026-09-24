import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    Output
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { SettingsPageComponent } from './settings-page.component';

@Component({
    selector: 'qhana-growing-list',
    template: '',
    standalone: false
})
class GrowingListStubComponent {
    @Input() rels: any = null;
    @Input() newItemRels: any = null;
    @Input() deleteButton: any = null;
    @Input() highlighted: any = null;

    @Output() clickItem = new EventEmitter<any>();

    reloadAll(): void {}
}

@Component({
    selector: 'qhana-markdown',
    template: '',
    standalone: false
})
class MarkdownStubComponent {
    @Input() markdown: any = null;
    @Input() editable: any = null;

    @Output() markdownChanges = new EventEmitter<any>();
}

describe('SettingsPageComponent', () => {
    let component: SettingsPageComponent;
    let fixture: ComponentFixture<SettingsPageComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CommonModule,
                FormsModule,
                MatButtonModule,
                MatCardModule,
                MatFormFieldModule,
                MatIconModule,
                MatInputModule
            ],
            declarations: [
                SettingsPageComponent,
                GrowingListStubComponent,
                MarkdownStubComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(SettingsPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});