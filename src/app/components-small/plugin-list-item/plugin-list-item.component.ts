import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ApiLink, ApiResponse } from 'src/app/services/api-data-types';
import { PluginApiObject } from 'src/app/services/qhana-api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';

@Component({
    selector: 'qhana-plugin-list-item',
    templateUrl: './plugin-list-item.component.html',
    styleUrls: ['./plugin-list-item.component.sass']
})
export class PluginListItemComponent implements OnChanges {

    @Input() link: ApiLink | null = null;
    @Input() search: string | null = null;

    @Output() isInSearch: EventEmitter<boolean> = new EventEmitter(true);

    plugin: PluginApiObject | null = null;

    private searchableString: string = "";

    constructor(private registry: PluginRegistryBaseService) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.link != null) {
            this.updatePluginData();
            return;
        }
        if (changes.search != null) {
            this.updateIsInSearch();
        }
    }

    async updatePluginData() {
        if (this.link == null) {
            this.plugin = null;
            this.searchableString = "";
            this.updateIsInSearch()
            return;
        }

        // load available data from cache immediately
        const cachePromise = await this.registry.getFromCacheByApiLink<PluginApiObject>(this.link);
        const cacheResponse = await Promise.race([cachePromise, null]);
        this.updatePluginDataFromApiResponse(cacheResponse);
        this.updateIsInSearch();


        // load fresh data from the API
        const pluginResponse = await this.registry.getByApiLink<PluginApiObject>(this.link);

        this.updatePluginDataFromApiResponse(pluginResponse);
        this.updateIsInSearch();
    }

    private updatePluginDataFromApiResponse(pluginResponse: ApiResponse<PluginApiObject> | null) {
        const plugin = pluginResponse?.data ?? null;
        this.plugin = plugin;
        if (plugin != null) {
            this.searchableString = `${plugin.identifier.toLowerCase()} ${plugin.title.toLowerCase()}${plugin.version} ${plugin.pluginType} ${plugin.tags.join(" ").toLowerCase()}`;
        } else {
            this.searchableString = "";
        }
    }

    updateIsInSearch() {
        if (this.plugin == null) {
            this.deferredIsInSearchUpdate(false);
            return;
        }
        if (this.search == null || this.search === "") {
            this.deferredIsInSearchUpdate(true);
            return;
        }
        if (this.searchableString.includes(this.search)) {
            this.deferredIsInSearchUpdate(true);
            return;
        }
        this.deferredIsInSearchUpdate(false);
    }

    /**
     * Use a separate promise to trigger angular change detection in parent
     * component correctly.
     *
     * @param value the new value
     */
    deferredIsInSearchUpdate(value: boolean) {
        Promise.resolve().then(() => {
            this.isInSearch.emit(value);
        });
    }

}
