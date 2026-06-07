import { computed, isRef, shallowRef, watch, type Ref } from 'vue'
import type { RowData } from '@/components/AdeoGrid/types'

// ---------------------------------------------------------------------------
// Skeleton sentinel
// ---------------------------------------------------------------------------

/** Frozen sentinel placed at indices not yet fetched from the server. */
export const SKELETON_ROW: RowData = Object.freeze({ __mrxSkeleton: true })

/** Shared empty array — avoids re-allocating when no row is expanded. */
const EMPTY_INDICES: number[] = []

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
  /**
   * Indices of rows whose intrinsic height is `rowHeight + expandedRowExtraHeight`
   * instead of `rowHeight`. The composable folds these into a sparse
   * prefix sum so `offsetY`, `startIndex`, `endIndex` and `totalHeight`
   * remain correct even when expanded rows are scrolled past. Optional —
   * omit for the classic fixed-row-height fast path.
   */
  expandedRowIndices?: Ref<Set<number>>
  /**
   * Extra height (px) of an expanded row, on top of `rowHeight`. May be
   * reactive (changes with density / consumer config). Ignored when
   * `expandedRowIndices` is empty.
   */
  expandedRowExtraHeight?: Ref<number> | number
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
    expandedRowIndices,
    expandedRowExtraHeight,
  } = options

  const os = overscan
  const maxR = maxRendered

  // --- Reactive row height (supports density changes) ---
  const rh = computed(() => isRef(options.rowHeight) ? options.rowHeight.value : options.rowHeight)

  // --- Expansion extra (per-row delta height, 0 when nothing expanded) ---
  const expExtra = computed(() => {
    if (!expandedRowIndices || expandedRowIndices.value.size === 0) return 0
    if (expandedRowExtraHeight === undefined) return 0
    return isRef(expandedRowExtraHeight) ? expandedRowExtraHeight.value : expandedRowExtraHeight
  })

  /**
   * Sorted array of expanded row indices. Recomputed only when the
   * expansion set changes — avoids re-sorting on every scroll tick.
   * Empty array shortcircuits the variable-height path inside `_compute`.
   */
  const sortedExpanded = computed<number[]>(() => {
    if (!expandedRowIndices || expandedRowIndices.value.size === 0) return EMPTY_INDICES
    const arr: number[] = []
    for (const i of expandedRowIndices.value) arr.push(i)
    arr.sort((a, b) => a - b)
    return arr
  })

  /**
   * Number of expanded rows whose index is `< index`. Used both for the
   * prefix-sum height up to `index` and for the inverse mapping from
   * scrollTop to the first visible row. Iterates a sorted array of (small)
   * expanded indices — O(E) where E is the number of expanded rows
   * (typically < 10 in real-world use).
   */
  function _expandedBelow(index: number): number {
    const arr = sortedExpanded.value
    if (arr.length === 0) return 0
    // Linear scan — fast for small E; could be replaced by binary search
    // if E ever grows into the hundreds.
    let k = 0
    for (let i = 0; i < arr.length; i++) {
      if ((arr[i] ?? -1) < index) k++
      else break
    }
    return k
  }

  /** Cumulative height of rows [0, index). Drives offsetY / totalHeight. */
  function _prefixHeight(index: number): number {
    return index * rh.value + _expandedBelow(index) * expExtra.value
  }

  // --- Total scrollable height (stable when totalCount is provided) ---
  // When expansion is active the sizer grows by `numExpanded × extra` so the
  // scrollbar thumb always reflects the true content length.
  const totalHeight = computed(() => {
    const count = totalCount ? totalCount.value : rows.value.length
    const expanded = expandedRowIndices?.value.size ?? 0
    return count * rh.value + expanded * expExtra.value
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
    const extra = expExtra.value
    const expandedArr = sortedExpanded.value
    const hasExpansion = expandedArr.length > 0 && extra > 0
    const top = _scrollTop

    // Do NOT clamp `_scrollTop` against the rows-only `fullHeight` here.
    //
    // The scroll container hosts sticky non-row content (header, filter
    // row, footer if inside it) whose pixels DO count in the DOM's
    // `scrollHeight` but NOT in `fullHeight = rows × rowH + expanded ×
    // extra`. Clamping internally caused a dead zone: when `top` exceeded
    // `fullHeight - viewH` (legit DOM territory because of the sticky
    // pixels), `_scrollTop` snapped back to that internal cap, `offsetY`
    // froze, and any further trackpad-inertia events kept hitting the
    // same frozen frame — producing the "scrollbar bounce" reported when
    // scrolling near the bottom of an expanded-row page.
    //
    // The DOM is the source of truth for the maximum valid scroll
    // position (the browser already prevents `scrollTop` from exceeding
    // `scrollHeight - clientHeight`). The while-loops below already clamp
    // `first` to `total - 1` when `top` ≥ `_prefixHeight(total - 1)`, so
    // render correctness is preserved without the internal cap.
    const clampedTop = top

    // --- First visible row -------------------------------------------------
    // Fast path: no expansion → constant-time `scrollTop / rowH`.
    // Slow path: expansion → invert the prefix sum
    //   `first * rowH + countExpanded(< first) * extra ≤ clampedTop`
    // by iterating on `countExpanded(< first)` — converges in O(1)
    // iterations because the count function is monotonic and stair-stepped.
    let first: number
    if (!hasExpansion) {
      first = (clampedTop / rowH) | 0
    } else {
      first = (clampedTop / rowH) | 0
      // Three passes are enough in practice — each pass either lands on the
      // correct count or undershoots it by exactly one (the row we just
      // crossed), so convergence is bounded.
      for (let iter = 0; iter < 3; iter++) {
        const k = _expandedBelow(first)
        const next = Math.max(0, ((clampedTop - k * extra) / rowH) | 0)
        if (next === first) break
        first = next
      }
      // Guard against undershoot: ensure the cumulative height for `first`
      // is ≤ clampedTop. If not, decrement (rare edge case at boundaries
      // where iteration over/undershoots by one).
      while (first > 0 && _prefixHeight(first) > clampedTop) first--
      // Guard against overshoot similarly.
      while (first < total - 1 && _prefixHeight(first + 1) <= clampedTop) first++
    }

    // --- Window size (number of rows that fit in the viewport) -------------
    // With expansion, an expanded row inside the viewport consumes `extra`
    // additional pixels, so fewer rows fit. We bump `visible` by an
    // approximation of how many extra rows would be needed.
    let visible = ((viewH / rowH) | 0) + 1
    if (hasExpansion) {
      // Count expanded rows within a conservative forward window from `first`.
      const probeEnd = Math.min(total, first + visible + os)
      let expandedAhead = 0
      for (let i = 0; i < expandedArr.length; i++) {
        const e = expandedArr[i] ?? -1
        if (e >= first && e < probeEnd) expandedAhead++
        else if (e >= probeEnd) break
      }
      // Each expanded row "eats" extra/rowH worth of vertical space; add
      // that many rows to ensure we render through the bottom of the viewport.
      visible += Math.ceil((expandedAhead * extra) / rowH)
    }

    // Clamp with overscan and max-rendered cap.
    const ns = Math.max(0, first - os)
    const ne = Math.min(total, first + visible + os, ns + maxR)

    // Write-on-change guard — skip if window didn't shift.
    if (ns === startIndex.value && ne === endIndex.value && offsetY.value === _prefixHeight(ns)) {
      return
    }

    startIndex.value = ns
    endIndex.value = ne
    offsetY.value = _prefixHeight(ns)

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

  // When the expansion set (or its extra height) changes — recompute so
  // `offsetY`, `startIndex`, `endIndex`, `totalHeight` instantly reflect
  // the variable-height layout. No scroll touched; the user's current
  // viewport stays anchored to the same row.
  if (expandedRowIndices) {
    watch(sortedExpanded, () => _compute())
  }
  if (expandedRowExtraHeight !== undefined) {
    watch(expExtra, () => _compute())
  }

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
