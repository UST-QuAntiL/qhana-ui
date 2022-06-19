import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { from, Observable, Subscription, merge } from 'rxjs';
import { map, switchMap, catchError } from "rxjs/operators";
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { isInstanceOfPluginStatus, PluginDescription, PluginsService, QhanaPlugin } from 'src/app/services/plugins.service';
import { TemplatesService, TemplateDescription, QhanaTemplate } from 'src/app/services/templates.service';
import { QhanaBackendService, TimelineStepApiObject, ApiObjectList  } from 'src/app/services/qhana-backend.service';
import { FormSubmitData } from '../plugin-uiframe/plugin-uiframe.component';
import { MatOptionSelectionChange } from '@angular/material/core';

@Component({
    selector: 'qhana-experiment-workspace',
    templateUrl: './experiment-workspace.component.html',
    styleUrls: ['./experiment-workspace.component.sass']
})
export class ExperimentWorkspaceComponent implements OnInit, OnDestroy {

    private routeSubscription: Subscription | null = null;

    experimentId: string | null = null;

    searchValue: string = "";
    templateList: Observable<TemplateDescription[]> | null = null;

    filteredPluginLists: { [category: string]: PluginDescription[] } = {};

    activeTemplate: QhanaTemplate | null = null;

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
        this.templates.loadTemplates();
        this.templateList = this.templates.templates;
    }

    ngOnDestroy(): void {
        this.routeSubscription?.unsubscribe();
        this.activePluginSubscription?.unsubscribe();
    }

    changeActiveTemplate(templateDesc: TemplateDescription, event: MatOptionSelectionChange) {
        if (event.isUserInput) {
            this.templates.loadTemplate(templateDesc).subscribe(
                template => {
                    if (template == null || template === this.activeTemplate) {
                        this.activeTemplate = null;
                        return;
                    }
                    this.activeTemplate = template;
                    
                    console.log(template)

                    this.resetFilteredPluginLists();
                }
            );

            let itemCountTimeline: number = 0;
            const experimentId = this.experimentId;
            const itemsPerPage: number = 100;
    
            if (experimentId !== null) {
                const timeLineList = this.backend.getTimelineStepsPage(experimentId, 0, itemsPerPage);
    
                if (timeLineList !== null) {
                    let timeLine = timeLineList.pipe(
                        map(value => value.items),
                        catchError(err => {
                            throw err;
                        })
                    );
    
                    timeLineList.subscribe(
                        value => {
                            itemCountTimeline = value.itemCount;
                        }
                    );
    
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
                            this.activeTemplate?.categories.forEach(
                                category => category.plugins.forEach(
                                    plugin => timeLine.forEach(
                                        value => value.forEach(
                                            step => {
                                                if (isInstanceOfPluginStatus(step.status)) {
                                                    plugin.running = step.status;
                                                } else {
                                                    plugin.running = "UNKNOWN";
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
                plugin => plugin.name.toLowerCase().includes(searchValue) ||
                        plugin.apiRoot.toLowerCase().includes(searchValue) ||
                        plugin.version.toLowerCase().includes(searchValue) ||
                        plugin.identifier.toLowerCase().includes(searchValue) ||
                        plugin.description.toLocaleLowerCase().includes(searchValue) ||
                        plugin.tags.some((tag: string) => tag.toLowerCase().includes(searchValue))
                
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

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}
