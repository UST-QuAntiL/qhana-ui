import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ExperimentDataApiObject, QhanaBackendService, TimelineSubStepApiObject, TimelineSubStepPostData } from 'src/app/services/qhana-backend.service';
import { FormSubmitData } from '../plugin-uiframe/plugin-uiframe.component';

@Component({
    selector: 'qhana-timeline-substeps',
    templateUrl: './timeline-substeps.component.html',
    styleUrls: ['./timeline-substeps.component.sass']
})
export class TimelineSubstepsComponent {

    @Input() experimentId: string | number | null = null;
    @Input() substeps: TimelineSubStepApiObject[] = [];
    @Input() parentFinished: boolean = false;
    @Output() requestDataPreview: EventEmitter<ExperimentDataApiObject> = new EventEmitter();

    constructor(private backend: QhanaBackendService) { }


    trackByFunction(index: number, substep: TimelineSubStepApiObject): number {
        return substep.substepNr;
    }

    onPluginUiFormSubmit(formData: FormSubmitData, substep: TimelineSubStepApiObject) {
        if (this.experimentId == null) {
            return; // cannot save parameters as important URL components are missing!
        }
        const data: TimelineSubStepPostData = {
            inputData: formData.dataInputs,
            parameters: formData.formData,
            parametersContentType: formData.formDataType,
        };
        this.backend.saveSubStepInputData(this.experimentId, substep.stepId, substep.substepNr, data).subscribe();
    }
}
