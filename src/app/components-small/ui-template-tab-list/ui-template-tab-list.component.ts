import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiLink } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateApiObject, TemplatesService, TemplateTabApiObject } from 'src/app/services/templates.service';

interface NavTabGroup {
    groupKey: string;
    name: string;
    icon?: string | null;
    tabs: ApiLink[];
}


@Component({
    selector: 'qhana-ui-template-tab-list',
    templateUrl: './ui-template-tab-list.component.html',
    styleUrl: './ui-template-tab-list.component.sass',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class UiTemplateTabListComponent implements OnInit, OnChanges, OnDestroy {

    @Input() templateLink: ApiLink | null = null;
    @Input() showOnly: boolean = false;

    isLoading: boolean = true;

    navigationGroup: NavTabGroup | null = null;
    workspaceGroup: NavTabGroup | null = null;
    experimentNavigationGroup: NavTabGroup | null = null;
    navigationGroups: NavTabGroup[] = [];
    experimentNavigationGroups: NavTabGroup[] = [];
    unknownGroups: NavTabGroup[] = [];

    private allGroups: NavTabGroup[] = [];

    // new tab
    createTabLink: ApiLink | null = null;
    newTabData: any = null;
    isValid: boolean = false;


    hrefToTab: Map<string, TemplateTabApiObject> = new Map();

    private newTabsSubscription: Subscription | null = null;
    private changedTabsSubscription: Subscription | null = null;
    private deletedTabsSubscription: Subscription | null = null;

    constructor(private registry: PluginRegistryBaseService, private templates: TemplatesService) { }

    ngOnInit(): void {
        this.newTabsSubscription = this.registry.newApiObjectSubject.subscribe((apiObject) => {
            if (apiObject.new.resourceType !== "ui-template-tab") {
                return;
            }
            if (apiObject.new.resourceKey?.uiTemplateId !== this.templateLink?.resourceKey?.uiTemplateId) {
                return;
            }
            this.updateTemplateTab(apiObject.new);
        });
        this.changedTabsSubscription = this.registry.changedApiObjectSubject.subscribe((apiObject) => {
            if (apiObject.changed.resourceType !== "ui-template-tab") {
                return;
            }
            if (apiObject.changed.resourceKey?.uiTemplateId !== this.templateLink?.resourceKey?.uiTemplateId) {
                return;
            }
            this.updateTemplateTab(apiObject.changed);
        });
        this.deletedTabsSubscription = this.registry.deletedApiObjectSubject.subscribe((apiObject) => {
            if (apiObject.deleted.resourceType !== "ui-template-tab") {
                return;
            }
            if (apiObject.deleted.resourceKey?.uiTemplateId !== this.templateLink?.resourceKey?.uiTemplateId) {
                return;
            }
            this.removeTemplateTab(apiObject.deleted);
        });
    }

    ngOnDestroy(): void {
        this.newTabsSubscription?.unsubscribe();
        this.changedTabsSubscription?.unsubscribe();
        this.deletedTabsSubscription?.unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges): void {
        this.isLoading = true;
        this.loadTemplateGroups();
    }

    private async loadTemplateGroups() {
        if (this.templateLink == null) {
            this.hrefToTab = new Map();
            this.workspaceGroup = null;
            this.navigationGroup = null;
            this.experimentNavigationGroup = null;
            this.navigationGroups = [];
            this.experimentNavigationGroups = [];
            this.unknownGroups = [];
            this.isLoading = false;
            return;
        }
        const templateResponse = await this.registry.getByApiLink<TemplateApiObject>(this.templateLink, null, true);
        if (templateResponse == null) {
            this.hrefToTab = new Map();
            this.workspaceGroup = null;
            this.navigationGroup = null;
            this.experimentNavigationGroup = null;
            this.navigationGroups = [];
            this.experimentNavigationGroups = [];
            this.unknownGroups = [];
            this.isLoading = false;
            return;
        }

        this.createTabLink = templateResponse?.links?.find?.(link => link.rel.some(rel => rel === "create") && link.resourceType == "ui-template-tab") ?? null;

        const hrefToTab = new Map<string, TemplateTabApiObject>();

        let navGroup: NavTabGroup | null = null;
        let workspace: NavTabGroup | null = null;
        let expNavGroup: NavTabGroup | null = null;
        const navGroups: NavTabGroup[] = [];
        const expNavGroups: NavTabGroup[] = [];
        const unknownGroups: NavTabGroup[] = [];

        const allGroups: NavTabGroup[] = [];

        const allTabs = await this.templates.getAllTabs(templateResponse);

        const locationToGroup = new Map<string, NavTabGroup>();

        templateResponse.data.groups.forEach((group) => {
            const tabGroup: NavTabGroup = {
                groupKey: group.resourceKey?.["?group"] ?? "unknwon",
                name: group.name ?? "UNNAMED",
                tabs: [],
            };

            allGroups.push(tabGroup);
            locationToGroup.set(tabGroup.groupKey, tabGroup);
            if (tabGroup.groupKey === "workspace") {
                workspace = tabGroup;
            } else if (tabGroup.groupKey === "navigation") {
                navGroup = tabGroup;
            } else if (tabGroup.groupKey === "experiment-navigation") {
                expNavGroup = tabGroup;
            } else if (tabGroup.groupKey.startsWith("navigation")) {
                navGroups.push(tabGroup);
            } else if (tabGroup.groupKey.startsWith("experiment-navigation")) {
                expNavGroups.push(tabGroup);
            } else {
                unknownGroups.push(tabGroup);
            }
        });

        allTabs.forEach((tab) => {
            hrefToTab.set(tab.self.href, tab);
            const tabGroup = locationToGroup.get(tab.location);
            tabGroup?.tabs.push(tab.self);

            if (tab.groupKey && tab.icon) {
                const childTabGroup = locationToGroup.get(`${tab.location}.${tab.groupKey}`);
                if (childTabGroup) {
                    childTabGroup.icon = tab.icon;
                }
            }
        });

        this.hrefToTab = hrefToTab;
        this.navigationGroup = navGroup;
        this.workspaceGroup = workspace;
        this.experimentNavigationGroup = expNavGroup;
        this.navigationGroups = navGroups;
        this.experimentNavigationGroups = expNavGroups;
        this.unknownGroups = unknownGroups;
        this.allGroups = allGroups;
        this.isLoading = false;
    }

    private async updateTemplateTab(tabLink: ApiLink) {
        const tabResponse = await this.registry.getByApiLink<TemplateTabApiObject>(tabLink, null, false);
        if (tabResponse == null) {
            return; // cannot update tab
        }

        const tab = tabResponse.data;

        this.hrefToTab.set(tab.self.href, tab);

        let group = this.allGroups.find(group => group.groupKey === tab.location);

        if (group == null) {
            const tabGroup: NavTabGroup = {
                groupKey: tab.location,
                name: tab.location,
                tabs: [],
            };
            this.hrefToTab.forEach(tab => {
                if (tab.groupKey && tabGroup.groupKey === `${tab.location}.${tab.groupKey}`) {
                    tabGroup.name = tab.name;
                    if (tab.icon) {
                        tabGroup.icon = tab.icon;
                    }
                }
            })
            this.allGroups.push(tabGroup);
            if (tabGroup.groupKey === "workspace") {
                this.workspaceGroup = tabGroup;
            } else if (tabGroup.groupKey === "navigation") {
                this.navigationGroup = tabGroup;
            } else if (tabGroup.groupKey === "experiment-navigation") {
                this.experimentNavigationGroup = tabGroup;
            } else if (tabGroup.groupKey.startsWith("navigation")) {
                this.navigationGroups.push(tabGroup);
            } else if (tabGroup.groupKey.startsWith("experiment-navigation")) {
                this.experimentNavigationGroups.push(tabGroup);
            } else {
                this.unknownGroups.push(tabGroup);
            }
            group = tabGroup;
        }

        const newTabs = group.tabs.filter(t => t.href !== tab.self.href);
        newTabs.push(tab.self);
        newTabs.sort((a, b) => {
            // sort by sortKey first
            const keyA = this.hrefToTab.get(a.href)?.sortKey ?? 0;
            const keyB = this.hrefToTab.get(b.href)?.sortKey ?? 0;
            if (keyA < keyB) {
                return -1;
            }
            if (keyA > keyB) {
                return 1;
            }
            // sort by name second
            if (a.name && b.name) {
                if (a.name < b.name) {
                    return -1;
                }
                if (a.name > b.name) {
                    return 1;
                }
            }
            return 0;
        })
        group.tabs = newTabs;

        this.removeOldTemplateTabLinkFromOtherGroups(tabLink);

        if (tab.groupKey) {
            const childGroup = this.allGroups.find(group => group.groupKey === `${tab.location}.${tab.groupKey}`);
            if (childGroup) {
                childGroup.icon = tab.icon;
            }
        }
    }

    private async removeOldTemplateTabLinkFromOtherGroups(tabLink: ApiLink) {
        let hasEmptyGroups = false;
        this.allGroups.forEach(group => {
            if (group.groupKey === tabLink.resourceKey?.["?group"]) {
                // do not remove tab from the group it is currently in!
                return;
            }
            if (group.tabs.some(t => t.href === tabLink.href)) {
                group.tabs = group.tabs.filter(t => t.href !== tabLink.href);
            }
            if (group.tabs.length === 0) {
                hasEmptyGroups = true;
            }
        });
        if (hasEmptyGroups) {
            this.removeEmptyGroups();
        }
    }

    private async removeTemplateTab(tabLink: ApiLink) {
        let hasEmptyGroups = false;
        this.allGroups.forEach(group => {
            if (group.tabs.some(t => t.href === tabLink.href)) {
                group.tabs = group.tabs.filter(t => t.href !== tabLink.href);
            }
            if (group.tabs.length === 0) {
                hasEmptyGroups = true;
            }
        });
        if (hasEmptyGroups) {
            this.removeEmptyGroups();
        }
        this.hrefToTab.delete(tabLink.href);
    }

    private removeEmptyGroups() {
        this.allGroups = this.allGroups.filter(g => g.tabs.length > 0);
        this.navigationGroups = this.navigationGroups.filter(g => g.tabs.length > 0);
        this.experimentNavigationGroups = this.experimentNavigationGroups.filter(g => g.tabs.length > 0);
        this.unknownGroups = this.unknownGroups.filter(g => g.tabs.length > 0);
        if (this.navigationGroup?.tabs?.length === 0) {
            this.navigationGroup = null;
        }
        if (this.workspaceGroup?.tabs?.length === 0) {
            this.workspaceGroup = null;
        }
        if (this.experimentNavigationGroup?.tabs?.length === 0) {
            this.experimentNavigationGroup = null;
        }
    }

    async createNewTab() {
        if (this.createTabLink == null) {
            return;
        }
        if (!this.isValid || !this.newTabData) {
            return;
        }

        this.registry.submitByApiLink(this.createTabLink, this.newTabData);
    }

}
