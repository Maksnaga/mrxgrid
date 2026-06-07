/**
 * Defaults — central registry of magic numbers and default options.
 *
 * Mirrors Angular `models/grid-options.model.ts:DEFAULT_GRID_OPTIONS` plus the
 * scattered `DEFAULT_*` constants. Keep these in one file so a consumer that
 * forks a constant for a brand-specific theme has one place to override.
 */

import type { GridDensity } from '../models/grid-events.model'

/** Default column width in px when no `width`/`minWidth`/`flex` is specified. */
export const DEFAULT_COLUMN_WIDTH = 150

/** Default row height in px (mirrors `density: 'default'`). */
export const DEFAULT_ROW_HEIGHT = 47

/** Page size options shown in the pagination footer dropdown. */
export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

/** Default page size when `pagination` is enabled without explicit `pageSize`.
 *  Must be present in `DEFAULT_PAGE_SIZE_OPTIONS` so the rows-per-page
 *  `MSelect` can highlight the current value — otherwise it renders empty. */
export const DEFAULT_PAGE_SIZE = 25

/**
 * Density → row height map. Matches `AdeoTableMenuDrawer.vue` + the legacy
 * `DENSITY_ROW_HEIGHT` table in `AdeoGrid.vue`. Source of truth — anyone reading
 * a row height should derive from this when given a density.
 */
export const DENSITY_ROW_HEIGHT: Record<GridDensity, number> = {
  small: 25,
  default: 47,
  large: 55,
}

/** Mirrors Angular `DEFAULT_GRID_OPTIONS` from `models/grid-options.model.ts`. */
export const DEFAULT_GRID_OPTIONS = {
  mode: 'client' as const,
  pagination: true,
  pageSize: DEFAULT_PAGE_SIZE,
  pageSizeOptions: DEFAULT_PAGE_SIZE_OPTIONS,
  rowHeight: DEFAULT_ROW_HEIGHT,
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
