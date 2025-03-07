import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { ApiObjectList, ExperimentDataApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';

export interface RelatedDataChooserData {
    dataId: string;
    version: string;
    relation: "any" | "exact" | "pre" | "post";
    includeSelf: boolean;
    acceptedDataType: string | null;
    acceptedContentType: string | null;
}

@Component({
    selector: 'qhana-choose-related-data',
    templateUrl: './choose-related-data.dialog.html',
    styleUrls: []
})
export class ChooseRelatedDataDialog implements OnInit {

    experimentId: string | null = null;

    acceptedDataTypeMatcher = (dataType: string) => true;
    acceptedContentTypeMatcher = (contentType: string) => true;

    relatedDataSubscription: Subscription | null = null;

    collectionSize = 0;
    dataList: ExperimentDataApiObject[] | null = null;
    matching: Set<string> = new Set();

    selected: ExperimentDataApiObject | null = null;

    dataType: string | null = null;
    contentType: string | null = null;

    constructor(public dialogRef: MatDialogRef<ChooseRelatedDataDialog>, @Inject(MAT_DIALOG_DATA) public data: RelatedDataChooserData, private experiment: CurrentExperimentService, private backend: QhanaBackendService) { }

    ngOnInit(): void {
        this.acceptedDataTypeMatcher = this.getMimetypeLikeMatcher(this.data.acceptedDataType ?? "*/*");
        this.acceptedContentTypeMatcher = this.getMimetypeLikeMatcher(this.data.acceptedContentType ?? "*/*");
        this.dataType = this.data.acceptedDataType ?? "*/*";
        this.contentType = this.data.acceptedContentType ?? "*/*";
        this.experiment.experimentId.pipe(take(1)).subscribe(id => {
            this.experimentId = id;
            this.loadData();
        });
    }

    loadData() {
        if (this.experimentId == null) {
            return;
        }
        this.relatedDataSubscription?.unsubscribe(); // cancel ongoing request
        this.relatedDataSubscription = this.backend.getRelatedExperimentData(this.experimentId, this.data.dataId, this.data.version, this.data.relation, this.data.includeSelf ?? false, this.data.acceptedDataType ?? null, this.data.acceptedContentType ?? null).subscribe((dataPage) => {
            this.prepareDataPage(dataPage)
        });
    }

    prepareDataPage(dataPage: ApiObjectList<ExperimentDataApiObject>) {
        const items: ExperimentDataApiObject[] = [];
        const matching: Set<string> = new Set();
        dataPage.items.forEach(item => {
            if (this.acceptedDataTypeMatcher(item.type)) {
                if (this.acceptedContentTypeMatcher(item.contentType)) {
                    matching.add(item['@self']);
                }
            }
            items.push(item);
        });
        this.collectionSize = dataPage.itemCount;
        this.dataList = items;
        this.matching = matching;
        this.selected = null;
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onOk(): void {
        this.dialogRef.close();
    }

    getMimetypeLikeMatcher(pattern: string) {
        if (pattern === "*" || pattern === "*/*" || pattern === "/") {
            return (typeString: string) => true;
        }
        if (pattern.startsWith("*/") || pattern.startsWith("/")) {
            const suffix = pattern.replace("^\*?/", "");
            return (typeString: string) => typeString.endsWith(suffix);
        }
        if (pattern.endsWith("/*") || pattern.endsWith("/") || !pattern.includes("/")) {
            const prefix = pattern.replace("/\*?$", "");
            const extendedPrefix = prefix + "/";
            return (typeString: string) => typeString.startsWith(extendedPrefix) || typeString === prefix;
        }
        return (typeString: string) => typeString === pattern;
    }

}
