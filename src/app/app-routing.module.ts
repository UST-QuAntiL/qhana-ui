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
import { RouterModule, Routes, UrlMatcher, UrlMatchResult, UrlSegment } from '@angular/router';
import { DataDetailComponent } from './components/data-detail/data-detail.component';
import { ExperimentDataComponent } from './components/experiment-data/experiment-data.component';
import { ExperimentTimelineComponent } from './components/experiment-timeline/experiment-timeline.component';
import { ExperimentWorkspaceComponent } from './components/experiment-workspace/experiment-workspace.component';
import { ExperimentComponent } from './components/experiment/experiment.component';
import { ExperimentsPageComponent } from './components/experiments-page/experiments-page.component';
import { PluginTabComponent } from './components/plugin-tab/plugin-tab.component';
import { SettingsPageComponent } from './components/settings-page/settings-page.component';
import { TimelineStepComponent } from './components/timeline-step/timeline-step.component';

const NUMBER_REGEX = /^[0-9]+$/;

const extraTabsMatcher: UrlMatcher = (segments: UrlSegment[], group, route): UrlMatchResult | null => {
    const consumed: UrlSegment[] = [];
    const params: { [props: string]: UrlSegment } = {};

    let tabId: UrlSegment | null = null;
    let pluginId: UrlSegment | null = null;

    // match: /experiments/:experimentId
    let index = 0;
    if (segments[index]?.path === "experiments") {
        consumed.push(segments[index]);
        index += 1;
        if ((segments[index]?.path ?? "").match(NUMBER_REGEX)) {
            params.experimentId = segments[index];
            consumed.push(segments[index]);
            index += 1;
        } else {
            return null;
        }
    }

    console.log(consumed, params)

    // match: ./extra[/:path]/:templateTabId
    if (segments[index]?.path !== "extra") {
        return null;
    }
    consumed.push(segments[index]);
    index += 1;
    if (segments[index + 1]?.path.match(NUMBER_REGEX)) {
        // push [/:path]
        params.path = segments[index];
        consumed.push(segments[index]);
        index += 1;
        // push /:templateTabId
        tabId = segments[index];
        consumed.push(segments[index]);
        index += 1;
    } else if (segments[index]?.path.match(NUMBER_REGEX)) {
        // push /:templateTabId
        tabId = segments[index];
        consumed.push(segments[index]);
        index += 1;
    }

    if (tabId == null) {
        // sanity check
        return null;
    }
    params.templateTabId = tabId;

    console.log(consumed, params)

    // found full match?
    if (index === segments.length) {
        return {
            consumed: consumed,
            posParams: params,
        }
    }

    // match: ./plugin/:pluginId
    if (segments[index]?.path !== "plugins") {
        return null;
    }
    consumed.push(segments[index]);
    index += 1;
    if (segments[index]?.path.match(NUMBER_REGEX)) {
        pluginId = segments[index];
        consumed.push(segments[index]);
        index += 1;
    }

    console.log(consumed, params)

    // found full match?
    if (index === segments.length && pluginId != null) {
        params.pluginId = pluginId;
        return {
            consumed: consumed,
            posParams: params,
        }
    }

    return null;
}

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
    {/* path: '[experiments/:experimentId/]extra/[:path/]:templateTabId/[plugins/:pluginId]' */
        matcher: extraTabsMatcher,
        component: PluginTabComponent,
    },
];

@NgModule({
    imports: [RouterModule.forRoot(routes, { useHash: true })],
    exports: [RouterModule]
})
export class AppRoutingModule { }
