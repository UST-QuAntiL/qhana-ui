import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { DeleteDialog } from 'src/app/dialogs/delete-dialog/delete-dialog.dialog';
import { ApiLink } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateTabApiObject } from 'src/app/services/templates.service';
import { UiTemplateTabFormComponent } from '../ui-template-tab-form/ui-template-tab-form.component';

@Component({
    selector: 'qhana-ui-template-tab',
    templateUrl: './ui-template-tab.component.html',
    styleUrl: './ui-template-tab.component.sass'
})
export class UiTemplateTabComponent implements OnChanges, OnInit, OnDestroy {

    @Input() tabLink: ApiLink | null = null;
    @Input() useCache: boolean = false;

    @ViewChild(UiTemplateTabFormComponent) tabFormChild: UiTemplateTabFormComponent | null = null;

    tabData: TemplateTabApiObject | null = null;
    tabFilterData: any = null;
    tabUpdateLink: ApiLink | null = null;
    tabDeleteLink: ApiLink | null = null;

    isEditing: boolean = false;

    isValid: boolean = false;
    isDirty: boolean = false;
    newData: any = null;

    private updateSubscription: Subscription | null = null;

    constructor(private registry: PluginRegistryBaseService, private dialog: MatDialog) { }

    ngOnInit(): void {
        this.updateSubscription = this.registry.apiObjectSubject.subscribe((apiObject) => {
            if (apiObject.self.href !== this.tabLink?.href) {
                return;
            }
            if (apiObject.self.resourceType === "ui-template-tab") {
                const tab = apiObject as TemplateTabApiObject;
                this.tabData = tab;

                if (tab.filterString) {
                    try {
                        this.tabFilterData = JSON.parse(tab.filterString);
                    } catch {
                        // Ignore error
                    }
                }
            }
        });
    }

    ngOnDestroy(): void {
        this.updateSubscription?.unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.tabLink != null) {
            this.loadTemplateTab();
        }
    }

    private async loadTemplateTab() {
        if (this.tabLink == null) {
            this.tabData = null;
            return;
        }
        const tabResponse = await this.registry.getByApiLink<TemplateTabApiObject>(this.tabLink, null, !this.useCache);
        this.tabData = tabResponse?.data ?? null;

        if (tabResponse?.data?.filterString) {
            try {
                this.tabFilterData = JSON.parse(tabResponse?.data?.filterString);
            } catch {
                // Ignore error
            }
        }

        this.tabUpdateLink = tabResponse?.links?.find?.(link => link.rel.some(rel => rel === "update") && link.resourceType == "ui-template-tab") ?? null;
        this.tabDeleteLink = tabResponse?.links?.find?.(link => link.rel.some(rel => rel === "delete") && link.resourceType == "ui-template-tab") ?? null;
    }

    updateTab() {
        if (this.tabUpdateLink == null) {
            return;
        }
        if (!this.isValid || !this.newData) {
            return;
        }

        this.registry.submitByApiLink(this.tabUpdateLink, this.newData);
    }

    async deleteTab() {
        if (this.tabDeleteLink == null) {
            return;
        }

        const dialogRef = this.dialog.open(DeleteDialog, {
            data: this.tabLink,
        });

        const doDelete = await dialogRef.afterClosed().toPromise();
        if (doDelete) {
            this.registry.submitByApiLink(this.tabDeleteLink);
        }
    }
}
