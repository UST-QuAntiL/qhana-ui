import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TimelineStepApiObject, ExperimentResultQualityValues } from 'src/app/services/qhana-backend.service';

interface ModalData {
  steps: TimelineStepApiObject[];
}

@Component({
  selector: 'qhana-export-workflow-modal',
  templateUrl: './export-workflow-modal.component.html',
  styleUrls: ['./export-workflow-modal.component.sass']
})

export class ExportWorkflowModalComponent implements OnInit {
  filteredSteps: TimelineStepApiObject[] = [];
  stepSelection: Record<number, boolean> = {};
  resultQualityFilter: string = '';
  resultQualityValues = ExperimentResultQualityValues;

  constructor(
    public dialogRef: MatDialogRef<ExportWorkflowModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ModalData
  ) {}

  ngOnInit(): void {
    this.filteredSteps = [...this.data.steps];
    this.data.steps.forEach(step => {
      this.stepSelection[step.sequence] = true; // default: all checked
    });
  }

  /** Called when the result quality filter changes */
  onFilterChange() {
    // Filter steps based on the selected result quality
    this.filteredSteps = this.data.steps.filter(step =>
      this.resultQualityFilter ? step.resultQuality === this.resultQualityFilter : true
    );

    // Optional: auto-uncheck steps that are no longer visible
    const visibleSequences = new Set(this.filteredSteps.map(s => s.sequence));
    Object.keys(this.stepSelection).forEach(seq => {
      const seqNum = Number(seq);
      if (!visibleSequences.has(seqNum)) {
        this.stepSelection[seqNum] = false;
      }
    });
  }

  /** Returns the currently selected steps */
  getSelectedSteps(): TimelineStepApiObject[] {
    return this.filteredSteps.filter(step => this.stepSelection[step.sequence]);
  }

  /** Determines if the "Export Selected" button should be enabled */
  get hasSelectedSteps(): boolean {
    return this.filteredSteps.length > 0 &&
           this.filteredSteps.some(step => this.stepSelection[step.sequence]);
  }

  /** Close the dialog and optionally return selected steps */
  closeDialog(apply: boolean) {
    this.dialogRef.close(apply ? this.getSelectedSteps() : null);
  }
}