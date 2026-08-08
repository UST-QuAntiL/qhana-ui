import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'qhana-create-experiment',
    templateUrl: './create-experiment.dialog.html',
    styleUrls: ['./create-experiment.dialog.sass'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CreateExperimentDialog implements OnInit {

    experimentName: string = "";
    experimentDescription: string = "";

    constructor(public dialogRef: MatDialogRef<CreateExperimentDialog>) { }

    ngOnInit(): void {
        // nothing
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onOk(): void {
        this.dialogRef.close();
    }

}
