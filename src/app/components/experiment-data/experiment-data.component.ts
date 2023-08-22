import { Component, OnDestroy, OnInit } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute } from '@angular/router';
import { Observable, of, Subscription } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { ExperimentDataApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';
import { ServiceRegistryService } from 'src/app/services/service-registry.service';

@Component({
    selector: 'qhana-experiment-data',
    templateUrl: './experiment-data.component.html',
    styleUrls: ['./experiment-data.component.sass']
})
export class ExperimentDataComponent implements OnInit, OnDestroy {
    private routeSubscription: Subscription | null = null;
    private backendUrlSubscription: Subscription | null = null;

    backendUrl: string | null = null;

    experimentId: string | null = null;

    collectionSize: number = 0;

    loading: boolean = true;
    currentPage: { page: number, itemCount: number } | null = null;

    error: string | null = null;

    experimentData: Observable<ExperimentDataApiObject[]> | null = null;
    sort: -1 | 0 | 1 = 1;
    searchValue: string | null = null;
    allVersions: boolean = true;

    constructor(private route: ActivatedRoute, private experiment: CurrentExperimentService, private backend: QhanaBackendService, private serviceRegistry: ServiceRegistryService) { }

    ngOnInit(): void {
        this.backendUrlSubscription = this.serviceRegistry.backendRootUrl.subscribe(url => this.backendUrl = url);
        this.routeSubscription = this.route.params
            .pipe(
                map(params => params.experimentId),
            ).subscribe(experimentId => {
                const change = this.experimentId !== experimentId;
                this.experimentId = experimentId;
                this.experiment.setExperimentId(experimentId);
                if (change) {
                    this.updatePageContent();
                }
            });
    }

    ngOnDestroy(): void {
        this.backendUrlSubscription?.unsubscribe();
        this.routeSubscription?.unsubscribe();
    }

    onPageChange(pageEvent: PageEvent) {
        this.updatePageContent(pageEvent.pageIndex, pageEvent.pageSize);
    }

    onSort() {
        this.sort *= -1; // reverse the sorting order
        this.updatePageContent(this.currentPage?.page, this.currentPage?.itemCount);
    }

    onCheckAllVersions() {
        this.allVersions = !this.allVersions;
        this.updatePageContent(this.currentPage?.page, this.currentPage?.itemCount);
    }

    reloadAllDataVersions(dataName: string) {
        this.searchValue = dataName;
        this.allVersions = true;
        this.updatePageContent();
    }

    updatePageContent(page: number = 0, itemCount: number = 10) {
        if (this.experimentId == null) {
            return;
        }
        this.loading = true;
        this.error = null;
        const currentRequest = { page: page, itemCount: itemCount };
        this.currentPage = currentRequest;
        this.experimentData = this.backend.getExperimentDataPage(this.experimentId, this.allVersions, this.searchValue, null, page, itemCount, this.sort).pipe(
            map(value => {
                if (this.currentPage !== currentRequest) {
                    throw Error("Cancelled by other request.");
                }
                this.collectionSize = value.itemCount;
                this.loading = false;
                return value.items;
            }),
            catchError(err => {
                if (this.currentPage !== currentRequest) {
                    // ignore errors of past requests
                    return of([]);
                }
                this.error = err.toString();
                this.loading = false;
                throw err;
            })
        );
    }

    reloadPage() {
        if (this.currentPage == null) {
            this.updatePageContent();
        } else {
            const { page, itemCount } = this.currentPage;
            this.updatePageContent(page, itemCount);
        }
    }


}
