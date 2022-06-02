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

import { Component, OnInit } from '@angular/core';
import { take } from 'rxjs/operators';
import { PluginEndpointApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-settings-page',
    templateUrl: './settings-page.component.html',
    styleUrls: ['./settings-page.component.sass']
})
export class SettingsPageComponent implements OnInit {

    backendUrl: string;
    protocol: string | null = null;
    hostname: string | null = null;
    port: string | null = null;
    path: string | null = null;

    latexUrl: string;
    latexProtocol: string | null = null;
    latexHostname: string | null = null;
    latexPort: string | null = null;
    latexPath: string | null = null;

    endpoints: PluginEndpointApiObject[] = [];
    endpointUrl: string | null = null;
    endpointType: string | null = "PluginRunner";

    constructor(private backend: QhanaBackendService) {
        this.backendUrl = backend.backendRootUrl;
        this.latexUrl = backend.latexRendererUrl;
    }

    ngOnInit(): void {
        this.refreshEndpointList();
    }

    refreshEndpointList() {
        this.backend.getPluginEndpoints()
            .pipe(take(1))
            .subscribe(endpoints => this.endpoints = endpoints.items);
    }

    updateBackendUrl() {
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
        this.backend.changeBackendUrl(protocol, hostname, port, path);
        this.backendUrl = this.backend.backendRootUrl;
    }

    updateLatexUrl() {
        let protocol: string | null | undefined = this.latexProtocol;
        if (protocol != null && protocol !== "") {
            if (protocol.startsWith("https")) {
                protocol = "https:";
            } else {
                protocol = "http:";
            }
        } else {
            protocol = undefined;
        }
        const hostname = this.latexHostname ? this.latexHostname : undefined;
        const port = this.latexPort ? this.latexPort : undefined;
        const path = this.latexPath ? this.latexPath : undefined;
        this.backend.changeLatexUrl(protocol, hostname, port, path);
        this.latexUrl = this.backend.latexRendererUrl;
    }

    removePluginEndpoint(endpoint: PluginEndpointApiObject) {
        this.backend.removePluginEndpoint(endpoint).subscribe(() => {
            this.refreshEndpointList();
        });
    }

    addPluginEndpoint() {
        const url = this.endpointUrl?.trim();
        const type = this.endpointType ? this.endpointType : undefined;
        if (url) {
            this.backend.addPluginEndpoint(url, type).subscribe(() => {
                this.refreshEndpointList();
            });
        }
    }

}
