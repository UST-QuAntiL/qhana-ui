import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

const ALLOWED_FILTER_KEYS: Set<'and' | 'or' | 'not' | 'id' | 'name' | 'tag' | 'version' | 'type'> = new Set(['and', 'or', 'not', 'id', 'name', 'tag', 'version', 'type']);

function isAllowedFilter(filterType: string): filterType is 'and' | 'or' | 'not' | 'id' | 'name' | 'tag' | 'version' | 'type' {
    return ALLOWED_FILTER_KEYS.has(filterType as any);
}

@Component({
    selector: 'qhana-plugin-filter-view',
    templateUrl: './plugin-filter-view.component.html',
    styleUrl: './plugin-filter-view.component.sass'
})
export class PluginFilterViewComponent implements OnChanges {

    @Input() filter: any = null;

    filterType: 'empty' | 'and' | 'or' | 'not' | 'id' | 'name' | 'tag' | 'version' | 'type' | null = null;

    ngOnChanges(changes: SimpleChanges): void {
        if (this.filter == null) {
            this.filterType = null;
            return;
        }

        const keys = Object.keys(this.filter);
        if (keys.length !== 1) {
            if (keys.length === 0) {
                this.filterType = 'empty';
            } else {
                this.filterType = null;
            }
            return;
        }
        const filterType = keys[0];
        if (!isAllowedFilter(filterType)) {
            this.filterType = null;
            return;
        }
        this.filterType = filterType;
    }
}
