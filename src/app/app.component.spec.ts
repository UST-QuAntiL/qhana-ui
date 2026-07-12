import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';

@Component({
    selector: 'qhana-navbar',
    template: '',
    standalone: false
})
class NavbarStubComponent {
    @Input() title = '';
}

describe('AppComponent', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                RouterTestingModule
            ],
            declarations: [
                AppComponent,
                NavbarStubComponent
            ],
        }).compileComponents();
    });

    it('should create the app', () => {
        const fixture = TestBed.createComponent(AppComponent);
        expect(fixture.componentInstance).toBeTruthy();
    });

    it(`should have as title 'QHAna'`, () => {
        const fixture = TestBed.createComponent(AppComponent);
        expect(fixture.componentInstance.title).toEqual('QHAna');
    });

    it('should render the navbar', () => {
        const fixture = TestBed.createComponent(AppComponent);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('qhana-navbar')).not.toBeNull();
    });
});