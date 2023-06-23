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

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { ApiObject, isApiObject, isDeletedApiObject } from './api-data-types';
import { PluginRegistryBaseService } from './registry.service';



export interface EnvApiObject extends ApiObject {
    name: string;
    value: string;
}

export function isEnvApiObject(obj: any): obj is EnvApiObject {
    if (!isApiObject(obj)) {
        return false;
    }
    if (obj.self.resourceType !== "env") {
        return false;
    }
    if ((obj as EnvApiObject)?.name == null) {
        return false;
    }
    if ((obj as EnvApiObject)?.value == null) {
        return false;
    }
    return true;
}

@Injectable({
    providedIn: 'root'
})
export class EnvService {

    private registrySubscription: Subscription | null = null;

    private lastMapStr: string | null = null;
    private urlMapSubject: BehaviorSubject<Map<RegExp, string> | null> = new BehaviorSubject<Map<RegExp, string> | null>(null);
    private uiTemplateSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

    public get urlMap(): Observable<Map<RegExp, string> | null> {
        return this.urlMapSubject.asObservable();
    }

    public get uiTemplateId(): Observable<string | null> {
        return this.uiTemplateSubject.asObservable();
    }

    constructor(private registryService: PluginRegistryBaseService) {
        this.subscribe();
        // just kick off get, updates are handled by subscription setup above
        this.registryService.getByRel([["env", "collection"]], new URLSearchParams([["name", "UI_URL_MAP"]]), true);
        this.registryService.getByRel([["env", "collection"]], new URLSearchParams([["name", "DEFAULT_UI_TEMPLATE"]]), true);
    }

    private unsubscribe() {
        this.registrySubscription?.unsubscribe();
    }

    private subscribe() {
        this.registrySubscription = this.registryService.apiObjectSubject.subscribe((apiObject => {
            if (apiObject.self.resourceType !== "env") {
                return;  // only look at env api objects
            }
            if (isEnvApiObject(apiObject)) {
                if (apiObject.name === "UI_URL_MAP") {
                    this.updateUrlMap(apiObject.value);
                }
                if (apiObject.name === "DEFAULT_UI_TEMPLATE") {
                    this.uiTemplateSubject.next(apiObject.value);
                }
            }
            if (isDeletedApiObject(apiObject)) {
                if (apiObject.deleted.name === "DEFAULT_UI_TEMPLATE") {
                    this.uiTemplateSubject.next(null);
                }
            }
        }));
    }

    private updateUrlMap(newMap: string | null) {
        if (newMap === this.lastMapStr) {
            return;
        }
        if (newMap == null || newMap === "") {
            this.lastMapStr = newMap;
            this.urlMapSubject.next(new Map());
            return;
        }
        const parsed = JSON.parse(newMap);
        const urlMap = new Map<RegExp, string>();
        Object.keys(parsed).forEach(regex => {
            const pattern = new RegExp(regex);
            urlMap.set(pattern, parsed[regex]);
        });
        this.lastMapStr = newMap;
        this.urlMapSubject.next(urlMap);
    }

    public mapUrl(urlIn: string): string {
        const map = this.urlMapSubject.value;
        if (map == null || map.size === 0) {
            return urlIn;
        }
        map.forEach((replacment, matcher) => {
            urlIn = urlIn.replace(matcher, replacment);
        });
        return urlIn;
    }
}
