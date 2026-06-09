/**
 * Row selection engine — Angular parity (ad-grid / `RowSelectionEngine`).
 *
 * Reads / writes the central `GridState`:
 * - `state.selectedRowIds`    — IDs the user explicitly selected (page mode)
 * - `state.excludedRowIds`    — IDs the user explicitly deselected (all mode)
 * - `state.selectAllMode`     — 'none' | 'page' | 'all'
 * - `state.rowIdField`        — field name for row ID resolution
 *
 * Depends on `paginatedData` (from `useGridEngine`) because most of the
 * header-checkbox logic is page-scoped. Mirrors Angular 1-for-1, including the
 * object-identity anchor (`lastToggledRow`) used for shift-click ranges.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { GridState } from '../state/useGridState'
import type { RowData } from '../types'
import type { RowSelectionEvent, SelectAllMode } from '../models/grid-events.model'

export interface RowSelectionEngine<T = RowData> {
  readonly selectedIds: ComputedRef<Set<unknown>>
  readonly excludedIds: ComputedRef<Set<unknown>>
  readonly lastToggledRow: Ref<T | null>
  readonly count: ComputedRef<number>
  readonly pageSelectedCount: ComputedRef<number>
  readonly isAllSelected: ComputedRef<boolean>
  readonly isIndeterminate: ComputedRef<boolean>
  selectRowRangeToRow(endRow: T): void
  toggleRow(row: T): void
  isRowSelected(row: T): boolean
  selectAllPage(): void
  selectAll(): void
  deselectAll(): void
  deselectPage(): void
  toggleSelectAllPage(): void
  getSelectionEvent(): RowSelectionEvent<T>
  getRowId(row: T): unknown
}

export function useRowSelectionEngine<T = RowData>(
  state: GridState<T>,
  paginatedData: ComputedRef<T[]>,
): RowSelectionEngine<T> {
  const selectedIds = computed<Set<unknown>>(() => state.selectedRowIds.value)
  const excludedIds = computed<Set<unknown>>(() => state.excludedRowIds.value)
  const lastToggledRow = ref<T | null>(null) as Ref<T | null>

  const count = computed<number>(() => {
    if (state.selectAllMode.value === 'all') {
      const total = state.totalItems.value || state.sourceData.value.length
      return total - state.excludedRowIds.value.size
    }
    return state.selectedRowIds.value.size
  })

  const pageSelectedCount = computed<number>(
    () => paginatedData.value.filter((row) => isRowSelected(row)).length,
  )

  const isAllSelected = computed<boolean>(() => {
    const page = paginatedData.value
    if (page.length === 0) return false
    return page.every((row) => isRowSelected(row))
  })

  const isIndeterminate = computed<boolean>(() => {
    const page = paginatedData.value
    if (page.length === 0) return false
    const selected = page.filter((row) => isRowSelected(row)).length
    return selected > 0 && selected < page.length
  })

  function getRowId(row: T): unknown {
    const field = state.rowIdField.value ?? 'id'
    const r = row as unknown as Record<string, unknown>
    return r[field] ?? r['id'] ?? r['_id'] ?? row
  }

  function isRowSelected(row: T): boolean {
    const id = getRowId(row)
    if (state.selectAllMode.value === 'all') {
      return !state.excludedRowIds.value.has(id)
    }
    return state.selectedRowIds.value.has(id)
  }

  function toggleRow(row: T): void {
    const id = getRowId(row)
    const mode = state.selectAllMode.value

    if (mode === 'all') {
      const next = new Set(state.excludedRowIds.value)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      state.excludedRowIds.value = next
    } else {
      const next = new Set(state.selectedRowIds.value)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      state.selectedRowIds.value = next
      state.selectAllMode.value = next.size === 0 ? 'none' : mode === 'none' ? 'page' : mode
    }
  }

  function selectRowRangeToRow(endRow: T): void {
    const anchor = lastToggledRow.value
    if (!anchor) {
      toggleRow(endRow)
      lastToggledRow.value = endRow
      return
    }
    const page = paginatedData.value
    const anchorIdx = page.indexOf(anchor)
    const endIdx = page.indexOf(endRow)
    if (anchorIdx < 0 || endIdx < 0) {
      toggleRow(endRow)
      lastToggledRow.value = endRow
      return
    }
    const start = Math.min(anchorIdx, endIdx)
    const end = Math.max(anchorIdx, endIdx)
    const next = new Set(state.selectedRowIds.value)
    for (let i = start; i <= end; i++) {
      next.add(getRowId(page[i]!))
    }
    state.selectedRowIds.value = next
    if (state.selectAllMode.value === 'none') {
      state.selectAllMode.value = 'page'
    }
    lastToggledRow.value = endRow
  }

  function selectAllPage(): void {
    const page = paginatedData.value
    if (state.selectAllMode.value === 'all') {
      const next = new Set(state.excludedRowIds.value)
      for (const row of page) next.delete(getRowId(row))
      state.excludedRowIds.value = next
    } else {
      const next = new Set(state.selectedRowIds.value)
      for (const row of page) next.add(getRowId(row))
      state.selectedRowIds.value = next
      state.selectAllMode.value = 'page'
    }
  }

  function selectAll(): void {
    state.selectedRowIds.value = new Set()
    state.excludedRowIds.value = new Set()
    state.selectAllMode.value = 'all'
  }

  function deselectAll(): void {
    state.selectedRowIds.value = new Set()
    state.excludedRowIds.value = new Set()
    state.selectAllMode.value = 'none'
  }

  function deselectPage(): void {
    const page = paginatedData.value
    if (state.selectAllMode.value === 'all') {
      const next = new Set(state.excludedRowIds.value)
      for (const row of page) next.add(getRowId(row))
      state.excludedRowIds.value = next
    } else {
      const next = new Set(state.selectedRowIds.value)
      for (const row of page) next.delete(getRowId(row))
      state.selectedRowIds.value = next
      if (next.size === 0) state.selectAllMode.value = 'none'
    }
  }

  function toggleSelectAllPage(): void {
    if (isAllSelected.value) deselectPage()
    else selectAllPage()
  }

  function getSelectionEvent(): RowSelectionEvent<T> {
    const mode: SelectAllMode = state.selectAllMode.value
    const page = paginatedData.value

    if (mode === 'all') {
      const excluded = state.excludedRowIds.value
      const selectedRows = page.filter((row) => !excluded.has(getRowId(row)))
      return {
        selectedIds: selectedRows.map((row) => getRowId(row)),
        excludedIds: Array.from(excluded),
        selectedRows,
        mode,
        count: selectedRows.length,
      }
    }

    const ids = state.selectedRowIds.value
    const selectedRows = page.filter((row) => ids.has(getRowId(row)))
    return {
      selectedIds: selectedRows.map((row) => getRowId(row)),
      excludedIds: [],
      selectedRows,
      mode,
      count: selectedRows.length,
    }
  }

  return {
    selectedIds,
    excludedIds,
    lastToggledRow,
    count,
    pageSelectedCount,
    isAllSelected,
    isIndeterminate,
    selectRowRangeToRow,
    toggleRow,
    isRowSelected,
    selectAllPage,
    selectAll,
    deselectAll,
    deselectPage,
    toggleSelectAllPage,
    getSelectionEvent,
    getRowId,
  }
}
