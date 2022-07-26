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

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { catchError, map, mergeAll, mergeMap, toArray } from 'rxjs/operators';
import { PluginDescription, QhanaPlugin } from './plugins.service';
import { QhanaBackendService } from './qhana-backend.service';

/*
 * These two interfaces hold the information of templates.
 */

export interface TemplateCategory {
    name: string;
    description: string;
    identifier: string;
    plugins: Observable<QhanaPlugin[]>;
}

export interface QhanaTemplate {
    name: string;
    description: string;
    categories: TemplateCategory[];
    templateDescription: TemplateDescription;
}

/*
 * These two interfaces hold the information from which actual templates are built.
 */

export interface CategoryDescription {
    name: string;
    description: string;
    identifier: string;
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
                identifier: 'all-plugins',
                categories: [
                    {
                        name: 'All Plugins',
                        description: 'Display All Loaded Plugins',
                        identifier: 'all-plugins',
                        pluginFilter: true,
                    }
                ]
            }))

            from(observables).pipe(
                mergeAll(),
                toArray(),
            ).subscribe(templates => {
                templates.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
                this.templatesSubject.next(templates);
                this.loading = false;
            });
        })
    }
}

function isInstanceOfPluginFilterOr(pluginFilter: PluginFilterExpr): pluginFilter is PluginFilterOr {
    if (pluginFilter != null) {
        const _or = (pluginFilter as PluginFilterOr).or;
        return _or != null && Array.isArray(_or);
    }
    return false;
}

function isInstanceOfPluginFilterAnd(pluginFilter: PluginFilterExpr): pluginFilter is PluginFilterAnd {
    if (pluginFilter != null) {
        const _and = (pluginFilter as PluginFilterAnd).and;
        return _and != null && Array.isArray(_and);
    }
    return false;
}

function isInstanceOfPluginFilterNot(pluginFilter: PluginFilterExpr): pluginFilter is PluginFilterNot {
    if (pluginFilter != null) {
        const _not = (pluginFilter as PluginFilterNot).not;
        return _not != null && isInstanceOfPluginFilter(_not);
    }
    return false;
}

function isInstanceOfString(pluginFilter: PluginFilterExpr): pluginFilter is string {
    return pluginFilter != null && typeof pluginFilter === 'string';
}

function isInstanceOfBoolean(pluginFilter: PluginFilterExpr): pluginFilter is boolean {
    return pluginFilter != null && typeof pluginFilter === 'boolean';
}

function isInstanceOfPluginFilter(pluginFilter: PluginFilterExpr): pluginFilter is PluginFilterExpr {
    return isInstanceOfPluginFilterOr(pluginFilter)
        || isInstanceOfPluginFilterAnd(pluginFilter)
        || isInstanceOfPluginFilterNot(pluginFilter)
        || isInstanceOfString(pluginFilter)
        || isInstanceOfBoolean(pluginFilter);
}

export function pluginMatchesFilter(pluginDesc: PluginDescription, pluginFilter: PluginFilterExpr): boolean {
    if (isInstanceOfPluginFilterOr(pluginFilter)) {
        return pluginFilter.or.reduce<boolean>(
            (res, nestedPluginFilter) => res || pluginMatchesFilter(pluginDesc, nestedPluginFilter),
            false,
        );
    } 

    if (isInstanceOfPluginFilterAnd(pluginFilter)) {
        return pluginFilter.and.reduce<boolean>(
            (res, nestedPluginFilter) => res && pluginMatchesFilter(pluginDesc, nestedPluginFilter),
            true,
        );
    }

    if (isInstanceOfPluginFilterNot(pluginFilter)) {
        return !pluginMatchesFilter(pluginDesc, pluginFilter.not);
    }

    if (isInstanceOfString(pluginFilter)) {
        return pluginDesc.tags.includes(pluginFilter) || pluginFilter === pluginDesc.identifier || pluginFilter === pluginDesc.name;
    }

    if (isInstanceOfBoolean(pluginFilter)) {
        return pluginFilter;
    }
    
    throw Error(`Unknown plugin filter ${pluginFilter}`);
}
