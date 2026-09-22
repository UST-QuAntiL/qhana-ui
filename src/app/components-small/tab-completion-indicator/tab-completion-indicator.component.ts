import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiLink } from 'src/app/services/api-data-types';
import { CurrentExperimentService } from 'src/app/services/current-experiment.service';
import { TemplatesService } from 'src/app/services/templates.service';

@Component({
    selector: 'qhana-tab-completion-indicator',
    templateUrl: './tab-completion-indicator.component.html',
    styleUrls: ['./tab-completion-indicator.component.sass'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TabCompletionIndicatorComponent implements OnInit, OnChanges, OnDestroy {

    @Input() color: 'accent' | 'primary' | '' = '';

    @Input() tab: ApiLink | null = null;

    isCompleted: boolean = false;

    private experimentId: string | null = null;
    private experimentIdSubscription: Subscription | null = null;
    private tabCompletionUpdatesSubscription: Subscription | null = null;

    constructor(private templates: TemplatesService, private experiment: CurrentExperimentService) { }

    ngOnInit(): void {
        this.experimentIdSubscription = this.experiment.experimentId.subscribe(experimentId => {
            const shouldUpdate = this.experimentId !== experimentId;
            this.experimentId = experimentId;
            if (shouldUpdate) {
                this.updateTabCompletion();
            }
        });
        this.tabCompletionUpdatesSubscription = this.templates.tabCompletionStatusChanged.subscribe(tab => {
            if (this.experimentId != tab.experimentId) {
                return;
            }
            if (this.tab == null) {
                return;
            }
            if (this.tab.resourceKey?.uiTemplateTabId === tab.templateTabId) {
                this.updateTabCompletion();
            }
        })
    }

    ngOnDestroy(): void {
        this.experimentIdSubscription?.unsubscribe();
        this.tabCompletionUpdatesSubscription?.unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.tab != null) {
            this.updateTabCompletion();
        }
    }

    private updateTabCompletion() {
        const experimentId = this.experimentId;
        const tabId = this.tab?.resourceKey?.uiTemplateTabId;
        if (experimentId == null || tabId == null) {
            this.resetTabCompletion();
            return;
        }

        this.isCompleted = this.templates.getTemplateTabCompletion(experimentId, tabId);
    }

    private resetTabCompletion() {
        this.isCompleted = false;
    }

}
