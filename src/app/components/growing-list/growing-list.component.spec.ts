import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { GrowingListComponent } from './growing-list.component';

describe('GrowingListComponent', () => {
    let component: GrowingListComponent;
    let fixture: ComponentFixture<GrowingListComponent>;

    const matDialogStub = {
        open: jasmine.createSpy('open').and.returnValue({
            afterClosed: () => of(null)
        })
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [GrowingListComponent],
            providers: [
                {
                    provide: MatDialog,
                    useValue: matDialogStub
                }
            ]
        })
            .compileComponents();

        fixture = TestBed.createComponent(GrowingListComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});