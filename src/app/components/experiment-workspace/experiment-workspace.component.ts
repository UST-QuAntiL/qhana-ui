import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { from, Observable, of, Subscription } from 'rxjs';
import { map, switchMap } from "rxjs/operators";
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { PluginsService, QhanaPlugin } from 'src/app/services/plugins.service';
import { TemplatesService, QhanaTemplateInfo, QhanaTemplate } from 'src/app/services/templates.service';
import { QhanaBackendService } from 'src/app/services/qhana-backend.service';
import { FormSubmitData } from '../plugin-uiframe/plugin-uiframe.component';
import { first } from 'rxjs/operators';

@Component({
    selector: 'qhana-experiment-workspace',
    templateUrl: './experiment-workspace.component.html',
    styleUrls: ['./experiment-workspace.component.sass']
})
export class ExperimentWorkspaceComponent implements OnInit, OnDestroy {

    private routeSubscription: Subscription | null = null;

    experimentId: string | null = null;

    searchValue: string = "";
    templateList: Observable<QhanaTemplateInfo[]> | null = null;

    activeTemplate: QhanaTemplate | null = null;
    
    pluginList: Observable<QhanaPlugin[]> | null = null; // TODO: rework plugins list
    filteredPluginList: Observable<QhanaPlugin[]> | null = null;

    activePluginSubscription: Subscription | null = null;
    activePlugin: QhanaPlugin | null = null;
    frontendUrl: string | null = null;

    expandedPluginDescription: boolean = false;

    constructor(private route: ActivatedRoute, private experiment: CurrentExperimentService, private plugins: PluginsService, private templates: TemplatesService, private backend: QhanaBackendService, private router: Router) { }

    ngOnInit(): void {
        this.routeSubscription = this.route.params.subscribe(params => {
            this.experimentId = params?.experimentId ?? null;
            this.experiment.setExperimentId(params?.experimentId ?? null);
        });
        this.activePluginSubscription = this.route.params.pipe(
            map(params => params?.pluginId ?? null),
            switchMap(pluginId => {
                if (pluginId == null) {
                    return from([null]); // emits a single value null
                }
                return this.plugins.getPlugin(pluginId);
            }),
        ).subscribe(activePlugin => {
            this.changeActivePlugin(activePlugin);
        });
        this.plugins.loadPlugins();
        this.pluginList = this.plugins.plugins;
        this.filteredPluginList = this.pluginList;
        this.templates.loadTemplates();
        this.templateList = this.templates.templates;
    }

    ngOnDestroy(): void {
        this.routeSubscription?.unsubscribe();
        this.activePluginSubscription?.unsubscribe();
    }

    changeActiveTemplate(templateInfo: QhanaTemplateInfo) {
         const previousTemplate = this.activeTemplate;
        this.templates.loadTemplate(templateInfo).pipe(first()).subscribe(
            template => this.activeTemplate = template
        )
        if (previousTemplate === this.activeTemplate) {
            this.activeTemplate = null;
        }
    }

    onKeyDown(event: KeyboardEvent) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            this.expandedPluginDescription = !this.expandedPluginDescription;
        }
    }

    changeActivePlugin(plugin: QhanaPlugin | null) {
        if (plugin == null) {
            this.activePlugin = null;
            this.frontendUrl = null;
            this.expandedPluginDescription = false;
            return;
        }
        if (plugin == this.activePlugin) {
            return;
        }
        let frontendUrl: string | null = plugin?.metadata?.entryPoint?.uiHref;
        if (frontendUrl != null) {
            const base = new URL(plugin?.url ?? "");
            // const pluginOrigin = base.origin;
            if (frontendUrl.startsWith("/")) {
                frontendUrl = base.origin + frontendUrl;
            }
            if (frontendUrl.startsWith("./")) {
                frontendUrl = base.href + frontendUrl;
            }
        }
        this.activePlugin = plugin;
        this.frontendUrl = frontendUrl;
        this.expandedPluginDescription = false;
    }

    intersection(tags1: string[], tags2: string[]) : string[] {
        return tags1.filter(t => tags2.includes(t));
    }

    onPluginUiFormSubmit(formData: FormSubmitData) {
        const experimentId = this.experimentId;
        const plugin = this.activePlugin;
        const frontendUrl = ""; //this.frontendUrl?.toString();
        if (experimentId == null || plugin == null || frontendUrl == null) {
            return; // should never happen outside of race conditions
        }
        this.backend.createTimelineStep(experimentId, {
            inputData: formData.dataInputs,
            parameters: formData.formData,
            parametersContentType: formData.formDataType,
            processorLocation: plugin.url,
            processorName: plugin.pluginDescription.name,
            processorVersion: plugin.pluginDescription.version,
            resultLocation: formData.resultUrl,
        }).subscribe(timelineStep => this.router.navigate(['/experiments', experimentId, 'timeline', timelineStep.sequence.toString()]));

    }
    


    changeFilterPluginList(): void {
        let searchValue: string = this.searchValue.toLowerCase();
        if (this.pluginList == null || !this.searchValue || this.searchValue.trim() === "") {
            this.filteredPluginList = this.pluginList;
        } else {
            if (this.pluginList !== null && this.searchValue) {
                this.pluginList.pipe(
                    map(pluginList =>
                        pluginList.filter(plugin => {
                            // console.log(plugin.metadata);
                            return (plugin.pluginDescription.name.toLowerCase().includes(searchValue) ||
                                plugin.pluginDescription.apiRoot.toLowerCase().includes(searchValue) ||
                                plugin.pluginDescription.version.toLowerCase().includes(searchValue) ||
                                plugin.pluginDescription.identifier.toLowerCase().includes(searchValue) ||
                                (plugin.metadata.title && plugin.metadata.title.toLowerCase().includes(searchValue)) ||
                                (plugin.metadata.tags && plugin.metadata.tags.some((tag: string) => tag.toLowerCase().includes(searchValue))))
                        })
                    )
                ).subscribe(pluginList => this.filteredPluginList = of(pluginList));
            }
        }
    }

}
