import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ApiLink, ApiResponse } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';
import { TAB_GROUP_NAME_OVERRIDES, TemplateApiObject, TemplateTabApiObject } from 'src/app/services/templates.service';

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

    tabGroupNameOverrides = Object.entries(TAB_GROUP_NAME_OVERRIDES)
        .map(entry => { return { key: entry[0], value: entry[1] }; })
        .sort((a, b) => {
            if (a.key === "workspace") {
                return -1;
            }
            else if (b.key === "workspace") {
                return 1;
            }
            return a.value.localeCompare(b.value)
        });


    private initialValues = {
        name: "",
        description: "",
        icon: null,
        sortKey: 0,
        location: "workspace",
        locationExtra: "",
        groupKey: "",
    };

    templateForm: FormGroup = this.fb.group({
        name: [this.initialValues.name, [Validators.required, Validators.minLength(1)]],
        description: this.initialValues.description,
        icon: [this.initialValues.locationExtra, [Validators.maxLength(64)]],
        sortKey: this.initialValues.sortKey,
        location: [this.initialValues.location, [Validators.required, isInSetValidator(Object.keys(TAB_GROUP_NAME_OVERRIDES))]],
        locationExtra: [this.initialValues.locationExtra],
        groupKey: [this.initialValues.locationExtra, [Validators.maxLength(32)]],
    });

    constructor(private registry: PluginRegistryBaseService, private fb: FormBuilder) { }

    ngOnInit() {
        this.templateForm.addValidators((control): ValidationErrors | null => {
            const loc = control.get("location")?.getRawValue() ?? "";
            if (loc === "workspace") {
                const groupKey = control.get("groupKey")?.getRawValue() ?? "";
                if (groupKey) {
                    return {
                        groupKeyForbidden: true,
                    };
                }
            }
            return null;
        });
        if (this.tabLink != null) {
            this.registry.getByApiLink<TemplateTabApiObject>(this.tabLink).then(response => {
                const location = response?.data?.location ?? this.initialValues.location
                const [baseLocation, locationExtra] = location.split(".", 2);
                this.templateForm.setValue({
                    name: response?.data?.name ?? this.initialValues.name,
                    description: response?.data?.description ?? this.initialValues.description,
                    icon: response?.data?.icon ?? this.initialValues.icon,
                    sortKey: response?.data?.sortKey ?? this.initialValues.sortKey,
                    groupKey: response?.data?.groupKey ?? this.initialValues.groupKey,
                    location: baseLocation,
                    locationExtra: locationExtra ?? "",
                });
            });
        }
    }

    async onSubmit() {
        let findString: string;
        let response: ApiResponse<TemplateApiObject | TemplateTabApiObject> | null;
        if (this.templateForm.invalid) {
            return;
        }
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
            let iconValue = this.templateForm.value.icon;
            if (!iconValue) {
                iconValue = null;
            }
            const location = [this.templateForm.value.location]
            if (this.templateForm.value.location !== "workspace" && this.templateForm.value.locationExtra) {
                location.push(this.templateForm.value.locationExtra);
            }
            const groupKey = this.templateForm.value.groupKey;
            this.registry.submitByApiLink<TemplateTabApiObject>(link, {
                name: this.templateForm.value.name,
                description: this.templateForm.value.description,
                icon: iconValue,
                sortKey: this.templateForm.value.sortKey,
                groupKey: groupKey,
                filterString: Boolean(groupKey) ? "" : this.filterString,
                location: location.join("."),
            });
            if (this.templateLink != null) {
                this.templateForm.reset(this.initialValues);
                this.templateForm.controls.name.setErrors(null);
            }
        }
    }
}
