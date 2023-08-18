import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { Subscription, from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { ExperimentDataApiObject, ExperimentDataRef, QhanaBackendService } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-preview-list',
    templateUrl: './preview-list.component.html',
    styleUrls: ['./preview-list.component.sass']
})
export class PreviewListComponent implements OnInit, OnChanges, OnDestroy {

    @Input() dataList: ExperimentDataRef[] = [];

    resolvedDataList: ExperimentDataApiObject[] = [];

    experimentId: string | null = null;
    private experimentSubscription: Subscription | null = null;

    constructor(private backend: QhanaBackendService, private experiment: CurrentExperimentService) { }

    ngOnInit(): void {
        this.experimentSubscription = this.experiment.experimentId.subscribe(experimentId => {
            const old = this.experimentId;
            this.experimentId = experimentId;
            if (old == null && experimentId != null) {
                this.ngOnChanges({ experimentId: { currentValue: experimentId, previousValue: old, firstChange: false, isFirstChange: () => false } });
            }
        });
    }

    ngOnDestroy(): void {
        this.experimentSubscription?.unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges): void {
        // TODO make this more efficient! (maybe use caching in backend service)
        const experimentId = this.experimentId;
        if (experimentId == null) {
            return;
        }

        if (!changes.experimentId && changes.dataList) {
            // only data list has changed
            if ((changes.dataList.currentValue?.length ?? 0) === this.dataList.length) {
                // lists have the same length
                const changedItem = this.dataList.some((value, index) => {
                    const oldValue: ExperimentDataRef = changes.dataList.currentValue?.[index];
                    if (oldValue == null) {
                        return true;
                    }
                    return oldValue.name != value.name || oldValue.version != value.version;
                });
                if (!changedItem) {
                    // no item has changed
                    console.log("Fast exit")
                    return;
                }
            }
        }

        from(this.dataList).pipe(
            concatMap(ref => this.backend.getExperimentData(experimentId, ref.name, ref.version)),
            toArray(),
        ).subscribe(
            resolved => this.resolvedDataList = resolved,
            err => this.resolvedDataList = [], // TODO error handling
        );
    }

    trackByFn = (index: number, value: ExperimentDataApiObject) => {
        return value['@self'];
    }

}
