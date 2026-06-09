/**
 * Row expansion engine — Angular parity (ad-grid / `ExpandableRowEngine`).
 *
 * Reads / writes the central `GridState`:
 * - `state.expandedRowIds` — set of row IDs currently expanded
 *
 * The legacy Vue composable (`useRowExpansion`) keyed on row *index*; the
 * Angular engine keys on **row ID** (resolved via `rowIdField`). This engine
 * mirrors the Angular shape — the double-write in `Grid.vue` maps the
 * legacy index-set to the Angular-parity id-set.
 */

import { computed, type ComputedRef } from 'vue'
import type { GridState } from '../state/useGridState'
import type { RowData } from '../types'

export interface RowExpansionEngine {
  readonly hasExpandedRows: ComputedRef<boolean>
  toggleRow(rowId: unknown): void
  expandRow(rowId: unknown): void
  collapseRow(rowId: unknown): void
  collapseAll(): void
  isRowExpanded(rowId: unknown): boolean
}

export function useRowExpansionEngine<T = RowData>(state: GridState<T>): RowExpansionEngine {
  const hasExpandedRows = computed<boolean>(() => state.expandedRowIds.value.size > 0)

  function toggleRow(rowId: unknown): void {
    const next = new Set(state.expandedRowIds.value)
    if (next.has(rowId)) next.delete(rowId)
    else next.add(rowId)
    state.expandedRowIds.value = next
  }

  function expandRow(rowId: unknown): void {
    const next = new Set(state.expandedRowIds.value)
    next.add(rowId)
    state.expandedRowIds.value = next
  }

  function collapseRow(rowId: unknown): void {
    const next = new Set(state.expandedRowIds.value)
    next.delete(rowId)
    state.expandedRowIds.value = next
  }

  function collapseAll(): void {
    state.expandedRowIds.value = new Set()
  }

  function isRowExpanded(rowId: unknown): boolean {
    return state.expandedRowIds.value.has(rowId)
  }

  return { hasExpandedRows, toggleRow, expandRow, collapseRow, collapseAll, isRowExpanded }
}
