import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExportWorkflowModalComponent } from './export-workflow-modal.component';

describe('ExportWorkflowModalComponent', () => {
  let component: ExportWorkflowModalComponent;
  let fixture: ComponentFixture<ExportWorkflowModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportWorkflowModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ExportWorkflowModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
