import { Component, OnDestroy, OnInit } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subscription, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { ExperimentResultQuality, ExperimentResultQualityValues, QhanaBackendService, TimelineStepApiObject } from 'src/app/services/qhana-backend.service';
import { ServiceRegistryService } from 'src/app/services/service-registry.service';
import { HttpClient } from '@angular/common/http';
import { SettingsPageComponent } from '../settings-page/settings-page.component';

interface SelectValue {
    value: number | string;
    viewValue: string;
}

@Component({
    selector: 'qhana-experiment-timeline',
    templateUrl: './experiment-timeline.component.html',
    styleUrls: ['./experiment-timeline.component.sass']
})
export class ExperimentTimelineComponent implements OnInit, OnDestroy {

    private routeSubscription: Subscription | null = null;
    private backendUrlSubscription: Subscription | null = null;

    backendUrl: string | null = null;

    experimentId: string | null = null;

    collectionSize: number = 0;

    loading: boolean = true;
    currentPage: { page: number, itemCount: number } | null = null;

    error: string | null = null;

    timelineSteps: Observable<TimelineStepApiObject[]> | null = null;
    sort: -1 | 0 | 1 = 1;
    pluginName: string | null = null;
    version: string | null = null;
    stepStatus: "SUCCESS" | "PENDING" | "ERROR" | "" = "";
    statusValues: SelectValue[] = [
        { value: "", viewValue: "Not selected" },
        { value: "SUCCESS", viewValue: "Success" },
        { value: "PENDING", viewValue: "Pending" },
        { value: "ERROR", viewValue: "Error" }
    ];
    unclearedSubstep: number = 0;
    unclearedSubstepValues: SelectValue[] = [
        { value: 0, viewValue: "Not selected" },
        { value: 1, viewValue: "Only steps with uncleared substeps" },
        { value: -1, viewValue: "Only steps with cleared substeps" }
    ];
    resultQuality: ExperimentResultQuality | "" = "";
    resultQualityValues = ExperimentResultQualityValues;
    workflowGroupExists = true;
    
    constructor(
        private route: ActivatedRoute,
        private experiment: CurrentExperimentService,
        private backend: QhanaBackendService,
        private serviceRegistry: ServiceRegistryService,
        private http: HttpClient,
        //private settings: SettingsPageComponent
        ) { }

    ngOnInit(): void {
        this.backendUrlSubscription = this.serviceRegistry.backendRootUrl.subscribe(url => this.backendUrl = url);
        this.routeSubscription = this.route.params
            .pipe(
                map(params => params.experimentId),
            ).subscribe(experimentId => {
                const change = this.experimentId !== experimentId;
                this.experimentId = experimentId;
                this.experiment.setExperimentId(experimentId);
                if (change) {
                    this.updatePageContent();
                }
            });
    }

    ngOnDestroy(): void {
        this.backendUrlSubscription?.unsubscribe();
        this.routeSubscription?.unsubscribe();
    }

    onSort() {
        this.sort *= -1; // reverse the sorting order
        this.updatePageContent(this.currentPage?.page, this.currentPage?.itemCount);
    }

    onPageChange(pageEvent: PageEvent) {
        console.log(pageEvent.pageIndex, pageEvent.pageSize);
        this.updatePageContent(pageEvent.pageIndex, pageEvent.pageSize); // TODO test
    }

    updatePageContent(page: number = 0, itemCount: number = 10) {
        if (this.experimentId == null) {
            return;
        }
        this.loading = true;
        this.error = null;
        const currentRequest = { page: page, itemCount: itemCount };
        this.currentPage = currentRequest;
        this.timelineSteps = this.backend.getTimelineStepsPage(this.experimentId, {
            page,
            itemCount,
            sort: this.sort,
            pluginName: this.pluginName ?? "",
            version: this.version ?? "",
            stepStatus: this.stepStatus,
            unclearedSubstep: this.unclearedSubstep,
            resultQuality: this.resultQuality,
        }).pipe(
            map(value => {
                if (this.currentPage !== currentRequest) {
                    throw Error("Cancelled by other request.");
                }
                this.collectionSize = value.itemCount;
                this.loading = false;
                return value.items;
            }),
            catchError(err => {
                if (this.currentPage !== currentRequest) {
                    // ignore errors of past requests
                    return of([]);
                }
                this.error = err.toString();
                this.loading = false;
                throw err;
            })
        );
    }

    reloadPage() {
        if (this.currentPage == null) {
            this.updatePageContent();
        } else {
            const { page, itemCount } = this.currentPage;
            this.updatePageContent(page, itemCount);
        }
    }

    exportWorkflow() {
        if (!this.backendUrl || !this.experimentId) {
            console.error('Backend URL or experimentId is not set');
            return;
        }
        // TODO: export workflow
    }

    private getTemplateIdForExperiment(experimentId: string): Observable<number> {

        const url = `${this.backendUrl}/experiments/${experimentId}`;
        return this.http.get<any>(url).pipe(map(data => data.templateId));
    }

}
