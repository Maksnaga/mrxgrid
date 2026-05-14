import { computed, isRef, watch, type Ref, type WritableComputedRef } from 'vue'
import type { CellPosition, ColumnDef, RowData } from '@/components/MrxGrid/types'
import { isGroupRow } from '@/components/MrxGrid/types'
import type { GridState } from '@/components/MrxGrid/state/useGridState'

export interface ActiveCellOptions {
  /** Central grid state — owns the canonical `focusedCell` `{row, col}` shape. */
  gridState: GridState<RowData>
  /** All columns in their display order (flat — left-pinned + center + right-pinned). */
  allColumns: Ref<ColumnDef[]>
  /** All rows (full dataset, not the virtual slice). */
  rows: Ref<RowData[]>
  /** Scroll container element ref for auto-scroll. */
  wrapperRef: Ref<HTMLElement | null>
  /** Row height in px — used for scroll calculations. May be reactive. */
  rowHeight: Ref<number> | number
  /** Column width resolver. */
  getColumnWidth: (field: string) => string | undefined
  /** Current visible row range start index (from virtualizer). */
  startRowIndex: Ref<number>
  /** Current visible row range end index (from virtualizer). */
  endRowIndex: Ref<number>
  /** Current visible column range start index (center columns only). */
  startColIndex: Ref<number>
  /** Current visible column range end index (center columns only). */
  endColIndex: Ref<number>
  /** Number of left-pinned columns (always visible, not part of center range). */
  pinnedLeftCount: Ref<number>
  /** Number of right-pinned columns (always visible). */
  pinnedRightCount: Ref<number>
}

/**
 * Manages the active (focused) cell in the grid.
 *
 * ## Performance strategy
 *
 * - Uses `shallowRef` for the active position to avoid deep reactivity.
 * - The active row/field are compared by value in the template via
 *   simple equality checks (rowIndex === activeRowIndex && field === activeField),
 *   so only the previously-active and newly-active cells re-render.
 * - Auto-scroll uses direct DOM manipulation (scrollTop/scrollLeft) rather
 *   than reactive state to avoid triggering a render cycle.
 *
 * ## Virtual scrolling integration
 *
 * When the user navigates to a cell outside the rendered window, this
 * composable scrolls the container so the virtualizer picks up the new
 * scroll position and renders the target row/column. The active position
 * is stored as absolute indices into the full dataset, not the render slice.
 */
export function useActiveCell(options: ActiveCellOptions) {
  const {
    gridState,
    allColumns,
    rows,
    wrapperRef,
    getColumnWidth,
    startRowIndex,
    endRowIndex,
    pinnedLeftCount,
    pinnedRightCount,
  } = options

  const rowHeight = computed(() => isRef(options.rowHeight) ? options.rowHeight.value : options.rowHeight)

  // --- Active cell state — single source of truth on `gridState.focusedCell`.
  // The legacy `{rowIndex, field}` shape is exposed as a writable computed;
  // field↔col conversion uses `allColumns` (flat display order). When the
  // active column gets hidden / reordered out of view, the next read returns
  // `null` instead of pointing at a wrong column.
  const activeCell: WritableComputedRef<CellPosition | null> = computed({
    get: () => {
      const fc = gridState.focusedCell.value
      if (!fc) return null
      const col = allColumns.value[fc.col]
      if (!col) return null
      return { rowIndex: fc.row, field: col.field }
    },
    set: (next) => {
      if (!next) {
        gridState.focusedCell.value = null
        return
      }
      const col = allColumns.value.findIndex((c) => c.field === next.field)
      if (col < 0) {
        gridState.focusedCell.value = null
        return
      }
      gridState.focusedCell.value = { row: next.rowIndex, col }
    },
  })

  const activeRowIndex = computed(() => activeCell.value?.rowIndex ?? -1)
  const activeField = computed(() => activeCell.value?.field ?? null)

  // --- Navigation helpers ---

  function colIndex(field: string): number {
    return allColumns.value.findIndex((c) => c.field === field)
  }

  /** Group headers (and lazy-load skeleton placeholders) are not navigable. */
  function isNavigableRow(idx: number): boolean {
    const r = rows.value[idx]
    return !!r && !isGroupRow(r) && !r.__mrxSkeleton
  }

  /**
   * Walks `rows.value` from `fromIndex` (inclusive) in `step` direction
   * until it lands on a navigable row. Returns -1 if it hits a boundary
   * before finding one. Used to skip group/skeleton rows during keyboard
   * navigation.
   */
  function findNavigableRow(fromIndex: number, step: 1 | -1): number {
    const len = rows.value.length
    for (let i = fromIndex; i >= 0 && i < len; i += step) {
      if (isNavigableRow(i)) return i
    }
    return -1
  }

  function activate(rowIndex: number, field: string) {
    if (rowIndex < 0 || rowIndex >= rows.value.length || colIndex(field) === -1) {
      return
    }
    activeCell.value = { rowIndex, field }
  }

  function deactivate() {
    activeCell.value = null
  }

  /**
   * Move the active cell by (rowDelta, colDelta).
   * Used by useKeyboard's `onMove` callback.
   */
  function move(rowDelta: number, colDelta: number) {
    if (!activeCell.value) return
    const nextColIdx = colIndex(activeCell.value.field) + colDelta
    const cols = allColumns.value
    if (nextColIdx < 0 || nextColIdx >= cols.length) return

    let nextRow = activeCell.value.rowIndex + rowDelta
    if (rowDelta !== 0) {
      const step: 1 | -1 = rowDelta > 0 ? 1 : -1
      nextRow = findNavigableRow(nextRow, step)
      if (nextRow < 0) return
    } else if (!isNavigableRow(nextRow)) {
      return
    }

    if (nextRow < 0 || nextRow >= rows.value.length) return
    activeCell.value = { rowIndex: nextRow, field: cols[nextColIdx]!.field }
  }

  /**
   * Jump to an edge (Ctrl+Arrow).
   * Finds the last non-empty cell in the given direction, or the grid boundary.
   */
  function jumpToEdge(direction: 'up' | 'down' | 'left' | 'right') {
    const cell = activeCell.value
    if (!cell) return
    const cols = allColumns.value

    switch (direction) {
      case 'up': {
        const target = findNavigableRow(0, 1)
        if (target >= 0) activate(target, cell.field)
        break
      }
      case 'down': {
        const target = findNavigableRow(rows.value.length - 1, -1)
        if (target >= 0) activate(target, cell.field)
        break
      }
      case 'left': {
        const first = cols[0]
        if (first) activate(cell.rowIndex, first.field)
        break
      }
      case 'right': {
        const last = cols[cols.length - 1]
        if (last) activate(cell.rowIndex, last.field)
        break
      }
    }
  }

  /**
   * Tab navigation with row wrapping.
   * `forward=true` → right, wraps to next row's first column.
   * `forward=false` → left, wraps to previous row's last column.
   */
  function tab(forward: boolean) {
    if (!activeCell.value) return
    const cols = allColumns.value
    const idx = colIndex(activeCell.value.field)

    if (forward) {
      if (idx < cols.length - 1) {
        move(0, 1)
      } else {
        const next = findNavigableRow(activeCell.value.rowIndex + 1, 1)
        if (next >= 0) {
          const firstCol = cols[0]
          if (firstCol) activate(next, firstCol.field)
        }
      }
    } else {
      if (idx > 0) {
        move(0, -1)
      } else {
        const prev = findNavigableRow(activeCell.value.rowIndex - 1, -1)
        if (prev >= 0) {
          const lastCol = cols[cols.length - 1]
          if (lastCol) activate(prev, lastCol.field)
        }
      }
    }
  }

  /**
   * Enter navigation (move down or up with Shift).
   */
  function enter(forward: boolean) {
    move(forward ? 1 : -1, 0)
  }

  /**
   * Home / End navigation.
   */
  function homeEnd(key: 'Home' | 'End', ctrl: boolean) {
    if (!activeCell.value) return
    const cols = allColumns.value

    if (key === 'Home') {
      if (ctrl) {
        const firstCol = cols[0]
        const firstRow = findNavigableRow(0, 1)
        if (firstCol && firstRow >= 0) activate(firstRow, firstCol.field)
      } else {
        const firstCol = cols[0]
        if (firstCol) activate(activeCell.value.rowIndex, firstCol.field)
      }
    } else {
      if (ctrl) {
        const lastCol = cols[cols.length - 1]
        const lastRow = findNavigableRow(rows.value.length - 1, -1)
        if (lastCol && lastRow >= 0) activate(lastRow, lastCol.field)
      } else {
        const lastCol = cols[cols.length - 1]
        if (lastCol) activate(activeCell.value.rowIndex, lastCol.field)
      }
    }
  }

  /**
   * Page up/down navigation.
   */
  function page(direction: 'up' | 'down') {
    if (!activeCell.value) return
    const pageSize = endRowIndex.value - startRowIndex.value
    const cur = activeCell.value.rowIndex

    if (direction === 'down') {
      // Walk back from `target` toward the current row to find the
      // furthest navigable row — never overshoots, never lands on a group.
      let i = Math.min(cur + pageSize, rows.value.length - 1)
      while (i > cur && !isNavigableRow(i)) i--
      if (i > cur) activate(i, activeCell.value.field)
    } else {
      let i = Math.max(cur - pageSize, 0)
      while (i < cur && !isNavigableRow(i)) i++
      if (i < cur) activate(i, activeCell.value.field)
    }
  }

  // --- Auto-scroll into view ---

  function scrollCellIntoView(rowIndex: number, cIdx: number) {
    const el = wrapperRef.value
    if (!el) return

    // Vertical scroll
    const cellTop = rowIndex * rowHeight.value
    const cellBottom = cellTop + rowHeight.value
    const viewTop = el.scrollTop
    const viewBottom = viewTop + el.clientHeight

    if (cellTop < viewTop) {
      el.scrollTop = cellTop
    } else if (cellBottom > viewBottom) {
      el.scrollTop = cellBottom - el.clientHeight
    }

    // Horizontal scroll — only for non-pinned (center) columns
    const leftPinned = pinnedLeftCount.value
    const rightPinned = pinnedRightCount.value
    const totalCols = allColumns.value.length
    const isCenter = cIdx >= leftPinned && cIdx < totalCols - rightPinned

    if (isCenter) {
      let colLeft = 0
      for (let i = leftPinned; i < cIdx; i++) {
        colLeft += parseWidth(getColumnWidth(allColumns.value[i]!.field))
      }
      const colW = parseWidth(getColumnWidth(allColumns.value[cIdx]!.field))
      const colRight = colLeft + colW

      let pinnedLeftWidth = 0
      for (let i = 0; i < leftPinned; i++) {
        pinnedLeftWidth += parseWidth(getColumnWidth(allColumns.value[i]!.field))
      }
      let pinnedRightWidth = 0
      for (let i = totalCols - rightPinned; i < totalCols; i++) {
        pinnedRightWidth += parseWidth(getColumnWidth(allColumns.value[i]!.field))
      }

      const scrollLeft = el.scrollLeft
      const availableWidth = el.clientWidth - pinnedLeftWidth - pinnedRightWidth

      if (colLeft < scrollLeft) {
        el.scrollLeft = colLeft
      } else if (colRight > scrollLeft + availableWidth) {
        el.scrollLeft = colRight - availableWidth
      }
    }
  }

  // Watch active cell changes and auto-scroll
  watch(activeCell, (cell) => {
    if (!cell) return
    scrollCellIntoView(cell.rowIndex, colIndex(cell.field))
  })

  /**
   * Scroll an arbitrary cell into view (used by selection extension).
   */
  function scrollIntoView(rowIndex: number, field: string) {
    scrollCellIntoView(rowIndex, colIndex(field))
  }

  /**
   * Returns the active field for a given row index, or null.
   * Used in the template to efficiently check if a row contains the active cell.
   */
  function activeFieldForRow(rowIndex: number): string | null {
    if (activeCell.value?.rowIndex === rowIndex) {
      return activeCell.value.field
    }
    return null
  }

  return {
    activeCell,
    activeRowIndex,
    activeField,
    activate,
    deactivate,
    move,
    jumpToEdge,
    tab,
    enter,
    homeEnd,
    page,
    scrollIntoView,
    colIndex,
    activeFieldForRow,
    findNavigableRow,
    isNavigableRow,
  }
}

function parseWidth(w: string | undefined): number {
  if (!w) return 150
  return parseInt(w, 10) || 150
}
