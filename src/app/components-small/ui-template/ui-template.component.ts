import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiLink, ChangedApiObject } from 'src/app/services/api-data-types';
import { TemplateApiObject } from 'src/app/services/templates.service';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { MatChipInputEvent } from '@angular/material/chips';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { DeleteDialog } from 'src/app/dialogs/delete-dialog/delete-dialog.dialog';

@Component({
    selector: 'qhana-ui-template',
    templateUrl: './ui-template.component.html',
    styleUrl: './ui-template.component.sass'
})
export class UiTemplateComponent implements OnChanges, OnInit, OnDestroy {

    @Input() templateLink: ApiLink | null = null;


    templateData: TemplateApiObject | null = null;
    templateUpdateLink: ApiLink | null = null;
    templateDeleteLink: ApiLink | null = null;

    isEditing: boolean = false;

    currentName: string | null = null;
    currentTags: string[] | null = null;
    currentDescription: string | null = null;

    private tagsDirty: boolean = false;
    private updateSubscription: Subscription | null = null;

    constructor(private registry: PluginRegistryBaseService, private dialog: MatDialog) { }

    ngOnInit(): void {
        this.updateSubscription = this.registry.apiObjectSubject.subscribe((apiObject) => {
            if (apiObject.self.href !== this.templateLink?.href) {
                return;
            }
            if (apiObject.self.resourceType === "ui-template") {
                this.templateData = apiObject as TemplateApiObject;
                if (this.isEditing) {
                    this.currentTags = [...(apiObject as TemplateApiObject).tags];
                    this.tagsDirty = false;
                }
            }
        });
    }

    ngOnDestroy(): void {
        this.updateSubscription?.unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges): void {
        this.loadTemplate();
    }

    private async loadTemplate() {
        if (this.templateLink == null) {
            this.templateData = null;
            return;
        }
        const templateResponse = await this.registry.getByApiLink<TemplateApiObject>(this.templateLink);
        this.templateData = templateResponse?.data ?? null;

        this.templateUpdateLink = templateResponse?.links?.find(link => link.rel.some(rel => rel === "update") && link.resourceType == "ui-template") ?? null;
        this.templateDeleteLink = templateResponse?.links?.find(link => link.rel.some(rel => rel === "delete") && link.resourceType == "ui-template") ?? null;
    }

    get isDirty() {
        if (!this.isEditing) {
            return false;
        }
        if (this.currentName !== this.templateData?.name) {
            return true;
        }
        if (this.currentDescription !== this.templateData?.description) {
            return true;
        }
        if (this.tagsDirty) {
            return true;
        }
        return false;
    }

    toggleEdit() {
        if (this.templateData == null || this.templateUpdateLink == null) {
            this.isEditing = false;
        } else {
            this.isEditing = !this.isEditing;
        }
        if (this.isEditing) {
            this.currentName = this.templateData?.name ?? null;
            this.currentTags = [...(this.templateData?.tags ?? [])];
            this.currentDescription = this.templateData?.description ?? null;
            this.tagsDirty = false;
        } else {
            this.currentName = null;
            this.currentTags = null;
            this.currentDescription = null;
            this.tagsDirty = false;
        }
    }

    removeTag(tag: string) {
        this.currentTags = this.currentTags?.filter(t => t !== tag) ?? null;
        this.tagsDirty = true;
    }

    addTag(event: MatChipInputEvent) {
        const tag = event.value;
        this.currentTags?.push(tag);
        this.tagsDirty = true;
    }

    async updateTemplate() {
        if (!this.isDirty || this.templateUpdateLink == null) {
            return;
        }

        this.registry.submitByApiLink(this.templateUpdateLink, {
            name: this.currentName,
            description: this.currentDescription,
            tags: this.currentTags,
        });
    }

    async deleteTemplate() {
        if (this.templateDeleteLink == null) {
            return;
        }

        const dialogRef = this.dialog.open(DeleteDialog, {
            data: this.templateLink,
        });

        const doDelete = await dialogRef.afterClosed().toPromise();
        if (doDelete) {
            this.registry.submitByApiLink(this.templateDeleteLink);
        }
    }

}
