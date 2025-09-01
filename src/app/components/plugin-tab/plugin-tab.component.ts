import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiLink, CollectionApiObject, PageApiObject } from 'src/app/services/api-data-types';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { PluginApiObject } from 'src/app/services/qhana-api-data-types';
import { ExperimentDataApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateApiObject, TemplatesService, TemplateTabApiObject } from 'src/app/services/templates.service';
import { FormSubmitData } from '../plugin-uiframe/plugin-uiframe.component';


interface NavTab {
    tabId: string;
    name: string;
    icon: string | null;
    path: string;
    isGroup: boolean;
    link: string[];
}


@Component({
    selector: 'qhana-plugin-tab',
    templateUrl: './plugin-tab.component.html',
    styleUrls: ['./plugin-tab.component.sass']
})
export class PluginTabComponent implements OnInit, OnDestroy {

    private routeParamsSubscription: Subscription | null = null;
    private currentTemplateSubscription: Subscription | null = null;
    private templateTabUpdatesSubscription: Subscription | null = null;

    private currentTemplate: TemplateApiObject | null = null;
    private currentTemplateTab: TemplateTabApiObject | null = null;

    currentLocation: string | null = null;
    currentExperimentId: string | null = null;
    currentPath: string | null = null;
    currentTemplateId: string | null = null;
    routeTemplateId: string | null = null;
    currentTabId: string | null = null;
    currentPluginId: string | null = null;

    navigationTabs: NavTab[][] = [];
    navTabLinkPrefix: string[] = [];

    currentPluginGroup: PageApiObject | null = null;

    activePlugin: ApiLink | null = null;
    highlightedPlugin: Set<string> = new Set();

    activePluginFrontendUrl: string | null = null;

    previewData: ExperimentDataApiObject | null = null;

    constructor(private route: ActivatedRoute, private router: Router, private registry: PluginRegistryBaseService, private backend: QhanaBackendService, private templates: TemplatesService, private experiment: CurrentExperimentService) { }

    ngOnInit(): void {
        this.currentTemplateSubscription = this.templates.currentTemplate.subscribe(template => {
            this.currentTemplate = template;
            this.onParamsChanged();
        });
        this.routeParamsSubscription = this.route.params.subscribe(params => {
            this.currentExperimentId = params?.experimentId ?? null;
            this.experiment.setExperimentId(params?.experimentId ?? null);
            this.currentPath = params?.path ?? null;
            this.currentTabId = params?.templateTabId ?? null;
            let pluginId = params?.pluginId ?? null;
            if (this.currentTabId == null) {
                pluginId = null;
            }
            this.currentPluginId = pluginId;
            this.onParamsChanged();
        });
        this.templateTabUpdatesSubscription = this.templates.currentTemplateTabsUpdates.subscribe(() => {
            // this.updateGeneralExtraTabGroup();
            // this.updateExperimentExtraTabGroup();
        });
    }

    ngOnDestroy(): void {
        this.routeParamsSubscription?.unsubscribe();
        this.currentTemplateSubscription?.unsubscribe();
        this.templateTabUpdatesSubscription?.unsubscribe();
    }

    private getNavigationGroups(tab: TemplateTabApiObject) {
        let groupLocation = tab.location;
        if (tab.groupKey) {
            groupLocation = `${tab.location}.${tab.groupKey}`;
        }
        return this.currentTemplate?.groups?.filter(group => {
            const groupKey = group.resourceKey?.["?group"] ?? null;
            if (!groupKey?.includes(".")) {
                return false;
            }
            if (groupKey && groupLocation.startsWith(groupKey)) {
                return true;
            }
            return false;
        }) ?? [];
    }

    private async onParamsChanged() {
        if (this.currentTabId == null || this.currentTemplate == null) {
            this.currentTemplateTab = null;
            this.currentLocation = null;
            this.navigationTabs = [];
            this.currentPluginGroup = null;
            this.onPluginGroupChanged();
            return;
        }

        if (this.currentExperimentId == null) {
            this.navTabLinkPrefix = ["/extra"];
        } else {
            this.navTabLinkPrefix = ["/experiments", this.currentExperimentId, "extra"];
        }

        await this.loadTab();
        await this.loadPluginGroup();
        await this.loadPlugin();
    }

    private async loadTab() {
        if (this.currentTemplateTab?.self?.resourceKey?.templateTabId === this.currentTabId) {
            return;
        }
        if (this.currentTemplate == null) {
            return;
        }

        const templateResponse = await this.registry.getByApiLink<TemplateApiObject>(this.currentTemplate.self, null, false);
        const tabsLink = templateResponse?.links?.find(link => link.resourceType === "ui-template-tab" && link.rel.some(r => r === "collection"));
        if (tabsLink == null) {
            return;
        }

        const allTabs = await this.registry.getByApiLink<CollectionApiObject>(tabsLink, null, true);
        const tabLink = allTabs?.data?.items?.find(tab => tab.resourceKey?.uiTemplateTabId === this.currentTabId);
        if (tabLink == null) {
            return;
        }

        const tab = await this.registry.getByApiLink<TemplateTabApiObject>(tabLink, null, false);
        this.currentTemplateTab = tab?.data ?? null;
        this.currentLocation = tab?.data?.location ?? null;

        if (tab == null) {
            return;
        }

        const groups = this.getNavigationGroups(tab.data);
        groups.sort((a, b) => (a.resourceKey?.["?group"]?.length ?? 0) - (b.resourceKey?.["?group"]?.length ?? 0));

        const navigationTabs: NavTab[][] = await Promise.all(groups.map(group => {
            const filtered = allTabs?.data?.items?.filter(tab => tab.resourceKey?.["?group"] != null && tab.resourceKey["?group"] === group.resourceKey?.["?group"]) ?? [];
            const promises = filtered.map(tabLink => {
                return this.registry.getByApiLink<TemplateTabApiObject>(tabLink, null, false).then(tab => {
                    const link: string[] = [];
                    if (tab?.data?.location) {
                        link.push(tab?.data?.location);
                    }
                    link.push(tabLink.resourceKey?.uiTemplateTabId ?? "-1");
                    const t: NavTab = {
                        tabId: tab?.data?.self?.resourceKey?.uiTemplateTabId ?? "-1",
                        name: tab?.data?.name ?? tabLink.name ?? "UNNAMED TAB",
                        icon: tab?.data?.icon ?? null,
                        path: (tab?.data?.location ?? "") + ".",
                        isGroup: Boolean(tab?.data?.groupKey),
                        link: link,
                    }
                    return t;
                });
            });
            return Promise.all(promises);
        }));
        this.navigationTabs = navigationTabs;
    }

    private async loadPluginGroup() {
        if (this.currentTemplateTab?.self?.resourceKey?.uiTemplateTabId == null || this.currentTemplateTab.groupKey) {
            this.currentPluginGroup = null;
            await this.onPluginGroupChanged();
            return;
        }

        const tabId = this.currentTemplateTab.self.resourceKey.uiTemplateTabId;
        if (tabId === this.currentPluginGroup?.self?.resourceKey?.["?template-tab"]) {
            return;  // plugin group already loaded
        }

        const query = new URLSearchParams();
        query.set("template-tab", tabId);
        const pluginsResponse = await this.registry.getByRel<PageApiObject>([["plugin", "collection"]], query);
        this.currentPluginGroup = pluginsResponse?.data ?? null;
        await this.onPluginGroupChanged();
    }

    private async onPluginGroupChanged() {
        if (this.currentPluginGroup?.collectionSize === 1) {
            this.activePlugin = this.currentPluginGroup.items[0] ?? null;
            await this.onActivePluginChanged();
            return;
        }
        if (this.currentPluginId == null) {
            this.activePlugin = null;
            await this.onActivePluginChanged();
            return;
        }
    }

    private async loadPlugin() {
        if (this.currentPluginId == null || (this.activePlugin?.resourceKey?.pluginId ?? null) === this.currentPluginId) {
            return;
        }

        let pluginLink = this.currentPluginGroup?.items?.find(link => link.resourceKey?.pluginId === this.currentPluginId) ?? null;

        if (pluginLink == null && this.currentPluginGroup != null) {
            const query = new URLSearchParams();
            query.set("plugin-id", this.currentPluginId);
            const page = await this.registry.getByApiLink<PageApiObject>(this.currentPluginGroup.self, query);
            if (page?.data?.items?.[0]?.resourceKey?.pluginId === this.currentPluginId) {
                pluginLink = page.data.items[0];
            }
        }

        this.activePlugin = pluginLink;
        await this.onActivePluginChanged();
    }

    private async onActivePluginChanged() {
        if (this.activePlugin == null) {
            this.activePluginFrontendUrl = null;
            this.highlightedPlugin = new Set();
            return;
        }

        this.highlightedPlugin = new Set([this.activePlugin.resourceKey?.pluginId ?? ""]);

        const pluginResponse = await this.registry.getByApiLink<PluginApiObject>(this.activePlugin);
        this.activePluginFrontendUrl = pluginResponse?.data?.entryPoint?.uiHref ?? null; // FIXME for relative URLs!
    }

    selectPlugin(plugin: ApiLink) {
        this.activePlugin = plugin;
        this.onActivePluginChanged();

        this.router.navigate([...this.navTabLinkPrefix, this.currentTabId, 'plugin', plugin.resourceKey?.pluginId], { queryParamsHandling: 'preserve' });
    }

    async onPluginUiFormSubmit(formData: FormSubmitData) {
        const location = this.currentLocation;
        if (location == null) {
            return;
        }
        if (!location.startsWith("experiment-navigation")) {
            return;  // only allow submit in experiment navigation tabs
        }
        const pluginLink = this.activePlugin;
        if (pluginLink == null) {
            return;
        }
        const experimentId = this.currentExperimentId;
        const plugin = (await this.registry.getByApiLink<PluginApiObject>(pluginLink, null, false))?.data ?? null;
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
