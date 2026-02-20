import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ApiLink } from './api-data-types';

@Injectable({
    providedIn: 'root'
})
export class TempTabService {

    private tempTabPlugin: BehaviorSubject<ApiLink | null> = new BehaviorSubject<ApiLink | null>(null);

    get tempTabPluginLink() {
        return this.tempTabPlugin.asObservable();
    }

    public setTempTabPluginLink(value: ApiLink | null) {
        this.tempTabPlugin.next(value);
    }

}
