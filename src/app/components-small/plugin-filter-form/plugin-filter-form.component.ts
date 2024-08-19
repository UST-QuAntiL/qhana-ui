import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ChoosePluginDialog } from 'src/app/dialogs/choose-plugin/choose-plugin.dialog';
import { PluginApiObject } from 'src/app/services/qhana-api-data-types';

@Component({
    selector: 'qhana-plugin-filter-form',
    templateUrl: './plugin-filter-form.component.html',
    styleUrl: './plugin-filter-form.component.sass'
})
export class PluginFilterFormComponent {
    @Input() filterIn: any;
    @Input() depth: number = 0;
    @Output() filterOut = new EventEmitter<any>();
    @Output() valid = new EventEmitter<boolean>();

    filterValue: string | Array<any> | null = null;
    isNestedFilter: boolean = false;
    nestedFilterCombinator: "and" | "or" = "or";
    isNegated: boolean = false;
    filterType: 'id' | 'name' | 'tag' | 'version' | 'type' | null = null;

    childFiltersOutput: Array<any> = [];
    childFiltersValid: Array<boolean> = [];

    constructor(private dialog: MatDialog) { }

    ngOnInit(): void { }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.filterIn != null) {
            this.setupFilter();
        }
    }

    resetCurrentFilter() {
        this.isNegated = false;
        this.filterValue = null;
        this.filterType = null;
        this.isNestedFilter = false;
        this.nestedFilterCombinator = "or";
        this.childFiltersOutput = [];
        this.childFiltersValid = [];
    }

    setupFilter() {
        if (!this.filterIn) {
            // null or empty
            this.resetCurrentFilter();
            this.updateFilterObject();
            return;
        }
        let filter = this.filterIn
        let filterKeys = Object.keys(filter);
        if (filterKeys.length !== 1) {
            this.resetCurrentFilter();
            this.updateFilterObject();
            return;
        }

        if (filterKeys[0] === "not") {
            this.isNegated = true;
            filter = filter.not;
            filterKeys = Object.keys(filter);

            if (filterKeys.length === 0) {
                this.resetCurrentFilter();
                // specifically keep negated flag if child filter is empty!
                this.isNegated = true;
                this.updateFilterObject();
                return;
            } else if (filterKeys.length > 1) {
                this.resetCurrentFilter();
                this.updateFilterObject();
                return;
            }
        }

        if (filterKeys[0] === "and") {
            this.isNestedFilter = true;
            this.nestedFilterCombinator = "and";
            this.filterType = null;
            this.childFiltersOutput = [...filter.and];
            this.childFiltersValid = filter.and.map(() => true);
            this.filterValue = filter.and;
            this.updateFilterObject();
            return;
        }

        if (filterKeys[0] === "or") {
            this.isNestedFilter = true;
            this.nestedFilterCombinator = "or";
            this.filterType = null;
            this.childFiltersOutput = [...filter.or];
            this.childFiltersValid = filter.or.map(() => true);
            this.filterValue = filter.or;
            this.updateFilterObject();
            return;
        }

        if (['id', 'name', 'tag', 'version', 'type'].some(t => t === filterKeys[0])) {
            this.isNestedFilter = false;
            this.nestedFilterCombinator = "or";
            this.childFiltersOutput = [];
            this.childFiltersValid = [];
            this.filterType = filterKeys[0] as any;
            this.filterValue = filter[filterKeys[0]];
            this.updateFilterObject();
            return;
        }

        this.resetCurrentFilter();
        this.updateFilterObject();
        return;
    }

    updateFilterObject() {
        let filter: any = {};
        if (this.isNestedFilter) {
            filter[this.nestedFilterCombinator] = this.childFiltersOutput.filter(v => Boolean(v));
        } else if (this.filterType != null) {
            filter[this.filterType] = this.filterValue;
        }

        let isValid = true;
        if (this.isNestedFilter) {
            if (this.childFiltersOutput.length === 0) {
                isValid = false;  // nested filters must have at least one child filter
            }
            if (this.childFiltersValid.some(valid => !valid)) {
                isValid = false;  // nested filters cannot have invalid child filters
            }
        } else if (this.depth > 0) {
            if (this.filterType == null) {
                isValid = false;  // nested filters cannot be empty
            }
            if (this.filterValue == null || this.filterValue === "") {
                isValid = false;  // nested filters cannot be empty
            }
        }

        if (this.isNegated) {
            filter = { not: filter };
        }

        if (this.childFiltersOutput === this.filterValue) {
            console.warn("Possible infinite update loop, aborting update!");
            return
        }
        Promise.resolve().then(() => {
            this.valid.emit(isValid);
            this.filterOut.emit(filter);
        });
    }

    deleteChild(index: number) {
        if (!this.isNestedFilter || !Array.isArray(this.filterValue)) {
            return;
        }
        if (this.childFiltersOutput.length >= index + 1) {
            const newFilterValue = [...this.childFiltersOutput]
            newFilterValue.splice(index, 1);
            this.childFiltersOutput = newFilterValue
            this.childFiltersValid.splice(index, 1);
            this.filterValue = [...newFilterValue];
            this.updateFilterObject();
        }
    }

    addChildFilter() {
        if (!this.isNestedFilter || !Array.isArray(this.filterValue)) {
            return;
        }
        const filter: any = {};
        this.childFiltersOutput.push(filter);
        this.childFiltersValid.push(true);
        this.filterValue.push(filter);
        this.updateFilterObject();
    }

    setType(type: 'and' | 'or' | 'id' | 'name' | 'tag' | 'version' | 'type') {
        if (this.isNestedFilter || this.filterType != null) {
            return; // already chose a filter type
        }
        if (type === "and" || type === "or") {
            this.isNestedFilter = true;
            this.nestedFilterCombinator = type;
            this.filterType = null;
            // start with one empty filter
            this.childFiltersOutput = [null];
            this.childFiltersValid = [true];
            this.filterValue = [null];
            this.updateFilterObject();
            return;
        }

        this.isNestedFilter = false;
        this.nestedFilterCombinator = "or";
        this.filterType = type;
        this.childFiltersOutput = [];
        this.childFiltersValid = []
        this.filterValue = "";
        this.updateFilterObject();
    }

    changeFilterCombinator(combinator: "and" | "or") {
        if (!this.isNestedFilter || this.nestedFilterCombinator === combinator) {
            return;
        }
        this.nestedFilterCombinator = combinator;
        this.updateFilterObject();
    }

    changeSimpleFilterType(type: 'id' | 'name' | 'tag' | 'version' | 'type') {
        if (this.isNestedFilter || this.filterType === type) {
            return;
        }
        this.filterType = type;
        this.updateFilterObject();
    }

    openPluginChooser() {
        const dialogRef = this.dialog.open(ChoosePluginDialog, {});
        dialogRef.afterClosed().subscribe((result: PluginApiObject | null) => {
            if (result == null) {
                return; // nothing was selected
            }
            if (this.isNestedFilter) {
                return;
            }
            if (this.filterType === "id") {
                this.filterValue = result.identifier;
                this.updateFilterObject();
            }
            if (this.filterType === "name") {
                this.filterValue = result.title;
                this.updateFilterObject();
            }
        });
    }

}
