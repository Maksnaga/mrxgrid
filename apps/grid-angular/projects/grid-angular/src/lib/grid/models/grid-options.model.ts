export interface GridOptions<T = unknown> {
  /** Data mode */
  mode: 'client' | 'server';

  /** Pagination */
  pagination: boolean;
  pageSize: number;
  pageSizeOptions: number[];

  /** Row height for virtual scroll (px) */
  rowHeight: number;

  /** Enable row checkbox selection */
  rowSelection: boolean;

  /** Selection mode */
  selectionMode: 'single' | 'multiple';

  /** Enable column grouping */
  grouping: boolean;

  /** Enable fullscreen toggle */
  fullscreen: boolean;

  /** Enable expandable rows */
  expandableRows: boolean;

  /** Enable column resize */
  columnResize: boolean;

  /** Enable column reorder */
  columnReorder: boolean;

  /** Show or hide the toolbar. Defaults to true. */
  showToolbar?: boolean;

  /** Enable multi-cell selection (click / drag range / keyboard navigation). Defaults to true. */
  multiCellSelection?: boolean;

  /** Track by function for virtual scroll */
  trackBy: (index: number, item: T) => unknown;
}

export const DEFAULT_GRID_OPTIONS: GridOptions = {
  mode: 'client',
  pagination: true,
  pageSize: 25,
  pageSizeOptions: [10, 25, 50, 100],
  rowHeight: 48,
  rowSelection: false,
  selectionMode: 'multiple',
  grouping: false,
  fullscreen: false,
  expandableRows: false,
  columnResize: true,
  columnReorder: false,
  showToolbar: true,
  multiCellSelection: true,
  trackBy: (index: number) => index,
};
