/// <reference types="jasmine" />

// This file is required by karma.conf.js and loads recursively all .spec files.

import 'zone.js/testing';

import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { getTestBed, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import {
    BrowserTestingModule,
    platformBrowserTesting
} from '@angular/platform-browser/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

const matDialogStub = {
    open: () => ({
        afterClosed: () => of(null)
    })
};

// Initialize the Angular testing environment.
getTestBed().initTestEnvironment(
    BrowserTestingModule,
    platformBrowserTesting(),
    {
        teardown: { destroyAfterEach: true }
    }
);

// Common configuration for the existing shallow component tests.
beforeEach(() => {
    TestBed.configureTestingModule({
        imports: [
            RouterTestingModule
        ],
        providers: [
            provideHttpClient(withXhr(), withInterceptorsFromDi()),
            provideHttpClientTesting(),
            {
                provide: MatDialog,
                useValue: matDialogStub
            }
        ],
        schemas: [
            NO_ERRORS_SCHEMA
        ]
    });
});