import {
  ColumnResizeEvent,
  ColumnReorderEvent,
  ColumnFreezeEvent,
  ColumnVisibilityEvent,
  ColumnSearchToggleEvent,
} from './column.model';
import { SortDef, SortEvent } from './sort.model';
import { PageEvent } from './pagination.model';
import { CellEditEvent, CellEditCancelEvent } from './cell.model';
import { FilterEvent, FilterModel } from './filter.model';

export type { FilterEvent };

/**
 * Lightweight display descriptor for the "FILTERED BY" tag bar. Derived from
 * the active filter model via `FilterEngine.toLabel()`; kept as a separate
 * shape so the tag bar template does not depend on the full `FilterCondition`.
 */
export interface ActiveFilter {
  /** Condition id (not the column field — multiple conditions can target the same field). */
  id: string;
  field: string;
  label: string;
  removable: boolean;
}

export interface GroupEvent {
  columns: string[];
  groups: GroupEntry[];
}

/**
 * Emitted when the toolbar export action is triggered while `exportMode` is
 * `'server'`. The grid does not produce a file itself — the consumer reacts to
 * this event (e.g. calls a back-end export endpoint) using the active view
 * descriptors below.
 */
export interface GridExportEvent {
  format: 'csv';
  /** Active sort descriptors at export time. */
  sorts: SortDef[];
  /** Active filter model at export time. */
  filterModel: FilterModel;
  /** Fields of the currently visible columns, in display order. */
  columns: string[];
}

export interface RowSelectionEvent<T = unknown> {
  selectedIds: unknown[];
  excludedIds: unknown[];
  selectedRows: T[];
  mode: SelectAllMode;
  count: number;
}

export type SelectAllMode = 'none' | 'page' | 'all';

export interface CellSelectionEvent<T = unknown> {
  focusedCell: { row: number; col: number } | null;
  selectedCell: { row: number; col: number } | null;
  range: { start: { row: number; col: number }; end: { row: number; col: number } } | null;
  selectedData: { row: T; column: string; value: unknown }[];
}

export interface GridEventMap<T = unknown> {
  pageChange: PageEvent;
  sortChange: SortEvent;
  filterChange: FilterEvent;
  groupChange: GroupEvent;
  columnResize: ColumnResizeEvent;
  columnReorder: ColumnReorderEvent;
  columnFreeze: ColumnFreezeEvent;
  columnVisibility: ColumnVisibilityEvent;
  columnSearchToggle: ColumnSearchToggleEvent;
  selectionChange: RowSelectionEvent<T>;
  cellSelectionChange: CellSelectionEvent<T>;
  rowClick: { row: T; index: number; event: MouseEvent };
  rowExpand: { row: T; index: number; expanded: boolean };
  cellEdit: CellEditEvent<T>;
  cellEditCancel: CellEditCancelEvent;
}

export type GridEventType = keyof GridEventMap;

export type GridDensity = 'compact' | 'default' | 'comfortable';

export interface GridSettingsData {
  columns: { field: string; headerName: string; visible: boolean }[];
  density: GridDensity;
  defaultColumns: { field: string; headerName: string; visible: boolean }[];
}

export interface GridSettingsResult {
  density: GridDensity;
  columns: { field: string; visible: boolean; order: number }[];
}

export interface GroupEntry {
  field: string;
  sortDirection: 'asc' | 'desc';
}

export interface GroupDrawerData {
  groups: GroupEntry[];
  availableColumns: { field: string; headerName: string }[];
}

export interface GroupDrawerResult {
  groups: GroupEntry[];
}
