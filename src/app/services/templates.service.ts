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
import { catchError, map, mergeAll, mergeMap, toArray } from 'rxjs/operators';
import { PluginDescription, PluginsService, QhanaPlugin } from './plugins.service';
import { QhanaBackendService } from './qhana-backend.service';


export interface TemplateDescription {
    name: string;
    description: string;
    identifier: string;
    apiRoot: string;
}

export interface TemplateCategory {
    name: string;
    description: string;
    plugins: QhanaPlugin[];
}

export interface QhanaTemplate {
    name: string;
    description: string;
    categories: TemplateCategory[];
}

interface PluginFilterOr {
    'or': PluginFilterExpr[];
}

interface PluginFilterAnd {
    'and': PluginFilterExpr[];
}

interface PluginFilterNot {
    'not': PluginFilterExpr;
}

type PluginFilterExpr = PluginFilterOr | PluginFilterAnd | PluginFilterNot | string;

interface CategoryDescription {
    name: string;
    description: string;
    pluginFilter: PluginFilterExpr;
}

interface CategoriesResponse {
    categories: CategoryDescription[];
}

function isInstanceOfPluginFilterOr(pluginFilter: PluginFilterExpr): pluginFilter is PluginFilterOr {
    return pluginFilter != null && (pluginFilter as PluginFilterOr).or !== undefined;
}

function isInstanceOfPluginFilterAnd(pluginFilter: PluginFilterExpr): pluginFilter is PluginFilterAnd {
    return pluginFilter != null && (pluginFilter as PluginFilterAnd).and !== undefined;
}

function isInstanceOfPluginFilterNot(pluginFilter: PluginFilterExpr): pluginFilter is PluginFilterNot  {
    return pluginFilter != null && (pluginFilter as PluginFilterNot).not !== undefined;
}

function isInstanceOfString(pluginFilter: PluginFilterExpr): pluginFilter is string {
    return pluginFilter != null && typeof pluginFilter === 'string';
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
    
    pluginFilterMatchesTags(tags: string[], pluginFilter: PluginFilterExpr): boolean {
        if (isInstanceOfPluginFilterOr(pluginFilter)) {
            return pluginFilter.or.reduce<boolean>(
                (res, nestedPluginFilter) => res || this.pluginFilterMatchesTags(tags, nestedPluginFilter),
                false
            )
        } else if (isInstanceOfPluginFilterAnd(pluginFilter)) {
            return pluginFilter.and.reduce<boolean>(
                (res, nestedPluginFilter) => res && this.pluginFilterMatchesTags(tags, nestedPluginFilter),
                true
            )
        } else if (isInstanceOfPluginFilterNot(pluginFilter)) {
            return !this.pluginFilterMatchesTags(tags, pluginFilter.not)
        } else if (isInstanceOfString(pluginFilter)) {
            return tags.includes(pluginFilter)
        } else {
            throw Error(`Unknown plugin filter ${pluginFilter}`)
        }
    }

    loadTemplate(templateDesc: TemplateDescription, pluginList: QhanaPlugin[]): Observable<QhanaTemplate> {
        return this.http.get<CategoriesResponse>(templateDesc.apiRoot).pipe(
            map(categoriesResponse => {
                let categories: TemplateCategory[] = []

                categoriesResponse.categories.forEach(categoryDesc => {
                    let plugins: QhanaPlugin[] = []
                    
                    pluginList.forEach(
                        plugin => {
                            if (this.pluginFilterMatchesTags(plugin.pluginDescription.tags, categoryDesc.pluginFilter)) {
                                plugins.push(plugin)
                            }
                        }
                    )

                    categories.push({
                        name: categoryDesc.name,
                        description: categoryDesc.description,
                        plugins: plugins,
                    })
                });
                    
                return {
                    name: templateDesc.name,
                    description: templateDesc.description,
                    categories: categories,
                    }
            })
        )
    }
}
