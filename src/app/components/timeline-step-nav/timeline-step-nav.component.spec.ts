import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimelineStepNavComponent } from './timeline-step-nav.component';

describe('TimelineStepNavComponent', () => {
    let component: TimelineStepNavComponent;
    let fixture: ComponentFixture<TimelineStepNavComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [TimelineStepNavComponent]
        })
            .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(TimelineStepNavComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
