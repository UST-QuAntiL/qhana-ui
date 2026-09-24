import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { of } from 'rxjs';

import { ExperimentTimelineComponent } from './experiment-timeline.component';

@Component({
    selector: 'qhana-step-status',
    template: '',
    standalone: false
})
class StepStatusStubComponent {
    @Input() step: any = null;
    @Input() noText = false;
    @Input() spinner = 20;
}

describe('ExperimentTimelineComponent', () => {
    let component: ExperimentTimelineComponent;
    let fixture: ComponentFixture<ExperimentTimelineComponent>;

    const matDialogStub = {
        open: jasmine.createSpy('open').and.returnValue({
            afterClosed: () => of(null)
        })
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CommonModule,
                FormsModule,
                MatButtonModule,
                MatCardModule,
                MatExpansionModule,
                MatFormFieldModule,
                MatIconModule,
                MatInputModule,
                MatPaginatorModule,
                MatRadioModule,
                MatSelectModule
            ],
            declarations: [
                ExperimentTimelineComponent,
                StepStatusStubComponent
            ],
            providers: [
                {
                    provide: MatDialog,
                    useValue: matDialogStub
                }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ExperimentTimelineComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});