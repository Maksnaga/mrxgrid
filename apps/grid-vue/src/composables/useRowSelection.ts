import { computed, type ComputedRef, type Ref } from 'vue'
import type { GridState } from '@/components/AdeoGrid/state/useGridState'
import type { RowData, SelectionState } from '@/components/AdeoGrid/types'

/**
 * Gmail-style selection state (consumer-facing shape).
 *
 * Works with virtual scroll and lazy-loaded data:
 * - `allSelected = false` → only rows in `selectedIds` are selected
 * - `allSelected = true`  → ALL rows are selected EXCEPT those in `deselectedIds`
 *
 * Phase 2.6: the storage moves to `gridState.selectAllMode` /
 * `selectedRowIds` / `excludedRowIds` (Angular parity). The Gmail-shape
 * `SelectionModel` is a derived computed; mutators write straight into
 * `gridState`. The legacy mirror watch in `AdeoGrid.vue` is gone.
 *
 * Mapping (single source of truth on `gridState`):
 *   allSelected = true                    ↔ selectAllMode = 'all'   + excludedRowIds = deselectedIds
 *   allSelected = false, selectedIds > 0  ↔ selectAllMode = 'page'  + selectedRowIds = selectedIds
 *   allSelected = false, selectedIds = 0  ↔ selectAllMode = 'none'
 */
export interface SelectionModel {
  allSelected: boolean
  selectedIds: Set<string>
  deselectedIds: Set<string>
}

export interface RowSelectionReturn {
  selectionState: Ref<SelectionState>
  selectionModel: Ref<SelectionModel>
  selectedCount: Ref<number>
  isSelected: (id: string) => boolean
  selectRow: (id: string) => void
  deselectRow: (id: string) => void
  toggleRow: (id: string) => void
  selectPage: (ids: string[]) => void
  deselectPage: (ids: string[]) => void
  pageSelectionState: (pageIds: string[]) => SelectionState
  selectAll: () => void
  clearSelection: () => void
  togglePage: (pageIds: string[]) => void
}

export function useRowSelection<T extends RowData = RowData>(
  gridState: GridState<T>,
  totalCount: Ref<number>,
): RowSelectionReturn {
  // --- Storage projections over gridState ---

  function isAllMode(): boolean {
    return gridState.selectAllMode.value === 'all'
  }

  function isSelected(id: string): boolean {
    if (isAllMode()) return !gridState.excludedRowIds.value.has(id)
    return gridState.selectedRowIds.value.has(id)
  }

  function setSelectedIds(next: Set<string>): void {
    gridState.selectedRowIds.value = next as Set<unknown>
    if (isAllMode()) return // 'all' mode keeps mode regardless
    gridState.selectAllMode.value = next.size === 0 ? 'none' : 'page'
  }

  function setExcludedIds(next: Set<string>): void {
    gridState.excludedRowIds.value = next as Set<unknown>
  }

  // --- Mutators ---

  function selectRow(id: string): void {
    if (isAllMode()) {
      const next = new Set(gridState.excludedRowIds.value as Set<string>)
      next.delete(id)
      setExcludedIds(next)
    } else {
      const next = new Set(gridState.selectedRowIds.value as Set<string>)
      next.add(id)
      setSelectedIds(next)
    }
  }

  function deselectRow(id: string): void {
    if (isAllMode()) {
      const next = new Set(gridState.excludedRowIds.value as Set<string>)
      next.add(id)
      setExcludedIds(next)
    } else {
      const next = new Set(gridState.selectedRowIds.value as Set<string>)
      next.delete(id)
      setSelectedIds(next)
    }
  }

  function toggleRow(id: string): void {
    if (isSelected(id)) deselectRow(id)
    else selectRow(id)
  }

  function selectPage(ids: string[]): void {
    if (isAllMode()) {
      const next = new Set(gridState.excludedRowIds.value as Set<string>)
      for (const id of ids) next.delete(id)
      setExcludedIds(next)
    } else {
      const next = new Set(gridState.selectedRowIds.value as Set<string>)
      for (const id of ids) next.add(id)
      setSelectedIds(next)
    }
  }

  function deselectPage(ids: string[]): void {
    if (isAllMode()) {
      const next = new Set(gridState.excludedRowIds.value as Set<string>)
      for (const id of ids) next.add(id)
      setExcludedIds(next)
    } else {
      const next = new Set(gridState.selectedRowIds.value as Set<string>)
      for (const id of ids) next.delete(id)
      setSelectedIds(next)
    }
  }

  function pageSelectionState(pageIds: string[]): SelectionState {
    if (pageIds.length === 0) return 'none'
    let count = 0
    for (const id of pageIds) {
      if (isSelected(id)) count++
    }
    if (count === 0) return 'none'
    if (count === pageIds.length) return 'all'
    return 'some'
  }

  function selectAll(): void {
    gridState.selectAllMode.value = 'all'
    gridState.selectedRowIds.value = new Set()
    gridState.excludedRowIds.value = new Set()
  }

  function clearSelection(): void {
    gridState.selectAllMode.value = 'none'
    gridState.selectedRowIds.value = new Set()
    gridState.excludedRowIds.value = new Set()
  }

  function togglePage(pageIds: string[]): void {
    const state = pageSelectionState(pageIds)
    if (state === 'all') deselectPage(pageIds)
    else selectPage(pageIds)
  }

  // --- Derived state ---

  const selectedCount = computed<number>(() => {
    if (isAllMode()) return totalCount.value - gridState.excludedRowIds.value.size
    return gridState.selectedRowIds.value.size
  })

  const selectionState = computed<SelectionState>(() => {
    if (isAllMode()) {
      const dsz = gridState.excludedRowIds.value.size
      if (dsz === 0) return 'all'
      if (dsz >= totalCount.value) return 'none'
      return 'some'
    }
    const ssz = gridState.selectedRowIds.value.size
    if (ssz === 0) return 'none'
    if (ssz >= totalCount.value) return 'all'
    return 'some'
  })

  const selectionModel = computed<SelectionModel>(() => ({
    allSelected: isAllMode(),
    selectedIds: gridState.selectedRowIds.value as Set<string>,
    deselectedIds: gridState.excludedRowIds.value as Set<string>,
  }))

  return {
    selectionState: selectionState as unknown as Ref<SelectionState>,
    selectionModel: selectionModel as unknown as Ref<SelectionModel>,
    selectedCount: selectedCount as unknown as Ref<number>,
    isSelected,
    selectRow,
    deselectRow,
    toggleRow,
    selectPage,
    deselectPage,
    pageSelectionState,
    selectAll,
    clearSelection,
    togglePage,
  }
}
