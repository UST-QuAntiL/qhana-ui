import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    Output
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { of } from 'rxjs';

import { PluginSidebarComponent } from './plugin-sidebar.component';

@Component({
    selector: 'qhana-growing-list',
    template: '',
    standalone: false
})
class GrowingListStubComponent {
    @Input() rels: any = null;
    @Input() newItemRels: any = null;
    @Input() highlighted: any = null;
    @Input() highlightByKey: any = null;
    @Input() apiLink: any = null;
    @Input() query: any = null;
    @Input() search: any = null;
    @Input() autoloadOnSearch: any = null;

    @Output() clickItem = new EventEmitter<any>();

    collectionSize = of(0);
    visibleCollectionSize = of(0);
}

@Component({
    selector: 'qhana-tab-group-list',
    template: '',
    standalone: false
})
class TabGroupListStubComponent {
    @Input() templateId: any = null;
    @Input() selectedTab: any = null;

    @Output() clickedOnTab = new EventEmitter<any>();
}

describe('PluginSidebarComponent', () => {
    let component: PluginSidebarComponent;
    let fixture: ComponentFixture<PluginSidebarComponent>;

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
                MatRippleModule,
                MatDividerModule,
                MatFormFieldModule,
                MatIconModule,
                MatInputModule,
                MatTooltipModule
            ],
            declarations: [
                PluginSidebarComponent,
                GrowingListStubComponent,
                TabGroupListStubComponent
            ],
            providers: [
                {
                    provide: MatDialog,
                    useValue: matDialogStub
                }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(PluginSidebarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});