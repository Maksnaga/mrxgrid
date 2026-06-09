/**
 * Filter engine — Angular parity (moz-grid / `FilterEngine`).
 *
 * Reads / writes the central `GridState`:
 * - `state.filterModel`       — multi-condition AND/OR builder
 * - `state.pageIndex`         — reset to 0 on every mutation
 * - `state.sourceData`        — inference source for `set` filter options
 * - `state.columnDefMap`      — resolves `valueGetter`, `filterType`, etc.
 *
 * Evaluation is **left-associative** (no parenthesised grouping). A condition
 * whose `value` is incomplete (null/empty for non-valueless operators) is
 * dropped before evaluation. Server mode bypasses filtering entirely — the
 * grid shell forwards the model to the consumer.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { GridState } from '../state/useGridState'
import type { ColumnDef, RowData } from '../types'
import {
  DEFAULT_OPERATORS,
  DEFAULT_OPERATOR_PER_TYPE,
  OPERATOR_LABELS,
  RANGE_OPERATORS,
  VALUELESS_OPERATORS,
  generateConditionId,
  isConditionComplete,
  type FilterChangeReason,
  type FilterColumnDescriptor,
  type FilterCondition,
  type FilterDataType,
  type FilterEvent,
  type FilterModel,
  type FilterOperator,
  type FilterValue,
} from '../models/filter.model'

type Predicate = (cell: unknown, value: FilterValue) => boolean

export interface FilterEngine<T = RowData> {
  readonly conditions: ComputedRef<FilterCondition[]>
  readonly hasActiveFilters: ComputedRef<boolean>
  readonly lastEvent: Ref<FilterEvent | null>
  setModel(model: FilterModel, reason?: FilterChangeReason): void
  addCondition(condition: FilterCondition): void
  updateCondition(id: string, patch: Partial<FilterCondition>): void
  removeCondition(id: string): void
  reorderConditions(fromIndex: number, toIndex: number): void
  clearAll(): void
  removeByField(field: string): void
  filterData(data: T[]): T[]
  toLabel(condition: FilterCondition): string
  getFilterType(field: string): FilterDataType
  describeFilterableColumns(): FilterColumnDescriptor[]
  describeColumn(def: ColumnDef<T>): FilterColumnDescriptor
  makeCondition(
    field: string,
    isFirst: boolean,
    overrides?: Partial<FilterCondition>,
  ): FilterCondition
}

export function useFilterEngine<T = RowData>(state: GridState<T>): FilterEngine<T> {
  const lastEvent = ref<FilterEvent | null>(null)

  const conditions = computed<FilterCondition[]>(() => state.filterModel.value.conditions)
  const hasActiveFilters = computed<boolean>(() => conditions.value.length > 0)

  function notify(reason: FilterChangeReason, condition: FilterCondition | null): void {
    lastEvent.value = {
      model: { conditions: state.filterModel.value.conditions.slice() },
      condition,
      reason,
    }
  }

  function setModel(model: FilterModel, reason: FilterChangeReason = 'replace'): void {
    state.filterModel.value = { conditions: [...model.conditions] }
    state.pageIndex.value = 0
    notify(reason, null)
  }

  function addCondition(condition: FilterCondition): void {
    state.filterModel.value = {
      conditions: [...state.filterModel.value.conditions, condition],
    }
    state.pageIndex.value = 0
    notify('add', condition)
  }

  function updateCondition(id: string, patch: Partial<FilterCondition>): void {
    let updated: FilterCondition | null = null
    state.filterModel.value = {
      conditions: state.filterModel.value.conditions.map((c) => {
        if (c.id !== id) return c
        const next: FilterCondition = {
          ...c,
          ...patch,
          value: { ...c.value, ...patch.value },
        }
        updated = next
        return next
      }),
    }
    state.pageIndex.value = 0
    if (updated) notify('update', updated)
  }

  function removeCondition(id: string): void {
    const removed =
      state.filterModel.value.conditions.find((c) => c.id === id) ?? null
    state.filterModel.value = {
      conditions: state.filterModel.value.conditions.filter((c) => c.id !== id),
    }
    state.pageIndex.value = 0
    notify('remove', removed)
  }

  function reorderConditions(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return
    const next = [...state.filterModel.value.conditions]
    const [item] = next.splice(fromIndex, 1)
    if (!item) return
    next.splice(toIndex, 0, item)
    state.filterModel.value = { conditions: next }
    state.pageIndex.value = 0
    notify('reorder', null)
  }

  function clearAll(): void {
    if (state.filterModel.value.conditions.length === 0) return
    state.filterModel.value = { conditions: [] }
    state.pageIndex.value = 0
    notify('clear', null)
  }

  function removeByField(field: string): void {
    const before = state.filterModel.value.conditions
    const after = before.filter((c) => c.field !== field)
    if (after.length === before.length) return
    state.filterModel.value = { conditions: after }
    state.pageIndex.value = 0
    notify('replace', null)
  }

  function filterData(data: T[]): T[] {
    if (state.filterMode.value === 'server') return data

    // Quick filters (filter row) and the formal filterModel (drawer +
    // per-column overlay) live in independent state slots and compose
    // here at evaluation time. Both must pass for a row to survive —
    // matching the legacy AG-Grid / Mozaic behaviour where the inline
    // filter row narrows the dataset on top of any builder conditions.
    const defMap = state.columnDefMap.value
    const quickEntries = quickFilterEntries(state, defMap)

    const formal = state.filterModel.value.conditions.filter((c) =>
      isComplete(c, defMap.get(c.field)),
    )
    const formalPrepared = formal.map((c) => {
      const col = defMap.get(c.field)
      return { cond: c, col, type: resolveFilterType(col) }
    })

    if (quickEntries.length === 0 && formalPrepared.length === 0) return data

    return data.filter((row, rowIndex) => {
      // Quick filters always AND together — no combinator UI for them.
      for (const q of quickEntries) {
        if (!matchOne(row, q.cond, q.col, q.type)) return false
      }
      if (formalPrepared.length === 0) return true
      const first = formalPrepared[0]!
      let pass = matchFormal(row, rowIndex, first)
      for (let i = 1; i < formalPrepared.length; i++) {
        const step = formalPrepared[i]!
        const result = matchFormal(row, rowIndex, step)
        pass = step.cond.combinator === 'and' ? pass && result : pass || result
      }
      return pass
    })
  }

  /**
   * Completion check for a condition.
   *
   * - Built-in filter types defer to the public `isConditionComplete`.
   * - Custom filters: presence of `condition.model` is the signal — the
   *   builder only writes it when `instance.isFilterActive()` is true.
   */
  function isComplete(condition: FilterCondition, col: ColumnDef<T> | undefined): boolean {
    if (resolveFilterType(col) === 'custom') {
      if (!condition.field) return false
      return condition.model != null
    }
    return isConditionComplete(condition)
  }

  function toLabel(condition: FilterCondition): string {
    const def = state.columnDefMap.value.get(condition.field)
    const col = def?.headerName ?? condition.field

    // Custom filter — read from `condition.model` (the AG-Grid contract's
    // storage slot) and let the column-level `getModelAsString` format it.
    // Falls back to a generic renderer (array → "a, b", object → JSON,
    // primitive → String(v)).
    const customCfg = getCustomFilterConfig(def)
    if (customCfg) {
      const formatted =
        customCfg.getModelAsString?.(condition.model) ??
        formatModelGeneric(condition.model)
      return formatted ? `${col}: ${formatted}` : col
    }

    const op = OPERATOR_LABELS[condition.operator] ?? condition.operator

    if (VALUELESS_OPERATORS.has(condition.operator)) {
      return `${col} ${op}`
    }
    const value = formatValue(condition.value.value, def)
    if (RANGE_OPERATORS.has(condition.operator)) {
      const to = formatValue(condition.value.valueTo, def)
      return `${col} ${op} ${value} – ${to}`
    }
    return `${col} ${op} ${value}`
  }

  function getFilterType(field: string): FilterDataType {
    return resolveFilterType(state.columnDefMap.value.get(field))
  }

  function describeFilterableColumns(): FilterColumnDescriptor[] {
    return state.columnDefs.value
      .filter((d) => d.filterable)
      .map((d) => describeColumn(d))
  }

  function describeColumn(def: ColumnDef<T>): FilterColumnDescriptor {
    const customFilter = getCustomFilterConfig(def)
    if (customFilter) {
      // Custom filter — the config carries everything (component + predicate
      // + opaque params). The builder mounts the component and hides the
      // operator picker; the engine routes evaluation to `doesFilterPass`.
      return {
        field: def.field,
        headerName: def.headerName ?? def.field,
        filterType: 'custom',
        operators: [],
        defaultOperator: 'equals',
        filter: customFilter as unknown as import('../models/filter.model').AdeoFilterConfig<
          unknown,
          unknown,
          unknown
        >,
        // Forward the source ColumnDef so the builder can hand it to the
        // filter component as `params.column`. Cast widens T → unknown
        // since the descriptor type is non-generic.
        colDef: def as ColumnDef<unknown>,
      }
    }
    const type = resolveFilterType(def)
    const operators =
      def.filterOperators && def.filterOperators.length > 0
        ? def.filterOperators
        : DEFAULT_OPERATORS[type]
    const defaultOp = def.defaultFilterOperator ?? DEFAULT_OPERATOR_PER_TYPE[type]
    return {
      field: def.field,
      headerName: def.headerName ?? def.field,
      filterType: type,
      operators,
      defaultOperator: operators.includes(defaultOp) ? defaultOp : operators[0]!,
      options: def.filterOptions ?? inferOptionsFromData(state.sourceData.value, def, type),
    }
  }

  function makeCondition(
    field: string,
    _isFirst: boolean,
    overrides: Partial<FilterCondition> = {},
  ): FilterCondition {
    const def = state.columnDefMap.value.get(field)
    const descriptor = def ? describeColumn(def) : null
    return {
      id: generateConditionId(),
      combinator: 'and',
      field,
      operator: descriptor?.defaultOperator ?? 'contains',
      value: {},
      ...overrides,
    }
  }

  return {
    conditions,
    hasActiveFilters,
    lastEvent,
    setModel,
    addCondition,
    updateCondition,
    removeCondition,
    reorderConditions,
    clearAll,
    removeByField,
    filterData,
    toLabel,
    getFilterType,
    describeFilterableColumns,
    describeColumn,
    makeCondition,
  }
}

// --------------------------------------------------------------------
// Pure helpers
// --------------------------------------------------------------------

interface QuickEntry<T> {
  cond: FilterCondition
  col: ColumnDef<T> | undefined
  type: FilterDataType
}

/** Project `gridState.quickFilters` (filter row inputs) into the same
 *  `{ cond, col, type }` triples used for the formal model. Each non-empty
 *  entry yields zero, one or two synthetic conditions depending on the
 *  column's `filter.type` (text → contains, select → equals, date range
 *  → between/gte/lte). These conditions are AND-only — the row UI has no
 *  combinator picker. */
/**
 * Default formatter for a custom-filter model in the tag bar.
 * Arrays join with ", ", objects round-trip through JSON, primitives
 * coerce via String. Returns the empty string for null/undefined.
 */
function formatModelGeneric(model: unknown): string {
  if (model == null) return ''
  if (Array.isArray(model)) return model.join(', ')
  if (typeof model === 'object') {
    try {
      return JSON.stringify(model)
    } catch {
      return ''
    }
  }
  return String(model)
}

function quickFilterEntries<T>(
  state: GridState<T>,
  defMap: Map<string, ColumnDef<T>>,
): QuickEntry<T>[] {
  const out: QuickEntry<T>[] = []
  const quick = state.quickFilters.value
  for (const field of Object.keys(quick)) {
    const value = quick[field]
    if (!isQuickFilterValueSet(value)) continue
    const col = defMap.get(field)
    // `col.filter` is a union — only the inline FilterDef shape carries
    // `type`. Narrow before reading so the union doesn't surface here.
    const inline = col?.filter && 'type' in col.filter ? col.filter : undefined
    const filterType = inline?.type
    const condType = resolveFilterType(col)

    if (filterType === 'date' && isDateRangeQuick(value)) {
      const { from, to } = value
      if (from != null && to != null) {
        out.push({
          cond: synthetic(field, 'between', { value: from, valueTo: to }),
          col,
          type: condType,
        })
      } else if (from != null) {
        out.push({ cond: synthetic(field, 'gte', { value: from }), col, type: condType })
      } else if (to != null) {
        out.push({ cond: synthetic(field, 'lte', { value: to }), col, type: condType })
      }
      continue
    }

    if (filterType === 'select') {
      out.push({ cond: synthetic(field, 'equals', { value }), col, type: condType })
      continue
    }

    out.push({ cond: synthetic(field, 'contains', { value }), col, type: condType })
  }
  return out
}

function synthetic(field: string, operator: FilterOperator, v: FilterValue): FilterCondition {
  return {
    id: `quick-${field}-${operator}`,
    combinator: 'and',
    field,
    operator,
    value: v,
  }
}

function isQuickFilterValueSet(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string' && v.trim() === '') return false
  if (isDateRangeQuick(v) && v.from == null && v.to == null) return false
  return true
}

function isDateRangeQuick(
  v: unknown,
): v is { from: string | null; to: string | null } {
  return typeof v === 'object' && v !== null && 'from' in v && 'to' in v
}

/**
 * Returns the custom filter config carried on `col.filter` when it has the
 * AG-Grid-style shape (presence of `component`). When `col.filter` is the
 * inline `FilterDef` shape (presence of `type`) — or absent — returns
 * `undefined`. The two shapes are statically distinguishable because they
 * share no required field.
 */
function getCustomFilterConfig<T>(
  def: ColumnDef<T> | undefined,
):
  | import('../models/filter.model').AdeoFilterConfig<T, unknown, unknown>
  | undefined {
  const f = def?.filter
  if (!f) return undefined
  if ('component' in f) {
    return f as import('../models/filter.model').AdeoFilterConfig<T, unknown, unknown>
  }
  return undefined
}

function resolveFilterType<T>(def: ColumnDef<T> | undefined): FilterDataType {
  if (!def) return 'text'
  if (getCustomFilterConfig(def)) return 'custom'
  if (def.filterType) return def.filterType
  switch (def.cellEditor) {
    case 'number':
      return 'number'
    case 'date':
      return 'date'
    case 'select':
      return 'set'
    case 'checkbox':
    case 'toggle':
      return 'boolean'
    default:
      return 'text'
  }
}

function matchOne<T>(
  row: T,
  condition: FilterCondition,
  col: ColumnDef<T> | undefined,
  type: FilterDataType,
): boolean {
  const raw = col?.valueGetter
    ? col.valueGetter(row)
    : (row as unknown as Record<string, unknown>)[condition.field]

  const predicate = PREDICATES[type]?.[condition.operator]
  if (!predicate) return true
  return predicate(raw, condition.value)
}

/**
 * Evaluates a formal-model condition.
 *
 * - Built-in types route to `matchOne`.
 * - Custom filters route to `col.filter.doesFilterPass(params)` — pure
 *   function declared in the column config (NOT bolted on the component).
 *   A custom condition with no predicate is inert (returns `true`) — the
 *   expected shape in `filter-mode="server"`.
 */
function matchFormal<T>(
  row: T,
  rowIndex: number,
  item: { cond: FilterCondition; col: ColumnDef<T> | undefined; type: FilterDataType },
): boolean {
  if (item.type === 'custom') {
    const cfg = getCustomFilterConfig(item.col)
    if (!cfg?.doesFilterPass) return true
    if (item.cond.model == null) return true
    const getValue = (field: string): unknown => {
      const c = item.col
      if (c?.valueGetter && field === c.field) return c.valueGetter(row)
      return (row as unknown as Record<string, unknown>)[field]
    }
    // `cfg.doesFilterPass` is typed `<T>` over the column's generic; the
    // call-site already narrows `item.col` to the matching shape, but TS
    // can't track that through the union → narrow via cast.
    const params = {
      row,
      rowIndex,
      getValue,
      model: item.cond.model,
      column: item.col as ColumnDef<T>,
    }
    return (cfg.doesFilterPass as (p: typeof params) => boolean)(params)
  }
  return matchOne(row, item.cond, item.col, item.type)
}

function formatValue<T>(value: unknown, def: ColumnDef<T> | undefined): string {
  if (value == null || value === '') return ''
  if (Array.isArray(value)) {
    return value.map((v) => formatSingleOption(v, def)).join(', ')
  }
  return formatSingleOption(value, def)
}

function formatSingleOption<T>(value: unknown, def: ColumnDef<T> | undefined): string {
  if (def?.filterOptions) {
    const opt = def.filterOptions.find((o) => String(o.value) === String(value))
    if (opt) return String(opt.label)
  }
  return String(value)
}

function inferOptionsFromData<T>(
  data: T[],
  def: ColumnDef<T>,
  type: FilterDataType,
): { value: unknown; label: string }[] | undefined {
  if (type !== 'set') return undefined
  const seen = new Set<string>()
  const out: { value: unknown; label: string }[] = []
  for (const row of data) {
    const v = def.valueGetter
      ? def.valueGetter(row)
      : (row as unknown as Record<string, unknown>)[def.field]
    if (v == null) continue
    const key = String(v)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ value: v, label: key })
    if (out.length >= 200) break
  }
  return out
}

// --------------------------------------------------------------------
// Predicate table — dispatched by (filterType, operator)
// --------------------------------------------------------------------

const textContains: Predicate = (cell, { value }) =>
  String(cell ?? '')
    .toLowerCase()
    .includes(String(value ?? '').toLowerCase())
const textNotContains: Predicate = (cell, v) => !textContains(cell, v)
const textEquals: Predicate = (cell, { value }) =>
  String(cell ?? '').toLowerCase() === String(value ?? '').toLowerCase()
const textNotEquals: Predicate = (cell, v) => !textEquals(cell, v)
const textStartsWith: Predicate = (cell, { value }) =>
  String(cell ?? '')
    .toLowerCase()
    .startsWith(String(value ?? '').toLowerCase())
const textEndsWith: Predicate = (cell, { value }) =>
  String(cell ?? '')
    .toLowerCase()
    .endsWith(String(value ?? '').toLowerCase())

const blank: Predicate = (cell) => cell == null || cell === ''
const notBlank: Predicate = (cell) => !blank(cell, { value: undefined })

const numEquals: Predicate = (cell, { value }) => toNum(cell) === toNum(value)
const numNotEquals: Predicate = (cell, v) => !numEquals(cell, v)
const numGt: Predicate = (cell, { value }) => toNum(cell) > toNum(value)
const numGte: Predicate = (cell, { value }) => toNum(cell) >= toNum(value)
const numLt: Predicate = (cell, { value }) => toNum(cell) < toNum(value)
const numLte: Predicate = (cell, { value }) => toNum(cell) <= toNum(value)
const numBetween: Predicate = (cell, { value, valueTo }) => {
  const n = toNum(cell)
  return n >= toNum(value) && n <= toNum(valueTo)
}

const dateEquals: Predicate = (cell, { value }) => toTime(cell) === toTime(value)
const dateNotEquals: Predicate = (cell, v) => !dateEquals(cell, v)
const dateGt: Predicate = (cell, { value }) => toTime(cell) > toTime(value)
const dateGte: Predicate = (cell, { value }) => toTime(cell) >= toTime(value)
const dateLt: Predicate = (cell, { value }) => toTime(cell) < toTime(value)
const dateLte: Predicate = (cell, { value }) => toTime(cell) <= toTime(value)
const dateBetween: Predicate = (cell, { value, valueTo }) => {
  const t = toTime(cell)
  return t >= toTime(value) && t <= toTime(valueTo)
}

const setIn: Predicate = (cell, { value }) => {
  const arr = Array.isArray(value) ? value : [value]
  if (arr.length === 0) return true
  return arr.some((v) => String(v) === String(cell))
}
const setNotIn: Predicate = (cell, v) => !setIn(cell, v)

const boolEquals: Predicate = (cell, { value }) => {
  const expected = value === true || value === 'true' || value === 1
  const actual = cell === true || cell === 'true' || cell === 1
  return expected === actual
}

function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : NaN
}

function toTime(v: unknown): number {
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const parsed = Date.parse(v)
    return Number.isFinite(parsed) ? parsed : NaN
  }
  return NaN
}

const PREDICATES: Record<FilterDataType, Partial<Record<FilterOperator, Predicate>>> = {
  text: {
    contains: textContains,
    notContains: textNotContains,
    equals: textEquals,
    notEquals: textNotEquals,
    startsWith: textStartsWith,
    endsWith: textEndsWith,
    blank,
    notBlank,
  },
  number: {
    equals: numEquals,
    notEquals: numNotEquals,
    gt: numGt,
    gte: numGte,
    lt: numLt,
    lte: numLte,
    between: numBetween,
    blank,
    notBlank,
  },
  date: {
    equals: dateEquals,
    notEquals: dateNotEquals,
    gt: dateGt,
    gte: dateGte,
    lt: dateLt,
    lte: dateLte,
    between: dateBetween,
    blank,
    notBlank,
  },
  set: {
    in: setIn,
    notIn: setNotIn,
    blank,
    notBlank,
  },
  boolean: {
    equals: boolEquals,
    blank,
    notBlank,
  },
  // Custom filters bypass this table entirely — `matchFormal` delegates to
  // `col.filter.doesFilterPass` before any lookup here.
  custom: {},
}
