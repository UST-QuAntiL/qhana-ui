import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { of } from 'rxjs';

import { ExperimentWorkspaceDetailComponent } from './experiment-workspace-detail.component';

@Component({
    selector: 'qhana-template-details',
    template: '',
    standalone: false
})
class TemplateDetailsStubComponent {
    @Input() templateLink: any = null;
    @Input() tabLink: any = null;
}

describe('ExperimentWorkspaceDetailComponent', () => {
    let component: ExperimentWorkspaceDetailComponent;
    let fixture: ComponentFixture<ExperimentWorkspaceDetailComponent>;

    const matDialogStub = {
        open: jasmine.createSpy('open').and.returnValue({
            afterClosed: () => of(false)
        })
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CommonModule,
                FormsModule,
                MatButtonModule,
                MatCardModule,
                MatChipsModule,
                MatDividerModule,
                MatExpansionModule,
                MatFormFieldModule,
                MatIconModule,
                MatInputModule,
                MatListModule
            ],
            declarations: [
                ExperimentWorkspaceDetailComponent,
                TemplateDetailsStubComponent
            ],
            providers: [
                {
                    provide: MatDialog,
                    useValue: matDialogStub
                }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ExperimentWorkspaceDetailComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});