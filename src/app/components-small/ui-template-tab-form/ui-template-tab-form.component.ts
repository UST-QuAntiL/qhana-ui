import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, PristineChangeEvent, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TAB_GROUP_NAME_OVERRIDES, TemplateTabApiObject } from 'src/app/services/templates.service';

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
    styleUrl: './ui-template-tab-form.component.sass',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class UiTemplateTabFormComponent implements OnChanges, OnDestroy, OnInit {

    @Input() tabData: TemplateTabApiObject | null = null;

    @Output() isDirty: EventEmitter<boolean> = new EventEmitter(false);
    @Output() isValid: EventEmitter<boolean> = new EventEmitter(false);
    @Output() data: EventEmitter<any> = new EventEmitter();
    @Output() formSubmit: EventEmitter<void> = new EventEmitter();

    private formEventsSubscription: Subscription | null = null;
    private formStatusSubscription: Subscription | null = null;
    private formValueSubscription: Subscription | null = null;

    metadataFormGroup: FormGroup | null = null;

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
        metadata: {},
    };

    templateForm: FormGroup | null = null;

    constructor(private fb: FormBuilder) { }

    ngOnInit(): void {
        const newMetaGroup = this.fb.group<{ [props: string]: string }>(this.initialValues.metadata ?? {});
        this.metadataFormGroup = newMetaGroup;
        const templateForm = this.fb.group({
            name: [this.initialValues.name, [Validators.required, Validators.minLength(1)]],
            icon: [this.initialValues.locationExtra, [Validators.maxLength(64)]],
            sortKey: this.initialValues.sortKey,
            location: [this.initialValues.location, [Validators.required, isInSetValidator(Object.keys(TAB_GROUP_NAME_OVERRIDES))]],
            locationExtra: [this.initialValues.locationExtra],
            groupKey: [this.initialValues.locationExtra, [Validators.maxLength(32)]],
            metadata: newMetaGroup,
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


        this.formEventsSubscription = templateForm.events.subscribe((event) => {
            if (event instanceof PristineChangeEvent) {
                this.updateDirty();
            }
        });
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
                "metadata": value.metadata,
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

        this.ngOnChanges({});
    }

    ngOnDestroy(): void {
        this.formEventsSubscription?.unsubscribe();
        this.formStatusSubscription?.unsubscribe();
        this.formValueSubscription?.unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.tabData != null) {
            const location = this.tabData.location;
            const [baseLocation] = location.split(".", 1);
            const locationExtra = location.length > baseLocation.length ? location.substring(baseLocation.length + 1) : "";
            this.description = this.tabData.description;
            try {
                this.currentPluginFilter = JSON.parse(this.tabData.filterString);
            } catch {
                this.currentPluginFilter = null;
            }
            const metadata = this.tabData.metadata ?? {};

            // add missing controls to form group before setting value
            // redundant controls will be automatically removed by the key-value input component
            const metadataKeys = Object.keys(metadata);
            metadataKeys.forEach(key => {
                if (this.metadataFormGroup?.contains(key)) {
                    return;
                }
                this.metadataFormGroup?.addControl(key, new FormControl<string>(""));
            });

            this.templateForm?.setValue({
                name: this.tabData.name,
                icon: this.tabData.icon,
                sortKey: this.tabData.sortKey,
                groupKey: this.tabData.groupKey,
                location: baseLocation,
                locationExtra: locationExtra,
                metadata: metadata,
            });
        } else {
            this.description = "";
        }
    }

    public submitForm() {
        this.templateForm?.updateValueAndValidity();
        this.formSubmit.emit();
    }

    async onSubmit() {
        this.formSubmit.emit();
    }

    updateDirty() {
        let dirty = (this.templateForm?.dirty ?? false) || (this.description !== (this.tabData?.description ?? ""));

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
