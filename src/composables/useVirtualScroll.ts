import { computed, isRef, shallowRef, watch, type Ref } from 'vue'
import type { RowData } from '@/components/MrxGrid/types'

// ---------------------------------------------------------------------------
// Skeleton sentinel
// ---------------------------------------------------------------------------

/** Frozen sentinel placed at indices not yet fetched from the server. */
export const SKELETON_ROW: RowData = Object.freeze({ __mrxSkeleton: true })

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface VirtualScrollOptions {
  /**
   * Loaded rows. May be shorter than totalCount while data is being
   * fetched — indices beyond rows.length render as skeletons.
   */
  rows: Ref<RowData[]>
  /** Fixed height of every row in px. May be reactive (Ref) for density changes. */
  rowHeight: Ref<number> | number
  /** Viewport height in px. */
  containerHeight: Ref<number>
  /** Extra rows rendered above/below the viewport. Default 5. */
  overscan?: number
  /**
   * Hard cap on the maximum number of rendered rows. Prevents perf
   * degradation when rowHeight is very small. Default 80.
   */
  maxRendered?: number
  /**
   * TOTAL row count in the full dataset (including unloaded).
   * Drives totalHeight independently of rows.length so the scrollbar
   * never recalibrates during lazy loading — no feedback loops.
   * Falls back to rows.length when omitted.
   */
  totalCount?: Ref<number>
  /** Called when the visible window shifts. Use for lazy loading. */
  onVisibleRangeChange?: (start: number, end: number) => void
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

/**
 * Ultra-lean virtual scroll engine.
 *
 * ## Key performance decisions
 *
 * 1. **Index-based, not array-based.** The composable exposes startIndex /
 *    endIndex rather than rebuilding a visibleRows array on every scroll
 *    event. The template iterates a computed range and reads rows[i]
 *    directly. This eliminates the #1 GC pressure source in the old
 *    implementation — slice() / push() on every scroll tick.
 *
 * 2. **Synchronous onScroll.** The scroll handler writes shallowRefs in
 *    the same frame as the browser's scroll, so the translateY on the
 *    row container and the scrollbar thumb are always in sync. No rAF
 *    delay, no visual tearing.
 *
 * 3. **Write-on-change guard.** If scrollTop moves by less than one row
 *    height the indices don't change, so no shallowRef is written and
 *    Vue skips the render entirely. This is the single biggest win for
 *    60 fps — sub-row-height scrolls (the majority) become zero-cost.
 *
 * 4. **totalHeight decoupled from rows.length.** When totalCount is
 *    provided, scrollbar height is fixed from the start. Loading more
 *    data never changes scrollHeight, so the browser never recalibrates
 *    scrollTop, so no feedback loop is possible.
 *
 * 5. **Skeleton fallback built into getRow().** The consumer calls
 *    getRow(index) which returns the real row or SKELETON_ROW. No
 *    intermediate array is allocated.
 */
export function useVirtualScroll(options: VirtualScrollOptions) {
  const {
    rows,
    containerHeight,
    overscan = 5,
    maxRendered = 80,
    totalCount,
    onVisibleRangeChange,
  } = options

  const os = overscan
  const maxR = maxRendered

  // --- Reactive row height (supports density changes) ---
  const rh = computed(() => isRef(options.rowHeight) ? options.rowHeight.value : options.rowHeight)

  // --- Total scrollable height (stable when totalCount is provided) ---
  const totalHeight = computed(() => {
    const count = totalCount ? totalCount.value : rows.value.length
    return count * rh.value
  })

  // --- Outputs (shallowRef — only written when the window actually shifts) ---
  const startIndex = shallowRef(0)
  const endIndex = shallowRef(0)
  const offsetY = shallowRef(0)

  /** Non-reactive scroll position — mutated synchronously in onScroll. */
  let _scrollTop = 0

  // --- Core recompute ---

  function _compute() {
    const total = totalCount ? totalCount.value : rows.value.length
    if (total === 0) {
      if (startIndex.value !== 0 || endIndex.value !== 0) {
        startIndex.value = 0
        endIndex.value = 0
        offsetY.value = 0
      }
      return
    }

    const viewH = containerHeight.value
    const rowH = rh.value
    const top = _scrollTop

    // Defensive clamp — _scrollTop may exceed content after height changes.
    const maxTop = Math.max(0, total * rowH - viewH)
    if (top > maxTop) _scrollTop = maxTop
    const clampedTop = Math.min(top, maxTop)

    // First fully visible row.
    const first = (clampedTop / rowH) | 0
    // Number of rows that fit in the viewport (+ 1 for partial row at bottom).
    const visible = ((viewH / rowH) | 0) + 1

    // Clamp with overscan and max rendered cap.
    const ns = Math.max(0, first - os)
    const ne = Math.min(total, first + visible + os, ns + maxR)

    // Write-on-change guard — skip if window didn't shift.
    if (ns === startIndex.value && ne === endIndex.value) return

    startIndex.value = ns
    endIndex.value = ne
    offsetY.value = ns * rowH

    onVisibleRangeChange?.(ns, ne)
  }

  // --- Scroll handler (synchronous — same frame as browser scroll) ---

  function onScroll(e: Event) {
    _scrollTop = (e.target as HTMLElement).scrollTop
    _compute()
  }

  /** Read the current internal scroll position (for external sync). */
  function getScrollTop(): number {
    return _scrollTop
  }

  // --- Row accessor (returns real row or skeleton — zero allocation) ---

  /**
   * Get the row at `index`. Returns the real RowData if loaded,
   * otherwise returns SKELETON_ROW. This is the only way the
   * template should access row data during render.
   */
  function getRow(index: number): RowData {
    const loaded = rows.value
    if (index < loaded.length) {
      return loaded[index] ?? SKELETON_ROW
    }
    return SKELETON_ROW
  }

  // --- Watchers ---

  // Recompute when viewport height changes (resize).
  watch(containerHeight, () => _compute(), { immediate: true })

  // Recompute when row height changes (density). Preserve first visible row.
  watch(rh, (newRh, oldRh) => {
    if (oldRh && oldRh > 0 && newRh !== oldRh && _scrollTop > 0) {
      const firstRow = (_scrollTop / oldRh) | 0
      _scrollTop = firstRow * newRh
    }
    _compute()
  })

  // When totalCount changes (dataset swap, filter, sort, grouping) — clamp
  // scroll to the valid range and recompute.
  if (totalCount) {
    watch(totalCount, () => {
      const maxTop = Math.max(0, (totalCount.value * rh.value) - containerHeight.value)
      if (_scrollTop > maxTop) _scrollTop = maxTop
      _compute()
    })
  }

  // When rows identity changes (sort, filter, data swap) — recompute
  // to pick up the new data without touching scroll position.
  watch(() => rows.value, () => _compute())

  // --- Computed range for template v-for ---

  /**
   * An integer array [startIndex, startIndex+1, …, endIndex-1].
   * Recomputed only when start/endIndex change (not on every scroll pixel).
   * The template uses `v-for="i in visibleRange"` and calls getRow(i).
   */
  const visibleRange = computed(() => {
    const s = startIndex.value
    const e = endIndex.value
    const len = e - s
    if (len <= 0) return []
    const arr = Array.from<number>({ length: len })
    for (let k = 0; k < len; k++) {
      arr[k] = s + k
    }
    return arr
  })

  return {
    /** Total content height in px — bind to spacer element. */
    totalHeight,
    /** First rendered row index (inclusive). */
    startIndex,
    /** Last rendered row index (exclusive). */
    endIndex,
    /** translateY offset for the row container. */
    offsetY,
    /** Integer array of visible row indices for v-for. */
    visibleRange,
    /** Scroll event handler — bind to @scroll on the container. */
    onScroll,
    /** Get row data by absolute index (returns skeleton if unloaded). */
    getRow,
    /** Read internal scroll position (for external DOM sync). */
    getScrollTop,
  }
}
