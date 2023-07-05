/*
 * Copyright 2021 University of Stuttgart
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
import { Component, Input, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { ApiLink, CollectionApiObject } from 'src/app/services/api-data-types';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { DownloadsService } from 'src/app/services/downloads.service';
import { ExportResult, QhanaBackendService } from 'src/app/services/qhana-backend.service';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateApiObject, TemplatesService } from 'src/app/services/templates.service';

@Component({
    selector: 'qhana-navbar',
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.sass']
})
export class NavbarComponent implements OnInit, OnDestroy {

    @Input() title: string = "";

    currentExperiment: Observable<string | null>;
    experimentId: Observable<string | null>;
    downloadBadgeCounter: Observable<number> | null = null;

    exportList: Observable<ExportResult[] | null> | null = null;
    error: string | null = null;

    generalExtraTabsGroupLink: ApiLink | null = null;
    generalExtraTabs: ApiLink[] = [];

    experimentExtraTabsGroupLink: ApiLink | null = null;
    experimentExtraTabs: ApiLink[] = [];

    extraTabs: ApiLink[] = [];

    templateId: string | null = null;
    template: TemplateApiObject | null = null;

    private defaultTemplateIdSubscription: Subscription | null = null;
    private defaultTemplateSubscription: Subscription | null = null;
    private templateTabUpdatesSubscription: Subscription | null = null;

    constructor(private route: ActivatedRoute, private experiment: CurrentExperimentService, private templates: TemplatesService, private registry: PluginRegistryBaseService, private backend: QhanaBackendService, private downloadService: DownloadsService) {
        this.currentExperiment = this.experiment.experimentName;
        this.experimentId = this.experiment.experimentId;
    }

    ngOnInit(): void {
        this.registerSubscriptions();
        this.downloadBadgeCounter = this.downloadService.getDownloadsCounter();
        this.exportList = this.downloadService.getExportList();
    }

    ngOnDestroy(): void {
        this.defaultTemplateIdSubscription?.unsubscribe();
        this.defaultTemplateSubscription?.unsubscribe();
        this.templateTabUpdatesSubscription?.unsubscribe();
    }

    private registerSubscriptions() {
        this.defaultTemplateIdSubscription = this.templates.currentTemplateId.subscribe(templateId => this.templateId = templateId);
        this.defaultTemplateSubscription = this.templates.currentTemplate.subscribe(template => {
            this.onTemplateChanges(template);
        });
        this.templateTabUpdatesSubscription = this.templates.currentTemplateTabsUpdates.subscribe(() => {
            this.updateGeneralExtraTabGroup();
            this.updateExperimentExtraTabGroup();
        });
    }

    trackExport: TrackByFunction<ExportResult> = (index, item) => item.exportId.toString();

    deleteExport(experimentId: number, exportId: number) {
        this.backend.deleteExport(experimentId, exportId).subscribe(() => console.log());
    }

    exportListIsEmpty() {
        return this.downloadBadgeCounter?.subscribe();
    }

    private async onTemplateChanges(template: TemplateApiObject | null) {
        if (template == null) {
            this.extraTabs = [];
            return;
        }
        const experimentNavGroup = template.groups.find(group => group.resourceKey?.["?group"] === "experiment-navigation") ?? null;
        const experimentTabsLinkChanged = this.experimentExtraTabsGroupLink?.href !== experimentNavGroup?.href;
        this.experimentExtraTabsGroupLink = experimentNavGroup;

        const generalNavGroup = template.groups.find(group => group.resourceKey?.["?group"] === "navigation") ?? null;
        const generalTabsLinkChanged = this.generalExtraTabsGroupLink?.href !== generalNavGroup?.href;
        this.generalExtraTabsGroupLink = generalNavGroup;

        if (experimentTabsLinkChanged) {
            this.updateExperimentExtraTabGroup();
        }
        if (generalTabsLinkChanged) {
            this.updateGeneralExtraTabGroup();
        }
    }

    private async updateExperimentExtraTabGroup() {
        const groupLink = this.experimentExtraTabsGroupLink;
        if (groupLink == null) {
            this.experimentExtraTabs = [];
            this.experimentExtraTabsGroupLink = null;
            this.updateExtraTabs();
            return;
        }

        const groupResponse = await this.registry.getByApiLink<CollectionApiObject>(groupLink, null, true);

        const extraTabs: ApiLink[] = [];

        groupResponse?.data?.items?.forEach(tab => extraTabs.push(tab));

        this.experimentExtraTabs = extraTabs;
        this.updateExtraTabs();
    }

    private async updateGeneralExtraTabGroup() {
        const groupLink = this.generalExtraTabsGroupLink;
        if (groupLink == null) {
            this.generalExtraTabs = [];
            this.generalExtraTabsGroupLink = null;
            this.updateExtraTabs();
            return;
        }

        const groupResponse = await this.registry.getByApiLink<CollectionApiObject>(groupLink, null, true);

        const extraTabs: ApiLink[] = [];

        groupResponse?.data?.items?.forEach(tab => extraTabs.push(tab));

        this.generalExtraTabs = extraTabs;
        this.updateExtraTabs();
    }

    private updateExtraTabs() {
        this.experimentId.subscribe(experimentId => {
            if (experimentId != null) {
                // only show experiment navigation tabs if an experiment is active
                this.extraTabs = this.experimentExtraTabs;
            } else {
                this.extraTabs = this.generalExtraTabs;
            }
        });
    }
}
