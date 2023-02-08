import { Component, OnDestroy, OnInit } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute } from '@angular/router';
import { Observable, of, Subscription } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { ExperimentDataApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-experiment-data',
    templateUrl: './experiment-data.component.html',
    styleUrls: ['./experiment-data.component.sass']
})
export class ExperimentDataComponent implements OnInit, OnDestroy {

    private routeSubscription: Subscription | null = null;

    backendUrl: string;

    experimentId: string | null = null;

    collectionSize: number = 0;

    loading: boolean = true;
    currentPage: { page: number, itemCount: number } = { page: 0, itemCount: 10 };

    error: string | null = null;

    experimentData: Observable<ExperimentDataApiObject[]> | null = null;
    sort: number = 1;
    searchValue: string | undefined;
    allVersions: boolean = true;

    constructor(private route: ActivatedRoute, private experiment: CurrentExperimentService, private backend: QhanaBackendService) {
        this.backendUrl = backend.backendRootUrl;
    }

    ngOnInit(): void {
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
        this.routeSubscription?.unsubscribe();
    }

    onPageChange(pageEvent: PageEvent) {
        console.log(pageEvent.pageIndex, pageEvent.pageSize);
        // todo. 
        this.updatePageContent(pageEvent.pageIndex, pageEvent.pageSize, this.sort); // TODO test
    }

    onSort() {
        this.sort *= -1;
        this.updatePageContent(this.currentPage?.page, this.currentPage?.itemCount, this.sort);
    }

    onCheck() {
        this.allVersions = !this.allVersions;
        this.updatePageContent(this.currentPage?.page, this.currentPage?.itemCount, this.sort);
    }

    updatePageContent(page: number = 0, itemCount: number = 10, sort: number = 1) {
        if (this.experimentId == null) {
            return;
        }
        this.loading = true;
        this.error = null;
        const currentRequest = { page: page, itemCount: itemCount };
        this.currentPage = currentRequest;
        this.experimentData = this.backend.getExperimentDataPage(this.experimentId, this.allVersions, this.searchValue, page, itemCount, sort).pipe(
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
