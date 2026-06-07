export { default as AdeoGrid } from './AdeoGrid.vue'
export { default as AdeoColumn } from './AdeoColumn.vue'

// Body
export { default as AdeoGridBody } from './components/body/AdeoGridBody.vue'
export { default as AdeoGridSkeletonBody } from './components/body/AdeoGridSkeletonBody.vue'
export { default as AdeoGridSkeletonRow } from './components/body/AdeoGridSkeletonRow.vue'
export { default as AdeoGridDetailRow } from './components/body/AdeoGridDetailRow.vue'

// Header
export { default as AdeoGridHeader } from './components/header/AdeoGridHeader.vue'
export { default as AdeoGridHeaderCell } from './components/header/AdeoGridHeaderCell.vue'
export { default as AdeoGridHeaderMenu } from './components/header/AdeoGridHeaderMenu.vue'

// Footer
export { default as AdeoGridFooter } from './components/footer/AdeoGridFooter.vue'
export { default as AdeoGridLoadingIndicator } from './components/footer/AdeoGridLoadingIndicator.vue'

// Overlays
export { default as AdeoGridSelectionBar } from './components/overlays/AdeoGridSelectionBar.vue'
export { default as AdeoGridToolbar } from './components/overlays/AdeoGridToolbar.vue'
export { default as AdeoGridSmartToolbar } from './components/overlays/AdeoGridSmartToolbar.vue'
export { default as AdeoGroupingDrawer } from './components/overlays/AdeoGroupingDrawer.vue'
export { default as AdeoTableMenuDrawer } from './components/overlays/AdeoTableMenuDrawer.vue'
export { default as AdeoGridFilterBuilder } from './components/overlays/AdeoGridFilterBuilder.vue'
export { default as AdeoGridFilterDrawer } from './components/overlays/AdeoGridFilterDrawer.vue'
export { default as AdeoGridFilterTagsBar } from './components/overlays/AdeoGridFilterTagsBar.vue'
export { default as AdeoColumnVisibilityPanel } from './components/overlays/AdeoColumnVisibilityPanel.vue'
export { default as AdeoKeyboardShortcutsDrawer } from './components/overlays/AdeoKeyboardShortcutsDrawer.vue'
export { default as AdeoFormulaBar } from './components/overlays/AdeoFormulaBar.vue'
export { default as AdeoFormulaReferenceDrawer } from './components/overlays/AdeoFormulaReferenceDrawer.vue'

// Declarative column registry — exposed so consumers can build their own
// column-like components by registering directly.
export {
  MRX_COLUMN_REGISTRY_KEY,
  injectMrxColumnRegistry,
  type AdeoColumnRegistration,
  type AdeoColumnRegistry,
} from './state/AdeoColumnRegistry'

// Sprint 4 — built-in cell renderers + helpers.
// Use `renderer: 'tag'` for a generic MTag, or `defineStatusRenderer({...})`
// for a typed value→{label, appearance} mapping rendered as coloured chips.
export {
  defineStatusRenderer,
  type StatusAppearance,
  type StatusMeta,
} from './features/renderers/defineStatusRenderer'
export { BUILTIN_RENDERERS, type BuiltinRendererName } from './features/renderers/builtin'

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
export type { AdeoGridPlugin, AdeoGridPluginContext } from './models/plugin.model'

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

// Composable-scoped types kept at the barrel for now. `CellEditEvent` and
// `CellEditState` remain the legacy (`useCellEditing`) shapes; the Angular-
// parity variants are available as `GridCellEditEvent` / `GridCellEditState`
// from the same barrel (re-exported via types.ts → models/cell.model).
export type { GroupEntry } from '@/composables/useGrouping'
export type { CellEditEvent, CellEditState } from '@/composables/useCellEditing'
export type { SelectionModel } from '@/composables/useRowSelection'
export type { GroupingItem } from './components/overlays/AdeoGroupingDrawer.vue'
export type { DataDensity } from './components/overlays/AdeoTableMenuDrawer.vue'
