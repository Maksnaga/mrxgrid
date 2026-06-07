import { ref, shallowRef, type Ref } from 'vue'
import type { RowData } from '@/components/AdeoGrid/types'

export interface LazyRowsOptions {
  /**
   * Total number of rows in the remote dataset.
   * The composable pre-allocates this many skeleton rows.
   */
  totalRowCount: Ref<number>
  /**
   * Page size — number of rows fetched per request.
   * Should be >= 2 × overscan + visibleRowCount.
   */
  pageSize?: number
  /**
   * Debounce delay in ms before issuing a fetch after the visible range
   * changes. Prevents flooding the server during fast scroll.
   */
  debounceMs?: number
  /**
   * The actual fetch function. Receives the page index (0-based) and must
   * return the rows for that page (length = pageSize, or less on last page).
   */
  fetchPage: (pageIndex: number) => Promise<RowData[]>
}

/**
 * ## Lazy loading for virtual scroll
 *
 * ### Architecture
 *
 * The rows array is pre-filled with skeleton placeholders so the grid always
 * has `totalRowCount` rows to render. When the visible window shifts into an
 * uncached page, the composable debounces the fetch and replaces the skeleton
 * rows with real data once loaded.
 *
 * ### Key design decisions
 *
 * 1. **Pre-allocated rows array** — `rows` is always `totalRowCount` long.
 *    The virtual scroll composable never sees the array shrink or grow during
 *    scroll, so there is no height recalculation that could trigger the
 *    feedback loop.
 *
 * 2. **Page cache** — `loadedPages` is a `Set<number>`. A page is only fetched
 *    once; subsequent visits are served from the in-memory array.
 *
 * 3. **Pending set** — `pendingPages` prevents duplicate in-flight requests.
 *    If the user scrolls back into a page that is already being fetched,
 *    no second request is issued.
 *
 * 4. **Debounce** — fast scroll collapses many visible-range-change callbacks
 *    into a single fetch. The debounce timer is reset on every new range event
 *    and only fires after the user pauses for `debounceMs`.
 *
 * 5. **shallowRef for rows** — writing individual elements into the array and
 *    then triggering `.value = rows.value` (same reference) would not notify
 *    Vue. Instead we shallow-clone the array after page injection so Vue sees
 *    a new reference and re-renders only affected rows.
 *
 * ### Trade-offs
 *
 * - Memory: all loaded rows are kept in memory. For truly massive datasets
 *   (millions of rows) a sliding window eviction strategy should be added.
 * - Skeleton rows: the `__mrxSkeleton` flag is used by the cell renderer
 *   to show a loading placeholder instead of real content.
 */
export function useLazyRows(options: LazyRowsOptions) {
  const { totalRowCount, pageSize = 100, debounceMs = 80, fetchPage } = options

  // Set of page indices that have been fully loaded.
  const loadedPages = new Set<number>()
  // Set of page indices currently being fetched (prevents duplicate requests).
  const pendingPages = new Set<number>()

  /** Whether any page is currently loading. */
  const isLoading = ref(false)

  /**
   * The rows array — always totalRowCount long.
   * Unloaded rows are skeleton objects: { __mrxSkeleton: true }.
   * shallowRef so Vue detects array replacement but not deep mutations.
   */
  const rows = shallowRef<RowData[]>([])

  // Build the initial skeleton array.
  function buildSkeletonArray(count: number): RowData[] {
    return Array.from({ length: count }, (_, i) => ({ __mrxSkeleton: true, __mrxIndex: i }))
  }

  // Watch totalRowCount and rebuild the skeleton array when it changes.
  // Preserve already-loaded rows.
  function reset(count: number) {
    loadedPages.clear()
    pendingPages.clear()
    rows.value = buildSkeletonArray(count)
  }

  reset(totalRowCount.value)

  // Debounce timer handle.
  let _debounceTimer = 0

  /**
   * Called by useVirtualScroll's `onVisibleRangeChange` hook.
   * Determines which pages overlap the visible range and fetches any
   * that are not already loaded or in-flight.
   */
  function onVisibleRangeChange(start: number, end: number) {
    if (_debounceTimer) clearTimeout(_debounceTimer)
    _debounceTimer = window.setTimeout(() => {
      _debounceTimer = 0
      _fetchRange(start, end)
    }, debounceMs)
  }

  function _fetchRange(start: number, end: number) {
    const firstPage = (start / pageSize) | 0
    const lastPage  = ((end - 1) / pageSize) | 0

    for (let p = firstPage; p <= lastPage; p++) {
      if (loadedPages.has(p) || pendingPages.has(p)) continue
      pendingPages.add(p)
      isLoading.value = true

      fetchPage(p).then((pageRows) => {
        pendingPages.delete(p)
        loadedPages.add(p)

        // Splice loaded rows into the array.
        const base = p * pageSize
        const next = rows.value.slice()   // shallow copy to trigger shallowRef update
        for (let i = 0; i < pageRows.length; i++) {
          next[base + i] = pageRows[i]!
        }
        rows.value = next

        if (pendingPages.size === 0) isLoading.value = false
      }).catch(() => {
        // On error: leave skeleton rows in place so user can retry by scrolling.
        pendingPages.delete(p)
        if (pendingPages.size === 0) isLoading.value = false
      })
    }
  }

  return {
    /** Rows array — always totalRowCount long, skeleton where not yet loaded. */
    rows,
    /** True while any page fetch is in flight. */
    isLoading,
    /** Feed this to useVirtualScroll's onVisibleRangeChange option. */
    onVisibleRangeChange,
    /** Manually reset and reload (e.g. after filter/sort change). */
    reset: (count: number) => reset(count),
  }
}
