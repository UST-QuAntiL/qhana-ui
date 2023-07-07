import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { DeleteDialog } from 'src/app/dialogs/delete-dialog/delete-dialog.dialog';
import { ApiLink, CollectionApiObject, PageApiObject } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateTabApiObject, TemplatesService } from 'src/app/services/templates.service';
import { TemplateApiObject } from 'src/app/services/templates.service';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatChipInputEvent } from '@angular/material/chips';
import { Subscription } from 'rxjs';
import { TAB_GROUP_NAME_OVERRIDES, TAB_GROUP_SORT_KEYS } from 'src/app/services/templates.service';
import { KeyValue } from '@angular/common';

@Component({
    selector: 'qhana-experiment-workspace-detail',
    templateUrl: './experiment-workspace-detail.component.html',
    styleUrls: ['./experiment-workspace-detail.component.sass']
})
export class ExperimentWorkspaceDetailComponent implements OnInit {

    readonly separatorKeysCodes = [ENTER, COMMA] as const;

    templateId: string | null = null;
    tabId: string | null = null;

    templateObject: TemplateApiObject | null = null;
    tabObject: TemplateTabApiObject | null = null;

    templateLink: ApiLink | null = null;
    tabLink: ApiLink | null = null;
    templateTabLinks: { [group: string]: ApiLink[] } = {};

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

    constructor(private route: ActivatedRoute, private router: Router, private registry: PluginRegistryBaseService, private fb: FormBuilder, private dialog: MatDialog, private templates: TemplatesService) { }

    ngOnInit() {
        this.routeParamSubscription = this.route.queryParamMap.subscribe(async params => {
            const templateId = params.get('template');
            const tabId = params.get('tab');

            if (templateId && templateId !== this.templateId) {
                this.updateTemplateId(templateId);
            }
            if (tabId !== this.tabId) {
                this.tabId = tabId;
                for (const tabLinks of Object.values(this.templateTabLinks)) {
                    const tabLink = tabLinks.find(link => link.resourceKey?.uiTemplateTabId === tabId);
                    if (tabLink != null) {
                        this.tabLink = tabLink;
                        this.updateTabId();
                        break;
                    }
                }
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
    }

    private sortTabs(group: string) {
        this.templateTabLinks[group].sort((a, b) => {
            const aSort = this.templateTabObjects[a.resourceKey?.uiTemplateTabId ?? ""]?.sortKey ?? 0;
            const bSort = this.templateTabObjects[b.resourceKey?.uiTemplateTabId ?? ""]?.sortKey ?? 0;
            return aSort - bSort;
        });
    }

    private registerObjectSubscriptions() {
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
                    for (const group in this.templateTabLinks) {
                        this.templateTabLinks[group] = this.templateTabLinks[group].filter(link => link.href !== deletedObject.deleted.href);
                    }
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
                    if (this.templateTabLinks[group] == null) {
                        this.templateTabLinks[group] = [];
                    }
                    this.templateTabLinks[group].push(newObject.new);
                    this.sortTabs(group);
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
                if (!Object.hasOwn(this.templateTabLinks, group)) {
                    this.templateTabLinks[group] = [];
                }
                if (!this.templateTabLinks[group].includes(changedObject.changed)) {
                    for (const group in this.templateTabLinks) {
                        this.templateTabLinks[group] = this.templateTabLinks[group].filter(link => link.href !== changedObject.changed.href);
                    }
                    this.templateTabLinks[group].push(changedObject.changed);
                    this.sortTabs(group);
                }
            });
    }

    private async updateTemplateId(templateId: string) {
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
            this.templateTabLinks[group] = tabLinks;
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
                template: this.templateId,
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

    getTabName(group: string): string {
        return TAB_GROUP_NAME_OVERRIDES[group] ?? group;
    }

    tabOrder = (a: KeyValue<string, ApiLink[]>, b: KeyValue<string, ApiLink[]>): number => {
        const aSortKey = TAB_GROUP_SORT_KEYS[a.key] ?? 0;
        const bSortKey = TAB_GROUP_SORT_KEYS[b.key] ?? 0;
        return aSortKey - bSortKey;
    }
}
