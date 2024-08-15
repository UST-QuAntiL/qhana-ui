import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { TAB_GROUP_NAME_OVERRIDES, TemplateTabApiObject } from 'src/app/services/templates.service';
import { FormBuilder, FormGroup, ValidationErrors, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { Subscription } from 'rxjs';

export function isInSetValidator(validValues: any[]): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
        if (!validValues.includes(control.value)) {
            return { invalidValue: true };
        }
        return null;
    };
}

@Component({
    selector: 'qhana-ui-template-tab-form',
    templateUrl: './ui-template-tab-form.component.html',
    styleUrl: './ui-template-tab-form.component.sass'
})
export class UiTemplateTabFormComponent implements OnChanges, OnDestroy, OnInit {

    @Input() tabData: TemplateTabApiObject | null = null;

    @Output() isDirty: EventEmitter<boolean> = new EventEmitter(false);
    @Output() isValid: EventEmitter<boolean> = new EventEmitter(false);
    @Output() data: EventEmitter<any> = new EventEmitter();
    @Output() formSubmit: EventEmitter<void> = new EventEmitter();

    private formStatusSubscription: Subscription | null = null;
    private formValueSubscription: Subscription | null = null;

    description: string = "";

    currentPluginFilter: any = null;

    updatedPluginFilter: any = null;
    pluginFilterValid: boolean = false;

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
        icon: null,
        sortKey: 0,
        location: "workspace",
        locationExtra: "",
        groupKey: "",
    };

    templateForm: FormGroup | null = null;

    constructor(private fb: FormBuilder) { }

    ngOnInit(): void {
        this.ngOnChanges({});
    }

    ngOnDestroy(): void {
        this.formStatusSubscription?.unsubscribe();
        this.formValueSubscription?.unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges): void {
        this.formStatusSubscription?.unsubscribe();
        this.formValueSubscription?.unsubscribe();
        const templateForm = this.fb.group({
            name: [this.initialValues.name, [Validators.required, Validators.minLength(1)]],
            icon: [this.initialValues.locationExtra, [Validators.maxLength(64)]],
            sortKey: this.initialValues.sortKey,
            location: [this.initialValues.location, [Validators.required, isInSetValidator(Object.keys(TAB_GROUP_NAME_OVERRIDES))]],
            locationExtra: [this.initialValues.locationExtra],
            groupKey: [this.initialValues.locationExtra, [Validators.maxLength(32)]],
        });
        templateForm.addValidators((control): ValidationErrors | null => {
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
        if (this.tabData != null) {
            const location = this.tabData.location;
            const [baseLocation, locationExtra] = location.split(".", 2);
            this.description = this.tabData.description;
            try {
                this.currentPluginFilter = JSON.parse(this.tabData.filterString);
            } catch {
                this.currentPluginFilter = null;
            }
            templateForm.setValue({
                name: this.tabData.name,
                icon: this.tabData.icon,
                sortKey: this.tabData.sortKey,
                groupKey: this.tabData.groupKey,
                location: baseLocation,
                locationExtra: locationExtra ?? "",
            });
        } else {
            this.description = "";
        }
        this.formStatusSubscription = templateForm.statusChanges.subscribe(() => {
            this.updateDirty();
            this.isValid.emit(!templateForm.invalid);
        });
        this.formValueSubscription = templateForm.valueChanges.subscribe((value) => {
            let location = value.location ?? "workspace";
            if (value.locationExtra) {
                location = `${location}.${value.locationExtra}`;
            }
            const data: any = {
                "name": value.name,
                "icon": value.icon,
                "sortKey": value.sortKey,
                "location": location,
                "groupKey": value.groupKey ?? "",
            };
            data.description = this.description;
            if (value.groupKey) {
                data.filterString = ""
            } else {
                if (this.updatedPluginFilter) {
                    data.filterString = JSON.stringify(this.updatedPluginFilter);
                } else {
                    data.filterString = "{}";
                }
            }
            this.data.emit(data);
        });
        this.templateForm = templateForm;
    }

    public submitForm() {
        this.templateForm?.updateValueAndValidity();
        this.formSubmit.emit();
    }

    async onSubmit() {
        this.formSubmit.emit();
    }

    updateDirty() {
        let dirty = (this.templateForm?.dirty ?? false) || (this.description !== this.tabData?.description ?? "");

        if (Boolean(this.currentPluginFilter) && Boolean(this.updatedPluginFilter)) {
            if (JSON.stringify(this.currentPluginFilter) !== JSON.stringify(this.updatedPluginFilter)) {
                dirty = true;
            }
        } else if (Boolean(this.currentPluginFilter) !== Boolean(this.updatedPluginFilter)) {
            dirty = true;
        }

        Promise.resolve().then(() => {
            this.isDirty.emit(dirty);
        });
    }

    updateValid() {
        let isValid = true;
        if (this.templateForm == null || this.templateForm.invalid) {
            isValid = false;
        }
        if (!this.pluginFilterValid) {
            isValid = false;
        }

        Promise.resolve().then(() => {
            this.isValid.emit(isValid);
        });
    }

}
