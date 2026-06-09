import { computed, type ComputedRef, type Ref, type WritableComputedRef } from 'vue'
import type { GridState } from '@/components/AdeoGrid/state/useGridState'
import type { ColumnDef, RowData } from '@/components/AdeoGrid/types'
import type { PinnedSide } from '@/components/AdeoGrid/models/column.model'

type AnyGridState = GridState<RowData>

/**
 * Column visibility / pinning / order — Angular-parity storage.
 *
 * Phase 2.8: every piece of state moves to `gridState.columnStates[i]`:
 * - `visible`        — boolean (replaces the legacy `hiddenFields` Set)
 * - `pinned`         — 'start' | 'end' | null (replaces `pinOverrides` Map)
 * - `order`          — number (replaces `columnOrder: Ref<string[]>`)
 * - `searchVisible`  — boolean (replaces the legacy `filterActive` Set)
 *
 * The public API still speaks the legacy shape (`'left' | 'right'` pin sides,
 * `Ref<string[]>` for column order, `ColumnDef[]` for `visibleColumns`) so
 * `usePinnedColumns`, the column menu, and the header components keep working
 * without any change.
 */
export function useColumns(gridState: AnyGridState) {
  // --- visibleColumns: ColumnDef[] derived from gridState ---

  const visibleColumns: ComputedRef<ColumnDef[]> = computed(() => {
    const states = gridState.visibleColumns.value
    const defMap = gridState.columnDefMap.value
    const out: ColumnDef[] = []
    for (const state of states) {
      const def = defMap.get(state.field) as ColumnDef | undefined
      if (!def) continue
      // Convert Angular-parity `'start' | 'end'` → legacy `'left' | 'right'`
      // for `usePinnedColumns` and the column menu, which speak the legacy
      // alphabet. The original `def.pinned` may itself be either alphabet —
      // `state.pinned` is the canonical override.
      const pinnedLegacy =
        state.pinned === 'start' ? 'left' : state.pinned === 'end' ? 'right' : null
      out.push({ ...def, pinned: pinnedLegacy })
    }
    return out
  })

  /** Full list of columns including hidden — for "show column" UI. */
  const allColumns: ComputedRef<ColumnDef[]> = computed(
    () => gridState.columnDefs.value as ColumnDef[],
  )

  // --- columnOrder: writable computed mapping to columnStates[].order ---

  const columnOrder: WritableComputedRef<string[]> = computed({
    get: () => {
      return [...gridState.columnStates.value]
        .sort((a, b) => a.order - b.order)
        .map((c) => c.field)
    },
    set: (fields) => {
      const orderMap = new Map<string, number>()
      for (let i = 0; i < fields.length; i++) orderMap.set(fields[i]!, i)
      gridState.columnStates.value = gridState.columnStates.value.map((col) => ({
        ...col,
        order: orderMap.has(col.field) ? orderMap.get(col.field)! : col.order,
      }))
    },
  })

  // --- Visibility ---

  function hideColumn(field: string): void {
    gridState.updateColumnState(field, { visible: false })
  }

  function showColumn(field: string): void {
    gridState.updateColumnState(field, { visible: true })
  }

  function isHidden(field: string): boolean {
    const col = gridState.columnStates.value.find((c) => c.field === field)
    return col ? !col.visible : false
  }

  // --- Pinning (legacy 'left' | 'right' API; canonical is 'start' | 'end') ---

  function pinColumn(field: string, side: 'left' | 'right'): void {
    const next: PinnedSide = side === 'left' ? 'start' : 'end'
    gridState.updateColumnState(field, { pinned: next })
  }

  function unpinColumn(field: string): void {
    gridState.updateColumnState(field, { pinned: null })
  }

  function getPinning(field: string): 'left' | 'right' | null | undefined {
    const col = gridState.columnStates.value.find((c) => c.field === field)
    if (!col) return undefined
    if (col.pinned === 'start') return 'left'
    if (col.pinned === 'end') return 'right'
    return null
  }

  // --- Per-column header search toggle ---

  function toggleFilter(field: string): void {
    const col = gridState.columnStates.value.find((c) => c.field === field)
    if (!col) return
    gridState.updateColumnState(field, { searchVisible: !col.searchVisible })
  }

  function isFilterActive(field: string): boolean {
    const col = gridState.columnStates.value.find((c) => c.field === field)
    return col ? col.searchVisible : false
  }

  // --- Reorder ---

  /**
   * Move `field` so it appears just before `beforeField` in the visible order.
   * If `beforeField` is null the column moves to the end.
   *
   * Mutates `columnStates[].order` in-place; the resulting numeric order may
   * be non-contiguous (gaps are fine — `visibleColumns` sorts by it anyway).
   */
  function reorderColumn(field: string, beforeField: string | null): void {
    const fields = columnOrder.value
    const fromIndex = fields.indexOf(field)
    if (fromIndex < 0) return

    const next = [...fields]
    next.splice(fromIndex, 1)

    if (beforeField === null) {
      next.push(field)
    } else {
      const targetIndex = next.indexOf(beforeField)
      if (targetIndex < 0) next.push(field)
      else next.splice(targetIndex, 0, field)
    }

    // Bail when the reorder is a no-op — otherwise we mutate `columnStates`
    // unnecessarily and trigger every downstream watcher (virtualization,
    // FLIP animation, etc.). Critical during live drag where mousemove
    // can request the same target dozens of times per second.
    if (
      fields.length === next.length &&
      fields.every((f, i) => f === next[i])
    ) {
      return
    }

    columnOrder.value = next
  }

  return {
    visibleColumns,
    allColumns,
    columnOrder: columnOrder as unknown as Ref<string[]>,
    hideColumn,
    showColumn,
    isHidden,
    pinColumn,
    unpinColumn,
    getPinning,
    toggleFilter,
    isFilterActive,
    reorderColumn,
  }
}
