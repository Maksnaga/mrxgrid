/**
 * Filter model — multi-condition filter builder with AND/OR combinators.
 *
 * Evaluation is left-associative (no operator precedence). Grouped / parenthesised
 * conditions (`(a AND b) OR c`) are out of scope for the MVP; see docs.
 */

import { InputSignal, OutputEmitterRef, Type } from '@angular/core';

/** Controls where filter evaluation happens. */
export type FilterMode = 'client' | 'server';

export type FilterDataType = 'text' | 'number' | 'date' | 'set' | 'boolean' | 'custom';

export type TextOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'blank'
  | 'notBlank';

export type NumberOperator =
  | 'equals'
  | 'notEquals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'blank'
  | 'notBlank';

export type DateOperator = NumberOperator;
export type SetOperator = 'in' | 'notIn' | 'blank' | 'notBlank';
export type BooleanOperator = 'equals' | 'blank' | 'notBlank';

export type FilterOperator =
  | TextOperator
  | NumberOperator
  | DateOperator
  | SetOperator
  | BooleanOperator;

export type FilterCombinator = 'and' | 'or';

export interface FilterValue {
  /** Primary value. Absent / ignored for `blank` / `notBlank`. */
  value?: unknown;
  /** Upper bound for `between`. */
  valueTo?: unknown;
}

export interface FilterCondition {
  /** Stable identifier — used for trackBy and drag-drop reordering. */
  id: string;
  /** Ignored for the first condition. Rendered as "Where" in the UI. */
  combinator: FilterCombinator;
  field: string;
  operator: FilterOperator;
  value: FilterValue;
}

export interface FilterModel {
  conditions: FilterCondition[];
}

export type FilterChangeReason =
  | 'add'
  | 'update'
  | 'remove'
  | 'reorder'
  | 'clear'
  | 'replace';

/**
 * Payload emitted whenever the filter model changes. Replaces the legacy
 * `{ filters: ActiveFilter[] }` shape.
 */
export interface FilterEvent {
  /** Full model after mutation. */
  model: FilterModel;
  /** Condition concerned by the mutation. null for `clear` / `replace`. */
  condition: FilterCondition | null;
  /** Mutation kind. */
  reason: FilterChangeReason;
}

/** Drawer data / result for the Filters drawer (toolbar). */
export interface FilterDrawerData {
  model: FilterModel;
  availableColumns: FilterColumnDescriptor[];
  applyMode: FilterApplyMode;
}

export interface FilterDrawerResult {
  model: FilterModel;
  applied: boolean;
}

export type FilterApplyMode = 'auto' | 'manual';

/**
 * Base class for custom filter components. Extend this class and declare:
 *   readonly condition = input.required<FilterCondition>();
 *   readonly conditionChange = output<FilterValue>();
 *
 * The filter builder instantiates the component via ViewContainerRef and wires
 * the inputs/outputs automatically — the component has no dependency on the grid.
 */
export abstract class AdeoGridCustomFilter {
  abstract readonly condition: InputSignal<FilterCondition>;
  abstract readonly conditionChange: OutputEmitterRef<FilterValue>;
}

/** Minimal column info the builder needs to render labels, operators and value editors. */
export interface FilterColumnDescriptor {
  field: string;
  headerName: string;
  filterType: FilterDataType;
  operators: FilterOperator[];
  options?: { value: unknown; label: string }[];
  defaultOperator: FilterOperator;
  /** Custom component rendered in the builder for filterType === 'custom'. */
  filterComponent?: Type<AdeoGridCustomFilter>;
  /** Override for completion check. Defaults to value.value != null && !== ''. */
  filterIsComplete?: (value: FilterValue) => boolean;
}

/**
 * Default operator sets per data type. Consumers can restrict the set via
 * `ColumnDef.filterOperators`.
 */
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
  custom: [],
};

export const DEFAULT_OPERATOR_PER_TYPE: Record<FilterDataType, FilterOperator> = {
  text: 'contains',
  number: 'equals',
  date: 'equals',
  set: 'in',
  boolean: 'equals',
  custom: 'equals',
};

/** Human-readable operator labels (used by `toLabel`). */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: 'contains',
  notContains: 'does not contain',
  equals: 'equals',
  notEquals: 'does not equal',
  startsWith: 'starts with',
  endsWith: 'ends with',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: 'between',
  in: 'in',
  notIn: 'not in',
  blank: 'is blank',
  notBlank: 'is not blank',
};

/** Operators that do not require a user-entered value. */
export const VALUELESS_OPERATORS: ReadonlySet<FilterOperator> = new Set<FilterOperator>([
  'blank',
  'notBlank',
]);

/** Operators that need a secondary value (`between`). */
export const RANGE_OPERATORS: ReadonlySet<FilterOperator> = new Set<FilterOperator>(['between']);

/** Small helper for generating condition ids without pulling in a uuid dep. */
export function generateConditionId(): string {
  return `cond-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** True when a condition has enough information to participate in evaluation. */
export function isConditionComplete(condition: FilterCondition): boolean {
  if (!condition.field) return false;
  if (VALUELESS_OPERATORS.has(condition.operator)) return true;
  const { value, valueTo } = condition.value;
  if (value == null || value === '') return false;
  if (RANGE_OPERATORS.has(condition.operator)) {
    if (valueTo == null || valueTo === '') return false;
  }
  return true;
}
