import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { ApiLink } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateTabApiObject } from 'src/app/services/templates.service';

@Component({
    selector: 'qhana-plugin-filter-editor',
    templateUrl: './plugin-filter-editor.component.html',
    styleUrls: ['./plugin-filter-editor.component.sass']
})
export class PluginFilterEditorComponent implements OnInit {
    @Input() tabLink: ApiLink | null = null;
    @Output() filterEmitter: EventEmitter<string> = new EventEmitter<string>();

    filterString: string = "{}";
    filterControl = new FormControl(this.filterString, [Validators.required, Validators.minLength(2)]);  // TODO: Add validator for JSON

    filterObject: any = {};

    showEditor: boolean = true;

    constructor(private registry: PluginRegistryBaseService) { }

    ngOnInit(): void {
        if (this.tabLink == null) {
            return;
        }
        this.registry.getByApiLink<TemplateTabApiObject>(this.tabLink).then(response => {
            this.filterString = response?.data?.filterString ?? this.filterString;
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
