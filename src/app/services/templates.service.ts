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
import { BehaviorSubject, from, Observable } from 'rxjs';
import { catchError, mergeAll, mergeMap, toArray, map } from 'rxjs/operators';
import { PluginDescription, PluginsService, QhanaPlugin } from './plugins.service';
import { QhanaBackendService } from './qhana-backend.service';


export interface TemplateDescription {
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

interface TemplateCategory {
    name: string;
    description: string;
    plugins: PluginDescription[];
}

interface CategoriesResponse {
    categories: TemplateCategory[]
}

@Injectable({
    providedIn: 'root'
})
export class TemplatesService {
    private loading: boolean = false;
    private templatesSubject: BehaviorSubject<TemplateDescription[]> = new BehaviorSubject<TemplateDescription[]>([]);

    get templates() {
        return this.templatesSubject.asObservable();
    }

    constructor(private http: HttpClient, private backend: QhanaBackendService, private pluginsService: PluginsService) { }

    loadTemplates() {
        if (this.loading) {
            return;
        }
        this.loading = true;
        this.pluginsService.loadPlugins();

        this.backend.getPluginEndpoints().subscribe(pluginEndpoints => {
            var observables: Observable<TemplateDescription>[] = [];
            pluginEndpoints.items.map(pluginEndpoint => {
                if (pluginEndpoint.type === "PluginRunner") {
                    observables.push(this.http.get<{ templates: TemplateDescription[] }>(`${pluginEndpoint.url}/templates`).pipe(
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

    loadTemplate(templateDesc: TemplateDescription): Observable<QhanaTemplate> {
        return this.http.get<CategoriesResponse>(templateDesc.apiRoot).pipe(
            map(
                categoriesResponse => {
                    return  {
                        name: templateDesc.name,
                        description: templateDesc.description,
                        categories: categoriesResponse.categories,
                    }
                }
            )
        )
    }
}
