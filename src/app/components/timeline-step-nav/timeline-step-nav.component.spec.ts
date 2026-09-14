import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterTestingModule } from '@angular/router/testing';

import { TimelineStepNavComponent } from './timeline-step-nav.component';

@Component({
    template: `
        <mat-tab-nav-panel #tabPanel></mat-tab-nav-panel>
        <qhana-timeline-step-nav
            [tabPanel]="tabPanel">
        </qhana-timeline-step-nav>
    `,
    standalone: false
})
class TestHostComponent {}

describe('TimelineStepNavComponent', () => {
    let component: TimelineStepNavComponent;
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                CommonModule,
                MatTabsModule,
                RouterTestingModule
            ],
            declarations: [
                TimelineStepNavComponent,
                TestHostComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();

        component = fixture.debugElement
            .query(By.directive(TimelineStepNavComponent))
            .componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});