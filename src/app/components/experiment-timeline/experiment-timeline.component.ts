import { Component, OnDestroy, OnInit } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, of } from 'rxjs';
import { catchError, map, switchMap} from 'rxjs/operators';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { ExperimentResultQuality, ExperimentResultQualityValues, QhanaBackendService, TimelineStepApiObject } from 'src/app/services/qhana-backend.service';
import { ServiceRegistryService } from 'src/app/services/service-registry.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SettingsPageComponent } from '../settings-page/settings-page.component';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';

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
    workflowExists = false;
    activeTabId: string | null = null;
    
    constructor(
        private route: ActivatedRoute,
        private experiment: CurrentExperimentService,
        private backend: QhanaBackendService,
        private serviceRegistry: ServiceRegistryService,
        private http: HttpClient,
        private router: Router,
        private registry: PluginRegistryBaseService,
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
                    this.checkWorkflowGroup(experimentId);
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
             this.backend.getTimelineStepsPage(this.experimentId, {
            page: 0,
            itemCount: 100, // must be between 1 and 500
            sort: 1
        }).subscribe({
            next: (pageData) => {
                const steps = pageData.items || [];
                console.log(steps);
                const xml = this.buildBpmnXml(steps);

                const postUrl = `http://localhost:5005/plugins/workflow-editor@v0-1-0/workflows/`;
                // TODO: edit url, so it does not contain 'localhost' link

                const headers = new HttpHeaders({ 'Content-Type': 'application/bpmn+xml' });

                this.http.post(postUrl, xml, { headers }).pipe(
                    switchMap(() => this.getTemplateIdForExperiment(this.experimentId!)),
                    switchMap(templateId => this.getWorkflowTab(templateId))
                ).subscribe({
                    next: (tabId) => {
                        this.activeTabId = tabId;
                        console.log('Switching to workflow tab:', tabId);
                        const targetRoute = ['/experiments', this.experimentId, 'extra', tabId];
                        this.router.navigate(targetRoute, { relativeTo: this.route });
                    },
                    error: (err) => console.error('Failed to export workflow or switch tab', err)
                });
            },
            error: (err) => {
                console.error('Failed to load timeline steps', err);
            }
        });
    }

    private buildBpmnXml(steps: any[]) {
        // TODO: Implement method
    }

    private getTemplateIdForExperiment(experimentId: string): Observable<number> {
        const url = `${this.backendUrl}/experiments/${experimentId}`;
        return this.http.get<any>(url).pipe(map(data => data.templateId));
    }

    private getWorkflowTab(templateId: number): Observable<string> {
        const tabsUrl = `${this.registry.registryRootUrl}templates/${templateId}/tabs/?group=experiment-navigation`;
        return this.http.get<any>(tabsUrl).pipe(
            map(data => {
                const workflowTab = data.data.items.find((tab: any) => tab.name === 'Workflow');
                if (!workflowTab) throw new Error('Workflow tab not found');
                return workflowTab.resourceKey.uiTemplateTabId;
            })
        );
    }

    private checkWorkflowGroup(experimentId: string): void {
        this.getTemplateIdForExperiment(experimentId)
        .pipe(
            switchMap(templateId => this.http.get<any>(
                `${this.registry.registryRootUrl}templates/${templateId}/tabs/?group=experiment-navigation`
            )),
            map(data => {
                const workflowTab = data.data.items.find((tab: any) => tab.name === 'Workflow');
                return !!workflowTab;
            }),
            catchError(() => of(false))
        )
        .subscribe(exists => {
            this.workflowExists = exists;
        });
        this.router.config
    }

}
