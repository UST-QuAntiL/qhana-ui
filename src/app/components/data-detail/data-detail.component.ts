import { Component, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { ExperimentDataApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-data-detail',
    templateUrl: './data-detail.component.html',
    styleUrls: ['./data-detail.component.sass']
})
export class DataDetailComponent implements OnInit, OnDestroy {

    private routeSubscription: Subscription | null = null;

    experimentId: string = "";

    data: ExperimentDataApiObject | null = null;
    downloadUrl: SafeResourceUrl | null = null;

    constructor(private route: ActivatedRoute, private experiment: CurrentExperimentService, private backend: QhanaBackendService, private sanitizer: DomSanitizer) { }

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
            this.downloadUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.backend.backendRootUrl + data.download);
            this.data = data;
        });
    }

}
