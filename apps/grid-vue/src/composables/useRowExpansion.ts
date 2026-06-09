import { computed, type ComputedRef, type Ref } from 'vue'
import type { GridState } from '@/components/AdeoGrid/state/useGridState'
import type { RowData } from '@/components/AdeoGrid/types'
import { isGroupRow } from '@/components/AdeoGrid/types'

/**
 * Row expansion — Angular-parity storage with index-based public API.
 *
 * Phase 2.4: the single source of truth is `gridState.expandedRowIds`
 * (id-keyed, matching `useRowSelectionEngine`). The legacy `Set<number>`
 * index-based API is preserved for `AdeoGridBody` consumers — index ↔ id
 * conversion is done internally via the `rowsAccessor`.
 *
 * Falls back to `String(index)` as a synthetic id when the row exposes no
 * `id` / `_id` / `rowIdField` value (matches the legacy double-write).
 */
export function useRowExpansion<T extends RowData = RowData>(
  gridState: GridState<T>,
  rowsAccessor: () => readonly T[],
) {
  function rowIdFor(index: number): unknown {
    const row = rowsAccessor()[index]
    if (!row || isGroupRow(row as RowData)) return undefined
    const field = gridState.rowIdField.value || 'id'
    const r = row as unknown as Record<string, unknown>
    return r[field] ?? r['id'] ?? r['_id'] ?? String(index)
  }

  function isExpanded(index: number): boolean {
    const id = rowIdFor(index)
    if (id === undefined) return false
    return gridState.expandedRowIds.value.has(id)
  }

  function toggleExpansion(index: number): void {
    const id = rowIdFor(index)
    if (id === undefined) return
    const next = new Set(gridState.expandedRowIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    gridState.expandedRowIds.value = next
  }

  function collapseAll(): void {
    gridState.expandedRowIds.value = new Set()
  }

  /**
   * Legacy compat: index-based set, derived from the id-based source. Held as
   * a computed so the previous `Ref<Set<number>>` consumers keep reading the
   * same shape. Recomputes only when `expandedRowIds` or rows change.
   */
  const expanded: ComputedRef<Set<number>> = computed(() => {
    const ids = gridState.expandedRowIds.value
    if (ids.size === 0) return new Set<number>()
    const out = new Set<number>()
    const rows = rowsAccessor()
    for (let i = 0; i < rows.length; i++) {
      const id = rowIdFor(i)
      if (id !== undefined && ids.has(id)) out.add(i)
    }
    return out
  })

  return {
    expanded: expanded as unknown as Ref<Set<number>>,
    isExpanded,
    toggleExpansion,
    collapseAll,
  }
}
