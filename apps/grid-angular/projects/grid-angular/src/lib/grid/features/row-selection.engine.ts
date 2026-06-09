import { Injectable, inject, computed, signal } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { GridEngine } from '../engine/grid-engine';
import { RowSelectionEvent } from '../models/grid-events.model';

@Injectable()
export class RowSelectionEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);
  private readonly engine = inject<GridEngine<T>>(GridEngine);

  readonly selectedIds = computed(() => this.state.selectedRowIds());
  readonly excludedIds = computed(() => this.state.excludedRowIds());
  /**
   * Anchor row for shift-click range selection. We track the row object
   * (not its index) so the anchor stays valid across grouping, sorting and
   * filtering — where display indices shift without the underlying row
   * changing.
   */
  readonly lastToggledRow = signal<T | null>(null);

  readonly count = computed(() => {
    const mode = this.state.selectAllMode();
    if (mode === 'all') {
      const total = this.state.totalItems() || this.state.sourceData().length;
      return total - this.state.excludedRowIds().size;
    }
    return this.state.selectedRowIds().size;
  });

  /**
   * @deprecated use count
   * Alias kept for back-compat. `count` is the canonical signal.
   */
  readonly allSelectedCount = this.count;

  readonly pageSelectedCount = computed(() => {
    const pageData = this.engine.paginatedData();
    return pageData.filter((row) => this.isRowSelected(row)).length;
  });

  readonly isAllSelected = computed(() => {
    const pageData = this.engine.paginatedData();
    if (pageData.length === 0) return false;
    return pageData.every((row) => this.isRowSelected(row));
  });

  readonly isIndeterminate = computed(() => {
    const pageData = this.engine.paginatedData();
    if (pageData.length === 0) return false;
    const pageSelected = pageData.filter((row) => this.isRowSelected(row)).length;
    return pageSelected > 0 && pageSelected < pageData.length;
  });

  /**
   * Extends the selection from the last-toggled row (the anchor) to `endRow`,
   * resolving positions by object identity against the currently paginated
   * data. This is robust to grouping / sorting / filtering because we don't
   * rely on numeric indices, and works across any visible page slice.
   */
  selectRowRangeToRow(endRow: T): void {
    const anchor = this.lastToggledRow();
    if (!anchor) {
      this.toggleRow(endRow);
      this.lastToggledRow.set(endRow);
      return;
    }
    const pageData = this.engine.paginatedData();
    const anchorIdx = pageData.indexOf(anchor);
    const endIdx = pageData.indexOf(endRow);
    if (anchorIdx < 0 || endIdx < 0) {
      // Anchor left the visible page — fall back to a plain toggle
      this.toggleRow(endRow);
      this.lastToggledRow.set(endRow);
      return;
    }
    const start = Math.min(anchorIdx, endIdx);
    const end = Math.max(anchorIdx, endIdx);
    this.state.selectedRowIds.update((ids) => {
      const next = new Set(ids);
      for (let i = start; i <= end; i++) {
        next.add(this.getRowId(pageData[i]));
      }
      return next;
    });
    if (this.state.selectAllMode() === 'none') {
      this.state.selectAllMode.set('page');
    }
    this.lastToggledRow.set(endRow);
  }

  toggleRow(row: T): void {
    const id = this.getRowId(row);
    const mode = this.state.selectAllMode();

    if (mode === 'all') {
      this.state.excludedRowIds.update((excluded) => {
        const next = new Set(excluded);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    } else {
      this.state.selectedRowIds.update((ids) => {
        const next = new Set(ids);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      this.state.selectAllMode.set(this.state.selectedRowIds().size === 0 ? 'none' : mode);
    }
  }

  isRowSelected(row: T): boolean {
    const id = this.getRowId(row);
    const mode = this.state.selectAllMode();
    if (mode === 'all') {
      return !this.state.excludedRowIds().has(id);
    }
    return this.state.selectedRowIds().has(id);
  }

  selectAllPage(): void {
    const pageData = this.engine.paginatedData();
    const mode = this.state.selectAllMode();

    if (mode === 'all') {
      // In 'all' mode, re-selecting a page means removing those rows from exclusions
      this.state.excludedRowIds.update((excluded) => {
        const next = new Set(excluded);
        for (const row of pageData) {
          next.delete(this.getRowId(row));
        }
        return next;
      });
    } else {
      this.state.selectedRowIds.update((ids) => {
        const next = new Set(ids);
        for (const row of pageData) {
          next.add(this.getRowId(row));
        }
        return next;
      });
      this.state.selectAllMode.set('page');
    }
  }

  selectAll(): void {
    this.state.selectedRowIds.set(new Set());
    this.state.excludedRowIds.set(new Set());
    this.state.selectAllMode.set('all');
  }

  deselectAll(): void {
    this.state.selectedRowIds.set(new Set());
    this.state.excludedRowIds.set(new Set());
    this.state.selectAllMode.set('none');
  }

  deselectPage(): void {
    const pageData = this.engine.paginatedData();
    const mode = this.state.selectAllMode();

    if (mode === 'all') {
      this.state.excludedRowIds.update((excluded) => {
        const next = new Set(excluded);
        for (const row of pageData) {
          next.add(this.getRowId(row));
        }
        return next;
      });
    } else {
      this.state.selectedRowIds.update((ids) => {
        const next = new Set(ids);
        for (const row of pageData) {
          next.delete(this.getRowId(row));
        }
        return next;
      });
      if (this.state.selectedRowIds().size === 0) {
        this.state.selectAllMode.set('none');
      }
    }
  }

  toggleSelectAllPage(): void {
    if (this.isAllSelected()) {
      this.deselectPage();
    } else {
      this.selectAllPage();
    }
  }

  getSelectionEvent(): RowSelectionEvent<T> {
    const mode = this.state.selectAllMode();

    if (mode === 'all') {
      // In 'all' mode, scope to current page data only
      const pageData = this.engine.paginatedData();
      const excluded = this.state.excludedRowIds();
      const selectedRows = pageData.filter((row) => !excluded.has(this.getRowId(row)));
      return {
        selectedIds: selectedRows.map((row) => this.getRowId(row)),
        excludedIds: Array.from(excluded),
        selectedRows,
        mode,
        count: selectedRows.length,
      };
    }

    // In 'page' / 'none' mode, only return rows from the current page
    const pageData = this.engine.paginatedData();
    const ids = this.state.selectedRowIds();
    const selectedRows = pageData.filter((row) => ids.has(this.getRowId(row)));
    return {
      selectedIds: selectedRows.map((row) => this.getRowId(row)),
      excludedIds: [],
      selectedRows,
      mode,
      count: selectedRows.length,
    };
  }

  getRowId(row: T): unknown {
    const field = this.state.rowIdField?.() ?? 'id';
    const r = row as Record<string, unknown>;
    return r[field] ?? r['id'] ?? r['_id'] ?? row;
  }
}
