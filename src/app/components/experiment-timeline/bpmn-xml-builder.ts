export interface TimelineDataItem {
    type: string;
    contentType: string;
    name: string;
    version: number;
}

export interface PluginDataInput {
    parameter: string;
    dataType: string;
    contentType: string[];
}

export interface PluginDataOutput {
    dataType: string;
    contentType: string[];
}

export interface EnrichedStep {
    processorName: string;
    processorVersion: string;
    notes: string;
    inputData: TimelineDataItem[];
    outputData: TimelineDataItem[];
    parameters: Record<string, string>;
    pluginDataInput: PluginDataInput[];
    pluginDataOutput: PluginDataOutput[];
}

interface InputMapping {
    paramName: string;
    mapped: boolean;
    fromOutputRef?: string;
    globPattern?: string;
    dataType?: string;
}

interface StartFormField {
    paramName: string;
    label: string;
    defaultValue: string;
}

export class BpmnXmlBuilder {
    private static readonly xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>`;
    private static readonly defsOpen = `<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
        xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
        xmlns:qhana="https://github.com/qhana"
        xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
        xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
        id="sample-diagram"
        targetNamespace="http://bpmn.io/schema/bpmn"
        xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL BPMN20.xsd">`;
    private static readonly defsClose = `</bpmn2:definitions>`;
    private static readonly processClose = `</bpmn2:process>`;

    private static readonly startX = 200;
    private static readonly startY = 200;
    private static readonly stepWidth = 120;
    private static readonly stepHeight = 80;
    private static readonly gap = 120;

    private startFormFields: StartFormField[] = [];
    private stepInputMappings: InputMapping[][] = [];

    public constructor(
        private experimentName: string,
        private steps: EnrichedStep[]) {
        this.computeMappings();
    }

    public toString(): string {
        const processId = `Experiment_${this.experimentName.replace(/\s+/g, "_")}`;
        const processOpen = `<bpmn2:process id="${processId}" isExecutable="true" name="Experiment_${this.experimentName}" camunda:historyTimeToLive="360000">`;
        const diagramXml = `
        <bpmndi:BPMNDiagram id="BPMNDiagram_1">
            <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
                ${this.getShapesXml()}
                ${this.getEdgesXml()}
            </bpmndi:BPMNPlane>
        </bpmndi:BPMNDiagram>`;

        return [
            BpmnXmlBuilder.xmlHeader,
            BpmnXmlBuilder.defsOpen,
            processOpen,
            this.getProcessXml(),
            this.getFlowXml(),
            BpmnXmlBuilder.processClose,
            diagramXml,
            BpmnXmlBuilder.defsClose,
        ].join('\n');
    }

    private computeMappings(): void {
        const seenStartFields = new Set<string>();

        this.steps.forEach((step, stepIndex) => {
            const mappings: InputMapping[] = [];

            for (const [paramName, paramValue] of Object.entries(step.parameters)) {
                if (this.isDataUrl(paramValue)) {
                    const filename = this.extractFilenameFromDataUrl(paramValue);
                    const match = this.findOutputMatch(filename, stepIndex);

                    if (match) {
                        mappings.push({
                            paramName,
                            mapped: true,
                            fromOutputRef: `qoutput.${this.toCamelCase(match.producerName)}`,
                            globPattern: this.buildGlobPattern(match.outputName),
                            dataType: match.dataType,
                        });
                        continue;
                    }
                }

                mappings.push({ paramName, mapped: false });

                if (!seenStartFields.has(paramName)) {
                    seenStartFields.add(paramName);
                    const pluginInput = step.pluginDataInput.find(d => d.parameter === paramName);
                    const defaultValue = pluginInput
                        ? `file_url:: ${pluginInput.dataType}, ${pluginInput.contentType.join(', ')}`
                        : paramValue === "***" ? "" : paramValue;
                    this.startFormFields.push({
                        paramName,
                        label: this.toLabel(paramName),
                        defaultValue,
                    });
                }
            }

            this.stepInputMappings.push(mappings);
        });
    }

    private findOutputMatch(filename: string, currentStepIndex: number):
        { producerName: string; outputName: string; dataType: string } | null {
        for (let i = 0; i < currentStepIndex; i++) {
            const prevStep = this.steps[i];
            for (const output of prevStep.outputData) {
                if (output.name === filename) {
                    return {
                        producerName: prevStep.processorName,
                        outputName: output.name,
                        dataType: output.type,
                    };
                }
            }
        }
        return null;
    }

    private getProcessXml(): string {
        let processXml: string;

        if (this.startFormFields.length > 0) {
            let formFieldsXml = '';
            for (const field of this.startFormFields) {
                formFieldsXml += `
                    <camunda:formField id="start_${field.paramName}" label="${field.label}" type="string"${field.defaultValue ? ` defaultValue="${field.defaultValue}"` : ''} />`;
            }
            processXml = `
        <bpmn2:startEvent id="StartEvent_1">
            <bpmn2:extensionElements>
                <camunda:formData>${formFieldsXml}
                </camunda:formData>
            </bpmn2:extensionElements>
            <bpmn2:outgoing>Flow_0</bpmn2:outgoing>
        </bpmn2:startEvent>`;
        } else {
            processXml = `
        <bpmn2:startEvent id="StartEvent_1">
            <bpmn2:outgoing>Flow_0</bpmn2:outgoing>
        </bpmn2:startEvent>`;
        }

        if (this.steps.length > 0) {
            this.steps.forEach((step, i) => {
                const id = `Activity_${i}`;
                const incoming = `Flow_${i}`;
                const outgoing = (i < this.steps.length - 1) ? `Flow_${i + 1}` : `Flow_end`;

                const name = step.processorName ?? `Step ${i + 1}`;
                const qhanaIdentifier = step.processorName ?? `unknown`;
                const qhanaVersion = step.processorVersion ?? 'v0.0.0';
                const qhanaDescription = step.notes ?
                    step.notes :
                    `Run plugin ${qhanaIdentifier}`;
                const selectedConfigurationId = qhanaIdentifier;

                const extensionXml = this.getTaskExtensionXml(step, i);

                processXml += `
                <qhana:qHAnaServiceTask
                    id="${id}"
                    name="${name}"
                    qhanaIdentifier="${qhanaIdentifier}"
                    qhanaVersion="${qhanaVersion}"
                    qhanaName="${name}"
                    qhanaDescription="${qhanaDescription}"
                    selectedConfigurationId="${selectedConfigurationId}">${extensionXml}
                    <bpmn2:incoming>${incoming}</bpmn2:incoming>
                    <bpmn2:outgoing>${outgoing}</bpmn2:outgoing>
                </qhana:qHAnaServiceTask>`;
            });
        }

        processXml += `
        <bpmn2:endEvent id="EndEvent_1">
            <bpmn2:incoming>${(this.steps.length === 0) ? 'Flow_0' : 'Flow_end'}</bpmn2:incoming>
        </bpmn2:endEvent>`;

        return processXml;
    }

    private getTaskExtensionXml(step: EnrichedStep, stepIndex: number): string {
        const mappings = this.stepInputMappings[stepIndex];
        const hasInputs = mappings.length > 0;
        const hasOutputs = step.outputData.length > 0;
        const isLastStep = this.steps.length == stepIndex + 1;

        if (!hasInputs && !hasOutputs) {
            return '';
        }

        let inputOutputXml = '';

        for (const mapping of mappings) {
            if (mapping.mapped) {
                inputOutputXml += `
                        <camunda:inputParameter name="qinput.${mapping.paramName}">
                            <camunda:map>
                                <camunda:entry key="from">${mapping.fromOutputRef}</camunda:entry>
                                <camunda:entry key="name">${mapping.globPattern}</camunda:entry>
                                <camunda:entry key="dataType">${mapping.dataType}</camunda:entry>
                            </camunda:map>
                        </camunda:inputParameter>`;
            } else {
                inputOutputXml += `
                        <camunda:inputParameter name="qinput.${mapping.paramName}">\${start_${mapping.paramName}}</camunda:inputParameter>`;
            }
        }

        if (hasOutputs) {
            const pluginCamelCase = this.toCamelCase(step.processorName);
            inputOutputXml += `
                        <camunda:outputParameter name="${isLastStep?'return.':''}qoutput.${pluginCamelCase}">\${output}</camunda:outputParameter>`;
        }

        return `
                    <bpmn2:extensionElements>
                        <camunda:inputOutput>${inputOutputXml}
                        </camunda:inputOutput>
                    </bpmn2:extensionElements>`;
    }

    private getFlowXml(): string {
        let flowsXml = (this.steps.length === 0) ?
            `<bpmn2:sequenceFlow id="Flow_0" sourceRef="StartEvent_1" targetRef="EndEvent_1"/>` :
            `<bpmn2:sequenceFlow id="Flow_0" sourceRef="StartEvent_1" targetRef="Activity_0"/>`;

        if (this.steps.length > 0) {
            this.steps.forEach((_, i) => {
                const id = `Activity_${i}`;
                flowsXml += '\n' + ((i < this.steps.length - 1) ?
                    `<bpmn2:sequenceFlow id="Flow_${i + 1}" sourceRef="${id}" targetRef="Activity_${i + 1}"/>` :
                    `<bpmn2:sequenceFlow id="Flow_end" sourceRef="${id}" targetRef="EndEvent_1"/>`);
            });
        }
        return flowsXml;
    }

    private getShapesXml(): string {
        let shapesXml = `
        <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
            <dc:Bounds x="${BpmnXmlBuilder.startX}" y="${BpmnXmlBuilder.startY + 22}" width="36" height="36" />
        </bpmndi:BPMNShape>`;

        if (this.steps.length === 0) {
            const endX = BpmnXmlBuilder.startX + 200;
            shapesXml += `
            <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
                <dc:Bounds x="${endX}" y="${BpmnXmlBuilder.startY + 22}" width="36" height="36" />
            </bpmndi:BPMNShape>`;
        } else {
            this.steps.forEach((_, i) => {
                const x = BpmnXmlBuilder.startX + 100 + i * (BpmnXmlBuilder.stepWidth + BpmnXmlBuilder.gap);
                shapesXml += `
                <bpmndi:BPMNShape id="Activity_${i}_di" bpmnElement="Activity_${i}">
                    <dc:Bounds x="${x}" y="${BpmnXmlBuilder.startY}" width="${BpmnXmlBuilder.stepWidth}" height="${BpmnXmlBuilder.stepHeight}" />
                </bpmndi:BPMNShape>`;
            });

            const endX = BpmnXmlBuilder.startX + 100 + this.steps.length * (BpmnXmlBuilder.stepWidth + BpmnXmlBuilder.gap);
            shapesXml += `
            <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
                <dc:Bounds x="${endX}" y="${BpmnXmlBuilder.startY + 22}" width="36" height="36" />
            </bpmndi:BPMNShape>`;
        }
        return shapesXml;
    }

    private getEdgesXml(): string {
        let edgesXml = ``;

        if (this.steps.length === 0) {
            const endX = BpmnXmlBuilder.startX + 200;
            edgesXml += `
            <bpmndi:BPMNEdge id="Flow_0_di" bpmnElement="Flow_0">
                <di:waypoint x="${BpmnXmlBuilder.startX + 36}" y="${BpmnXmlBuilder.startY + 40}" />
                <di:waypoint x="${endX}" y="${BpmnXmlBuilder.startY + 40}" />
            </bpmndi:BPMNEdge>`;
        } else {
            const endX = BpmnXmlBuilder.startX + 100 + this.steps.length * (BpmnXmlBuilder.stepWidth + BpmnXmlBuilder.gap);

            edgesXml += `
            <bpmndi:BPMNEdge id="Flow_0_di" bpmnElement="Flow_0">
                <di:waypoint x="${BpmnXmlBuilder.startX + 36}" y="${BpmnXmlBuilder.startY + 40}" />
                <di:waypoint x="${BpmnXmlBuilder.startX + 100}" y="${BpmnXmlBuilder.startY + 40}" />
            </bpmndi:BPMNEdge>`;

            this.steps.forEach((_, i) => {
                const fromX = BpmnXmlBuilder.startX + 100 + i * (BpmnXmlBuilder.stepWidth + BpmnXmlBuilder.gap) + BpmnXmlBuilder.stepWidth;
                const toX = fromX + BpmnXmlBuilder.gap;
                edgesXml += '\n' + ((i < this.steps.length - 1) ?
                    `<bpmndi:BPMNEdge id="Flow_${i + 1}_di" bpmnElement="Flow_${i + 1}">
                        <di:waypoint x="${fromX}" y="${BpmnXmlBuilder.startY + 40}" />
                        <di:waypoint x="${toX}" y="${BpmnXmlBuilder.startY + 40}" />
                    </bpmndi:BPMNEdge>` :
                    `<bpmndi:BPMNEdge id="Flow_end_di" bpmnElement="Flow_end">
                        <di:waypoint x="${fromX}" y="${BpmnXmlBuilder.startY + 40}" />
                        <di:waypoint x="${endX}" y="${BpmnXmlBuilder.startY + 40}" />
                    </bpmndi:BPMNEdge>`);
            });
        }
        return edgesXml;
    }

    // --- Helper utilities ---

    private isDataUrl(value: string): boolean {
        return value.includes('/data/') && value.includes('/download');
    }

    private extractFilenameFromDataUrl(url: string): string {
        // URL pattern: .../data/{filename}/download?version=...
        const match = url.match(/\/data\/([^/]+)\/download/);
        return match ? decodeURIComponent(match[1]) : '';
    }

    private buildGlobPattern(outputName: string): string {
        // Strip random suffix pattern like _Htczxs-Ofctc before the extension
        const dotIndex = outputName.lastIndexOf('.');
        const baseName = dotIndex >= 0 ? outputName.substring(0, dotIndex) : outputName;
        const ext = dotIndex >= 0 ? outputName.substring(dotIndex) : '';

        const stripped = baseName.replace(/_[A-Z][a-z]+-[A-Z][a-z]+$/, '');
        if (stripped !== baseName) {
            return `${stripped}_*${ext}`;
        }
        return outputName;
    }

    private toCamelCase(pluginName: string): string {
        return pluginName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    }

    private toLabel(paramName: string): string {
        return paramName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, s => s.toUpperCase())
            .trim();
    }
}