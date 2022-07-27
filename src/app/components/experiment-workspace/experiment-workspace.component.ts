import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, Observable, of } from 'rxjs';
import { map, } from "rxjs/operators";
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { isInstanceOfPluginStatus, PluginsService, QhanaPlugin } from 'src/app/services/plugins.service';
import { TemplatesService, TemplateDescription, QhanaTemplate, TemplateCategory, pluginMatchesFilter } from 'src/app/services/templates.service';
import { QhanaBackendService, ApiObjectList, TimelineStepApiObject } from 'src/app/services/qhana-backend.service';
import { FormSubmitData } from '../plugin-uiframe/plugin-uiframe.component';
import TimeAgo from 'javascript-time-ago';
import { ThemeTaskListItem } from '@milkdown/core';

@Component({
    selector: 'qhana-experiment-workspace',
    templateUrl: './experiment-workspace.component.html',
    styleUrls: ['./experiment-workspace.component.sass']
})
export class ExperimentWorkspaceComponent implements OnInit, OnDestroy {

    private routeSubscription: Subscription | null = null;

    experimentId: string | null = null;

    searchValue: string = "";
    pluginList: Observable<QhanaPlugin[]> | null = null;
    templateList: Observable<TemplateDescription[]> | null = null;

    filteredPluginLists: { [category: string]: Observable<QhanaPlugin[]> } = {};

    parameterSubscription: Subscription | null = null;
    activeTemplate: QhanaTemplate | null = null;
    activeCategory: TemplateCategory | null = null;
    activePlugin: QhanaPlugin | null = null;

    frontendUrl: string | null = null;

    timeAgo: TimeAgo | null = null;
    stepsPerPage: number = 100;

    expandedPluginDescription: boolean = false;
    constructor(private route: ActivatedRoute, private experiment: CurrentExperimentService, private plugins: PluginsService, private templates: TemplatesService, private backend: QhanaBackendService, private router: Router) { }

    ngOnInit(): void {
        this.routeSubscription = this.route.params.subscribe(params => {
            this.experimentId = params?.experimentId ?? null;
            this.experiment.setExperimentId(params?.experimentId ?? null);
        });
        this.registerParameterSubscription();
        this.plugins.loadPlugins();
        this.pluginList = this.plugins.plugins;
        this.templates.loadTemplates();
        this.templateList = this.templates.templates;

        this.loadPluginStatus();
    }

    registerParameterSubscription() {
        this.parameterSubscription = this.route.params.subscribe(
            params => {
                if (params.templateId != null) {
                    this.templates.getTemplate(params.templateId).subscribe(
                        template => {
                            this.changeActiveTemplate(template);
                            if (params.categoryId != null && this.activeTemplate != null) {
                                this.activeCategory = this.activeTemplate.categories.find(
                                    category => category.identifier === params.categoryId
                                ) ?? null;
                            }
                        }
                    );
                }
                if (params.pluginId != null) {
                    this.plugins.getPlugin(params.pluginId).subscribe(
                        plugin => this.changeActivePlugin(plugin)
                    );
                }
            }
        );
    }

    loadPluginStatus(): void {
        this.timeAgo = new TimeAgo('en-US');

        const firstPage = this.loadStatusFromPage(0);

        firstPage?.subscribe(
            value => { 
                for (let i = 1; i < value.itemCount / this.stepsPerPage; i++) {
                    this.loadStatusFromPage(i);
                }
            }
        );
    }

    loadStatusFromPage(num: number): Observable<ApiObjectList<TimelineStepApiObject>> | null {
        if (this.experimentId == null) {
            return null;
        }
        const time = new Date();
        
        const timelinePage = this.backend.getTimelineStepsPage(this.experimentId, num, this.stepsPerPage)        
        timelinePage.pipe(
            map(value => value.items)
        ).subscribe(
            steps => steps.forEach(
                step => this.pluginList?.subscribe(
                    plugins => plugins.forEach(
                        plugin => {
                            this.updatePluginStatus(plugin, step, time);
                        }
                    )
                )
            )
        );
        
        return timelinePage;
    }
    
    updatePluginStatus(plugin: QhanaPlugin, step: TimelineStepApiObject, time: Date): void {
        if (plugin.metadata?.name == step.processorName) {
            if (isInstanceOfPluginStatus(step.status)) {
                plugin.pluginDescription.running = step.status;
            } else {
                plugin.pluginDescription.running = "UNKNOWN";
            }

            const endTime = new Date(step.end).getTime()
            plugin.pluginDescription.timeAgo = this.timeAgo?.format(endTime) ?? "";
            plugin.pluginDescription.olderThan24 = (time.getTime() - endTime) > 24 * 60 * 60 * 1000;
        }
    }

    ngOnDestroy(): void {
        this.routeSubscription?.unsubscribe();
        this.parameterSubscription?.unsubscribe();
    }

    changeActiveTemplate(templateDesc: TemplateDescription | null) {
        if (templateDesc == null) {
            return;
        }

        let categories: TemplateCategory[] = [];
        templateDesc.categories.forEach(categoryDesc => {
            let plugins: Observable<QhanaPlugin[]> = this.pluginList?.pipe(
                map(pluginList => pluginList.filter(
                    plugin => pluginMatchesFilter(plugin.pluginDescription, categoryDesc.pluginFilter)
                ).sort(this.plugins.comparePlugins))
            ) ?? of([]);

            categories.push({
                name: categoryDesc.name,
                description: categoryDesc.description,
                identifier: categoryDesc.identifier,
                plugins: plugins,
            });
        });

        this.activeTemplate = {
            name: templateDesc.name,
            description: templateDesc.description,
            categories: categories,
            templateDescription: templateDesc,
        };

        this.resetFilteredPluginLists();
    }

    private resetFilteredPluginLists() {
        this.activeTemplate?.categories.forEach(
            category => this.filteredPluginLists[category.name] = category.plugins
        );
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

    changeFilterPluginLists(): void {
        let searchValue: string = this.searchValue.toLowerCase();
        if (!this.searchValue || this.searchValue.trim() === "") {
            this.resetFilteredPluginLists();
            return;
        }

        this.activeTemplate?.categories.forEach(
            category => this.filteredPluginLists[category.name] = category.plugins.pipe(
                map(pluginList => pluginList.filter(
                    plugin => plugin.pluginDescription.name.toLowerCase().includes(searchValue) ||
                        plugin.pluginDescription.apiRoot.toLowerCase().includes(searchValue) ||
                        plugin.pluginDescription.version.toLowerCase().includes(searchValue) ||
                        plugin.pluginDescription.identifier.toLowerCase().includes(searchValue) ||
                        plugin.pluginDescription.description.toLocaleLowerCase().includes(searchValue) ||
                        plugin.pluginDescription.tags.some((tag: string) => tag.toLowerCase().includes(searchValue))

                ))
            )
        );
    }

    getNumberOfSuccessfulRuns(plugins: Observable<QhanaPlugin[]>): Observable<number> {
        return plugins.pipe(
            map(pluginList => pluginList.filter(
                plugin => plugin.pluginDescription.running === 'SUCCESS'
            ).length
            )
        );
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
}
