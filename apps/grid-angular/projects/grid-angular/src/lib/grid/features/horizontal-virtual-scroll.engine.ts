import { Injectable, effect, inject } from '@angular/core';
import { GridStateManager } from '../state/grid-state';

const H_BUFFER_PX = 300;
const MIN_COLUMNS_FOR_VIRTUALIZATION = 20;

@Injectable()
export class HorizontalVirtualScrollEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  /** Cumulative left offsets of unpinned columns. Length = unpinnedColumns.length + 1. */
  private offsets: number[] = [0];

  constructor() {
    effect(
      () => {
        // React to column width/order/visibility changes and flag toggling.
        this.state.unpinnedColumns();
        const enabled = this.state.horizontalVirtualScrollEnabled();
        this.rebuildOffsets();

        if (!enabled) {
          this.fullRange();
          return;
        }

        // Column drag temporarily needs every unpinned cell in the DOM so the
        // drag engine can measure drop targets. We must return BEFORE reading
        // scrollLeft / scrollViewportWidth — otherwise auto-scroll would feed
        // scroll events back into this effect on every frame and thrash the
        // DOM (mount/unmount cycle at 60 fps → browser freeze).
        if (this.state.draggingColumn() !== null) {
          this.fullRange();
          return;
        }

        this.recompute(this.state.scrollLeft(), this.state.scrollViewportWidth());
      },
      { allowSignalWrites: true }
    );
  }

  /** Called by grid.ts when the body viewport scrolls or resizes. */
  onScroll(scrollLeft: number, viewportWidth: number): void {
    // Skip all signal writes while a column is being dragged — auto-scroll
    // pushes a scroll event every frame and any write that flows into the
    // virtualization effect would tear the DOM down and re-render during the
    // drag.
    if (this.state.draggingColumn() !== null) return;

    this.state.scrollLeft.set(scrollLeft);
    this.state.scrollViewportWidth.set(viewportWidth);
    if (!this.state.horizontalVirtualScrollEnabled()) return;
    this.recompute(scrollLeft, viewportWidth);
  }

  rebuildOffsets(): void {
    const cols = this.state.unpinnedColumns();
    const next = new Array<number>(cols.length + 1);
    next[0] = 0;
    for (let i = 0; i < cols.length; i++) {
      next[i + 1] = next[i] + cols[i].currentWidth;
    }
    this.offsets = next;
    this.state.scrollContentTotalWidth.set(next[next.length - 1] ?? 0);
  }

  private recompute(scrollLeft: number, viewportWidth: number): void {
    const total = this.state.unpinnedColumns().length;
    if (total === 0) {
      this.setRange(0, 0);
      return;
    }
    if (total < MIN_COLUMNS_FOR_VIRTUALIZATION || viewportWidth <= 0) {
      this.setRange(0, total);
      return;
    }

    const viewStart = Math.max(0, scrollLeft - H_BUFFER_PX);
    const viewEnd = scrollLeft + viewportWidth + H_BUFFER_PX;

    const start = this.findIndexAt(viewStart);
    const end = Math.min(total, this.findIndexAt(viewEnd) + 1);
    this.setRange(Math.max(0, start), Math.max(start + 1, end));
  }

  /** Binary search: returns the largest index i such that offsets[i] <= x. */
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

  private fullRange(): void {
    const total = this.state.unpinnedColumns().length;
    this.setRange(0, total);
  }

  private setRange(start: number, end: number): void {
    const current = this.state.visibleColumnRange();
    if (current.start === start && current.end === end) return;
    this.state.visibleColumnRange.set({ start, end });
  }
}
