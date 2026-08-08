import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { QhanaBackendService, TimelineStepApiObject } from 'src/app/services/qhana-backend.service';

interface SelectValue {
    value: string | boolean;
    viewValue: string;
}

@Component({
    selector: 'qhana-export-experiment',
    templateUrl: './export-experiment.dialog.html',
    styleUrls: ['./export-experiment.dialog.sass'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ExportExperimentDialog implements OnInit {

    private backend: QhanaBackendService | null = null;
    private experimentId: string | null = null;
    canExport: boolean = true;

    configTest: string = "";

    configRestriction: "ALL" | "LOGS" | "DATA" | "STEPS" = "ALL";
    restrictionValues: SelectValue[] = [
        { value: "ALL", viewValue: "Complete experiment" },
        { value: "LOGS", viewValue: "Only timeline steps/substeps (no data files)" },
        { value: "DATA", viewValue: "Only data files" },
        { value: "STEPS", viewValue: "List of steps" }
    ];

    allDataVersions: boolean = true;
    allDataVersionsValues: SelectValue[] = [
        { value: true, viewValue: "All data versions" },
        { value: false, viewValue: "Only newest data version" }
    ];

    stepList: number[] = [];
    stepListPage: TimelineStepApiObject[] = [];
    stepCollectionSize: number = 0;
    readonly pageSize = 10;

    constructor(public dialogRef: MatDialogRef<ExportExperimentDialog>, @Inject(MAT_DIALOG_DATA) public data: any) { }

    ngOnInit(): void {
        this.backend = this.data.backend;
        this.experimentId = this.data.experimentId;
        this.onStepPageChange(0, this.pageSize);
    }

    onExport() {
        const experimentId = this.experimentId;
        const backend = this.backend;
        if (experimentId == null || backend == null) {
            // should never happen
            console.error("Cannot export experiment!");
            return;
        }
        backend.exportExperiment(experimentId, this.configRestriction, this.allDataVersions, this.stepList).subscribe(resp => { }, (error) => {
            console.error("Unhandled error during experiment export!", error);
        });
        this.dialogRef.close();
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onStepPageChange(page: number, pageSize: number) {
        if (this.experimentId == null || this.backend == null) {
            // should never happen
            console.warn("Experiment id or backend not set correctly.");
            this.canExport = false;
            return;
        }
        this.backend.getTimelineStepsPage(this.experimentId, {
            page: page,
            itemCount: pageSize,
        }).subscribe(resp => {
            this.stepCollectionSize = resp.itemCount;
            this.stepListPage = resp.items;
        });
    }

    selectStep(step: number, checked: boolean) {
        if (!checked && this.stepList.includes(step)) {
            this.stepList = this.stepList.filter(id => id !== step);
        } else if (checked && !this.stepList.includes(step)) {
            this.stepList.push(step);
        }
    }

    resetSteps() {
        this.stepList = [];
        this.onStepPageChange(0, this.pageSize);
    }
}
