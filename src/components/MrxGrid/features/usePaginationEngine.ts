/**
 * Pagination engine — Angular parity (moz-grid / `PaginationEngine`).
 *
 * Reads / writes the central `GridState`:
 * - `state.pageIndex` (0-based, matches Angular)
 * - `state.pageSize`
 * - `state.totalItems` / `state.sourceData`
 *
 * `useGridEngine.paginatedData` already consumes `state.pageIndex` + `pageSize`
 * directly, so this engine is the imperative handle used by toolbars /
 * footers (setPage / nextPage / previousPage / setPageSize).
 */

import { computed, type ComputedRef } from 'vue'
import type { GridState } from '../state/useGridState'
import type { RowData } from '../types'

export interface PaginationEngine {
  /** 0-based page index. */
  readonly currentPage: ComputedRef<number>
  readonly totalPages: ComputedRef<number>
  /** 1-based index of the first row on the current page (0 if empty). */
  readonly startItem: ComputedRef<number>
  /** 1-based index of the last row on the current page. */
  readonly endItem: ComputedRef<number>
  readonly isFirstPage: ComputedRef<boolean>
  readonly isLastPage: ComputedRef<boolean>
  goToPage(pageIndex: number): void
  nextPage(): void
  previousPage(): void
  setPageSize(size: number): void
}

export function usePaginationEngine<T = RowData>(state: GridState<T>): PaginationEngine {
  const computedTotal = computed<number>(() =>
    state.mode.value === 'server' ? state.totalItems.value : state.sourceData.value.length,
  )

  const totalPages = computed<number>(() => state.totalPages.value)
  const currentPage = computed<number>(() => state.pageIndex.value)

  const startItem = computed<number>(() => {
    if (computedTotal.value === 0) return 0
    return state.pageIndex.value * state.pageSize.value + 1
  })

  const endItem = computed<number>(() =>
    Math.min((state.pageIndex.value + 1) * state.pageSize.value, computedTotal.value),
  )

  const isFirstPage = computed<boolean>(() => state.pageIndex.value === 0)
  const isLastPage = computed<boolean>(() => state.pageIndex.value >= totalPages.value - 1)

  function goToPage(pageIndex: number): void {
    if (pageIndex < 0 || pageIndex >= totalPages.value) return
    state.pageIndex.value = pageIndex
  }

  function nextPage(): void {
    if (!isLastPage.value) state.pageIndex.value += 1
  }

  function previousPage(): void {
    if (!isFirstPage.value) state.pageIndex.value -= 1
  }

  function setPageSize(size: number): void {
    state.pageSize.value = size
    state.pageIndex.value = 0
  }

  return {
    currentPage,
    totalPages,
    startItem,
    endItem,
    isFirstPage,
    isLastPage,
    goToPage,
    nextPage,
    previousPage,
    setPageSize,
  }
}
