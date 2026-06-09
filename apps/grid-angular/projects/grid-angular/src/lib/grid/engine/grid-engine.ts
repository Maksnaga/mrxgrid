import { Injectable, inject, computed } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { SortEngine } from '../features/sort.engine';
import { FilterEngine } from '../features/filter.engine';
import { GroupEngine } from '../features/group.engine';
import { ServerGroupEngine } from '../features/server-group.engine';
import { DisplayRow } from '../models/display-row.model';

@Injectable()
export class GridEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);
  private readonly sortEngine = inject<SortEngine<T>>(SortEngine);
  private readonly filterEngine = inject<FilterEngine<T>>(FilterEngine);
  private readonly groupEngine = inject<GroupEngine<T>>(GroupEngine);
  private readonly serverGroupEngine = inject<ServerGroupEngine<T>>(ServerGroupEngine);

  /**
   * Pipeline step 1: sorted data.
   * In server mode, returns source data unchanged.
   */
  readonly sortedData = computed<T[]>(() => {
    const data = this.state.sourceData();
    if (this.state.mode() === 'server') return data;
    return this.sortEngine.sortData(data);
  });

  /**
   * Pipeline step 2: filtered data.
   * In server mode, returns sorted data unchanged.
   */
  readonly filteredData = computed<T[]>(() => {
    const data = this.sortedData();
    if (this.state.mode() === 'server') return data;
    return this.filterEngine.filterData(data);
  });

  /**
   * Pipeline step 3: paginated data.
   * In server mode, the data is already paginated by the server.
   * In infinite-scroll mode, all accumulated data is displayed (no slice).
   * Pagination applies before grouping so groups are per-page.
   */
  readonly paginatedData = computed<T[]>(() => {
    const data = this.filteredData();
    if (this.state.mode() === 'server') return data;
    if (this.state.loadingStrategy() === 'infinite-scroll') return data;
    // Pagination disabled: render the full filtered set so vertical
    // virtualization can window across every row.
    if (!this.state.paginationEnabled()) return data;

    const pageIndex = this.state.pageIndex();
    const pageSize = this.state.pageSize();
    const start = pageIndex * pageSize;
    return data.slice(start, start + pageSize);
  });

  /**
   * Pipeline final: display rows (flat array for virtual scroll).
   * If grouped, produces group header + data rows.
   * If not grouped, wraps paginated data rows.
   */
  readonly displayRows = computed<DisplayRow<T>[]>(() => {
    // Server-grouping mode: skip the client pipeline entirely and consume the
    // flat row list managed by ServerGroupEngine (group headers + lazy rows).
    if (this.state.groupMode() === 'server') {
      return this.serverGroupEngine.flatRows();
    }

    const groupCols = this.state.groupColumns();

    if (groupCols.length > 0) {
      return this.groupEngine.groupData(this.paginatedData());
    }

    const rows: DisplayRow<T>[] = [];
    const isInfiniteScroll = this.state.loadingStrategy() === 'infinite-scroll';

    for (let i = 0; i < this.paginatedData().length; i++) {
      const data = this.paginatedData()[i];
      const globalIndex = isInfiniteScroll ? i : this.state.pageIndex() * this.state.pageSize() + i;
      rows.push({ type: 'data' as const, data, index: globalIndex, depth: 0 });
    }

    return rows;
  });

  /**
   * Total items count for pagination.
   */
  readonly computedTotalItems = computed<number>(() => {
    if (this.state.mode() === 'server') return this.state.totalItems();
    return this.filteredData().length;
  });

  /**
   * Resolves a display row index (as emitted via `DisplayRow.index`) to the
   * actual index in `sourceData()`. When sort/filter/group is active these do
   * not match, so we look up the display row's data object and search for it
   * in sourceData. Returns -1 when the display index is unknown.
   */
  displayIndexToSourceIndex(displayIndex: number): number {
    const rows = this.displayRows();
    const row = rows.find((r) => r.type === 'data' && r.index === displayIndex);
    if (!row || row.type !== 'data') return -1;
    return this.state.sourceData().indexOf(row.data);
  }
}
