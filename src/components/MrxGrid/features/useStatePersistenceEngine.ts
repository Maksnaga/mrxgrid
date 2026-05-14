/**
 * State persistence engine — Angular parity (moz-grid / `StatePersistenceEngine`).
 *
 * Round-trips column layout (width / order / visibility / pin side), active
 * sorts and filter conditions through `localStorage`. Designed for the
 * "remember my view" UX: user tweaks the grid, reloads the app, state is
 * restored onto the same column set.
 *
 * - Filter condition `id`s are stripped on save and regenerated on restore —
 *   they're runtime-only handles used by the filter engine to track edits.
 * - `restore` rebuilds `columnStates` by field match, ignoring saved fields
 *   that no longer exist (column was removed) and keeping unrecognised live
 *   fields at their defaults (column was added).
 * - Any thrown error from `localStorage` (quota, private mode, SSR) is
 *   silently swallowed — persistence is best-effort, never blocking.
 */

import type { GridState } from '../state/useGridState'
import type { SortDef, SortDirection } from '../models/sort.model'
import { generateConditionId, type FilterCondition } from '../models/filter.model'
import type { RowData } from '../types'

export interface PersistedGridState {
  columns: Array<{
    field: string
    currentWidth: number
    order: number
    visible: boolean
    pinned: 'start' | 'end' | null
  }>
  sorts: SortDef[]
  filters?: Array<Omit<FilterCondition, 'id'>>
}

export interface StatePersistenceEngine {
  save(storageKey: string): void
  restore(storageKey: string): boolean
  clear(storageKey: string): void
}

export function useStatePersistenceEngine<T = RowData>(
  state: GridState<T>,
): StatePersistenceEngine {
  function save(storageKey: string): void {
    const persisted: PersistedGridState = {
      columns: state.columnStates.value.map((col) => ({
        field: col.field,
        currentWidth: col.currentWidth,
        order: col.order,
        visible: col.visible,
        pinned: col.pinned,
      })),
      sorts: state.activeSorts.value,
      filters: state.filterModel.value.conditions.map(({ id: _id, ...rest }) => rest),
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(persisted))
    } catch {
      // localStorage may be unavailable or full — non-fatal.
    }
  }

  function restore(storageKey: string): boolean {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return false

      const persisted: PersistedGridState = JSON.parse(raw)
      if (!persisted.columns?.length) return false

      state.columnStates.value = state.columnStates.value.map((col) => {
        const saved = persisted.columns.find((s) => s.field === col.field)
        if (!saved) return col
        return {
          ...col,
          currentWidth: saved.currentWidth,
          order: saved.order,
          visible: saved.visible,
          pinned: saved.pinned,
        }
      })

      if (persisted.sorts?.length) {
        state.activeSorts.value = persisted.sorts
        state.columnStates.value = state.columnStates.value.map((s) => {
          const sortDef = persisted.sorts.find((sd) => sd.field === s.field)
          return sortDef
            ? {
                ...s,
                sort: sortDef.direction as SortDirection,
                sortIndex: persisted.sorts.indexOf(sortDef),
              }
            : { ...s, sort: null, sortIndex: null }
        })
      }

      if (persisted.filters?.length) {
        state.filterModel.value = {
          conditions: persisted.filters.map((f) => ({ ...f, id: generateConditionId() })),
        }
      }

      return true
    } catch {
      return false
    }
  }

  function clear(storageKey: string): void {
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // localStorage may be unavailable — non-fatal.
    }
  }

  return { save, restore, clear }
}
