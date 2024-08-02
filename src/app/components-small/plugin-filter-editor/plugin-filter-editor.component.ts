import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AbstractControl, FormControl, Validators, ValidatorFn } from '@angular/forms';
import { ApiLink } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateTabApiObject } from 'src/app/services/templates.service';

export function isJSONValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
        try {
            JSON.parse(control.value);
            return null;
        } catch (e) {
            return { invalidJSON: true };
        }
    };
}

@Component({
    selector: 'qhana-plugin-filter-editor',
    templateUrl: './plugin-filter-editor.component.html',
    styleUrls: ['./plugin-filter-editor.component.sass']
})
export class PluginFilterEditorComponent implements OnInit {
    @Input() tabLink: ApiLink | null = null;
    @Output() filterEmitter: EventEmitter<string> = new EventEmitter<string>();

    filterString: string = "{}";
    // TODO: Add JSON validator for filter strings
    filterControl = new FormControl(this.filterString, [isJSONValidator()]);

    filterObject: any = {};

    showEditor: boolean = true;

    constructor(private registry: PluginRegistryBaseService) { }

    ngOnInit(): void {
        if (this.tabLink == null) {
            return;
        }
        this.registry.getByApiLink<TemplateTabApiObject>(this.tabLink).then(response => {
            this.filterString = response?.data?.filterString ?? this.filterString;
            if (!this.filterString) {
                this.filterString = "{}";
            }
            this.filterObject = JSON.parse(this.filterString);
            this.updateFilter(this.filterObject);
        });
    }

    updateFilter(value: any) {
        this.filterObject = value;
        this.filterString = JSON.stringify(this.filterObject, null, 2);
        this.filterControl.setValue(this.filterString);
        this.filterEmitter.emit(this.filterString);
    }

    copyFilterString() {
        navigator.clipboard.writeText(this.filterString);
    }

    updateFilterEditor() {
        const filterValue = this.filterControl.value;
        if (filterValue == null) {
            return;
        }
        if (this.filterControl.valid) {
            try {
                this.filterObject = JSON.parse(filterValue);
                this.filterString = filterValue;
                this.filterEmitter.emit(this.filterString);
            } catch (e) {
                console.warn("Invalid filter string", this.filterObject, "\nError:", e);
            }
        }
    }

    deleteFilter() {
        this.filterString = "{}";
        this.filterControl.setValue(this.filterString);
        this.updateFilterEditor();
    }
}
