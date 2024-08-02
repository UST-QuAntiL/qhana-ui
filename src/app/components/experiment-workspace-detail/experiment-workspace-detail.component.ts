import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { KeyValue } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatChipInputEvent } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { DeleteDialog } from 'src/app/dialogs/delete-dialog/delete-dialog.dialog';
import { ApiLink, CollectionApiObject, PageApiObject } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { ALL_PLUGINS_TEMPLATE_ID, TAB_GROUP_NAME_OVERRIDES, TAB_GROUP_SORT_KEYS, TemplateApiObject, TemplateTabApiObject, TemplatesService } from 'src/app/services/templates.service';

@Component({
    selector: 'qhana-experiment-workspace-detail',
    templateUrl: './experiment-workspace-detail.component.html',
    styleUrls: ['./experiment-workspace-detail.component.sass']
})
export class ExperimentWorkspaceDetailComponent implements OnInit {

    readonly separatorKeysCodes = [ENTER, COMMA] as const;

    tabGroupNameOverrides = { ...TAB_GROUP_NAME_OVERRIDES };

    routeTemplateId: string | null = null;
    defaultTemplateId: string | null = null;
    templateId: string | null = null;
    tabId: string | null = null;

    templateObject: TemplateApiObject | null = null;
    tabObject: TemplateTabApiObject | null = null;

    templateLink: ApiLink | null = null;
    tabLink: ApiLink | null = null;
    templateTabLinks: Array<{ group: string, name: string, tabs: ApiLink[] }> = [];

    templateTabObjects: { [id: string]: TemplateTabApiObject } = {};

    editTemplateName: string | null = null;
    editTemplateDescription: string | null = null;
    editTemplateTags: string[] = [];

    // TODO: add validators
    templateForm: FormGroup = this.fb.group({
        name: ["", Validators.required],
        description: "",
        sortKey: 0,
        filterString: "{}"
    });

    private deletedTemplateSubscription: Subscription | null = null;
    private changedTemplateSubscription: Subscription | null = null;

    private deletedTabSubscription: Subscription | null = null;
    private newTabSubscription: Subscription | null = null;
    private changedTabSubscription: Subscription | null = null;
    private routeParamSubscription: Subscription | null = null;
    private defaultTemplateIdSubscription: Subscription | null = null;

    constructor(private route: ActivatedRoute, private router: Router, private registry: PluginRegistryBaseService, private fb: FormBuilder, private dialog: MatDialog, private templates: TemplatesService) { }

    ngOnInit() {
        this.routeParamSubscription = this.route.queryParamMap.subscribe(async params => {
            let templateId = params.get('template');
            if (templateId === ALL_PLUGINS_TEMPLATE_ID) {
                // treat builtin template as default template for the workspace details
                templateId = null;
            }
            this.routeTemplateId = templateId;

            this.updateTemplateId(templateId ?? this.defaultTemplateId);

            const tabId = params.get('tab');
            if (tabId !== this.tabId) {
                this.tabId = tabId;
                this.templateTabLinks.forEach(group => {
                    const tabLink = group.tabs.find(link => link.resourceKey?.uiTemplateTabId === tabId);
                    if (tabLink != null) {
                        this.tabLink = tabLink;
                        this.updateTabId();
                    }
                });
            }
        });
        this.registerObjectSubscriptions();
    }

    ngOnDestroy() {
        this.deletedTemplateSubscription?.unsubscribe();
        this.changedTemplateSubscription?.unsubscribe();
        this.newTabSubscription?.unsubscribe();
        this.deletedTabSubscription?.unsubscribe();
        this.changedTabSubscription?.unsubscribe();
        this.routeParamSubscription?.unsubscribe();
        this.defaultTemplateIdSubscription?.unsubscribe();
    }

    private sortTabs(tabs: ApiLink[]) {
        return tabs.sort((a, b) => {
            const aSort = this.templateTabObjects[a.resourceKey?.uiTemplateTabId ?? ""]?.sortKey ?? 0;
            const bSort = this.templateTabObjects[b.resourceKey?.uiTemplateTabId ?? ""]?.sortKey ?? 0;
            return aSort - bSort;
        });
    }

    private registerObjectSubscriptions() {
        this.defaultTemplateIdSubscription = this.templates.defaultTemplateId.subscribe(defaultTemplateId => {
            this.defaultTemplateId = defaultTemplateId;

            this.updateTemplateId(this.routeTemplateId ?? this.defaultTemplateId);
        });

        // automatically deselect deleted template
        this.deletedTemplateSubscription = this.registry.deletedApiObjectSubject
            .pipe(filter(deletedObject => deletedObject.deleted.resourceType === "ui-template"))
            .subscribe(deletedObject => {
                if (deletedObject.deleted.resourceKey?.uiTemplateId === this.templateId) {
                    this.templateId = null;
                    this.tabId = null;
                    this.navigateToTab();
                }
            });

        // automatically deselect deleted tab
        this.deletedTabSubscription = this.registry.deletedApiObjectSubject
            .pipe(filter(deletedObject => deletedObject.deleted.resourceType === "ui-template-tab"))
            .subscribe(deletedObject => {
                if (deletedObject.deleted.resourceKey?.uiTemplateTabId === this.tabId) {
                    this.deselectTab(null);
                }
                if (deletedObject.deleted.resourceKey?.uiTemplateTabId && Object.hasOwn(this.templateTabObjects, deletedObject.deleted.resourceKey?.uiTemplateTabId)) {
                    delete this.templateTabObjects[deletedObject.deleted.resourceKey?.uiTemplateTabId];
                    this.templateTabLinks = this.templateTabLinks.map(group => {
                        return {
                            ...group,
                            tabs: group.tabs.filter(link => link.href !== deletedObject.deleted.href),
                        };
                    });
                }
            });

        // automatically select new tab
        this.newTabSubscription = this.registry.newApiObjectSubject
            .pipe(filter(newObject => newObject.new.resourceType === "ui-template-tab" && newObject.new.resourceKey?.uiTemplateId === this.templateId))
            .subscribe(async newObject => {
                const tabId = newObject.new.resourceKey?.uiTemplateTabId;
                const group = newObject.new.resourceKey?.['?group'];
                if (group == null) {
                    console.warn("new tab has no group", newObject.new);
                    return;
                }
                if (tabId != null) {
                    const tab = await this.registry.getByApiLink<TemplateTabApiObject>(newObject.new);
                    if (tab == null) {
                        console.warn("new tab not found", newObject.new);
                        return;
                    }
                    this.templateTabObjects[tabId] = tab?.data;
                    let tabGroup = this.templateTabLinks.find(g => g.group === group);
                    if (tabGroup == null) {
                        tabGroup = {
                            group: group,
                            name: group,
                            tabs: [],
                        };
                    }
                    tabGroup.tabs.push(newObject.new);
                    tabGroup.tabs = this.sortTabs(tabGroup.tabs);
                }
            });

        // update template object if selected template changed
        this.changedTemplateSubscription = this.registry.changedApiObjectSubject
            .pipe(filter(changedObject => changedObject.changed.resourceType === "ui-template" && changedObject.changed.resourceKey?.uiTemplateId === this.templateId))
            .subscribe(async changedObject => {
                const template = await this.registry.getByApiLink<TemplateApiObject>(changedObject.changed);
                this.templateObject = template?.data ?? null;
            });

        // update tab object if selected tab changed
        this.changedTabSubscription = this.registry.changedApiObjectSubject
            .pipe(filter(changedObject => changedObject.changed.resourceType === "ui-template-tab" && changedObject.changed.resourceKey?.uiTemplateId === this.templateId))
            .subscribe(async changedObject => {
                const tabId = changedObject.changed.resourceKey?.uiTemplateTabId;
                const group = changedObject.changed.resourceKey?.['?group'];
                if (tabId != null) {
                    const tab = await this.registry.getByApiLink<TemplateTabApiObject>(changedObject.changed);
                    if (tab == null) {
                        console.warn("changed tab not found", changedObject.changed);
                        return;
                    }
                    this.templateTabObjects[tabId] = tab?.data;
                }
                if (group == null) {
                    console.warn("changed tab has no group", changedObject.changed);
                    return;
                }
                let tabGroup = this.templateTabLinks.find(g => g.group === group);
                if (tabGroup == null) {
                    tabGroup = {
                        group: group,
                        name: group,
                        tabs: [],
                    };
                }
                if (!tabGroup.tabs.includes(changedObject.changed)) {
                    for (const group in this.templateTabLinks) {
                        tabGroup.tabs = tabGroup.tabs.filter(link => link.href !== changedObject.changed.href);
                    }
                    tabGroup.tabs.push(changedObject.changed);
                    this.sortTabs(tabGroup.tabs);
                }
            });
    }

    private async updateTemplateId(templateId: string | null) {
        if (templateId == null || templateId === "") {
            return; // no template selected
        }
        if (templateId === this.templateId) {
            return; // template id did not change
        }
        this.templateId = templateId;
        const query = new URLSearchParams();
        query.set("template-id", templateId);
        const templateResponse = await this.registry.getByRel<PageApiObject>([["ui-template", "collection"]], query, true);
        if (templateResponse?.data?.items?.length === 1) {
            this.templateLink = templateResponse.data.items[0]
        } else {
            console.warn("Template not found");
            return;
        }
        this.templateObject = (await this.templates.getTemplate(templateId))?.data ?? null;
        const groupLinks = await this.templates.getTemplateTabGroups(templateId);
        if (groupLinks == null) {
            console.warn("No group links found");
            return;
        }
        for (const groupLink of groupLinks) {
            const group = groupLink.resourceKey?.["?group"];
            if (group == null) {
                console.warn("No location found: ", groupLink);
                continue;
            }
            const tabsResponse = await this.registry.getByApiLink<CollectionApiObject>(groupLink);
            const tabLinks = tabsResponse?.data?.items ?? [];

            tabsResponse?.data?.items?.forEach(async tabLink => {
                const tab = await this.registry.getByApiLink<TemplateTabApiObject>(tabLink);
                if (tabLink.resourceKey?.uiTemplateTabId && tab?.data) {
                    this.templateTabObjects[tabLink.resourceKey.uiTemplateTabId] = tab?.data;
                }
            });
            this.templateTabLinks.push({
                group: group,
                name: groupLink.name ?? group,
                tabs: tabLinks,
            });
        }
    }

    private async updateTabId() {
        if (this.tabLink == null) {
            return;
        }
        const tab = await this.registry.getByApiLink<TemplateTabApiObject>(this.tabLink);
        this.tabObject = tab?.data ?? null;
        if (this.tabObject != null) {
            this.templateForm.patchValue(this.tabObject);
        }
    }

    private navigateToTab() {
        this.router.navigate([], {
            relativeTo: this.route,
            preserveFragment: true,
            queryParams: {
                plugin: null,
                tab: this.tabId,
            },
            queryParamsHandling: 'merge',
        });
    }

    selectTab(tabId: string) {
        this.tabId = tabId;
        const id = tabId === 'new' ? "new-template-panel" : "tab-" + tabId;
        this.navigateToTab();
        const elmnt = document.getElementById(id);
        if (elmnt) {
            elmnt.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        }
    }

    deselectTab(tabId: string | null) {
        if (tabId !== this.tabId) {
            return;
        }
        this.tabId = 'null';
        this.navigateToTab();
    }

    editTemplate() {
        this.editTemplateName = this.templateObject?.name ?? null;
        this.editTemplateDescription = this.templateObject?.description ?? null;
        this.editTemplateTags = [...this.templateObject?.tags ?? []];
    }

    cancelEditTemplate() {
        this.editTemplateName = null;
        this.editTemplateDescription = null;
        this.editTemplateTags = [];
    }

    addTag(event: MatChipInputEvent) {
        const value = event.value;
        if (!value || this.editTemplateTags?.includes(value)) {
            return;
        }
        this.editTemplateTags?.push(value);
        event.chipInput!.clear();
    }

    removeTag(tag: string) {
        const index = this.editTemplateTags.indexOf(tag);
        if (index !== undefined && index > -1) {
            this.editTemplateTags.splice(index, 1);
        }
    }

    async deleteTemplate() {
        if (this.templateLink == null) {
            return;
        }
        const itemResponse = await this.registry.getByApiLink(this.templateLink, null, false);
        const deleteLink = itemResponse?.links?.find(link => link.rel.some(rel => rel === "delete")) ?? null;

        if (deleteLink == null) {
            console.info(`Cannot delete ApiObject ${this.templateLink}. No delete link found!`);
            return; // cannot delete!
        }

        const dialogRef = this.dialog.open(DeleteDialog, {
            data: this.templateLink,
        });

        const doDelete = await dialogRef.afterClosed().toPromise();
        if (doDelete) {
            this.registry.submitByApiLink(deleteLink);
        }
    }

    async updateTemplate() {
        if (this.templateLink == null) {
            console.warn("No template selected");
            return;
        }
        const response = await this.registry.getByApiLink<TemplateApiObject>(this.templateLink);
        const updateLink = response?.links?.find(link => link.rel.some(rel => rel === "update") && link.resourceType == "ui-template") ?? null;

        if (updateLink) {
            this.registry.submitByApiLink<TemplateApiObject>(updateLink, {
                name: this.editTemplateName,
                description: this.editTemplateDescription,
                tags: this.editTemplateTags
            });
        }

        this.cancelEditTemplate();
    }

    tabOrder = (a: KeyValue<string, ApiLink[]>, b: KeyValue<string, ApiLink[]>): number => {
        const aGroupBase = a.key.split(".", 1)[0];
        const bGroupBase = b.key.split(".", 1)[0];
        const aSortKey = TAB_GROUP_SORT_KEYS[aGroupBase] ?? 0;
        const bSortKey = TAB_GROUP_SORT_KEYS[bGroupBase] ?? 0;
        return aSortKey - bSortKey;
    }

    trackByTabLink = (index: number, group: { group: string }) => group.group;
}
