/**
 * Filter model — multi-condition filter builder with AND/OR combinators.
 * Angular parity (moz-grid).
 *
 * Evaluation is left-associative (no operator precedence). Grouped /
 * parenthesised conditions (`(a AND b) OR c`) are out of scope for the MVP.
 *
 * Added in Phase 0 alongside the legacy `FilterDef` (types.ts) which stays
 * for backward compat. The filter engine migration happens in Phase 3.
 */

import type { Component, Raw } from 'vue'

// `ColumnDef` lives in ../types and itself imports from this file (for the
// legacy filterComponent type). We reference it via inline `import('...')`
// inside type positions to keep the dependency type-only and break the cycle.
type ColumnDefRef<T> = import('../types').ColumnDef<T>

/**
 * Filter evaluation mode, decoupled from the grid-level `mode`.
 * - `'client'` : `filterData()` evaluates conditions in-memory.
 * - `'server'` : `filterData()` passes data through; consumer reacts to
 *   `filterChange` and refreshes `:rows`.
 */
export type FilterMode = 'client' | 'server'

export type FilterDataType = 'text' | 'number' | 'date' | 'set' | 'boolean' | 'custom'

export type TextOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'blank'
  | 'notBlank'

export type NumberOperator =
  | 'equals'
  | 'notEquals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'blank'
  | 'notBlank'

export type DateOperator = NumberOperator
export type SetOperator = 'in' | 'notIn' | 'blank' | 'notBlank'
export type BooleanOperator = 'equals' | 'blank' | 'notBlank'

export type FilterOperator =
  | TextOperator
  | NumberOperator
  | DateOperator
  | SetOperator
  | BooleanOperator

export type FilterCombinator = 'and' | 'or'

export interface FilterValue {
  /** Primary value. Absent / ignored for `blank` / `notBlank`. */
  value?: unknown
  /** Upper bound for `between`. */
  valueTo?: unknown
}

export interface FilterCondition {
  /** Stable id — used for trackBy and drag-drop reordering. */
  id: string
  /** Ignored for the first condition. Rendered as "Where" in the UI. */
  combinator: FilterCombinator
  field: string
  operator: FilterOperator
  value: FilterValue
  /**
   * Opaque state for AG-Grid-style custom filters (`ColumnDef.filter`).
   *
   * Captured each time the filter component invokes
   * `params.onModelChange(value)`. The engine forwards it to
   * `filter.doesFilterPass({ model, … })` per row. Ignored for built-in
   * filter types.
   */
  model?: unknown
}

export interface FilterModel {
  conditions: FilterCondition[]
}

export type FilterChangeReason =
  | 'add'
  | 'update'
  | 'remove'
  | 'reorder'
  | 'clear'
  | 'replace'

export interface FilterEvent {
  /** Full model after mutation. */
  model: FilterModel
  /** Condition concerned by the mutation. null for `clear` / `replace`. */
  condition: FilterCondition | null
  /** Mutation kind. */
  reason: FilterChangeReason
}

export type FilterApplyMode = 'auto' | 'manual'

export interface FilterColumnDescriptor {
  field: string
  headerName: string
  filterType: FilterDataType
  operators: FilterOperator[]
  options?: { value: unknown; label: string }[]
  defaultOperator: FilterOperator
  /**
   * Full custom filter config — component + predicate + opaque params. The
   * builder mounts `filter.component` and forwards `filter.filterParams`;
   * the engine evaluates `filter.doesFilterPass` per row.
   */
  filter?: AdeoFilterConfig<unknown, unknown, unknown>
  /**
   * Reference to the source `ColumnDef` — set by the engine's
   * `describeColumn`. The builder forwards this through `AdeoFilterParams.column`
   * to the filter component. Consumers building descriptors manually (e.g.
   * in stories) can omit it; the builder falls back to a synthesised
   * minimal column shape.
   */
  colDef?: ColumnDefRef<unknown>
}

// ---------------------------------------------------------------------------
// Custom filter contract — AG-Grid style.
// ---------------------------------------------------------------------------

/**
 * A Vue component used as a custom filter UI (wrap with `markRaw()`).
 * Mounted by the builder via `<component :is>`. The component receives a
 * single `params` prop ({@link AdeoFilterParams}) bundling everything it
 * needs to read state, resolve values, and announce changes.
 */
export type AdeoFilterComponent = Raw<Component>

/**
 * Predicate that decides whether a single row passes the filter. Lives on
 * {@link AdeoFilterConfig.doesFilterPass} — **not** on the component — so
 * the predicate is column configuration, not bolted onto a constructor.
 *
 * Skip it for server-mode filtering: the grid passes rows through and the
 * consumer re-fetches on `update:filter-model`.
 */
export type AdeoDoesFilterPass<T = unknown, M = unknown> = (
  params: AdeoDoesFilterPassParams<T, M>,
) => boolean

/** Argument passed to {@link AdeoDoesFilterPass}. */
export interface AdeoDoesFilterPassParams<T = unknown, M = unknown> {
  /** Row data. */
  row: T
  /** Row index in the dataset BEFORE filtering. */
  rowIndex: number
  /** Resolves a column field to a value, honoring `valueGetter`. */
  getValue: (field: string) => unknown
  /** Current filter model (the value the component last announced). */
  model: M
  /** Column being filtered. */
  column: ColumnDefRef<T>
}

/**
 * Config object placed on `ColumnDef.filter` to plug in a custom filter.
 *
 * ```ts
 * {
 *   field: 'price',
 *   filter: {
 *     component: markRaw(PriceRangeFilter),
 *     doesFilterPass: (p) => p.getValue('price') >= p.model.min
 *                         && p.getValue('price') <= p.model.max,
 *   },
 * }
 * ```
 *
 * - `component` — the UI. Receives `params: AdeoFilterParams`, calls
 *   `params.onModelChange(newModel)` on user interaction.
 * - `doesFilterPass` — the predicate. Pure function; the grid calls it on
 *   every row.
 * - `filterParams` — opaque bag forwarded as `params.filterParams` to the
 *   component (options, async loaders, …).
 */
export interface AdeoFilterConfig<T = unknown, M = unknown, P = unknown> {
  component: AdeoFilterComponent
  doesFilterPass?: AdeoDoesFilterPass<T, M>
  filterParams?: P
  /**
   * Optional — formats the model into a human-readable string for the
   * "FILTERED BY" tag bar. Falls back to a generic formatter (array join,
   * primitive coercion, JSON for objects) when absent.
   *
   * Lives on the column config rather than the component because the tag
   * bar needs a label even when the filter is unmounted (overlay closed).
   */
  getModelAsString?: (model: M) => string
}

/**
 * The single object the builder hands to a custom filter component as its
 * `params` prop. The component reads `model` for re-hydration, calls
 * `onModelChange` to announce a new state, and uses `getValue` if it needs
 * row-level access.
 */
export interface AdeoFilterParams<T = unknown, M = unknown, P = unknown> {
  /** Current filter model (null when no filter is set). */
  model: M | null
  /** Column hosting this filter. */
  column: ColumnDefRef<T>
  /** Opaque params from `colDef.filter.filterParams`. */
  filterParams?: P
  /**
   * Resolves a column field to a value. When called with a row argument,
   * applies the column's `valueGetter`; without, returns a closed-over
   * value resolver bound to the row currently being scanned.
   */
  getValue: (field: string) => unknown
  /**
   * Component → grid: announce a new model. Pass `null` to clear the
   * filter (grid drops the condition). Triggers `doesFilterPass` re-run.
   */
  onModelChange: (model: M | null) => void
}

/**
 * Optional lifecycle methods a custom filter component may expose via
 * `defineExpose`. The grid auto-detects which ones are present.
 *
 * - `refresh(newParams)` — called when the grid's model changes from a
 *   source OTHER than the component (drawer apply, persistView restore,
 *   imperative `setFilterModel`). Return `false` to signal "can't sync,
 *   please re-mount me". `void` / `true` mean "synced fine, keep me".
 *
 * - `afterGuiAttached(params)` — fired after first mount. `params.suppressFocus`
 *   = true means the parent doesn't want this filter to steal focus.
 *
 * - `isFilterActive` — overrides the default "model != null" heuristic.
 *   Use it when a non-null model can still mean "not filtering" (e.g. an
 *   empty array, a range covering the full dataset).
 *
 * - `getModelAsString(model)` — label rendered in the "FILTERED BY" tag
 *   bar. Defaults to the column header name when absent.
 */
export interface AdeoFilterInstance<M = unknown> {
  refresh?(newParams: AdeoFilterParams<unknown, M>): boolean | void
  afterGuiAttached?(params?: { suppressFocus?: boolean }): void
  isFilterActive?(): boolean
  getModelAsString?(model: M): string
}


export interface FilterDrawerData {
  model: FilterModel
  availableColumns: FilterColumnDescriptor[]
  applyMode: FilterApplyMode
}

export interface FilterDrawerResult {
  model: FilterModel
  applied: boolean
}

export const DEFAULT_OPERATORS: Record<FilterDataType, FilterOperator[]> = {
  text: [
    'contains',
    'notContains',
    'equals',
    'notEquals',
    'startsWith',
    'endsWith',
    'blank',
    'notBlank',
  ],
  number: ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'between', 'blank', 'notBlank'],
  date: ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'between', 'blank', 'notBlank'],
  set: ['in', 'notIn', 'blank', 'notBlank'],
  boolean: ['equals', 'blank', 'notBlank'],
  // Custom filters bypass the operator picker entirely — the embedded
  // component owns its own semantics.
  custom: [],
}

export const DEFAULT_OPERATOR_PER_TYPE: Record<FilterDataType, FilterOperator> = {
  text: 'contains',
  number: 'equals',
  date: 'equals',
  set: 'in',
  boolean: 'equals',
  custom: 'equals',
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: 'contains',
  notContains: 'does not contain',
  equals: 'equals',
  notEquals: 'does not equal',
  startsWith: 'starts with',
  endsWith: 'ends with',
  gt: '>',
  gte: '\u2265',
  lt: '<',
  lte: '\u2264',
  between: 'between',
  in: 'in',
  notIn: 'not in',
  blank: 'is blank',
  notBlank: 'is not blank',
}

export const VALUELESS_OPERATORS: ReadonlySet<FilterOperator> = new Set<FilterOperator>([
  'blank',
  'notBlank',
])

export const RANGE_OPERATORS: ReadonlySet<FilterOperator> = new Set<FilterOperator>(['between'])

/** Generate a condition id without pulling in a uuid dep. */
export function generateConditionId(): string {
  return `cond-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** True when a condition has enough information to participate in evaluation. */
export function isConditionComplete(condition: FilterCondition): boolean {
  if (!condition.field) return false
  if (VALUELESS_OPERATORS.has(condition.operator)) return true
  const { value, valueTo } = condition.value
  if (value == null || value === '') return false
  if (RANGE_OPERATORS.has(condition.operator)) {
    if (valueTo == null || valueTo === '') return false
  }
  return true
}
