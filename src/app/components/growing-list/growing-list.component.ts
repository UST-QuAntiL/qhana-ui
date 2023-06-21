import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, SimpleChanges, TrackByFunction } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject, Subscription, from, isObservable } from 'rxjs';
import { concatMap, filter } from 'rxjs/operators';
import { DeleteDialog } from 'src/app/dialogs/delete-dialog/delete-dialog.dialog';
import { ApiLink, ApiObject, isCollectionApiObject, matchesLinkRel } from 'src/app/services/api-data-types';
import { PluginRegistryBaseService } from 'src/app/services/registry.service';


@Component({
    selector: 'qhana-growing-list',
    templateUrl: './growing-list.component.html',
    styleUrls: ['./growing-list.component.sass']
})
export class GrowingListComponent implements OnInit, OnDestroy {
    @Input() rels: string[] | string[][] | null = null;
    @Input() query: URLSearchParams | null = null;
    @Input() apiLink: ApiLink | null = null;

    // if set, add new items with the rels here to the list
    @Input() newItemRels: string | string[] | null = null;
    // additional filter to check if new items should be added to the list
    @Input() newItemsFilter: ((apiLink: ApiLink) => boolean) | null = null
    // if true (the default) changed items will be removed from the list
    // if they do not match the newItemsFilter (only if the filter is not null)
    @Input() applyNewItemsFilterToChanged: boolean = true;

    @Input() set search(value: string | null) {
        this.normalizedSearch = value?.toLowerCase()?.trim() ?? null;
    }

    normalizedSearch: string | null = null;

    @Input() editButton: boolean = false;
    @Input() deleteButton: boolean = false;

    @Input() noDefaultDeleteAction: boolean = false;

    @Input() itemModel: string = "default";

    @Input() highlighted: Set<string> = new Set();
    @Input() highlightByKey: string | null = null;

    @Output() itemsChanged: EventEmitter<ApiLink[]> = new EventEmitter<ApiLink[]>();
    @Output() collectionSize: EventEmitter<number> = new EventEmitter<number>();
    @Output() clickItem: EventEmitter<ApiLink> = new EventEmitter<ApiLink>();
    @Output() editItem: EventEmitter<ApiLink> = new EventEmitter<ApiLink>();
    @Output() deleteItem: EventEmitter<ApiLink> = new EventEmitter<ApiLink>();

    private startApiLink: ApiLink | null = null;
    private startQueryArgs: URLSearchParams | null = null;
    loadMoreApiLink: ApiLink | null = null;
    isLoading: boolean = false;
    loadMoreClicked: boolean = false;

    private lastCollectionSize: number | null = null;

    private updateQueue: Subject<() => Promise<unknown> | Observable<unknown>> = new Subject();

    private updateQueueSubscription: Subscription | null = null;
    private newItemsSubscription: Subscription | null = null;
    private changedItemsSubscription: Subscription | null = null;
    private deletedItemsSubscription: Subscription | null = null;

    items: ApiLink[] = [];

    constructor(private registry: PluginRegistryBaseService, private dialog: MatDialog) { }

    ngOnInit(): void {
        this.updateQueueSubscription = this.updateQueue.pipe(concatMap(callback => {
            const result = callback();
            if (isObservable(result)) {
                return result;
            }
            return from(result);
        })).subscribe();

        this.setupGrowingList();
    }

    ngOnDestroy(): void {
        this.unsubscribeAll();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.apiLink?.previousValue || changes.rels?.previousValue || changes.query?.previousValue || changes.newItemRels?.previousValue) {
            this.unsubscribeAll();
            this.newItemsSubscription = null;
            this.changedItemsSubscription = null;
            this.deletedItemsSubscription = null;
            this.updateQueueSubscription = null;
            this.startApiLink = null;
            this.startQueryArgs = null;
            this.loadMoreApiLink = null;
            this.isLoading = false;
            this.loadMoreClicked = false;
            this.lastCollectionSize = null;
            this.items = [];
            this.setupGrowingList();
        }
    }

    private unsubscribeAll(): void {
        this.newItemsSubscription?.unsubscribe();
        this.changedItemsSubscription?.unsubscribe();
        this.deletedItemsSubscription?.unsubscribe();
        this.updateQueueSubscription?.unsubscribe();
    }

    private setupGrowingList() {
        if (this.apiLink != null) {
            this.replaceApiLink(this.apiLink);
        } else {
            const rels = this.rels
            if (rels != null) {
                this.registry.resolveRecursiveRels(rels).then((apiLink) => this.replaceApiLink(apiLink));
            }
        }

        // handle api updates
        const newItemRels = this.newItemRels;
        if (newItemRels) {
            this.newItemsSubscription = this.registry.newApiObjectSubject
                .pipe(filter(newObject => matchesLinkRel(newObject.new, newItemRels)))
                .subscribe(newObject => this.updateQueue.next(() => this.onNewObjectQueued(newObject.new)));
        }
        this.changedItemsSubscription = this.registry.changedApiObjectSubject
            .pipe(filter(changedObject => {
                const isInList = this.items.some(item => item.href === changedObject.changed.href);
                const maybeNew = newItemRels != null && matchesLinkRel(changedObject.changed, newItemRels);
                return isInList || maybeNew;
            }))
            .subscribe(changedObject => this.updateQueue.next(() => this.onChangedObjectQueued(changedObject.changed)));
        this.deletedItemsSubscription = this.registry.deletedApiObjectSubject
            .pipe(filter(deletedObject => this.items.some(item => item.href === deletedObject.deleted.href)))
            .subscribe(deletedObject => this.updateQueue.next(() => this.onDeletedObjectQueued(deletedObject.deleted)));
    }

    replaceApiLink(newApiLink: ApiLink): void {
        if (newApiLink.href === this.startApiLink?.href) {
            if (this.query === this.startQueryArgs) {
                // nothing changed, nothing to do
                return;
            }
        }
        if (!matchesLinkRel(newApiLink, "page") && !matchesLinkRel(newApiLink, "collection")) {
            console.warn("The given api link does not correspond to a collection resource!", this.apiLink);
            return;
        }
        if (newApiLink.rel.some(rel => rel === "page") && !newApiLink.rel.some(rel => rel === "page-1")) {
            console.warn("The given api link does not correspond to the first page of a paginated collection resource!", this.apiLink);
        }
        this.loadMoreApiLink = null;
        this.lastCollectionSize = null;
        this.collectionSize.emit(0);
        const query = this.query;
        this.updateQueue.next(() => this.replaceApiLinkQueued(newApiLink, query));
    }

    reloadAll() {
        const reloadApiLink = this.startApiLink;
        const query = this.startQueryArgs;
        if (reloadApiLink == null) {
            return;
        }
        this.loadMoreApiLink = null;
        this.updateQueue.next(() => this.replaceApiLinkQueued(reloadApiLink, query));
    }

    async replaceApiLinkQueued(newApiLink: ApiLink, query: URLSearchParams | null) {
        if (this.isLoading) {
            console.error("Cannot chang base api link while loading.");
            return; // should not happen if called correctly via update queue
        }
        this.isLoading = true;
        const response = await this.registry.getByApiLink<ApiObject>(newApiLink, query, true);
        if (response == null) {
            console.error("Api did not respond.", newApiLink);
            this.isLoading = false;
            return;
        }
        if (!isCollectionApiObject(response.data)) {
            console.error("Api response is not a collection resource.", response);
            this.isLoading = false;
            return;
        }
        this.startApiLink = newApiLink;
        this.startQueryArgs = query;
        this.items = [...response.data.items];
        this.loadMoreApiLink = response.links.find(link => matchesLinkRel(link, "next")) ?? null;
        this.isLoading = false;
        this.loadMoreClicked = false;
        this.itemsChanged.emit([...this.items]);
        this.lastCollectionSize = response.data.collectionSize;
        this.collectionSize.emit(response.data.collectionSize);
    }

    loadMore() {
        this.loadMoreClicked = true;
        this.updateQueue.next(() => this.loadMoreQueued());
    }

    async loadMoreQueued() {
        if (this.isLoading) {
            return; // should not happen if
        }
        const nextLink = this.loadMoreApiLink;
        if (nextLink == null) {
            return;
        }
        this.isLoading = true;
        const items = this.items;
        const response = await this.registry.getByApiLink<ApiObject>(nextLink, null, true);
        if (response == null) {
            console.error("Api did not respond.", nextLink);
            this.isLoading = false;
            return;
        }
        if (!isCollectionApiObject(response.data)) {
            console.error("Api response is not a collection resource.", response);
            this.loadMoreApiLink = null;
            this.isLoading = false;
            return;
        }
        this.items = [...items, ...response.data.items];
        this.loadMoreApiLink = response.links.find(link => matchesLinkRel(link, "next")) ?? null;
        this.isLoading = false;
        this.loadMoreClicked = false;
        this.itemsChanged.emit([...this.items]);
        this.lastCollectionSize = response.data.collectionSize;
        this.collectionSize.emit(response.data.collectionSize);
    }

    private async onNewObjectQueued(newObjectLink: ApiLink) {
        const passedFilter = this.newItemsFilter?.(newObjectLink) ?? true;
        if (!passedFilter) {
            // object did not pass the filter, do not add it to the list
            return;
        }
        this.items = [...this.items, newObjectLink];
        this.itemsChanged.emit([...this.items]);
        this.lastCollectionSize = (this.lastCollectionSize ?? 0) + 1; // extrapolate collection size
        this.collectionSize.emit(this.lastCollectionSize ?? 0);
    }

    private async onChangedObjectQueued(changedObjectLink: ApiLink) {
        const existing = this.items.find(link => link.href === changedObjectLink.href);
        if (existing && this.applyNewItemsFilterToChanged && this.newItemsFilter != null) {
            // changed objects should additionally be checked by the newItemsFilter
            if (!this.newItemsFilter(changedObjectLink)) {
                // changed object did not pass the newItemsFilter, handle as a deleted object!
                await this.onDeletedObjectQueued(changedObjectLink);
                return;
            }
        }
        if (existing && existing.name !== changedObjectLink.name) {
            // only update here if the name has changed! (as this component only directly deals with the api links)
            const newItems = [...this.items];
            const index = newItems.findIndex(link => link.href === changedObjectLink.href);
            if (index < 0) {
                return;
            }
            newItems[index] = changedObjectLink;
            this.items = newItems;
            this.itemsChanged.emit([...this.items]);
        }

        const newItemRels = this.newItemRels;
        if (!existing && newItemRels && matchesLinkRel(changedObjectLink, newItemRels)) {
            await this.onNewObjectQueued(changedObjectLink);
        }
    }

    private async onDeletedObjectQueued(deletedObjectLink: ApiLink) {
        const newItems = this.items.filter(link => link.href !== deletedObjectLink.href);
        if (newItems.length === this.items.length) {
            return; // nothing filtered
        }
        this.items = newItems;
        this.itemsChanged.emit([...this.items]);
        if (this.lastCollectionSize == null) {
            this.collectionSize.emit(0);
        } else if (this.lastCollectionSize == 1) {
            this.lastCollectionSize = null; // assume deleted last item
            this.collectionSize.emit(0);
        } else {
            this.lastCollectionSize -= 1; // extrapolate collection size
            this.collectionSize.emit(this.lastCollectionSize);
        }
    }

    trackBy: TrackByFunction<ApiLink> = (index, item: ApiLink): string => {
        return item.href;
    }

    isHighlighted(link: ApiLink): boolean {
        if (this.highlightByKey) {
            const testValue = link.resourceKey?.[this.highlightByKey];
            return testValue != null && this.highlighted.has(testValue);
        }
        return this.highlighted.has(link.href);
    }

    isInSearch(link: ApiLink): boolean {
        const search = this.normalizedSearch;
        if (search == null || search === "") {
            return true;
        }
        return link.name?.toLowerCase()?.includes(search) ?? false;
    }

    onItemClick(link: ApiLink) {
        this.clickItem.emit(link);
    }

    onItemEditClick(link: ApiLink) {
        this.editItem.emit(link);
    }

    onItemDeleteClick(link: ApiLink) {
        this.deleteItem.emit(link);
        if (this.noDefaultDeleteAction) {
            return;
        }
        this.onDeleteItem(link);
    }

    private async onDeleteItem(link: ApiLink) {
        const itemResponse = await this.registry.getByApiLink(link, null, false);
        const deleteLink = itemResponse?.links?.find(link => link.rel.some(rel => rel === "delete")) ?? null;

        if (deleteLink == null) {
            console.info(`Cannot delete ApiObject ${link}. No delete link found!`);
            return; // cannot delete!
        }

        const dialogRef = this.dialog.open(DeleteDialog, {
            data: link,
        });

        const doDelete = await dialogRef.afterClosed().toPromise();
        if (doDelete) {
            this.registry.submitByApiLink(deleteLink);
        }
    }
}
