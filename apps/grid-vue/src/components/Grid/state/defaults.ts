/**
 * Defaults — central registry of magic numbers and default options.
 *
 * Mirrors Angular `models/grid-options.model.ts:DEFAULT_GRID_OPTIONS` plus the
 * scattered `DEFAULT_*` constants. Keep these in one file so a consumer that
 * forks a constant for a brand-specific theme has one place to override.
 */

/** Default column width in px when no `width`/`minWidth`/`flex` is specified. */
export const DEFAULT_COLUMN_WIDTH = 150

/** Default row height in px (mirrors `density: 'default'`). */
export const DEFAULT_ROW_HEIGHT = 48

/** Page size options shown in the pagination footer dropdown. */
export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

/** Default page size when `pagination` is enabled without explicit `pageSize`.
 *  Must be present in `DEFAULT_PAGE_SIZE_OPTIONS` so the rows-per-page
 *  `MSelect` can highlight the current value — otherwise it renders empty. */
export const DEFAULT_PAGE_SIZE = 25

/**
 * Density → row height map.
 *
 * Unified vocabulary matching `Grid.vue` `DENSITY_ROW_HEIGHT` and the Vue
 * `DataDensity` type (`'compact' | 'default' | 'comfortable'`). Previously used
 * the Angular-parity keys (`small / default / large`) with different pixel
 * values — reconciled here so a single canonical source of truth exists.
 *
 * Values must match the SCSS padding in `Grid.vue` body cell styles.
 */
export const DENSITY_ROW_HEIGHT: Record<'compact' | 'default' | 'comfortable', number> = {
  compact: 32,
  default: 48,
  comfortable: 64,
}

/** Mirrors Angular `DEFAULT_GRID_OPTIONS` from `models/grid-options.model.ts`. */
export const DEFAULT_GRID_OPTIONS = {
  mode: 'client' as const,
  pagination: true,
  pageSize: DEFAULT_PAGE_SIZE,
  pageSizeOptions: DEFAULT_PAGE_SIZE_OPTIONS,
  rowHeight: DEFAULT_ROW_HEIGHT, // 48 px = density 'default'
  rowSelection: false,
  selectionMode: 'multiple' as const,
  grouping: false,
  fullscreen: false,
  expandableRows: false,
  columnResize: true,
  columnReorder: false,
}

/** Min column width during drag-resize (px). */
export const MIN_COLUMN_RESIZE_WIDTH = 50

/** Infinite-scroll trigger threshold from bottom (px). */
export const INFINITE_SCROLL_THRESHOLD_PX = 200
