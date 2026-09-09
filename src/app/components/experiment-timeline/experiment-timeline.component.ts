import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { ExperimentResultQuality, ExperimentResultQualityValues, QhanaBackendService, TimelineStepApiObject } from 'src/app/services/qhana-backend.service';
import { ServiceRegistryService } from 'src/app/services/service-registry.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateTabApiObject, TemplatesService } from 'src/app/services/templates.service';
import { CollectionApiObject, PageApiObject } from 'src/app/services/api-data-types';
import { PluginApiObject } from 'src/app/services/qhana-api-data-types';
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
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
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
    currentPage: { page: number, itemCount: number } | null = null;

    error: string | null = null;
    experimentName: string | undefined | null = null;

    timelineSteps: Observable<TimelineStepApiObject[]> | null = null;
    sort: -1 | 0 | 1 = 1;
    pluginName: string | null = null;
    version: string | null = null;
    stepStatus: "SUCCESS" | "PENDING" | "ERROR" | "CANCELED" | "" = "";
    statusValues: SelectValue[] = [
        { value: "", viewValue: "Not selected" },
        { value: "SUCCESS", viewValue: "Success" },
        { value: "PENDING", viewValue: "Pending" },
        { value: "ERROR", viewValue: "Error" },
        { value: "CANCELED", viewValue: "Canceled" }
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
    stepsExist = false;
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
    ) { }

    ngOnInit(): void {
        this.templateIdSubscription = this.template.currentTemplateId.subscribe(currentTemplateId => {
            this.currentTemplateId = currentTemplateId;

            if (this.experimentId != null) {
                void this.checkWorkflowGroup();
            }
        });

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
                    void this.checkWorkflowGroup();
                }
            });

        this.experimentNameSubscription = this.experiment.experimentName.subscribe(
            name => this.experimentName = name?.replace(/[^a-zA-Z0-9\-_]/g, '')
        );
    }

    ngOnDestroy(): void {
        this.backendUrlSubscription?.unsubscribe();
        this.routeSubscription?.unsubscribe();
        this.experimentNameSubscription?.unsubscribe();
        this.templateIdSubscription?.unsubscribe();
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
                this.stepsExist = value.items && value.items.length > 0;
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

    async exportWorkflow(): Promise<void> {
        const experimentId = this.experimentId;

        if (!this.backendUrl || !experimentId) {
            console.error('Backend URL or experimentId is not set');
            return;
        }

        try {
            const steps = await this.loadAllTimelineSteps(experimentId);
            await this.processTimelineSteps(steps);
        } catch (err) {
            console.error('Failed to export workflow', err);
        }
    }

    private async loadAllTimelineSteps(experimentId: string): Promise<TimelineStepApiObject[]> {
        const pageSize = 100;

        const firstPage = await this.backend.getTimelineStepsPage(experimentId, {
            page: 0,
            itemCount: pageSize,
            sort: 1,
        }).toPromise();

        const steps = [...firstPage.items];
        const pageCount = Math.ceil(firstPage.itemCount / pageSize);

        for (let page = 1; page < pageCount; page++) {
            const pageData = await this.backend.getTimelineStepsPage(experimentId, {
                page,
                itemCount: pageSize,
                sort: 1,
            }).toPromise();

            steps.push(...pageData.items);
        }

        return steps;
    }

    private async processTimelineSteps(steps: TimelineStepApiObject[]): Promise<void> {
        const dialogRef = this.dialog.open(ExportWorkflowModalComponent, {
            width: '700px',
            data: { steps },
        });

        const selectedSteps = await dialogRef.afterClosed()
            .pipe(take(1))
            .toPromise() as TimelineStepApiObject[] | null | undefined;

        if (!selectedSteps || selectedSteps.length === 0) {
            return;
        }

        const templateId = this.currentTemplateId;

        if (!templateId) {
            throw new Error('Current template ID is not set');
        }

        const enrichedSteps = await this.fetchEnrichedSteps(selectedSteps);

        const xml = new BpmnXmlBuilder(
            this.experimentName ?? 'Experiment',
            enrichedSteps
        ).toString();

        const tabId = await this.getWorkflowTab(templateId);
        const workflowEditorHref = await this.getWorkflowEditorHref(tabId);
        const postUrl = `${workflowEditorHref.replace(/\/?$/, '/')}workflows/`;

        const headers = new HttpHeaders({
            'Content-Type': 'application/bpmn+xml',
        });

        await this.http.post(postUrl, xml, { headers }).toPromise();

        this.navigateToTabId(tabId);
    }

    private async fetchEnrichedSteps(selectedSteps: TimelineStepApiObject[]): Promise<EnrichedStep[]> {
        const enriched = await Promise.all(selectedSteps.map(async (step): Promise<EnrichedStep> => {
            const selfUrl = (step as any)['@self'] as string;
            const parametersUrl = step.parameters;
            const pluginUrl = step.processorLocation;

            const [stepDetail, paramsText, pluginInfo] = await Promise.all([
                fetch(selfUrl).then(response => response.json()),
                fetch(parametersUrl).then(response => response.text()),
                fetch(pluginUrl).then(response => response.json()),
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
        const targetRoute = [
            '/experiments',
            this.experimentId,
            'extra',
            tabId,
        ];

        const currentQueryParams = this.route.snapshot.queryParams;

        const queryParams = Object.fromEntries(
            Object.entries(currentQueryParams)
                .filter(([key]) => key.startsWith('param-'))
        );

        this.router.navigate(targetRoute, {
            relativeTo: this.route,
            queryParams,
        });
    }

    private async getWorkflowTab(templateId: string): Promise<string> {
        const groups = await this.template.getTemplateTabGroups(templateId, true);

        const experimentNavigationGroup = groups.find(
            group => group.resourceKey?.['?group'] === 'experiment-navigation'
        );

        if (!experimentNavigationGroup) {
            throw new Error('Experiment navigation group not found in current template');
        }

        const tabsResponse = await this.registry.getByApiLink<CollectionApiObject>(
            experimentNavigationGroup,
            null,
            true
        );

        const tabLinks = tabsResponse?.data?.items ?? [];

        const tabResponses = await Promise.all(
            tabLinks.map(tabLink =>
                this.registry.getByApiLink<TemplateTabApiObject>(
                    tabLink,
                    null,
                    false
                )
            )
        );

        const workflowTab = tabResponses
            .map(response => response?.data)
            .find(tab => tab?.name === 'Workflow');

        const tabId = workflowTab?.self?.resourceKey?.uiTemplateTabId;

        if (!tabId) {
            throw new Error('Workflow tab not found');
        }

        return tabId;
    }

    private async checkWorkflowGroup(): Promise<void> {
        const templateId = this.currentTemplateId;

        if (!templateId) {
            this.workflowExists = false;
            return;
        }

        try {
            await this.getWorkflowTab(templateId);

            if (this.currentTemplateId === templateId) {
                this.workflowExists = true;
            }
        } catch {
            if (this.currentTemplateId === templateId) {
                this.workflowExists = false;
            }
        }
    }

    private async getWorkflowEditorHref(tabId: string): Promise<string> {
        const query = new URLSearchParams();
        query.set('template-tab', tabId);

        const pluginsResponse = await this.registry.getByRel<PageApiObject>(
            [['plugin', 'collection']],
            query
        );

        const pluginLinks = pluginsResponse?.data?.items ?? [];

        const pluginResponses = await Promise.all(
            pluginLinks.map(pluginLink =>
                this.registry.getByApiLink<PluginApiObject>(
                    pluginLink,
                    null,
                    false
                )
            )
        );

        const workflowEditor = pluginResponses
            .map(response => response?.data)
            .find(plugin => plugin?.identifier === 'workflow-editor');

        if (!workflowEditor?.href) {
            throw new Error('Workflow Editor plugin not found in current template tab');
        }

        return workflowEditor.href;
    }
}