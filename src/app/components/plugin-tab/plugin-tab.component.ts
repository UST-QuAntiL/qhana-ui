import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
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

interface StepperEntry {
    type: string;
}

interface TabStepperEntry extends StepperEntry {
    type: 'tab';
    tabUrl: string;
}

interface LaneGroupStepperEntry extends StepperEntry {
    type: 'group';
    lanes: StepperLane[];
    kind: 'sequential' | 'parallel' | 'parallel-choice';
}

interface StepperLane {
    entries: StepperEntry[];
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
    private tabCompletionUpdatesubscription: Subscription | null = null;

    private tabCompletionRequestSubject: Subject<null> = new Subject();

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

    stepperData: StepperLane | null = null;

    get currentMainLocation() {
        if (this.currentExperimentId != null) {
            return "experiment-navigation";
        }
        return "navigation";
    }

    tabNavigationLayout: "nested-tabs" | "outline" | "stepper" = "outline"

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
                this.stepperData = null;
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
            const lastExperimentId = this.currentExperimentId;
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

            if (this.currentExperimentId != lastExperimentId) {
                this.tabCompletionRequestSubject.next(); // schedule an update
            }
        });
        this.tabCompletionUpdatesubscription = this.tabCompletionRequestSubject.pipe(debounceTime(10000)).subscribe(() => this.updateLeafTabCompletion());
        this.templateTabUpdatesSubscription = this.templates.currentTemplateTabsUpdates.subscribe(() => {
            // FIXME handle tab updates!
        });
    }

    ngOnDestroy(): void {
        this.routeParamsSubscription?.unsubscribe();
        this.queryParamsSubscription?.unsubscribe();
        this.currentTemplateSubscription?.unsubscribe();
        this.templateTabUpdatesSubscription?.unsubscribe();
        this.tabCompletionUpdatesubscription?.unsubscribe();
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
            this.stepperData = null;
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

        // kick of async tab completion check
        this.checkCurrentTabCompletion();
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

        const oldTabPath = this.tabPath;
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
        if (oldTabPath.length > 0 && rootTabUrl === oldTabPath[0]) {
            return; // don't update layout mode when root tab does not change
        }
        const rootTabLink = this.urlToTab.get(rootTabUrl)?.self;
        if (rootTabLink == null) {
            return;
        }
        const rootTab = await this.registry.getByApiLink<TemplateTabApiObject>(rootTabLink, null, false);
        const layoutMode = rootTab?.data?.metadata?.layout?.toLowerCase();
        if (layoutMode == null || layoutMode === "default" || layoutMode === "nested-tabs") {
            this.tabNavigationLayout = "nested-tabs";
        } else if (layoutMode === "outline") {
            this.tabNavigationLayout = "outline";
        } else if (layoutMode === "stepper") {
            this.tabNavigationLayout = "stepper";
        } else {
            // fallback to default layout
            this.tabNavigationLayout = "nested-tabs";
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

        // tabs with next tabs but not previous tabs (starting points for the stepper layout)
        const startTabs: string[] = [];

        // update nav data
        urlToNavData.forEach((navData, tabUrl) => {
            navData.nextTabs = Array.from(urlToNext.get(tabUrl) ?? []);
            navData.previousTabs = Array.from(urlToPrevious.get(tabUrl) ?? []);
            if (navData.nextTabs.length > 0 && navData.previousTabs.length === 0) {
                startTabs.push(tabUrl);
            }
        });

        const mainLane: StepperLane = { entries: [] };

        const addedToStepper = new Set<string>();
        let runawayProtection = 100000;

        const addEntryToStepperLane = (lane: StepperLane, next: string[]): string[] => {
            runawayProtection -= 1;
            if (runawayProtection < 0) {
                console.warn("LOOP DETECTED!")
                return [];
            }
            // prevent tabs from being added more than once!
            next = next.filter(tabUrl => !addedToStepper.has(tabUrl));
            if (next.length === 0) {
                return []; // nothing left to add
            }
            if (next.length === 1) {
                // only a single tab, add a new entry
                const tabUrl = next[0];
                addedToStepper.add(tabUrl);
                const entry: TabStepperEntry = { type: 'tab', tabUrl: tabUrl };
                lane.entries.push(entry);
                const nextTabs = urlToNavData.get(tabUrl)?.nextTabs ?? [];
                return nextTabs;
            }
            // multiple next tabs possible, fist check fork type
            const parents = new Set<string>();
            const previous = new Set<string>();
            next.forEach(tabUrl => {
                const navData = urlToNavData.get(tabUrl);
                parents.add(navData?.parentTabUrl ?? "UNKNOWN");
                const previousTabs = navData?.previousTabs;
                if (previousTabs == null) {
                    return;
                }
                previousTabs.forEach(prevUrl => previous.add(prevUrl));
            });

            let groupType: 'sequential' | 'parallel' | 'parallel-choice' = 'parallel';
            const parent = parents.keys().next().value;
            if (parent != null) {
                const childOrder = urlToTab.get(parent)?.metadata?.childOrder;
                if (childOrder === 'sequential' || childOrder === 'parallel' || childOrder === 'parallel-choice') {
                    groupType = childOrder;
                }
            }
            const previouTab = previous.keys().next().value;
            if (previouTab != null) {
                const nextOrder = urlToTab.get(previouTab)?.metadata?.nextOrder;
                if (nextOrder === 'sequential' || nextOrder === 'parallel' || nextOrder === 'parallel-choice') {
                    groupType = nextOrder;
                }
            }

            const groupEntry: LaneGroupStepperEntry = { type: 'group', lanes: [], kind: groupType };
            lane.entries.push(groupEntry);

            const combinedNext: string[] = [];

            next.forEach(nextUrl => {
                const groupLane: StepperLane = { entries: [] };
                groupEntry.lanes.push(groupLane);
                let nextTabs = [nextUrl]; // start with the tab as a single tab
                while (nextTabs.length > 0) {
                    runawayProtection -= 1;
                    if (runawayProtection < 0) {
                        console.warn("LOOP DETECTED!")
                        return;
                    }
                    nextTabs = addEntryToStepperLane(groupLane, nextTabs);
                    if (parent != null && nextTabs.length > 0) {
                        const anyOutsideParent = nextTabs.some(t => {
                            let p: string | null = t;
                            while (p != null) {
                                runawayProtection -= 1;
                                if (runawayProtection < 0) {
                                    console.warn("LOOP DETECTED!")
                                    return true;
                                }
                                if (p === parent) {
                                    return false; // tab is under current parent
                                }
                                p = urlToNavData.get(p)?.parentTabUrl ?? null;
                            }
                            return true; // tab has different parent
                        });
                        if (anyOutsideParent) {
                            // one ore more next tab is not inside the current parent tab
                            // => end group and handle next tabs outside group
                            nextTabs.forEach(n => {
                                if (!combinedNext.includes(n)) {
                                    combinedNext.push(n);
                                }
                            });
                            // next tabs are handled outside this group lane,
                            // end iteration
                            nextTabs = [];
                        }
                    }
                }
            });

            // exhausted all groups without merging
            return combinedNext;
        }

        let nextTabs = startTabs;
        while (nextTabs.length > 0) {
            runawayProtection -= 1;
            if (runawayProtection < 0) {
                console.warn("LOOP DETECTED!")
                return;
            }
            nextTabs = addEntryToStepperLane(mainLane, nextTabs);
        }
        this.stepperData = mainLane;
    }

    private async updateLeafTabCompletion() {
        const experimentId = this.currentExperimentId;
        if (experimentId == null) {
            return;
        }

        const tabsToCheck: TemplateTabApiObject[] = [];
        this.urlToTab.forEach(tab => {
            if (tab.groupKey) {
                return; // not a leaf tab
            }
            if (!tab.location.startsWith("experiment-navigation")) {
                return; // not in the correct location
            }
            if (tab.self.href === this.currentTemplateTab?.self?.href) {
                return; // already checked elsewhere
            }
            tabsToCheck.push(tab);
        });

        const successfulPlugins = await this.backend.getPluginSummary(experimentId).toPromise();

        const promises = tabsToCheck.map(async tab => {
            const tabId = tab.self.resourceKey?.uiTemplateTabId;
            if (tabId == null) {
                return; // cannot check tab completion
            }

            const query = new URLSearchParams();
            query.set("template-tab", tabId);
            const pluginsResponse = await this.registry.getByRel<PageApiObject>([["plugin", "collection"]], query);
            const pluginGroup = pluginsResponse?.data ?? null;

            if (pluginGroup == null) {
                this.templates.setTemplateTabCompletion(false, experimentId, tabId);
                return;
            }

            const nrOfPlugins = pluginGroup.collectionSize;
            const nrOfSuccesses = pluginGroup.items.reduce((value, link) => {
                if (successfulPlugins[link.resourceKey?.["?name"] ?? ""] != null) {
                    return value + 1;
                }
                return value;
            }, 0);

            const completionCriteria = tab.metadata?.completedOn ?? "any-success";

            let completed: boolean = false;
            if (completionCriteria === "any-success") {
                completed = nrOfSuccesses > 0;
            }
            if (completionCriteria === "all-success") {
                completed = nrOfSuccesses === nrOfPlugins && nrOfPlugins > 0;
            }

            this.templates.setTemplateTabCompletion(completed, experimentId, tabId);
        });

        await Promise.allSettled(promises);

        // kick off inner tab completion update next
        this.updateInnerTabCompletion();
    }

    private async updateInnerTabCompletion() {
        const experimentId = this.currentExperimentId;
        if (experimentId == null) {
            return;
        }

        const urlToTab = this.urlToTab;
        const groupToTabs = this.groupToTabs;

        let runawayCount = 10000;

        const updateTabCompletion = async (tabUrl: string): Promise<boolean> => {
            runawayCount -= 1;
            const tab = urlToTab.get(tabUrl);
            const tabId = tab?.self?.resourceKey?.uiTemplateTabId;
            if (runawayCount < 0) {
                console.warn("Detected infinite recursion!");
                return false;
            }
            if (tab == null || tabId == null) {
                return false; // assume as not completed in case of errors
            }
            if (!tab.groupKey) {
                // is not an inner tab, return child status as is
                return this.templates.getTemplateTabCompletion(experimentId, tabId);
            }
            const childGroup = `${tab.location}.${tab.groupKey}`;
            const childUrls = groupToTabs.get(childGroup) ?? [];

            if (childUrls.length === 0) {
                // cannot complete inner tab without child tabs!
                this.templates.setTemplateTabCompletion(false, experimentId, tabId);
                return false;
            }

            const childrenStatus = await Promise.all(childUrls.map(updateTabCompletion));

            // by default, all children of inner tabs must be successful
            const completionCriteria = tab.metadata?.completedOn ?? "all-success";

            let completed: boolean = false;
            if (completionCriteria === "one-success") {
                const nrOfSuccesses = childrenStatus.filter(s => s).length;
                completed = nrOfSuccesses === 1;
            }
            if (completionCriteria === "any-success") {
                completed = childrenStatus.some(s => s);
            }
            if (completionCriteria === "all-success") {
                completed = childrenStatus.every(s => s);
            }

            this.templates.setTemplateTabCompletion(completed, experimentId, tabId);
            return completed;
        }

        const expNavTabs = groupToTabs.get("experiment-navigation") ?? [];
        expNavTabs.forEach(tabUrl => updateTabCompletion(tabUrl));
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

    private async checkCurrentTabCompletion() {
        const currentTab = this.currentTemplateTab;
        const pluginGroup = this.currentPluginGroup;
        const experimentId = this.currentExperimentId;
        if (currentTab == null || pluginGroup == null || experimentId == null) {
            return;
        }
        const successfulPlugins = await this.backend.getPluginSummary(experimentId).toPromise();
        const nrOfPlugins = pluginGroup.collectionSize;
        const nrOfSuccesses = pluginGroup.items.reduce((value, link) => {
            if (successfulPlugins[link.resourceKey?.["?name"] ?? ""] != null) {
                return value + 1;
            }
            return value;
        }, 0);

        const completionCriteria = currentTab.metadata?.completedOn ?? "any-success";

        let completed: boolean = false;
        if (completionCriteria === "any-success") {
            completed = nrOfSuccesses > 0;
        }
        if (completionCriteria === "all-success") {
            if (nrOfPlugins > 25) {
                console.warn("Success Criterium 'all-success' is not supported for large numbers of plugins.");
            }
            completed = nrOfSuccesses === nrOfPlugins && nrOfPlugins > 0;
        }

        this.templates.setTemplateTabCompletion(completed, experimentId, currentTab.self.resourceKey?.uiTemplateTabId ?? "");
        this.updateInnerTabCompletion();
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
