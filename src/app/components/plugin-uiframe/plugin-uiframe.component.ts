import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, concatAll, filter, map, mergeAll, mergeMap, toArray } from 'rxjs/operators';
import { ChooseDataDialog } from 'src/app/dialogs/choose-data/choose-data.dialog';
import { ChooseRelatedDataDialog, RelatedDataChooserData } from 'src/app/dialogs/choose-related-data/choose-related-data.dialog';
import { ChoosePluginDialog } from 'src/app/dialogs/choose-plugin/choose-plugin.dialog';
import { ApiLink, CollectionApiObject } from 'src/app/services/api-data-types';
import { PluginApiObject } from 'src/app/services/qhana-api-data-types';
import { ApiObjectList, ExperimentDataApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';

export interface FormSubmitData {
    type: "form-submit";
    formData: string;
    formDataType: string;
    dataInputs: string[];
    submitUrl: string;
    resultUrl: string;
}

export interface PluginUiContext {
    experimentId?: string | number;
    stepId?: string | number;
    data?: Array<{ downloadUrl: string, dataType: string, contentType: string }>;
}

function isFormSubmitData(data: any): data is FormSubmitData {
    if (data == null) {
        return false;
    }
    if (data.type !== "form-submit") {
        return false;
    }
    if (data.formData == null || data.formDataType == null || data.dataInputs == null || data.submitUrl == null || data.resultUrl == null) {
        return false;
    }
    if (typeof data.formData !== "string" || typeof data.formDataType !== "string" || typeof data.submitUrl !== "string" || typeof data.resultUrl !== "string") {
        return false;
    }
    if (!Array.isArray(data.dataInputs)) {
        return false;
    }
    return true;
}

interface DataUrlRequest {
    type: "request-data-url";
    inputKey: string;
    acceptedInputType: string;
    acceptedContentTypes: string[];
}

function isDataUrlRequest(data: any): data is DataUrlRequest {
    if (data == null) {
        return false;
    }
    if (data.type !== "request-data-url") {
        return false;
    }
    if (data.inputKey == null || data.acceptedInputType == null || data.acceptedContentTypes == null) {
        return false;
    }
    if (typeof data.inputKey !== "string" || typeof data.acceptedInputType !== "string") {
        return false;
    }
    if (!Array.isArray(data.acceptedContentTypes)) {
        return false;
    }
    return true;
}

interface RelatedDataUrlRequest {
    type: "request-related-data-url";
    inputKey: string;
    dataUrl: string;
    relation: "any" | "exact" | "pre" | "post";
    includeSelf?: boolean;
    acceptedInputType?: string;
    acceptedContentType?: string;
    userInteraction?: boolean;
}

function isRelatedDataUrlRequest(data: any): data is RelatedDataUrlRequest {
    if (data == null) {
        return false;
    }
    if (data.type !== "request-related-data-url") {
        return false;
    }
    if (data.inputKey == null || data.dataUrl == null || data.relation == null) {
        return false;
    }
    if (typeof data.inputKey !== "string" || typeof data.dataUrl !== "string") {
        return false;
    }
    const rel = data.relation;
    if (!(rel === "any" || rel === "exact" || rel === "pre" || rel === "post")) {
        return false;
    }
    return true;
}

interface DataUrlInfoRequest {
    type: "request-data-url-info";
    inputKey: string;
    dataUrl: string;
}

function isDataUrlInfoRequest(data: any): data is DataUrlInfoRequest {
    if (data == null) {
        return false;
    }
    if (data.type !== "request-data-url-info") {
        return false;
    }
    if (data.inputKey == null || data.dataUrl == null) {
        return false;
    }
    if (typeof data.inputKey !== "string" || typeof data.dataUrl !== "string") {
        return false;
    }
    return true;
}

interface DataPreviewRequest {
    type: "request-data-preview";
    dataUrl: string;
}

function isDataPreviewRequest(data: any): data is DataPreviewRequest {
    if (data == null) {
        return false;
    }
    if (data.type !== "request-data-preview") {
        return false;
    }
    if (data.dataUrl == null || typeof data.dataUrl !== "string") {
        return false;
    }
    return true;
}

interface PluginUrlRequest {
    type: "request-plugin-url";
    inputKey: string;
    pluginTags: string[];
    pluginName?: string;
    pluginVersion?: string;
}

function isPluginUrlRequest(data: any): data is PluginUrlRequest {
    if (data == null) {
        return false;
    }
    if (data.type !== "request-plugin-url") {
        return false;
    }
    if (data.inputKey == null || data.pluginTags == null) {
        return false;
    }
    if (typeof data.inputKey !== "string" || (data.pluginName && (typeof data.pluginName !== "string")) || (data.pluginVersion && (typeof data.pluginVersion !== "string"))) {
        return false;
    }
    if (!Array.isArray(data.pluginTags)) {
        return false;
    }
    return true;
}

interface PluginUrlInfoRequest {
    type: "request-plugin-url";
    inputKey: string;
    pluginUrl: string;
}

function isPluginUrlInfoRequest(data: any): data is PluginUrlInfoRequest {
    if (data == null) {
        return false;
    }
    if (data.type !== "request-plugin-url-info") {
        return false;
    }
    if (data.inputKey == null || data.pluginUrl == null) {
        return false;
    }
    if (typeof data.inputKey !== "string" || typeof data.pluginUrl !== "string") {
        return false;
    }
    return true;
}

const allowedImplementationContentTypes: Set<string> = new Set(["text/x-qasm", "text/x-qiskit"]);
const implementationsContentTypeMap: Map<string, string> = new Map([
    ["text/x-qasm", "qasm"],
    ["text/x-qiskit", "qiskit"]
])

interface ImplementationInfo {
    name: string;
    download: string;
    version: string;
    type: string;
}

@Component({
    selector: 'qhana-plugin-uiframe',
    templateUrl: './plugin-uiframe.component.html',
    styleUrls: ['./plugin-uiframe.component.sass']
})
export class PluginUiframeComponent implements OnChanges, OnDestroy {

    @ViewChild('uiframe', { static: true }) uiframe: ElementRef | null = null;

    @Input() url: string | null = null;
    @Output() formDataSubmit: EventEmitter<FormSubmitData> = new EventEmitter();
    @Output() requestDataPreview: EventEmitter<ExperimentDataApiObject> = new EventEmitter();

    @Input() plugin: ApiLink | null = null;
    @Input() context: PluginUiContext | null = null;

    blank: SafeResourceUrl;

    pluginOrigin: string | null = null;
    frontendUrl: SafeResourceUrl;
    frontendHeight: number = 100;
    itemsPerPage: number = 100;
    experimentId: number | null = null;
    hasFullscreenMode: boolean = false;
    fullscreen: boolean = false;

    buttonsLeft: boolean = false;

    loading: boolean = true;
    error: { code: number, status: string } | null = null;

    autofillData: { value: string, encoding: string } | null = null;

    private dialogActive = false;


    listenerFunction = (event: MessageEvent) => this.handleMicroFrontendEvent(event);

    constructor(private sanitizer: DomSanitizer, private dialog: MatDialog, private backend: QhanaBackendService, private registry: PluginRegistryBaseService, private route: ActivatedRoute) {
        this.blank = this.sanitizer.bypassSecurityTrustResourceUrl("about://blank");
        this.frontendUrl = this.blank;
        window.addEventListener(
            "message",
            this.listenerFunction,
        );
        this.route.params.subscribe(params => {
            this.experimentId = params?.experimentId ?? null;
        });
    }

    ngOnDestroy(): void {
        window.removeEventListener("message", this.listenerFunction);
    }

    ngOnChanges(changes: SimpleChanges): void {
        const url: string | null = this.url;
        if (url == null) {
            this.pluginOrigin = null;
            this.frontendUrl = this.blank;
            this.frontendHeight = 100;
            return;
        }
        if (changes.url != null) {
            this.loading = true;
            this.pluginOrigin = (new URL(url)).origin;
            this.frontendHeight = 100;
            this.frontendUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
            this.hasFullscreenMode = false;
        }
        if (changes.plugin != null || changes.context != null) {
            this.processContext();
        }
    }

    async autofillLatest() {
        if (this.autofillData != null) {
            this.sendAutofillData(this.autofillData.value, this.autofillData.encoding);
        }
    }

    private async processContext() {
        if (this.plugin == null) {
            this.autofillData = null;
            return;
        }
        const plugin = (await this.registry.getByApiLink<PluginApiObject>(this.plugin))?.data ?? null;
        if (plugin == null) {
            this.autofillData = null;
            return;
        }
        if (this.context?.experimentId != null) {
            this.backend.getTimelineStepsPage(this.context.experimentId, { sort: -1, pluginName: plugin.identifier, version: plugin.version, itemCount: 1 }).pipe(
                map(steps => {
                    if (steps.items.length == 1) {
                        const step = steps.items[0];
                        return {
                            parametersUrl: step.parameters,
                            encoding: step.parametersContentType,
                        };
                    }
                    return null;
                }),
                mergeMap(params => {
                    if (params == null) {
                        return of(null);
                    }
                    return this.backend.getTimelineStepParameters(params.parametersUrl).pipe(map(value => {
                        return { value: value, encoding: params.encoding };
                    }))
                }),
                catchError((err) => {
                    console.log(err)
                    return of(null);
                }),
            ).subscribe(result => {
                this.autofillData = result;
            });
            return;
        }
        this.autofillData = null;
        return;
    }

    private calculateMaxHeight(): number | undefined {
        const maxHeight = window.visualViewport?.height;
        if (maxHeight == null) {
            return undefined;
        }
        let offsetTop = 4;  // start with 4px offset to avoid scrollbar
        let currentElement: HTMLElement | Element | null = this.uiframe?.nativeElement ?? null;

        while (currentElement != null && currentElement instanceof HTMLElement) {
            offsetTop += currentElement.offsetTop ?? 0; // add up all ofets until root layout
            currentElement = currentElement.offsetParent ?? null;
        }

        return maxHeight - offsetTop;
    }

    private selectPlugin(request: PluginUrlRequest) {
        if (this.dialogActive) {
            return; // only ever show one dialog at a time
        }
        this.dialogActive = true;
        const dialogRef = this.dialog.open(ChoosePluginDialog, { data: request });
        dialogRef.afterClosed().subscribe((result: PluginApiObject | null) => {
            this.dialogActive = false;
            if (result == null) {
                return; // nothing was selected
            }
            this.sendMessage({
                type: "plugin-url-response",
                inputKey: request.inputKey,
                pluginUrl: result.href,
                pluginName: result.title ?? result.identifier,
                pluginVersion: result.version,
            });
        });
    }

    private selectInputData(request: DataUrlRequest) {
        if (this.dialogActive) {
            return; // only ever show one dialog at a time
        }
        this.dialogActive = true;
        const dialogRef = this.dialog.open(ChooseDataDialog, { data: { acceptedDataType: request.acceptedInputType, acceptedContentTypes: request.acceptedContentTypes } });
        dialogRef.afterClosed().subscribe((result: ExperimentDataApiObject) => {
            this.dialogActive = false;
            if (result == null) {
                return; // nothing was selected
            }
            let url = result.download;
            if (url.startsWith("/")) {
                url = this.backend.backendRootUrl + url;
            }
            this.sendMessage({
                type: "data-url-response",
                inputKey: request.inputKey,
                href: url,
                dataType: result.type,
                contentType: result.contentType,
                filename: result.name,
                version: result.version,
            });
            this.requestDataPreview.emit(result);
        });
    }

    private extractExperimentDataInfoFromUrl(url: string) {
        const backendUrl = this.backend.backendRootUrl
        if (backendUrl != null && !url.startsWith(backendUrl)) {
            return null; // unknown data source
        }
        const dataUrl = new URL(url);
        const pathMatch = dataUrl.pathname.match(/^\/experiments\/([0-9]+)\/data\/([^\/\s]+)\/download\/?$/);
        const versionMatch = dataUrl.searchParams.get("version");
        if (pathMatch && pathMatch[1] != null && pathMatch[2] != null && versionMatch != null) {
            return {
                "experimentId": pathMatch[1],
                "dataId": pathMatch[2],
                "version": versionMatch
            }
        }
        return null;
    }

    private selectRelatedData(request: RelatedDataUrlRequest) {
        const dataRef = this.extractExperimentDataInfoFromUrl(request.dataUrl);
        if (!dataRef) {
            return;
        }
        this.backend.getRelatedExperimentData(dataRef.experimentId, dataRef.dataId, dataRef.version, request.relation, request.includeSelf ?? false, request.acceptedInputType ?? null, request.acceptedContentType ?? null).subscribe((results) => {
            if (!request.userInteraction) {
                const data = results.items[0];
                if (!data) {
                    return;
                }
                let url = data.download;
                if (url.startsWith("/")) {
                    url = this.backend.backendRootUrl + url;
                }
                this.sendMessage({
                    type: "data-url-response",
                    inputKey: request.inputKey,
                    href: url,
                    dataType: data.type,
                    contentType: data.contentType,
                    filename: data.name,
                    version: data.version,
                });
            } else {
                this.selectRelatedDataInteractive(request, dataRef.experimentId, dataRef.dataId, dataRef.version);
            }
        });
    }

    private selectRelatedDataInteractive(request: RelatedDataUrlRequest, experimentId: string, dataId: string, version: string) {
        if (!request.userInteraction) {
            return;
        }
        if (this.dialogActive) {
            return; // only ever show one dialog at a time
        }
        this.dialogActive = true;
        const dialogData: RelatedDataChooserData = {
            dataId: dataId,
            version: version,
            relation: request.relation,
            includeSelf: request.includeSelf ?? false,
            acceptedDataType: request.acceptedInputType ?? null,
            acceptedContentType: request.acceptedContentType ?? null,
        };
        const dialogRef = this.dialog.open(ChooseRelatedDataDialog, { data: dialogData });
        dialogRef.afterClosed().subscribe((result: ExperimentDataApiObject) => {
            this.dialogActive = false;
            if (result == null) {
                return; // nothing was selected
            }
            let url = result.download;
            if (url.startsWith("/")) {
                url = this.backend.backendRootUrl + url;
            }
            this.sendMessage({
                type: "data-url-response",
                inputKey: request.inputKey,
                href: url,
                dataType: result.type,
                contentType: result.contentType,
                filename: result.name,
                version: result.version,
            });
            this.requestDataPreview.emit(result);
        });
    }

    private async handlePluginInfoRequest(request: PluginUrlInfoRequest) {
        const query = new URLSearchParams();
        query.set("url", request.pluginUrl);
        const plugins = await this.registry.getByRel<CollectionApiObject>(["plugin", "collection"], query, false);
        if (plugins?.data.items.length == 1) {
            const plugin = await this.registry.getByApiLink<PluginApiObject>(plugins?.data.items[0], null, false);
            if (plugin != null) {
                this.sendMessage({
                    type: "plugin-url-response",
                    inputKey: request.inputKey,
                    pluginUrl: request.pluginUrl,
                    pluginName: plugin.data.title ?? plugin.data.identifier,
                    pluginVersion: plugin.data.version,
                });
            }
        }
    }

    private handleInputDataInfoRequest(request: DataUrlInfoRequest) {
        const dataRef = this.extractExperimentDataInfoFromUrl(request.dataUrl);
        if (dataRef) {
            this.backend.getExperimentData(dataRef.experimentId, dataRef.dataId, dataRef.version).subscribe(dataResult => {
                this.sendMessage({
                    type: "data-url-response",
                    inputKey: request.inputKey,
                    href: request.dataUrl,
                    dataType: dataResult.type,
                    contentType: dataResult.contentType,
                    filename: dataResult.name,
                    version: dataResult.version,
                });
            });
        }
    }

    private handleDataPreviewRequest(request: DataPreviewRequest) {
        const dataRef = this.extractExperimentDataInfoFromUrl(request.dataUrl);
        if (dataRef) {
            this.backend.getExperimentData(dataRef.experimentId, dataRef.dataId, dataRef.version).subscribe(result => {
                this.requestDataPreview.emit(result);
            });
        }
    }

    private sendAutofillData(value: string, encoding: string) {
        this.sendMessage({
            type: "autofill-response",
            value: value,
            encoding: encoding,
        });
    }

    private sendMessage(message: any) {
        const iframe: HTMLIFrameElement | null = this.uiframe?.nativeElement ?? null;
        iframe?.contentWindow?.postMessage?.(message, this.pluginOrigin ?? "*");
    }

    private loadImplementations(): void {

        const firstPage = this.loadImplementationsFromPage(0);

        firstPage?.pipe(
            map(firstPage => {
                let pages: Observable<ApiObjectList<ExperimentDataApiObject>>[] = [of(firstPage)]
                for (let i = 1; i < firstPage.itemCount / this.itemsPerPage; i++) {
                    const page = this.loadImplementationsFromPage(i)
                    if (page !== null) {
                        pages.push(page)
                    }
                }
                return pages;
            }),
            mergeAll(),
            map(wholePage =>
                wholePage.pipe(
                    map(apiObjectList => apiObjectList.items.filter(experimentData => allowedImplementationContentTypes.has(experimentData.contentType))),
                    map(dataItems => dataItems.map(item => this.experimentId ? this.backend.getExperimentData(this.experimentId, item.name, item.version) : undefined)),
                    filter((experimentData): experimentData is Observable<ExperimentDataApiObject>[] => Boolean(experimentData)),
                    mergeAll(),
                    concatAll(),
                )
            ),
            concatAll(),
            map(dataItem => {
                if (this.experimentId && dataItem.producedBy) {
                    return this.backend.getTimelineStep(this.experimentId, dataItem.producedBy).pipe(
                        map(step => ({
                            name: dataItem.name + ' ' + step.processorName,
                            download: dataItem.download,
                            version: dataItem.version,
                            type: implementationsContentTypeMap.get(dataItem.contentType) ?? "unknown"
                        })),
                    )
                } else {
                    return of(undefined);
                }
            }),
            filter((implementation): implementation is Observable<ImplementationInfo> => !!implementation),
            concatAll(),
            toArray()
        ).subscribe(implementations => {
            const msg = {
                type: 'implementations-response',
                implementations
            }
            this.sendMessage(msg);
        });
    }

    private loadImplementationsFromPage(num: number): Observable<ApiObjectList<ExperimentDataApiObject>> | null {
        if (this.experimentId == null) {
            return null;
        }
        return this.backend.getExperimentDataPage(this.experimentId, true, null, null, num, this.itemsPerPage);
    }

    private handleMicroFrontendEvent(event: MessageEvent) {
        if (this.pluginOrigin == null || event.origin !== this.pluginOrigin) {
            return; // unsafe event
        }
        const iframe: HTMLIFrameElement | null = this.uiframe?.nativeElement ?? null;
        if (iframe?.contentWindow !== event.source) {
            return; // message is from another iframe
        }

        const data = event.data;
        if (typeof data === "string") {
            // handle string messages
            console.log("Message:", data);
            if (data === "ui-loaded") {
                const styles = document.querySelectorAll<HTMLLinkElement>('head link[rel="stylesheet"]');
                const styleUrls: string[] = [];
                styles.forEach((styleElement) => {
                    styleUrls.push(styleElement.href.toString());
                })
                this.sendMessage({ type: "load-css", "urls": styleUrls });
                this.loading = false;
            }
            if (data === "ui-loading") {
                this.loading = true;
                this.uiframe?.nativeElement?.blur();
            }
            if (data === "implementations-request") {
                this.hasFullscreenMode = true; // TODO: Set when other message is sent (e.g. "enable-fullscreen")
                this.loadImplementations();
            }
        } else { // assume object message
            if (data?.type === "ui-resize") {
                let newHeight = Math.max(data.height ?? 100, 20);
                if (data.targetHeight != null && Number.isFinite(data.targetHeight) && data.targetHeight > 20) {
                    // directly use target height (if it is the higher value)
                    newHeight = Math.max(newHeight, data.targetHeight);
                    // use target height * 2 as the maximum height (to allow for some slack)
                    newHeight = Math.min(newHeight, 2 * data.targetHeight);
                }
                if (data.targetHeight === "full") {
                    // if target height is full set iframe to max height to fill the current screen
                    const maxHeight = this.calculateMaxHeight();
                    if (maxHeight != null) {
                        newHeight = maxHeight;
                    }
                }
                this.frontendHeight = newHeight;
            }
            if (data?.type === "form-submit") {
                if (!isFormSubmitData(data)) {
                    return;
                }
                this.formDataSubmit.emit(data);
            }
            if (data?.type === "form-error") {
                this.loading = false;
                if (data.error?.code != null && data.error?.status != null) {
                    this.error = data.error;
                }
            }
            if (data?.type === "request-data-url") {
                if (!isDataUrlRequest(data)) {
                    return;
                }
                this.selectInputData(data);
            }
            if (data?.type === "request-related-data-url") {
                if (!isRelatedDataUrlRequest(data)) {
                    return;
                }
                this.selectRelatedData(data);
            }
            if (data?.type === "request-data-url-info") {
                if (!isDataUrlInfoRequest(data)) {
                    return;
                }
                this.handleInputDataInfoRequest(data);
            }
            if (data?.type === "request-data-preview") {
                if (!isDataPreviewRequest(data)) {
                    return;
                }
                this.handleDataPreviewRequest(data);
            }
            if (data.type === "request-plugin-url") {
                if (!isPluginUrlRequest(data)) {
                    return;
                }
                this.selectPlugin(data);
            }
            if (data.type === "request-plugin-url-info") {
                if (!isPluginUrlInfoRequest(data)) {
                    return;
                }
                this.handlePluginInfoRequest(data);
            }
        }
    }
}
