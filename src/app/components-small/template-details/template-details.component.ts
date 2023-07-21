import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ApiLink, ApiResponse } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TemplateApiObject, TemplateTabApiObject } from 'src/app/services/templates.service';
import { TAB_GROUP_NAME_OVERRIDES } from 'src/app/services/templates.service';

export function isInSetValidator(validValues: any[]): Validators {
    return (control: FormControl): { [key: string]: any } | null => {
        if (!validValues.includes(control.value)) {
            return { invalidValue: true };
        }
        return null;
    };
}

@Component({
    selector: 'qhana-template-details',
    templateUrl: './template-details.component.html',
    styleUrls: ['./template-details.component.sass']
})
export class TemplateDetailsComponent implements OnInit {
    @Input() templateLink: ApiLink | null = null;
    @Input() tabLink: ApiLink | null = null;

    filterString: string = "{}";

    tabGroupNameOverrides = { ...TAB_GROUP_NAME_OVERRIDES };

    private initialValues = {
        name: "",
        description: "",
        sortKey: 0,
        location: "workspace"
    };

    templateForm: FormGroup = this.fb.group({
        name: [this.initialValues.name, Validators.required],
        description: this.initialValues.description,
        sortKey: this.initialValues.sortKey,
        location: [this.initialValues.location, [Validators.required, isInSetValidator(Object.keys(TAB_GROUP_NAME_OVERRIDES))]]
    });

    constructor(private registry: PluginRegistryBaseService, private fb: FormBuilder) { }

    ngOnInit() {
        if (this.tabLink != null) {
            this.registry.getByApiLink<TemplateTabApiObject>(this.tabLink).then(response => {
                this.templateForm.setValue({
                    name: response?.data?.name ?? this.initialValues.name,
                    description: response?.data?.description ?? this.initialValues.description,
                    sortKey: response?.data?.sortKey ?? this.initialValues.sortKey,
                    location: response?.data?.location ?? this.initialValues.location
                });
            });
        }
    }

    async onSubmit() {
        let findString: string;
        let response: ApiResponse<TemplateApiObject | TemplateTabApiObject> | null;
        if (this.templateLink != null) {
            findString = "create";
            response = await this.registry.getByApiLink<TemplateApiObject>(this.templateLink);
        } else if (this.tabLink != null) {
            response = await this.registry.getByApiLink<TemplateTabApiObject>(this.tabLink);
            findString = "update";
        } else {
            console.warn("TemplateDetailsComponent: neither templateLink nor tabLink is set");
            return;
        }
        const link = response?.links?.find(link => link.rel.some(rel => rel === findString) && link.resourceType == "ui-template-tab") ?? null;
        if (link != null) {
            this.registry.submitByApiLink<TemplateTabApiObject>(link, {
                name: this.templateForm.value.name,
                description: this.templateForm.value.description,
                sortKey: this.templateForm.value.sortKey,
                filterString: this.filterString,
                location: this.templateForm.value.location
            });
            if (this.templateLink != null) {
                this.templateForm.reset(this.initialValues);
                this.templateForm.controls.name.setErrors(null);
            }
        }
    }
}
