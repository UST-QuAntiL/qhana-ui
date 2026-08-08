import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PluginFilterNodeComponent } from './plugin-filter-node.component';

describe('PluginFilterNodeComponent', () => {
  let component: PluginFilterNodeComponent;
  let fixture: ComponentFixture<PluginFilterNodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        PluginFilterNodeComponent
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