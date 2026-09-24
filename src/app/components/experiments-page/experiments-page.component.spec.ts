import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { of } from 'rxjs';

import { ExperimentsPageComponent } from './experiments-page.component';

@Component({
    selector: 'qhana-import-experiment',
    template: '',
    standalone: false
})
class ImportExperimentStubComponent {}

describe('ExperimentsPageComponent', () => {
    let component: ExperimentsPageComponent;
    let fixture: ComponentFixture<ExperimentsPageComponent>;

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
                MatButtonToggleModule,
                MatCardModule,
                MatFormFieldModule,
                MatIconModule,
                MatInputModule,
                MatPaginatorModule
            ],
            declarations: [
                ExperimentsPageComponent,
                ImportExperimentStubComponent
            ],
            providers: [
                {
                    provide: MatDialog,
                    useValue: matDialogStub
                }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ExperimentsPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});