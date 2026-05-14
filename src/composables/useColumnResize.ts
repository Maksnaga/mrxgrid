import type { GridState } from '@/components/MrxGrid/state/useGridState'
import type { RowData } from '@/components/MrxGrid/types'

const MIN_WIDTH = 50

/**
 * Drag-to-resize handler — writes directly into the central `GridState`.
 *
 * Phase 2.3: this composable is now a thin DOM adapter. The single source of
 * truth for column widths is `gridState.columnStates[i].currentWidth`; the
 * legacy `widths: ColumnWidths` reactive map is gone (it created a second
 * source that had to be kept in sync via a watch).
 *
 * Signatures kept stable so consumers (`MrxGridHeader` → `onResizeStart`,
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
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return {
    getColumnWidth,
    onResizeStart,
  }
}
