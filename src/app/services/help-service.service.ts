import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class HelpServiceService {

    private showHelpState: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    get showHelp() {
        return this.showHelpState.asObservable();
    }

    public setShowHelp(value: boolean) {
        this.showHelpState.next(value);
    }

    public toggleShowHelp() {
        const current = this.showHelpState.value;
        this.showHelpState.next(!current);
    }

}
