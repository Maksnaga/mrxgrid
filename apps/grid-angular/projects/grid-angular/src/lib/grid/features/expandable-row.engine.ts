import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { GridEngine } from '../engine/grid-engine';

@Injectable()
export class ExpandableRowEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);
  /**
   * The grid pipeline — used by `pruneStalePending` to drop pending ids
   * whose row is no longer present (e.g. removed by a server-side
   * refresh / filter change while the row was still being measured).
   */
  private readonly gridEngine = inject<GridEngine<T>>(GridEngine, { optional: true });

  /**
   * Measured extra heights keyed by string `rowKey` (usually `rowId`).
   * Backed by a Map, but every write bumps `measureVersion` — a signal —
   * so `VerticalVirtualScrollEngine`'s layout effect re-runs and
   * rebuilds offsets whenever a detail row is (re)measured.
   *
   * **Why a counter and not a `signal<Map>`** : the Map mutates in place
   * for O(1) writes on a per-row basis; a signal<Map> would force
   * `Set.from(...)` or a new Map per measurement, which is allocation
   * pressure for nothing — the consumer only cares "did anything change",
   * not "what changed where". The counter answers that question for free.
   */
  private readonly measuredRowHeights = new Map<string, number>();
  private readonly measureVersion = signal(0);

  constructor() {
    // Drop pending ids whose row is no longer in `displayRows`. Without
    // this, a pending row removed mid-flight (server refresh / filter
    // change) would leak into `pendingExpansion` forever — the
    // measurement zone could not find the row and would never promote.
    if (this.gridEngine) {
      effect(
        () => {
          const rows = this.gridEngine!.displayRows();
          this.pruneStalePending(rows);
        },
        { allowSignalWrites: true },
      );
    }
  }

  /**
   * Records the measured height of a detail row identified by `rowKey`.
   * Bumps `measureVersion` so the virtual scroll engine re-runs its
   * offset rebuild — without it, the scroll engine reads stale heights
   * from the Map and the scrollbar bounces when the user scrolls past
   * an expanded row.
   *
   * @param rowKey  The row identifier (value of `rowIdField` for that row).
   * @param height  Full rendered height in pixels of the detail row element.
   */
  measureRow(rowKey: string, height: number): void {
    const prev = this.measuredRowHeights.get(rowKey);
    if (prev === height) return;
    this.measuredRowHeights.set(rowKey, height);
    this.measureVersion.update((v) => v + 1);
  }

  /**
   * Returns the last measured height for `rowKey`, or `undefined` when no
   * measurement has been recorded yet. Reading this OUTSIDE of a reactive
   * context skips dep tracking; engines must explicitly call
   * `trackMeasurements()` if they want to rebuild on measurement changes.
   */
  getExtraHeightForKey(rowKey: string): number | undefined {
    return this.measuredRowHeights.get(rowKey);
  }

  /**
   * Reactive dep — read once at the top of an `effect()` / `computed()`
   * that depends on row measurements. Updates whenever `measureRow` writes
   * a NEW height for any row. Returns the current version as a sentinel.
   */
  trackMeasurements(): number {
    return this.measureVersion();
  }

  readonly hasExpandedRows = computed(() => this.state.expandedRowIds().size > 0);

  /**
   * 2-phase toggle. Expand goes via `pendingExpansion` so the measurement
   * zone can size the detail row off-screen BEFORE the visible body mounts
   * it. Collapse is direct — no measurement needed.
   *
   * If the row is currently pending (user clicked expand and then clicked
   * again before measurement landed), we remove it from pending so it
   * never transitions to expanded.
   */
  toggleRow(rowId: unknown): void {
    // Already visibly expanded → collapse path.
    if (this.state.expandedRowIds().has(rowId)) {
      this.state.expandedRowIds.update((ids) => {
        const next = new Set(ids);
        next.delete(rowId);
        return next;
      });
      // Defensive: also drop from pending if somehow present.
      if (this.state.pendingExpansion().has(rowId)) {
        this.state.pendingExpansion.update((ids) => {
          const next = new Set(ids);
          next.delete(rowId);
          return next;
        });
      }
      return;
    }
    // Pending measurement → user wants to cancel the expansion.
    if (this.state.pendingExpansion().has(rowId)) {
      this.state.pendingExpansion.update((ids) => {
        const next = new Set(ids);
        next.delete(rowId);
        return next;
      });
      return;
    }
    // Not expanded and not pending → start the 2-phase expansion.
    this.state.pendingExpansion.update((ids) => {
      const next = new Set(ids);
      next.add(rowId);
      return next;
    });
  }

  /**
   * Imperative API. Adds to pending if not already pending or expanded.
   * Promotion is driven by the measurement zone.
   */
  expandRow(rowId: unknown): void {
    if (this.state.expandedRowIds().has(rowId)) return;
    if (this.state.pendingExpansion().has(rowId)) return;
    this.state.pendingExpansion.update((ids) => {
      const next = new Set(ids);
      next.add(rowId);
      return next;
    });
  }

  /**
   * Direct collapse — drop from both sets so a pending-but-not-yet-promoted
   * row is also cancelled.
   */
  collapseRow(rowId: unknown): void {
    if (this.state.expandedRowIds().has(rowId)) {
      this.state.expandedRowIds.update((ids) => {
        const next = new Set(ids);
        next.delete(rowId);
        return next;
      });
    }
    if (this.state.pendingExpansion().has(rowId)) {
      this.state.pendingExpansion.update((ids) => {
        const next = new Set(ids);
        next.delete(rowId);
        return next;
      });
    }
  }

  collapseAll(): void {
    this.state.expandedRowIds.set(new Set());
    this.state.pendingExpansion.set(new Set());
  }

  /**
   * Called by the measurement zone once a hidden detail row has reported
   * its height via ResizeObserver. Atomically removes the id from
   * `pendingExpansion` and adds it to `expandedRowIds` — the visible body
   * template now mounts the detail row, and because the height was already
   * cached via `measureRow` just before, the virtual-scroll engine
   * rebuilds offsets with the correct value on the FIRST visible render.
   *
   * Safe to call when the row was already cancelled (the pending check
   * exits early so we don't accidentally re-expand a row the user just
   * collapsed mid-measurement).
   */
  promoteFromPending(rowId: unknown): void {
    if (!this.state.pendingExpansion().has(rowId)) return;
    this.state.pendingExpansion.update((ids) => {
      const next = new Set(ids);
      next.delete(rowId);
      return next;
    });
    this.state.expandedRowIds.update((ids) => {
      const next = new Set(ids);
      next.add(rowId);
      return next;
    });
  }

  /**
   * Visible-expansion check. Returns `true` ONLY for rows that have been
   * promoted (i.e. measured + mounted in the visible layout). Pending
   * rows are intentionally NOT reported as expanded — that's how the
   * visible body template avoids rendering a detail row in parallel
   * with the one in the measurement zone.
   */
  isRowExpanded(rowId: unknown): boolean {
    return this.state.expandedRowIds().has(rowId);
  }

  /** True when the row's detail is currently being measured off-screen. */
  isRowPending(rowId: unknown): boolean {
    return this.state.pendingExpansion().has(rowId);
  }

  /**
   * Removes pending ids whose row data is no longer present in
   * `displayRows()` — this keeps the measurement zone from spinning on
   * an id whose row was filtered/paginated away mid-measurement.
   */
  private pruneStalePending(rows: ReadonlyArray<{ type: string; data?: T }>): void {
    const pending = this.state.pendingExpansion();
    if (pending.size === 0) return;
    const idField = this.state.rowIdField();
    const present = new Set<unknown>();
    for (const row of rows) {
      if (row.type !== 'data' || !row.data) continue;
      const id = (row.data as Record<string, unknown>)[idField];
      if (id !== undefined) present.add(id);
    }
    let changed = false;
    const next = new Set<unknown>();
    pending.forEach((id) => {
      if (present.has(id)) {
        next.add(id);
      } else {
        changed = true;
      }
    });
    if (changed) this.state.pendingExpansion.set(next);
  }
}
