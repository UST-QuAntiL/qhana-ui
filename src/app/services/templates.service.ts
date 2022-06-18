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

export interface QhanaTemplate {
    name: string;
    description: string;
    categories: TemplateCategory[];
}

interface QhanaTemplateDescription {
    name: string;
    description: string;
    identifier: string;
    apiRoot: string;
}

interface QhanaTemplateInfo {
    name: string;
    description: string;
    categories: TemplateCategoryInfo[];
}

interface TemplateCategoryInfo {
    name: string;
    description: string;
    plugins: PluginDescription[];
}

interface TemplateCategory {
    name: string;
    description: string;
    plugins: Observable<QhanaPlugin[]>;
}

@Injectable({
    providedIn: 'root'
})
export class TemplatesService {
    private loading: boolean = false;
    private templatesSubject: BehaviorSubject<QhanaTemplate[]> = new BehaviorSubject<QhanaTemplate[]>([]);

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
            var observables: Observable<QhanaTemplate>[] = [];
            pluginEndpoints.items.map(pluginEndpoint => {
                if (pluginEndpoint.type === "PluginRunner") {
                    observables.push(this.http.get<{ templates: QhanaTemplateDescription[] }>(`${pluginEndpoint.url}/templates`).pipe(
                        mergeMap(templateResponse => from(templateResponse.templates)),
                        mergeMap(template => {
                            return this.loadTemplate(template);
                        }),
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

    loadTemplate(templateInfo: QhanaTemplateDescription): Observable<QhanaTemplate> {
        return this.http.get<QhanaTemplateInfo>(templateInfo.apiRoot).pipe(
            map(template => {
                return {
                    name: templateInfo.name,
                    description: templateInfo.description,
                    categories: template.categories.map(
                        category => {
                            return {
                                name: category.name,
                                description: category.description,
                                plugins: this.pluginsService.plugins.pipe(
                                    map(
                                        pluginList => pluginList.filter(plugin => category.plugins.map(p => p.identifier).includes(`${plugin.metadata.name}@${plugin.metadata.version.replaceAll('.', '-')}`))
                                    )
                                )
                            }
                        }
                    )
                }
            }),
        )
    }
}
