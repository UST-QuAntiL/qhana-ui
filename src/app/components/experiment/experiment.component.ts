import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, Subscription } from 'rxjs';
import { debounceTime, filter, map } from 'rxjs/operators';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { ExperimentApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-experiment',
    templateUrl: './experiment.component.html',
    styleUrls: ['./experiment.component.sass']
})
export class ExperimentComponent implements OnInit, OnDestroy {

    private routeSubscription: Subscription | null = null;

    private experimentSubscription: Subscription | null = null;

    private lastSavedTitle: string = "";
    private lastSavedDescription: string = "";
    private titleUpdates: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
    private descriptionUpdates: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);
    private autoSaveTitleSubscription: Subscription | null = null;
    private autoSaveDescriptionSubscription: Subscription | null = null;

    updateStatus: "original" | "changed" | "saved" = "original";

    experimentId: string | null = null;
    experiment: ExperimentApiObject | null = null;

    experimentName: string | null = null;
    experimentDescription: string = ""; // only updated on initial experiment load
    currentExperimentDescription: string = "";

    constructor(private route: ActivatedRoute, private router: Router, private experimentService: CurrentExperimentService, private backend: QhanaBackendService) { }

    ngOnInit(): void {
        this.routeSubscription = this.route.params.pipe(map(params => params.experimentId)).subscribe(experimentId => {
            this.experimentId = experimentId;
            this.experimentService.setExperimentId(experimentId);
        });
        this.experimentSubscription = this.experimentService.experiment.pipe(
            filter(experiment => experiment?.experimentId !== this.experiment?.experimentId)
        ).subscribe(experiment => {
            this.experiment = experiment;
            this.lastSavedDescription = experiment?.description ?? "";
            this.experimentDescription = experiment?.description ?? "";
            this.currentExperimentDescription = experiment?.description ?? "";
        });
        this.autoSaveTitleSubscription = this.titleUpdates.pipe(
            filter(value => value != null && value !== this.lastSavedTitle),
            debounceTime(500)
        ).subscribe(this.saveTitle);
        this.autoSaveDescriptionSubscription = this.descriptionUpdates.pipe(
            filter(value => value != null && value !== this.lastSavedDescription),
            debounceTime(500)
        ).subscribe(this.saveDescription);
    }

    ngOnDestroy(): void {
        this.routeSubscription?.unsubscribe();
        this.experimentSubscription?.unsubscribe();
        this.autoSaveTitleSubscription?.unsubscribe();
        this.autoSaveDescriptionSubscription?.unsubscribe();
    }

    cloneExperiment() {
        const experimentId = this.experimentId;
        if (experimentId == null) {
            return; // no experiment to clone...
        }
        this.backend.cloneExperiment(experimentId).subscribe(clonedExperiment => {
            this.router.navigate(['/experiments', clonedExperiment.experimentId, "info"]);
        });
    }

    editExperimentName() {
        this.experimentName = this.experiment?.name ?? null;
        this.lastSavedTitle = this.experiment?.name ?? "";
    }

    cancelEditExperimentName() {
        this.experimentName = null;
    }

    updateTitle(newTitle: string) {
        if (newTitle !== this.lastSavedTitle) {
            this.updateStatus = 'changed';
        }
        this.titleUpdates.next(newTitle);
    }

    updateDescription(newDescription: string) {
        if (this.updateStatus === "original") {
            if (newDescription == "" || newDescription === this.experiment?.description) {
                // do not update anything if it has not been changed by the user!
                return;
            }
        }
        this.currentExperimentDescription = newDescription;
        if (newDescription !== this.lastSavedDescription) {
            this.updateStatus = 'changed';
        }
        this.descriptionUpdates.next(newDescription);
    }

    saveTitle = (newTitle: string | null) => {
        if (newTitle == null) {
            return;
        }
        const description = this.currentExperimentDescription;
        if (newTitle === this.lastSavedTitle && description == this.lastSavedDescription) {
            return; // title is already saved!
        }
        if (this.experimentId == null || description == null) {
            return;
        }
        this.backend.updateExperiment(this.experimentId, newTitle, description).subscribe(result => {
            this.lastSavedTitle = newTitle;
            this.lastSavedDescription = description;
            this.experiment = result;
            this.updateStatus = 'saved';
            this.experimentService.reloadExperiment();
        });
    }

    saveDescription = (newDescription: string | null) => {
        if (newDescription == null) {
            return;
        }
        const title = this.experimentName ?? this.experiment?.name;
        if (title === this.lastSavedTitle && newDescription == this.lastSavedDescription) {
            return; // title is already saved!
        }
        if (this.experimentId == null || title == null) {
            return;
        }
        this.backend.updateExperiment(this.experimentId, title, newDescription).subscribe(result => {
            this.lastSavedTitle = title;
            this.lastSavedDescription = newDescription;
            this.experiment = result;
            this.updateStatus = 'saved';
            this.experimentService.reloadExperiment();
        });
    }

}
