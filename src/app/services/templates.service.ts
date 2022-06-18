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

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable} from 'rxjs';
import { catchError, mergeAll, mergeMap, toArray } from 'rxjs/operators';
import { PluginDescription, QhanaPlugin } from './plugins.service';
import { QhanaBackendService } from './qhana-backend.service';

export interface QhanaTemplateInfo {
    name: string;
    description: string;
    identifier: string;
    apiRoot: string;
}

export interface QhanaTemplate {
    name: string;
    description: string;
    categories: TemplateCategory[];
}

export interface TemplateCategory {
    name: string;
    description: string;
    plugins: PluginDescription[];
}

@Injectable({
    providedIn: 'root'
})

export class TemplatesService {
    private loading: boolean = false;
    private templatesSubject: BehaviorSubject<QhanaTemplateInfo[]> = new BehaviorSubject<QhanaTemplateInfo[]>([]);

    get templates() {
        return this.templatesSubject.asObservable();
    }

    constructor(private http: HttpClient, private backend: QhanaBackendService) { }

    loadTemplates() {
        if (this.loading) {
            return;
        }
        this.loading = true;

        this.backend.getPluginEndpoints().subscribe(pluginEndpoints => {
            var observables: Observable<QhanaTemplateInfo>[] = [];
            pluginEndpoints.items.map(pluginEndpoint => {
                if (pluginEndpoint.type === "PluginRunner") {
                    observables.push(this.http.get<{ templates: QhanaTemplateInfo[] }>(`${pluginEndpoint.url}/templates`).pipe(
                        mergeMap(templateResponse => from(templateResponse.templates)),
                        catchError(err => {
                            console.log(err);
                            return [];
                        })
                    ))
                }
            });

            from(observables).pipe(
                mergeAll(),
                toArray(),
            ).subscribe(templates => {
                templates.sort((a, b) => {
                    if (a.name > b.name) {
                        return 1;
                    }
                    if (a.name < b.name) {
                        return -1;
                    }
                    return 0;
                })
                this.templatesSubject.next(templates);
                this.loading = false;
            });
        })
    }
    
    loadTemplate(templateInfo: QhanaTemplateInfo): Observable<QhanaTemplate> {
        return this.http.get<QhanaTemplate>(templateInfo.apiRoot)
    }
}
