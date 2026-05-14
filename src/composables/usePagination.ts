import { computed, watch, type Ref, type WritableComputedRef } from 'vue'
import type { GridState } from '@/components/MrxGrid/state/useGridState'
import type { RowData } from '@/components/MrxGrid/types'

export interface UsePaginationOptions<T extends RowData = RowData> {
  rows: Ref<T[]>
  pageSizeOptions?: number[]
  defaultPageSize?: number
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

/**
 * Pagination — Angular-parity storage with legacy 1-based public API.
 *
 * Phase 2.5: the single source of truth is `gridState.pageIndex` (0-based)
 * and `gridState.pageSize`. The footer / API consumers keep their 1-based
 * `currentPage` shape via writable computeds that translate on the fly. The
 * mirror watch in `MrxGrid.vue` is gone.
 */
export function usePagination<T extends RowData = RowData>(
  gridState: GridState<T>,
  options: UsePaginationOptions<T>,
) {
  const {
    rows,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    defaultPageSize,
  } = options

  // Initialise from options once. After this, gridState is the source of truth.
  if (gridState.pageSize.value === 0 || gridState.pageSize.value == null) {
    gridState.pageSize.value = defaultPageSize ?? pageSizeOptions[0] ?? 10
  } else if (defaultPageSize != null) {
    gridState.pageSize.value = defaultPageSize
  }

  /** 1-based current page — writable computed mirroring `gridState.pageIndex`. */
  const currentPage: WritableComputedRef<number> = computed({
    get: () => gridState.pageIndex.value + 1,
    set: (page) => {
      gridState.pageIndex.value = Math.max(0, page - 1)
    },
  })

  /** Page size — writable computed mirroring `gridState.pageSize`. */
  const pageSize: WritableComputedRef<number> = computed({
    get: () => gridState.pageSize.value,
    set: (size) => {
      gridState.pageSize.value = size
    },
  })

  const totalRows = computed(() => rows.value.length)
  const totalPages = computed(() =>
    Math.max(1, Math.ceil(totalRows.value / Math.max(1, pageSize.value))),
  )

  // Clamp pageIndex when totalPages shrinks (e.g. after filtering).
  watch(totalPages, (tp) => {
    if (currentPage.value > tp) currentPage.value = tp
  })

  const startIndex = computed(() => (currentPage.value - 1) * pageSize.value)
  const endIndex = computed(() => Math.min(startIndex.value + pageSize.value, totalRows.value))

  const paginatedRows = computed(() => rows.value.slice(startIndex.value, endIndex.value))

  const rangeStart = computed(() => (totalRows.value === 0 ? 0 : startIndex.value + 1))
  const rangeEnd = computed(() => endIndex.value)

  function setPage(page: number): void {
    currentPage.value = Math.max(1, Math.min(page, totalPages.value))
  }

  function nextPage(): void {
    if (currentPage.value < totalPages.value) currentPage.value++
  }

  function prevPage(): void {
    if (currentPage.value > 1) currentPage.value--
  }

  function setPageSize(size: number): void {
    // Keep the first visible row roughly in view.
    const firstVisibleRow = startIndex.value
    pageSize.value = size
    currentPage.value = Math.max(1, Math.floor(firstVisibleRow / size) + 1)
  }

  return {
    currentPage,
    pageSize,
    totalPages,
    totalRows,
    paginatedRows,
    rangeStart,
    rangeEnd,
    pageSizeOptions,
    setPage,
    nextPage,
    prevPage,
    setPageSize,
  }
}
