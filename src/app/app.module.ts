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

import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatCommonModule } from '@angular/material/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule, MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { StepStatusComponent } from './components-small/step-status/step-status.component';
import { DataDetailComponent } from './components/data-detail/data-detail.component';
import { DataPreviewComponent } from './components/data-preview/data-preview.component';
import { ExperimentDataComponent } from './components/experiment-data/experiment-data.component';
import { ExperimentTimelineComponent } from './components/experiment-timeline/experiment-timeline.component';
import { ExperimentWorkspaceComponent } from './components/experiment-workspace/experiment-workspace.component';
import { ExperimentComponent } from './components/experiment/experiment.component';
import { ExperimentsPageComponent } from './components/experiments-page/experiments-page.component';
import { MarkdownComponent } from './components/markdown/markdown.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { PluginUiframeComponent } from './components/plugin-uiframe/plugin-uiframe.component';
import { PreviewListComponent } from './components/preview-list/preview-list.component';
import { SettingsPageComponent } from './components/settings-page/settings-page.component';
import { SubstepsDetailsComponent } from './components/substeps-details/substeps-details.component';
import { TimelineStepNavComponent } from './components/timeline-step-nav/timeline-step-nav.component';
import { TimelineStepComponent } from './components/timeline-step/timeline-step.component';
import { TimelineSubstepsComponent } from './components/timeline-substeps/timeline-substeps.component';
import { ChooseDataComponent } from './dialogs/choose-data/choose-data.component';
import { ChoosePluginComponent } from './dialogs/choose-plugin/choose-plugin.component';
import { CreateExperimentDialog } from './dialogs/create-experiment/create-experiment.component';
import { MarkdownHelpDialog } from './dialogs/markdown-help/markdown-help.component';

@NgModule({
    declarations: [
        AppComponent,
        NavbarComponent,
        ExperimentsPageComponent,
        ExperimentComponent,
        TimelineStepNavComponent,
        ExperimentWorkspaceComponent,
        ExperimentDataComponent,
        ExperimentTimelineComponent,
        DataDetailComponent,
        CreateExperimentDialog,
        TimelineStepComponent,
        SettingsPageComponent,
        DataPreviewComponent,
        PreviewListComponent,
        MarkdownComponent,
        PluginUiframeComponent,
        ChooseDataComponent,
        ChoosePluginComponent,
        TimelineSubstepsComponent,
        SubstepsDetailsComponent,
        StepStatusComponent,
        MarkdownHelpDialog,
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        FormsModule,
        BrowserAnimationsModule,
        HttpClientModule,
        MatToolbarModule,
        MatPaginatorModule,
        MatCardModule,
        MatButtonModule,
        MatCommonModule,
        MatTabsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatListModule,
        MatChipsModule,
        MatIconModule,
        MatSelectModule,
        MatProgressSpinnerModule,
        MatProgressBarModule,
        MatExpansionModule,
        MatTooltipModule,
        MatCheckboxModule,
    ],
    providers: [
        { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: "outline" } }
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
