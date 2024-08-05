import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ApiLink } from 'src/app/services/api-data-types';
import { PluginApiObject } from 'src/app/services/qhana-api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';

interface PluginRestrictions {
    pluginTags: string[];
    pluginName?: string;
    pluginVersion?: string;
}

@Component({
    selector: 'qhana-choose-plugin',
    templateUrl: './choose-plugin.dialog.html',
    styleUrls: ['./choose-plugin.dialog.sass']
})
export class ChoosePluginDialog {

    highlightedPluginSet: Set<string> = new Set();
    selectedPlugin: PluginApiObject | null = null;

    queryParams: URLSearchParams | null = null;

    constructor(public dialogRef: MatDialogRef<ChoosePluginDialog>, @Inject(MAT_DIALOG_DATA) public data: PluginRestrictions | null, private registry: PluginRegistryBaseService) {
        const query = new URLSearchParams();
        if (data?.pluginTags) {
            const tag_list = data.pluginTags.join(",");
            console.log(tag_list, data.pluginTags)
            query.set("tags", tag_list);
        }
        if (data?.pluginName) {
            query.set("name", data.pluginName);
        }
        if (data?.pluginVersion) {
            query.set("version", data.pluginVersion)
        }
        this.queryParams = query;
        console.log(query.toString())
    }

    async selectPlugin(pluginLink: ApiLink) {
        let pluginId = pluginLink.resourceKey?.pluginId ?? null;
        if (pluginId == null) {
            return;
        }
        if (this.highlightedPluginSet.has(pluginId)) {
            // double click deselects plugin
            this.highlightedPluginSet.clear();
            this.selectedPlugin = null;
            return;
        }
        this.highlightedPluginSet.clear();
        const plugin = await this.registry.getByApiLink<PluginApiObject>(pluginLink, null, false);
        this.highlightedPluginSet = new Set([pluginId]);
        this.selectedPlugin = plugin?.data ?? null;
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onOk(): void {
        this.dialogRef.close(this.selectPlugin);
    }

}
