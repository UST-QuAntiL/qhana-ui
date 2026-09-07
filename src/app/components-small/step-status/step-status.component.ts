import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { TimelineStepApiObject } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-step-status',
    templateUrl: './step-status.component.html',
    styleUrls: ['./step-status.component.sass'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class StepStatusComponent implements OnChanges {

    @Input() step: TimelineStepApiObject | null = null;
    @Input() noText: boolean = false;
    @Input() spinner: number = 20;

    isPending: boolean = false;
    isSuccess: boolean = false;
    isError: boolean = false;
    isCanceled: boolean = false;
    status: string = "UNKNOWN";

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.step != null) {
            const status = this.step?.status ?? "UNKNOWN";
            this.isPending = status === "PENDING";
            this.isError = status === "FAILURE";
            this.isSuccess = status === "SUCCESS";
            this.isCanceled = status === "CANCELED";
            this.status = status;
        }
    }

}
