/**
 * Clipboard engine — Angular parity (moz-grid / `ClipboardEngine`).
 *
 * Handles every cell-level mutation triggered by clipboard-ish actions:
 * copy extraction (TSV), cut outline (marching-ants), paste, fill-down,
 * fill-right, fill-selection, clear-range — plus the undo/redo helper
 * `applyChanges` used by the history engine.
 *
 * Depends on `displayIndexToSourceIndex` rather than on `GridEngine` directly
 * so it can be instantiated before `useGridEngine` returns (the grid engine
 * wires the resolver in once both are constructed).
 */

import { computed, type ComputedRef } from 'vue'
import type { GridState } from '../state/useGridState'
import type { CellRange } from '../models/cell.model'
import type { RowData } from '../types'
import { shiftFormulaRefs } from './formula/formula-shift'

export const PASTE_SKIP: unique symbol = Symbol('PASTE_SKIP')

/**
 * If `value` is a formula string (`=...`) and `allowFormula` is true, shifts
 * all relative cell references inside the formula by `rowDelta` rows and
 * `colDelta` columns using the formula-shift module.
 * Otherwise returns `value` unchanged.
 *
 * Used by `fillDown` (rowDelta = target row − source row) and `fillRight`
 * (colDelta = target col − source col) so formulas stay relative to their
 * fill position, matching Angular clipboard.engine.ts fill behavior.
 */
function shiftIfFormula(
  value: unknown,
  allowFormula: boolean,
  rowDelta: number,
  colDelta: number,
  fieldOrder: readonly string[],
): unknown {
  if (!allowFormula) return value
  if (typeof value !== 'string' || !value.startsWith('=')) return value
  // Strip the leading '=' before shifting, then re-add it.
  const body = value.slice(1)
  const shifted = shiftFormulaRefs(body, { rowDelta, colDelta, fieldOrder })
  return `=${shifted}`
}

export interface HistoryCellChange {
  rowIndex: number
  field: string
  before: unknown
  after: unknown
}

export interface CutEdges {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
  any: boolean
}

export interface ClipboardEngine<T = RowData> {
  readonly cutRange: ComputedRef<CellRange | null>
  markCut(range: CellRange): void
  clearCut(): void
  fillDown(range: CellRange): HistoryCellChange[]
  fillRight(range: CellRange): HistoryCellChange[]
  fillSelection(range: CellRange, value: unknown): HistoryCellChange[]
  clearRange(range: CellRange): HistoryCellChange[]
  applyPaste(range: CellRange, pasteRows: string[][]): HistoryCellChange[]
  applyChanges(changes: HistoryCellChange[], direction: 'before' | 'after'): void
  coerceAndValidate(field: string, rawValue: unknown, row: T): unknown
  extractTsv(range: CellRange): string[][]
  /** B19: parses a TSV line string into cells, respecting RFC-4180 quoting. */
  parseTsvRow(line: string): string[]
  cutEdges(row: number, col: number): CutEdges
}

export function useClipboardEngine<T = RowData>(
  state: GridState<T>,
  displayIndexToSourceIndex: (displayIndex: number) => number,
): ClipboardEngine<T> {
  const cutRange = computed<CellRange | null>(() => state.cutSource.value)

  function resolveRangeSourceIndices(range: CellRange): number[] {
    const out: number[] = []
    for (let r = range.start.row; r <= range.end.row; r++) {
      const srcIdx = displayIndexToSourceIndex(r)
      if (srcIdx >= 0) out.push(srcIdx)
    }
    return out
  }

  function markCut(range: CellRange): void {
    state.cutSource.value = range
  }

  function clearCut(): void {
    state.cutSource.value = null
  }

  // ── B21 — Series detection for fill handle ─────────────────────────────

  interface NumberSeries { type: 'number'; step: number; base: number }
  interface DateSeries   { type: 'date';   step: number; base: number }
  type Series = NumberSeries | DateSeries

  function detectSeries(sourceValues: unknown[]): Series | null {
    if (sourceValues.length < 2) return null

    // Numeric arithmetic progression
    const allNumbers = sourceValues.every((v) => typeof v === 'number' && isFinite(v as number))
    if (allNumbers) {
      const nums = sourceValues as number[]
      const step = nums[1]! - nums[0]!
      const isArithmetic = nums.every((v, i) => i === 0 || Math.abs(v - nums[i - 1]! - step) < 1e-9)
      if (isArithmetic) return { type: 'number', step, base: nums[nums.length - 1]! }
    }

    // Date progression (values as Date objects or ISO strings parseable to timestamps)
    const parsedDates = sourceValues.map((v) => {
      if (v instanceof Date) return v.getTime()
      if (typeof v === 'string') {
        const t = Date.parse(v)
        return isNaN(t) ? null : t
      }
      return null
    })
    if (parsedDates.every((t) => t !== null)) {
      const timestamps = parsedDates as number[]
      const step = timestamps[1]! - timestamps[0]!
      const isArithmetic = timestamps.every(
        (t, i) => i === 0 || Math.abs(t - timestamps[i - 1]! - step) < 1,
      )
      if (isArithmetic) {
        return { type: 'date', step, base: timestamps[timestamps.length - 1]! }
      }
    }

    return null
  }

  function projectSeries(series: Series, offset: number): unknown {
    if (series.type === 'number') return series.base + series.step * offset
    // Date — return ISO string (same format as typical date cell values)
    return new Date(series.base + series.step * offset).toISOString().slice(0, 10)
  }

  // ── fill operations ──────────────────────────────────────────────────────

  function fillDown(range: CellRange): HistoryCellChange[] {
    if (range.start.row === range.end.row) return []
    const cols = state.visibleColumns.value
    const defMap = state.columnDefMap.value
    const changes: HistoryCellChange[] = []
    const sourceIndices = resolveRangeSourceIndices(range)
    if (sourceIndices.length < 2) return []
    const [sourceIdx, ...targetIndices] = sourceIndices
    if (sourceIdx === undefined) return []

    const data = state.sourceData.value
    const updated = [...data]
    const sourceRow = updated[sourceIdx]
    if (!sourceRow) return []

    // Field order for formula ref shifting (column index space).
    const fieldOrder = cols.map((c) => c.field)

    // B21 — Pre-compute per-column series.
    // "Source" values are the first N-1 rows of the selection (everything
    // except the last target row). For a standard single-row fill the source
    // slice is just [sourceIdx], which yields null from detectSeries (needs
    // ≥ 2 values) — correct fall-through to plain copy.
    const seriesMap = new Map<string, Series | null>()
    for (let c = range.start.col; c <= range.end.col; c++) {
      const field = cols[c]?.field
      if (!field) continue
      const def = defMap.get(field)
      if (!def?.editable) continue
      // All rows that are NOT the last target provide the "known" series values.
      const seriesSourceIndices = [sourceIdx, ...targetIndices.slice(0, -1)]
      const sourceVals = seriesSourceIndices
        .map((idx) => {
          const r = updated[idx]
          if (!r) return undefined
          return def.valueGetter ? def.valueGetter(r) : (r as Record<string, unknown>)[field]
        })
        .filter((v) => v !== undefined)
      seriesMap.set(field, detectSeries(sourceVals))
    }

    let rowDelta = 0
    for (const targetIdx of targetIndices) {
      rowDelta++
      const targetRow = updated[targetIdx]
      if (!targetRow) continue
      const rowCopy = { ...(targetRow as object) } as Record<string, unknown>
      let changed = false
      for (let c = range.start.col; c <= range.end.col; c++) {
        const field = cols[c]?.field
        if (!field) continue
        const def = defMap.get(field)
        if (!def?.editable) continue
        const rawSourceValue = def.valueGetter
          ? def.valueGetter(sourceRow)
          : (sourceRow as Record<string, unknown>)[field]
        // B21: project series if detected, else copy source (possibly formula-shifted).
        const series = seriesMap.get(field) ?? null
        let fillValue: unknown
        if (series) {
          fillValue = projectSeries(series, rowDelta)
        } else {
          fillValue = shiftIfFormula(rawSourceValue, def.allowFormula ?? false, rowDelta, 0, fieldOrder)
        }
        const coerced = coerceAndValidate(field, fillValue, targetRow)
        if (coerced === PASTE_SKIP) continue
        const before = (targetRow as Record<string, unknown>)[field]
        if (before === coerced) continue
        rowCopy[field] = coerced
        changes.push({ rowIndex: targetIdx, field, before, after: coerced })
        changed = true
      }
      if (changed) updated[targetIdx] = rowCopy as T
    }

    if (changes.length > 0) state.sourceData.value = updated
    return changes
  }

  function fillRight(range: CellRange): HistoryCellChange[] {
    if (range.start.col === range.end.col) return []
    const cols = state.visibleColumns.value
    const defMap = state.columnDefMap.value
    const sourceField = cols[range.start.col]?.field
    if (!sourceField) return []
    const sourceDef = defMap.get(sourceField)
    if (!sourceDef) return []
    const changes: HistoryCellChange[] = []

    // Field order for formula ref shifting (column index space).
    const fieldOrder = cols.map((c) => c.field)

    const sourceIndices = resolveRangeSourceIndices(range)
    const data = state.sourceData.value
    const updated = [...data]

    for (const sourceIdx of sourceIndices) {
      const row = updated[sourceIdx]
      if (!row) continue

      // B21 — Collect source values across all selected columns for series detection.
      const rowRecord = row as Record<string, unknown>
      const sourceColValues: unknown[] = []
      for (let c = range.start.col; c <= range.end.col - 1; c++) {
        const f = cols[c]?.field
        if (!f) break
        const d = defMap.get(f)
        sourceColValues.push(d?.valueGetter ? d.valueGetter(row) : rowRecord[f])
      }
      // series = null when fewer than 2 source columns (standard single-col fill).
      const series = detectSeries(sourceColValues)

      const rawSourceValue = sourceDef.valueGetter
        ? sourceDef.valueGetter(row)
        : rowRecord[sourceField]
      const rowCopy = { ...(row as object) } as Record<string, unknown>
      let changed = false
      for (let c = range.start.col + 1; c <= range.end.col; c++) {
        const field = cols[c]?.field
        if (!field) continue
        const def = defMap.get(field)
        if (!def?.editable) continue
        const colDelta = c - range.start.col
        let fillValue: unknown
        if (series) {
          fillValue = projectSeries(series, colDelta)
        } else {
          fillValue = shiftIfFormula(rawSourceValue, sourceDef.allowFormula ?? false, 0, colDelta, fieldOrder)
        }
        const coerced = coerceAndValidate(field, fillValue, row)
        if (coerced === PASTE_SKIP) continue
        const before = rowRecord[field]
        if (before === coerced) continue
        rowCopy[field] = coerced
        changes.push({ rowIndex: sourceIdx, field, before, after: coerced })
        changed = true
      }
      if (changed) updated[sourceIdx] = rowCopy as T
    }

    if (changes.length > 0) state.sourceData.value = updated
    return changes
  }

  function fillSelection(range: CellRange, value: unknown): HistoryCellChange[] {
    const cols = state.visibleColumns.value
    const defMap = state.columnDefMap.value
    const changes: HistoryCellChange[] = []
    const sourceIndices = resolveRangeSourceIndices(range)

    const data = state.sourceData.value
    const updated = [...data]
    for (const sourceIdx of sourceIndices) {
      const row = updated[sourceIdx]
      if (!row) continue
      const rowCopy = { ...(row as object) } as Record<string, unknown>
      let changed = false
      for (let c = range.start.col; c <= range.end.col; c++) {
        const field = cols[c]?.field
        if (!field) continue
        const def = defMap.get(field)
        if (!def?.editable) continue
        const coerced = coerceAndValidate(field, value, row)
        if (coerced === PASTE_SKIP) continue
        const before = (row as Record<string, unknown>)[field]
        if (before === coerced) continue
        rowCopy[field] = coerced
        changes.push({ rowIndex: sourceIdx, field, before, after: coerced })
        changed = true
      }
      if (changed) updated[sourceIdx] = rowCopy as T
    }

    if (changes.length > 0) state.sourceData.value = updated
    return changes
  }

  function clearRange(range: CellRange): HistoryCellChange[] {
    const cols = state.visibleColumns.value
    const defMap = state.columnDefMap.value
    const changes: HistoryCellChange[] = []
    const sourceIndices = resolveRangeSourceIndices(range)

    const data = state.sourceData.value
    const updated = [...data]
    for (const sourceIdx of sourceIndices) {
      const row = updated[sourceIdx]
      if (!row) continue
      const rowCopy = { ...(row as object) } as Record<string, unknown>
      let changed = false
      for (let c = range.start.col; c <= range.end.col; c++) {
        const field = cols[c]?.field
        if (!field) continue
        const def = defMap.get(field)
        if (!def?.editable) continue
        const coerced = coerceAndValidate(field, null, row)
        if (coerced === PASTE_SKIP) continue
        const before = (row as Record<string, unknown>)[field]
        if (before === coerced) continue
        rowCopy[field] = coerced
        changes.push({ rowIndex: sourceIdx, field, before, after: coerced })
        changed = true
      }
      if (changed) updated[sourceIdx] = rowCopy as T
    }

    if (changes.length > 0) state.sourceData.value = updated
    return changes
  }

  function applyPaste(range: CellRange, pasteRows: string[][]): HistoryCellChange[] {
    const cols = state.visibleColumns.value
    const changes: HistoryCellChange[] = []

    const selRows = range.end.row - range.start.row + 1
    const selCols = range.end.col - range.start.col + 1
    const srcRows = pasteRows.length
    const srcCols = Math.max(...pasteRows.map((r) => r.length), 1)

    // B20 — Excel-style tile: repeat the source block to fill the selection
    // when (a) the source is exactly 1×1, or (b) the selection dimensions are
    // integer multiples of the source block dimensions. Otherwise fall back to
    // pasting only the source block without tiling.
    const tileRow =
      srcRows === 1 || (selRows % srcRows === 0)
    const tileCol =
      srcCols === 1 || (selCols % srcCols === 0)
    const shouldTile = tileRow && tileCol && (srcRows > 1 || srcCols > 1 || pasteRows[0]?.length === 1)

    const data = state.sourceData.value
    const updated = [...data]

    if (shouldTile) {
      for (let dr = 0; dr < selRows; dr++) {
        const targetDisplayRow = range.start.row + dr
        const sourceIdx = displayIndexToSourceIndex(targetDisplayRow)
        if (sourceIdx < 0) continue
        const row = updated[sourceIdx]
        if (!row) continue
        const pasteRow = pasteRows[dr % srcRows]
        if (!pasteRow) continue
        const rowCopy = { ...(row as object) } as Record<string, unknown>
        let changed = false
        for (let dc = 0; dc < selCols; dc++) {
          const targetCol = range.start.col + dc
          if (targetCol >= cols.length) break
          const field = cols[targetCol]?.field
          if (!field) continue
          const cellVal = pasteRow[dc % srcCols] ?? ''
          const coerced = coerceAndValidate(field, cellVal, row)
          if (coerced === PASTE_SKIP) continue
          const before = (row as Record<string, unknown>)[field]
          if (before === coerced) continue
          rowCopy[field] = coerced
          changes.push({ rowIndex: sourceIdx, field, before, after: coerced })
          changed = true
        }
        if (changed) updated[sourceIdx] = rowCopy as T
      }
    } else {
      // No tiling: paste the block as-is starting at range.start.
      for (let ri = 0; ri < pasteRows.length; ri++) {
        const targetDisplayRow = range.start.row + ri
        const sourceIdx = displayIndexToSourceIndex(targetDisplayRow)
        if (sourceIdx < 0) continue
        const row = updated[sourceIdx]
        if (!row) continue
        const pasteRow = pasteRows[ri]
        if (!pasteRow) continue
        const rowCopy = { ...(row as object) } as Record<string, unknown>
        let changed = false
        for (let ci = 0; ci < pasteRow.length; ci++) {
          const targetCol = range.start.col + ci
          if (targetCol >= cols.length) break
          const field = cols[targetCol]?.field
          if (!field) continue
          const coerced = coerceAndValidate(field, pasteRow[ci], row)
          if (coerced === PASTE_SKIP) continue
          const before = (row as Record<string, unknown>)[field]
          if (before === coerced) continue
          rowCopy[field] = coerced
          changes.push({ rowIndex: sourceIdx, field, before, after: coerced })
          changed = true
        }
        if (changed) updated[sourceIdx] = rowCopy as T
      }
    }

    if (changes.length > 0) state.sourceData.value = updated
    return changes
  }

  function applyChanges(
    changes: HistoryCellChange[],
    direction: 'before' | 'after',
  ): void {
    if (changes.length === 0) return
    const data = state.sourceData.value
    const updated = [...data]
    const byRow = new Map<number, HistoryCellChange[]>()
    for (const change of changes) {
      const list = byRow.get(change.rowIndex) ?? []
      list.push(change)
      byRow.set(change.rowIndex, list)
    }
    for (const [rowIndex, rowChanges] of byRow) {
      const row = updated[rowIndex]
      if (!row) continue
      const rowCopy = { ...(row as object) } as Record<string, unknown>
      for (const change of rowChanges) {
        rowCopy[change.field] = direction === 'before' ? change.before : change.after
      }
      updated[rowIndex] = rowCopy as T
    }
    state.sourceData.value = updated
  }

  function coerceAndValidate(field: string, rawValue: unknown, row: T): unknown {
    const def = state.columnDefMap.value.get(field)
    if (!def?.editable) return PASTE_SKIP

    const editorType = def.cellEditor

    if (rawValue === null) {
      let clearValue: unknown
      switch (editorType) {
        case 'number':
          clearValue = null
          break
        case 'checkbox':
          clearValue = false
          break
        default:
          clearValue = ''
      }
      if (def.cellEditorValidator) {
        const result = def.cellEditorValidator(clearValue, row)
        if (result === false || typeof result === 'string') return PASTE_SKIP
      }
      return clearValue
    }

    let value: unknown = rawValue

    if (editorType === 'number') {
      const num = Number(rawValue)
      if (isNaN(num)) return PASTE_SKIP
      value = num
    } else if (editorType === 'checkbox') {
      if (rawValue === 'true' || rawValue === true) {
        value = true
      } else if (rawValue === 'false' || rawValue === false) {
        value = false
      } else {
        return PASTE_SKIP
      }
    } else if (editorType === 'select' && def.cellEditorOptions?.length) {
      const allowed = def.cellEditorOptions.map((o) => String(o.value))
      if (!allowed.includes(String(rawValue))) return PASTE_SKIP
      value = rawValue
    } else if (editorType === 'custom') {
      // Custom editors: validate via cellEditorOptions whitelist if provided,
      // otherwise pass the value through as-is (the custom editor owns validation).
      // Aligns with Angular clipboard.engine.ts:706.
      if (def.cellEditorOptions?.length) {
        const allowed = def.cellEditorOptions.map((o) => String(o.value))
        if (!allowed.includes(String(rawValue))) return PASTE_SKIP
      }
      value = rawValue
    }

    if (def.cellEditorValidator) {
      const result = def.cellEditorValidator(value, row)
      if (result === false || typeof result === 'string') return PASTE_SKIP
    }

    return value
  }

  // ── B19 — RFC-4180 TSV escape / unescape ──────────────────────────────

  function escapeTsvCell(v: unknown): string {
    const s = v == null ? '' : String(v)
    if (s.includes('\t') || s.includes('\n') || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  /**
   * Parses a single TSV row string into cells, handling RFC-4180 quoted fields
   * that may contain embedded tabs, newlines, or double-quote pairs.
   */
  function parseTsvRow(line: string): string[] {
    const cells: string[] = []
    let i = 0
    while (i <= line.length) {
      if (line[i] === '"') {
        // Quoted field
        i++
        let cell = ''
        while (i < line.length) {
          if (line[i] === '"') {
            if (line[i + 1] === '"') {
              cell += '"'
              i += 2
            } else {
              i++ // closing quote
              break
            }
          } else {
            cell += line[i++]
          }
        }
        cells.push(cell)
        if (line[i] === '\t') i++ // skip tab separator
      } else {
        const end = line.indexOf('\t', i)
        if (end === -1) {
          cells.push(line.slice(i))
          break
        } else {
          cells.push(line.slice(i, end))
          i = end + 1
        }
      }
    }
    return cells
  }

  function extractTsv(range: CellRange): string[][] {
    const cols = state.visibleColumns.value
    const data = state.sourceData.value
    const defMap = state.columnDefMap.value
    const values: string[][] = []

    for (let r = range.start.row; r <= range.end.row; r++) {
      const row = data[r]
      if (!row) continue
      const rowValues: string[] = []
      for (let c = range.start.col; c <= range.end.col; c++) {
        const field = cols[c]?.field
        if (!field) {
          rowValues.push('')
          continue
        }
        const def = defMap.get(field)
        const val = def?.valueGetter
          ? def.valueGetter(row)
          : (row as Record<string, unknown>)[field]
        // B19 — RFC-4180 escape: wrap in double-quotes if the value contains tab,
        // newline, or double-quote, doubling any internal double-quotes.
        rowValues.push(escapeTsvCell(val))
      }
      values.push(rowValues)
    }
    return values
  }

  function cutEdges(row: number, col: number): CutEdges {
    const cut = state.cutSource.value
    if (!cut) return { top: false, right: false, bottom: false, left: false, any: false }
    const minRow = Math.min(cut.start.row, cut.end.row)
    const maxRow = Math.max(cut.start.row, cut.end.row)
    const minCol = Math.min(cut.start.col, cut.end.col)
    const maxCol = Math.max(cut.start.col, cut.end.col)
    if (row < minRow || row > maxRow || col < minCol || col > maxCol) {
      return { top: false, right: false, bottom: false, left: false, any: false }
    }
    return {
      top: row === minRow,
      right: col === maxCol,
      bottom: row === maxRow,
      left: col === minCol,
      any: true,
    }
  }

  return {
    cutRange,
    markCut,
    clearCut,
    fillDown,
    fillRight,
    fillSelection,
    clearRange,
    applyPaste,
    applyChanges,
    coerceAndValidate,
    extractTsv,
    parseTsvRow,
    cutEdges,
  }
}
