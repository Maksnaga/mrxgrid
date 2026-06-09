export interface CellCoord {
  row: number;
  col: number;
}

export interface CellRange {
  start: CellCoord;
  end: CellCoord;
}

export interface CellEditState {
  editingCell: CellCoord | null;
  originalValue: unknown;
  draftValue: unknown;
  validationError: string | null;
}

export interface CellEditEvent<T = unknown> {
  row: T;
  rowIndex: number;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface CellEditCancelEvent {
  rowIndex: number;
  field: string;
  originalValue: unknown;
}

export interface BulkEditEvent {
  range: CellRange | null;
  cellCount: number;
  rowIds: unknown[];
  fields: string[];
  selectionMode?: 'rows' | 'cells';
  rowSelection?: unknown;
}

export interface BulkCopyEvent {
  range: CellRange | null;
  data: string[][];
  rowIds: unknown[];
  fields: string[];
  selectionMode?: 'rows' | 'cells';
  rowSelection?: unknown;
}

/**
 * A single cell change produced by a bulk operation (paste, delete, …).
 * Values are already coerced to the column's expected type and have passed
 * `cellEditorValidator`; consumers can persist them as-is.
 */
export interface BulkCellChange {
  rowIndex: number;
  rowId: unknown;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface BulkPasteEvent {
  range: CellRange | null;
  data: string[][];
  rowIds: unknown[];
  fields: string[];
  /**
   * Fully resolved per-cell changes applied by the grid (post-coercion,
   * post-validation). Use this to persist server-side — no need to replicate
   * the fill logic from `data` vs `range`.
   */
  changes: BulkCellChange[];
  selectionMode?: 'rows' | 'cells';
  rowSelection?: unknown;
}

export interface FillDownEvent {
  sourceCell: CellCoord;
  sourceValue: unknown;
  direction: 'vertical' | 'horizontal';
  /** Total cells actually written (excludes the anchor and non-editable columns). */
  affectedCellCount: number;

  // --- Vertical fill (single source column, multiple target rows) ---
  field?: string;
  targetRange?: { startRow: number; endRow: number };
  /** @deprecated Use `affectedCellCount` instead. */
  affectedRowCount?: number;

  // --- Horizontal fill (single row, multiple target columns) ---
  /** Target columns written in the horizontal fill. Non-editable columns are filtered out. */
  targetFields?: string[];
}

export interface CellError {
  message: string;
}

export interface BulkDeleteEvent {
  range: CellRange | null;
  cellCount: number;
  rowIds: unknown[];
  fields: string[];
  /**
   * Fully resolved per-cell changes applied by the grid (post-coercion,
   * post-validation). Use this to persist server-side.
   */
  changes: BulkCellChange[];
  selectionMode?: 'rows' | 'cells';
  rowSelection?: unknown;
}
