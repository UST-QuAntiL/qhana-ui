import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { of } from 'rxjs';

import { PluginFilterNodeComponent } from './plugin-filter-node.component';

describe('PluginFilterNodeComponent', () => {
    let component: PluginFilterNodeComponent;
    let fixture: ComponentFixture<PluginFilterNodeComponent>;

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
                MatButtonToggleModule,
                MatCardModule,
                MatCheckboxModule,
                MatFormFieldModule,
                MatIconModule,
                MatInputModule,
                MatSelectModule
            ],
            declarations: [
                PluginFilterNodeComponent
            ],
            providers: [
                {
                    provide: MatDialog,
                    useValue: matDialogStub
                }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(PluginFilterNodeComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('filterIn', {});
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});