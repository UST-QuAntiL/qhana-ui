/*
 * Copyright 2022 University of Stuttgart
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

import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Subscription, combineLatest } from 'rxjs';
import { ApiLink, ApiObject, PageApiObject } from './api-data-types';
import { CurrentExperimentService } from './current-experiment.service';
import { PluginRegistryBaseService } from './registry.service';
import { EnvService } from './env.service';
import { distinctUntilChanged } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';


export interface TemplateApiObject extends ApiObject {  // TODO check fields
    name: string;
    description: string;
    tags: string[];
    groups: ApiLink[];
}


export interface TemplateTabApiObject extends ApiObject {  // TODO check fields
    name: string;
    description: string;
    sortKey: number;
    filterString: string;
    location: string;
    plugins: ApiLink;
}

export const TAB_GROUP_SORT_KEYS: { [group: string]: number } = {
    "DEFAULT": 10000,
    "workspace": 10,
    "experiment-navigation": 20,
    "navigation": 30,
}

export const TAB_GROUP_NAME_OVERRIDES: { [group: string]: string } = {
    "workspace": "Workspace Tabs (Sidebar)",
    "experiment-navigation": "Experiment Navigation Tabs",
    "navigation": "Navigation Tabs",
}


@Injectable({
    providedIn: 'root'
})
export class TemplatesService {

    private envSubscription: Subscription | null = null;
    private currentExperimentSubscription: Subscription | null = null;
    private routeSubscription: Subscription | null = null;
    private newObjectsSubscription: Subscription | null = null;
    private changedObjectsSubscritions: Subscription | null = null;
    private deletedObjectsSubscription: Subscription | null = null;

    private envTemplateIdSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
    private experimentTemplateIdSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
    private routeTemplateIdSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

    private defaultTemplateIdSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
    private currentTemplateIdSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

    private defaultTemplateTabsUpdatesSubject: Subject<void> = new Subject();
    private currentTemplateTabsUpdatesSubject: Subject<void> = new Subject();

    private defaultTemplateSubject: BehaviorSubject<TemplateApiObject | null> = new BehaviorSubject<TemplateApiObject | null>(null);
    private currentTemplateSubject: BehaviorSubject<TemplateApiObject | null> = new BehaviorSubject<TemplateApiObject | null>(null);

    get defaultTemplateId() {
        return this.defaultTemplateIdSubject.asObservable();
    }

    get currentTemplateId() {
        return this.currentTemplateIdSubject.asObservable();
    }

    get defaultTemplateTabsUpdates() {
        return this.defaultTemplateTabsUpdatesSubject.asObservable();
    }

    get currentTemplateTabsUpdates() {
        return this.currentTemplateTabsUpdatesSubject.asObservable();
    }

    get defaultTemplate() {
        return this.defaultTemplateSubject.asObservable();
    }

    get currentTemplate() {
        return this.currentTemplateSubject.asObservable();
    }

    constructor(private registry: PluginRegistryBaseService, private env: EnvService, private currentExperiment: CurrentExperimentService, private route: ActivatedRoute) {
        this.envSubscription = env.uiTemplateId.subscribe((defaultTemplateId) => {
            this.envTemplateIdSubject.next(defaultTemplateId);
        });
        this.currentExperimentSubscription = currentExperiment.experiment.subscribe(experiment => {
            this.experimentTemplateIdSubject.next(experiment?.templateId?.toString() ?? null);
        });
        this.routeSubscription = this.route.queryParamMap.subscribe(params => {
            const templateId = params.get('template');
            this.routeTemplateIdSubject.next(templateId ?? null);
        });

        // handle updates to ids:
        combineLatest([
            this.envTemplateIdSubject.asObservable().pipe(distinctUntilChanged()),
            this.experimentTemplateIdSubject.asObservable().pipe(distinctUntilChanged()),
            this.routeTemplateIdSubject.asObservable().pipe(distinctUntilChanged()),
        ]).subscribe(([envTemplateId, experimentTemplateId, routeTemplateId]) => {
            //TODO
            if (routeTemplateId != null) {
                if (routeTemplateId === "all-plugins") {
                    // allow overriding the default templates using a special template id
                    this.currentTemplateIdSubject.next(null);
                    this.defaultTemplateIdSubject.next(experimentTemplateId ?? envTemplateId ?? null);
                    return;
                }
                this.currentTemplateIdSubject.next(routeTemplateId);
                this.defaultTemplateIdSubject.next(experimentTemplateId ?? envTemplateId ?? null);
                return;
            }
            if (experimentTemplateId != null) {
                this.currentTemplateIdSubject.next(experimentTemplateId);
                this.defaultTemplateIdSubject.next(experimentTemplateId);
                return;
            }
            if (envTemplateId != null) {
                this.currentTemplateIdSubject.next(envTemplateId);
                this.defaultTemplateIdSubject.next(envTemplateId);
                return;
            }
            this.currentTemplateIdSubject.next(null);
            this.defaultTemplateIdSubject.next(null);
        });

        // update default and current template
        this.defaultTemplateIdSubject.pipe(distinctUntilChanged()).subscribe(defaultTemplateId => {
            this.updateDefaultTemplate(defaultTemplateId);
        });
        this.currentTemplateIdSubject.pipe(distinctUntilChanged()).subscribe(currentTemplateId => {
            this.updateCurrentTemplate(currentTemplateId);
        });


        // subscribe to changes to create tab group changed signals
        this.newObjectsSubscription = this.registry.newApiObjectSubject.subscribe(newApiObject => {
            if (newApiObject.new.resourceType === "ui-template-tab") {
                this.handlePotentialTabUpdates(newApiObject.new);
            }
        });
        this.changedObjectsSubscritions = this.registry.changedApiObjectSubject.subscribe(changedApiObject => {
            if (changedApiObject.changed.resourceType === "ui-template-tab" || changedApiObject.changed.resourceType === "ui-template") {
                this.handlePotentialTabUpdates(changedApiObject.changed);
            }
        });
        this.deletedObjectsSubscription = this.registry.deletedApiObjectSubject.subscribe(deletedApiObject => {
            if (deletedApiObject.deleted.resourceType === "ui-template-tab") {
                this.handlePotentialTabUpdates(deletedApiObject.deleted);
            }
            if (deletedApiObject.deleted.resourceType === "ui-template") {
                // TODO
                //if (deletedApiObject.deleted.resourceKey?.uiTemplateId === this.templateId) {
                //    this.reloadTabGroups(null);
                //}
            }
        });
    }

    private handlePotentialTabUpdates(apiLink: ApiLink) {
        const templateId = apiLink.resourceKey?.uiTemplateId;
        if (templateId === this.defaultTemplateIdSubject.getValue()) {
            this.defaultTemplateTabsUpdatesSubject.next();
        }
        if (templateId === this.currentTemplateIdSubject.getValue()) {
            this.currentTemplateTabsUpdatesSubject.next();
        }
    }

    private updateDefaultTemplate(templateId: string | null) {
        this.updateTemplate(templateId, this.defaultTemplateSubject);
    }

    private updateCurrentTemplate(templateId: string | null) {
        this.updateTemplate(templateId, this.currentTemplateSubject);
    }

    private async updateTemplate(templateId: string | null, subject: BehaviorSubject<TemplateApiObject | null>) {
        if (templateId == null) {
            subject.next(null);
            return;
        }

        const templateResponse = await this.getTemplate(templateId);
        subject.next(templateResponse?.data ?? null);
    }

    async addTemplate(newTemplate: TemplateApiObject) {
        const createLink = await this.registry.searchResolveRels(["create", "ui-template"]);
        return this.registry.submitByApiLink<TemplateApiObject>(createLink, newTemplate);
    }

    async getTemplate(templateId: string, ignoreCache: boolean | "ignore-embedded" = true) {
        const query = new URLSearchParams();
        query.set("template-id", templateId.toString());
        const templatePage = await this.registry.getByRel<PageApiObject>([["ui-template", "collection"]], query, ignoreCache);
        if (templatePage?.data.collectionSize === 1) {
            // only expect one template since IDs are unique
            return await this.registry.getByApiLink<TemplateApiObject>(templatePage.data.items[0], null, false);
        } else {
            console.warn(`Template API returned an ambiguous response for template id ${templateId}`, templatePage);
            return null;
        }
    }

    async getTemplateTabGroups(templateId: string, ignoreCache: boolean | "ignore-embedded" = false) {
        const templateResponse = await this.getTemplate(templateId, ignoreCache);
        return templateResponse?.data?.groups ?? [];
    }
}
