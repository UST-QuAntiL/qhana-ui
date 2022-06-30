import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { from, Subscription, merge, Observable } from 'rxjs';
import { map, switchMap, catchError } from "rxjs/operators";
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { isInstanceOfPluginStatus, PluginsService, QhanaPlugin } from 'src/app/services/plugins.service';
import { TemplatesService, TemplateDescription, QhanaTemplate, TemplateCategory, pluginFilterMatchesTags } from 'src/app/services/templates.service';
import { QhanaBackendService  } from 'src/app/services/qhana-backend.service';
import { FormSubmitData } from '../plugin-uiframe/plugin-uiframe.component';
import { MatOptionSelectionChange } from '@angular/material/core';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';

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

    filteredPluginLists: { [category: string]: QhanaPlugin[] } = {};

    parameterSubscription: Subscription | null = null;
    activeTemplate: QhanaTemplate | null = null;
    activeCategory: TemplateCategory | null = null;
    activePlugin: QhanaPlugin | null = null;

    frontendUrl: string | null = null;
    
    timeAgo: TimeAgo | null = null;

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

        this.registerPluginStatusUpdater();
    }
    
    registerParameterSubscription() {
        this.parameterSubscription = this.route.params.subscribe(
            params => {
                if (params.templateId != null) {
                    this.templates.getTemplate(params.templateId).subscribe(
                        template => this.changeActiveTemplate(template)
                    );
                }
                if (params.pluginId != null) {
                    this.plugins.getPlugin(params.pluginId).subscribe(
                        plugin => this.changeActivePlugin(plugin)
                    );
                }
            }
        ); // TODO: add category
    }
    
    registerPluginStatusUpdater(): void {
        let itemCountTimeline: number = 0;
        const experimentId = this.experimentId;
        const itemsPerPage: number = 100;
        const time = new Date();

        TimeAgo.addDefaultLocale(en);
        this.timeAgo = new TimeAgo('en-US');

        if (experimentId !== null) {
            const timeLineList = this.backend.getTimelineStepsPage(experimentId, 0, itemsPerPage);

            if (timeLineList !== null) {
                let timeLine = timeLineList.pipe(
                    map(value => value.items),
                    catchError(err => {
                        throw err;
                    })
                );

                timeLineList.subscribe(value => itemCountTimeline = value.itemCount);

                (async () => {
                    await delay(500);

                    for (let i = 1; i<itemCountTimeline/itemsPerPage; i++) {
                        let timeLinePage = this.backend.getTimelineStepsPage(experimentId, i, itemsPerPage).pipe(
                            map(value => value.items),
                            catchError(err => {
                                throw err;
                            })
                        );
                        timeLine = merge(timeLine, timeLinePage);
                    }

                    if (timeLine !== null) {
                        this.pluginList?.subscribe(
                            plugins => plugins.forEach(
                                plugin => timeLine.forEach(
                                    value => value.forEach(
                                        step => {
                                            if (plugin.metadata?.name == step.processorName) {
                                                if (isInstanceOfPluginStatus(step.status)) {
                                                    plugin.pluginDescription.running = step.status;
                                                } else {
                                                    plugin.pluginDescription.running = "UNKNOWN";
                                                }
                                                
                                                const endTime = new Date(step.end).getTime()
                                                plugin.pluginDescription.timeAgo = this.timeAgo?.format(endTime) ?? "";
                                                plugin.pluginDescription.olderThan24 = (time.getTime() - endTime) > 24*60*60*1000;
                                            }
                                        }
                                    )
                                )
                            )
                        )
                    }
                })();
            }
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
            let plugins: QhanaPlugin[] = [];
            this.pluginList?.subscribe(
                pluginList => pluginList.forEach(plugin => {
                    if (pluginFilterMatchesTags(plugin.pluginDescription.tags, categoryDesc.pluginFilter)) {
                        plugins.push(plugin);
                    }
                })
            );
            
            categories.push({
                name: categoryDesc.name,
                description: categoryDesc.description,
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
        
        this.activeTemplate?.categories.forEach(
            category => category.plugins.sort(
                (a, b) => a.pluginDescription.identifier.localeCompare(b.pluginDescription.identifier)
            )
        );
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
            category => this.filteredPluginLists[category.name] = category.plugins.filter(
                plugin => plugin.pluginDescription.name.toLowerCase().includes(searchValue) ||
                        plugin.pluginDescription.apiRoot.toLowerCase().includes(searchValue) ||
                        plugin.pluginDescription.version.toLowerCase().includes(searchValue) ||
                        plugin.pluginDescription.identifier.toLowerCase().includes(searchValue) ||
                        plugin.pluginDescription.description.toLocaleLowerCase().includes(searchValue) ||
                        plugin.pluginDescription.tags.some((tag: string) => tag.toLowerCase().includes(searchValue))
            )
        );
    }

    getNumberOfSuccessfulRuns(plugins: QhanaPlugin[]): number {
        return plugins.filter(
            plugin => plugin.pluginDescription.running === 'SUCCESS'
        ).length;
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

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}
