import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ExperimentComponent } from './experiment.component';

describe('ExperimentComponent', () => {
    let component: ExperimentComponent;
    let fixture: ComponentFixture<ExperimentComponent>;

    const matDialogStub = {
        open: jasmine.createSpy('open').and.returnValue({
            afterClosed: () => of(null)
        })
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [ExperimentComponent],
            providers: [
                {
                    provide: MatDialog,
                    useValue: matDialogStub
                }
            ]
        })
            .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(ExperimentComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});