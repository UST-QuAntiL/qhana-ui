import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiLink } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateTabApiObject } from 'src/app/services/templates.service';

@Component({
    selector: 'qhana-ui-template-tab',
    templateUrl: './ui-template-tab.component.html',
    styleUrl: './ui-template-tab.component.sass'
})
export class UiTemplateTabComponent implements OnChanges, OnInit, OnDestroy {

    @Input() tabLink: ApiLink | null = null;

    tabData: TemplateTabApiObject | null = null;
    tabFilterData: any = null;
    templateUpdateLink: ApiLink | null = null;
    templateDeleteLink: ApiLink | null = null;

    isEditing: boolean = false;

    private updateSubscription: Subscription | null = null;

    constructor(private registry: PluginRegistryBaseService) { }

    ngOnInit(): void {
        this.updateSubscription = this.registry.apiObjectSubject.subscribe((apiObject) => {
            if (apiObject.self.href !== this.tabLink?.href) {
                return;
            }
            if (apiObject.self.resourceType === "ui-template-tab") {
                this.tabData = apiObject as TemplateTabApiObject;
            }
        });
    }

    ngOnDestroy(): void {
        this.updateSubscription?.unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges): void {
        this.loadTemplateTab();
    }

    private async loadTemplateTab() {
        if (this.tabLink == null) {
            this.tabData = null;
            return;
        }
        const tabResponse = await this.registry.getByApiLink<TemplateTabApiObject>(this.tabLink, null, true);
        this.tabData = tabResponse?.data ?? null;

        if (tabResponse?.data?.filterString) {
            try {
                this.tabFilterData = JSON.parse(tabResponse?.data?.filterString);
            } catch {
                // Ignore error
            }
        }

        this.templateUpdateLink = tabResponse?.links?.find?.(link => link.rel.some(rel => rel === "update") && link.resourceType == "ui-template-tab") ?? null;
        this.templateDeleteLink = tabResponse?.links?.find?.(link => link.rel.some(rel => rel === "delete") && link.resourceType == "ui-template-tab") ?? null;
    }
}
