import { Component, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { ApiLink, CollectionApiObject } from 'src/app/services/api-data-types';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { ExperimentDataApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';

@Component({
    selector: 'qhana-data-detail',
    templateUrl: './data-detail.component.html',
    styleUrls: ['./data-detail.component.sass'],
    standalone: false
})
export class DataDetailComponent implements OnInit, OnDestroy {

    private routeSubscription: Subscription | null = null;

    experimentId: string = "";

    data: ExperimentDataApiObject | null = null;
    downloadUrl: SafeResourceUrl | null = null;

    pluginRecommendations: ApiLink[] = [];

    constructor(private route: ActivatedRoute, private experiment: CurrentExperimentService, private backend: QhanaBackendService, private registry: PluginRegistryBaseService, private sanitizer: DomSanitizer) { }

    ngOnInit(): void {
        this.routeSubscription = this.route.params.subscribe(params => {
            this.experimentId = params.experimentId;
            this.experiment.setExperimentId(params.experimentId);
            this.loadData(params.experimentId, params.dataName, params.version ?? null);
        });
    }

    ngOnDestroy(): void {
        this.routeSubscription?.unsubscribe();
    }

    loadData(experimentId: number, dataName: string, version: string | null) {
        this.backend.getExperimentData(experimentId, dataName, version ?? 'latest').pipe(take(1)).subscribe(data => {
            let url = data.download
            if (data.download.startsWith("/")) {
                url = this.backend.backendRootUrl + url
            }
            this.downloadUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
            this.data = data;
            this.loadRecommendations(data);
        });
    }

    async loadRecommendations(data: ExperimentDataApiObject) {
        const params = new URLSearchParams();
        params.set("data-type", data.type);
        params.set("content-type", data.contentType);
        params.set("experiment", this.experimentId);
        const result = await this.registry.getByRel<CollectionApiObject>("plugin-recommendation", params);
        this.pluginRecommendations = result?.data?.items ?? [];
    }

}
