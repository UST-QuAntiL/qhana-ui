import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';

@Component({
    selector: 'qhana-key-value-input',
    templateUrl: './key-value-input.html',
    styleUrl: './key-value-input.sass',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false,
})
export class KeyValueInputComponent implements OnInit, OnDestroy {

    private valueChangeSubscription: Subscription | null = null;

    @Input({ required: true }) formGroup: FormGroup | null = null;

    keys: string[] = [];

    ngOnInit(): void { // FIXME: handle initial data somewhere!
        if (this.formGroup == null) {
            console.warn("The key-value input component requires a form group on init!");
            return;
        }
        this.valueChangeSubscription = this.formGroup.valueChanges.subscribe((value) => this.updateFormGroup(value));
        // force update for initial keys
        this.updateFormGroup(this.formGroup.value);
    }

    ngOnDestroy(): void {
        this.valueChangeSubscription?.unsubscribe();
    }

    addKey(newKey: string) {
        if (this.keys.includes(newKey)) {
            return;
        }
        const currentValue = this.formGroup?.getRawValue() ?? {};
        currentValue[newKey] = "";
        this.keys.push(newKey);
        this.formGroup?.addControl(newKey, new FormControl<string>(""));
        this.formGroup?.setValue(currentValue);
        this.formGroup?.controls?.[newKey]?.markAsDirty();
    }

    removeKey(key: string) {
        this.keys = this.keys.filter(k => k !== key);
        this.formGroup?.removeControl(key);
        this.formGroup?.markAsDirty({ onlySelf: true });
    }

    private updateFormGroup(value: { [props: string]: string }) {
        const newKeys = Object.keys(value ?? {});
        const formGroupControls = Object.keys(this.formGroup?.controls ?? {});

        const toRemove = formGroupControls.filter(key => !newKeys.includes(key));

        this.keys = newKeys;

        toRemove.forEach(key => this.formGroup?.removeControl(key));
    }

}
