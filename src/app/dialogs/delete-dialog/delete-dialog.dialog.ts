import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ApiLink, isApiLinkBase } from 'src/app/services/api-data-types';

const RESOURCE_TYPE_TO_TEXT: { [props: string]: string } = {
    'resource': 'resource',
    'seed': 'seed url',
    'service': 'service entry',
    'ui-template': 'UI template',
    'ui-template-tab': 'UI template tab',
}

@Component({
    selector: 'qhana-delete-dialog',
    templateUrl: './delete-dialog.dialog.html',
    styleUrls: ['./delete-dialog.dialog.sass']
})
export class DeleteDialog {

    name: string;
    objectType: string;


    constructor(
        public dialogRef: MatDialogRef<DeleteDialog>,
        @Inject(MAT_DIALOG_DATA) public data: string | ApiLink,
    ) {
        let objectType = 'resource';
        if (isApiLinkBase(data)) {
            this.name = data.name ?? data.href;
            objectType = data.resourceType;
        } else {
            this.name = data;
        }
        this.objectType = RESOURCE_TYPE_TO_TEXT[objectType] ?? objectType;
    }


    accept() {
        this.dialogRef.close(true);
    }

    reject() {
        this.dialogRef.close(false);
    }
}
