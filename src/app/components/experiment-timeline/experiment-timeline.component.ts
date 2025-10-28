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
import { SettingsPageComponent } from '../settings-page/settings-page.component';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplatesService } from 'src/app/services/templates.service';

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
    currentPage: { page: number; itemCount: number } | null = null;

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
    currentTemplateId: string | null = null;

    constructor(
        private route: ActivatedRoute,
        private experiment: CurrentExperimentService,
        private backend: QhanaBackendService,
        private serviceRegistry: ServiceRegistryService,
        private http: HttpClient,
        private router: Router,
        private registry: PluginRegistryBaseService,
        private template: TemplatesService
    ) //private settings: SettingsPageComponent
    {}

    ngOnInit(): void {
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
                (name) =>
                    (this.experimentName = name?.replace(
                        /[^a-zA-Z0-9\-_]/g,
                        ''
                    ))
            );
        this.templateIdSubscription = this.template.currentTemplateId.subscribe((currentTempalteId) => this.currentTemplateId = currentTempalteId);
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
                next: (pageData) => { this.processTimelineSteps(pageData) },
                error: (err) => {
                    console.error('Failed to load timeline steps', err);
                },
            });
    }

    private processTimelineSteps(pageData: any): void {
        // save all items or an empty array in steps
    const steps = pageData.items || [];
    console.log(steps);
    const xml = this.buildBpmnXml(steps);

    const postUrl = `http://localhost:5005/plugins/workflow-editor@v0-1-0/workflows/`;
    // TODO: edit url, so it does not contain 'localhost' link

    const headers = new HttpHeaders({
        'Content-Type': 'application/bpmn+xml',
    });

    this.http
        .post(postUrl, xml, { headers })
        .pipe(
            // First switchMap: wait for POST response, then get template ID
            switchMap(() =>
                this.getTemplateIdForExperiment(
                    this.experimentId!
                )
            ),
            // Second switchMap: wait for template ID, then get workflow tab
            switchMap((templateId) =>
                this.getWorkflowTab(templateId)
            )
        )
        .subscribe({
            next: (tabId) => {
                console.log(
                    'Switching to workflow tab:',
                    tabId
                );
                const targetRoute = [
                    '/experiments',
                    this.experimentId,
                    'extra',
                    tabId,
                ];
                // Navigate to Workflow tab
                this.router.navigate(targetRoute, {
                    relativeTo: this.route,
                });
            },
            error: (err) =>
                console.error(
                    'Failed to export workflow or switch tab',
                    err
                ),
        });
    }

    private buildBpmnXml(steps: any[]): string {
        const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>`;

        const defsOpen = `<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
        xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
        xmlns:qhana="https://github.com/qhana"
        xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
        id="sample-diagram"
        targetNamespace="http://bpmn.io/schema/bpmn"
        xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL BPMN20.xsd">`;

        const processOpen = `<bpmn2:process id="Experiment_${this.experimentName}" isExecutable="true">`;

        const startX = 200;
        const startY = 200;
        const stepWidth = 120;
        const stepHeight = 80;
        const gap = 120;

        let processXml = `
        <bpmn2:startEvent id="StartEvent_1">
            <bpmn2:outgoing>Flow_0</bpmn2:outgoing>
        </bpmn2:startEvent>`;

        let flowsXml = ``;

        if (steps.length === 0) {
            flowsXml += `<bpmn2:sequenceFlow id="Flow_0" sourceRef="StartEvent_1" targetRef="EndEvent_1"/>`;
        } else {
            flowsXml += `<bpmn2:sequenceFlow id="Flow_0" sourceRef="StartEvent_1" targetRef="Activity_0"/>`;

            steps.forEach((step, i) => {
                const id = `Activity_${i}`;
                const incoming = `Flow_${i}`;
                const outgoing =
                    i < steps.length - 1 ? `Flow_${i + 1}` : `Flow_end`;

                const name = step.processorName ?? `Step ${i + 1}`;
                const qhanaIdentifier = step.processorName ?? `unknown`;
                const qhanaVersion = step.processorVersion ?? 'v0.0.0';
                const qhanaDescription = step.notes
                    ? step.notes
                    : `Run plugin ${qhanaIdentifier}`;
                const selectedConfigurationId = qhanaIdentifier;

                processXml += `
                <qhana:qHAnaServiceTask
                    id="${id}"
                    name="${name}"
                    qhanaIdentifier="${qhanaIdentifier}"
                    qhanaVersion="${qhanaVersion}"
                    qhanaName="${name}"
                    qhanaDescription="${qhanaDescription}"
                    selectedConfigurationId="${selectedConfigurationId}">
                    <bpmn2:incoming>${incoming}</bpmn2:incoming>
                    <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
                </qhana:qHAnaServiceTask>`;

                if (i < steps.length - 1) {
                    flowsXml += `
                    <bpmn2:sequenceFlow id="Flow_${
                        i + 1
                    }" sourceRef="${id}" targetRef="Activity_${i + 1}"/>`;
                } else {
                    flowsXml += `
                    <bpmn2:sequenceFlow id="Flow_end" sourceRef="${id}" targetRef="EndEvent_1"/>`;
                }
            });
        }

        processXml += `
        <bpmn2:endEvent id="EndEvent_1">
            <bpmn2:incoming>${
                steps.length === 0 ? 'Flow_0' : 'Flow_end'
            }</bpmn2:incoming>
        </bpmn2:endEvent>`;

        const processClose = `</bpmn2:process>`;

        let shapesXml = `
        <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
            <dc:Bounds x="${startX}" y="${
            startY + 22
        }" width="36" height="36" />
        </bpmndi:BPMNShape>`;

        let edgesXml = ``;

        if (steps.length === 0) {
            const endX = startX + 200;
            shapesXml += `
            <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
                <dc:Bounds x="${endX}" y="${
                startY + 22
            }" width="36" height="36" />
            </bpmndi:BPMNShape>`;
            edgesXml += `
            <bpmndi:BPMNEdge id="Flow_0_di" bpmnElement="Flow_0">
                <di:waypoint x="${startX + 36}" y="${startY + 40}" />
                <di:waypoint x="${endX}" y="${startY + 40}" />
            </bpmndi:BPMNEdge>`;
        } else {
            steps.forEach((_, i) => {
                const x = startX + 100 + i * (stepWidth + gap);
                shapesXml += `
                <bpmndi:BPMNShape id="Activity_${i}_di" bpmnElement="Activity_${i}">
                    <dc:Bounds x="${x}" y="${startY}" width="${stepWidth}" height="${stepHeight}" />
                </bpmndi:BPMNShape>`;
            });

            const endX = startX + 100 + steps.length * (stepWidth + gap);
            shapesXml += `
            <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
                <dc:Bounds x="${endX}" y="${
                startY + 22
            }" width="36" height="36" />
            </bpmndi:BPMNShape>`;

            edgesXml += `
            <bpmndi:BPMNEdge id="Flow_0_di" bpmnElement="Flow_0">
                <di:waypoint x="${startX + 36}" y="${startY + 40}" />
                <di:waypoint x="${startX + 100}" y="${startY + 40}" />
            </bpmndi:BPMNEdge>`;

            steps.forEach((_, i) => {
                const fromX = startX + 100 + i * (stepWidth + gap) + stepWidth;
                const toX = fromX + gap;
                if (i < steps.length - 1) {
                    edgesXml += `
                    <bpmndi:BPMNEdge id="Flow_${i + 1}_di" bpmnElement="Flow_${
                        i + 1
                    }">
                        <di:waypoint x="${fromX}" y="${startY + 40}" />
                        <di:waypoint x="${toX}" y="${startY + 40}" />
                    </bpmndi:BPMNEdge>`;
                } else {
                    edgesXml += `
                    <bpmndi:BPMNEdge id="Flow_end_di" bpmnElement="Flow_end">
                        <di:waypoint x="${fromX}" y="${startY + 40}" />
                        <di:waypoint x="${endX}" y="${startY + 40}" />
                    </bpmndi:BPMNEdge>`;
                }
            });
        }

        const diagramXml = `
        <bpmndi:BPMNDiagram id="BPMNDiagram_1">
            <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
                ${shapesXml}
                ${edgesXml}
            </bpmndi:BPMNPlane>
        </bpmndi:BPMNDiagram>`;

        const defsClose = `</bpmn2:definitions>`;

        return [
            xmlHeader,
            defsOpen,
            processOpen,
            processXml,
            flowsXml,
            processClose,
            diagramXml,
            defsClose,
        ].join('\n');
    }

    private getTemplateIdForExperiment(
        experimentId: string
    ): Observable<number> {
        const url = `${this.backendUrl}/experiments/${experimentId}`;
        return this.http.get<any>(url).pipe(map((data) => data.templateId));
    }

    private getWorkflowTab(templateId: number): Observable<string> {
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
        this.getTemplateIdForExperiment(experimentId)
            .pipe(
                // Use the TemplateId to get the navigation elements that are available 
                // for the experiment.
                switchMap((templateId) =>
                    this.http.get<any>(
                        `${this.registry.registryRootUrl}templates/${templateId}/tabs/?group=experiment-navigation`
                    )
                ),
                // Check if there is a Workflow tab in the navigation elements
                map((data) => {
                    const workflowTab = data.data.items.find(
                        (tab: any) => tab.name === 'Workflow'
                    );
                    return !!workflowTab;
                }),
                catchError(() => of(false))
            )
            // If there is an workflow tab set workflowExists to true else false
            .subscribe((exists) => {
                this.workflowExists = exists;
            });
    }
}
