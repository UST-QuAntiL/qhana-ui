import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from "@angular/material/button";
import { Subscription } from 'rxjs';
import { HelpServiceService } from 'src/app/services/help-service.service';
import { MatIconModule } from "@angular/material/icon";
import { MatButtonToggleModule } from "@angular/material/button-toggle";

@Component({
    selector: 'qhana-help-toggle',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, MatButtonToggleModule],
    templateUrl: './help-toggle.component.html',
    styleUrl: './help-toggle.component.sass'
})
export class HelpToggleComponent {

    private showHelpSubscription: Subscription | null = null;

    showHelpButtons: boolean = false;

    constructor(private helpService: HelpServiceService) { }

    ngOnInit(): void {
        this.showHelpSubscription = this.helpService.showHelp.subscribe((value) => this.showHelpButtons = value);
    }

    ngOnDestroy(): void {
        this.showHelpSubscription?.unsubscribe();
    }

    toggleHelp(): void {
        this.helpService.toggleShowHelp();
    }

}
