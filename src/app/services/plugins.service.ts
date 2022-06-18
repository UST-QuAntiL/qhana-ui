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

export interface PluginDescription {
    apiRoot: string;
    name: string;
    version: string;
    identifier: string;
}

export interface QhanaPlugin {
    url: string;
    pluginDescription: PluginDescription;
    metadata: any;
}

@Injectable({
    providedIn: 'root'
})
export class PluginsService {

    private loading: boolean = false;

    private pluginList: QhanaPlugin[] = [];

    private pluginsSubject: BehaviorSubject<QhanaPlugin[]> = new BehaviorSubject<QhanaPlugin[]>([]);

    get plugins() {
        return this.pluginsSubject.asObservable();
    }

    constructor(private http: HttpClient, private backend: QhanaBackendService) { }

    getPlugin(pluginId: string) {
        return this.pluginsSubject.pipe(map(pluginList => pluginList.find(p => p.pluginDescription.identifier === pluginId) ?? null));
    }

    loadPlugins() {
        if (this.loading) {
            return;
        }
        this.loading = true;
        this.backend.getPluginEndpoints().subscribe(pluginEndpoints => {
            var observables: Observable<QhanaPlugin | "error">[] = [];
            pluginEndpoints.items.map(pluginEndpoint => {
                if (pluginEndpoint.type === "PluginRunner") {
                    observables.push(this.loadPluginsFromPluginRunner(pluginEndpoint.url));
                } else if (pluginEndpoint.type === "Plugin") {
                    // TODO refactor into method
                    const observable = this.http.get<PluginDescription>(pluginEndpoint.url).pipe(
                        map(pluginMetadata => {
                            return {
                                url: pluginEndpoint.url,
                                pluginDescription: {
                                    apiRoot: pluginEndpoint.url,
                                    name: pluginMetadata.name,
                                    version: pluginMetadata.version,
                                    identifier: pluginMetadata.identifier,
                                },
                                metadata: pluginMetadata,
                            };
                        }),
                        catchError(err => {
                            console.log(err);
                            return of<"error">("error"); // error sentinel
                        })
                    );
                    observables.push(observable);
                } else {
                    console.warn(`Unknown Plugin Endpoint type ${pluginEndpoint.type}.`, pluginEndpoint);
                }
            });
            from(observables).pipe(
                mergeAll(),
                // filter out all plugins that could not be loaded because of some error (i.e. filter out all error sentinel values left)
                filter<QhanaPlugin | "error", QhanaPlugin>((value): value is QhanaPlugin => value !== "error"),
                toArray(),
            ).subscribe(plugins => {
                plugins.sort((a, b) => {
                    if (a.pluginDescription.name > b.pluginDescription.name) {
                        return 1;
                    }
                    if (a.pluginDescription.name < b.pluginDescription.name) {
                        return -1;
                    }
                    if (a.pluginDescription.version > b.pluginDescription.version) {
                        return 1;
                    }
                    if (a.pluginDescription.version < b.pluginDescription.version) {
                        return -1;
                    }
                    return 0;
                })
                this.pluginList = plugins;
                this.pluginsSubject.next(plugins);
                this.loading = false;
            });
        });
    }

    private loadPluginsFromPluginRunner(pluginRunnerUrl: string): Observable<QhanaPlugin | "error"> {
        return this.http.get<{ plugins: PluginDescription[] }>(`${pluginRunnerUrl}/plugins`).pipe(
            mergeMap(pluginsResponse => from(pluginsResponse.plugins)),
            mergeMap(plugin => {
                return this.loadPluginMetadata(plugin).pipe(catchError(err => {
                    console.log(err);
                    return of<"error">("error"); // error sentinel
                }));
            }),
            catchError(err => {
                console.log(err);
                return [];
            })
        );
    }

    loadPluginMetadata(plugin: PluginDescription): Observable<QhanaPlugin> {
        return this.http.get<QhanaPlugin>(plugin.apiRoot).pipe(
            map(pluginMetadata => {
                return {
                    url: plugin.apiRoot,
                    pluginDescription: plugin,
                    metadata: pluginMetadata,
                };
            }),
        );
    }

}
