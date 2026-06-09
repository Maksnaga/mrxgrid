/**
 * Cell-level models — Angular parity (ad-grid).
 *
 * `{ row, col }` coord space matches Angular; the legacy `{ rowIndex, field }`
 * shape from Vue's `CellPosition` stays in `types.ts` for compat.
 */

export interface CellCoord {
  row: number
  col: number
}

export interface CellRange {
  start: CellCoord
  end: CellCoord
}

export interface CellEditState {
  editingCell: CellCoord | null
  originalValue: unknown
  draftValue: unknown
  validationError: string | null
}

export interface CellEditEvent<T = unknown> {
  row: T
  rowIndex: number
  field: string
  oldValue: unknown
  newValue: unknown
}

export interface CellEditCancelEvent {
  rowIndex: number
  field: string
  originalValue: unknown
}

export interface BulkEditEvent {
  range: CellRange | null
  cellCount: number
  rowIds: unknown[]
  fields: string[]
  selectionMode?: 'rows' | 'cells'
  rowSelection?: unknown
}

export interface BulkCopyEvent {
  range: CellRange | null
  data: string[][]
  rowIds: unknown[]
  fields: string[]
  selectionMode?: 'rows' | 'cells'
  rowSelection?: unknown
}

export interface BulkPasteEvent {
  range: CellRange | null
  data: string[][]
  rowIds: unknown[]
  fields: string[]
  selectionMode?: 'rows' | 'cells'
  rowSelection?: unknown
}

export interface BulkDeleteEvent {
  range: CellRange | null
  cellCount: number
  rowIds: unknown[]
  fields: string[]
  selectionMode?: 'rows' | 'cells'
  rowSelection?: unknown
}

export interface FillDownEvent {
  sourceCell: CellCoord
  sourceValue: unknown
  direction: 'vertical' | 'horizontal'
  /** Total cells actually written (excludes the anchor and non-editable columns). */
  affectedCellCount: number

  // Vertical fill (single source column, multiple target rows)
  field?: string
  targetRange?: { startRow: number; endRow: number }
  /** @deprecated Use `affectedCellCount` instead. */
  affectedRowCount?: number

  // Horizontal fill (single row, multiple target columns)
  targetFields?: string[]
}

export interface CellError {
  message: string
  level?: 'error' | 'warning'
}
