import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ChooseDataComponent } from 'src/app/dialogs/choose-data/choose-data.component';
import { ExperimentDataApiObject, QhanaBackendService } from 'src/app/services/qhana-backend.service';

export interface FormSubmitData {
    type: "form-submit";
    formData: string;
    formDataType: string;
    dataInputs: string[];
    submitUrl: string;
    resultUrl: string;
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

<<<<<<< HEAD
=======
interface DataUrlInfoRequest {
    type: "request-data-url";
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

>>>>>>> origin/feature/microfrontend-refactor

@Component({
    selector: 'qhana-plugin-uiframe',
    templateUrl: './plugin-uiframe.component.html',
    styleUrls: ['./plugin-uiframe.component.sass']
})
export class PluginUiframeComponent implements OnChanges, OnDestroy {

    @ViewChild('uiframe', { static: true }) uiframe: ElementRef | null = null;

    @Input() url: string | null = null;
    @Output() formDataSubmit: EventEmitter<FormSubmitData> = new EventEmitter();

    blank: SafeResourceUrl;

    pluginOrigin: string | null = null;
    frontendUrl: SafeResourceUrl;
    frontendHeight: number = 100;

    loading: boolean = true;
    error: { code: number, status: string } | null = null;

<<<<<<< HEAD
    listenerAbortController = new AbortController();

    constructor(private sanitizer: DomSanitizer, private dialog: MatDialog, private backend: QhanaBackendService) {
        this.blank = this.sanitizer.bypassSecurityTrustResourceUrl("about//blank");
        this.frontendUrl = this.blank;
        // see workaround in app.component.ts before fiddling with this event listener!
        (window as any).addEventListener(
            "message",
            (event: MessageEvent) => this.handleMicroFrontendEvent(event),
            { signal: this.listenerAbortController.signal }
=======
    private dialogActive = false;

    listenerFunction = (event: MessageEvent) => this.handleMicroFrontendEvent(event);

    constructor(private sanitizer: DomSanitizer, private dialog: MatDialog, private backend: QhanaBackendService) {
        this.blank = this.sanitizer.bypassSecurityTrustResourceUrl("about://blank");
        this.frontendUrl = this.blank;
        window.addEventListener(
            "message",
            this.listenerFunction,
>>>>>>> origin/feature/microfrontend-refactor
        );
    }

    ngOnDestroy(): void {
<<<<<<< HEAD
        // see workaround in app.component.ts before fiddling with this event listener!
        this.listenerAbortController.abort();
=======
        window.removeEventListener("message", this.listenerFunction);
>>>>>>> origin/feature/microfrontend-refactor
    }

    ngOnChanges(changes: SimpleChanges): void {
        const url: string | null = this.url;
        if (url == null) {
            this.pluginOrigin = null;
            this.frontendUrl = this.blank;
            this.frontendHeight = 100;
            return;
        }
        this.loading = true;
        this.pluginOrigin = (new URL(url)).origin;
        this.frontendHeight = 100;
        this.frontendUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    private selectInputData(request: DataUrlRequest) {
<<<<<<< HEAD
        // TODO
        const dialogRef = this.dialog.open(ChooseDataComponent, { data: { acceptedDataType: request.acceptedInputType, acceptedContentTypes: request.acceptedContentTypes } });
        dialogRef.afterClosed().subscribe((result: ExperimentDataApiObject) => {
=======
        if (this.dialogActive) {
            return; // only ever show one dialog at a time
        }
        this.dialogActive = true;
        const dialogRef = this.dialog.open(ChooseDataComponent, { data: { acceptedDataType: request.acceptedInputType, acceptedContentTypes: request.acceptedContentTypes } });
        dialogRef.afterClosed().subscribe((result: ExperimentDataApiObject) => {
            this.dialogActive = false;
            if (result == null) {
                return; // nothing was selected
            }
>>>>>>> origin/feature/microfrontend-refactor
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
        });
    }

<<<<<<< HEAD
=======
    private handleInputDataInfoRequest(request: DataUrlInfoRequest) {
        // http://localhost:9090/experiments/1/data/out.txt/download?version=2
        if (!request.dataUrl.startsWith(this.backend.backendRootUrl)) {
            return; // unknown data source
        }
        const dataUrl = new URL(request.dataUrl);
        const pathMatch = dataUrl.pathname.match(/^\/experiments\/([0-9]+)\/data\/([^\/\s]+)\/download\/?$/);
        const versionMatch = dataUrl.searchParams.get("version");
        if (pathMatch && pathMatch[1] != null && pathMatch[2] != null && versionMatch != null) {
            this.backend.getExperimentData(pathMatch[1], pathMatch[2], versionMatch).subscribe(dataResult => {
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

>>>>>>> origin/feature/microfrontend-refactor
    private sendMessage(message: any) {
        const iframe: HTMLIFrameElement | null = this.uiframe?.nativeElement ?? null;
        iframe?.contentWindow?.postMessage?.(message, this.pluginOrigin ?? "*");
    }

    private handleMicroFrontendEvent(event: MessageEvent) {
        if (this.pluginOrigin == null || event.origin !== this.pluginOrigin) {
            return; // unsafe event
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
        } else { // assume object message
            if (data?.type === "ui-resize") {
                this.frontendHeight = Math.max(data.height ?? 100, 20);
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
<<<<<<< HEAD
        }
        console.log(event.data) // TODO  remove later
=======
            if (data?.type === "request-data-url-info") {
                if (!isDataUrlInfoRequest(data)) {
                    return;
                }
                this.handleInputDataInfoRequest(data);
            }
            if (data.type === "request-plugin-url") {
                console.log(data) //TODO
            }
            if (data.type === "request-plugin-url-info") {
                console.log(data) //TODO
            }
        }
>>>>>>> origin/feature/microfrontend-refactor
    }
}
