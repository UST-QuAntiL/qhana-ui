import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiLink, PageApiObject } from 'src/app/services/api-data-types';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { PluginApiObject } from 'src/app/services/qhana-api-data-types';
import { ExperimentDataApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateApiObject, TemplatesService, TemplateTabApiObject } from 'src/app/services/templates.service';
import { FormSubmitData } from '../plugin-uiframe/plugin-uiframe.component';


interface NavigationData {
    navigationLink: string[];
    parentTabUrl: string | null;
    nextTabs: string[];
    previousTabs: string[];
}


@Component({
    selector: 'qhana-plugin-tab',
    templateUrl: './plugin-tab.component.html',
    styleUrls: ['./plugin-tab.component.sass'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PluginTabComponent implements OnInit, OnDestroy {

    private routeParamsSubscription: Subscription | null = null;
    private queryParamsSubscription: Subscription | null = null;
    private currentTemplateSubscription: Subscription | null = null;
    private templateTabUpdatesSubscription: Subscription | null = null;

    private currentTemplate: TemplateApiObject | null = null;
    currentTemplateTab: TemplateTabApiObject | null = null;

    currentLocation: string | null = null;
    currentExperimentId: string | null = null;
    currentPath: string | null = null;
    routeTemplateId: string | null = null;
    currentTabId: string | null = null;
    currentPluginId: string | null = null;

    urlToTab: Map<string, TemplateTabApiObject> = new Map();
    urlToNavData: Map<string, NavigationData> = new Map();
    groupToTabs: Map<string, string[]> = new Map();

    get currentMainLocation() {
        if (this.currentExperimentId != null) {
            return "experiment-navigation";
        }
        return "navigation";
    }

    tabNavigationLayout: "nested-tabs" | "outline" = "outline"

    tabPath: string[] = [];
    allTabs: string[] = [];

    navTabLinkPrefix: string[] = [];

    templateParam: string | undefined = undefined;
    extraParams: Map<string, string> | null = null;

    currentPluginGroup: PageApiObject | null = null;

    activePlugin: ApiLink | null = null;
    highlightedPlugin: Set<string> = new Set();

    activePluginFrontendUrl: string | null = null;

    previewData: ExperimentDataApiObject | null = null;

    constructor(private route: ActivatedRoute, private router: Router, private registry: PluginRegistryBaseService, private backend: QhanaBackendService, private templates: TemplatesService, private experiment: CurrentExperimentService) { }

    ngOnInit(): void {
        this.currentTemplateSubscription = this.templates.currentTemplate.subscribe(template => {
            const sameTemplate = this.currentTemplate?.self?.href === template?.self?.href;
            this.currentTemplate = template;
            if (!sameTemplate) {
                this.urlToTab = this.getPrefilledUrlToTabMap(template);
                this.urlToNavData = new Map();
            }
            this.prepareNavigationData();
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
        this.queryParamsSubscription?.unsubscribe();
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

    private prepareNavigationData() {
        const urlToNavData = this.urlToNavData;
        const template = this.currentTemplate;
        if (template == null) {
            return;
        }

        const groupToTabs = new Map<string, string[]>();
        groupToTabs.set("navigation", []);
        groupToTabs.set("experiment-navigation", []);
        groupToTabs.set("experiment-workspace", []);  // TODO check

        const groupToParent = new Map<string, string>();

        template.tabs.forEach(tab => {
            const link: string[] = [];
            if (tab?.resourceKey?.["?group"]) {
                link.push(tab?.resourceKey?.["?group"]);
            }
            link.push(tab.resourceKey?.uiTemplateTabId ?? "-1");
            urlToNavData.set(tab.href, { navigationLink: link, parentTabUrl: null, nextTabs: [], previousTabs: [] });
            if (tab.resourceKey?.["?tab"]) {
                groupToTabs.set(tab.resourceKey?.["?tab"], []);
                groupToParent.set(tab.resourceKey?.["?tab"], tab.href);
            }
        });

        // populate tab groups
        template.tabs.forEach(tab => {
            const group = tab?.resourceKey?.["?group"];
            if (group == null) {
                return;
            }
            groupToTabs.get(group)?.push(tab.href);
            const parentTabUrl = groupToParent.get(group);
            if (parentTabUrl != null) {
                const data = urlToNavData.get(tab.href);
                if (data != null) {
                    data.parentTabUrl = parentTabUrl;
                }
            }
        });

        this.groupToTabs = groupToTabs;
        this.loadAllTabs(); // start async loading of tabs
    }

    private async onParamsChanged() {
        if (this.currentTemplate == null) {
            this.urlToTab.clear();
            this.urlToNavData.clear();
        }
        if (this.currentTabId == null || this.currentTemplate == null) {
            this.currentTemplateTab = null;
            this.currentLocation = null;
            this.tabPath = [];
            this.allTabs = [];
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

    private getPrefilledUrlToTabMap(template: TemplateApiObject | null) {
        const urlToTab = new Map<string, TemplateTabApiObject>()
        if (template == null) {
            return urlToTab;
        }
        template.tabs.forEach(tabLink => {
            const location = tabLink.resourceKey?.["?group"];
            if (location == null) {
                return;
            }
            const tabGroup = tabLink.resourceKey?.["?tab"];
            const mockTabObject: TemplateTabApiObject = {
                self: tabLink,
                name: tabLink.name ?? tabLink.href,
                description: "",
                location: location,
                groupKey: tabGroup ? tabGroup.substring(location.length + 1) : "",
                sortKey: 0,
                icon: null,
                filterString: "",
                metadata: {},
                plugins: null as any,
            }
            urlToTab.set(tabLink.href, mockTabObject);
        });
        return urlToTab;
    }

    private async loadTab() {
        if (this.currentTemplateTab?.self?.resourceKey?.templateTabId === this.currentTabId) {
            return;
        }
        const currentTemplate = this.currentTemplate;
        if (currentTemplate == null) {
            return;
        }

        const tabLink = currentTemplate.tabs.find(link => link.resourceType === "ui-template-tab" && link.resourceKey?.uiTemplateTabId === this.currentTabId);
        if (tabLink == null) {
            return;
        }

        const tab = await this.registry.getByApiLink<TemplateTabApiObject>(tabLink, null, true);
        this.currentTemplateTab = tab?.data ?? null;
        this.currentLocation = tab?.data?.location ?? null;

        if (tab == null) {
            return;
        }

        const allTabs: string[] = [];
        const groupPath = tab.data.self?.resourceKey?.["?tab"]?.split(".") ?? tab.data.self?.resourceKey?.["?group"]?.split(".") ?? [];
        const groupToTabs = this.groupToTabs;
        const urlToTab = this.urlToTab;
        if (groupPath.length > 1) {
            const startGroup = `${groupPath[0]}.${groupPath[1]}`;
            function insertAllFromGroup(group: string, allTabs: string[]) {
                const tabs = groupToTabs.get(group) ?? [];
                tabs.forEach(tabUrl => {
                    allTabs.push(tabUrl);
                    const tabGroupKey = urlToTab.get(tabUrl)?.groupKey;
                    if (tabGroupKey) {
                        insertAllFromGroup(`${group}.${tabGroupKey}`, allTabs);
                    }
                });
            }
            insertAllFromGroup(startGroup, allTabs);
        }
        this.allTabs = allTabs;

        const newTabPath = [tab.data.self.href];
        const urlToNavData = this.urlToNavData;
        let parent = urlToNavData.get(tab.data.self.href)?.parentTabUrl;
        while (parent != null && !newTabPath.includes(parent)) {
            newTabPath.push(parent);
            parent = urlToNavData.get(parent)?.parentTabUrl;
        }
        this.tabPath = newTabPath.reverse();

        // set layout mode based on the root tab in the navigation path
        if (newTabPath.length === 0) {
            return;
        }
        const rootTabUrl = newTabPath[0];
        const rootTabLink = this.urlToTab.get(rootTabUrl)?.self;
        if (rootTabLink == null) {
            return;
        }
        const rootTab = await this.registry.getByApiLink<TemplateTabApiObject>(rootTabLink, null, false);
        const layoutMode = rootTab?.data?.metadata?.layout?.toLowerCase();
        if (layoutMode == null || layoutMode === "default" || layoutMode === "nested-tabs") {
            this.tabNavigationLayout = "nested-tabs";
        }
        if (layoutMode === "outline") {
            this.tabNavigationLayout = "outline";
        }
    }

    private async loadAllTabs() {
        const currentTemplateId = this.currentTemplate?.self?.resourceKey?.uiTemplateId;
        const urlToTab = this.urlToTab;
        if (currentTemplateId == null) {
            return;
        }
        const allTabs = await this.templates.getAllTabs(currentTemplateId);
        allTabs.forEach(tab => urlToTab.set(tab.self.href, tab));
        await this.calculateTabRelations();
    }

    private async calculateTabRelations() {
        const currentTemplate = this.currentTemplate;
        const urlToTab = this.urlToTab;
        const urlToNavData = this.urlToNavData;
        if (currentTemplate == null) {
            return;
        }

        const idToUrl = new Map<string, string>();
        currentTemplate.tabs.forEach(tabLink => {
            const tabId = tabLink.resourceKey?.uiTemplateTabId;
            if (tabId != null) {
                idToUrl.set(tabId, tabLink.href);
            }
        });

        // fill out next/previous relations bi-directinally
        const urlToPrevious = new Map<string, Set<string>>();
        const urlToNext = new Map<string, Set<string>>();
        idToUrl.forEach((tabUrl) => {
            const tab = urlToTab.get(tabUrl);
            if (tab == null) {
                return;
            }
            const next = tab.metadata?.next?.split(/,?\s+/g) ?? [];
            next.forEach(nextId => {
                const nextUrl = idToUrl.get(nextId);
                if (nextUrl != null) {
                    urlToNext.getOrInsertComputed(tabUrl, () => new Set()).add(nextUrl);
                    urlToPrevious.getOrInsertComputed(nextUrl, () => new Set()).add(tabUrl);
                }
            });

            const previous = tab.metadata?.previous?.split(/,?\s+/g) ?? [];
            previous.forEach(previousId => {
                const previousUrl = idToUrl.get(previousId);
                if (previousUrl != null) {
                    urlToPrevious.getOrInsertComputed(tabUrl, () => new Set()).add(previousUrl);
                    urlToNext.getOrInsertComputed(previousUrl, () => new Set()).add(tabUrl);
                }
            });
        });

        // update nav data
        urlToNavData.forEach((navData, tabUrl) => {
            navData.nextTabs = Array.from(urlToNext.get(tabUrl) ?? []);
            navData.previousTabs = Array.from(urlToPrevious.get(tabUrl) ?? []);
        });
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
        const nextUrl = pluginResponse?.data?.entryPoint?.uiHref ?? null;

        if (nextUrl == null) {
            this.activePluginFrontendUrl = null;
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
    }

    selectPlugin(plugin: ApiLink) {
        this.activePlugin = plugin;
        this.onActivePluginChanged();

        this.router.navigate(
            [...this.navTabLinkPrefix, this.currentTabId, 'plugin', plugin.resourceKey?.pluginId],
            { queryParams: (this.templateParam != null) ? { "template": this.templateParam } : {} }
        );
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
        }).subscribe(timelineStep => this.router.navigate(
            ['/experiments', experimentId, 'timeline', timelineStep.sequence.toString()],
            { queryParams: (this.templateParam != null) ? { "template": this.templateParam } : {} }
        ));
    }

}
