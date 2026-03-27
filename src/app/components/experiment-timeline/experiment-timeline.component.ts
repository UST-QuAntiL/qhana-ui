import { Component, OnDestroy, OnInit } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import {
    ExperimentResultQuality,
    ExperimentResultQualityValues,
    QhanaBackendService,
    TimelineStepApiObject,
} from 'src/app/services/qhana-backend.service';
import { ServiceRegistryService } from 'src/app/services/service-registry.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplatesService } from 'src/app/services/templates.service';
import { MatDialog } from '@angular/material/dialog';
import { ExportWorkflowModalComponent } from '../export-workflow-modal/export-workflow-modal.component';
import { BpmnXmlBuilder, EnrichedStep } from './bpmn-xml-builder';

interface SelectValue {
    value: number | string;
    viewValue: string;
}

@Component({
    selector: 'qhana-experiment-timeline',
    templateUrl: './experiment-timeline.component.html',
    styleUrls: ['./experiment-timeline.component.sass'],
})
export class ExperimentTimelineComponent implements OnInit, OnDestroy {
    private routeSubscription: Subscription | null = null;
    private backendUrlSubscription: Subscription | null = null;
    private experimentNameSubscription: Subscription | null = null;
    private templateIdSubscription: Subscription | null = null;

    backendUrl: string | null = null;

    experimentId: string | null = null;

    collectionSize: number = 0;

    loading: boolean = true;
    currentPage: { page: number; itemCount: number; } | null = null;

    error: string | null = null;
    experimentName: string | undefined | null = null;

    timelineSteps: Observable<TimelineStepApiObject[]> | null = null;
    sort: -1 | 0 | 1 = 1;
    pluginName: string | null = null;
    version: string | null = null;
    stepStatus: 'SUCCESS' | 'PENDING' | 'ERROR' | '' = '';
    statusValues: SelectValue[] = [
        { value: '', viewValue: 'Not selected' },
        { value: 'SUCCESS', viewValue: 'Success' },
        { value: 'PENDING', viewValue: 'Pending' },
        { value: 'ERROR', viewValue: 'Error' },
    ];
    unclearedSubstep: number = 0;
    unclearedSubstepValues: SelectValue[] = [
        { value: 0, viewValue: 'Not selected' },
        { value: 1, viewValue: 'Only steps with uncleared substeps' },
        { value: -1, viewValue: 'Only steps with cleared substeps' },
    ];
    resultQuality: ExperimentResultQuality | '' = '';
    resultQualityValues = ExperimentResultQualityValues;
    workflowExists = false;
    stepsExist = true;
    currentTemplateId: string | null = null;

    constructor(
        private route: ActivatedRoute,
        private experiment: CurrentExperimentService,
        private backend: QhanaBackendService,
        private serviceRegistry: ServiceRegistryService,
        private http: HttpClient,
        private router: Router,
        private registry: PluginRegistryBaseService,
        private template: TemplatesService,
        private dialog: MatDialog
    ) {}

    ngOnInit(): void {
        this.templateIdSubscription = this.template.currentTemplateId.subscribe((currentTempalteId) => this.currentTemplateId = currentTempalteId);
        this.backendUrlSubscription = this.serviceRegistry.backendRootUrl.subscribe((url) => (this.backendUrl = url));
        this.routeSubscription = this.route.params
            .pipe(map((params) => params.experimentId))
            .subscribe((experimentId) => {
                const change = this.experimentId !== experimentId;
                this.experimentId = experimentId;
                this.experiment.setExperimentId(experimentId);
                if (change) {
                    this.updatePageContent();
                    // call method to conditionally set workflowExists
                    this.checkWorkflowGroup(experimentId);
                }
            });
        // Subscribe to experiment name changes, keep only alphanumeric characters, hyphens, and underscores
        this.experimentNameSubscription = this.experiment.experimentName.subscribe(
            (name) => (this.experimentName = name?.replace(/[^a-zA-Z0-9\-_]/g, '')));
    }

    ngOnDestroy(): void {
        this.backendUrlSubscription?.unsubscribe();
        this.routeSubscription?.unsubscribe();
        this.experimentNameSubscription?.unsubscribe();
        this.templateIdSubscription?.unsubscribe();
    }

    onSort() {
        this.sort *= -1; // reverse the sorting order
        this.updatePageContent(
            this.currentPage?.page,
            this.currentPage?.itemCount
        );
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
        this.timelineSteps = this.backend
            .getTimelineStepsPage(this.experimentId, {
                page,
                itemCount,
                sort: this.sort,
                pluginName: this.pluginName ?? '',
                version: this.version ?? '',
                stepStatus: this.stepStatus,
                unclearedSubstep: this.unclearedSubstep,
                resultQuality: this.resultQuality,
            })
            .pipe(
                map((value) => {
                    if (this.currentPage !== currentRequest) {
                        throw Error('Cancelled by other request.');
                    }
                    this.collectionSize = value.itemCount;
                    // updates stepsExist if there is at least one timeline step
                    this.stepsExist = (value.items && value.items.length > 0);
                    this.loading = false;
                    return value.items;
                }),
                catchError((err) => {
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
        this.backend
            .getTimelineStepsPage(this.experimentId, {
                page: 0,
                itemCount: 100,
                sort: 1,
            })
            .subscribe({
                // if the observable retruns something, next will be executed with the value the observable returned
                next: (pageData) => this.processTimelineSteps(pageData),
                error: (err) => console.error('Failed to load timeline steps', err),
            });
    }

    private processTimelineSteps(pageData: any): void {
        // save all items or an empty array in steps
        const steps = pageData.items || [];
        const dialogRef = this.dialog.open(ExportWorkflowModalComponent, {
            width: '700px',
            data: { steps },
        });

        dialogRef.afterClosed().subscribe(async (selectedSteps: TimelineStepApiObject[] | null) => {
            if (!selectedSteps || selectedSteps.length === 0) {
                console.log('No steps selected for export');
                return;
            }

            try {
                const enrichedSteps = await this.fetchEnrichedSteps(selectedSteps);
                const xml = new BpmnXmlBuilder(this.experimentName, enrichedSteps).toString();

                this.getWorkflowEditorHref(this.currentTemplateId!).subscribe(href => {
                    const postUrl = `${href}workflows/`;
                    const headers = new HttpHeaders({'Content-Type': 'application/bpmn+xml'});

                    this.http.post(postUrl, xml, { headers })
                        .pipe(switchMap(() => this.getWorkflowTab(this.currentTemplateId!)))
                        .subscribe({
                            next: tabId => this.navigateToTabId(tabId),
                            error: err => console.error('Failed to export workflow', err),
                        });
                });
            } catch (err) {
                console.error('Failed to enrich timeline steps', err);
            }
        });
    }

    private async fetchEnrichedSteps(selectedSteps: TimelineStepApiObject[]): Promise<EnrichedStep[]> {
        const enriched = await Promise.all(selectedSteps.map(async (step): Promise<EnrichedStep> => {
            const selfUrl = (step as any)['@self'] as string;
            const parametersUrl = step.parameters;
            const pluginUrl = step.processorLocation;

            const [stepDetail, paramsText, pluginInfo] = await Promise.all([
                fetch(selfUrl).then(r => r.json()),
                fetch(parametersUrl).then(r => r.text()),
                fetch(pluginUrl).then(r => r.json()),
            ]);

            const params: Record<string, string> = {};
            new URLSearchParams(paramsText).forEach((value, key) => {
                params[key] = value;
            });

            return {
                processorName: step.processorName,
                processorVersion: step.processorVersion,
                notes: step.notes,
                inputData: stepDetail.inputData ?? [],
                outputData: stepDetail.outputData ?? [],
                parameters: params,
                pluginDataInput: pluginInfo.entryPoint?.dataInput ?? [],
                pluginDataOutput: pluginInfo.entryPoint?.dataOutput ?? [],
            };
        }));

        return enriched;
    }

    private navigateToTabId(tabId: string): void {
        console.log(`Switching to workflow tab: ${tabId}`);

        const targetRoute = [
            '/experiments',
            this.experimentId,
            'extra',
            tabId,
        ];

        // Forward all param-* query parameters to the workflow micro frontend
        // without interpreting them
        const currentQueryParams = this.route.snapshot.queryParams;

        const queryParams = Object.fromEntries(
            Object.entries(currentQueryParams)
                .filter(([key]) => key.startsWith('param-'))
                .map(([key, value]) => [key.replace(/^param-/, ''), value])
        );

        // Navigate to Workflow tab
        this.router.navigate(targetRoute, {
            relativeTo: this.route,
            queryParams,
        });
    }

    private getWorkflowTab(templateId: string): Observable<string> {
        const tabsUrl = `${this.registry.registryRootUrl}templates/${templateId}/tabs/?group=experiment-navigation`;
        return this.http.get<any>(tabsUrl).pipe(
            map((data) => {
                const workflowTab = data.data.items.find(
                    (tab: any) => tab.name === 'Workflow'
                );
                if (!workflowTab) throw new Error('Workflow tab not found');
                return workflowTab.resourceKey.uiTemplateTabId;
            })
        );
    }

    /**
     * Checks if a workflow tab exists for the given experiment
     * and updates the workflowExists property accordingly
     */
    private checkWorkflowGroup(experimentId: string): void {
        const url = `${this.registry.registryRootUrl}templates/${this.currentTemplateId}/tabs/?group=experiment-navigation`;
        this.http.get<any>(url)
            .pipe(
                map((data) => {
                    const workflowTab = data.data.items.find(
                        (tab: any) => tab.name === 'Workflow');
                    return !!workflowTab;
                }), catchError(() => of(false)))
            // If there is an workflow tab set workflowExists to true else false
            .subscribe((exists) => this.workflowExists = exists);
    }

    /**
     * Retrieves the URL of the Workflow Editor plugin from the plugin registry.
     *
     * The method performs a service discovery by querying the central plugin registry,
     * filtering the available plugins by their technical identifier (e.g. "workflow-editor"),
     * and returning the corresponding URL.
     *
     * @returns Observable<string> containing the Workflow Editor URL
     */
    private getWorkflowEditorHref(templateId: string): Observable<string> {
        return this.getWorkflowTab(templateId).pipe(
            switchMap((tabId) => {
                const url = `${this.registry.registryRootUrl}plugins/?template-tab=${tabId}`;

                return this.http.get<any>(url).pipe(
                    map(response => {
                        const plugin = response.embedded
                            ?.map((e: any) => e.data)
                            ?.find((p: any) => p.identifier === 'workflow-editor');

                        return plugin.href;
                    })
                );
            })
        );
    }

}
