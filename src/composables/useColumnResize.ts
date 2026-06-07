import type { GridState } from '@/components/AdeoGrid/state/useGridState'
import type { RowData } from '@/components/AdeoGrid/types'

// Minimum width for a resizable column.
//
// Sized to keep the header affordances visible (sort indicator + kebab
// menu trigger) even at the tightest drag. Anatomy of the cell at this
// width :
//   • 8 px horizontal padding × 2                        =  16 px
//   • header label, single-line ellipsis fallback        ≈  50 px
//   • flex gap                                           =   4 px
//   • sort indicator (.adeo-grid-grid-sort-icon)               =  20 px
//   • flex gap                                           =   4 px
//   • menu trigger (icon 16 px + 8 px padding × 2)       =  24 px
//   • resize handle clear zone                           ≈   4 px
//   Total                                                ≈ 120 px
//
// Below this threshold the sort arrow + gear used to overflow into the
// next column's header — exactly what the user reported. Consumers can
// still set a tighter floor per column via `ColumnDef.minWidth` (e.g.
// an icon-only "actions" column at 40 px), which wins over this
// default; this constant only kicks in when no `minWidth` is declared.
const MIN_WIDTH = 120

/**
 * Module-level flag — set to `true` from resize mousedown until shortly
 * after mouseup. `AdeoGridHeaderCell.onHeaderClick` consults
 * `wasResizingRecently()` to decide whether to sort.
 *
 * The browser fires a synthetic `click` event after every mouseup whose
 * mousedown landed on the same DOM subtree. During a column resize the
 * mousedown is on the `.adeo-grid-grid-resize-handle` (a child of the header
 * cell) and the mouseup is anywhere on the document; the click event
 * therefore fires on the common ancestor — the header cell itself — and
 * the `closest('.adeo-grid-grid-resize-handle')` guard in `onHeaderClick` can't
 * see the resize handle (because `e.target` is no longer it).
 *
 * The flag approach is preferred over a transient capture-phase click
 * listener because the browser dispatches click *after* `setTimeout(0)`
 * fires its callback — the listener gets removed before it can swallow
 * the click. A module flag is race-condition-free and the consumer
 * (header click handler) reads it synchronously inside the click event.
 */
let _resizeEndedAt = 0

export function wasResizingRecently(): boolean {
  // 200 ms window is wide enough to cover the synthetic click dispatched
  // after any reasonable mouseup, but small enough that a real user
  // click happening shortly after a resize is still honoured. Browsers
  // dispatch the synthetic click within ~tens of ms of mouseup; 200 ms
  // is a comfortable margin without being perceptible to the user.
  return performance.now() - _resizeEndedAt < 200
}

/**
 * Drag-to-resize handler — writes directly into the central `GridState`.
 *
 * Phase 2.3: this composable is now a thin DOM adapter. The single source of
 * truth for column widths is `gridState.columnStates[i].currentWidth`; the
 * legacy `widths: ColumnWidths` reactive map is gone (it created a second
 * source that had to be kept in sync via a watch).
 *
 * Signatures kept stable so consumers (`AdeoGridHeader` → `onResizeStart`,
 * pinned/virtual layout → `getColumnWidth`) don't change.
 */
export function useColumnResize<T = RowData>(gridState: GridState<T>) {
  /** Returns the current pixel width of a column ('123px'), or undefined. */
  function getColumnWidth(field: string): string | undefined {
    const col = gridState.columnStates.value.find((c) => c.field === field)
    if (col) return `${col.currentWidth}px`
    const def = gridState.columnDefs.value.find((d) => d.field === field)
    return def?.width
  }

  function onResizeStart(
    field: string,
    startX: number,
    startWidth: number,
    fromLeft = false,
  ): void {
    const def = gridState.columnDefMap.value.get(field)
    const min = def?.minWidth ? parseInt(def.minWidth, 10) || MIN_WIDTH : MIN_WIDTH
    const max = def?.maxWidth ? parseInt(def.maxWidth, 10) || Infinity : Infinity

    const savedCursor = document.body.style.cursor
    const savedUserSelect = document.body.style.userSelect

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMouseMove(e: MouseEvent): void {
      // For left-edge handles (right-pinned columns) we negate the
      // delta so dragging the cursor leftward enlarges the column.
      // The user grabs the LEFT edge and pulls it further left, which
      // is the natural gesture for fixed-end columns.
      const delta = (e.clientX - startX) * (fromLeft ? -1 : 1)
      const newWidth = Math.max(min, Math.min(max, startWidth + delta))
      gridState.updateColumnState(field, { currentWidth: newWidth })
    }

    function onMouseUp(): void {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = savedCursor
      document.body.style.userSelect = savedUserSelect

      // Mark the resize as just-ended so the synthetic click fired by
      // the browser on `.adeo-grid-grid-header-cell` (common ancestor of
      // mousedown on the handle + mouseup elsewhere) is ignored by
      // `onHeaderClick` — otherwise the column gets sorted every time
      // the user resizes it.
      _resizeEndedAt = performance.now()
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return {
    getColumnWidth,
    onResizeStart,
  }
}
