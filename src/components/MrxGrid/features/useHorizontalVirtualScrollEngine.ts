/**
 * Horizontal virtual scroll engine — Angular parity
 * (moz-grid / `HorizontalVirtualScrollEngine`).
 *
 * Reads / writes the central `GridState`:
 *   reads:  state.unpinnedColumns, horizontalVirtualScrollEnabled,
 *           draggingColumn, scrollLeft, scrollViewportWidth
 *   writes: state.visibleColumnRange, state.scrollContentTotalWidth
 *
 * Mirror of the Angular engine 1-for-1:
 *   - `onScroll(scrollLeft, viewportWidth)` is the imperative handle that the
 *     body viewport scroll listener calls. Skips all writes while a column is
 *     being dragged (the drag engine needs every unpinned cell mounted so it
 *     can measure drop targets — auto-scroll fires a scroll event per frame
 *     and mounting/unmounting cells at 60fps would freeze the browser).
 *   - A `watchEffect` reacts to unpinned-columns / enabled / draggingColumn
 *     changes and recomputes offsets + range.
 *
 * Coexists with the legacy `useVirtualColumns` composable (which works on raw
 * `ColumnDef[]` including pinned columns). Phase 10 removes the legacy one.
 */

import { onScopeDispose, watchEffect } from 'vue'
import type { GridState } from '../state/useGridState'
import type { RowData } from '../types'

const H_BUFFER_PX = 300
const MIN_COLUMNS_FOR_VIRTUALIZATION = 20

export interface HorizontalVirtualScrollEngine {
  /** Called by the host when the body viewport scrolls or resizes. */
  onScroll(scrollLeft: number, viewportWidth: number): void
  /** Recomputes cumulative offsets and `scrollContentTotalWidth`. */
  rebuildOffsets(): void
}

export function useHorizontalVirtualScrollEngine<T = RowData>(
  state: GridState<T>,
): HorizontalVirtualScrollEngine {
  /** Cumulative left offsets of unpinned columns. Length = unpinnedColumns.length + 1. */
  let offsets: number[] = [0]

  function rebuildOffsets(): void {
    const cols = state.unpinnedColumns.value
    const next = new Array<number>(cols.length + 1)
    next[0] = 0
    for (let i = 0; i < cols.length; i++) {
      next[i + 1] = (next[i] ?? 0) + cols[i]!.currentWidth
    }
    offsets = next
    state.scrollContentTotalWidth.value = next[next.length - 1] ?? 0
  }

  /** Binary search: returns the largest index i such that offsets[i] <= x. */
  function findIndexAt(x: number): number {
    let lo = 0
    let hi = offsets.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1
      if ((offsets[mid] ?? 0) <= x) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  function setRange(start: number, end: number): void {
    const current = state.visibleColumnRange.value
    if (current.start === start && current.end === end) return
    state.visibleColumnRange.value = { start, end }
  }

  function fullRange(): void {
    const total = state.unpinnedColumns.value.length
    setRange(0, total)
  }

  function recompute(scrollLeft: number, viewportWidth: number): void {
    const total = state.unpinnedColumns.value.length
    if (total === 0) {
      setRange(0, 0)
      return
    }
    if (total < MIN_COLUMNS_FOR_VIRTUALIZATION || viewportWidth <= 0) {
      setRange(0, total)
      return
    }

    const viewStart = Math.max(0, scrollLeft - H_BUFFER_PX)
    const viewEnd = scrollLeft + viewportWidth + H_BUFFER_PX

    const start = findIndexAt(viewStart)
    const end = Math.min(total, findIndexAt(viewEnd) + 1)
    setRange(Math.max(0, start), Math.max(start + 1, end))
  }

  function onScroll(scrollLeft: number, viewportWidth: number): void {
    // Skip all writes while a column is being dragged — auto-scroll pushes a
    // scroll event every frame; any write that flows into the virtualization
    // watcher would tear the DOM down and re-render during the drag.
    if (state.draggingColumn.value !== null) return

    state.scrollLeft.value = scrollLeft
    state.scrollViewportWidth.value = viewportWidth
    if (!state.horizontalVirtualScrollEnabled.value) return
    recompute(scrollLeft, viewportWidth)
  }

  const stop = watchEffect(() => {
    // React to column width/order/visibility changes.
    void state.unpinnedColumns.value
    const enabled = state.horizontalVirtualScrollEnabled.value
    rebuildOffsets()

    if (!enabled) {
      fullRange()
      return
    }

    // While dragging, return BEFORE reading scrollLeft / scrollViewportWidth —
    // auto-scroll feeds scroll events every frame and would thrash the DOM.
    if (state.draggingColumn.value !== null) {
      fullRange()
      return
    }

    recompute(state.scrollLeft.value, state.scrollViewportWidth.value)
  })

  onScopeDispose(() => stop())

  return { onScroll, rebuildOffsets }
}
