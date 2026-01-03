export class BpmnXmlBuilder {
    private static readonly xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>`;
    private static readonly defsOpen = `<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
        xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
        xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
        xmlns:qhana="https://github.com/qhana"
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

    public constructor(
        private experimentName: any,
        private steps: any[]) {}

    public toString(): string {
        const processOpen = `<bpmn2:process id="Experiment_${this.experimentName}" isExecutable="true">`;
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

    private getProcessXml(): string {
        let processXml = `
        <bpmn2:startEvent id="StartEvent_1">
            <bpmn2:outgoing>Flow_0</bpmn2:outgoing>
        </bpmn2:startEvent>`;

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

                processXml += `
                <qhana:qHAnaServiceTask
                    id="${id}"
                    name="${name}"
                    qhanaIdentifier="${qhanaIdentifier}"
                    qhanaVersion="${qhanaVersion}"
                    qhanaName="${name}"
                    qhanaDescription="${qhanaDescription}"
                    selectedConfigurationId="${selectedConfigurationId}">
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
}
