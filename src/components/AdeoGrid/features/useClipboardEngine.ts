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

export const PASTE_SKIP: unique symbol = Symbol('PASTE_SKIP')

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

    for (const targetIdx of targetIndices) {
      const targetRow = updated[targetIdx]
      if (!targetRow) continue
      const rowCopy = { ...(targetRow as object) } as Record<string, unknown>
      let changed = false
      for (let c = range.start.col; c <= range.end.col; c++) {
        const field = cols[c]?.field
        if (!field) continue
        const def = defMap.get(field)
        if (!def?.editable) continue
        const sourceValue = def.valueGetter
          ? def.valueGetter(sourceRow)
          : (sourceRow as Record<string, unknown>)[field]
        const coerced = coerceAndValidate(field, sourceValue, targetRow)
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

    const sourceIndices = resolveRangeSourceIndices(range)
    const data = state.sourceData.value
    const updated = [...data]
    for (const sourceIdx of sourceIndices) {
      const row = updated[sourceIdx]
      if (!row) continue
      const sourceValue = sourceDef.valueGetter
        ? sourceDef.valueGetter(row)
        : (row as Record<string, unknown>)[sourceField]
      const rowCopy = { ...(row as object) } as Record<string, unknown>
      let changed = false
      for (let c = range.start.col + 1; c <= range.end.col; c++) {
        const field = cols[c]?.field
        if (!field) continue
        const def = defMap.get(field)
        if (!def?.editable) continue
        const coerced = coerceAndValidate(field, sourceValue, row)
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

    const data = state.sourceData.value
    const updated = [...data]
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
    }

    if (def.cellEditorValidator) {
      const result = def.cellEditorValidator(value, row)
      if (result === false || typeof result === 'string') return PASTE_SKIP
    }

    return value
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
        rowValues.push(val != null ? String(val) : '')
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
    cutEdges,
  }
}
