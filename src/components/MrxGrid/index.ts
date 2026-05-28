export { default as MrxGrid } from './MrxGrid.vue'
export { default as MrxColumn } from './MrxColumn.vue'

// Body
export { default as MrxGridBody } from './components/body/MrxGridBody.vue'
export { default as MrxGridSkeletonBody } from './components/body/MrxGridSkeletonBody.vue'
export { default as MrxGridSkeletonRow } from './components/body/MrxGridSkeletonRow.vue'
export { default as MrxGridDetailRow } from './components/body/MrxGridDetailRow.vue'

// Header
export { default as MrxGridHeader } from './components/header/MrxGridHeader.vue'
export { default as MrxGridHeaderCell } from './components/header/MrxGridHeaderCell.vue'
export { default as MrxGridHeaderMenu } from './components/header/MrxGridHeaderMenu.vue'

// Footer
export { default as MrxGridFooter } from './components/footer/MrxGridFooter.vue'
export { default as MrxGridLoadingIndicator } from './components/footer/MrxGridLoadingIndicator.vue'

// Overlays
export { default as MrxGridSelectionBar } from './components/overlays/MrxGridSelectionBar.vue'
export { default as MrxGridToolbar } from './components/overlays/MrxGridToolbar.vue'
export { default as MrxGridSmartToolbar } from './components/overlays/MrxGridSmartToolbar.vue'
export { default as MrxGroupingDrawer } from './components/overlays/MrxGroupingDrawer.vue'
export { default as MrxTableMenuDrawer } from './components/overlays/MrxTableMenuDrawer.vue'
export { default as MrxGridFilterBuilder } from './components/overlays/MrxGridFilterBuilder.vue'
export { default as MrxGridFilterDrawer } from './components/overlays/MrxGridFilterDrawer.vue'
export { default as MrxGridFilterTagsBar } from './components/overlays/MrxGridFilterTagsBar.vue'
export { default as MrxColumnVisibilityPanel } from './components/overlays/MrxColumnVisibilityPanel.vue'
export { default as MrxKeyboardShortcutsDrawer } from './components/overlays/MrxKeyboardShortcutsDrawer.vue'
export { default as MrxFormulaBar } from './components/overlays/MrxFormulaBar.vue'
export { default as MrxFormulaReferenceDrawer } from './components/overlays/MrxFormulaReferenceDrawer.vue'

// Declarative column registry — exposed so consumers can build their own
// column-like components by registering directly.
export {
  MRX_COLUMN_REGISTRY_KEY,
  injectMrxColumnRegistry,
  type MrxColumnRegistration,
  type MrxColumnRegistry,
} from './state/MrxColumnRegistry'

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
export type { MrxGridPlugin, MrxGridPluginContext } from './models/plugin.model'

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
export type { GroupingItem } from './components/overlays/MrxGroupingDrawer.vue'
export type { DataDensity } from './components/overlays/MrxTableMenuDrawer.vue'
