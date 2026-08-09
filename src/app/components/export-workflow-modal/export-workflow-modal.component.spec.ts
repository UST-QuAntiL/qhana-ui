import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';

import { ExportWorkflowModalComponent } from './export-workflow-modal.component';

describe('ExportWorkflowModalComponent', () => {
  let component: ExportWorkflowModalComponent;
  let fixture: ComponentFixture<ExportWorkflowModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        ExportWorkflowModalComponent
      ],
      imports: [
        FormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatListModule,
        MatSelectModule
      ],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            steps: []
          }
        },
        {
          provide: MatDialogRef,
          useValue: {
            close: () => {}
          }
        }
      ]
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