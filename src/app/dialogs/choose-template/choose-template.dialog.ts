import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ApiLink } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateApiObject } from 'src/app/services/templates.service';

@Component({
    selector: 'qhana-choose-template',
    templateUrl: './choose-template.dialog.html',
    styleUrls: ['./choose-template.dialog.sass'],
    standalone: false
})
export class ChooseTemplateDialog implements OnInit {
    highlightedTemplateSet: Set<string> = new Set();
    templateId: string | null = null;
    template: TemplateApiObject | null = null;

    constructor(public dialogRef: MatDialogRef<ChooseTemplateDialog>, @Inject(MAT_DIALOG_DATA) public data: TemplateApiObject, private registry: PluginRegistryBaseService) {
        if (data != null && data.self.resourceKey?.uiTemplateId != null) {
            const templateId = data.self.resourceKey?.uiTemplateId;
            this.templateId = templateId;
            this.highlightedTemplateSet = new Set([templateId]);
            this.template = data;
        }
    }

    ngOnInit(): void {
    }

    async selectTemplate(templateLink: ApiLink) {
        const templateId = templateLink.resourceKey?.uiTemplateId ?? null;
        if (templateId == null) {
            return;
        }
        if (this.highlightedTemplateSet.has(templateId)) {
            // double click deselects template
            this.highlightedTemplateSet.clear();
            this.templateId = null;
            this.template = null;
            return;
        }
        this.highlightedTemplateSet.clear();
        this.highlightedTemplateSet = new Set([templateId]);
        const template = await this.registry.getByApiLink<TemplateApiObject>(templateLink, null, false);
        this.template = template?.data ?? null;
        this.templateId = templateId;
    }

    onCancel(): void {
        this.dialogRef.close();
    }
}
