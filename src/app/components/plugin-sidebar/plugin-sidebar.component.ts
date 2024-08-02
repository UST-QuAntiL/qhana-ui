import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ChangeUiTemplateDialog } from 'src/app/dialogs/change-ui-template/change-ui-template.dialog';
import { DeleteDialog } from 'src/app/dialogs/delete-dialog/delete-dialog.dialog';
import { ApiLink, ApiResponse, CollectionApiObject, PageApiObject } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { ALL_PLUGINS_TEMPLATE_ID, TemplateApiObject, TemplateTabApiObject, TemplatesService } from 'src/app/services/templates.service';


export interface PluginGroup {
    name: string;
    description?: string;
    key: string;
    icon?: string | null;
    open: boolean;
    link: ApiLink;
    query?: URLSearchParams;
}


@Component({
    selector: 'qhana-plugin-sidebar',
    templateUrl: './plugin-sidebar.component.html',
    styleUrls: ['./plugin-sidebar.component.sass']
})
export class PluginSidebarComponent implements OnInit, OnDestroy {
    sidebarOpen: boolean = false;

    activeArea: 'search' | 'templates' | 'detail' | 'plugins' = 'search';

    activeGroup: PluginGroup | null = null;

    selectedTemplate: ApiLink | null = null;
    selectedTemplateName: string | "All Plugins" = "All Plugins";
    workspaceTabsLink: ApiLink | null = null;

    highlightedTemplates: Set<string> = new Set();

    highlightedPlugins: Set<string> = new Set();

    defaultPluginGroups: PluginGroup[] = [];

    defaultTemplate: TemplateApiObject | null = null;

    pluginGroups: PluginGroup[] = this.defaultPluginGroups;

    defaultTemplateId: string | null = null;

    // route params
    useExternalDefaultTemplate: boolean = true; // if true, use default templates from registry
    templateId: string | null = null;
    pluginId: string | null = null;
    tabId: string | null = null;

    private routeParamSubscription: Subscription | null = null;
    private newTabSubscription: Subscription | null = null;
    private changedTabSubscription: Subscription | null = null;
    private deletedTabSubscription: Subscription | null = null;
    private changedTemplateSubscription: Subscription | null = null;
    private defaultTemplateIdSubscription: Subscription | null = null;
    private defaultTemplateSubscription: Subscription | null = null;

    get routeTemplateId(): string | null {
        if (!this.useExternalDefaultTemplate) {
            // use the builtin template if the external template id is null
            // and external default templates should not be used
            return this.templateId ?? ALL_PLUGINS_TEMPLATE_ID;
        }
        return this.templateId;
    }

    @ViewChild('searchInput', { static: true }) searchInput: ElementRef<HTMLInputElement> | null = null;

    @ViewChild('sidebar', { static: true }) sidebar: ElementRef<HTMLDivElement> | null = null;

    constructor(private route: ActivatedRoute, private router: Router, private templates: TemplatesService, private registry: PluginRegistryBaseService, private dialog: MatDialog) { }

    ngOnInit(): void {
        this.routeParamSubscription = this.route.queryParamMap.subscribe(params => {
            let templateId = params.get('template');
            let templateChanged = false;
            if (templateId === ALL_PLUGINS_TEMPLATE_ID) {
                templateChanged = this.useExternalDefaultTemplate;
                this.useExternalDefaultTemplate = false;
                templateId = null;
            } else {
                templateChanged = (!this.useExternalDefaultTemplate) || (templateId !== this.routeTemplateId);
                this.useExternalDefaultTemplate = true;
                this.templateId = templateId;
            }
            if (templateChanged) {
                const searchField = this.searchInput?.nativeElement;
                if (searchField != null) {
                    searchField.value = "";
                }
            }
            this.pluginId = params.get('plugin');
            this.tabId = params.get('tab');
            if (this.templateId != null) {
                this.highlightedTemplates = new Set<string>([this.templateId]);
            } else {
                this.highlightedTemplates.clear();
            }
            if (this.pluginId != null) {
                this.highlightedPlugins = new Set<string>([this.pluginId]);
            } else {
                this.highlightedPlugins.clear();
            }
            if (this.tabId != null) {
                if (this.activeArea !== "detail") {
                    this.switchActiveArea("detail");
                }
            } else {
                if (this.activeArea === "detail") {
                    this.switchActiveArea("plugins");
                }
            }
            if (this.routeTemplateId != ALL_PLUGINS_TEMPLATE_ID) {
                this.loadActiveTemplateFromId(this.templateId ?? this.defaultTemplateId);
            }
        });

        this.registry.resolveRecursiveRels([["plugin", "collection"]]).then((apiLink) => {
            const pluginTypes = [
                ["dataloader", "Dataloader Plugins", "downloading"],
                ["processing", "Processing Plugins", "calculate"],
                ["conversion", "Conversion Plugins", "swap_horiz"],
                ["visualization", "Visualization Plugins", "preview"],
                ["interaction", "Interaction Plugins", "web_asset"]
            ];
            const defaultPlugins: PluginGroup[] = [];
            pluginTypes.forEach(([pluginType, name, icon]) => {
                const query = new URLSearchParams();
                query.set("type", pluginType)
                defaultPlugins.push({
                    name: name,
                    key: pluginType,
                    open: true,
                    link: apiLink,
                    icon: icon ?? null,
                    query: query,
                });
            });
            this.defaultPluginGroups.push(...defaultPlugins);
        });

        this.defaultTemplateIdSubscription = this.templates.defaultTemplateId.subscribe(defaultTemplateId => {
            this.defaultTemplateId = defaultTemplateId;
        });

        this.defaultTemplateSubscription = this.templates.defaultTemplate.subscribe(template => {
            this.defaultTemplate = template;
            if (this.templateId == null && this.useExternalDefaultTemplate) {
                this.switchActiveTemplateLink(template?.self ?? null);
            }
        });

        this.registerObjectSubscriptions();
    }

    ngOnDestroy(): void {
        this.routeParamSubscription?.unsubscribe();
        this.newTabSubscription?.unsubscribe();
        this.changedTabSubscription?.unsubscribe();
        this.deletedTabSubscription?.unsubscribe();
        this.changedTemplateSubscription?.unsubscribe();
        this.defaultTemplateIdSubscription?.unsubscribe();
        this.defaultTemplateSubscription?.unsubscribe();
    }

    private async handleNewTemplateTab(newTabLink: ApiLink) {
        if (this.workspaceTabsLink == null && this.selectedTemplate != null) {
            if (newTabLink.resourceKey?.uiTemplateId == null) {
                console.warn("New tab has no uiTemplateId", newTabLink);
                return;
            }
            const tabGroups = await this.templates.getTemplateTabGroups(newTabLink.resourceKey?.uiTemplateId);
            const workspaceGroupLink = tabGroups.find(group => group.resourceKey?.["?group"] === "workspace");
            this.workspaceTabsLink = workspaceGroupLink ?? null;
        }
        // add plugins to corresponding group
        const tabResponse = await this.registry.getByApiLink<TemplateTabApiObject>(newTabLink);
        if (tabResponse) {
            this.pluginGroups.push({
                name: tabResponse.data.name,
                key: tabResponse.data.self.href,
                open: false,
                description: tabResponse.data.description,
                link: tabResponse.data.plugins,
            });
        }
        // select new tab
        if (this.activeArea === "detail" && this.templateId === newTabLink.resourceKey?.uiTemplateId && this.tabId === 'new') {
            this.selectTab(newTabLink);
        }
    }

    private registerObjectSubscriptions() {
        // handle new template tabs
        this.newTabSubscription = this.registry.newApiObjectSubject
            .pipe(filter(newObject => newObject.new.resourceType === "ui-template-tab" && newObject.new.resourceKey?.uiTemplateId === this.templateId))
            .subscribe(async newObject => {
                this.handleNewTemplateTab(newObject.new);
            });

        // update plugins in template tabs after changes
        this.changedTabSubscription = this.registry.changedApiObjectSubject
            .pipe(filter(changedObject => changedObject.changed.resourceType === "ui-template-tab" && changedObject.changed.resourceKey?.uiTemplateId === this.templateId))
            .subscribe(async changedObject => {
                const tabId = changedObject.changed.resourceKey?.uiTemplateTabId ?? null;
                const tabIndex = this.pluginGroups.findIndex(group => group.link.resourceKey?.['?template-tab'] === tabId);
                this.pluginGroups[tabIndex] = { ...this.pluginGroups[tabIndex] };
                const tabResponse = await this.registry.getByApiLink<TemplateTabApiObject>(changedObject.changed);
                if (tabResponse == null) {
                    console.warn("Could not load template tab", changedObject.changed);
                    return;
                }
                if (tabIndex < 0) {
                    this.pluginGroups.push({
                        name: tabResponse.data.name,
                        key: tabResponse.data.self.href,
                        open: false,
                        description: tabResponse.data.description,
                        link: tabResponse.data.plugins,
                    });
                } else {
                    this.pluginGroups[tabIndex].name = tabResponse.data.name;
                    this.pluginGroups[tabIndex].description = tabResponse.data.description;
                }
                if (tabResponse.data.location !== 'workspace') {
                    this.pluginGroups.splice(tabIndex, 1);
                }
            });

        // romove deleted template tabs
        this.deletedTabSubscription = this.registry.deletedApiObjectSubject
            .pipe(filter(deletedObject => deletedObject.deleted.resourceType === "ui-template-tab" && deletedObject.deleted.resourceKey?.uiTemplateId === this.templateId))
            .subscribe(deletedObject => {
                this.pluginGroups = this.pluginGroups.filter(group => group.link.resourceKey?.['?template-tab'] !== deletedObject.deleted.resourceKey?.uiTemplateTabId);
            });

        // update template name in sidebar
        this.changedTemplateSubscription = this.registry.changedApiObjectSubject
            .pipe(filter(changedObject => changedObject.changed.resourceType === "ui-template" && this.templateId !== changedObject.changed.resourceKey?.uiTemplateId))
            .subscribe(changedObject => {
                this.selectedTemplateName = changedObject.changed.name ?? "Unknown";
            });
    }

    private async loadActiveTemplateFromId(newTemplateId: string | null) {
        if (newTemplateId == null) {
            this.switchActiveTemplateLink(null);
            return;
        }
        const activeTemplateId = this.selectedTemplate?.resourceKey?.uiTemplateId ?? null;
        if (newTemplateId === activeTemplateId) {
            // nothing to do, link already loaded
            return;
        }
        // need to fetch template api link from plugin registry
        this.pluginGroups = []; // hide default plugin groups while template is loading
        const query = new URLSearchParams();
        query.set("template-id", newTemplateId);
        const templatePage = await this.registry.getByRel<PageApiObject>([["ui-template", "collection"]], query, true);
        if (templatePage?.data.collectionSize === 1) {
            // only expect one template since IDs are unique
            this.switchActiveTemplateLink(templatePage.data.items[0]);
        } else {
            console.warn(`Template API returned an ambiguous response for template id ${this.templateId}`, templatePage);
        }
    }

    private switchActiveTemplateLink(activeTemplate: ApiLink | null, useExternalDefaultTemplate?: boolean) {
        useExternalDefaultTemplate = useExternalDefaultTemplate ?? this.useExternalDefaultTemplate;
        if (activeTemplate == null) {
            if (useExternalDefaultTemplate && this.defaultTemplate != null) {
                activeTemplate = this.defaultTemplate.self;
            } else {
                this.selectedTemplate = null;
                this.selectedTemplateName = "All Plugins";
                this.activeArea = "plugins";
                this.pluginGroups = this.defaultPluginGroups;
                return;
            }
        }
        const tabId = this.route.snapshot.queryParamMap.get('tab');
        this.selectedTemplate = activeTemplate;
        this.selectedTemplateName = activeTemplate.name ?? "Unknown";
        this.activeArea = tabId ? "detail" : "plugins";
        this.loadPluginTemplate(activeTemplate);
    }

    private async loadPluginTemplate(activeTemplate: ApiLink) {
        if (activeTemplate.resourceKey?.uiTemplateId == null) {
            console.warn("No template id found in template link", activeTemplate);
            return;
        }
        const pluginGroups: PluginGroup[] = [];
        this.pluginGroups = pluginGroups;
        const tabGroups = await this.templates.getTemplateTabGroups(activeTemplate.resourceKey?.uiTemplateId);
        const workspaceGroupLink = tabGroups.find(group => group.resourceKey?.["?group"] === "workspace");
        this.workspaceTabsLink = workspaceGroupLink ?? null;
        if (workspaceGroupLink == null) {
            return;
        }
        const tabsResponse = await this.registry.getByApiLink<CollectionApiObject>(workspaceGroupLink);
        const tabLinks = tabsResponse?.data?.items ?? [];
        const tabPromises = tabLinks.map(link => this.registry.getByApiLink<TemplateTabApiObject>(link));
        const tabs = await Promise.all(tabPromises);
        const sortedTabs = tabs
            .filter(t => t != null)
            .sort((a, b) => (a?.data?.sortKey ?? 0) - (b?.data?.sortKey ?? 0)) as ApiResponse<TemplateTabApiObject>[];
        sortedTabs.forEach(tab => {
            pluginGroups.push({
                name: tab.data.name,
                key: tab.data.self.href,
                open: true,
                description: tab.data.description,
                link: tab.data.plugins,
            });
        });
    }

    getTabFilter(groupLink: ApiLink) {
        return (tabLink: ApiLink): boolean => {
            if (tabLink.resourceKey == null) {
                return false;
            }
            if (tabLink.resourceKey?.["?group"] !== groupLink.resourceKey?.["?group"]) {
                return false;
            }
            if (tabLink.resourceKey?.templateId !== groupLink.resourceKey?.templateId) {
                return false;
            }
            return true;
        }
    }

    private navigate(template: string | null = null, plugin: string | null = null, tab: string | null = null) {
        let templateChanged = false;
        if (template === ALL_PLUGINS_TEMPLATE_ID) {
            templateChanged = this.useExternalDefaultTemplate;
            this.useExternalDefaultTemplate = false;
            this.templateId = null;
        } else {
            templateChanged = (!this.useExternalDefaultTemplate) || (template !== this.routeTemplateId);
            this.useExternalDefaultTemplate = true;
            this.templateId = template;
        }
        if (templateChanged) {
            const searchField = this.searchInput?.nativeElement;
            if (searchField != null) {
                searchField.value = "";
            }
        }
        this.pluginId = plugin;
        this.tabId = tab;
        this.router.navigate([], {
            relativeTo: this.route,
            preserveFragment: true,
            queryParams: {
                template: template,
                plugin: plugin,
                tab: tab,
            },
            queryParamsHandling: 'merge',
        });
    }

    switchActiveArea(newArea: 'search' | 'detail' | 'templates' | 'plugins', group?: PluginGroup) {
        if (this.activeArea === newArea && this.sidebarOpen) {
            // potentially close sidebar
            if (this.activeArea !== 'plugins' || this.activeGroup === group) {
                // only close sidebar if the active button has not changed
                this.sidebarOpen = false;
                return;
            }
        }

        if (this.activeArea === 'detail' && newArea !== 'detail') {
            this.navigate(this.routeTemplateId, this.pluginId, null);
        } else if (this.activeArea !== 'detail' && newArea === 'detail') {
            this.navigate(this.routeTemplateId, null, this.tabId ?? 'new');
        }

        this.sidebarOpen = true;
        this.activeArea = newArea;
        this.activeGroup = group ?? null;

        if (group != null) {
            group.open = true;
            this.scrollGroupIntoView(group);
        }

        if (newArea === "search") {
            // set focus on search field
            this.searchInput?.nativeElement?.focus();
        }
    }

    scrollGroupIntoView(group: PluginGroup) {
        const groupElement = this.sidebar?.nativeElement?.querySelector<HTMLDetailsElement>(`[data-group="${group.key}"]`);
        if (groupElement) {
            window.requestIdleCallback(() => {
                groupElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }

    togglePluginGroup(group: PluginGroup, event: Event) {
        event.preventDefault();
        const newState = !group.open;
        group.open = newState;
        if (newState === true) {
            this.switchActiveArea("plugins", group);
        } else {
            this.switchActiveArea("plugins");
        }
    }

    toggleTemplateHeader(event: Event) {
        event?.preventDefault();
        if (this.activeArea === "templates") {
            this.switchActiveArea("plugins");
        } else {
            this.switchActiveArea("templates");
        }
    }

    selectTemplate(templateLink: ApiLink | null, specialTemplateId: (typeof ALL_PLUGINS_TEMPLATE_ID) | null = null) {
        this.switchActiveTemplateLink(templateLink, specialTemplateId == null);
        if (templateLink == null) {
            this.navigate(specialTemplateId, null, null);
            return;
        }
        this.navigate(templateLink.resourceKey?.uiTemplateId ?? null, null, null);
    }

    selectPlugin(pluginLink: ApiLink) {
        let pluginId = pluginLink.resourceKey?.pluginId ?? null;
        if (pluginId != null) {
            if (this.pluginId != null && this.pluginId === pluginId) {
                // double click deselects plugin
                pluginId = null;
            }
            this.navigate(this.routeTemplateId, pluginId, null);
        }
        this.activeArea = "plugins";
        this.sidebarOpen = pluginId == null; // always close sidebar after successfully selecting plugin
    }

    selectTab(tabLink: ApiLink | null) {
        let templateId = this.templateId;
        let tabId: string | null = 'null';

        if (tabLink != null) {
            templateId = tabLink.resourceKey?.uiTemplateId ?? null;
            if (tabLink.resourceKey?.uiTemplateTabId !== this.tabId) {
                tabId = tabLink.resourceKey?.uiTemplateTabId ?? null;
            }
            if ((this.templateId ?? this.defaultTemplateId) !== templateId) {
                this.templateId = templateId;
                console.warn("The template id in the given link does not match the selected template id!", tabLink);
            }
        }
        this.navigate(this.routeTemplateId, null, tabId);
    }

    async createTemplate() {
        const dialogRef = this.dialog.open(ChangeUiTemplateDialog, { data: { template: null }, minWidth: "20rem", maxWidth: "40rem", width: "60%" });
        const templateData: TemplateApiObject = await dialogRef.afterClosed().toPromise();

        if (!templateData) {
            return;
        }
        this.templates.addTemplate(templateData);
    }

    async deleteSelectedTemplate() {
        if (this.selectedTemplate == null) {
            return;
        }
        const itemResponse = await this.registry.getByApiLink(this.selectedTemplate, null, false);
        const deleteLink = itemResponse?.links?.find(link => link.rel.some(rel => rel === "delete")) ?? null;

        if (deleteLink == null) {
            console.info(`Cannot delete ApiObject ${this.selectedTemplate}. No delete link found!`);
            return; // cannot delete!
        }

        const dialogRef = this.dialog.open(DeleteDialog, {
            data: this.selectedTemplate,
        });

        const doDelete = await dialogRef.afterClosed().toPromise();
        if (doDelete) {
            this.registry.submitByApiLink(deleteLink);
        }

        this.selectTemplate(null);
    }
}
