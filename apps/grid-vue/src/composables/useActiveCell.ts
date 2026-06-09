import { computed, isRef, watch, type Ref, type WritableComputedRef } from 'vue'
import type { CellPosition, ColumnDef, RowData } from '@/components/AdeoGrid/types'
import { isGroupRow } from '@/components/AdeoGrid/types'
import type { GridState } from '@/components/AdeoGrid/state/useGridState'

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
  /**
   * Optional set of row indices that are expanded (detail panel deployed).
   * When provided alongside `expandedRowExtraHeight`, `scrollCellIntoView`
   * accounts for the extra space each prior expanded row consumes — without
   * it, the formula `rowIndex * rowHeight` understates `cellTop` and the
   * grid scrolls back up when activating a cell below an expanded row.
   */
  expandedRowIndices?: Ref<ReadonlySet<number>>
  /**
   * Extra height (px) added by a single expanded row's detail panel. Read
   * together with `expandedRowIndices` to compute the actual cellTop in
   * `scrollCellIntoView`.
   */
  expandedRowExtraHeight?: Ref<number> | number
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
    return !!r && !isGroupRow(r) && !r.__adgSkeleton
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

  /**
   * Cumulative px height of every row strictly BEFORE `rowIndex`, including
   * the extra height contributed by any expanded detail panels in that
   * range. Without the expansion correction, `scrollCellIntoView` would
   * treat row N's top as `N * rowHeight` — way too high if rows < N have
   * expanded details — and would scroll the container back up when the
   * user activates a cell below an expanded row.
   */
  function topOfRow(rowIndex: number): number {
    const baseTop = rowIndex * rowHeight.value
    const expandedSet = options.expandedRowIndices?.value
    if (!expandedSet || expandedSet.size === 0) return baseTop
    const extra = isRef(options.expandedRowExtraHeight)
      ? options.expandedRowExtraHeight.value
      : (options.expandedRowExtraHeight ?? 0)
    if (extra <= 0) return baseTop
    let expandedBefore = 0
    for (const idx of expandedSet) {
      if (idx < rowIndex) expandedBefore++
    }
    return baseTop + expandedBefore * extra
  }

  function scrollCellIntoView(rowIndex: number, cIdx: number) {
    const el = wrapperRef.value
    if (!el) return

    // Vertical scroll — `cellTop` is the row's position in the SIZER,
    // accounting for any expanded detail rows that sit above it.
    const cellTop = topOfRow(rowIndex)
    const cellBottom = cellTop + rowHeight.value
    const viewTop = el.scrollTop
    const viewBottom = viewTop + el.clientHeight

    // Sticky chunk height at the top of the scroll container — the grid
    // wraps the header + (optional) filter row in a single
    // `.adeo-grid-grid-sticky-header` block that sits sticky-top inside the
    // scroll viewport. Without subtracting its height from the visible
    // body region, the comfort math thinks rows behind the chunk are
    // "visible" when they're actually occluded.
    const stickyTop =
      el.querySelector<HTMLElement>('.adeo-grid-grid-sticky-header')?.offsetHeight ??
      0

    // Trigger vs. target — the comfort margin only pads the scroll
    // TARGET. The trigger fires strictly when the cell is OUTSIDE the
    // visible row area; otherwise pressing Up from a middle row would
    // shift the viewport even though the previous row is right there
    // on screen.
    //
    // Coordinate frame — the sticky header chunk lives INSIDE the
    // wrapper, at `position: sticky; top: 0`. The body sizer is the
    // sibling block where the rows render in normal flow. Crucially
    // `cellTop = topOfRow(rowIndex)` is the row's offset INSIDE the
    // sizer (so the first row has cellTop = 0), and the wrapper's
    // `scrollTop` is the offset BETWEEN the sizer's origin and the
    // wrapper viewport's top.
    //
    // A row's visible wrapper-y is `stickyTop + cellTop − scrollTop`.
    // For the row to sit BELOW the sticky chunk we need
    // `wrapper-y ≥ stickyTop` ⇔ `cellTop ≥ scrollTop`. The previously
    // used `cellTop < scrollTop + stickyTop` double-counted the
    // sticky offset and triggered on rows that were perfectly
    // visible.
    //
    // Visible sizer range:
    //   top    = scrollTop                                  (just below sticky)
    //   bottom = scrollTop + clientHeight − stickyTop        (wrapper bottom)
    //
    // Targets keep the margin so the cell lands with one row of
    // breathing space on the relevant side after the scroll lands.
    const margin = rowHeight.value
    const visibleTop = viewTop
    const visibleBottom = viewTop + el.clientHeight - stickyTop

    if (cellTop < visibleTop) {
      el.scrollTop = Math.max(0, cellTop - margin)
    } else if (cellBottom > visibleBottom) {
      el.scrollTop = cellBottom + margin - el.clientHeight + stickyTop
    }

    // Horizontal scroll — only for non-pinned (center) columns. Pinned
    // columns stay visible on the sticky edges regardless of scroll.
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

      // Horizontal comfort margin — same trigger-vs-target split as
      // the vertical branch. The margin must only pad the scroll
      // TARGET, not the trigger: otherwise clicking the first or last
      // visible center column shifts the viewport horizontally for
      // breathing room the user didn't ask for. We use the focused
      // column's own width (clamped to 120 px) as the margin so the
      // amount of slack scales naturally with the dataset's typography.
      const hMargin = Math.min(colW, 120)

      // Visible center range in scroll-content coords:
      // `(scrollLeft, scrollLeft + availableWidth)`. Trigger only when
      // the cell strictly straddles or crosses one of the bounds.
      if (colLeft < scrollLeft) {
        el.scrollLeft = Math.max(0, colLeft - hMargin)
      } else if (colRight > scrollLeft + availableWidth) {
        el.scrollLeft = colRight + hMargin - availableWidth
      }
    }
  }

  // Watch active cell changes and auto-scroll.
  //
  // `activeCell` is a computed whose getter returns `{ rowIndex, field }` —
  // a fresh object literal on every evaluation. Vue's `watch` compares
  // values with `Object.is`, which always fails for new literals, so the
  // handler would fire on every re-evaluation of the computed — even when
  // the cell hasn't actually moved. That bites during column resize: the
  // drag bumps `colPositions`, which transitively invalidates the
  // computed; the watcher fires and `scrollCellIntoView` yanks the
  // viewport back to the focused cell mid-drag (visible as a jarring
  // horizontal "snap" the moment you grab a resize handle while a cell
  // off-screen is still active).
  //
  // We dedupe with a string key (`rowIndex:field`). Identity changes that
  // don't move the focused cell are silently swallowed; real moves still
  // call `scrollCellIntoView` exactly once.
  let _lastScrollKey: string | null = null
  watch(activeCell, (cell) => {
    if (!cell) {
      _lastScrollKey = null
      return
    }
    const key = `${cell.rowIndex}:${cell.field}`
    if (key === _lastScrollKey) return
    _lastScrollKey = key
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
