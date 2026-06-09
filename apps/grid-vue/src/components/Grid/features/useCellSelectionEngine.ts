/**
 * Cell selection engine — Angular parity (moz-grid / `CellSelectionEngine`).
 *
 * Central authority for everything that lives under `focusedCell` /
 * `selectedCell` / `cellRange` / `isDragging` / `fillAnchor` / `fillTarget`.
 * Covers:
 *
 *   - Focus & clear
 *   - Range selection via mouse drag (`startRangeSelection` / `extendRange` / `endRangeSelection`)
 *   - Keyboard navigation (arrows, Home/End, PageUp/Down, Ctrl+Arrow jump-to-edge)
 *   - Shift-extending the current range (row/grid bounds, jump-to-edge, page)
 *   - Whole-row / column / grid selection
 *   - Fill-handle (Google Sheets style — 1D dominant axis, editable + type-compatible)
 *   - Tab-through-editables (`moveToNextEditableCell`)
 *
 * All row coordinates are **global display indices** (page offset included),
 * matching Angular. Column coordinates are indices into `visibleColumns`.
 *
 * The engine is intentionally stateless beyond the grid state: every method
 * reads/writes through `state`, and the return value of `getNormalizedRange`
 * is derived fresh on each call.
 */

import { shallowRef, computed, type ComputedRef, type ShallowRef } from 'vue'
import type { GridState } from '../state/useGridState'
import type { CellCoord, CellRange } from '../models/cell.model'
import type { RowData } from '../types'
import type { CellSelectionActions } from './useKeyboardEngine'

type Direction = 'up' | 'down' | 'left' | 'right'

export interface CellSelectionEngine extends CellSelectionActions {
  focusCell(row: number, col: number, source?: 'click' | 'keyboard'): void
  isCellFocused(row: number, col: number): boolean
  isCellInRange(row: number, col: number): boolean
  selectRange(start: CellCoord, end: CellCoord): void
  startRangeSelection(row: number, col: number): void
  extendRange(row: number, col: number): void
  /**
   * Shift+Click / Shift+Arrow — extend range from anchor to (row, col)
   * without requiring an active drag. The anchor is the `start` of the
   * current range (or the focused cell when no range exists yet).
   */
  extendRangeTo(row: number, col: number): void
  endRangeSelection(): void
  moveToNextEditableCell(): void
  startFill(row: number, col: number): void
  extendFill(row: number, col: number): void
  endFill(): { anchor: CellCoord; target: CellCoord } | null
  cancelFill(): void
  isCellInFillRange(row: number, col: number): boolean
  isCellInFillRejectRange(row: number, col: number): boolean
  getNormalizedRange(): CellRange | null

  // --- Multi-range (Ctrl+Click) — ported from legacy useCellSelection ---
  /** Frozen ranges added via Ctrl+Click. Local to the engine; no Angular pendant. */
  readonly frozenRanges: ShallowRef<CellRange[]>
  /** All ranges: frozen (Ctrl+Click) + the current live range. */
  readonly allRanges: ComputedRef<CellRange[]>
  /**
   * Freeze the current live range and start a new single-cell range at the
   * given coordinates. Accepts a `CellRange` so the caller constructs the
   * full `{start, end}` shape explicitly — this avoids confusing
   * row/col arguments with row/col params from the signature.
   */
  addRange(range: CellRange): void
  /** Clear all frozen ranges (Escape / new single click). */
  clearFrozenRanges(): void
}

export function useCellSelectionEngine<T = RowData>(
  state: GridState<T>,
): CellSelectionEngine {
  // --- Multi-range (Ctrl+Click) local state — no Angular pendant ---
  const frozenRanges = shallowRef<CellRange[]>([])

  /** The current live range derived from state.cellRange. */
  const currentLiveRange = computed<CellRange | null>(() => state.cellRange.value)

  /** All ranges: frozen (Ctrl+Click) + the current live single or shift-extended range. */
  const allRanges = computed<CellRange[]>(() => {
    const result = [...frozenRanges.value]
    if (currentLiveRange.value) result.push(currentLiveRange.value)
    return result
  })

  /** Freeze the current live range and start a new single-cell range at the
   *  given `range.start` coordinates. The `range.end` is honoured as-is so
   *  callers can pass a pre-built single-cell range or a full selection.
   */
  function addRange(range: CellRange): void {
    if (currentLiveRange.value) {
      frozenRanges.value = [...frozenRanges.value, currentLiveRange.value]
    }
    const { row, col } = range.start
    state.focusedCell.value = { row, col }
    state.selectedCell.value = { row, col }
    state.cellRange.value = range
    state.isDragging.value = false
  }

  /** Clear all frozen ranges. Called on single-click or Escape. */
  function clearFrozenRanges(): void {
    frozenRanges.value = []
  }

  function focusCell(row: number, col: number, source: 'click' | 'keyboard' = 'click'): void {
    // Idempotent guard — bail when already focused on the same cell with
    // no transient state to clean (no frozen ranges, no live range, not
    // dragging). Without this, `onActivateCell` (sync focusCell) followed
    // by `watch(activeCell)` (async focusCell) re-mutates `focusedCell`
    // with a new `{row, col}` object on every tick, looping the watcher
    // → "Maximum recursive updates exceeded" in <AdeoGrid>.
    const existing = state.focusedCell.value
    if (
      existing?.row === row &&
      existing?.col === col &&
      frozenRanges.value.length === 0 &&
      state.cellRange.value === null &&
      !state.isDragging.value
    ) {
      // Refresh source but skip the rest — no observable state change.
      state.focusSource.value = source
      return
    }
    // Clear Ctrl+Click frozen ranges — a new single-click focus starts a
    // fresh selection context. addRange() sets state fields directly and
    // does NOT call focusCell, so this reset is safe.
    frozenRanges.value = []
    state.focusSource.value = source
    state.focusedCell.value = { row, col }
    state.selectedCell.value = { row, col }
    state.cellRange.value = null
    state.isDragging.value = false
  }

  function clearFocus(): void {
    state.focusSource.value = null
    state.focusedCell.value = null
    state.selectedCell.value = null
    state.cellRange.value = null
    state.isDragging.value = false
  }

  function isCellFocused(row: number, col: number): boolean {
    const focused = state.focusedCell.value
    return focused?.row === row && focused?.col === col
  }

  function isCellInRange(row: number, col: number): boolean {
    const range = state.cellRange.value
    if (!range) return isCellFocused(row, col)
    const minRow = Math.min(range.start.row, range.end.row)
    const maxRow = Math.max(range.start.row, range.end.row)
    const minCol = Math.min(range.start.col, range.end.col)
    const maxCol = Math.max(range.start.col, range.end.col)
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
  }

  function selectRange(start: CellCoord, end: CellCoord): void {
    state.cellRange.value = { start, end }
    state.isDragging.value = false
  }

  function startRangeSelection(row: number, col: number): void {
    state.focusedCell.value = { row, col }
    state.cellRange.value = { start: { row, col }, end: { row, col } }
    state.isDragging.value = true
  }

  function extendRange(row: number, col: number): void {
    if (!state.isDragging.value) return
    const range = state.cellRange.value
    if (!range) return
    state.cellRange.value = { start: range.start, end: { row, col } }
  }

  /**
   * Shift+Click / Shift+Arrow — extend from anchor to (row, col) without
   * requiring isDragging. Used by AdeoGrid.vue to replace the legacy
   * `useCellSelection.extendTo()` call-sites.
   */
  function extendRangeTo(row: number, col: number): void {
    const range = state.cellRange.value
    const focused = state.focusedCell.value
    const anchor = range?.start ?? focused
    if (!anchor) return
    state.selectedCell.value = { row, col }
    state.cellRange.value = { start: anchor, end: { row, col } }
  }

  function endRangeSelection(): void {
    state.isDragging.value = false
  }

  function moveUp(): void {
    moveBy(-1, 0)
  }
  function moveDown(): void {
    moveBy(1, 0)
  }
  function moveLeft(): void {
    moveBy(0, -1)
  }
  function moveRight(): void {
    moveBy(0, 1)
  }

  function moveToRowStart(): void {
    const focused = state.focusedCell.value
    if (!focused) return
    focusCell(focused.row, 0, 'keyboard')
  }

  function moveToRowEnd(): void {
    const focused = state.focusedCell.value
    if (!focused) return
    const maxCol = state.visibleColumns.value.length - 1
    if (maxCol < 0) return
    focusCell(focused.row, findLastNonEmptyCol(focused.row, maxCol), 'keyboard')
  }

  function moveToGridStart(): void {
    const pageStart = state.pageIndex.value * state.pageSize.value
    focusCell(pageStart, 0, 'keyboard')
  }

  function moveToGridEnd(): void {
    const pageStart = state.pageIndex.value * state.pageSize.value
    const pageEnd = pageStart + Math.max(0, state.visibleRowCount.value - 1)
    const maxCol = state.visibleColumns.value.length - 1
    if (maxCol < 0) return
    focusCell(pageEnd, findLastNonEmptyCol(pageEnd, maxCol), 'keyboard')
  }

  function jumpToEdge(direction: Direction): void {
    const focused = state.focusedCell.value
    if (!focused) return
    const { dRow, dCol } = directionVector(direction)
    const bounds = pageBounds()
    const maxCol = state.visibleColumns.value.length - 1
    if (maxCol < 0) return

    const startFilled = isCellFilled(focused.row, focused.col)
    let row = focused.row
    let col = focused.col
    let nextRow = row + dRow
    let nextCol = col + dCol
    while (inBounds(nextRow, nextCol, bounds, maxCol)) {
      const filled = isCellFilled(nextRow, nextCol)
      if (startFilled) {
        if (!filled) break
        row = nextRow
        col = nextCol
      } else {
        if (filled) {
          row = nextRow
          col = nextCol
          break
        }
        row = nextRow
        col = nextCol
      }
      nextRow += dRow
      nextCol += dCol
    }

    focusCell(row, col, 'keyboard')
  }

  function movePage(direction: 'up' | 'down'): void {
    const focused = state.focusedCell.value
    if (!focused) return
    const step = pageRowStep() * (direction === 'down' ? 1 : -1)
    moveBy(step, 0)
  }

  function extendRangeBy(dRow: number, dCol: number): void {
    const focused = state.focusedCell.value
    if (!focused) return
    const range = state.cellRange.value
    const bounds = pageBounds()
    const maxCol = state.visibleColumns.value.length - 1
    if (maxCol < 0) return

    const currentEnd = range ? range.end : focused
    const newEnd = {
      row: Math.max(bounds.start, Math.min(bounds.end, currentEnd.row + dRow)),
      col: Math.max(0, Math.min(maxCol, currentEnd.col + dCol)),
    }
    const start = range ? range.start : focused
    state.cellRange.value = { start, end: newEnd }
  }

  function extendRangeToRowStart(): void {
    const focused = state.focusedCell.value
    if (!focused) return
    const range = state.cellRange.value
    const start = range?.start ?? focused
    state.cellRange.value = {
      start,
      end: { row: (range?.end ?? focused).row, col: 0 },
    }
  }

  function extendRangeToRowEnd(): void {
    const focused = state.focusedCell.value
    if (!focused) return
    const maxCol = state.visibleColumns.value.length - 1
    if (maxCol < 0) return
    const range = state.cellRange.value
    const start = range?.start ?? focused
    state.cellRange.value = {
      start,
      end: { row: (range?.end ?? focused).row, col: maxCol },
    }
  }

  function extendRangeToGridStart(): void {
    const focused = state.focusedCell.value
    if (!focused) return
    const bounds = pageBounds()
    const range = state.cellRange.value
    const start = range?.start ?? focused
    state.cellRange.value = { start, end: { row: bounds.start, col: 0 } }
  }

  function extendRangeToGridEnd(): void {
    const focused = state.focusedCell.value
    if (!focused) return
    const bounds = pageBounds()
    const maxCol = state.visibleColumns.value.length - 1
    if (maxCol < 0) return
    const range = state.cellRange.value
    const start = range?.start ?? focused
    state.cellRange.value = { start, end: { row: bounds.end, col: maxCol } }
  }

  function extendRangeJumpToEdge(direction: Direction): void {
    const focused = state.focusedCell.value
    if (!focused) return
    const range = state.cellRange.value
    const anchor = range?.start ?? focused
    const end = range?.end ?? focused
    const target = edgeFromCell(end, direction)
    state.cellRange.value = { start: anchor, end: target }
  }

  function extendRangeByPage(direction: 'up' | 'down'): void {
    const step = pageRowStep() * (direction === 'down' ? 1 : -1)
    extendRangeBy(step, 0)
  }

  function selectRow(row: number): void {
    const maxCol = state.visibleColumns.value.length - 1
    if (maxCol < 0) return
    state.focusedCell.value = { row, col: 0 }
    state.focusSource.value = 'keyboard'
    state.cellRange.value = {
      start: { row, col: 0 },
      end: { row, col: maxCol },
    }
  }

  function selectColumn(col: number): void {
    const bounds = pageBounds()
    state.focusedCell.value = { row: bounds.start, col }
    state.focusSource.value = 'keyboard'
    state.cellRange.value = {
      start: { row: bounds.start, col },
      end: { row: bounds.end, col },
    }
  }

  function selectAll(): void {
    const bounds = pageBounds()
    const maxCol = state.visibleColumns.value.length - 1
    if (maxCol < 0) return
    state.focusedCell.value = { row: bounds.start, col: 0 }
    state.focusSource.value = 'keyboard'
    state.cellRange.value = {
      start: { row: bounds.start, col: 0 },
      end: { row: bounds.end, col: maxCol },
    }
  }

  function moveToNextEditableCell(): void {
    const focused = state.focusedCell.value
    if (!focused) return
    const cols = state.visibleColumns.value
    const data = state.sourceData.value
    let col = focused.col + 1
    let row = focused.row

    while (row < data.length) {
      if (col >= cols.length) {
        col = 0
        row++
      }
      if (row >= data.length) break

      const def = state.columnDefMap.value.get(cols[col]?.field ?? '')
      if (def?.editable) {
        focusCell(row, col)
        return
      }
      col++
    }
  }

  // --- Fill handle ------------------------------------------------------------

  function startFill(row: number, col: number): void {
    state.fillAnchor.value = { row, col }
    state.fillTarget.value = { row, col }
    state.isFilling.value = true
  }

  function extendFill(row: number, col: number): void {
    if (!state.isFilling.value) return
    const anchor = state.fillAnchor.value
    if (!anchor) return
    const dRow = Math.abs(row - anchor.row)
    const dCol = Math.abs(col - anchor.col)
    if (dRow >= dCol) {
      state.fillTarget.value = { row, col: anchor.col }
    } else {
      state.fillTarget.value = { row: anchor.row, col }
    }
  }

  function endFill(): { anchor: CellCoord; target: CellCoord } | null {
    if (!state.isFilling.value) return null
    const anchor = state.fillAnchor.value
    const target = state.fillTarget.value
    state.isFilling.value = false
    state.fillAnchor.value = null
    state.fillTarget.value = null
    if (!anchor || !target) return null
    if (anchor.row === target.row && anchor.col === target.col) return null
    return { anchor, target }
  }

  function cancelFill(): void {
    state.isFilling.value = false
    state.fillAnchor.value = null
    state.fillTarget.value = null
  }

  function isCellInFillRange(row: number, col: number): boolean {
    const anchor = state.fillAnchor.value
    const target = state.fillTarget.value
    if (!anchor || !target) return false
    if (row === anchor.row && col === anchor.col) return false

    const vertical = target.col === anchor.col
    if (vertical) {
      if (col !== anchor.col) return false
      const minRow = Math.min(anchor.row, target.row)
      const maxRow = Math.max(anchor.row, target.row)
      return row >= minRow && row <= maxRow
    }

    if (row !== anchor.row) return false
    const minCol = Math.min(anchor.col, target.col)
    const maxCol = Math.max(anchor.col, target.col)
    if (col < minCol || col > maxCol) return false
    return isColEditable(col) && isColTypeCompatible(anchor.col, col)
  }

  function isCellInFillRejectRange(row: number, col: number): boolean {
    const anchor = state.fillAnchor.value
    const target = state.fillTarget.value
    if (!anchor || !target) return false
    if (anchor.row === target.row && anchor.col === target.col) return false

    const vertical = target.col === anchor.col
    if (vertical) return false

    if (row !== anchor.row) return false
    const minCol = Math.min(anchor.col, target.col)
    const maxCol = Math.max(anchor.col, target.col)
    if (col < minCol || col > maxCol) return false
    return !isColEditable(col) || !isColTypeCompatible(anchor.col, col)
  }

  function getNormalizedRange(): CellRange | null {
    const range = state.cellRange.value
    if (!range) {
      const focused = state.focusedCell.value
      if (!focused) return null
      return { start: focused, end: focused }
    }
    return {
      start: {
        row: Math.min(range.start.row, range.end.row),
        col: Math.min(range.start.col, range.end.col),
      },
      end: {
        row: Math.max(range.start.row, range.end.row),
        col: Math.max(range.start.col, range.end.col),
      },
    }
  }

  // --- Helpers ----------------------------------------------------------------

  function pageBounds(): { start: number; end: number } {
    const start = state.pageIndex.value * state.pageSize.value
    const end = start + Math.max(0, state.visibleRowCount.value - 1)
    return { start, end }
  }

  function pageRowStep(): number {
    const rowHeight = state.rowHeight.value || 48
    const viewportHeight = state.scrollViewportHeight.value
    if (viewportHeight > 0) {
      return Math.max(1, Math.floor(viewportHeight / rowHeight))
    }
    return Math.max(1, Math.floor(state.visibleRowCount.value / 2) || 10)
  }

  function directionVector(dir: Direction): { dRow: number; dCol: number } {
    switch (dir) {
      case 'up':
        return { dRow: -1, dCol: 0 }
      case 'down':
        return { dRow: 1, dCol: 0 }
      case 'left':
        return { dRow: 0, dCol: -1 }
      case 'right':
        return { dRow: 0, dCol: 1 }
    }
  }

  function inBounds(
    row: number,
    col: number,
    bounds: { start: number; end: number },
    maxCol: number,
  ): boolean {
    return row >= bounds.start && row <= bounds.end && col >= 0 && col <= maxCol
  }

  function isCellFilled(row: number, col: number): boolean {
    const cols = state.visibleColumns.value
    const field = cols[col]?.field
    if (!field) return false
    const rowData = state.sourceData.value[row]
    if (!rowData) return false
    const def = state.columnDefMap.value.get(field)
    const value = def?.valueGetter
      ? def.valueGetter(rowData)
      : (rowData as Record<string, unknown>)[field]
    return value !== null && value !== undefined && value !== ''
  }

  function findLastNonEmptyCol(row: number, maxCol: number): number {
    for (let c = maxCol; c >= 0; c--) {
      if (isCellFilled(row, c)) return c
    }
    return maxCol
  }

  function edgeFromCell(from: CellCoord, direction: Direction): CellCoord {
    const { dRow, dCol } = directionVector(direction)
    const bounds = pageBounds()
    const maxCol = state.visibleColumns.value.length - 1
    if (maxCol < 0) return from

    const startFilled = isCellFilled(from.row, from.col)
    let row = from.row
    let col = from.col
    let nextRow = row + dRow
    let nextCol = col + dCol
    while (inBounds(nextRow, nextCol, bounds, maxCol)) {
      const filled = isCellFilled(nextRow, nextCol)
      if (startFilled) {
        if (!filled) break
      } else if (filled) {
        row = nextRow
        col = nextCol
        break
      }
      row = nextRow
      col = nextCol
      nextRow += dRow
      nextCol += dCol
    }
    return { row, col }
  }

  function isColEditable(colIndex: number): boolean {
    const cols = state.visibleColumns.value
    const colEntry = cols[colIndex]
    if (!colEntry) return false
    const def = state.columnDefMap.value.get(colEntry.field)
    return def?.editable === true
  }

  function getColEditorType(colIndex: number): string {
    const cols = state.visibleColumns.value
    const colEntry = cols[colIndex]
    if (!colEntry) return 'text'
    const def = state.columnDefMap.value.get(colEntry.field)
    return def?.cellEditor ?? 'text'
  }

  function isColTypeCompatible(sourceCol: number, targetCol: number): boolean {
    return getColEditorType(sourceCol) === getColEditorType(targetCol)
  }

  function moveBy(dRow: number, dCol: number): void {
    const focused = state.focusedCell.value
    if (!focused) return

    const pageStart = state.pageIndex.value * state.pageSize.value
    const pageEnd = pageStart + Math.max(0, state.visibleRowCount.value - 1)
    const maxCol = state.visibleColumns.value.length - 1
    const newRow = Math.max(pageStart, Math.min(pageEnd, focused.row + dRow))
    const newCol = Math.max(0, Math.min(maxCol, focused.col + dCol))

    focusCell(newRow, newCol, 'keyboard')
  }

  return {
    focusCell,
    clearFocus,
    isCellFocused,
    isCellInRange,
    selectRange,
    startRangeSelection,
    extendRange,
    extendRangeTo,
    endRangeSelection,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    moveToRowStart,
    moveToRowEnd,
    moveToGridStart,
    moveToGridEnd,
    jumpToEdge,
    movePage,
    extendRangeBy,
    extendRangeToRowStart,
    extendRangeToRowEnd,
    extendRangeToGridStart,
    extendRangeToGridEnd,
    extendRangeJumpToEdge,
    extendRangeByPage,
    selectRow,
    selectColumn,
    selectAll,
    moveToNextEditableCell,
    startFill,
    extendFill,
    endFill,
    cancelFill,
    isCellInFillRange,
    isCellInFillRejectRange,
    getNormalizedRange,
    // Multi-range
    frozenRanges,
    allRanges,
    addRange,
    clearFrozenRanges,
  }
}
