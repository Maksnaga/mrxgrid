/**
 * Sort engine — Angular parity (moz-grid / `SortEngine`).
 *
 * Reads / writes the central `GridState`:
 * - `state.activeSorts` — ordered multi-sort stack of `SortDef`
 * - `state.columnStates[i].sort` / `.sortIndex` — kept in sync for header UI
 *
 * Consumed by `useGridEngine.sortedData` (pipeline first stage). `MrxGrid.vue`
 * exposes the methods on the template via the returned handle.
 */

import { computed, type ComputedRef } from 'vue'
import type { GridState } from '../state/useGridState'
import type { SortDef, SortDirection } from '../models/sort.model'
import type { ColumnDef, RowData } from '../types'

export interface SortEngine<T = RowData> {
  readonly activeSorts: ComputedRef<SortDef[]>
  getSortDirection(field: string): SortDirection | null
  getSortIndex(field: string): number | null
  toggleSort(field: string, isMultiSort?: boolean): void
  setSort(field: string, direction: SortDirection | null): void
  clearSort(): void
  sortData(data: T[]): T[]
}

export function useSortEngine<T = RowData>(state: GridState<T>): SortEngine<T> {
  const activeSorts = computed<SortDef[]>(() => state.activeSorts.value)

  function getSortDirection(field: string): SortDirection | null {
    return state.activeSorts.value.find((s) => s.field === field)?.direction ?? null
  }

  function getSortIndex(field: string): number | null {
    const idx = state.activeSorts.value.findIndex((s) => s.field === field)
    return idx === -1 ? null : idx + 1
  }

  function toggleSort(field: string, isMultiSort = false): void {
    const current = state.activeSorts.value
    const existing = current.find((s) => s.field === field)

    let nextDirection: SortDirection | null
    if (!existing) nextDirection = 'asc'
    else if (existing.direction === 'asc') nextDirection = 'desc'
    else nextDirection = null

    let next: SortDef[]
    if (isMultiSort) {
      if (nextDirection === null) {
        next = current
          .filter((s) => s.field !== field)
          .map((s, i) => ({ ...s, priority: i }))
      } else if (existing) {
        next = current.map((s) => (s.field === field ? { ...s, direction: nextDirection! } : s))
      } else {
        next = [...current, { field, direction: nextDirection, priority: current.length }]
      }
    } else {
      next = nextDirection ? [{ field, direction: nextDirection, priority: 0 }] : []
    }

    state.activeSorts.value = next
    syncColumnSortState(next)
  }

  function setSort(field: string, direction: SortDirection | null): void {
    const next: SortDef[] = direction ? [{ field, direction, priority: 0 }] : []
    state.activeSorts.value = next
    syncColumnSortState(next)
  }

  function clearSort(): void {
    state.activeSorts.value = []
    syncColumnSortState([])
  }

  function sortData(data: T[]): T[] {
    const sorts = state.activeSorts.value
    if (sorts.length === 0) return data

    const defMap = state.columnDefMap.value
    return [...data].sort((a, b) => {
      for (const sort of sorts) {
        const def = defMap.get(sort.field)
        if (def?.sortComparator) {
          const r = def.sortComparator(a, b)
          if (r !== 0) return sort.direction === 'asc' ? r : -r
          continue
        }
        const valA = getValue(a, sort.field, def)
        const valB = getValue(b, sort.field, def)
        const r = defaultCompare(valA, valB)
        if (r !== 0) return sort.direction === 'asc' ? r : -r
      }
      return 0
    })
  }

  function syncColumnSortState(sorts: SortDef[]): void {
    state.columnStates.value = state.columnStates.value.map((col) => {
      const sortDef = sorts.find((s) => s.field === col.field)
      return {
        ...col,
        sort: sortDef?.direction ?? null,
        sortIndex: sortDef ? sorts.indexOf(sortDef) : null,
      }
    })
  }

  return { activeSorts, getSortDirection, getSortIndex, toggleSort, setSort, clearSort, sortData }
}

function getValue<T>(row: T, field: string, def?: ColumnDef<T>): unknown {
  if (def?.valueGetter) return def.valueGetter(row)
  return (row as unknown as Record<string, unknown>)[field]
}

function defaultCompare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b)
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}
