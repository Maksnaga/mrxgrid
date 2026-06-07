/**
 * Column reorder engine — Angular parity (moz-grid / `ColumnReorderEngine`).
 *
 * Reads / writes the central `GridState`:
 * - `state.columnStates` — splice + re-number `order` on reorder
 *
 * Pure state mutation — no DOM, no events. The visual drag layer lives in
 * `useColumnDragEngine`, which calls back into `reorderUnpinned` once the user
 * drops a column.
 */

import type { GridState } from '../state/useGridState'
import type { RowData } from '../types'

export interface ColumnReorderEngine {
  reorder(previousIndex: number, newIndex: number): void
  /**
   * Reorder using indices relative to unpinned columns only. Translates to
   * global `columnStates` indices before applying.
   */
  reorderUnpinned(unpinnedPrevIndex: number, unpinnedNewIndex: number): void
}

export function useColumnReorderEngine<T = RowData>(
  state: GridState<T>,
): ColumnReorderEngine {
  function reorder(previousIndex: number, newIndex: number): void {
    if (previousIndex === newIndex) return
    const states = state.columnStates.value
    if (previousIndex < 0 || previousIndex >= states.length) return
    if (newIndex < 0 || newIndex >= states.length) return

    const reordered = [...states]
    const [moved] = reordered.splice(previousIndex, 1)
    if (!moved) return
    reordered.splice(newIndex, 0, moved)
    state.columnStates.value = reordered.map((s, i) => ({ ...s, order: i }))
  }

  function reorderUnpinned(unpinnedPrevIndex: number, unpinnedNewIndex: number): void {
    if (unpinnedPrevIndex === unpinnedNewIndex) return

    const states = state.columnStates.value
    const sorted = [...states].sort((a, b) => a.order - b.order)
    const visible = sorted.filter((s) => s.visible)
    const unpinned = visible.filter((s) => !s.pinned)

    const prev = unpinned[unpinnedPrevIndex]
    const next = unpinned[unpinnedNewIndex]
    if (!prev || !next) return

    const globalPrev = sorted.findIndex((s) => s.field === prev.field)
    const globalNext = sorted.findIndex((s) => s.field === next.field)
    if (globalPrev === -1 || globalNext === -1) return

    reorder(globalPrev, globalNext)
  }

  return { reorder, reorderUnpinned }
}
