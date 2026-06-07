import { ref, computed, isRef, onBeforeUnmount, type Ref } from 'vue'
import type { ColumnDef, RowData } from '@/components/AdeoGrid/types'

export interface MouseSelectionOptions {
  allColumns: Ref<ColumnDef[]>
  rows: Ref<RowData[]>
  rowHeight: Ref<number> | number
  wrapperRef: Ref<HTMLElement | null>
  getColumnWidth: (field: string) => string | undefined
  /** Width of utility columns (checkbox + expand) before the first data column. */
  utilityWidth: number
  /** Number of left-pinned columns (position: sticky). */
  pinnedLeftCount: Ref<number>
  /** Number of right-pinned columns (position: sticky). */
  pinnedRightCount: Ref<number>
  /** Called as the mouse moves during a drag. */
  onDragMove: (row: number, col: number) => void
  /** Called when the drag finishes. */
  onDragEnd: () => void
}

/**
 * Mouse-drag cell selection.
 *
 * Converts raw mouse events into cell coordinates and calls the provided
 * callbacks. The grid orchestrator connects these to `useCellSelection.extendTo`.
 *
 * ## How it works
 *
 * 1. `startDrag(e)` is called from the cell's mousedown handler AFTER the
 *    grid has already activated the clicked cell. This composable does NOT
 *    re-activate — it only sets up mousemove/mouseup listeners.
 * 2. mousemove on `document` converts the pointer position to a cell index
 *    and calls `onDragMove`.
 * 3. mouseup cleans up and calls `onDragEnd`.
 *
 * ## Coordinate mapping
 *
 * Y is computed relative to the grid body (subtracting the sticky header
 * height) so that `Math.floor(y / rowHeight)` gives the correct row index.
 */
export function useMouseSelection(options: MouseSelectionOptions) {
  const {
    allColumns,
    rows,
    wrapperRef,
    getColumnWidth,
    utilityWidth,
    pinnedLeftCount,
    pinnedRightCount,
    onDragMove,
    onDragEnd,
  } = options

  const rowHeight = computed(() =>
    isRef(options.rowHeight) ? options.rowHeight.value : options.rowHeight,
  )

  const isDragging = ref(false)

  function parseWidth(w: string | undefined): number {
    if (!w) return 150
    return parseInt(w, 10) || 150
  }

  function resolveColWidth(col: ColumnDef): number {
    const w = getColumnWidth(col.field)
    if (w) return parseWidth(w)
    return parseWidth(col.width)
  }

  /**
   * Measure the sticky header block height from the DOM.
   * This includes the column header row and the optional filter row.
   * Its height must be subtracted from the Y coordinate so that row 0
   * maps to the first data row, not the header.
   */
  function getHeaderHeight(): number {
    const el = wrapperRef.value
    if (!el) return 0
    const header = el.querySelector('.adeo-grid-grid-sticky-header') ?? el.querySelector('.adeo-grid-grid-header')
    if (!header) return 0
    return header.getBoundingClientRect().height
  }

  function mouseToCell(e: MouseEvent): { row: number; col: number } | null {
    const el = wrapperRef.value
    if (!el) return null

    const rect = el.getBoundingClientRect()
    const headerH = getHeaderHeight()

    // Compensate for the wrapper's border (clientLeft / clientTop)
    // so that coordinates are relative to the content area, not the border box.
    const y = e.clientY - rect.top - el.clientTop + el.scrollTop - headerH

    const row = Math.floor(y / rowHeight.value)
    const clampedRow = Math.max(0, Math.min(row, rows.value.length - 1))

    // --- Column hit-test ---
    //
    // Left/right-pinned columns use `position: sticky` so their visual
    // position is independent of scrollLeft. We must hit-test them in
    // VIEWPORT space (clientX relative to container), not content space.
    // Center (non-sticky) columns are hit-tested in content space.

    const cols = allColumns.value
    const nLeft = pinnedLeftCount.value
    const nRight = pinnedRightCount.value
    const totalCols = cols.length
    const nCenter = totalCols - nLeft - nRight

    // Viewport-relative X (does NOT include scrollLeft)
    const viewportX = e.clientX - rect.left - el.clientLeft

    // Check left-pinned columns first (sticky, always visible at left edge)
    let acc = utilityWidth
    for (let i = 0; i < nLeft; i++) {
      const w = resolveColWidth(cols[i]!)
      if (viewportX < acc + w) {
        return { row: clampedRow, col: Math.max(0, i) }
      }
      acc += w
    }
    // Check right-pinned columns (sticky, always visible at right edge)
    const containerW = el.clientWidth
    let rightAcc = 0
    for (let i = totalCols - 1; i >= totalCols - nRight; i--) {
      const w = resolveColWidth(cols[i]!)
      rightAcc += w
      if (viewportX >= containerW - rightAcc) {
        return { row: clampedRow, col: Math.min(i, totalCols - 1) }
      }
    }

    // Center columns: convert to content-space X
    const contentX = viewportX + el.scrollLeft
    acc = utilityWidth
    // Accumulate left-pinned widths in content space
    for (let i = 0; i < nLeft; i++) {
      acc += resolveColWidth(cols[i]!)
    }
    // Walk center columns
    let col = nLeft // default to first center column
    for (let i = nLeft; i < nLeft + nCenter; i++) {
      const w = resolveColWidth(cols[i]!)
      if (contentX < acc + w) {
        col = i
        break
      }
      acc += w
      col = i
    }
    const clampedCol = Math.max(0, Math.min(col, totalCols - 1))

    return { row: clampedRow, col: clampedCol }
  }

  function onMouseMove(e: MouseEvent) {
    const cell = mouseToCell(e)
    if (!cell) return
    onDragMove(cell.row, cell.col)

    // Auto-scroll when near edges
    const el = wrapperRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const edgeZone = 40

    const relY = e.clientY - rect.top
    if (relY < edgeZone) {
      el.scrollTop -= 20
    } else if (relY > rect.height - edgeZone) {
      el.scrollTop += 20
    }

    const relX = e.clientX - rect.left
    if (relX < edgeZone) {
      el.scrollLeft -= 20
    } else if (relX > rect.width - edgeZone) {
      el.scrollLeft += 20
    }
  }

  function onMouseUp() {
    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    onDragEnd()
  }

  /**
   * Start listening for drag selection.
   *
   * The initial cell activation is handled by the caller (onActivateCell)
   * — this method only sets up mousemove/mouseup listeners so that
   * dragging extends the selection.
   */
  function startDrag(e: MouseEvent) {
    if (e.button !== 0) return // left click only

    isDragging.value = true

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  })

  return {
    isDragging,
    startDrag,
  }
}
