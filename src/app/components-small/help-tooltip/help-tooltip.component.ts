
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { nanoid } from 'nanoid';
import { Subscription } from 'rxjs';
import { HelpServiceService } from 'src/app/services/help-service.service';

@Component({
    selector: 'qhana-help-tooltip',
    imports: [MatButtonModule, MatIconModule],
    templateUrl: './help-tooltip.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './help-tooltip.component.sass'
})
export class HelpTooltipComponent implements OnInit, OnDestroy {

    private showHelpSubscription: Subscription | null = null;

    showHelpButton: boolean = false;
    anchorId: string = nanoid()

    @Input() label: string | null = null;
    @Output() anchor: EventEmitter<string> = new EventEmitter();

    @Input() buttonPos: "top-right" | "top-center" = "top-right";
    @Input() tooltipPos: "bottom-left" | "bottom-center" = "bottom-left";

    constructor(private helpService: HelpServiceService) { }

    ngOnInit(): void {
        Promise.resolve().then(() => this.anchor.emit(this.anchorId));
        this.showHelpSubscription = this.helpService.showHelp.subscribe((value) => this.showHelpButton = value);
    }

    ngOnDestroy(): void {
        this.showHelpSubscription?.unsubscribe();
    }

}
