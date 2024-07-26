import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChangeUiTemplateDialog } from 'src/app/dialogs/change-ui-template/change-ui-template.dialog';
import { ApiLink, PageApiObject } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateApiObject, TemplatesService } from 'src/app/services/templates.service';

@Component({
    selector: 'qhana-ui-templates-page',
    templateUrl: './ui-templates-page.component.html',
    styleUrl: './ui-templates-page.component.sass'
})
export class UiTemplatesPageComponent implements OnInit, OnDestroy {
    selectedTemplate: ApiLink | null = null;

    highlightedTemplates: Set<string> = new Set();

    templateId: string | null = null;
    private routeParamSubscription: Subscription | null = null;


    constructor(private route: ActivatedRoute, private router: Router, private registry: PluginRegistryBaseService, private templates: TemplatesService, private dialog: MatDialog) { }


    ngOnInit(): void {
        this.routeParamSubscription = this.route.paramMap.subscribe(params => {
            let templateId = params.get('templateId');
            if (templateId != null) {
                this.highlightedTemplates = new Set<string>([templateId]);
            } else {
                this.highlightedTemplates.clear();
            }
            console.log(this.highlightedTemplates, templateId)
            this.loadActiveTemplateFromId(templateId);
        });

    }

    ngOnDestroy(): void {
        this.routeParamSubscription?.unsubscribe();
    }

    selectTemplate(templateLink: ApiLink | null) {
        console.log(templateLink)
        if (templateLink == null) {
            this.router.navigate(["/templates"]);
            return;
        }
        this.selectedTemplate = templateLink;
        this.router.navigate(["/templates", templateLink.resourceKey?.uiTemplateId ?? null]);
    }

    private async loadActiveTemplateFromId(newTemplateId: string | null) {
        if (newTemplateId == null) {
            this.selectedTemplate = null;
            this.highlightedTemplates = new Set();
            return;
        }
        const activeTemplateId = this.selectedTemplate?.resourceKey?.uiTemplateId ?? null;
        if (newTemplateId === activeTemplateId) {
            // nothing to do, link already loaded
            return;
        }
        // need to fetch template api link from plugin registry
        const query = new URLSearchParams();
        query.set("template-id", newTemplateId);
        const templatePage = await this.registry.getByRel<PageApiObject>([["ui-template", "collection"]], query, true);
        if (templatePage?.data.collectionSize === 1) {
            // only expect one template since IDs are unique
            this.selectedTemplate = templatePage.data.items[0];
        } else {
            console.warn(`Template API returned an ambiguous response for template id ${newTemplateId}`, templatePage);
        }
    }


    async createTemplate() {
        const dialogRef = this.dialog.open(ChangeUiTemplateDialog, { data: { template: null }, minWidth: "20rem", maxWidth: "40rem", width: "60%" });
        const templateData: TemplateApiObject = await dialogRef.afterClosed().toPromise();

        if (!templateData) {
            return;
        }
        this.templates.addTemplate(templateData);
    }
}
