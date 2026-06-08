import type { Component, Raw } from 'vue'
import type { CellError, CellRange } from './models/cell.model'

/**
 * Props passed to a custom cell renderer component.
 *
 * @property value - the raw cell value from row[field]
 * @property row - the full row data object
 * @property field - the column field name
 * @property rowIndex - original row index in the dataset
 * @property column - the full ColumnDef for this cell
 */
export interface CellRendererProps {
  value: unknown
  row: RowData
  field: string
  rowIndex: number
  column: ColumnDef
}

/**
 * Props exposed by the `#cell` scoped slot on `<AdeoGrid>`.
 *
 * Consumers can use this to build fully custom cell templates that
 * handle both display and editing in a single slot:
 *
 * ```vue
 * <AdeoGrid :columns="cols" :rows="rows">
 *   <template #cell="{ value, editing, editValue, updateValue, commit, cancel }">
 *     <MyCustomEditor v-if="editing" :value="editValue" @change="updateValue" @save="commit" @cancel="cancel" />
 *     <span v-else>{{ value }}</span>
 *   </template>
 * </AdeoGrid>
 * ```
 */
export interface CellSlotProps {
  value: unknown
  row: RowData
  field: string
  rowIndex: number
  column: ColumnDef
  active?: boolean
  editing?: boolean
  editValue?: unknown
  startEdit: () => void
  updateValue: (v: unknown) => void
  commit: (direction?: 'down' | 'right' | 'left') => void
  cancel: () => void
}

/**
 * Defines a single column in the grid.
 *
 * @property field - key in the row data object to display
 * @property headerName - label shown in the column header
 * @property width - optional fixed column width (e.g. "150px", "10rem")
 * @property renderer - 'text' (default) or a Vue component that receives CellRendererProps
 * @property rendererProps - extra static props merged into the renderer component's props
 */
// ---------------------------------------------------------------------------
// Column filtering
// ---------------------------------------------------------------------------

/** Built-in filter types shipped with the grid. */
export type BuiltInFilterType = 'text' | 'select' | 'date'

/**
 * Defines how a column is filtered.
 *
 * - `'text'`   — free-text substring match (case-insensitive)
 * - `'select'` — dropdown with predefined options
 * - `'date'`   — date range picker (from / to)
 * - A raw Vue component — receives `FilterComponentProps` and emits `update:modelValue`
 */
export interface FilterDef {
  /** Built-in filter type or a custom Vue component. */
  type: BuiltInFilterType | Raw<Component>
  /** Placeholder text for the filter input. */
  placeholder?: string
  /**
   * Options for 'select' filter type.
   * Each option has a label (displayed) and a value (matched against row data).
   */
  options?: Array<{ label: string; value: unknown }>
  /**
   * Custom filter predicate. When provided, overrides the built-in matching.
   * Called once per row — return `true` to include the row.
   */
  predicate?: (cellValue: unknown, filterValue: unknown, row: RowData) => boolean
}

/**
 * Props passed to a custom filter component.
 * The component must emit `update:modelValue` when the filter value changes.
 */
export interface FilterComponentProps {
  modelValue: unknown
  field: string
  column: ColumnDef
}

export interface ColumnDef<T = RowData> {
  field: string
  headerName: string
  width?: string
  /** Minimum width in px for resize. Added for Angular parity. */
  minWidth?: string
  /** Maximum width in px for resize. Added for Angular parity. */
  maxWidth?: string
  /** Flex grow factor (like CSS flex). Added for Angular parity. */
  flex?: number
  resizable?: boolean
  /** Whether column is reorderable. Added for Angular parity. */
  reorderable?: boolean
  /** When `true`, the user can't drag-reorder this column. AG-Grid-parity
   *  flag — same name. Use for ID / actions columns whose position is
   *  meaningful for the data model. */
  suppressMovable?: boolean
  /** Whether column is sortable. Added for Angular parity. */
  sortable?: boolean
  /** Custom sort comparator. Added for Angular parity. */
  sortComparator?: (a: T, b: T) => number
  /** Whether column is groupable via header menu. Added for Angular parity. */
  groupable?: boolean
  /** Whether column supports filtering via the multi-condition builder. Added for Angular parity. */
  filterable?: boolean
  /** Filter data type for the builder (text/number/date/set/boolean). Added for Angular parity. */
  filterType?: import('./models/filter.model').FilterDataType
  /** Allowed operators — subset of defaults for `filterType`. Added for Angular parity. */
  filterOperators?: import('./models/filter.model').FilterOperator[]
  /** Default operator for a new condition on this column. Added for Angular parity. */
  defaultFilterOperator?: import('./models/filter.model').FilterOperator
  /** For `set` filters: options shown in the value picker. Added for Angular parity. */
  filterOptions?: { value: unknown; label: string }[]
  /**
   * Pinning side. Prefer `'start'` (left) or `'end'` (right) — Angular-parity vocab.
   *
   * @deprecated `'left'` and `'right'` are accepted for backward compatibility but
   * will be removed in a future major version. Use `'start'` and `'end'` instead.
   * Runtime normalization (`normalizePinned` in `state/useGridState.ts`) converts
   * the legacy values transparently.
   */
  pinned?: 'start' | 'end' | 'left' | 'right' | null
  /** Whether column is visible at boot. Added for Angular parity. */
  visible?: boolean
  /** Whether column can be hidden via header menu. Added for Angular parity. */
  hideable?: boolean
  /** Whether column can be frozen via header menu. Added for Angular parity. */
  freezable?: boolean
  /** Whether the column header search (filter input) is visible. Added for Angular parity. */
  searchVisible?: boolean
  /** Disable the header menu entirely for this column. Added for Angular parity. */
  headerMenuDisabled?: boolean
  /** Cell value accessor (alternative to field for nested data). Added for Angular parity. */
  valueGetter?: (row: T) => unknown
  /** Cell value formatter for display. Added for Angular parity. */
  valueFormatter?: (value: unknown, row: T) => string
  /** CSS class for column cells. Added for Angular parity. */
  cellClass?: string | ((row: T) => string)
  /** CSS class for header cell. Added for Angular parity. */
  headerClass?: string
  editable?: boolean
  /** Editor kind rendered in inline-edit mode. Added for Angular parity. */
  cellEditor?: import('./models/column.model').CellEditorType
  /** Options for select editors. Added for Angular parity. */
  cellEditorOptions?: { value: unknown; label: string }[]
  /** Custom validation before commit (cell editor). Added for Angular parity. */
  cellEditorValidator?: (value: unknown, row: T) => boolean | string
  renderer?: 'text' | Raw<Component>
  rendererProps?: Record<string, unknown>
  /**
   * Custom filter renderer used in the filter row — alternative to the
   * `#filter-{field}` template slot. Receives `{ column, value, setValue,
   * clear }` props. When present, the filter row appears even if the
   * column doesn't declare a built-in `filter` shape. Sprint 6.
   */
  filterRenderer?: Raw<Component>
  /**
   * Filter configuration. Two shapes are accepted:
   *
   * 1. **Inline filter row** — `{ type: 'text' | 'number' | 'select' | 'date', … }`
   *    (see {@link FilterDef}). Drives the input row below the header.
   *
   * 2. **Custom filter for the builder / column overlay** —
   *    `{ component, doesFilterPass, filterParams? }`
   *    (see {@link import('./models/filter.model').AdeoFilterConfig}).
   *    The component owns the UI + state, the predicate is column data.
   *
   * The two shapes are distinguished structurally: an object with `type` →
   * inline; an object with `component` → custom. Omit entirely to disable.
   */
  filter?:
    | FilterDef
    | import('./models/filter.model').AdeoFilterConfig<T, unknown, unknown>
  /**
   * Optional validator called before paste / fill writes a value into this column.
   * Return `true` to accept, `false` to reject.
   * When absent, any value is accepted (as long as the column is editable).
   *
   * @example
   * // Only accept values from a known set:
   * valueValidator: (v) => ['Admin', 'Editor', 'Viewer'].includes(String(v))
   */
  valueValidator?: (value: unknown) => boolean

  /**
   * Optional cell validator for display-time validation.
   * Called with the current cell value and the full row.
   * Return `null` if valid, or a `CellError` object to flag the cell.
   * Invalid cells are highlighted with the message shown on hover.
   *
   * The `level` field defaults to `'error'`; pass `'warning'` for a
   * non-blocking visual cue.
   *
   * @example
   * cellValidator: (value) => {
   *   if (!value) return { message: 'This field is required', level: 'error' }
   *   return null
   * }
   */
  cellValidator?: (value: unknown, row: RowData) => CellError | null

  /**
   * Enables spreadsheet-style formulas for this column. Implies
   * `editable: true` (the user must be able to type the formula). When the
   * committed value starts with `=`, the cell is registered with
   * `useFormulaEngine` and the evaluated value is rendered in place of the
   * raw formula string. Requires the row to expose a stable id via
   * `rowIdField`.
   */
  allowFormula?: boolean
}

/** Identifies a single cell in the grid by row and column field. */
export interface CellPosition {
  rowIndex: number
  field: string
}

/**
 * A single row of data.
 * Keys correspond to ColumnDef.field values.
 */
export type RowData = Record<string, unknown>

/** Describes whether none, some, or all rows are selected. */
export type SelectionState = 'none' | 'some' | 'all'

/** Maps column field names to runtime pixel widths set by dragging. */
export type ColumnWidths = Record<string, number>

// SortDirection is re-exported from './models/sort.model' further down (identical shape).

/** One entry in a multi-column sort stack (legacy shape — Angular parity type is `SortDef`). */
export interface SortState {
  field: string
  direction: import('./models/sort.model').SortDirection
}

// ---------------------------------------------------------------------------
// Grouping — flat row metadata
// ---------------------------------------------------------------------------
//
// When grouping is active, the flat renderable list contains both group-header
// rows and data rows. Both satisfy `RowData` (Record<string, unknown>) so
// the virtualizer works unchanged. The `__adg` prefix avoids collisions
// with user data fields.

/** Metadata fields injected into group-header rows in the flat list. */
export interface GroupRowMeta {
  __adgType: 'group'
  /** Composite key for this group (e.g. "status::active" or "status::active|region::EU"). */
  __adgKey: string
  /** The field this group level corresponds to. */
  __adgField: string
  /** The grouped value for this level. */
  __adgValue: unknown
  /** Nesting depth (0-based). */
  __adgDepth: number
  /** Total number of leaf data rows in this group (including nested). */
  __adgCount: number
  /** Column header name for display (e.g. "Status"). */
  __adgHeaderName: string
}

/** Metadata fields injected into data rows in the flat list. */
export interface DataRowMeta {
  __adgType: 'row'
  /** Nesting depth — matches the depth of the innermost group. */
  __adgDepth: number
  /** Index in the original (pre-grouping) row array. */
  __adgOriginalIndex: number
}

/** Type guard: is this row a group header? */
export function isGroupRow(row: RowData): row is RowData & GroupRowMeta {
  return row.__adgType === 'group'
}

// ---------------------------------------------------------------------------
// Cell selection — range model
// ---------------------------------------------------------------------------

/**
 * A normalized rectangular range (r1 <= r2, c1 <= c2).
 *
 * @deprecated Use `CellRange` from `models/cell.model.ts` instead.
 * The `{ start, end }` shape is the Angular-parity format used by all
 * engine APIs. `SelectionRange` is kept for backward compatibility with
 * the legacy composables — it will be removed in a future major version.
 *
 * Use `selectionRangeToCellRange()` / `cellRangeToSelectionRange()` to
 * convert between the two shapes during the migration.
 */
export interface SelectionRange {
  /** Min row index. */
  r1: number
  /** Min column index (in allColumnsFlat display order). */
  c1: number
  /** Max row index. */
  r2: number
  /** Max column index. */
  c2: number
}

/**
 * Convert a legacy `SelectionRange` (`{ r1, c1, r2, c2 }`) to the
 * Angular-parity `CellRange` (`{ start: {row, col}, end: {row, col} }`).
 *
 * Use this during the migration from composable-based code to engine APIs.
 */
export function selectionRangeToCellRange(r: SelectionRange): CellRange {
  return {
    start: { row: r.r1, col: r.c1 },
    end: { row: r.r2, col: r.c2 },
  }
}

/**
 * Convert an Angular-parity `CellRange` back to a legacy `SelectionRange`.
 *
 * The result is normalized (r1 <= r2, c1 <= c2).
 */
export function cellRangeToSelectionRange(range: CellRange): SelectionRange {
  return {
    r1: Math.min(range.start.row, range.end.row),
    c1: Math.min(range.start.col, range.end.col),
    r2: Math.max(range.start.row, range.end.row),
    c2: Math.max(range.start.col, range.end.col),
  }
}

/** Per-cell visual flags computed at the grid level and spread onto AdeoGridCell. */
export interface CellFlags {
  selected?: boolean
  edgeTop?: boolean
  edgeBottom?: boolean
  edgeLeft?: boolean
  edgeRight?: boolean
  fillHandle?: boolean
  fillTarget?: boolean
  /** True when the cell is in the fill-handle target range BUT its column
   *  refuses the fill (non-editable). Surfaced as a red dashed outline so
   *  the user sees what'll be skipped before they release the mouse. */
  fillTargetInvalid?: boolean
  /** True when the cell value fails its column's cellValidator. */
  invalid?: boolean
  /** Error message from the cellValidator (shown on hover). */
  invalidMessage?: string
  /** True when the cell is inside a pending Ctrl+X cut range (marching ants). */
  cutSource?: boolean
  cutEdgeTop?: boolean
  cutEdgeBottom?: boolean
  cutEdgeLeft?: boolean
  cutEdgeRight?: boolean
  /**
   * True when an async mutation is in-flight for this (row, field). Drives a
   * shimmer overlay above the value (the value stays visible in filigree so
   * the user knows WHICH field is being pushed). Set via `props.pendingCells`
   * on `<AdeoGrid>` — see the `usePendingMutations` pattern in the demo.
   */
  pending?: boolean
}

/** Emitted when a fill-handle drag completes. */
export interface FillEvent {
  sourceRange: SelectionRange
  targetRange: SelectionRange
  direction: 'down' | 'up' | 'right' | 'left'
  /** Pre-computed values the consumer should write into the grid data. */
  fills: Array<{ rowIndex: number; field: string; value: unknown }>
}

// ---------------------------------------------------------------------------
// Column menu actions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Configuration for pagination when virtual scroll is disabled. */
export interface PaginationConfig {
  /** Available page size options shown in the "Rows per page" dropdown. */
  pageSizeOptions?: number[]
  /** Initial page size. Defaults to 25 (Angular parity). */
  defaultPageSize?: number
  /**
   * Alias for `defaultPageSize`. Kept for backward compatibility.
   * @deprecated Use `defaultPageSize`.
   */
  pageSize?: number
}

// ---------------------------------------------------------------------------
// Server-side grouping
// ---------------------------------------------------------------------------

/** Summary returned by the server for a single group. */
export interface GroupSummary {
  /** Grouped value (e.g. "Admin", "Editor"). */
  value: unknown
  /** Total number of rows in this group. */
  count: number
}

/** Configuration for server-side grouping when using lazy/async data. */
export interface ServerGroupingOptions {
  /**
   * Fetch group summaries from the server.
   * Called when grouping is activated or group fields change.
   */
  fetchGroups: (
    groupFields: string[],
  ) => Promise<GroupSummary[]>

  /**
   * Fetch rows belonging to a specific group (paginated).
   * `start` and `end` are 0-based indices relative to the group.
   */
  fetchGroupRows: (
    groupField: string,
    groupValue: unknown,
    start: number,
    end: number,
  ) => Promise<RowData[]>

  /** Rows per fetch within expanded groups. Default: 100. */
  pageSize?: number
}

/** Actions emitted by the column menu. */
export type ColumnMenuAction =
  | { type: 'sort-asc'; field: string }
  | { type: 'sort-desc'; field: string }
  | { type: 'filter'; field: string }
  /**
   * Sprint 5 — opens the per-column "Filter in this column" overlay
   * (a mini single-condition builder anchored on the header trigger).
   * Distinct from `'filter'`, which targets the global filter drawer.
   */
  | { type: 'filter-column'; field: string }
  | { type: 'group-by'; field: string }
  | { type: 'pin-left'; field: string }
  | { type: 'pin-right'; field: string }
  | { type: 'unpin'; field: string }
  | { type: 'hide'; field: string }
  | { type: 'toggle-search'; field: string }
  | { type: 'autosize-this'; field: string }
  | { type: 'autosize-all'; field: string }

// ---------------------------------------------------------------------------
// Angular-parity models — re-exported from ./models (Phase 0: additive).
// Deep imports still work: `from '@/components/AdeoGrid/models'`.
// ---------------------------------------------------------------------------

// cell.model: `CellEditEvent` and `CellEditState` collide with legacy shapes
// from `useCellEditing`. Phase 0 keeps the legacy names at the barrel; the
// Angular-parity types are exposed under a `Grid…` prefix.
export type {
  BulkCopyEvent,
  BulkDeleteEvent,
  BulkEditEvent,
  BulkPasteEvent,
  CellCoord,
  CellEditCancelEvent,
  CellError,
  CellRange,
  FillDownEvent,
} from './models/cell.model'
export type {
  CellEditEvent as GridCellEditEvent,
  CellEditState as GridCellEditState,
} from './models/cell.model'
export * from './models/column.model'
export * from './models/display-row.model'
export * from './models/filter.model'
export * from './models/grid-options.model'
export * from './models/pagination.model'
export * from './models/plugin.model'
export * from './models/sort.model'

// grid-events.model: selective to avoid `GroupEntry` name collision with
// `useGrouping.GroupEntry` (different shape). The Angular-parity type is
// re-exported under `GridGroupEntry`; Phase 8 unifies the two.
export type {
  ActiveFilter,
  CellSelectionEvent,
  GridDensity,
  GridEventMap,
  GridEventType,
  GridSettingsData,
  GridSettingsResult,
  GroupDrawerData,
  GroupDrawerResult,
  GroupEvent,
  RowSelectionEvent,
  SelectAllMode,
} from './models/grid-events.model'
export type { GroupEntry as GridGroupEntry } from './models/grid-events.model'
