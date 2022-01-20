/*
 * Copyright 2021 University of Stuttgart
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'qhana-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.sass']
})
export class AppComponent implements OnInit {
    title = 'QHAna';

    ngOnInit(): void {
        (window as any).addEventListener("message", (event: MessageEvent) => {
            // workaround for microfrontend bug
            // one listener must always be listening for message events to avoid
            // a bug where cancelling a listener with an abort signal prevents
            // future event listeners from working
        }, { passive: true });
    }
}
