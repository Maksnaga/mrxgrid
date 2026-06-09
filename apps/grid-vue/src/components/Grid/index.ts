export { default as AdGridVue } from './Grid.vue'
export { default as Column } from './Column.vue'

// Body
export { default as AdGridBody } from './components/body/GridBody.vue'
export { default as AdGridSkeletonBody } from './components/body/GridSkeletonBody.vue'
export { default as AdGridSkeletonRow } from './components/body/GridSkeletonRow.vue'
export { default as AdGridDetailRow } from './components/body/GridDetailRow.vue'

// Header
export { default as AdGridHeader } from './components/header/GridHeader.vue'
export { default as AdGridHeaderCell } from './components/header/GridHeaderCell.vue'
export { default as AdGridHeaderMenu } from './components/header/GridHeaderMenu.vue'

// Footer
export { default as AdGridFooter } from './components/footer/GridFooter.vue'
export { default as AdGridLoadingIndicator } from './components/footer/GridLoadingIndicator.vue'

// Overlays
export { default as AdGridSelectionBar } from './components/overlays/GridSelectionBar.vue'
export { default as AdGridToolbar } from './components/overlays/GridToolbar.vue'
export { default as AdGridGroupingDrawer } from './components/overlays/GroupingDrawer.vue'
export { default as AdGridSettingsDrawer } from './components/overlays/TableMenuDrawer.vue'
export { default as AdGridFilterBuilder } from './components/overlays/GridFilterBuilder.vue'
export { default as AdGridFilterDrawer } from './components/overlays/GridFilterDrawer.vue'
export { default as AdGridFilterTagsBar } from './components/overlays/GridFilterTagsBar.vue'
export { default as AdGridColumnVisibilityPanel } from './components/overlays/ColumnVisibilityPanel.vue'
export { default as AdGridKeyboardShortcutsDrawer } from './components/overlays/KeyboardShortcutsDrawer.vue'
export { default as AdGridFormulaBar } from './components/overlays/FormulaBar.vue'
export { default as AdGridFormulaReferenceDrawer } from './components/overlays/FormulaReferenceDrawer.vue'

// Declarative column registry — exposed so consumers can build their own
// column-like components by registering directly.
export {
  GRID_COLUMN_REGISTRY_KEY,
  injectColumnRegistry,
  type ColumnRegistration,
  type ColumnRegistry,
} from './state/ColumnRegistry'

// Note: `defineStatusRenderer` + `BUILTIN_RENDERERS` ("tag" alias) were
// consumer-side convenience helpers (status badges, generic MTag wrapper)
// that have been moved out of the library — they live under `src/app/renderers/`
// in this repo for the StockDemo + stories. Library consumers should write
// their own renderer factories or pass any `Component` to `ColumnDef.renderer`
// directly (it accepts `Component | 'text'`).

// Variable-height virtual scroll (use when expandable rows / group rows have unknown heights).
export {
  useVariableHeightVirtualScroll,
  type VariableHeightOptions,
  type VariableHeightVirtualScroll,
} from './features/useVariableHeightVirtualScroll'

// Formula engine (§12.3) — register custom functions, query computed values,
// listen for formula edits. Active when any column has `allowFormula: true`.
export {
  useFormulaEngine,
  type FormulaEngine,
} from './features/formula/useFormulaEngine'
export { DEFAULT_FORMULA_FUNCTIONS } from './features/formula/formula-functions.default'

// Ref-highlight bridge — coordinates the formula editor with cell highlight
// rendering during edit (port of Angular `FormulaRefHighlightService`).
export {
  useRefHighlight,
  type RefHighlight,
  type PickHandler,
  type RefHighlightApi,
} from './features/formula/useRefHighlight'

// Built-in plugins. The grid's plugin API is intentionally minimal —
// these are pre-built drop-ins for cross-cutting concerns (history, etc.)
// that an app would otherwise have to wire by hand.
export {
  useUndoRedoPlugin,
  type UndoRedoPluginOptions,
} from '@/composables/useUndoRedoPlugin'

// Plugin contract — for consumers writing their own plugins.
export type { GridPlugin, GridPluginContext } from './models/plugin.model'

// Legacy Vue types + Angular-parity models (re-exported via types.ts).
export * from './types'

// Central state + pipeline (Phase 1 — Angular parity).
export { useGridState } from './state/useGridState'
export type { GridState } from './state/useGridState'
export { GRID_STATE_KEY, useGridContext } from './state/GridContext'
// Legacy alias kept to avoid breaking external consumers; new code should
// import `useGridContext` from `./state/GridContext`.
export { useGridContext as injectGridState } from './state/GridContext'
export {
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZE_OPTIONS,
  DEFAULT_GRID_OPTIONS,
  DENSITY_ROW_HEIGHT,
  MIN_COLUMN_RESIZE_WIDTH,
  INFINITE_SCROLL_THRESHOLD_PX,
} from './state/defaults'
export { useGridEngine } from './engine/useGridEngine'
export type { GridEngine } from './engine/useGridEngine'

// Server-side grouping engine — Angular-parity twin of `useServerGrouping`.
// Produces `DisplayRow<T>[]` (discriminated union from `models/display-row.model`)
// instead of the legacy `__adg`-prefixed flat `RowData` list. Lives at
// `gridEngine.serverGroup` and is exposed via `Grid.vue`'s template ref
// (`setServerGroupRoots`, `setServerGroupChildren`, `expandServerGroup`).
export {
  useServerGroupEngine,
  type ServerGroupEngine,
  type ServerGroupingOptions as ServerGroupEngineOptions,
  type GroupSummary as ServerGroupSummary,
} from './features/useServerGroupEngine'

// Composable-scoped types kept at the barrel for now. `CellEditEvent` and
// `CellEditState` remain the legacy (`useCellEditing`) shapes; the Angular-
// parity variants are available as `GridCellEditEvent` / `GridCellEditState`
// from the same barrel (re-exported via types.ts → models/cell.model).
export type { GroupEntry } from '@/composables/useGrouping'
export type { CellEditEvent, CellEditState } from '@/composables/useCellEditing'
export type { SelectionModel } from '@/composables/useRowSelection'
export type { GroupingItem } from './components/overlays/GroupingDrawer.vue'
export type { DataDensity } from './components/overlays/TableMenuDrawer.vue'
