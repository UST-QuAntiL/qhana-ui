import { Component, Input } from '@angular/core';

export interface TabDefinition {
    tabId: string;
    name: string;
}

@Component({
    selector: 'qhana-timeline-step-nav',
    templateUrl: './timeline-step-nav.component.html',
    styleUrls: ['./timeline-step-nav.component.sass']
})
export class TimelineStepNavComponent {
    @Input() active: string = "";
    @Input() experimentId: string | number = "";
    @Input() timelineStep: string | number = 1;
    @Input() tabs: TabDefinition[] = [];

    constructor() { }

}
