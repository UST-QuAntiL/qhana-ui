import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { of } from 'rxjs';

import { PluginUiframeComponent } from './plugin-uiframe.component';

describe('PluginUiframeComponent', () => {
    let component: PluginUiframeComponent;
    let fixture: ComponentFixture<PluginUiframeComponent>;

    const matDialogStub = {
        open: jasmine.createSpy('open').and.returnValue({
            afterClosed: () => of(null)
        })
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CommonModule,
                MatButtonModule,
                MatDividerModule,
                MatIconModule,
                MatProgressSpinnerModule
            ],
            declarations: [
                PluginUiframeComponent
            ],
            providers: [
                {
                    provide: MatDialog,
                    useValue: matDialogStub
                }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(PluginUiframeComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});