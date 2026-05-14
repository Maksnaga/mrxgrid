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

export type FilterDataType = 'text' | 'number' | 'date' | 'set' | 'boolean'

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
}

export const DEFAULT_OPERATOR_PER_TYPE: Record<FilterDataType, FilterOperator> = {
  text: 'contains',
  number: 'equals',
  date: 'equals',
  set: 'in',
  boolean: 'equals',
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
