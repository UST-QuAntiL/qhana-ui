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
import { BehaviorSubject, Subscription } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { ExperimentApiObject, QhanaBackendService } from './qhana-backend.service';

@Injectable({
    providedIn: 'root'
})
export class CurrentExperimentService {

    private routeSubscription: Subscription | null = null;

    private currentExperimentId: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
    private currentExperiment: BehaviorSubject<ExperimentApiObject | null> = new BehaviorSubject<ExperimentApiObject | null>(null);

    get experimentId() {
        return this.currentExperimentId.asObservable();
    }

    get experiment() {
        return this.currentExperiment.asObservable();
    }

    get experimentName() {
        return this.currentExperiment.asObservable().pipe(map(experiment => experiment?.name ?? null));
    }

    get experimentDescription() {
        return this.currentExperiment.asObservable().pipe(map(experiment => experiment?.description ?? null));
    }

    get experimentTemplateId() {
        return this.currentExperiment.asObservable().pipe(map(experiment => experiment?.templateId ?? null));
    }

    constructor(private backend: QhanaBackendService) { }

    private updateCurrentExperiment(experimentId: string | null) {
        if (experimentId == null) {
            this.setNewValues(null, null);
            return;
        }
        console.log("fetch new experiment")
        this.backend.getExperiment(experimentId).pipe(take(1)).subscribe(
            experiment => this.setNewValues(experimentId, experiment),
            err => this.setNewValues(experimentId, { "@self": "error", experimentId: parseInt(experimentId), name: "Error", description: err.toString() }),
        );
    }

    private setNewValues(experimentId: string | null, experiment: ExperimentApiObject | null) {
        if (this.currentExperimentId.getValue() !== experimentId) {
            this.currentExperimentId.next(experimentId);
        }
        const current = this.currentExperiment.getValue();
        if (current != experiment || current?.name !== experiment?.name || current?.description !== experiment?.description || current?.templateId !== experiment?.templateId) {
            this.currentExperiment.next(experiment);
        }
    }

    public setExperimentId(experimentId: string | null) {
        if (this.currentExperimentId.getValue() !== experimentId) {
            this.updateCurrentExperiment(experimentId);
        }
    }

    public reloadExperiment() {
        const experimentId = this.currentExperimentId.getValue();
        if (experimentId != null) {
            this.updateCurrentExperiment(experimentId);
        }
    }
}
