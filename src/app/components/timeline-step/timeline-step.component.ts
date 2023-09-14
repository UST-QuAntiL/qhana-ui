import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable, Subject, Subscription, from, of, timer } from 'rxjs';
import { catchError, concatMap, debounceTime, filter, mergeAll, mergeMap, take, throttleTime } from 'rxjs/operators';
import { ApiLink, CollectionApiObject, PageApiObject } from 'src/app/services/api-data-types';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { QhanaBackendService, TimelineStepApiObject, TimelineSubStepApiObject } from 'src/app/services/qhana-backend.service';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TabDefinition } from '../timeline-step-nav/timeline-step-nav.component';

interface Progress {
    start: number;
    target: number;
    value: number;
    unit?: string;
}

@Component({
    selector: 'qhana-timeline-step',
    templateUrl: './timeline-step.component.html',
    styleUrls: ['./timeline-step.component.sass']
})
export class TimelineStepComponent implements OnInit, OnDestroy {

    private routeSubscription: Subscription | null = null;
    private stepSubscription: Subscription | null = null;
    private autoSaveNotesSubscription: Subscription | null = null;

    private manualRefresh: Subject<number> = new Subject();
    private notesUpdates: BehaviorSubject<string> = new BehaviorSubject<string>("");
    private lastSavedNotes: string = "";


    watching: "watching" | "paused" | "error" | null = null;

    backendUrl: string | null;

    experimentId: string = "";
    stepId: string | null = null;
    stepTabId: string = "overview";

    tabs: TabDefinition[] = [
        { tabId: "steps", name: "Sub-Steps" },
        { tabId: "inputs", name: "Inputs" },
        { tabId: "outputs", name: "Outputs" }
    ];

    timelineStep: TimelineStepApiObject | null = null;
    resultQuality: "UNKNOWN" | "NEUTRAL" | "GOOD" | "BAD" | "ERROR" | "UNUSABLE" = "UNKNOWN";
    stepProcessor: Promise<string | null> | null = null;
    stepProgress: Progress | null = null;
    substeps: TimelineSubStepApiObject[] | null = null;
    stepNotes: string | null = null;

    notesStatus: "original" | "changed" | "saved" = "original";

    pluginRecommendations: ApiLink[] = [];


    constructor(private route: ActivatedRoute, private experiment: CurrentExperimentService, private backend: QhanaBackendService, private registry: PluginRegistryBaseService) {
        this.backendUrl = backend.backendRootUrl;
    }

    ngOnInit(): void {
        this.autoSaveNotesSubscription = this.notesUpdates.pipe(
            filter(value => value != null && value !== this.lastSavedNotes),
            debounceTime(500)
        ).subscribe(this.saveNotes);
        this.routeSubscription = this.route.params.subscribe(params => {
            let hasChanged = this.experimentId !== params.experimentId;
            this.experimentId = params.experimentId;
            this.experiment.setExperimentId(params.experimentId);
            hasChanged = hasChanged || (this.stepId !== params.step);
            this.stepId = params.step;
            this.stepTabId = params.stepTabId ?? "overview";
            if (hasChanged) {
                this.stepNotes = null;
                this.lastSavedNotes = "";
                this.notesStatus = "original";
                this.loadData(params.experimentId, params.step);
            }
        });
    }

    ngOnDestroy(): void {
        this.routeSubscription?.unsubscribe();
        this.stepSubscription?.unsubscribe();
        this.autoSaveNotesSubscription?.unsubscribe();
        if (this.notesStatus === "changed") {
            const newNotesText = this.notesUpdates.getValue();
            if (newNotesText !== this.lastSavedNotes) {
                this.saveNotes(newNotesText);
            }
        }
    }

    restartWatching() {
        if (this.watching === "watching") {
            this.manualRefresh.next(1);
            return; // already watching
        }
        if (this.experimentId && this.stepId) {
            this.loadData(this.experimentId, this.stepId);
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
        ).subscribe(stepApiObject => {
            if (stepApiObject == null) {
                // error happened (already handled in catchError)
                return;
            }
            if (stepApiObject === "end") {
                this.loadNotes(experimentId, step);
                // watching has ended
                return;
            }
            this.timelineStep = stepApiObject;
            this.resultQuality = stepApiObject.resultQuality;
            this.stepProcessor = this.getStepProcessor(stepApiObject);
            this.stepProgress = this.getStepProgress(stepApiObject);
            this.substeps = stepApiObject.substeps ?? null;
            if (stepApiObject.end != null) {
                this.loadNotes(experimentId, step);
                this.loadRecommendations(experimentId, step);
                // step is fully realized, no need to watch
                stepSubscription?.unsubscribe();
                this.watching = null;
            }
        }, err => {
            this.watching = "error";
        });
        this.stepSubscription = stepSubscription;
    }

    private async getStepProcessor(step: TimelineStepApiObject) {
        const search = new URLSearchParams();
        search.set("item-count", "1");
        search.set("name", step.processorName);
        search.set("version", step.processorVersion);
        let page = await this.registry.getByRel<PageApiObject>("plugin", search);
        if (page?.data.items) {
            return page.data.items[0].resourceKey?.pluginId ?? null;
        }
        search.delete("version");
        page = await this.registry.getByRel<PageApiObject>("plugin", search);
        return page?.data.items[0].resourceKey?.pluginId ?? null;
    }

    private getStepProgress(step: TimelineStepApiObject): Progress | null {
        if (step.progressStart != null && step.progressTarget != null && step.progressValue != null) {
            const progress: Progress = {
                start: step.progressStart,
                target: step.progressTarget,
                value: step.progressValue,
            };
            if (step.progressUnit) {
                progress.unit = step.progressUnit;
            }
            return progress;
        }
        return null;
    }

    loadNotes(experimentId: number | string, step: string) {
        this.backend.getTimelineStepNotes(experimentId, step).pipe(take(1))
            .subscribe(notes => {
                this.stepNotes = notes.notes;
                this.lastSavedNotes = notes.notes;
            });
    }

    async loadRecommendations(experimentId: number | string, step: string) {
        const params = new URLSearchParams();
        params.set("experiment", experimentId.toString());
        params.set("step", step);
        const result = await this.registry.getByRel<CollectionApiObject>("plugin-recommendation", params);
        this.pluginRecommendations = result?.data?.items ?? [];
    }

    triggerNoteAutosave(text: string) {
        if (text !== this.lastSavedNotes) {
            this.notesStatus = 'changed';
        }
        this.notesUpdates.next(text);
    }

    saveNotes = (text: string) => {
        if (text === this.lastSavedNotes) {
            return; // notes are already saved!
        }
        if (this.stepId == null) {
            return;
        }
        this.backend.saveTimelineStepNotes(this.experimentId, this.stepId, text).subscribe(result => {
            this.lastSavedNotes = text;
            this.notesStatus = 'saved';
        });
    }

    saveResultQuality(newQuality: "UNKNOWN" | "NEUTRAL" | "GOOD" | "BAD" | "ERROR" | "UNUSABLE") {
        if (this.stepId == null) {
            return;
        }
        this.backend.saveTimelineStepResultQuality(this.experimentId, this.stepId, newQuality).subscribe(result => {
            // assume everything is ok (the correct result quality will already be selected)
        });
    }

}
