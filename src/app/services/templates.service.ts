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
import { catchError, filter, map, mergeAll, mergeMap, toArray } from 'rxjs/operators';
import { QhanaBackendService } from './qhana-backend.service';

export interface QhanaTemplate {
    title: string;
    description: string;
    categories: TemplateItem[];
}

export interface TemplateItem {
    name: string;
    description: string;
    tags: string[];
}

@Injectable({
    providedIn: 'root'
})
export class TemplatesService {

    private loading: boolean = false;

    private templateList: QhanaTemplate[] = [];

    private templatesSubject: BehaviorSubject<QhanaTemplate[]> = new BehaviorSubject<QhanaTemplate[]>([]);

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
            var observables: Observable<QhanaTemplate | "error">[] = [];
            pluginEndpoints.items.map(pluginEndpoint => {
                if (pluginEndpoint.type === "PluginRunner") {
                    observables.push(this.http.get<{ templates: QhanaTemplate[] }>(`${pluginEndpoint.url}/templates`).pipe(
                        mergeMap(templateResponse => from(templateResponse.templates)),
                        catchError(err => {
                            console.log(err);
                            return [];
                        })
                    ))
                }
                from(observables).pipe(
                    mergeAll(),
                    // filter out all templates that could not be loaded because of some error (i.e. filter out all error sentinel values left)
                    filter<QhanaTemplate | "error", QhanaTemplate>((value): value is QhanaTemplate => value !== "error"),
                    toArray(),
                ).subscribe(templates => {
                    templates.sort((a, b) => {
                        if (a.title > b.title) {
                            return 1;
                        }
                        if (a.title < b.title) {
                            return -1;
                        }
                        return 0;
                    })
                    this.templateList = templates;
                    this.templatesSubject.next(templates);
                    this.loading = false;
                });
            });
        })
    }
}
