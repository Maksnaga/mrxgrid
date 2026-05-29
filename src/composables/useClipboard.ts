import type { Ref } from 'vue'
import type { ColumnDef, RowData, SelectionRange } from '@/components/MrxGrid/types'
import type { GridState } from '@/components/MrxGrid/state/useGridState'

export interface ClipboardOptions {
  /** Central grid state — owns `cutSource` for the marching-ants outline. */
  gridState: GridState<RowData>
  allColumns: Ref<ColumnDef[]>
  rows: Ref<RowData[]>
  /** All current selection ranges. */
  allRanges: Ref<SelectionRange[]>
  /** Active cell row/col (for paste target). */
  activeRow: Ref<number>
  activeCol: Ref<number>
  totalRows: Ref<number>
  totalCols: Ref<number>
  /** Called for each cell to check if its column is editable. */
  isEditable: (field: string) => boolean
  /** Called when paste writes values into cells. */
  onPaste: (fills: Array<{ rowIndex: number; field: string; value: unknown }>) => void
  /** Called when cut/delete clears selected cells. */
  onClear: (fills: Array<{ rowIndex: number; field: string; value: unknown }>) => void
}

/**
 * Clipboard support for the grid: Copy (Ctrl+C), Cut (Ctrl+X), Paste (Ctrl+V).
 *
 * ## Format
 *
 * Clipboard data uses TSV (tab-separated values):
 * - Columns separated by \t
 * - Rows separated by \n
 *
 * This is the same format Excel, Google Sheets, and AG Grid use, enabling
 * cross-application copy/paste.
 *
 * ## Paste behavior
 *
 * - **No selection (single active cell):** paste starting from the active cell,
 *   one clipboard cell per grid cell.
 * - **Selection exists:** tile (repeat) the clipboard data to fill the entire
 *   selection. Example: copy 1 cell, select 10 cells, paste → all 10 get the value.
 *
 * ## Validation
 *
 * Each column may define a `valueValidator` in its `ColumnDef`. Before writing
 * a value, the validator is called. If it returns `false`, that cell is skipped.
 * This prevents pasting free text into constrained columns (e.g. combobox).
 */
export function useClipboard(options: ClipboardOptions) {
  const {
    gridState,
    allColumns,
    rows,
    allRanges,
    activeRow,
    activeCol,
    totalRows,
    totalCols,
    isEditable,
    onPaste,
    onClear,
  } = options

  // --- Helpers ---

  function getCol(idx: number): ColumnDef | undefined {
    return allColumns.value[idx]
  }

  /**
   * Check if a value is accepted by a column's validator.
   * Returns true if no validator is defined or the validator accepts.
   */
  function isValueValid(col: ColumnDef, value: unknown): boolean {
    if (!col.valueValidator) return true
    return col.valueValidator(value)
  }

  /**
   * Build TSV string from all selected ranges.
   * When multiple disjoint ranges exist, we use the bounding box
   * (same behavior as Excel).
   *
   * Reads via `col.valueGetter(row)` when defined (synthetic / derived
   * fields), otherwise falls back to `row[field]`. Without this routing,
   * copy on a valueGetter column would produce an empty TSV and paste
   * would silently do nothing — same root cause as the render / edit bugs.
   */
  function readCellValue(col: ColumnDef, row: RowData): unknown {
    return col.valueGetter ? col.valueGetter(row) : row[col.field]
  }

  function buildTsv(): string {
    const ranges = allRanges.value
    if (ranges.length === 0) {
      // Single active cell, no selection range
      if (activeRow.value < 0) return ''
      const col = getCol(activeCol.value)
      const row = rows.value[activeRow.value]
      if (!col || !row) return ''
      const v = readCellValue(col, row)
      return v == null ? '' : String(v)
    }

    // Compute bounding box of all ranges
    let minR = Infinity
    let maxR = -1
    let minC = Infinity
    let maxC = -1
    for (const r of ranges) {
      if (r.r1 < minR) minR = r.r1
      if (r.r2 > maxR) maxR = r.r2
      if (r.c1 < minC) minC = r.c1
      if (r.c2 > maxC) maxC = r.c2
    }

    const cols = allColumns.value
    const lines: string[] = []

    for (let r = minR; r <= maxR; r++) {
      const row = rows.value[r]
      const cells: string[] = []
      for (let c = minC; c <= maxC; c++) {
        const col = cols[c]
        if (!row || !col) {
          cells.push('')
          continue
        }
        const v = readCellValue(col, row)
        cells.push(v == null ? '' : String(v))
      }
      lines.push(cells.join('\t'))
    }

    return lines.join('\n')
  }

  function parseTsv(text: string): string[][] {
    if (!text) return []
    return text.split('\n').map((line) => line.split('\t'))
  }

  async function copy(): Promise<boolean> {
    const tsv = buildTsv()
    if (!tsv) return false
    try {
      await navigator.clipboard.writeText(tsv)
      return true
    } catch {
      return false
    }
  }

  function collectClearFills(): Array<{ rowIndex: number; field: string; value: unknown }> {
    const ranges = allRanges.value
    const cols = allColumns.value
    const fills: Array<{ rowIndex: number; field: string; value: unknown }> = []

    if (ranges.length === 0 && activeRow.value >= 0) {
      const col = cols[activeCol.value]
      if (col && isEditable(col.field) && isValueValid(col, '')) {
        fills.push({ rowIndex: activeRow.value, field: col.field, value: '' })
      }
      return fills
    }

    for (const range of ranges) {
      for (let r = range.r1; r <= range.r2; r++) {
        for (let c = range.c1; c <= range.c2; c++) {
          const col = cols[c]
          if (!col || !isEditable(col.field)) continue
          if (!isValueValid(col, '')) continue
          fills.push({ rowIndex: r, field: col.field, value: '' })
        }
      }
    }

    return fills
  }

  /**
   * Excel-style cut: copies the selection to the clipboard and marks the
   * source range with `gridState.cutSource` for the marching-ants outline.
   * The actual data clear is **deferred** until the next `paste()` (move
   * semantics) or until `cancelCut()` is called (Esc).
   */
  async function cut(): Promise<boolean> {
    const copied = await copy()
    if (!copied) return false
    const range = sourceRangeForCut()
    if (range) {
      gridState.cutSource.value = {
        start: { row: range.r1, col: range.c1 },
        end: { row: range.r2, col: range.c2 },
      }
    }
    return true
  }

  /** Cancel a pending cut (Esc / new selection). */
  function cancelCut(): void {
    gridState.cutSource.value = null
  }

  function sourceRangeForCut(): SelectionRange | null {
    const ranges = allRanges.value
    if (ranges.length > 0) return boundingBox(ranges)
    if (activeRow.value < 0 || activeCol.value < 0) return null
    return { r1: activeRow.value, c1: activeCol.value, r2: activeRow.value, c2: activeCol.value }
  }

  function collectCutSourceClearFills(): Array<{ rowIndex: number; field: string; value: unknown }> {
    const src = gridState.cutSource.value
    if (!src) return []
    const cols = allColumns.value
    const fills: Array<{ rowIndex: number; field: string; value: unknown }> = []
    for (let r = src.start.row; r <= src.end.row; r++) {
      for (let c = src.start.col; c <= src.end.col; c++) {
        const col = cols[c]
        if (!col || !isEditable(col.field)) continue
        if (!isValueValid(col, '')) continue
        fills.push({ rowIndex: r, field: col.field, value: '' })
      }
    }
    return fills
  }

  function clearSelection(): boolean {
    const fills = collectClearFills()
    if (fills.length === 0) return false
    onClear(fills)
    return true
  }

  /**
   * Paste clipboard data into the grid.
   *
   * ## Target logic
   *
   * 1. If a multi-cell selection exists, the clipboard data is tiled
   *    (repeated cyclically) to fill the entire selection rectangle.
   *    Example: copy 1 cell → select 5×3 range → paste fills all 15 cells.
   *
   * 2. If only a single active cell (no selection), paste starting from
   *    that cell with the clipboard's natural dimensions.
   *
   * ## Validation
   *
   * Each target cell is checked against the column's `valueValidator`.
   * Cells that fail validation are silently skipped (not pasted into).
   */
  async function paste(): Promise<SelectionRange | null> {
    if (activeRow.value < 0 || activeCol.value < 0) return null

    let text: string
    try {
      text = await navigator.clipboard.readText()
    } catch {
      return null
    }

    const grid = parseTsv(text)
    if (grid.length === 0) return null

    // Excel-style move semantics: when a cutSource is pending, clear it
    // before applying the paste, then drop the marching-ants outline.
    const cutFills = collectCutSourceClearFills()
    if (cutFills.length > 0) onClear(cutFills)
    if (gridState.cutSource.value) gridState.cutSource.value = null

    const cols = allColumns.value
    const clipRows = grid.length
    const clipCols = Math.max(...grid.map((r) => r.length))
    const fills: Array<{ rowIndex: number; field: string; value: unknown }> = []

    const ranges = allRanges.value
    const hasSelection = ranges.some((r) => r.r1 !== r.r2 || r.c1 !== r.c2)

    if (hasSelection) {
      // Paste into the selection, tiling the clipboard data cyclically
      const bbox = boundingBox(ranges)

      for (let r = bbox.r1; r <= bbox.r2; r++) {
        if (r >= totalRows.value) break
        for (let c = bbox.c1; c <= bbox.c2; c++) {
          if (c >= totalCols.value) break

          // Only paste into cells that are within at least one selection range
          if (!isInRanges(r, c, ranges)) continue

          const col = cols[c]
          if (!col || !isEditable(col.field)) continue

          // Tile: wrap clipboard indices
          const clipR = (r - bbox.r1) % clipRows
          const clipC = (c - bbox.c1) % clipCols
          const value = grid[clipR]?.[clipC] ?? ''

          if (!isValueValid(col, value)) continue

          fills.push({ rowIndex: r, field: col.field, value })
        }
      }
    } else {
      // No multi-cell selection: paste from active cell
      const startR = activeRow.value
      const startC = activeCol.value

      for (let dr = 0; dr < clipRows; dr++) {
        const r = startR + dr
        if (r >= totalRows.value) break

        const row = grid[dr]
        if (!row) continue

        for (let dc = 0; dc < clipCols; dc++) {
          const c = startC + dc
          if (c >= totalCols.value) break

          const col = cols[c]
          if (!col || !isEditable(col.field)) continue

          const value = row[dc] ?? ''
          if (!isValueValid(col, value)) continue

          fills.push({ rowIndex: r, field: col.field, value })
        }
      }
    }

    if (fills.length > 0) {
      onPaste(fills)
    }

    if (hasSelection) {
      return boundingBox(ranges)
    }

    return {
      r1: activeRow.value,
      c1: activeCol.value,
      r2: Math.min(activeRow.value + clipRows - 1, totalRows.value - 1),
      c2: Math.min(activeCol.value + clipCols - 1, totalCols.value - 1),
    }
  }

  return {
    copy,
    cut,
    cancelCut,
    paste,
    clearSelection,
  }
}

// --- Utility ---

function boundingBox(ranges: SelectionRange[]): SelectionRange {
  let r1 = Infinity
  let c1 = Infinity
  let r2 = -1
  let c2 = -1
  for (const r of ranges) {
    if (r.r1 < r1) r1 = r.r1
    if (r.c1 < c1) c1 = r.c1
    if (r.r2 > r2) r2 = r.r2
    if (r.c2 > c2) c2 = r.c2
  }
  return { r1, c1, r2, c2 }
}

function isInRanges(row: number, col: number, ranges: SelectionRange[]): boolean {
  for (const r of ranges) {
    if (row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2) return true
  }
  return false
}
