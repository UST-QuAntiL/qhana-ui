import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { ApiObjectList, ExperimentDataApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';

@Component({
    selector: 'qhana-choose-data',
    templateUrl: './choose-data.dialog.html',
    styleUrls: ['./choose-data.dialog.sass']
})
export class ChooseDataDialog implements OnInit {

    experimentId: string | null = null;

    acceptedDataTypeMatcher = (dataType: string) => true;
    acceptedContentTypeMatchers = [
        (contentType: string) => true
    ]

    pageSize: number = 10;
    currentPage: number = 0;

    sort: -1 | 0 | 1 = 1;
    searchValue: string | null = null;
    allVersions: boolean = true;

    currentPageSubscription: Subscription | null = null;

    collectionSize = 0;
    dataList: ExperimentDataApiObject[] | null = null;
    matching: Set<string> = new Set();

    selected: ExperimentDataApiObject | null = null;

    constructor(public dialogRef: MatDialogRef<ChooseDataDialog>, @Inject(MAT_DIALOG_DATA) public data: { acceptedDataType: string, acceptedContentTypes: string[] }, private experiment: CurrentExperimentService, private backend: QhanaBackendService) { }

    ngOnInit(): void {
        this.acceptedDataTypeMatcher = this.getMimetypeLikeMatcher(this.data.acceptedDataType);
        this.acceptedContentTypeMatchers = this.data.acceptedContentTypes.map(this.getMimetypeLikeMatcher);
        this.experiment.experimentId.pipe(take(1)).subscribe(id => {
            this.experimentId = id;
            this.loadData();
        });
    }

    loadData() {
        if (this.experimentId == null) {
            return;
        }
        this.currentPageSubscription?.unsubscribe(); // cancel ongoing request
        this.currentPageSubscription = this.backend.getExperimentDataPage(this.experimentId, this.allVersions, this.searchValue, this.data.acceptedDataType, this.currentPage, this.pageSize, this.sort).subscribe((dataPage) => {
            this.prepareDataPage(dataPage)
        });
    }

    prepareDataPage(dataPage: ApiObjectList<ExperimentDataApiObject>) {
        const items: ExperimentDataApiObject[] = [];
        const matching: Set<string> = new Set();
        dataPage.items.forEach(item => {
            if (this.acceptedDataTypeMatcher(item.type)) { // FIXME refactor client side filter into server side filter later
                if (this.acceptedContentTypeMatchers.some(matcher => matcher(item.contentType))) {
                    matching.add(item['@self']);
                }
            }
            // matching.add(item['@self']); // FIXME remove this line
            items.push(item);
        });
        this.collectionSize = dataPage.itemCount;
        this.dataList = items;
        this.matching = matching;
        this.selected = null;
    }

    onSort() {
        this.sort *= -1; // reverse the sorting order
        this.loadData();
    }

    onCheckAllVersions() {
        this.allVersions = !this.allVersions;
        this.loadData();
    }

    onPageChange(event: any) {
        this.currentPage = event.pageIndex;
        this.pageSize = event.pageSize;
        this.loadData();
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
