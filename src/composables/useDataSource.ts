import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import type { RowData } from '@/components/AdeoGrid/types'

/** Sentinel row shown while real data is still loading. */
const LOADING_ROW: RowData = Object.freeze({ __mrxSkeleton: true })

export interface DataSourceOptions {
  /** Total number of rows in the remote dataset. */
  totalRows: Ref<number> | number
  /**
   * Fetch a page of rows. Receives the absolute start index (inclusive)
   * and end index (exclusive). Must return exactly `end - start` rows.
   */
  fetchRows: (start: number, end: number) => Promise<RowData[]>
  /**
   * Number of rows to fetch per request. Ranges are quantized to page
   * boundaries so scrolling through a region triggers at most one fetch.
   * Default: 100.
   */
  pageSize?: number
}

/**
 * Lazy data source that fetches rows on demand based on the visible range.
 *
 * ## Architecture
 *
 * ```
 * ┌──────────────────────────────────────────────────────┐
 * │  useVirtualScroll                                    │
 * │  (computes startIndex / endIndex from scroll)        │
 * └──────────┬───────────────────────────────────────────┘
 *            │ visible range changes
 *            ▼
 * ┌──────────────────────────────────────────────────────┐
 * │  useDataSource                                       │
 * │                                                      │
 * │  1. Quantize [start, end] into page numbers          │
 * │  2. Skip pages already cached or in-flight           │
 * │  3. Fetch missing pages via fetchRows()              │
 * │  4. Write results into sparse cache (Map<idx, row>)  │
 * │  5. Bump version counter → rows recomputes           │
 * │                                                      │
 * │  Returns: rows (RowData[]), isLoading, loadedCount   │
 * └──────────┬───────────────────────────────────────────┘
 *            │ rows ref (length = totalRows)
 *            ▼
 * ┌──────────────────────────────────────────────────────┐
 * │  AdeoGrid                                             │
 * │  (receives rows prop, renders via virtual scroll)    │
 * └──────────────────────────────────────────────────────┘
 * ```
 *
 * ### Why pages?
 * Fetching exactly the visible range on every scroll event would create
 * hundreds of tiny overlapping requests. Quantizing to fixed-size pages
 * (default 100 rows) means each region of the dataset is fetched at most
 * once, and fast scrolling through already-visited areas hits only cache.
 *
 * ### Duplicate prevention
 * A `Set<number>` tracks in-flight page numbers. If page 7 is already
 * being fetched, a second scroll into that region won't trigger another
 * request — it just waits for the first one to land in the cache.
 *
 * ### Cache strategy
 * A `Map<number, RowData>` stores every row that's been fetched, keyed
 * by absolute row index. The `rows` computed rebuilds from this map,
 * falling back to a frozen LOADING_ROW sentinel for unfetched indices.
 * Because Map lookups are O(1), building the full array is cheap even
 * at 800k entries (it only iterates totalRows length once, and the
 * grid's virtual scroll means only ~30 of those rows ever reach the DOM).
 */
export function useDataSource(options: DataSourceOptions) {
  const {
    fetchRows,
    pageSize = 100,
  } = options

  const totalRowsRef = typeof options.totalRows === 'number'
    ? ref(options.totalRows)
    : options.totalRows

  /** Sparse cache: absolute row index → RowData. */
  const cache = new Map<number, RowData>()

  /** Pages currently being fetched — prevents duplicate requests. */
  const inFlight = new Set<number>()

  /**
   * Bumped after every cache write so `rows` recomputes.
   * Using shallowRef + manual trigger is cheaper than making
   * the entire cache reactive (which would be 800k reactive entries).
   */
  const version = shallowRef(0)

  /** Number of rows currently in the cache. */
  const loadedCount = ref(0)

  /** True while any page fetch is in progress. */
  const isLoading = ref(false)

  /**
   * Dense rows array of length totalRows.
   * Cached rows are real data; uncached slots are the LOADING_ROW sentinel.
   * The grid's AdeoGridCell renders `value ?? ''`, so loading rows show blank.
   */
  const rows = computed<RowData[]>(() => {
    // Touch version so Vue tracks the dependency.
    void version.value
    const len = totalRowsRef.value
    const result: RowData[] = Array.from({ length: len }, (_, i) =>
      cache.get(i) ?? LOADING_ROW,
    )
    return result
  })

  /** Convert an absolute row index to its page number. */
  function pageOf(index: number): number {
    return Math.floor(index / pageSize)
  }

  /**
   * Ensure all rows in [start, end) are cached.
   * Quantizes to page boundaries, skips cached/in-flight pages,
   * then fetches the rest in parallel.
   */
  function requestRange(start: number, end: number) {
    const firstPage = pageOf(Math.max(0, start))
    const lastPage = pageOf(Math.min(end - 1, totalRowsRef.value - 1))

    for (let page = firstPage; page <= lastPage; page++) {
      if (inFlight.has(page)) continue

      const pageStart = page * pageSize
      const pageEnd = Math.min(pageStart + pageSize, totalRowsRef.value)

      // Check if every row in this page is already cached.
      let allCached = true
      for (let i = pageStart; i < pageEnd; i++) {
        if (!cache.has(i)) {
          allCached = false
          break
        }
      }
      if (allCached) continue

      inFlight.add(page)
      isLoading.value = true

      fetchRows(pageStart, pageEnd)
        .then((fetched) => {
          for (let i = 0; i < fetched.length; i++) {
            const row = fetched[i]
            if (row) {
              cache.set(pageStart + i, row)
            }
          }
          loadedCount.value = cache.size
          version.value++
        })
        .finally(() => {
          inFlight.delete(page)
          if (inFlight.size === 0) {
            isLoading.value = false
          }
        })
    }
  }

  /** Clear all cached data and re-fetch the current range. */
  function invalidate() {
    cache.clear()
    inFlight.clear()
    loadedCount.value = 0
    version.value++
  }

  /**
   * Convenience: watch a reactive visible range and auto-fetch.
   * Pass startIndex and endIndex refs from useVirtualScroll.
   */
  function watchRange(startIndex: Ref<number>, endIndex: Ref<number>) {
    watch(
      [startIndex, endIndex],
      ([s, e]) => { requestRange(s, e) },
      { immediate: true },
    )
  }

  /**
   * Notify the data source that row data was mutated externally
   * (e.g. after paste / cell edit / fill). Bumps the internal version
   * counter so `rows` recomputes and the grid re-renders.
   */
  function notify() {
    version.value++
  }

  return {
    /** Dense RowData[] of length totalRows — pass to AdeoGrid :rows. */
    rows,
    /** True while any page is being fetched. */
    isLoading,
    /** Number of rows currently in cache. */
    loadedCount,
    /** Manually request rows in [start, end) to be fetched. */
    requestRange,
    /** Clear cache and force re-fetch. */
    invalidate,
    /** Auto-fetch when a reactive range changes. */
    watchRange,
    /** Notify that row data was mutated externally — triggers re-render. */
    notify,
    /** Sentinel object — use to detect loading rows in custom renderers. */
    LOADING_ROW,
  }
}
