import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, interval, of, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ExperimentImportApiObject, ExperimentImportPollObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-import-experiment',
    templateUrl: './import-experiment.component.html',
    styleUrls: ['./import-experiment.component.sass'],
    standalone: false
})
export class ImportExperimentComponent {

    selectedFile: File | null = null;
    isImporting: boolean = false;

    importProgress: number | null = null;
    importStep: "upload" | "processing" | "navigating" | null = null;

    importError: string | null = null;

    private importSubscription: Subscription | null = null;


    constructor(private backend: QhanaBackendService, private router: Router) { }

    startImport(file: File | null) {
        if (this.isImporting) {
            return;
        }
        if (file == null) {
            return;
        }
        this.isImporting = true;
        this.importProgress = 0;
        this.importStep = "upload";
        this.importSubscription?.unsubscribe();
        this.importSubscription = this.backend.importExperiment(file)
            .subscribe(result => {
                if (result.uploadStatus === "FAILURE") {
                    this.onImportError("Uploading the file failed!");
                    return;
                }
                if (result.uploadStatus === "DONE") {
                    this.waitForImport(result);
                    return;
                }
                this.importProgress = result.progress;
            });
    }

    private waitForImport(result: ExperimentImportApiObject) {
        const importId = result.importId;
        if (importId == null) {
            this.onImportError("Missing import id, something went wrong with the experiment import!");
            return;
        }
        this.importSubscription?.unsubscribe();
        this.importStep = "processing";
        this.importProgress = null;
        this.importSubscription = interval(1000)
            .pipe(
                switchMap(() => this.backend.importExperimentPoll(importId))
            )
            .subscribe(resp => {
                if (resp.status === "SUCCESS") {
                    this.onProcessingFinished(resp);
                    return;
                }
                if (resp.status === "Failure") {
                    this.onImportError("Something went wrong processing the uploaded experiment. Check errors at backend.");
                    return;
                }
                if (resp.status !== "Pending") {
                    console.warn("Received unkown import status from backend!");
                }
            });
    }

    private onProcessingFinished(result: ExperimentImportPollObject) {

        const experimentId = result.experimentId;

        if (experimentId == null) {
            this.onImportError("Could not import experiment, no experiment id given!");
            return;
        }

        this.importSubscription?.unsubscribe();
        this.importStep = "navigating";
        this.importProgress = null;

        this.importSubscription = timer(500, 1000).pipe(
            switchMap(() => this.backend.getExperiment(experimentId)),
            catchError(err => {
                console.log(err);
                return of(null);
            }),
        ).subscribe(experiment => {
            if (experiment != null) {
                this.stopImport();
                this.router.navigate(["/experiments", experimentId, "info"]);
            }
        });
    }

    onImportError(reason: string) {
        this.stopImport();
        this.importError = reason;
    }

    stopImport() {
        this.isImporting = false;
        this.importSubscription?.unsubscribe();
        this.importProgress = null;
        this.importStep = null;
    }

}

