/**
 * Grid-level events + ancillary drawer payloads — Angular parity (moz-grid).
 */

import type {
  ColumnFreezeEvent,
  ColumnReorderEvent,
  ColumnResizeEvent,
  ColumnSearchToggleEvent,
  ColumnVisibilityEvent,
} from './column.model'
import type { CellEditCancelEvent, CellEditEvent } from './cell.model'
import type { FilterEvent } from './filter.model'
import type { PageEvent } from './pagination.model'
import type { SortEvent } from './sort.model'

/** Density scale matching Vue DataDensity (`'compact' | 'default' | 'comfortable'`). */
export type GridDensity = 'compact' | 'default' | 'comfortable'

/**
 * Lightweight display descriptor for the "FILTERED BY" tag bar. Derived from
 * the active filter model via a `toLabel()` helper; kept as a separate shape
 * so the tag bar template does not depend on the full `FilterCondition`.
 */
export interface ActiveFilter {
  /** Condition id (not the column field — multiple conditions can target the same field). */
  id: string
  field: string
  label: string
  removable: boolean
}

export interface GroupEntry {
  field: string
  sortDirection: 'asc' | 'desc'
}

export interface GroupEvent {
  columns: string[]
  groups: GroupEntry[]
}

export type SelectAllMode = 'none' | 'page' | 'all'

export interface RowSelectionEvent<T = unknown> {
  selectedIds: unknown[]
  excludedIds: unknown[]
  selectedRows: T[]
  mode: SelectAllMode
  count: number
}

export interface CellSelectionEvent<T = unknown> {
  focusedCell: { row: number; col: number } | null
  selectedCell: { row: number; col: number } | null
  range: { start: { row: number; col: number }; end: { row: number; col: number } } | null
  selectedData: { row: T; column: string; value: unknown }[]
}

export interface GridSettingsData {
  columns: { field: string; headerName: string; visible: boolean }[]
  density: GridDensity
  defaultColumns: { field: string; headerName: string; visible: boolean }[]
}

export interface GridSettingsResult {
  density: GridDensity
  columns: { field: string; visible: boolean; order: number }[]
}

export interface GroupDrawerData {
  groups: GroupEntry[]
  availableColumns: { field: string; headerName: string }[]
}

export interface GroupDrawerResult {
  groups: GroupEntry[]
}

export interface GridEventMap<T = unknown> {
  pageChange: PageEvent
  sortChange: SortEvent
  filterChange: FilterEvent
  groupChange: GroupEvent
  columnResize: ColumnResizeEvent
  columnReorder: ColumnReorderEvent
  columnFreeze: ColumnFreezeEvent
  columnVisibility: ColumnVisibilityEvent
  columnSearchToggle: ColumnSearchToggleEvent
  selectionChange: RowSelectionEvent<T>
  cellSelectionChange: CellSelectionEvent<T>
  rowClick: { row: T; index: number; event: MouseEvent }
  rowExpand: { row: T; index: number; expanded: boolean }
  cellEdit: CellEditEvent<T>
  cellEditCancel: CellEditCancelEvent
}

export type GridEventType = keyof GridEventMap
