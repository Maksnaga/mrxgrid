import { Injectable, effect, inject } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { GridEngine } from '../engine/grid-engine';
import { ExpandableRowEngine } from './expandable-row.engine';

const V_BUFFER_PX = 200;
const FALLBACK_VIEWPORT_PX = 600;

/**
 * Custom vertical virtualization that replaces `cdk-virtual-scroll-viewport`.
 *
 * Why custom: CDK's strategy positions visible rows via `transform: translateY`
 * on the content wrapper. `transform` creates a containing block that traps
 * any `position: sticky` descendant, which breaks sticky pinned cells inside
 * data rows. We replace the transform with a height-based top-spacer so the
 * scroll container stays the sticky containing block.
 *
 * The engine is fully signal-driven — two reactive effects run independently:
 * - **Layout effect**: rebuilds the cumulative offset cache whenever the row
 *   layout (count, density, expanded set) changes. Cheap O(n) write.
 * - **Range effect**: re-computes the visible window whenever scrollTop /
 *   viewportHeight / totalRowsHeight changes. O(log n) binary search.
 *
 * Detail-row heights come from a single source of truth: the off-screen
 * pre-measurement performed by `<ad-grid-measurement-zone>` writes into
 * `ExpandableRowEngine.measuredRowHeights` (id-keyed). The visible-layout
 * `<ad-grid-detail-row>` keeps that cache fresh via its own `ResizeObserver`.
 * The engine NEVER observes row DOM directly — an earlier attempt with an
 * index-keyed map produced scroll bounce because virtualization slides
 * recycle DOM across indices, so a freshly observed element fires RO with the
 * NEW index but reflects the OLD row's height, producing spurious deltas.
 * Browser-level scroll anchoring (CSS `overflow-anchor: auto` on the viewport
 * + each row) preserves the visible content's pixel position when the top
 * spacer changes — no JS scroll compensation is needed.
 */
@Injectable()
export class VerticalVirtualScrollEngine {
  private readonly state = inject(GridStateManager);
  private readonly engine = inject(GridEngine);
  /** Optional — only present when the grid provides `ExpandableRowEngine`. */
  private readonly expandableRowEngine = inject(ExpandableRowEngine, { optional: true });

  /** Cumulative top offsets — length = displayRows.length + 1. */
  private offsets: number[] = [0];

  constructor() {
    // Layout: rebuild offsets when row composition changes — including
    // detail-row measurements. `trackMeasurements()` is the bridge that
    // re-runs this effect when a detail row's ResizeObserver lands a new
    // height.
    effect(
      () => {
        this.engine.displayRows();
        this.state.rowHeight();
        this.state.expandedRowIds();
        this.expandableRowEngine?.trackMeasurements();
        this.rebuildOffsets();
      },
      { allowSignalWrites: true },
    );

    // Range: react to scroll/viewport changes and offset rebuilds.
    effect(
      () => {
        this.state.scrollTop();
        this.state.scrollViewportHeight();
        this.state.totalRowsHeight();
        this.recompute();
      },
      { allowSignalWrites: true },
    );
  }

  /** Called by the grid container's scroll handler. Setters drive the range
   * effect; we don't recompute synchronously so a scroll burst collapses to
   * a single recompute per change-detection tick. */
  onScroll(scrollTop: number, viewportHeight: number): void {
    if (this.state.scrollTop() !== scrollTop) this.state.scrollTop.set(scrollTop);
    if (this.state.scrollViewportHeight() !== viewportHeight) {
      this.state.scrollViewportHeight.set(viewportHeight);
    }
  }

  /** Sync read for templates / scroll-into-view: physical height of a single
   * row, derived from the cumulative offset cache so it always reflects the
   * last `rebuildOffsets` result (including detail-row measurements). */
  getRowHeight(index: number): number {
    const a = this.offsets[index];
    const b = this.offsets[index + 1];
    if (a === undefined || b === undefined) return this.state.rowHeight();
    return b - a;
  }

  private rebuildOffsets(): void {
    const rows = this.engine.displayRows();
    const base = this.state.rowHeight();
    const idField = this.state.rowIdField();
    const expandedIds = this.state.expandedRowIds();
    const next = new Array<number>(rows.length + 1);
    next[0] = 0;
    for (let i = 0; i < rows.length; i++) {
      let extra = 0;
      // Only expanded data rows contribute extra height. The measurement
      // comes from `ExpandableRowEngine.measuredRowHeights`, populated by
      // either the off-screen measurement zone (before promotion) or the
      // visible detail row's own ResizeObserver. Keyed by row id — slides
      // don't invalidate it.
      if (this.expandableRowEngine) {
        const row = rows[i];
        if (row && row.type === 'data') {
          const rowIdValue = (row.data as Record<string, unknown>)[idField];
          if (expandedIds.has(rowIdValue)) {
            const rowKey = String(rowIdValue ?? i);
            const keyExtra = this.expandableRowEngine.getExtraHeightForKey(rowKey);
            if (keyExtra !== undefined) extra = keyExtra;
          }
        }
      }
      next[i + 1] = next[i] + base + extra;
    }
    this.offsets = next;
    const total = next[next.length - 1] ?? 0;
    if (this.state.totalRowsHeight() !== total) this.state.totalRowsHeight.set(total);
  }

  private recompute(): void {
    const total = this.engine.displayRows().length;
    if (total === 0) {
      this.applyRange(0, 0, 0, 0);
      return;
    }

    const scrollTop = this.state.scrollTop();
    // Use a reasonable fallback when the layout hasn't measured the viewport
    // yet (initial render). The range will refine itself once the real
    // viewport height comes in via the scroll handler / ResizeObserver.
    let viewportHeight = this.state.scrollViewportHeight();
    if (viewportHeight <= 0) viewportHeight = FALLBACK_VIEWPORT_PX;

    const viewStart = Math.max(0, scrollTop - V_BUFFER_PX);
    const viewEnd = scrollTop + viewportHeight + V_BUFFER_PX;
    const start = Math.max(0, this.findIndexAt(viewStart));
    const end = Math.min(total, this.findIndexAt(viewEnd) + 1);
    const top = this.offsets[start] ?? 0;
    const bottom = (this.offsets[total] ?? 0) - (this.offsets[end] ?? 0);
    this.applyRange(start, Math.max(start + 1, end), top, Math.max(0, bottom));
  }

  /** Largest index i such that offsets[i] <= x. */
  private findIndexAt(x: number): number {
    const offsets = this.offsets;
    let lo = 0;
    let hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (offsets[mid] <= x) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private applyRange(start: number, end: number, top: number, bottom: number): void {
    const cur = this.state.visibleRowRange();
    if (cur.start !== start || cur.end !== end) {
      this.state.visibleRowRange.set({ start, end });
    }
    if (this.state.topSpacerHeight() !== top) this.state.topSpacerHeight.set(top);
    if (this.state.bottomSpacerHeight() !== bottom) this.state.bottomSpacerHeight.set(bottom);
  }

  scrollOffsetForIndex(index: number): number {
    const i = Math.max(0, Math.min(index, this.offsets.length - 1));
    return this.offsets[i] ?? 0;
  }
}
