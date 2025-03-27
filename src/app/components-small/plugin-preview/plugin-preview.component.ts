import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ApiLink } from 'src/app/services/api-data-types';
import { isPluginApiObject, PluginApiObject } from 'src/app/services/qhana-api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { getMimetypeLikeMatcher } from 'src/app/utils';


@Component({
    selector: 'qhana-plugin-preview',
    templateUrl: './plugin-preview.component.html',
    styleUrls: ['./plugin-preview.component.sass']
})
export class PluginPreviewComponent implements OnChanges {

    @Input() src: string | null = null;
    @Input() dataType: string | null = null;
    @Input() contentType: string | null = null;
    @Input() plugin: ApiLink | null = null;

    pluginApiObject: PluginApiObject | null = null;

    previewUrl: string | null = null;

    constructor(private registry: PluginRegistryBaseService) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.plugin != null) {
            if (this.pluginApiObject?.self?.href === this.plugin?.href) {
                return; // nothing changed
            }
            this.pluginApiObject = null; // reset first
            this.updatePlugin();
        }
        this.updatePreviewUrl();
    }

    private async updatePlugin() {
        const pluginLink = this.plugin;
        if (pluginLink == null) {
            this.updatePreviewUrl();
            return;
        }
        const pluginObject = await this.registry.getByApiLink(pluginLink, null, false);
        if (pluginObject == null || !isPluginApiObject(pluginObject.data)) {
            this.updatePreviewUrl();
            return;
        }
        this.pluginApiObject = pluginObject.data;
        this.updatePreviewUrl();
    }

    private updatePreviewUrl(): void {
        const plugin = this.pluginApiObject;
        if (plugin == null || this.src == null) {
            this.previewUrl = null;
            return;
        }

        let frontendUrl: string | null = plugin?.entryPoint?.uiHref;
        if (frontendUrl != null) {
            const base = new URL(plugin?.href ?? "");
            // const pluginOrigin = base.origin;
            if (frontendUrl.startsWith("/")) {
                frontendUrl = base.origin + frontendUrl;
            }
            if (frontendUrl.startsWith("./")) {
                frontendUrl = base.href + frontendUrl;
            }
        }
        if (frontendUrl == null) {
            // TODO provide visual error feedback for user
            this.previewUrl = null;
            return;
        }
        const url = new URL(frontendUrl);
        const param = this.getParameter(plugin, this.dataType, this.contentType);
        if (param == null) {
            // TODO provide visual error feedback for user
            this.previewUrl = null;
            return;
        }
        url.searchParams.set(param, this.src);
        this.previewUrl = url.toString();
    }

    private getParameter(plugin: PluginApiObject, dataType: string | null, contentType: string | null) {
        const dataTypeMatcher = getMimetypeLikeMatcher(dataType);
        const contentTypeMatcher = getMimetypeLikeMatcher(contentType);

        let param: string | null = null;
        let required: boolean = false;

        plugin.entryPoint.dataInput.forEach(input => {
            if (!dataTypeMatcher(input.dataType)) {
                return;
            }
            if (!input.contentType.some((cType) => contentTypeMatcher(cType))) {
                return;
            }
            const par = input.parameter ?? "data";
            if (param == null) {
                param = par;
                required = input.required ?? false;
                return;
            }
            if (required) {
                // already found a required input, do not override it
                return;
            }
            if (input.required) {
                // only override a found param if the new one is required
                param = par;
                required = true;
            }
        });
        return param;
    }
}
