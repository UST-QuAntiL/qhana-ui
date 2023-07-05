import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiLink, PageApiObject } from 'src/app/services/api-data-types';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { PluginApiObject } from 'src/app/services/qhana-api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';

@Component({
    selector: 'qhana-plugin-tab',
    templateUrl: './plugin-tab.component.html',
    styleUrls: ['./plugin-tab.component.sass']
})
export class PluginTabComponent implements OnInit, OnDestroy {

    private routeParamsSubscription: Subscription | null = null;

    currentExperimentId: string | null = null
    currentTabId: string | null = null;
    currentPluginId: string | null = null;

    plugins: ApiLink[] = [];

    activePlugin: ApiLink | null = null;

    activePluginFrontendUrl: string | null = null;

    constructor(private route: ActivatedRoute, private router: Router, private registry: PluginRegistryBaseService, private experiment: CurrentExperimentService) { }

    ngOnInit(): void {
        this.routeParamsSubscription = this.route.params.subscribe(params => {
            this.currentExperimentId = params?.experimentId ?? null;
            this.experiment.setExperimentId(params?.experimentId ?? null);
            const tabId = params?.templateTabId ?? null;
            this.updatePlugins(tabId);
            const pluginId = params?.pluginId ?? null;
            this.updatePluginId(pluginId);
        });
    }

    ngOnDestroy(): void {
        this.routeParamsSubscription?.unsubscribe();
    }

    private async updatePlugins(templateTabId: string | null) {
        if (templateTabId === this.currentTabId) {
            return;
        }
        this.currentTabId = templateTabId;

        if (templateTabId == null) {
            this.plugins = [];
            return;
        }

        const plugins: ApiLink[] = [];
        this.plugins = plugins;

        const query = new URLSearchParams();
        query.set("template-tab", templateTabId);
        const pluginsResponse = await this.registry.getByRel<PageApiObject>([["plugin", "collection"]], query);


        if ((pluginsResponse?.data?.collectionSize ?? 0) < 25) {
            pluginsResponse?.data?.items?.forEach(pluginLink => plugins.push(pluginLink));
            this.onPluginIdChanges(this.currentPluginId, true);
        }
    }

    private updatePluginId(pluginId: string | null) {
        if (pluginId === this.currentPluginId) {
            return;
        }
        this.currentPluginId = pluginId;
        this.onPluginIdChanges(pluginId);
    }

    private async onPluginIdChanges(pluginId: string | null, navigate = false) {
        if (pluginId == null) {
            if (this.plugins.length === 0) {
                this.updateActivePlugin(null, navigate);
            } else {
                this.updateActivePlugin(this.plugins[0], navigate);
            }
            return;
        }
        let pluginLink = this.plugins.find(plugin => plugin.resourceKey?.pluginId === pluginId);
        if (pluginLink != null) {
            this.updateActivePlugin(pluginLink, navigate);
            return;
        }

        const query = new URLSearchParams();
        query.set("plugin-id", pluginId);
        if (this.currentTabId != null) {
            query.set("template-tab", this.currentTabId);
        }
        const pluginPageResponse = await this.registry.getByRel<PageApiObject>([["plugin", "collection"]], query);

        pluginLink = pluginPageResponse?.data?.items?.[0];
        if (pluginLink != null) {
            this.updateActivePlugin(pluginLink, navigate);
            return;
        }
    }

    private async updateActivePlugin(pluginLink: ApiLink | null, navigate: boolean = false) {
        this.activePlugin = pluginLink;

        if (pluginLink == null) {
            this.activePluginFrontendUrl = null;
        } else {
            const pluginResponse = await this.registry.getByApiLink<PluginApiObject>(pluginLink);
            this.activePluginFrontendUrl = pluginResponse?.data?.entryPoint?.uiHref ?? null; // FIXME for relative URLs!
        }

        if (navigate) {
            const experimentPrefix = this.currentExperimentId != null ? ['/experiments', this.currentExperimentId] : [];
            if (pluginLink != null) {
                this.router.navigate([...experimentPrefix, 'extra', this.currentTabId, 'plugin', pluginLink.resourceKey?.pluginId], { queryParamsHandling: 'preserve' });
            } else {
                this.router.navigate([...experimentPrefix, 'extra', this.currentTabId], { queryParamsHandling: 'preserve' });
            }
        }
    }

}
