import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { TemplateApiObject, TemplateTabApiObject } from 'src/app/services/templates.service';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { ApiLink, CollectionApiObject } from 'src/app/services/api-data-types';

interface NavTabGroup {
    groupKey: string;
    name: string;
    icon?: string | null;
    tabs: ApiLink[];
}


@Component({
    selector: 'qhana-ui-template-tab-list',
    templateUrl: './ui-template-tab-list.component.html',
    styleUrl: './ui-template-tab-list.component.sass'
})
export class UiTemplateTabListComponent implements OnInit, OnChanges, OnDestroy {

    @Input() templateLink: ApiLink | null = null;

    navigationGroup: NavTabGroup | null = null;
    workspaceGroup: NavTabGroup | null = null;
    experimentNavigationGroup: NavTabGroup | null = null;
    navigationGroups: NavTabGroup[] = [];
    experimentNavigationGroups: NavTabGroup[] = [];
    unknownGroups: NavTabGroup[] = [];

    private allGroups: NavTabGroup[] = [];

    hrefToTab: Map<string, TemplateTabApiObject> = new Map();

    private newTabsSubscription: Subscription | null = null;
    private changedTabsSubscription: Subscription | null = null;
    private deletedTabsSubscription: Subscription | null = null;

    constructor(private registry: PluginRegistryBaseService, private dialog: MatDialog) { }

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
            return;
        }
        const templateResponse = await this.registry.getByApiLink<TemplateApiObject>(this.templateLink, null, false);
        if (templateResponse == null) {
            this.hrefToTab = new Map();
            this.workspaceGroup = null;
            this.navigationGroup = null;
            this.experimentNavigationGroup = null;
            this.navigationGroups = [];
            this.experimentNavigationGroups = [];
            this.unknownGroups = [];
            return;
        }

        const hrefToTab = new Map<string, TemplateTabApiObject>();

        const tabPromises: Promise<unknown>[] = [];

        let navGroup: NavTabGroup | null = null;
        let workspace: NavTabGroup | null = null;
        let expNavGroup: NavTabGroup | null = null;
        const navGroups: NavTabGroup[] = [];
        const expNavGroups: NavTabGroup[] = [];
        const unknownGroups: NavTabGroup[] = [];

        const allGroups: NavTabGroup[] = [];

        const groupIcons = new Map<string, string>();

        const groupPromises = templateResponse.data.groups.map(async (group) => {
            const groupResponse = await this.registry.getByApiLink<CollectionApiObject>(group);

            // fetch tab data
            groupResponse?.data?.items?.forEach?.(tabLink => {
                const prom = this.registry.getByApiLink<TemplateTabApiObject>(tabLink).then(tab => {
                    if (tab) {
                        hrefToTab.set(tab.data.self.href, tab.data);
                        if (tab.data.groupKey && tab.data.icon) {
                            groupIcons.set(`${tab.data.location}.${tab.data.groupKey}`, tab.data.icon);
                        }
                    }
                });
                tabPromises.push(prom);
            });

            const tabGroup: NavTabGroup = {
                groupKey: group.resourceKey?.["?group"] ?? "unknwon",
                name: group.name ?? "UNNAMED",
                tabs: groupResponse?.data?.items ?? [],
            };

            allGroups.push(tabGroup);

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

        await Promise.allSettled(tabPromises);
        await Promise.allSettled(groupPromises);

        navGroups.forEach(g => {
            g.icon = groupIcons.get(g.groupKey);
        });
        expNavGroups.forEach(g => {
            g.icon = groupIcons.get(g.groupKey);
        });
        unknownGroups.forEach(g => {
            g.icon = groupIcons.get(g.groupKey);
        });

        this.hrefToTab = hrefToTab;
        this.navigationGroup = navGroup;
        this.workspaceGroup = workspace;
        this.experimentNavigationGroup = expNavGroup;
        this.navigationGroups = navGroups;
        this.experimentNavigationGroups = expNavGroups;
        this.unknownGroups = unknownGroups;
        this.allGroups = allGroups;
    }

    private async updateTemplateTab(tabLink: ApiLink) {
        const tabResponse = await this.registry.getByApiLink<TemplateTabApiObject>(tabLink, null, false);
        if (tabResponse == null) {
            return; // cannot update tab
        }

        const groupLink = tabResponse.links.find(link => {
            return link.resourceType === "ui-template-tab" && link.rel.some(r => r === "collection") && link.resourceKey?.["?group"];
        }) ?? null;

        const tab = tabResponse.data;

        this.hrefToTab.set(tab.self.href, tab);

        if (tab.location === "workspace") {
            this.workspaceGroup = this.updateTabInGroup(this.workspaceGroup, tabLink, groupLink);
        } else if (tab.location === "navigation") {
            this.navigationGroup = this.updateTabInGroup(this.navigationGroup, tabLink, groupLink);
        } else if (tab.location === "experiment-navigation") {
            this.experimentNavigationGroup = this.updateTabInGroup(this.experimentNavigationGroup, tabLink, groupLink);
        } else if (tab.location.startsWith("navigation")) {
            if (this.navigationGroups.some(g => g.groupKey === tab.location)) {
                this.navigationGroups.map(g => {
                    if (g.groupKey === tab.location) {
                        return this.updateTabInGroup(g, tabLink, groupLink);
                    }
                    return g;
                })
            } else {
                this.navigationGroups.push(this.updateTabInGroup(null, tabLink, groupLink))
            }
        } else if (tab.location.startsWith("experiment-navigation")) {
            if (this.experimentNavigationGroups.some(g => g.groupKey === tab.location)) {
                this.experimentNavigationGroups.map(g => {
                    if (g.groupKey === tab.location) {
                        return this.updateTabInGroup(g, tabLink, groupLink);
                    }
                    return g;
                })
            } else {
                this.experimentNavigationGroups.push(this.updateTabInGroup(null, tabLink, groupLink))
            }
        } else {
            if (this.unknownGroups.some(g => g.groupKey === tab.location)) {
                this.unknownGroups.map(g => {
                    if (g.groupKey === tab.location) {
                        return this.updateTabInGroup(g, tabLink, groupLink);
                    }
                    return g;
                })
            } else {
                this.unknownGroups.push(this.updateTabInGroup(null, tabLink, groupLink))
            }
        }

        this.removeOldTemplateTabLinkFromOtherGroups(tabLink);
    }

    private updateTabInGroup(group: NavTabGroup | null, tab: ApiLink, groupLink: ApiLink | null) {
        if (group == null) {
            if (groupLink != null) {
                group = {
                    groupKey: groupLink.resourceKey?.["?group"] ?? "unknwon",
                    name: groupLink.name ?? "UNNAMED",
                    tabs: [],
                }
            } else {
                group = {
                    groupKey: tab.resourceKey?.["?group"] ?? "unknwon",
                    name: tab.resourceKey?.["?group"] ?? "UNNAMED",
                    tabs: [],
                }
            }
            group.icon = this.getGroupIcon(group.groupKey);
            this.allGroups.push(group);
        }
        if (group.tabs.some(t => t.href === tab.href)) {
            group.tabs.map(t => {
                if (t.href === tab.href) {
                    return tab;  // insert new
                }
                return t;  // keep original
            });
        } else {
            group.tabs.push(tab);
        }
        return group;
    }

    private getGroupIcon(groupLocation: string) {
        let icon: string | null = null;
        this.hrefToTab.forEach((tab) => {
            if (tab.groupKey && groupLocation.startsWith(tab.location)) {
                if (groupLocation === `${tab.location}.${tab.groupKey}`) {
                    icon = tab.icon;
                }
            }
        });
        return icon;
    }

    private async removeOldTemplateTabLinkFromOtherGroups(tabLink: ApiLink) {
        let hasEmptyGroups = false;
        this.allGroups.forEach(group => {
            if (group.groupKey === tabLink.resourceKey?.["?group"]) {
                // do not remove tab from the group it is currently in!
                return;
            }
            if (group.tabs.some(t => t.href === tabLink.href)) {
                group.tabs = group.tabs.filter(t => t.href !== t.href);
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
                group.tabs = group.tabs.filter(t => t.href !== t.href);
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

}
