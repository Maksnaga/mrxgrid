/**
 * Column-level models — Angular parity (ad-grid).
 *
 * Phase 0 scope: only the new supporting types live here. The existing
 * `ColumnDef` stays in `types.ts`; new optional fields are added there
 * directly so consumers keep the single import point.
 */

import type { SortDirection } from './sort.model'

/** Pinning side. Angular uses `'start' | 'end'`; the legacy Vue `'left' | 'right'` is still accepted on ColumnDef for compat. */
export type PinnedSide = 'start' | 'end'

/** Editor kind rendered in inline-edit mode. Matches Angular `CellEditorType`. */
export type CellEditorType =
  | 'text'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'date'
  | 'toggle'
  | 'custom'

/**
 * Per-column runtime state — pushed into the central grid state.
 * Mirrors Angular `ColumnStateEntry`.
 */
export interface ColumnStateEntry {
  field: string
  currentWidth: number
  order: number
  visible: boolean
  sort: SortDirection | null
  sortIndex: number | null
  pinned: PinnedSide | null
  searchVisible: boolean
}

export interface ColumnResizeEvent {
  field: string
  previousWidth: number
  newWidth: number
}

export interface ColumnReorderEvent {
  field: string
  previousIndex: number
  newIndex: number
  columns: string[]
}

export interface ColumnFreezeEvent {
  field: string
  side: PinnedSide | null
  frozenLeftColumns: string[]
  frozenRightColumns: string[]
}

export interface ColumnVisibilityEvent {
  field: string
  visible: boolean
  visibleColumns: string[]
}

export interface ColumnSearchToggleEvent {
  field: string
  searchVisible: boolean
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
  | 'autosize-all'

export interface HeaderMenuConfig {
  field: string
  columnIndex: number
  headerName: string
  sortable: boolean
  filterable: boolean
  groupable: boolean
  freezable: boolean
  hideable: boolean
  searchVisible: boolean
  currentSort: SortDirection | null
}
