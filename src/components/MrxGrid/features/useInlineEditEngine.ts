/**
 * Inline edit engine — Angular parity (moz-grid / `InlineEditEngine`).
 *
 * Owns the `cellEditState` lifecycle: start (click / F2 / Enter), typing-to-
 * edit (Excel-style, `startEditWithChar`), draft updates, commit, cancel.
 * Each successful commit records a single-cell change on the history engine
 * so Ctrl+Z works out of the box.
 *
 * Depends on `displayIndexToSourceIndex` (from `useGridEngine`) to resolve
 * the visible row index back to the index in `sourceData`.
 */

import type { GridState } from '../state/useGridState'
import type { CellEditEvent, CellEditCancelEvent } from '../models/cell.model'
import type { CellEditorType } from '../models/column.model'
import type { HistoryEngine } from './useHistoryEngine'
import type { RowData } from '../types'

export interface InlineEditEngine<T = RowData> {
  startEdit(rowIndex: number, field: string): void
  startEditWithChar(rowIndex: number, field: string, char: string): void
  updateDraft(value: unknown): void
  commitEdit(): CellEditEvent<T> | null
  cancelEdit(): CellEditCancelEvent | null
  isEditing(rowIndex: number, colIndex: number): boolean
  resolveEditorType(field: string, value: unknown): CellEditorType
}

export function useInlineEditEngine<T = RowData>(
  state: GridState<T>,
  history: HistoryEngine,
  displayIndexToSourceIndex: (displayIndex: number) => number,
): InlineEditEngine<T> {
  function startEdit(rowIndex: number, field: string): void {
    const def = state.columnDefMap.value.get(field)
    if (!def?.editable) return

    const colIndex = state.visibleColumns.value.findIndex((c) => c.field === field)
    if (colIndex < 0) return

    const sourceIndex = displayIndexToSourceIndex(rowIndex)
    const row = sourceIndex >= 0 ? state.sourceData.value[sourceIndex] : undefined
    if (!row) return

    const value = def.valueGetter
      ? def.valueGetter(row)
      : (row as Record<string, unknown>)[field]

    state.cellEditState.value = {
      editingCell: { row: rowIndex, col: colIndex },
      originalValue: value,
      draftValue: value,
      validationError: null,
    }
  }

  function startEditWithChar(rowIndex: number, field: string, char: string): void {
    const def = state.columnDefMap.value.get(field)
    if (!def?.editable) return

    const colIndex = state.visibleColumns.value.findIndex((c) => c.field === field)
    if (colIndex < 0) return

    const sourceIndex = displayIndexToSourceIndex(rowIndex)
    const row = sourceIndex >= 0 ? state.sourceData.value[sourceIndex] : undefined
    if (!row) return

    const currentValue = def.valueGetter
      ? def.valueGetter(row)
      : (row as Record<string, unknown>)[field]
    const editorType = def.cellEditor ?? resolveEditorType(field, currentValue)

    let draftValue: unknown = char
    switch (editorType) {
      case 'number': {
        const n = Number(char)
        draftValue = Number.isNaN(n) ? '' : n
        break
      }
      case 'checkbox':
        draftValue = true
        break
      case 'select':
      case 'date':
        draftValue = ''
        break
      default:
        draftValue = char
    }

    state.cellEditState.value = {
      editingCell: { row: rowIndex, col: colIndex },
      originalValue: currentValue,
      draftValue,
      validationError: null,
    }
  }

  function updateDraft(value: unknown): void {
    state.cellEditState.value = { ...state.cellEditState.value, draftValue: value }
  }

  function commitEdit(): CellEditEvent<T> | null {
    const editState = state.cellEditState.value
    if (!editState.editingCell) return null

    const { row: rowIndex, col: colIndex } = editState.editingCell
    const visibleCols = state.visibleColumns.value
    const field = visibleCols[colIndex]?.field
    if (!field) return null

    const def = state.columnDefMap.value.get(field)
    const sourceIndex = displayIndexToSourceIndex(rowIndex)
    if (sourceIndex < 0) return null
    let row = state.sourceData.value[sourceIndex]
    if (!row) return null

    if (def?.cellEditorValidator) {
      const result = def.cellEditorValidator(editState.draftValue, row)
      if (result === false) {
        state.cellEditState.value = { ...state.cellEditState.value, validationError: 'Invalid value' }
        return null
      }
      if (typeof result === 'string') {
        state.cellEditState.value = { ...state.cellEditState.value, validationError: result }
        return null
      }
    }

    const data = state.sourceData.value
    const updated = [...data]
    updated[sourceIndex] = { ...(updated[sourceIndex] as object), [field]: editState.draftValue } as T
    state.sourceData.value = updated

    row = state.sourceData.value[sourceIndex]
    if (!row) return null

    const event: CellEditEvent<T> = {
      row,
      rowIndex: sourceIndex,
      field,
      oldValue: editState.originalValue,
      newValue: editState.draftValue,
    }

    if (event.oldValue !== event.newValue) {
      history.record('edit', [
        { rowIndex: sourceIndex, field, before: event.oldValue, after: event.newValue },
      ])
    }

    state.cellEditState.value = {
      editingCell: null,
      originalValue: undefined,
      draftValue: undefined,
      validationError: null,
    }

    return event
  }

  function cancelEdit(): CellEditCancelEvent | null {
    const editState = state.cellEditState.value
    if (!editState.editingCell) return null

    const { row: rowIndex, col: colIndex } = editState.editingCell
    const field = state.visibleColumns.value[colIndex]?.field

    state.cellEditState.value = {
      editingCell: null,
      originalValue: undefined,
      draftValue: undefined,
      validationError: null,
    }

    return field ? { rowIndex, field, originalValue: editState.originalValue } : null
  }

  function isEditing(rowIndex: number, colIndex: number): boolean {
    const editState = state.cellEditState.value
    return editState.editingCell?.row === rowIndex && editState.editingCell?.col === colIndex
  }

  function resolveEditorType(field: string, value: unknown): CellEditorType {
    const def = state.columnDefMap.value.get(field)
    if (def?.cellEditor) return def.cellEditor
    if (def?.cellEditorOptions?.length) return 'select'
    if (typeof value === 'boolean') return 'checkbox'
    if (typeof value === 'number') return 'number'
    if (value instanceof Date) return 'date'
    return 'text'
  }

  return {
    startEdit,
    startEditWithChar,
    updateDraft,
    commitEdit,
    cancelEdit,
    isEditing,
    resolveEditorType,
  }
}
