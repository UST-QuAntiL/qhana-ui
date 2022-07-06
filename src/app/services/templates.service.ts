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
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { catchError, map, mergeAll, mergeMap, toArray } from 'rxjs/operators';
import { PluginDescription, QhanaPlugin } from './plugins.service';
import { QhanaBackendService } from './qhana-backend.service';

export interface TemplateCategory {
    name: string;
    description: string;
    plugins: Observable<QhanaPlugin[]>;
}

export interface QhanaTemplate {
    name: string;
    description: string;
    categories: TemplateCategory[];
    templateDescription: TemplateDescription;
}

interface CategoryDescription {
    name: string;
    description: string;
    pluginFilter: PluginFilterExpr;
}

export interface TemplateDescription {
    name: string;
    description: string;
    identifier: string;
    categories: CategoryDescription[];
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

type PluginFilterExpr = PluginFilterOr | PluginFilterAnd | PluginFilterNot | string | boolean;

@Injectable({
    providedIn: 'root'
})
export class TemplatesService {
    private loading: boolean = false;
    private templatesSubject: BehaviorSubject<TemplateDescription[]> = new BehaviorSubject<TemplateDescription[]>([]);

    get templates() {
        return this.templatesSubject.asObservable();
    }
    
    getTemplate(templateId: string) {
        return this.templatesSubject.pipe(map(templateList => templateList.find(t => t.identifier === templateId) ?? null));
    }

    constructor(private http: HttpClient, private backend: QhanaBackendService) { }

    loadTemplates() {
        if (this.loading) {
            return;
        }
        this.loading = true;

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
            
            observables.push(of({
                name: 'All Plugins',
                description: 'Display All Loaded Plugins',
                identifier: 'allPlugins',
                categories: [
                    {
                        name: 'All Plugins',
                        description: 'Display All Loaded Plugins',
                        pluginFilter: true,
                    }
                ]
            }))

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

function isInstanceOfBoolean(pluginFilter: PluginFilterExpr): pluginFilter is boolean {
    return pluginFilter != null && typeof pluginFilter === 'boolean';
}
    
export function pluginMatchesFilter(pluginDesc: PluginDescription, pluginFilter: PluginFilterExpr): boolean {
    if (isInstanceOfPluginFilterOr(pluginFilter)) {
        return pluginFilter.or.reduce<boolean>(
            (res, nestedPluginFilter) => res || pluginMatchesFilter(pluginDesc, nestedPluginFilter),
            false,
        );
    } else if (isInstanceOfPluginFilterAnd(pluginFilter)) {
        return pluginFilter.and.reduce<boolean>(
            (res, nestedPluginFilter) => res && pluginMatchesFilter(pluginDesc, nestedPluginFilter),
            true,
        );
    } else if (isInstanceOfPluginFilterNot(pluginFilter)) {
        return !pluginMatchesFilter(pluginDesc, pluginFilter.not);
    } else if (isInstanceOfString(pluginFilter)) {
        return pluginDesc.tags.includes(pluginFilter) || pluginFilter === pluginDesc.identifier;
    } else if (isInstanceOfBoolean(pluginFilter)) {
        return pluginFilter;
    } else {
        throw Error(`Unknown plugin filter ${pluginFilter}`);
    }
}
