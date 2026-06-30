import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TemplateApiObject } from 'src/app/services/templates.service';

@Component({
    selector: 'qhana-change-ui-template',
    templateUrl: './change-ui-template.dialog.html',
    styleUrls: ['./change-ui-template.dialog.sass'],
    standalone: false
})
export class ChangeUiTemplateDialog implements OnInit {

    templateName: string = "";
    templateDescription: string = "";
    templateTags: string[] = [];
    tagName: string = "";

    constructor(public dialogRef: MatDialogRef<ChangeUiTemplateDialog>, @Inject(MAT_DIALOG_DATA) public data: { template: TemplateApiObject | null }) { }

    ngOnInit(): void {
        this.templateName = this.data.template?.name || "";
        this.templateDescription = this.data.template?.description || "";
        this.templateTags = this.data.template?.tags || [];
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onOk(): void {
        this.dialogRef.close();
    }

    addTag() {
        let trimmedTag = this.tagName.trim();
        if (!trimmedTag) return;
        
        if (this.templateTags.includes(trimmedTag)) {
            return;
        }

        this.templateTags.push(this.tagName.trim());
        this.tagName = '';
    }

    removeTag(tag: string) {
        this.templateTags.splice(this.templateTags.indexOf(tag), 1);
    }
}
