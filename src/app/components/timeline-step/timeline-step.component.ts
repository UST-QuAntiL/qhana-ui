import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { from, Observable, of, Subject, Subscription, timer } from 'rxjs';
import { catchError, concatMap, mergeAll, mergeMap, take, throttleTime } from 'rxjs/operators';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { QhanaBackendService, TimelineStepApiObject } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-timeline-step',
    templateUrl: './timeline-step.component.html',
    styleUrls: ['./timeline-step.component.sass']
})
export class TimelineStepComponent implements OnInit {

    private routeSubscription: Subscription | null = null;
    private stepSubscription: Subscription | null = null;

    private manualRefresh: Subject<number> = new Subject();

    private stepSequence: string | null = null;

    watching: "watching" | "paused" | "error" | null = null;

    backendUrl: string;

    experimentId: string = "";

    timelineStep: TimelineStepApiObject | null = null;

    constructor(private route: ActivatedRoute, private experiment: CurrentExperimentService, private backend: QhanaBackendService) {
        this.backendUrl = backend.backendRootUrl;
    }

    ngOnInit(): void {
        this.routeSubscription = this.route.params.subscribe(params => {
            this.experimentId = params.experimentId;
            this.experiment.setExperimentId(params.experimentId);
            this.stepSequence = params.step;
            this.loadData(params.experimentId, params.step);
        });
    }

    ngOnDestroy(): void {
        this.routeSubscription?.unsubscribe();
        this.stepSubscription?.unsubscribe();
    }

    restartWatching() {
        if (this.watching === "watching") {
            this.manualRefresh.next(1);
            return; // already watching
        }
        if (this.experimentId && this.stepSequence) {
            this.loadData(this.experimentId, this.stepSequence);
        }
    }

    loadData(experimentId: number | string, step: string) {
        this.stepSubscription?.unsubscribe();
        this.watching = "watching";
        let errorCount = 0;
        const maxErrorCount = 3;

        // custom backoff implementation using observables
        const backoff: Array<number[] | "end"> = [
            [1, 3], // seconds between tries, number of tries
            [2, 5],
            [5, 10],
            [10, 10],
            [30, 20],
            "end", // marker for end of list
        ]

        let stepSubscription: Subscription;

        // timer based backoff using values from "backoff"
        const timerObservable = from(backoff).pipe(
            concatMap(backoff => {
                if (backoff === "end") {
                    // handle unsubscribe before throttle
                    stepSubscription?.unsubscribe();
                    this.watching = "paused";
                    return of("end") as Observable<"end">;
                }
                // trigger n times with a given delay, startign immediately
                return timer(0, backoff[0] * 1000).pipe(take(backoff[1] ?? 1));
            }),
        );

        stepSubscription = from([timerObservable, this.manualRefresh.asObservable()]).pipe(
            mergeAll(2), // merge manual refresh signal with timer based backoff
            throttleTime(1000), // throttle signal to not overwhelm the backend
            mergeMap((input) => { // fetch from backend
                if (input === "end") { // reached end signal (may be dropped by throttle!)
                    return of("end") as Observable<"end">;
                }
                return this.backend.getTimelineStep(experimentId, step);
            }),
            catchError(err => { // ignore # errors
                errorCount++;
                if (errorCount > maxErrorCount) {
                    console.error(err);
                    stepSubscription?.unsubscribe();
                    this.watching = "error";
                    throw err;
                }
                return of(null);
            }),
        ).subscribe(step => {
            if (step == null) {
                // error happened (already handled in catchError)
                return;
            }
            if (step === "end") {
                // watching has ended
                return;
            }
            this.timelineStep = step;
            if (step.end != null) {
                // step is fully realized, no need to watch
                stepSubscription?.unsubscribe();
                this.watching = null;
            }
        }, err => {
            this.watching = "error";
        });
        this.stepSubscription = stepSubscription;
    }

}
