import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { PluginsService, QhanaPlugin } from 'src/app/services/plugins.service';
import { ExperimentDataApiObject, QhanaBackendService, TimelineStepApiObject } from 'src/app/services/qhana-backend.service';

const SPECIAL_MIMETYPES = new Set(["text/html", "text/markdown", "application/x-www-form-urlencoded"]);
const NO_INTERNAL_PREVIEW = new Set(["text/csv"]);

interface PreviewOption {
    type: "internal" | "plugin",
    name: string,
    plugin?: QhanaPlugin,
}

function isDataApiObject(input: ExperimentDataApiObject | TimelineStepApiObject): input is ExperimentDataApiObject {
    if ((input as any).contentType != null && (input as any).download != null) {
        return true;
    }
    return false;
}

function isStepApiObject(input: ExperimentDataApiObject | TimelineStepApiObject): input is TimelineStepApiObject {
    if ((input as any).parametersContentType != null && (input as any).parameters != null) {
        return true;
    }
    return false;
}

interface PreviewData {
    url: string;
    contentType: string;
    dataType: string;
}

interface TableRowData {
    [prop: string]: unknown,
}

@Component({
    selector: 'qhana-data-preview',
    templateUrl: './data-preview.component.html',
    styleUrls: ['./data-preview.component.sass']
})
export class DataPreviewComponent implements OnChanges {

    @Input() data: ExperimentDataApiObject | TimelineStepApiObject | null = null;

    previewData: PreviewData | null = null;

    previewOptions: PreviewOption[] = [];
    chosenPreview: PreviewOption | null = null;
    dataUrl: SafeResourceUrl | null = null;
    effectiveMimetype: string | null = null;
    content: string = "";
    tableContent: TableRowData[] = [];
    tooLargeToPreview: boolean = false;

    constructor(private backend: QhanaBackendService, private sanitizer: DomSanitizer, private plugins: PluginsService) { }

    ngOnChanges(): void {
        let previewData: PreviewData | null = null;
        if (this.data == null) {
            // todo nothing to preview
        } else if (isDataApiObject(this.data)) {
            previewData = {
                url: this.backend.backendRootUrl + this.data.download,
                dataType: this.data.type,
                contentType: this.data.contentType,
            };
        } else if (isStepApiObject(this.data)) {
            previewData = {
                url: this.backend.backendRootUrl + this.data.parameters,
                dataType: "parameters",
                contentType: this.data.parametersContentType,
            };
        }
        this.previewData = previewData;
        this.updateData();
    }

    async updateData() {
        this.tooLargeToPreview = false;
        let contentType = this.previewData?.contentType ?? null;
        let mimetype = contentType;
        const previewOptions: PreviewOption[] = [];
        if (mimetype) {
            if (!SPECIAL_MIMETYPES.has(mimetype)) {
                if (mimetype.startsWith("text/")) {
                    if (!NO_INTERNAL_PREVIEW.has(mimetype)) {
                        previewOptions.push({ type: "internal", name: "Text-File Preview" });
                    }
                    mimetype = "text/*";
                }
                if (mimetype.startsWith("image/")) {
                    if (!NO_INTERNAL_PREVIEW.has(mimetype)) {
                        previewOptions.push({ type: "internal", name: "Image Preview" });
                    }
                    mimetype = "image/*";
                }
            } else {
                if (mimetype === "text/markdown") {
                    previewOptions.push({ type: "internal", name: "Markdown Preview" });
                }
                if (mimetype === "text/html") {
                    previewOptions.push({ type: "internal", name: "HTML Preview" });
                }
                if (mimetype === "application/x-www-form-urlencoded") {
                    previewOptions.push({ type: "internal", name: "Request Parameters Preview" });
                }
            }
        }
        if (contentType != null) {
            const availablePlugins = await this.getVisualizationPlugins(this.previewData);
            availablePlugins.forEach(plugin => {
                previewOptions.push({ type: "plugin", name: plugin.metadata.title ?? plugin.pluginDescription.name, plugin });
            });
        }
        const downloadUrl = this.previewData?.url;
        if (downloadUrl) {
            this.previewOptions = previewOptions;
            this.chosenPreview = previewOptions[0] ?? null;
            this.effectiveMimetype = mimetype;
            this.dataUrl = this.sanitizer.bypassSecurityTrustResourceUrl(downloadUrl);
            if (mimetype === "text/markdown") {
                this.backend.getExperimentDataContent(downloadUrl).subscribe((blob) => {
                    if (blob.type === mimetype && blob.size < 1048576) {
                        // preview must be markdown and not too large!
                        blob.text().then((text) => this.content = text);
                    } else {
                        this.tooLargeToPreview = blob.size >= 1048576;
                        this.content = ":warning: The data content is not of type markdown or too large to preview.";
                    }
                })
            }
            if (mimetype === "application/x-www-form-urlencoded") {
                console.log(downloadUrl)
                this.backend.getExperimentDataContent(downloadUrl).subscribe((blob) => {
                    if (blob.type === mimetype && blob.size < 1048576) {
                        // preview must be of the correct mimetype and not too large!
                        blob.text().then((text) => {
                            const params = new URLSearchParams(text);
                            const tableRows: TableRowData[] = [];
                            let lastParam: string = "";
                            params.forEach((value, key) => {
                                if (key === lastParam) {
                                    tableRows.push({
                                        param: "", // still the same param name
                                        value: value,
                                    });
                                    return;
                                }
                                tableRows.push({
                                    param: key,
                                    value: value,
                                });
                                lastParam = key;
                            });
                            this.tableContent = tableRows;
                        });
                    } else {
                        this.tooLargeToPreview = blob.size >= 1048576;
                        this.content = ":warning: The data content is not of type markdown or too large to preview.";
                    }
                })
            }
        } else {
            this.previewOptions = [];
            this.chosenPreview = null;
            this.effectiveMimetype = null;
            this.dataUrl = null;
        }
    }

    getVisualizationPlugins(previewData: PreviewData | null): Promise<Array<QhanaPlugin>> {
        let requestedLoadPlugins = false;
        let subscription: Subscription | null = null;
        return new Promise((resolve, reject) => {
            if (previewData == null) {
                resolve([]);
                return;
            }
            subscription = this.plugins.plugins.subscribe((plugins) => {
                if (plugins.length === 0 && !requestedLoadPlugins) {
                    requestedLoadPlugins = true;
                    this.plugins.loadPlugins();
                    return;
                }
                subscription?.unsubscribe();
                const filteredPlugins = plugins.filter(plugin => {
                    const inputData = plugin.metadata?.entryPoint?.dataInput ?? [];
                    if (plugin.metadata?.type === "visualization") {
                        return inputData.every((input: any) => {
                            if (!input.required) {
                                return true;
                            }
                            if (!input.contentType.some((requiredType: string) => requiredType === previewData.contentType)) {
                                return false; // no content type matches
                            }
                            return true; // FIXME use better content type checks (see data chooser dialog)
                        });
                    }
                    return false;
                });
                resolve(filteredPlugins);
            }, reject);
        });
    }

    getPreviewUrl(chosenPreview: PreviewOption): string | null {
        const data = this.previewData;
        const plugin = chosenPreview.plugin;
        let frontendUrl: string | null = plugin?.metadata?.entryPoint?.uiHref;
        if (frontendUrl != null) {
            const base = new URL(plugin?.url ?? "");
            // const pluginOrigin = base.origin;
            if (frontendUrl.startsWith("/")) {
                frontendUrl = base.origin + frontendUrl;
            }
            if (frontendUrl.startsWith("./")) {
                frontendUrl = base.href + frontendUrl;
            }
        }
        if (frontendUrl == null) {
            return null;
        }
        const url = new URL(frontendUrl);
        const dataInput: any[] = plugin?.metadata?.entryPoint?.dataInput ?? [];
        dataInput.forEach(input => {
            if (input.required && input.contentType.some((requiredType: string) => requiredType === data?.contentType)) {
                url.searchParams.set(input.parameter, data?.url ?? "");
            }
        });
        return url.toString();
    }

}
