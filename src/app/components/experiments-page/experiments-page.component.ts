import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CreateExperimentDialog } from 'src/app/dialogs/create-experiment/create-experiment.dialog';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { ExperimentApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-experiments-page',
    templateUrl: './experiments-page.component.html',
    styleUrls: ['./experiments-page.component.sass'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ExperimentsPageComponent implements OnInit {

    showImport: boolean = false;

    collectionSize: number = 0;

    loading: boolean = true;
    currentPage: { page: number, itemCount: number } | null = null;

    error: string | null = null;

    experiments: Observable<ExperimentApiObject[]> | null = null;
    searchValue: string = "";
    sort: -1 | 0 | 1 = 1;

    constructor(private router: Router, private backend: QhanaBackendService, private experimentService: CurrentExperimentService, public dialog: MatDialog) { }

    ngOnInit(): void {
        this.experimentService.setExperimentId(null);
        this.updatePageContent();
    }

    onPageChange(pageEvent: PageEvent) {
        this.updatePageContent(pageEvent.pageIndex, pageEvent.pageSize, this.sort);
    }

    onSort(): void {
        this.sort *= -1; // reverse the sorting order
        this.updatePageContent(this.currentPage?.page, this.currentPage?.itemCount, this.sort)
    }

    updatePageContent(page: number = 0, itemCount: number = 10, sort: number = 1) {
        this.loading = true;
        this.error = null;
        const currentRequest = { page: page, itemCount: itemCount };
        this.currentPage = currentRequest;
        this.experiments = this.backend.getExperimentsPage(page, itemCount, this.searchValue, sort).pipe(
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

    showCreateExperimentDialog() {
        const dialogRef = this.dialog.open(CreateExperimentDialog, { minWidth: "20rem", maxWidth: "40rem", width: "60%" });
        dialogRef.afterClosed().subscribe(result => {
            if (result == null) {
                return; // dialog was cancelled
            }

            if (result.name == null || result.name === "" || result.description == null) {
                console.error("Incorrect experiment data!", result);
                return;
            }
            this.backend.createExperiment(result.name, result.description).subscribe(experiment => {
                this.router.navigate(["/experiments", experiment.experimentId.toString(), "info"]);
            });
        });
    }

    showImportExperimentDialog() {
        /*const dialogRef = this.dialog.open(ImportExperimentDialog, { minWidth: "20rem", maxWidth: "40rem", width: "60%" });
        dialogRef.afterClosed().subscribe(result => {
            if (result == null) {
                return; // dialog was cancelled
            }

            if (result.experimentId == null) {
                console.error("Incorrect experiment data! Cannot find experiment.", result);
                return;
            }

            this.router.navigate(["/experiments", result.experimentId.toString(), "info"]);
        });*/
    }
}
