import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { MarkdownComponent } from './markdown.component';

describe('MarkdownComponent', () => {
    let component: MarkdownComponent;
    let fixture: ComponentFixture<MarkdownComponent>;

    const matDialogStub = {
        open: jasmine.createSpy('open').and.returnValue({
            afterClosed: () => of(null)
        })
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [MarkdownComponent],
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
        fixture = TestBed.createComponent(MarkdownComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});