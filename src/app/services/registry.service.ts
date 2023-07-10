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
import { AsyncSubject, Subject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiLink, ApiObject, ApiResponse, ChangedApiObject, DeletedApiObject, GenericApiObject, NewApiObject, isApiObject, isApiResponse, isChangedApiObject, isDeletedApiObject, isNewApiObject, matchesLinkRel } from './api-data-types';


export class ResponseError extends Error {
    readonly status: number;
    readonly response: Response;

    constructor(message: string, response: Response) {
        super(message);
        this.status = response.status;
        this.response = response;
    }
}


@Injectable({
    providedIn: 'root'
})
export class PluginRegistryBaseService {
    static CACHE_VERSION = 1;
    static CURRENT_CACHES = {
        api: `api-cache-v${PluginRegistryBaseService.CACHE_VERSION}`,
        apiEmbedded: `api-embedded-cache-v${PluginRegistryBaseService.CACHE_VERSION}`,
    };

    private apiRoot: AsyncSubject<ApiResponse<GenericApiObject>> | null = null;
    private apiCache: Cache | null = null;
    private apiEmbeddedCache: Cache | null = null;

    private rootNavigationLinks: ApiLink[] = [];

    private rootUrl: string;

    public readonly apiResponseSubject: Subject<ApiResponse<unknown>> = new Subject<ApiResponse<unknown>>();

    public readonly apiObjectSubject: Subject<ApiObject> = new Subject<ApiObject>();

    public readonly newApiObjectSubject: Subject<NewApiObject> = new Subject<NewApiObject>();
    public readonly changedApiObjectSubject: Subject<ChangedApiObject> = new Subject<ChangedApiObject>();
    public readonly deletedApiObjectSubject: Subject<DeletedApiObject> = new Subject<DeletedApiObject>();

    public get registryRootUrl() {
        return this.rootUrl;
    }

    constructor() {
        this.rootUrl = this.getRegistryUrlFromConfig();

        this.setupSubjects();
    }

    private setupSubjects() {
        this.apiResponseSubject.subscribe((response) => {
            if (isApiObject(response.data)) {
                const data = response.data;
                this.apiObjectSubject.next(data);
                if (isNewApiObject(data)) {
                    this.newApiObjectSubject.next(data);
                }
                if (isChangedApiObject(data)) {
                    this.changedApiObjectSubject.next(data);
                }
                if (isDeletedApiObject(data)) {
                    this.deletedApiObjectSubject.next(data);
                }
            }
        });
    }

    private getRegistryUrlFromConfig() {
        let protocol = environment.PLUGIN_REGISTRY_PROTOCOL;
        let hostname = environment.PLUGIN_REGISTRY_HOSTNAME;
        let port = environment.PLUGIN_REGISTRY_PORT;
        let path = environment.PLUGIN_REGISTRY_PATH;

        if (localStorage) {
            protocol = localStorage.getItem("plugin_registry_protocol") ?? protocol;
            hostname = localStorage.getItem("plugin_registry_hostname") ?? hostname;
            port = localStorage.getItem("plugin_registry_port") ?? port;
            path = localStorage.getItem("plugin_registry_path") ?? path;
        }

        return `${protocol}//${hostname}:${port}${path}`;
    }

    public changeRegistryUrl(protocol?: string, hostname?: string, port?: string, path?: string) {
        if (protocol == null) {
            localStorage.removeItem("plugin_registry_protocol");
        } else {
            localStorage.setItem("plugin_registry_protocol", protocol);
        }
        if (hostname == null) {
            localStorage.removeItem("plugin_registry_hostname");
        } else {
            localStorage.setItem("plugin_registry_hostname", hostname);
        }
        if (port == null) {
            localStorage.removeItem("plugin_registry_port");
        } else {
            localStorage.setItem("plugin_registry_port", port);
        }
        if (path == null) {
            localStorage.removeItem("plugin_registry_path");
        } else {
            localStorage.setItem("plugin_registry_path", path);
        }

        // set new URL
        const newUrl = this.getRegistryUrlFromConfig();
        const hasChanged = this.rootUrl != newUrl;

        this.rootUrl = newUrl;
        if (hasChanged) {
            this.clearCaches(true);
        }
    }


    private resolveRel(links: ApiLink[], rel: string | string[]): ApiLink {
        const link: ApiLink | undefined = links.find(link => matchesLinkRel(link, rel));
        if (link == null) {
            throw Error(`Could not find a link with the relation ${rel}!`);
        }
        return link;
    }


    private async cacheResults(request: RequestInfo, responseData: ApiResponse<unknown>, embedded?: Array<ApiResponse<unknown>>) {
        if (this.apiCache == null) {
            return;
        }
        const isGet = typeof request === "string" || request.method === "GET";

        if (isGet) {
            // only cache the whole response for get requests
            this.apiCache.put(request, new Response(JSON.stringify(responseData)));
        } else {
            // if method could have deleted things
            const apiObject = responseData?.data as ApiObject;
            if (isChangedApiObject(apiObject)) {
                // invalidate changed object
                this.apiCache?.delete(apiObject.changed.href);
                this.apiEmbeddedCache?.delete(apiObject.changed.href);
                responseData.links.forEach(link => {
                    // invalidate all related changes
                    this.apiCache?.delete(link.href);
                    this.apiEmbeddedCache?.delete(link.href);
                });
            }
            if (isDeletedApiObject(apiObject)) {
                // Remove cache entries of deleted object
                // FIXME also delete related deleted resources in cache!!!
                this.apiCache?.delete(apiObject.deleted.href);
                this.apiEmbeddedCache?.delete(apiObject.deleted.href);
                responseData.links.forEach(link => {
                    // invalidate all related changes
                    this.apiCache?.delete(link.href);
                    this.apiEmbeddedCache?.delete(link.href);
                });
            }
        }

        if (embedded != null) {
            const promises = [];
            for (const response of embedded) {
                const selfLink = (response as ApiResponse<ApiObject>)?.data?.self?.href ?? null;
                if (selfLink == null) {
                    continue;
                }
                const cache = this.apiEmbeddedCache ?? this.apiCache;
                promises.push(cache.put(selfLink, new Response(JSON.stringify(response))));
            }
            await Promise.all(promises);
        }
    }

    private async broadcastToSubscriptions(responseData: ApiResponse<unknown>, embedded?: Array<ApiResponse<unknown>>) {
        this.apiResponseSubject.next(responseData);

        if (embedded != null) {
            for (const response of embedded) {
                this.apiResponseSubject.next(response);
            }
        }
    }

    private async handleResponse<T>(response: Response, input: RequestInfo): Promise<T | null> {
        if (!response.ok) {
            console.warn(response);
            throw new ResponseError("Something went wrong with the request!", response);
        }

        if (response.status === 204) {
            // no content
            return null;
        }

        const contentType = response.headers.get("content-type");

        if (contentType === "application/json") {
            const responseData = await response.json() as T;

            if (isApiResponse(responseData)) {
                const embedded = responseData?.embedded;
                delete responseData.embedded; // nothing outside of caching must depend on this!

                await this.cacheResults(input, responseData, embedded);
                await this.broadcastToSubscriptions(responseData, embedded);
            }

            return responseData;
        } else if (contentType === "application/schema+json") {
            return await response.json() as T;
        } else {
            return response as unknown as T;
        }
    }

    // eslint-disable-next-line complexity
    private async _fetchCached(input: Request, ignoreCache: boolean | "ignore-embedded" = false): Promise<Response | null> {
        if (this.apiCache == null || ignoreCache === true) {
            return null;
        }
        const directCached = await this.apiCache.match(input);
        if (this.apiEmbeddedCache != null) {
            const embeddedCached = await this.apiEmbeddedCache.match(input);
            if (directCached == null) {
                if (ignoreCache === "ignore-embedded") {
                    return null;
                }
                return embeddedCached ?? null;
            }
        }
        return directCached ?? null;
    }

    private async _fetch<T>(input: RequestInfo, ignoreCache: boolean | "ignore-embedded" = false, init: RequestInit | null = null): Promise<T | null> {
        if (init != null && Boolean(init)) {
            input = new Request(input, init);
        }
        if (typeof input === "string") {
            input = new Request(input, { headers: { Accept: "application/json" } });
        }
        // FIXME caching
        const isGet = typeof input === "string" || input.method === "GET";
        if (isGet) {
            const response = await this._fetchCached(input, ignoreCache);
            if (response != null) {
                const responseData = await response.json();
                if (input.url === responseData.data.self.href) {
                    // prevent stale/incorrect cache results
                    return responseData as T;
                } else {
                    console.log("Wrong cached result!", input, responseData.data.self.href);
                }
            }
        }
        const rootResponse = await fetch(input);  // use browser fetch...
        return await this.handleResponse<T>(rootResponse, input);
    }

    public async clearCaches(reopenCache: boolean = true) {
        if ("caches" in window) {
            // cache api available

            // remove refenrence to cache that should be deleted
            this.apiCache = null;
            this.apiEmbeddedCache = null;

            // delete all! caches
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
            }

            if (reopenCache) {
                await this.openCache(true);
            }
        }
    }

    private async openCache(reload = false) {
        if ("caches" in window) {
            // cache api available

            // delete unknown caches
            const expectedCacheNamesSet = new Set(Object.values(PluginRegistryBaseService.CURRENT_CACHES));

            const cacheNames = await caches.keys();
            cacheNames.forEach(cacheName => {
                if (!expectedCacheNamesSet.has(cacheName)) {
                    caches.delete(cacheName);
                }
            });

            // open known cache
            this.apiCache = await caches.open(PluginRegistryBaseService.CURRENT_CACHES.api);
            this.apiEmbeddedCache = await caches.open(PluginRegistryBaseService.CURRENT_CACHES.apiEmbedded);

            if (reload) {
                // prefill cache again
                this.apiRoot = null;
                this.resolveApiRoot();
            }
        }
    }

    private async resolveApiRootPromise(apiRootSubject: AsyncSubject<ApiResponse<GenericApiObject>>) {
        await this.openCache(false);
        if (this.rootUrl == null) {
            apiRootSubject.error("No Api Root URL known!");
            apiRootSubject.complete();
            return;
        }
        try {
            const api_root = await this._fetch<ApiResponse<GenericApiObject>>(this.rootUrl, true);
            if (api_root == null) {
                apiRootSubject.error("Api Root URL not found!");
                apiRootSubject.complete();
                return;
            }
            this.prefetchRelsRecursive("api", api_root);
            apiRootSubject.next(api_root);
            apiRootSubject.complete();
        } catch (error) {
            apiRootSubject.error(error);
            apiRootSubject.complete();
        }
    }

    private async _resolveRecursiveRels(rels: string | string[] | string[][], root?: ApiResponse<unknown>): Promise<ApiLink | null> {
        if (typeof rels === "string") {
            rels = [rels];
        }
        if (rels.length === 0) {
            throw new Error("Cannot resolve empty rel list!");
        }
        let base: ApiResponse<unknown> | null = root ?? await this.resolveApiRoot();
        for (let i = 0; i < rels.length; i++) {
            if (base == null) {
                return null;
            }
            const rel = rels[i];
            const nextLink = this.resolveRel(base.links, rel);
            if (nextLink == null) {
                throw new Error(`Could not resolve rel "${rel}" for base ${JSON.stringify(base.links)}`);
            }
            if (i + 1 === rels.length) {
                return nextLink;
            }
            // not the last rel
            base = await this._fetch<ApiResponse<unknown>>(nextLink.href);
        }
        return null;
    }

    private async _searchResolveRels(rel: string | string[], root?: ApiResponse<unknown>, apiRel: string | string[] = "api", visited: Set<string> | null = null): Promise<ApiLink | null> {
        if (visited == null) {
            visited = new Set();
        }
        const base = root ?? await this.resolveApiRoot();
        const matchingLinks = base.links.filter(link => matchesLinkRel(link, rel));
        if (matchingLinks.length > 0) {
            if (matchingLinks.length === 1) { // only one match
                return matchingLinks[0];
            }
            // prioritise match with resourceType
            const bestMatch = matchingLinks.find(link => (typeof rel === "string") ? link.resourceType === rel : rel.some(rel => link.resourceType === rel));
            return bestMatch ?? matchingLinks[0];
        }
        for (const link of base.links) {
            if (matchesLinkRel(link, apiRel)) {
                if (visited?.has(link.href) ?? true) {  // treat null set as every item in set
                    continue; // link already searched
                }
                visited.add(link.href);
                const newBase = await this._fetch<ApiResponse<unknown>>(link.href, false);
                if (newBase == null) {
                    continue;
                }
                const matchedLink = await this._searchResolveRels(rel, newBase, apiRel, visited);
                if (matchedLink != null) {
                    return matchedLink;
                }
            }
        }
        // no link found
        return null;
    }

    public async resolveRecursiveRels(rels: string[] | string[][]): Promise<ApiLink> {
        const link = await this._resolveRecursiveRels(rels);
        if (link == null) {
            throw Error(`Could not find a link with the relations ${rels}!`);
        }
        return link;
    }

    public async searchResolveRels(rel: string | string[]): Promise<ApiLink> {
        const link = await this._searchResolveRels(rel);
        if (link == null) {
            throw Error(`Could not find a link with the relation ${rel}!`);
        }
        return link;
    }

    private async prefetchRelsRecursive(rel: string | string[] = "api", root?: ApiResponse<unknown>, ignoreCache: boolean | "ignore-embedded" = true, visited: Set<string> | null = null) {
        if (visited == null) {
            visited = new Set();
        }
        const base = root ?? await this.resolveApiRoot();
        base.links.forEach(async (link) => {
            if (matchesLinkRel(link, rel)) {
                if (visited?.has(link.href) ?? true) {  // treat null set as every item in set
                    console.error(link.href)
                    return;
                }
                visited?.add(link.href);
                const new_base = await this._fetch<ApiResponse<unknown>>(link.href, ignoreCache);
                if (new_base != null) {
                    this.prefetchRelsRecursive(rel, new_base, ignoreCache, visited);
                }
            }
            if (matchesLinkRel(link, "nav")) {
                this.rootNavigationLinks.push(link);
            }
        });
    }

    private async resolveApiRoot(): Promise<ApiResponse<GenericApiObject>> {
        if (this.apiRoot != null) {
            return await this.apiRoot.toPromise();
        }
        const apiRootSubject = new AsyncSubject<ApiResponse<GenericApiObject>>();
        this.resolveApiRootPromise(apiRootSubject);
        this.apiRoot = apiRootSubject;
        return await this.apiRoot.toPromise();
    }

    public async getByRel<T>(rel: string | string[] | string[][], searchParams: URLSearchParams | null = null, ignoreCache: boolean | "ignore-embedded" = false): Promise<ApiResponse<T> | null> {
        const link: ApiLink | null = await this._resolveRecursiveRels(rel);
        if (link == null) {
            return null;
        }
        return await this.getByApiLink<T>(link, searchParams, ignoreCache);
    }

    public async getFromCacheByApiLink<T>(link: ApiLink, searchParams: URLSearchParams | null = null, ignoreCache: false | "ignore-embedded" = false): Promise<ApiResponse<T> | null> {
        const url = new URL(link.href)
        searchParams?.forEach((value, key) => url.searchParams.append(key, value));
        const request = new Request(url.toString(), { headers: { Accept: "application/json" } });
        const response = await this._fetchCached(request, ignoreCache);
        if (response != null) {
            const responseData = await response.json();
            if (request.url === responseData.data.self.href) {
                // prevent stale/incorrect cache results
                return responseData as ApiResponse<T>;
            } else {
                console.log("Wrong cached result!", request, responseData.data.self.href);
            }
        }
        return null;
    }

    public async getByApiLink<T>(link: ApiLink, searchParams: URLSearchParams | null = null, ignoreCache: boolean | "ignore-embedded" = false): Promise<ApiResponse<T> | null> {
        const url = new URL(link.href)
        searchParams?.forEach((value, key) => url.searchParams.append(key, value));
        return await this._fetch<ApiResponse<T>>(url.toString(), ignoreCache);
    }

    public async submitByApiLink<T>(link: ApiLink, data?: any, signal?: AbortSignal, authentication?: string): Promise<ApiResponse<T> | null> {
        link.rel.find(rel => rel === "hi")
        const method: string | null = link.rel.find(rel => rel === "post" || rel === "put" || rel === "patch" || rel === "delete")?.toUpperCase() ?? null;
        if (method == null) {
            throw new Error("Api link must contain a rel indicating the HTTP method to be used for submitting!");
        }
        const init: RequestInit = {
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            method: method,
        };
        if (data !== undefined) {
            init.body = JSON.stringify(data);
        }
        if (signal != null) {
            init.signal = signal;
        }
        return await this._fetch<ApiResponse<T>>(link.href, true, init);
    }

    public async fetch<T>(input: RequestInfo, init?: RequestInit, ignoreCache: boolean | "ignore-embedded" = false): Promise<T | null> {
        return await this._fetch<T>(input, ignoreCache, init);
    }
}
