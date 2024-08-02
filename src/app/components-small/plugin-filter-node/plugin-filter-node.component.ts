import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ChoosePluginDialog } from 'src/app/dialogs/choose-plugin/choose-plugin.dialog';
import { PluginApiObject } from 'src/app/services/qhana-api-data-types';

// Define filter types ('not' excluded)
// The PluginFilterNodeComponent component is designed to encapsulate a filter object and the information wether the filter is inverted ('not').
// When the filter is inverted, the filter object is wrapped in a 'not' object and the 'inverted' property is set to true.
const filterTypes = ['and', 'or', 'id', 'name', 'tag', 'version', 'type'] as const;
type FilterType = (typeof filterTypes)[number];
const isFilterType = (x: any): x is FilterType => filterTypes.includes(x);

@Component({
    selector: 'qhana-plugin-filter-node',
    templateUrl: './plugin-filter-node.component.html',
    styleUrls: ['./plugin-filter-node.component.sass']
})
export class PluginFilterNodeComponent implements OnInit {
    @Input() filterIn: any;
    @Input() depth: number = 0;
    @Output() filterOut = new EventEmitter<any>();
    @Output() delete = new EventEmitter<void>();

    filterObject: any = {};
    type: FilterType | null = null;
    children: any[] | null = null;
    value: string | null = null;
    inverted: boolean = false;
    isEmpty: boolean = true;

    constructor(private dialog: MatDialog) { }

    ngOnInit(): void {
        this.setupFilter();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.filterIn.previousValue != null) {
            this.setupFilter();
        }
    }

    setupFilter() {
        this.isEmpty = Object.keys(this.filterIn).length === 0;
        this.filterObject = JSON.parse(JSON.stringify(this.filterIn));
        const filter = this.filterObject.not ?? this.filterObject;
        this.inverted = this.filterObject.not != null;
        if (filter == null) {
            console.warn("No filter object provided to plugin filter node component");
            return;
        }
        if (this.isEmpty) {
            return;
        }
        const filterKeys = Object.keys(filter)
        if (filterKeys.length != 1) {
            console.error("Filters with more than one attribute are not supported! ", filterKeys);
        }
        const type = filterKeys[0];
        if (!isFilterType(type)) {
            console.warn("Invalid filter type provided to plugin filter node component: ", type);
            return;
        }
        this.type = type as FilterType;
        const isLeaf = filter.and == null && filter.or == null;
        if (isLeaf) {
            this.value = filter[this.type];
        } else {
            this.children = filter[this.type];
        }
    }

    updateFilterObject() {
        if (this.type == null) {
            console.warn("No type provided to plugin filter node component");
            return;
        }
        const filter = JSON.parse(JSON.stringify(this.filterObject));
        if (this.inverted) {
            filter.not[this.type] = this.children ?? this.value;
        } else {
            filter[this.type] = this.children ?? this.value;
        }
        this.filterOut.emit(filter);
    }

    setFilter(type: FilterType) {
        const isLeaf = type !== 'and' && type !== 'or';
        this.type = type;
        this.children = isLeaf ? null : [];
        this.value = isLeaf ? "" : null;
        this.updateFilterObject();
        this.isEmpty = false;
    }

    deleteChild(index: number) {
        if (this.children == null) {
            console.warn("Cannot delete child filter: Filter has no children!");
            return;
        }
        this.children.splice(index, 1);
        this.updateFilterObject();
    }

    addFilter(type: FilterType = 'name') {
        if (this.children == null) {
            console.warn("Cannot add child filter because the plugin filter node component is a leaf node!");
            return;
        }
        const filterValue = (type === 'and' || type === 'or') ? [] : "";
        this.children.push({ [type]: filterValue });
        this.updateFilterObject();
    }

    updateChild(value: any, index: number) {
        if (this.children == null) {
            console.warn("No children provided to plugin filter node component");
            return;
        }
        if (value == null) {
            this.children.splice(index, 1);
        } else {
            this.children[index] = value;
        }
        this.updateFilterObject();
    }

    changeType(type: FilterType) {
        if (type == null || this.type === type) {
            return;
        }
        const filter = this.filterObject.not ?? this.filterObject;
        const isLeaf = type !== 'and' && type !== 'or';
        if (this.type != null) {
            delete filter[this.type]
        }
        this.type = type;
        if (isLeaf) {
            this.children = null;
            filter[type] = this.value ?? "";
        } else {
            this.value = null;
            filter[type] = this.children ?? [];
        }
        this.filterOut.emit(JSON.parse(JSON.stringify(this.filterObject)));
    }

    updateFilterString(event: any) {
        this.value = event.target.value;
        this.updateFilterObject();
    }

    invertFilter(event: any) {
        this.inverted = event.checked;
        if (this.inverted) {
            this.filterObject = { not: this.filterObject };
        } else {
            this.filterObject = this.filterObject.not;
        }
        this.filterOut.emit(JSON.parse(JSON.stringify(this.filterObject)));
    }

    openPluginChooser() {
        const dialogRef = this.dialog.open(ChoosePluginDialog, {});
        dialogRef.afterClosed().subscribe((result: PluginApiObject | null) => {
            if (result == null) {
                return; // nothing was selected
            }
            if (this.type === "id") {
                this.value = result.identifier;
                this.updateFilterObject();
            }
            if (this.type === "name") {
                this.value = result.title;
                this.updateFilterObject();
            }
        });

    }
}
