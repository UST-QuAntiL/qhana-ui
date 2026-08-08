import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import TimeAgo from 'javascript-time-ago';
import { Observable, Subscription, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { PluginApiObject } from 'src/app/services/qhana-api-data-types';
import { QhanaBackendService, TimelineStepApiObject } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-plugin-last-used',
    templateUrl: './plugin-last-used.component.html',
    styleUrls: ['./plugin-last-used.component.sass'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PluginLastUsedComponent implements OnInit, OnChanges, OnDestroy {

    @Input() color: 'accent' | 'primary' = 'primary';
    @Input() spinner: number = 20;

    @Input() plugin: PluginApiObject | null = null;

    private timeFormatter = new TimeAgo("en-GB");

    isOld: boolean = false;
    lastUsedTime: Date | null = null;
    lastUsedTimeHuman: Observable<string> | null = null;
    lastStatus: string | null = null;
    lastOpenStep: string | number | null = null;

    private experimentId: string | null = null;
    private experimentIdSubscription: Subscription | null = null;
    private pendingUpdatesSubscription: Subscription | null = null;

    constructor(private backend: QhanaBackendService, private experiment: CurrentExperimentService) { }

    ngOnInit(): void {
        this.experimentIdSubscription = this.experiment.experimentId.subscribe(experimentId => {
            const shouldUpdate = this.experimentId !== experimentId;
            this.experimentId = experimentId;
            if (shouldUpdate) {
                this.updateLastUsed();
            }
        });
    }

    ngOnDestroy(): void {
        this.experimentIdSubscription?.unsubscribe();
        this.pendingUpdatesSubscription?.unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.plugin != null) {
            this.updateLastUsed();
        }
    }

    private updateLastUsed() {
        const experimentId = this.experimentId;
        const plugin = this.plugin;
        if (experimentId == null || plugin == null) {
            this.resetLastused();
            return;
        }
        this.pendingUpdatesSubscription?.unsubscribe();

        this.backend.getTimelineStepsPage(experimentId, {
            itemCount: 5,
            sort: -1,
            pluginName: plugin.identifier,
            version: plugin.version,
        }).subscribe(timelineSteps => {
            if (timelineSteps.items.length > 0) {
                this.updateLastUsedFromStep(timelineSteps.items[0]);
            } else {
                this.resetLastused();
            }
        }, (err) => this.resetLastused());
    }

    private resetLastused() {
        this.lastUsedTime = null;
        this.lastStatus = null;
        this.lastOpenStep = null;
        this.pendingUpdatesSubscription?.unsubscribe();
    }

    private updateLastUsedFromStep(step: TimelineStepApiObject) {
        let lastUsedTime: Date;
        if (step.end != null && step.end !== "") {
            lastUsedTime = new Date(step.end);
        } else {
            lastUsedTime = new Date(step.start);
        }

        const yesterday = new Date(new Date().getTime() - (24 * 60 * 60 * 1000))

        const isOld = lastUsedTime < yesterday;
        this.isOld = isOld;
        this.lastUsedTime = lastUsedTime;
        this.lastStatus = step.status;

        if (step.status === "PENDING") {
            this.lastOpenStep = step.sequence;
        } else {
            this.lastOpenStep = null;
        }

        this.lastUsedTimeHuman = timer(0, isOld ? 5 * 60 * 1000 : 10 * 1000).pipe(
            map(() => {
                return this.timeFormatter.format(lastUsedTime, 'twitter-minute-now');
            })
        );

        if (step.status === "PENDING") {
            this.pendingUpdatesSubscription?.unsubscribe();
            this.pendingUpdatesSubscription = timer(60 * 1000, 60 * 1000).subscribe(() => this.updateLastUsed());
        }

    }


}
