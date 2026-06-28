import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiLink, PageApiObject } from 'src/app/services/api-data-types';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { PluginApiObject } from 'src/app/services/qhana-api-data-types';
import { ExperimentDataApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TempTabService } from 'src/app/services/temp-tab.service';
import { FormSubmitData } from '../plugin-uiframe/plugin-uiframe.component';

@Component({
    selector: 'qhana-temp-tab',
    templateUrl: './temp-tab.component.html',
    styleUrl: './temp-tab.component.sass',
    standalone: false
})
export class TempTabComponent implements OnInit, OnDestroy {

    private routeParamsSubscription: Subscription | null = null;
    private queryParamsSubscription: Subscription | null = null;

    private templateParam: string | undefined;

    extraParams: Map<string, string> | null = null;

    currentPluginId: string | null = null;
    currentExperimentId: string | null = null;

    activePluginLink: ApiLink | null = null;
    activePluginFrontendUrl: string | null = null;

    previewData: ExperimentDataApiObject | null = null;

    constructor(private tempTab: TempTabService, private route: ActivatedRoute, private router: Router, private registry: PluginRegistryBaseService, private backend: QhanaBackendService, private experiment: CurrentExperimentService) { }


    ngOnInit(): void {
        this.routeParamsSubscription = this.route.params.subscribe(params => {
            this.currentExperimentId = params?.experimentId ?? null;
            this.experiment.setExperimentId(params?.experimentId ?? null);
            this.currentPluginId = params?.pluginId ?? null;
            this.onParamsChanged();
        });
        this.queryParamsSubscription = this.route.queryParamMap.subscribe(params => {
            this.templateParam = params.get("template") ?? undefined;
            const extraParams = new Map<string, string>();
            params.keys.forEach(key => {
                if (key.startsWith("param-")) {
                    const value = params.get(key);
                    if (value) {
                        extraParams.set(key.substring(6), value);
                    }
                }
            })
            if (extraParams.size > 0) {
                this.extraParams = extraParams;
            } else {
                this.extraParams = null;
            }
        });
    }

    ngOnDestroy(): void {
        this.routeParamsSubscription?.unsubscribe();
        this.queryParamsSubscription?.unsubscribe();
        this.tempTab.setTempTabPluginLink(null);
    }

    private async onParamsChanged() {
        const pluginId = this.currentPluginId;
        if (pluginId == null) {
            this.activePluginFrontendUrl = null;
            this.activePluginLink = null;
            this.tempTab.setTempTabPluginLink(null);
            return;
        }

        let pluginLink: ApiLink | null = null;

        const query = new URLSearchParams({ "plugin-id": pluginId });
        const page = await this.registry.getByRel<PageApiObject>([["plugin", "collection"]], query, true);
        if (page?.data?.items?.[0]?.resourceKey?.pluginId === pluginId) {
            pluginLink = page.data.items[0];
        }

        if (pluginLink == null) {
            this.activePluginFrontendUrl = null;
            this.activePluginLink = null;
            this.tempTab.setTempTabPluginLink(null);
            return;
        }

        const pluginResponse = await this.registry.getByApiLink<PluginApiObject>(pluginLink);
        const nextUrl = pluginResponse?.data?.entryPoint?.uiHref ?? null;

        if (nextUrl == null) {
            this.activePluginFrontendUrl = null;
            this.activePluginLink = null;
            this.tempTab.setTempTabPluginLink(null);
            return;
        }

        const parsed = new URL(nextUrl, pluginResponse?.data?.self?.href);
        const extraParams = this.extraParams;
        if (extraParams != null) {
            extraParams.forEach((value, param) => {
                parsed.searchParams.set(param, value);
            });
        }
        this.activePluginFrontendUrl = parsed.toString();
        this.activePluginLink = pluginLink;
        this.tempTab.setTempTabPluginLink(pluginLink);
    }

    async onPluginUiFormSubmit(formData: FormSubmitData) {
        const experimentId = this.currentExperimentId;
        if (experimentId == null) {
            return;  // only allow submit in experiment navigation tabs
        }
        const pluginLink = this.activePluginLink;
        if (pluginLink == null) {
            return;
        }
        const plugin = (await this.registry.getByApiLink<PluginApiObject>(pluginLink, null, false))?.data ?? null;
        if (plugin == null) {
            return; //plugin was removed from registry
        }
        this.backend.createTimelineStep(experimentId, {
            inputData: formData.dataInputs,
            parameters: formData.formData,
            parametersContentType: formData.formDataType,
            processorLocation: plugin.href,
            processorName: plugin.identifier,
            processorVersion: plugin.version,
            resultLocation: formData.resultUrl,
        }).subscribe(timelineStep => this.router.navigate(
            ['/experiments', experimentId, 'timeline', timelineStep.sequence.toString()],
            { queryParams: (this.templateParam != null) ? { "template": this.templateParam } : {} }
        ));
    }

}
