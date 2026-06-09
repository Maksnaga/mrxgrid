import { TemplateRef, Type } from '@angular/core';
import { MozSelectOption } from '@mozaic-ds/angular';
import { CellError } from './cell.model';
import { FilterDataType, FilterOperator, FilterValue, AdeoGridCustomFilter } from './filter.model';

export type SortDirection = 'asc' | 'desc' | null;

export type CellEditorType =
  | 'text'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'date'
  | 'toggle'
  | 'custom';

export interface ColumnDef<T = unknown> {
  /** Unique column identifier */
  field: string;

  /** Display name in header */
  headerName?: string;

  /** Fixed width in px (e.g. '120px') */
  width?: string;

  /** Minimum width in px for resize */
  minWidth?: string;

  /** Maximum width in px for resize */
  maxWidth?: string;

  /** Flex grow factor (like CSS flex) */
  flex?: number;

  /** Whether column is sortable */
  sortable?: boolean;

  /** Custom sort comparator */
  sortComparator?: (a: T, b: T) => number;

  /** Whether column is resizable */
  resizable?: boolean;

  /** Whether column is reorderable */
  reorderable?: boolean;

  /** Whether column is groupable */
  groupable?: boolean;

  /** Whether column supports filtering */
  filterable?: boolean;

  /**
   * Filter data type. When omitted, it is derived from `cellEditor`:
   * `number → number`, `date → date`, `select → set`, anything else → `text`.
   */
  filterType?: FilterDataType;

  /** Allowed operators — subset of the defaults for `filterType`. Optional. */
  filterOperators?: FilterOperator[];

  /** Default operator used when a condition is created for this column. */
  defaultFilterOperator?: FilterOperator;

  /** For `set` filters: the options shown in the value picker. */
  filterOptions?: { value: unknown; label: string }[];

  /**
   * Whether column is pinned/frozen. Canonical values are `'start' | 'end'`,
   * but the Vue grid's `'left' | 'right'` aliases are also accepted and
   * normalized internally by `AdeoGridColumnDef` so consumers can share
   * column definitions verbatim between the two libraries.
   */
  pinned?: 'start' | 'end' | 'left' | 'right' | null;

  /** Whether column is visible */
  visible?: boolean;

  /** Whether column can be hidden via header menu */
  hideable?: boolean;

  /** Whether column can be frozen via header menu */
  freezable?: boolean;

  /** Whether the column header search (filter input) is visible */
  searchVisible?: boolean;

  /** Disable the header menu entirely for this column */
  headerMenuDisabled?: boolean;

  /** Cell value accessor (alternative to field for nested data) */
  valueGetter?: (row: T) => unknown;

  /** Cell value formatter for display */
  valueFormatter?: (value: unknown, row: T) => string;

  /** CSS class for column cells */
  cellClass?: string | ((row: T) => string);

  /** CSS class for header cell */
  headerClass?: string;

  /** Whether this column supports inline editing (double-click to edit) */
  editable?: boolean;

  /** Editor type — determines which Mozaic component is rendered in edit mode */
  cellEditor?: CellEditorType;

  /** Options for select editors (MozSelectOption[]) */
  cellEditorOptions?: MozSelectOption[];

  /** Custom validation before commit */
  cellEditorValidator?: (value: unknown, row: T) => boolean | string;

  /**
   * Custom cell template.
   *  - `TemplateRef<unknown>` — rendered with `ngTemplateOutlet` (classic slot).
   *  - `Type<unknown>`        — rendered as a standalone component via `ngComponentOutlet`.
   *
   * Consumers can write their own renderer factory that returns a
   * `Type<{ value }>` standalone component for richer behavior (status
   * badges, tags, …) — see `mrxgrid/src/app/renderers/` for examples.
   */
  cellTemplate?: TemplateRef<unknown> | Type<unknown>;

  /** Custom edit template */
  editTemplate?: TemplateRef<unknown>;

  /** Custom filter template rendered in the sub-header filter row */
  filterTemplate?: TemplateRef<unknown>;

  /**
   * Custom Angular component rendered as the value editor in the filter builder.
   * The component must extend `AdeoGridCustomFilter`.
   * Automatically sets filterType to 'custom'.
   */
  filterComponent?: Type<AdeoGridCustomFilter>;

  /**
   * Client-side predicate used when filterMode="client" and filterType is 'custom'.
   * If absent, custom conditions are silently skipped in client mode.
   */
  filterPredicate?: (row: T, value: FilterValue) => boolean;

  /**
   * Determines whether a custom filter condition is "complete" (has enough data
   * to participate in evaluation). Defaults to value.value != null && !== ''.
   */
  filterIsComplete?: (value: FilterValue) => boolean;

  /** Validation function for cell values. Returns CellError or null. */
  cellValidator?: (value: unknown, row: T) => CellError | null;

  /**
   * Enables spreadsheet-style formulas for this column. Setting this to
   * `true` implies `editable: true` (users need to type the formula). When
   * the committed value starts with `=`, it is routed to the `FormulaEngine`
   * and the evaluated result is rendered in place of the raw formula text.
   *
   * Requires the grid-level `formulas` input to be `true` and the row to
   * expose a stable id via `rowIdField`.
   */
  allowFormula?: boolean;
}

export interface ColumnStateEntry {
  field: string;
  currentWidth: number;
  order: number;
  visible: boolean;
  sort: SortDirection;
  sortIndex: number | null;
  pinned: 'start' | 'end' | null;
  searchVisible: boolean;
}

export interface ColumnResizeEvent {
  field: string;
  previousWidth: number;
  newWidth: number;
}

export interface ColumnReorderEvent {
  field: string;
  previousIndex: number;
  newIndex: number;
  columns: string[];
}

export interface ColumnFreezeEvent {
  field: string;
  side: 'start' | 'end' | null;
  frozenLeftColumns: string[];
  frozenRightColumns: string[];
}

export interface ColumnVisibilityEvent {
  field: string;
  visible: boolean;
  visibleColumns: string[];
}

export interface ColumnSearchToggleEvent {
  field: string;
  searchVisible: boolean;
}

export type HeaderMenuActionId =
  | 'sort-asc'
  | 'sort-desc'
  | 'filter-column'
  | 'group-column'
  | 'freeze-column-left'
  | 'freeze-column-right'
  | 'unfreeze-column'
  | 'hide-column'
  | 'toggle-column-search'
  | 'autosize-this'
  | 'autosize-all';

export interface HeaderMenuConfig {
  field: string;
  columnIndex: number;
  headerName: string;
  sortable: boolean;
  filterable: boolean;
  groupable: boolean;
  freezable: boolean;
  hideable: boolean;
  searchVisible: boolean;
  currentSort: SortDirection;
}
