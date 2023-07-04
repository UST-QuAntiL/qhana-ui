/*
 * Copyright 2023 University of Stuttgart
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiLink } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplatesService } from 'src/app/services/templates.service';


export const TAB_GROUP_SORT_KEYS: { [group: string]: number } = {
    "DEFAULT": 10000,
    "workspace": 10,
    "experiment-navigation": 20,
}

export const TAB_GROUP_NAME_OVERRIDES: { [group: string]: string } = {
    "workspace": "Workspace Tabs (Sidebar)",
    "experiment-navigation": "Experiment Navigation Tabs",
}

@Component({
    selector: 'qhana-tab-group-list',
    templateUrl: './tab-group-list.component.html',
    styleUrls: ['./tab-group-list.component.sass']
})
export class TabGroupListComponent implements OnChanges, OnInit, OnDestroy {

    @Input() templateId: string | null = null;
    @Input() selectedTab: string | number | null = null;

    @Output() clickedOnTab: EventEmitter<ApiLink | null> = new EventEmitter(true);

    private newObjectsSubscription: Subscription | null = null;
    private changedObjectsSubscritions: Subscription | null = null;
    private deletedObjectsSubscription: Subscription | null = null;

    tabGroups: ApiLink[] = []

    highlightedTemplateTabs: Set<string> = new Set();

    constructor(private templates: TemplatesService, private registry: PluginRegistryBaseService) { }

    ngOnInit(): void {
        this.newObjectsSubscription = this.registry.newApiObjectSubject.subscribe(newApiObject => {
            if (newApiObject.new.resourceType === "ui-template-tab") {
                if (newApiObject.new.resourceKey?.uiTemplateId === this.templateId) {
                    this.reloadTabGroups(this.templateId);
                }
            }
        });
        this.changedObjectsSubscritions = this.registry.changedApiObjectSubject.subscribe(changedApiObject => {
            if (changedApiObject.changed.resourceType === "ui-template-tab" || changedApiObject.changed.resourceType === "ui-template") {
                if (changedApiObject.changed.resourceKey?.uiTemplateId === this.templateId) {
                    this.reloadTabGroups(this.templateId);
                }
            }
        });
        this.deletedObjectsSubscription = this.registry.deletedApiObjectSubject.subscribe(deletedApiObject => {
            if (deletedApiObject.deleted.resourceType === "ui-template-tab") {
                if (deletedApiObject.deleted.resourceKey?.uiTemplateId === this.templateId) {
                    this.reloadTabGroups(this.templateId);
                }
            }
            if (deletedApiObject.deleted.resourceType === "ui-template") {
                if (deletedApiObject.deleted.resourceKey?.uiTemplateId === this.templateId) {
                    this.reloadTabGroups(null);
                }
            }
        });
    }

    ngOnDestroy(): void {
        this.newObjectsSubscription?.unsubscribe();
        this.changedObjectsSubscritions?.unsubscribe();
        this.deletedObjectsSubscription?.unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.selectedTab != null) {
            this.highlightedTemplateTabs.clear();
            if (this.selectedTab != null) {
                this.highlightedTemplateTabs.add(this.selectedTab.toString());
            }
        }
        if (changes.templateId) {
            this.reloadTabGroups(this.templateId);
        }
    }

    private async reloadTabGroups(templateId: string | null, ignoreCache: boolean = false) {
        if (templateId == null) {
            this.tabGroups = [];
            return;
        }

        const tabGroups = await this.templates.getTemplateTabGroups(templateId, ignoreCache);
        tabGroups.sort((groupA, groupB) => {
            const defaultSort = TAB_GROUP_SORT_KEYS["DEFAULT"];
            const a = TAB_GROUP_SORT_KEYS[groupA.resourceKey?.["?group"] ?? "DEFAULT"] ?? defaultSort;
            const b = TAB_GROUP_SORT_KEYS[groupB.resourceKey?.["?group"] ?? "DEFAULT"] ?? defaultSort;
            if (a !== b) {
                return a - b;
            }
            const nameA = this.getTabName(groupA, groupA.href);
            const nameB = this.getTabName(groupB, groupB.href);
            if (nameA < nameB) {
                return -1;
            }
            if (nameA > nameB) {
                return 1;
            }
            return 0;
        });
        this.tabGroups = tabGroups;
    }


    trackByHref(index: number, apiLink: ApiLink): string {
        return apiLink.href;
    }

    getTabName(tabGroupLink: ApiLink, fallback: string = ""): string {
        const group = tabGroupLink.resourceKey?.['?group'];
        if (group != null) {
            const override = TAB_GROUP_NAME_OVERRIDES[group];
            if (override != null) {
                return override;
            }
        }
        return tabGroupLink.name ?? group ?? fallback;
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

    selectTab(tabLink: ApiLink | null) {
        this.clickedOnTab.emit(tabLink);
    }

}
