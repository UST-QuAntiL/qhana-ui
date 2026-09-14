import {
    Component,
    EventEmitter,
    Input,
    Output
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';

import { NavbarComponent } from './navbar.component';

@Component({
    selector: 'qhana-help-tooltip',
    template: '<ng-content></ng-content>',
    standalone: false
})
class HelpTooltipStubComponent {
    @Input() label: string | null = null;
    @Output() anchor = new EventEmitter<string>();
}

@Component({
    selector: 'qhana-help-toggle',
    template: '',
    standalone: false
})
class HelpToggleStubComponent {}

describe('NavbarComponent', () => {
    let component: NavbarComponent;
    let fixture: ComponentFixture<NavbarComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                MatBadgeModule,
                MatButtonModule,
                MatDividerModule,
                MatIconModule,
                MatMenuModule,
                MatProgressSpinnerModule,
                MatToolbarModule
            ],
            declarations: [
                NavbarComponent,
                HelpTooltipStubComponent,
                HelpToggleStubComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(NavbarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});