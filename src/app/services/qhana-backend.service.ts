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
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface ApiObject {
    "@self": string;
}

export interface ApiObjectList<T> extends ApiObject {
    itemCount: number;
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

@Injectable({
    providedIn: 'root'
})
export class QhanaBackendService {

    private rootUrl: string;

    private latexUrl: string;

    public get backendRootUrl() {
        return this.rootUrl;
    }

    public get latexRendererUrl() {
        return this.latexUrl;
    }

    constructor(private http: HttpClient) {
        this.rootUrl = this.getBackendUrlFromConfig().replace(/\/+$/, '');;
        this.latexUrl = this.getLatexUrlFromConfig();
    }

    private getBackendUrlFromConfig() {
        let protocol = environment.QHANA_BACKEND_PROTOCOL;
        let hostname = environment.QHANA_BACKEND_HOSTNAME;
        let port = environment.QHANA_BACKEND_PORT;
        let path = environment.QHANA_BACKEND_PATH;

        if (localStorage) {
            protocol = localStorage.getItem("QHAna_backend_protocol") ?? protocol;
            hostname = localStorage.getItem("QHAna_backend_hostname") ?? hostname;
            port = localStorage.getItem("QHAna_backend_port") ?? port;
            path = localStorage.getItem("QHAna_backend_path") ?? path;
        }

        return `${protocol}//${hostname}:${port}${path}`;
    }

    public changeBackendUrl(protocol?: string, hostname?: string, port?: string, path?: string) {
        if (protocol == null) {
            localStorage.removeItem("QHAna_backend_protocol");
        } else {
            localStorage.setItem("QHAna_backend_protocol", protocol);
        }
        if (hostname == null) {
            localStorage.removeItem("QHAna_backend_hostname");
        } else {
            localStorage.setItem("QHAna_backend_hostname", hostname);
        }
        if (port == null) {
            localStorage.removeItem("QHAna_backend_port");
        } else {
            localStorage.setItem("QHAna_backend_port", port);
        }
        if (path == null) {
            localStorage.removeItem("QHAna_backend_path");
        } else {
            localStorage.setItem("QHAna_backend_path", path);
        }

        // set new URL
        this.rootUrl = this.getBackendUrlFromConfig().replace(/\/+$/, '');;
    }

    private getLatexUrlFromConfig() {
        // http://localhost:5030/renderLatex
        let protocol = window?.location?.protocol ?? "http:";
        let hostname = window?.location?.hostname ?? "localhost";
        let port = "5030";
        let path = "/renderLatex";
        if (localStorage) {
            protocol = localStorage.getItem("QHAna_latex_protocol") ?? protocol;
            hostname = localStorage.getItem("QHAna_latex_hostname") ?? hostname;
            port = localStorage.getItem("QHAna_latex_port") ?? port;
            path = localStorage.getItem("QHAna_latex_path") ?? path;
        }
        return `${protocol}//${hostname}:${port}${path}`;
    }

    public changeLatexUrl(protocol?: string, hostname?: string, port?: string, path?: string) {
        if (protocol == null) {
            localStorage.removeItem("QHAna_latex_protocol");
        } else {
            localStorage.setItem("QHAna_latex_protocol", protocol);
        }
        if (hostname == null) {
            localStorage.removeItem("QHAna_latex_hostname");
        } else {
            localStorage.setItem("QHAna_latex_hostname", hostname);
        }
        if (port == null) {
            localStorage.removeItem("QHAna_latex_port");
        } else {
            localStorage.setItem("QHAna_latex_port", port);
        }
        if (path == null) {
            localStorage.removeItem("QHAna_latex_path");
        } else {
            localStorage.setItem("QHAna_latex_path", path);
        }

        // set new URL
        this.latexUrl = this.getLatexUrlFromConfig();
    }

    public resetBackendUrl() {
        this.changeBackendUrl(undefined, undefined, undefined, undefined);
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

    public removePluginEndpoint(endpoint: PluginEndpointApiObject): Observable<void> {
        return this.http.delete(`${this.rootUrl}/plugin-endpoints/${endpoint.endpointId}`).pipe(map(() => { return; }));
    }

    public getExperimentsPage(page: number = 0, itemCount: number = 10): Observable<ApiObjectList<ExperimentApiObject>> {
        return this.http.get<ApiObjectList<ExperimentApiObject>>(`${this.rootUrl}/experiments`);
    }

    public createExperiment(name: string, description: string): Observable<ExperimentApiObject> {
        return this.http.post<ExperimentApiObject>(`${this.rootUrl}/experiments`, { name, description });
    }

    public getExperiment(experimentId: number | string): Observable<ExperimentApiObject> {
        return this.http.get<ExperimentApiObject>(`${this.rootUrl}/experiments/${experimentId}`);
    }

    public updateExperiment(experimentId: number | string, name: string, description: string): Observable<ExperimentApiObject> {
        return this.http.put<ExperimentApiObject>(`${this.rootUrl}/experiments/${experimentId}`, { name, description });
    }

    public cloneExperiment(experimentId: number | string): Observable<ExperimentApiObject> {
        return this.http.post<ExperimentApiObject>(`${this.rootUrl}/experiments/${experimentId}/clone`, undefined, { responseType: "json" });
    }

    public getExperimentDataPage(experimentId: number | string, page: number = 0, itemCount: number = 10): Observable<ApiObjectList<ExperimentDataApiObject>> {
        return this.http.get<ApiObjectList<ExperimentDataApiObject>>(`${this.rootUrl}/experiments/${experimentId}/data?page=${page}&item-count=${itemCount}`);
    }

    public getExperimentData(experimentId: number | string, dataName: string, version: string = "latest"): Observable<ExperimentDataApiObject> {
        const versionQuery = `?version=${version != null ? version : 'latest'}`
        return this.http.get<any>(`${this.rootUrl}/experiments/${experimentId}/data/${dataName}${versionQuery}`).pipe(map(data => {
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
        }));
    }

    public getExperimentDataContent(downloadLink: string): Observable<Blob> {
        return this.http.get(downloadLink, { responseType: "blob" })
    }

    public getTimelineStepsPage(experimentId: number | string, page: number = 0, itemCount: number = 10): Observable<ApiObjectList<TimelineStepApiObject>> {
        return this.http.get<ApiObjectList<TimelineStepApiObject>>(`${this.rootUrl}/experiments/${experimentId}/timeline?page=${page}&item-count=${itemCount}`);
    }

    public createTimelineStep(experimentId: number | string, stepData: TimelineStepPostData): Observable<TimelineStepApiObject> {
        return this.http.post<TimelineStepApiObject>(`${this.rootUrl}/experiments/${experimentId}/timeline`, stepData);
    }

    public getTimelineStep(experimentId: number | string, step: number | string): Observable<TimelineStepApiObject> {
        return this.http.get<TimelineStepApiObject>(`${this.rootUrl}/experiments/${experimentId}/timeline/${step}`);
    }

    public getTimelineStepNotes(experimentId: number | string, step: number | string): Observable<TimelineStepNotesApiObject> {
        return this.http.get<TimelineStepNotesApiObject>(`${this.rootUrl}/experiments/${experimentId}/timeline/${step}/notes`);
    }

    public saveTimelineStepResultQuality(experimentId: number | string, step: number | string, newQuality: "UNKNOWN" | "NEUTRAL" | "GOOD" | "BAD" | "ERROR" | "UNUSABLE"): Observable<null> {
        return this.http.put<null>(`${this.rootUrl}/experiments/${experimentId}/timeline/${step}`, { resultQuality: newQuality });
    }

    public saveTimelineStepNotes(experimentId: number | string, step: number | string, notes: string): Observable<TimelineStepNotesApiObject> {
        return this.http.put<TimelineStepNotesApiObject>(`${this.rootUrl}/experiments/${experimentId}/timeline/${step}/notes`, { notes: notes });
    }

    public saveSubStepInputData(experimentId: number | string, step: number | string, substep: number | string, data: TimelineSubStepPostData): Observable<TimelineSubStepApiObject> {
        return this.http.post<TimelineSubStepApiObject>(`${this.rootUrl}/experiments/${experimentId}/timeline/${step}/substeps/${substep}`, data);
    }

    public getTimelineSubStep(experimentId: number | string, step: number | string, substep: number | string): Observable<TimelineSubStepApiObject> {
        return this.http.get<TimelineSubStepApiObject>(`${this.rootUrl}/experiments/${experimentId}/timeline/${step}/substeps/${substep}`);
    }
}
