/**
 * Column resize engine — Angular parity (ad-grid / `ColumnResizeEngine`).
 *
 * Drives the column drag-to-resize interaction by writing `currentWidth` into
 * `state.columnStates[field]`. Mirrors Angular's behavior:
 * - `minWidth` / `maxWidth` from `ColumnDef` are honored.
 * - For columns pinned to `end`, the delta is inverted so dragging outward
 *   widens the column (the handle is on the left edge in that case).
 */

import type { Ref } from 'vue'
import type { GridState } from '../state/useGridState'
import type { ColumnResizeEvent } from '../models/column.model'
import type { RowData } from '../types'

// Aligned to 50px after sync analysis (matches useAutosize.ts and composables/useColumnResize.ts).
const MIN_COLUMN_WIDTH = 50

export interface ColumnResizeEngine {
  startResize(field: string, event: MouseEvent): void
  getResizeEvent(field: string, previousWidth: number): ColumnResizeEvent
  /**
   * `performance.now()` timestamp of the last resize mouseup. Used by
   * `AdGridHeaderCell` to suppress the synthetic click-after-mouseup that
   * would otherwise trigger a spurious sort. Mirror of the module-level
   * `_resizeEndedAt` flag in the legacy `composables/useColumnResize.ts`.
   */
  readonly lastResizeEndedAt: Ref<number>
}

export function useColumnResizeEngine<T = RowData>(state: GridState<T>): ColumnResizeEngine {
  let resizing = false
  let resizeField: string | null = null
  let startX = 0
  let startWidth = 0
  let invertDelta = false

  // Use the shared ref on GridState so AdGridHeaderCell can read it via
  // useGridContext() — no separate engine injection needed.
  const lastResizeEndedAt = state.lastResizeEndedAt

  function onMouseMove(event: MouseEvent): void {
    if (!resizing || !resizeField) return
    const rawDelta = event.clientX - startX
    const delta = invertDelta ? -rawDelta : rawDelta
    const def = state.columnDefMap.value.get(resizeField)
    const min = def?.minWidth ? parseInt(def.minWidth, 10) : MIN_COLUMN_WIDTH
    const max = def?.maxWidth ? parseInt(def.maxWidth, 10) : Infinity
    const newWidth = Math.max(min, Math.min(max, startWidth + delta))
    state.updateColumnState(resizeField, { currentWidth: newWidth })
  }

  function onMouseUp(): void {
    if (!resizing) return
    resizing = false
    lastResizeEndedAt.value = performance.now()
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  function startResize(field: string, event: MouseEvent): void {
    event.preventDefault()
    event.stopPropagation()

    const colState = state.columnStates.value.find((c) => c.field === field)
    if (!colState) return

    resizing = true
    resizeField = field
    startX = event.clientX
    startWidth = colState.currentWidth
    invertDelta = colState.pinned === 'end'

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function getResizeEvent(field: string, previousWidth: number): ColumnResizeEvent {
    const colState = state.columnStates.value.find((c) => c.field === field)
    return {
      field,
      previousWidth,
      newWidth: colState?.currentWidth ?? previousWidth,
    }
  }

  return { startResize, getResizeEvent, lastResizeEndedAt }
}
