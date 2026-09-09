import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ApiLink, PageApiObject } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { ALL_PLUGINS_TEMPLATE_ID, TemplateApiObject, TemplatesService } from 'src/app/services/templates.service';

@Component({
    selector: 'qhana-experiment-workspace-detail',
    templateUrl: './experiment-workspace-detail.component.html',
    styleUrls: ['./experiment-workspace-detail.component.sass'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ExperimentWorkspaceDetailComponent implements OnInit {

    routeTemplateId: string | null = null;
    defaultTemplateId: string | null = null;
    templateId: string | null = null;
    tabId: string | null = null;

    templateLink: ApiLink | null = null;

    templateObject: TemplateApiObject | null = null;

    private changedTemplateSubscription: Subscription | null = null;

    private routeParamSubscription: Subscription | null = null;
    private defaultTemplateIdSubscription: Subscription | null = null;

    constructor(private route: ActivatedRoute, private registry: PluginRegistryBaseService, private templates: TemplatesService) { }

    ngOnInit() {
        this.routeParamSubscription = this.route.queryParamMap.subscribe(async params => {
            let templateId = params.get('template');
            if (templateId === ALL_PLUGINS_TEMPLATE_ID) {
                // treat builtin template as default template for the workspace details
                templateId = null;
            }
            this.routeTemplateId = templateId;

            this.updateTemplateId(templateId ?? this.defaultTemplateId);

            const tabId = params.get('tab');
            if (tabId !== this.tabId) {
                this.tabId = tabId;
            }
        });
        this.registerObjectSubscriptions();
    }

    ngOnDestroy() {
        this.changedTemplateSubscription?.unsubscribe();
        this.routeParamSubscription?.unsubscribe();
        this.defaultTemplateIdSubscription?.unsubscribe();
    }

    private registerObjectSubscriptions() {
        this.defaultTemplateIdSubscription = this.templates.defaultTemplateId.subscribe(defaultTemplateId => {
            this.defaultTemplateId = defaultTemplateId;

            this.updateTemplateId(this.routeTemplateId ?? this.defaultTemplateId);
        });

        // update template object if selected template changed
        this.changedTemplateSubscription = this.registry.changedApiObjectSubject
            .pipe(filter(changedObject => changedObject.changed.resourceType === "ui-template" && changedObject.changed.resourceKey?.uiTemplateId === this.templateId))
            .subscribe(async changedObject => {
                const template = await this.registry.getByApiLink<TemplateApiObject>(changedObject.changed);
                this.templateObject = template?.data ?? null;
            });
    }

    private async updateTemplateId(templateId: string | null) {
        if (templateId == null || templateId === "") {
            return; // no template selected
        }
        if (templateId === this.templateId) {
            return; // template id did not change
        }
        this.templateId = templateId;
        const query = new URLSearchParams();
        query.set("template-id", templateId);
        const templateResponse = await this.registry.getByRel<PageApiObject>([["ui-template", "collection"]], query, true);
        if (templateResponse?.data?.items?.length === 1) {
            this.templateLink = templateResponse.data.items[0]
        } else {
            console.warn("Template not found");
            return;
        }
        this.templateObject = (await this.templates.getTemplate(templateId))?.data ?? null;
    }

}
