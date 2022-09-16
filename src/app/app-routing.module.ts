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

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DataDetailComponent } from './components/data-detail/data-detail.component';
import { ExperimentDataComponent } from './components/experiment-data/experiment-data.component';
import { ExperimentTimelineComponent } from './components/experiment-timeline/experiment-timeline.component';
import { ExperimentWorkspaceComponent } from './components/experiment-workspace/experiment-workspace.component';
import { ExperimentComponent } from './components/experiment/experiment.component';
import { ExperimentsPageComponent } from './components/experiments-page/experiments-page.component';
import { SettingsPageComponent } from './components/settings-page/settings-page.component';
import { TimelineStepComponent } from './components/timeline-step/timeline-step.component';

const routes: Routes = [
    { path: '', component: ExperimentsPageComponent },
    { path: 'settings', component: SettingsPageComponent },
    { path: 'experiments', component: ExperimentsPageComponent },
    { path: 'experiments/:experimentId', redirectTo: "info" },
    { path: 'experiments/:experimentId/info', component: ExperimentComponent },
    { path: 'experiments/:experimentId/workspace', component: ExperimentWorkspaceComponent },
    { path: 'experiments/:experimentId/workspace/:templateId/:categoryId/:pluginId', component: ExperimentWorkspaceComponent },
    { path: 'experiments/:experimentId/data', component: ExperimentDataComponent },
    { path: 'experiments/:experimentId/data/:dataName', component: DataDetailComponent },
    { path: 'experiments/:experimentId/timeline', component: ExperimentTimelineComponent },
    { path: 'experiments/:experimentId/timeline/:step', component: TimelineStepComponent },
    { path: 'experiments/:experimentId/timeline/:step/:stepTabId', component: TimelineStepComponent },
];

@NgModule({
    imports: [RouterModule.forRoot(routes, { useHash: true })],
    exports: [RouterModule]
})
export class AppRoutingModule { }
