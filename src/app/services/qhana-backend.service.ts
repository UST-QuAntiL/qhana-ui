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

import { HttpEventType, HttpRequest, HttpResponse, HttpParams } from '@angular/common/http';
import { HttpClient, } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { interval, Observable } from 'rxjs';
import { filter, map, startWith, switchMap, mergeMap, take } from 'rxjs/operators';
import { ServiceRegistryService } from './service-registry.service';
import { environment } from 'src/environments/environment';

export interface ApiObject {
    "@self": string;
}

export interface ApiObjectList<T> extends ApiObject {
    itemCount: number;
    items: T[];
}

export interface ApiObjectListWithoutCount<T> extends ApiObject {
    items: T[];
}

export interface PluginEndpointApiObject extends ApiObject {
    endpointId: number;
    url: string;
    type: "PluginRunner" | "Plugin" | string;
}

export interface ExperimentApiObject extends ApiObject {
    experimentId: number;
    name: string;
    description: string;
    templateId?: string | number;
}

export interface ExperimentDataApiObject extends ApiObject {
    download: string;
    name: string;
    version: string;
    type: string;
    contentType: string;
    producedBy?: number;
    usedBy?: number[];
}

export interface ExperimentDataRef {
    name: string;
    version: string;
}

export interface ExperimentExportApiObject extends ApiObject {
    exportId: number;
}

export interface ExportStatus {
    exportId: number;
    experimentId: number;
    status: "SUCCESS" | "FAILURE" | "PENDING";
    name: string;
}

export interface ExportResult extends ExportStatus {
    fileLink: string | null;
}

export interface ExperimentExportApiObject extends ApiObject {
    exportId: number;
}

export interface ExperimentExportPollObject extends ExperimentExportApiObject {
    status: string;
    fileLink?: string;
}

export interface ExperimentImportApiObject extends ApiObject {
    progress: number,
    uploadStatus: "PENDING" | "DONE" | "FAILURE" | "OTHER",
    importId?: number;
}

export interface ExperimentImportPollObject extends ApiObject {
    importId: number,
    status: string;
    experimentId?: number;
    name?: string;
    description?: string;
}

export interface TimelineStepQueryFilter {
    itemCount?: number;
    pluginName?: string;
    version?: string;
    sort?: 1 | -1 | 0;
}

export interface TimelineStepPostData {
    resultLocation: string;
    inputData: string[];

    processorName: string;
    processorVersion: string;
    processorLocation: string;
    parameters: string;
    parametersContentType: string;
};

export interface TimelineSubStepPostData {
    inputData: string[];
    parameters: string;
    parametersContentType: string;
};


export interface TimelineSubStepApiObject {
    substepNr: number;
    stepId: number;
    inputData?: ExperimentDataRef[];
    substepId?: string;
    href: string;
    hrefUi?: string;
    cleared: boolean;
    parameters?: string;
    parametersContentType?: string;

}

export interface TimelineStepApiObject extends ApiObject {
    sequence: number;
    start: string;
    end: string;
    status: string;
    resultQuality: "UNKNOWN" | "NEUTRAL" | "GOOD" | "BAD" | "ERROR" | "UNUSABLE";
    resultLog?: string;
    notes: string;
    processorName: string;
    processorVersion: string;
    processorLocation: string;
    parameters: string;
    parametersContentType: string;
    inputData?: ExperimentDataRef[];
    outputData?: ExperimentDataRef[];
    progressStart?: number;
    progressTarget?: number;
    progressValue?: number;
    progressUnit?: string;
    substeps?: TimelineSubStepApiObject[],
}

export interface TimelineStepNotesApiObject extends ApiObject {
    notes: string;
}

export interface TimelineStepResultQuality {
    resultQuality: string;
}

export interface TimelineStepPageOptions {
    page?: number;
    itemCount?: number;
    sort?: number;
    pluginName?: string;
    version?: string;
    stepStatus?: "SUCCESS" | "PENDING" | "ERROR" | "";
    unclearedSubstep?: number;
}

function urlIsString(url: string | null): url is string {
    return url != null;
}

@Injectable({
    providedIn: 'root'
})
export class QhanaBackendService {

    private rootUrl: string | null = null;

    private latexUrl: string | null = null;

    public get backendRootUrl() {
        return this.rootUrl;
    }

    public get latexRendererUrl() {
        return this.latexUrl;
    }

    constructor(private http: HttpClient, private serviceRegistry: ServiceRegistryService) {
        this.serviceRegistry.backendRootUrl.subscribe(url => this.rootUrl = url);
        this.serviceRegistry.latexRendererUrl.subscribe(url => this.latexUrl = url);
    }

    public getPluginEndpoints(): Observable<ApiObjectList<PluginEndpointApiObject>> {
        return this.http.get<ApiObjectList<PluginEndpointApiObject>>(`${this.rootUrl}/plugin-endpoints`);
    }

    public addPluginEndpoint(url: string, type?: string): Observable<PluginEndpointApiObject> {
        const body: { url: string, type?: string } = { url };
        if (type != null) {
            body.type = type;
        }
        return this.http.post<PluginEndpointApiObject>(`${this.rootUrl}/plugin-endpoints`, body);
    }

    private callWithRootUrl<T>(callback: (url: string) => Observable<T>): Observable<T> {
        return this.serviceRegistry.backendRootUrl.pipe(
            filter(urlIsString),
            take(1),
            mergeMap(callback)
        );
    }

    public removePluginEndpoint(endpoint: PluginEndpointApiObject): Observable<void> {
        return this.callWithRootUrl<void>(
            rootUrl => this.http.delete(`${rootUrl}/plugin-endpoints/${endpoint.endpointId}`).pipe(map(() => { return; }))
        );
    }

    public getExperimentsPage(page: number = 0, itemCount: number = 10, search: string | undefined = undefined, sort: number = 1): Observable<ApiObjectList<ExperimentApiObject>> {
        let queryParams = new HttpParams();
        if (search) {
            queryParams = queryParams.append("search", search);
        }
        queryParams = queryParams.append("page", page).append("item-count", itemCount).append("sort", sort);
        return this.callWithRootUrl<ApiObjectList<ExperimentApiObject>>(
            rootUrl => this.http.get<ApiObjectList<ExperimentApiObject>>(`${rootUrl}/experiments`, { params: queryParams })
        );
    }

    public createExperiment(name: string, description: string): Observable<ExperimentApiObject> {
        return this.callWithRootUrl<ExperimentApiObject>(
            rootUrl => this.http.post<ExperimentApiObject>(`${rootUrl}/experiments`, { name, description })
        );
    }

    public getExperiment(experimentId: number | string): Observable<ExperimentApiObject> {
        return this.callWithRootUrl<ExperimentApiObject>(
            rootUrl => this.http.get<ExperimentApiObject>(`${rootUrl}/experiments/${experimentId}`)
        );
    }

    public updateExperiment(experimentId: number | string, name: string, description: string): Observable<ExperimentApiObject> {
        return this.callWithRootUrl<ExperimentApiObject>(
            rootUrl => this.http.put<ExperimentApiObject>(`${rootUrl}/experiments/${experimentId}`, { name, description })
        );
    }

    public cloneExperiment(experimentId: number | string): Observable<ExperimentApiObject> {
        return this.callWithRootUrl<ExperimentApiObject>(
            rootUrl => this.http.post<ExperimentApiObject>(`${rootUrl}/experiments/${experimentId}/clone`, undefined, { responseType: "json" })
        );
    }

    /**
     * Export experiment and poll for result (download link)
     *
     * @param experimentId experiment id
     * @param restriction "ALL" for complete experiment, "LOGS" for only steps/substeps, "DATA" for only data files, or "STEPS" for a specified list of steps
     * @param allDataVersions true if all versions, else only newest
     * @param stepList specified list of steps
     * @returns experiment export poll object with result file link if successful
     */
    public exportExperiment(experimentId: number | string, restriction: "ALL" | "LOGS" | "DATA" | "STEPS" = "ALL", allDataVersions: boolean = true, stepList: number[] = []): Observable<ExperimentExportPollObject> {
        return this.callWithRootUrl<ExperimentExportApiObject>(
            rootUrl => this.http.post<ExperimentExportApiObject>(`${rootUrl}/experiments/${experimentId}/export`, { restriction, allDataVersions, stepList })).pipe(
                switchMap(exportResource => {
                    // poll until SUCCESS or FAILURE
                    return interval(1000).pipe(
                        startWith(0),
                        switchMap(() => this.exportExperimentPoll(experimentId, exportResource.exportId)),
                        filter(resp => resp.status != "PENDING"),
                        take(1)
                    )
                })
            );
    }

    /**
     * Poll for result of experiment export
     *
     * @param experimentId experiment id
     * @param exportId id of export resource returned by backend in export step
     * @returns experiment export poll object with result file link if successful
     */
    public exportExperimentPoll(experimentId: number | string, exportId: number | string): Observable<ExperimentExportPollObject> {
        // TODO: reformat, move pipeline into  callWithRootUrl
        return this.callWithRootUrl(
            rootUrl => this.http.get(`${rootUrl}/experiments/${experimentId}/export/${exportId}`, { observe: 'response', responseType: 'arraybuffer' })).pipe(map(resp => {
                if (resp.headers.get("Content-Type") == "application/json") {
                    return JSON.parse(new TextDecoder().decode(resp.body as ArrayBuffer));
                } else if (resp.headers.get("Content-Type") == "application/zip") {
                    let result: ExperimentExportPollObject = {
                        '@self': `${this.rootUrl}/experiments/${experimentId}/export/${exportId}`, // TODO: test if this works with this.rootUrl
                        exportId: Number(exportId),
                        status: 'SUCCESS',
                        fileLink: `${this.rootUrl}/experiments/${experimentId}/export/${exportId}`  // TODO: test if this works with this.rootUrl
                    };
                    return result;
                } else {
                    throw new Error("Experiment poll returned wrong file format: " + resp.headers.get("Content-Type"));
                }
            }));
    }

    public getExportList(itemCount: number = 10): Observable<ExportResult[]> {
        let queryParams = new HttpParams().append("item-count", itemCount);
        return this.callWithRootUrl<ApiObjectListWithoutCount<ExportStatus>>(
            rootUrl => this.http.get<ApiObjectListWithoutCount<ExportStatus>>(`${rootUrl}/experiments/export-list`, { params: queryParams })).pipe(map(resp => {
                const exportResultList: ExportResult[] = [];
                resp.items.forEach(exportStatus => {
                    var fileLink: string | null;
                    if (exportStatus.status == "SUCCESS") {
                        fileLink = `${this.rootUrl}/experiments/${exportStatus.experimentId}/export/${exportStatus.exportId}` // TODO: test if this works with this.rootUrl
                    } else {
                        fileLink = null;
                    }
                    exportResultList.push({
                        exportId: exportStatus.exportId,
                        experimentId: exportStatus.experimentId,
                        status: exportStatus.status,
                        name: exportStatus.name,
                        fileLink: fileLink
                    })
                });
                return exportResultList;
            }));
    }

    deleteExport(experimentId: number, exportId: number) {
        return this.callWithRootUrl<void>(
            rootUrl => this.http.delete(`${rootUrl}/experiments/${experimentId}/export/${exportId}/delete`).pipe(map(() => { return; }))
        );
    }

    public importExperiment(experimentZip: File): Observable<ExperimentImportApiObject> {
        const formData: FormData = new FormData();
        formData.append("file", experimentZip, experimentZip.name);

        return this.callWithRootUrl(
            rootUrl => this.http.post(`${rootUrl}/experiments/import`, formData, {
                observe: "events", responseType: "json", reportProgress: true
            })).pipe(
                map(event => {
                    if (event.type == HttpEventType.UploadProgress) {
                        const progress = Math.round(100 * event.loaded / (event.total != undefined ? event.total : 100));
                        return {
                            "@self": `${this.rootUrl}/experiments/import`, // TODO: test if this works with this.rootUrl
                            progress: progress,
                            uploadStatus: "PENDING"
                        }
                    } else if (event instanceof HttpResponse) {
                        return {
                            "@self": `${this.rootUrl}/experiments/import`, // TODO: test if this works with this.rootUrl
                            progress: 100,
                            uploadStatus: "DONE",
                            importId: JSON.parse(JSON.stringify(event.body)).importId
                        }
                    } else {
                        return {
                            "@self": `${this.rootUrl}/experiments/import`, // TODO: test if this works with this.rootUrl
                            progress: 0,
                            uploadStatus: "OTHER",
                        }
                    }
                })
            );
    }

    public importExperimentPoll(importId: number): Observable<ExperimentImportPollObject> {
        return this.callWithRootUrl<ExperimentImportPollObject>(
            rootUrl => this.http.get<ExperimentImportPollObject>(`${rootUrl}/experiments/import/${importId}`, { responseType: "json" }));
    }

    public getExperimentDataPage(experimentId: number | string, allVersions: boolean = true, search: string | null = null, page: number = 0, itemCount: number = 10, sort: number = 1): Observable<ApiObjectList<ExperimentDataApiObject>> {
        let queryParams = new HttpParams().append("all-versions", allVersions);
        if (search) {
            queryParams = queryParams.append("search", search);
        }
        queryParams = queryParams.append("page", page).append("item-count", itemCount).append("sort", sort);
        return this.callWithRootUrl<ApiObjectList<ExperimentDataApiObject>>(
            rootUrl => this.http.get<ApiObjectList<ExperimentDataApiObject>>(`${rootUrl}/experiments/${experimentId}/data`, { params: queryParams }));
    }

    public getExperimentData(experimentId: number | string, dataName: string, version: string = "latest"): Observable<ExperimentDataApiObject> {
        const versionQuery = `?version=${version != null ? version : 'latest'}`
        return this.callWithRootUrl<ExperimentDataApiObject>(
            rootUrl => this.http.get<any>(`${rootUrl}/experiments/${experimentId}/data/${dataName}${versionQuery}`).pipe(map(data => {
                const dataObject: ExperimentDataApiObject = {
                    "@self": data["@self"],
                    download: data.download,
                    name: data.name,
                    version: data.version,
                    type: data.type,
                    contentType: data.contentType,
                }
                if (data.producingStep != null) {
                    dataObject.producedBy = data.producingStep;
                }
                if (data.inputFor != null) {
                    dataObject.usedBy = data.inputFor;
                }
                return dataObject;
            }))
        );
    }

    public getExperimentDataContent(downloadLink: string): Observable<Blob> {
        return this.callWithRootUrl<Blob>(
            rootUrl => this.http.get(downloadLink, { responseType: "blob" })
        );
    }

    public getTimelineStepsPage(experimentId: number | string, { page = 0, itemCount = 10, sort = 1, pluginName = "", version = "", stepStatus = "", unclearedSubstep = 0 }: TimelineStepPageOptions): Observable<ApiObjectList<TimelineStepApiObject>> {
        const queryParams = new HttpParams()
            .append("plugin-name", pluginName)
            .append("version", version)
            .append("status", stepStatus)
            .append("uncleared-substep", unclearedSubstep)
            .append("page", page)
            .append("item-count", itemCount)
            .append("sort", sort);
        return this.callWithRootUrl<ApiObjectList<TimelineStepApiObject>>(
            rootUrl => this.http.get<ApiObjectList<TimelineStepApiObject>>(
                `${rootUrl}/experiments/${experimentId}/timeline`, { params: queryParams }
            )
        );
    }

    public createTimelineStep(experimentId: number | string, stepData: TimelineStepPostData): Observable<TimelineStepApiObject> {
        return this.callWithRootUrl<TimelineStepApiObject>(
            rootUrl => this.http.post<TimelineStepApiObject>(`${rootUrl}/experiments/${experimentId}/timeline`, stepData)
        );
    }

    public getTimelineStep(experimentId: number | string, step: number | string): Observable<TimelineStepApiObject> {
        return this.callWithRootUrl<TimelineStepApiObject>(
            rootUrl => this.http.get<TimelineStepApiObject>(`${rootUrl}/experiments/${experimentId}/timeline/${step}`)
        );
    }

    public getTimelineStepNotes(experimentId: number | string, step: number | string): Observable<TimelineStepNotesApiObject> {
        return this.callWithRootUrl<TimelineStepNotesApiObject>(
            rootUrl => this.http.get<TimelineStepNotesApiObject>(`${rootUrl}/experiments/${experimentId}/timeline/${step}/notes`)
        );
    }

    public saveTimelineStepResultQuality(experimentId: number | string, step: number | string, newQuality: "UNKNOWN" | "NEUTRAL" | "GOOD" | "BAD" | "ERROR" | "UNUSABLE"): Observable<null> {
        return this.callWithRootUrl<null>(
            rootUrl => this.http.put<null>(`${rootUrl}/experiments/${experimentId}/timeline/${step}`, { resultQuality: newQuality })
        );
    }

    public saveTimelineStepNotes(experimentId: number | string, step: number | string, notes: string): Observable<TimelineStepNotesApiObject> {
        return this.callWithRootUrl<TimelineStepNotesApiObject>(
            rootUrl => this.http.put<TimelineStepNotesApiObject>(`${rootUrl}/experiments/${experimentId}/timeline/${step}/notes`, { notes: notes })
        );
    }

    public saveSubStepInputData(experimentId: number | string, step: number | string, substep: number | string, data: TimelineSubStepPostData): Observable<TimelineSubStepApiObject> {
        return this.callWithRootUrl<TimelineSubStepApiObject>(
            rootUrl => this.http.post<TimelineSubStepApiObject>(`${rootUrl}/experiments/${experimentId}/timeline/${step}/substeps/${substep}`, data)
        );
    }

    public getTimelineSubStep(experimentId: number | string, step: number | string, substep: number | string): Observable<TimelineSubStepApiObject> {
        return this.callWithRootUrl<TimelineSubStepApiObject>(
            rootUrl => this.http.get<TimelineSubStepApiObject>(`${rootUrl}/experiments/${experimentId}/timeline/${step}/substeps/${substep}`)
        );
    }
}
