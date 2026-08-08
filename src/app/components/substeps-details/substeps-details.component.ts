import { Component, Input, OnChanges, OnInit, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { QhanaBackendService, TimelineSubStepApiObject } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-substeps-details',
    templateUrl: './substeps-details.component.html',
    styleUrls: ['./substeps-details.component.sass'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class SubstepsDetailsComponent implements OnChanges {

    @Input() experimentId: string | number | null = null;
    @Input() substepRef: TimelineSubStepApiObject | null = null;

    substep: TimelineSubStepApiObject | null = null;

    constructor(private backend: QhanaBackendService) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.experimentId != null) {
            this.reload();
            return;
        }
        if (changes.substepRef != null) {
            const { currentValue, previousValue } = changes.substepRef;
            if (currentValue?.stepId !== previousValue?.stepId || currentValue?.substepNr !== previousValue?.substepNr) {
                this.reload();
                return;
            }
        }
    }

    reload() {
        if (this.experimentId == null || this.substepRef == null) {
            return;
        }
        this.backend.getTimelineSubStep(this.experimentId, this.substepRef.stepId, this.substepRef.substepNr).subscribe(substep => this.substep = substep);
    }

}
