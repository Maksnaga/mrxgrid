/**
 * Top-level grid options — Angular parity (moz-grid).
 *
 * These are the same defaults as Angular's `DEFAULT_GRID_OPTIONS`. In Vue
 * they are consumed by `<MrxGrid>` as prop defaults via `withDefaults(...)`.
 */

export interface GridOptions<T = unknown> {
  /** Data mode: client-side pipeline or server-driven. */
  mode: 'client' | 'server'

  /** Pagination enabled. */
  pagination: boolean
  pageSize: number
  pageSizeOptions: number[]

  /** Row height for virtual scroll (px). */
  rowHeight: number

  /** Row checkbox selection enabled. */
  rowSelection: boolean

  /** Selection mode. */
  selectionMode: 'single' | 'multiple'

  /** Column grouping enabled. */
  grouping: boolean

  /** Fullscreen toggle enabled. */
  fullscreen: boolean

  /** Expandable rows enabled. */
  expandableRows: boolean

  /** Column resize enabled. */
  columnResize: boolean

  /** Column reorder enabled. */
  columnReorder: boolean

  /** Track-by function for virtual scroll. */
  trackBy: (index: number, item: T) => unknown
}

export const DEFAULT_GRID_OPTIONS: GridOptions = {
  mode: 'client',
  pagination: true,
  pageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
  rowHeight: 48,
  rowSelection: false,
  selectionMode: 'multiple',
  grouping: false,
  fullscreen: false,
  expandableRows: false,
  columnResize: true,
  columnReorder: false,
  trackBy: (index: number) => index,
}
