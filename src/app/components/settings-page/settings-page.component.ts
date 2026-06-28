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

import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiLink } from 'src/app/services/api-data-types';
import { EnvApiObject, isEnvApiObject } from 'src/app/services/env.service';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { isServiceApiObject, ServiceApiObject, ServiceRegistryService } from 'src/app/services/service-registry.service';

@Component({
    selector: 'qhana-settings-page',
    templateUrl: './settings-page.component.html',
    styleUrls: ['./settings-page.component.sass'],
    standalone: false
})
export class SettingsPageComponent implements OnInit, OnDestroy {

    registryUrl: string;

    protocol: string | null = null;
    hostname: string | null = null;
    port: string | null = null;
    path: string | null = null;

    backendUrl: string | null = null;
    latexUrl: string | null = null;

    // service form
    currentServiceUpdateLink: ApiLink | null = null;
    highlightedServices: Set<string> = new Set();
    serviceIdentifier: string | null = null;
    serviceUrl: string | null = null;
    serviceName: string | null = null;
    serviceDescriptionInput: string = "";
    serviceDescription: string | null = null;

    // seed form
    newSeedUrl: string | null = null;

    // env var form
    currentEnvVarUpdateLink: ApiLink | null = null;
    highlightedEnvVars: Set<string> = new Set();
    envVarName: string | null = null;
    envVarValue: string | null = null;


    createServiceLink: ApiLink | null = null;
    createSeedLink: ApiLink | null = null;
    createEnvVarLink: ApiLink | null = null;

    private backendUrlSubscription: Subscription | null = null;
    private latexUrlSubscription: Subscription | null = null;

    constructor(private registry: PluginRegistryBaseService, private serviceRegistry: ServiceRegistryService) {
        this.registryUrl = registry.registryRootUrl;
    }

    ngOnInit(): void {
        this.backendUrlSubscription = this.serviceRegistry.backendRootUrl.subscribe(url => this.backendUrl = url);
        this.latexUrlSubscription = this.serviceRegistry.latexRendererUrl.subscribe(url => this.latexUrl = url);
        this.updateCreateUrls();
    }

    ngOnDestroy(): void {
        this.backendUrlSubscription?.unsubscribe();
        this.latexUrlSubscription?.unsubscribe();
    }

    private async updateCreateUrls() {
        try {
            this.createServiceLink = await this.registry.searchResolveRels(["create", "service"]);
        } catch (error) {
            console.warn(error)
            this.createServiceLink = null;
        }
        try {
            this.createSeedLink = await this.registry.searchResolveRels(["create", "seed"]);
        } catch {
            this.createSeedLink = null;
        }
        try {
            this.createEnvVarLink = await this.registry.searchResolveRels(["create", "env"]);
        } catch {
            this.createEnvVarLink = null;
        }
    }

    updateRegistryUrl() {
        let protocol: string | null | undefined = this.protocol;
        if (protocol != null && protocol !== "") {
            if (protocol.startsWith("https")) {
                protocol = "https:";
            } else {
                protocol = "http:";
            }
        } else {
            protocol = undefined;
        }
        const hostname = this.hostname ? this.hostname : undefined;
        const port = this.port ? this.port : undefined;
        const path = this.path ? this.path : undefined;
        this.registry.changeRegistryUrl(protocol, hostname, port, path);
        this.registryUrl = this.registry.registryRootUrl;
    }

    async selectService(link: ApiLink) {
        if (this.highlightedServices.has(link.href)) {
            this.highlightedServices.clear();
            this.currentServiceUpdateLink = null;
            this.serviceName = "";
            this.serviceIdentifier = "";
            this.serviceUrl = "";
            this.serviceDescriptionInput = "";
            return;
        }
        const serviceResponse = await this.registry.getByApiLink(link);
        if (serviceResponse == null) {
            return;
        }

        const updateLink = serviceResponse.links.find(link => link.rel.some(rel => rel === "update")) || null;

        if (!isServiceApiObject(serviceResponse.data)) {
            return;
        }

        const serviceApiObject: ServiceApiObject = serviceResponse?.data;

        this.serviceIdentifier = serviceApiObject.serviceId;
        this.serviceUrl = serviceApiObject.url;
        this.serviceName = serviceApiObject.name;
        this.serviceDescriptionInput = serviceApiObject.description;

        this.highlightedServices.clear();
        this.highlightedServices.add(link.href);
        this.currentServiceUpdateLink = updateLink;
    }

    async addService() {
        const createLink = this.createServiceLink;
        if (createLink == null) {
            return;
        }
        // TODO validate inputs
        await this.registry.submitByApiLink(createLink, {
            serviceId: this.serviceIdentifier,
            url: this.serviceUrl,
            name: this.serviceName,
            description: this.serviceDescription,
        });
        this.serviceName = "";
        this.serviceIdentifier = "";
        this.serviceUrl = "";
        this.serviceDescriptionInput = "";
    }

    updateService() {
        const updateLink = this.currentServiceUpdateLink;
        if (updateLink == null) {
            return;
        }
        // TODO validate inputs
        this.registry.submitByApiLink(updateLink, {
            serviceId: this.serviceIdentifier,
            url: this.serviceUrl,
            name: this.serviceName,
            description: this.serviceDescription,
        });
    }

    addSeedUrl() {
        const createLink = this.createSeedLink;
        const endpointUrl = this.newSeedUrl;
        if (createLink == null || endpointUrl == null) {
            return;
        }
        this.registry.submitByApiLink(createLink, {
            url: endpointUrl,
        });
    }

    async selectEnvVar(link: ApiLink) {
        if (this.highlightedEnvVars.has(link.href)) {
            this.highlightedEnvVars.clear();
            this.currentEnvVarUpdateLink = null;
            this.envVarName = "";
            this.envVarValue = "";
            return;
        }
        const envResponse = await this.registry.getByApiLink(link);
        if (envResponse == null) {
            return;
        }

        const updateLink = envResponse.links.find(link => link.rel.some(rel => rel === "update")) || null;

        if (!isEnvApiObject(envResponse.data)) {
            return;
        }

        const envApiObject: EnvApiObject = envResponse?.data;

        this.envVarName = envApiObject.name;
        this.envVarValue = envApiObject.value;

        this.highlightedEnvVars.clear();
        this.highlightedEnvVars.add(link.href);
        this.currentEnvVarUpdateLink = updateLink;
    }

    async addEnvVar() {
        const createLink = this.createEnvVarLink;
        if (createLink == null) {
            return;
        }
        // TODO validate inputs
        await this.registry.submitByApiLink(createLink, {
            name: this.envVarName,
            value: this.envVarValue,
        });
        this.envVarName = "";
        this.envVarValue = "";
    }

    updateEnvVar() {
        const updateLink = this.currentEnvVarUpdateLink;
        if (updateLink == null) {
            return;
        }

        // TODO validate inputs
        this.registry.submitByApiLink(updateLink, {
            name: this.envVarName,
            value: this.envVarValue,
        });
    }
}
