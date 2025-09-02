import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import TimeAgo from 'javascript-time-ago';
import { Subscription } from 'rxjs';
import { ApiLink, CollectionApiObject } from 'src/app/services/api-data-types';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { PluginApiObject } from 'src/app/services/qhana-api-data-types';
import { ExperimentDataApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateTabApiObject, TemplatesService } from 'src/app/services/templates.service';
import { FormSubmitData } from '../plugin-uiframe/plugin-uiframe.component';

@Component({
    selector: 'qhana-experiment-workspace',
    templateUrl: './experiment-workspace.component.html',
    styleUrls: ['./experiment-workspace.component.sass']
})
export class ExperimentWorkspaceComponent implements OnInit, OnDestroy {

    private routeSubscription: Subscription | null = null;

    experimentId: string | null = null;

    detailAreaActive: boolean = false;
    templateTab: TemplateTabApiObject | null = null;
    templateTabLink: ApiLink | null = null;

    parameterSubscription: Subscription | null = null;
    activePlugin: PluginApiObject | null = null;

    previewData: ExperimentDataApiObject | null = null;

    frontendUrl: string | null = null;

    timeAgo: TimeAgo | null = null;
    stepsPerPage: number = 100;

    expandedPluginDescription: boolean = false;
    constructor(private route: ActivatedRoute, private experiment: CurrentExperimentService, private registry: PluginRegistryBaseService, private backend: QhanaBackendService, private router: Router, private templates: TemplatesService) { }

    ngOnInit(): void {
        this.routeSubscription = this.route.params.subscribe(params => {
            this.experimentId = params?.experimentId ?? null;
            this.experiment.setExperimentId(params?.experimentId ?? null);
        });
        this.registerParameterSubscription();
    }

    registerParameterSubscription() {
        this.parameterSubscription = this.route.queryParamMap.subscribe(params => {
            const pluginId = params.get('plugin');
            const templateTabId = params.get('tab');
            this.detailAreaActive = templateTabId != null;
            this.onPluginIdChange(pluginId);
        });
    }

    ngOnDestroy(): void {
        this.routeSubscription?.unsubscribe();
        this.parameterSubscription?.unsubscribe();
    }

    async onPluginIdChange(newPluginId: string | null) {
        if (newPluginId == null) {
            this.activePlugin = null;
            this.frontendUrl = null;
            this.previewData = null;
            return;
        }
        const pluginPage = await this.registry.getByRel<CollectionApiObject>([["plugin", "collection"]], new URLSearchParams({ "plugin-id": newPluginId }), true);
        if (pluginPage?.data?.items?.length !== 1) {
            console.warn(`Could not find plugin with id ${newPluginId}!`);
            return;
        }
        const pluginLink = pluginPage.data.items[0];
        const pluginResponse = await this.registry.getByApiLink<PluginApiObject>(pluginLink, null, false);
        if (pluginResponse == null) {
            return; // TODO error message
        }
        this.activePlugin = pluginResponse.data;
        this.frontendUrl = pluginResponse.data.entryPoint.uiHref;
        this.previewData = null;
    }

    onKeyDown(event: KeyboardEvent) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            this.expandedPluginDescription = !this.expandedPluginDescription;
        }
    }

    onPluginUiFormSubmit(formData: FormSubmitData) {
        const experimentId = this.experimentId;
        const plugin = this.activePlugin;
        if (experimentId == null || plugin == null) {
            return; // should never happen outside of race conditions
        }
        this.backend.createTimelineStep(experimentId, {
            inputData: formData.dataInputs,
            parameters: formData.formData,
            parametersContentType: formData.formDataType,
            processorLocation: plugin.href,
            processorName: plugin.identifier,
            processorVersion: plugin.version,
            resultLocation: formData.resultUrl,
        }).subscribe(timelineStep => this.router.navigate(['/experiments', experimentId, 'timeline', timelineStep.sequence.toString()], { queryParamsHandling: 'preserve' }));
    }
}
