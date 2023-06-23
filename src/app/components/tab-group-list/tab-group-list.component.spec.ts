import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabGroupListComponent } from './tab-group-list.component';

describe('TabGroupListComponent', () => {
    let component: TabGroupListComponent;
    let fixture: ComponentFixture<TabGroupListComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [TabGroupListComponent]
        })
            .compileComponents();

        fixture = TestBed.createComponent(TabGroupListComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
