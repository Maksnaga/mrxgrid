import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { ColumnDef } from '../models/column.model';
import {
  DEFAULT_OPERATORS,
  DEFAULT_OPERATOR_PER_TYPE,
  FilterChangeReason,
  FilterColumnDescriptor,
  FilterCondition,
  FilterDataType,
  FilterEvent,
  FilterModel,
  FilterOperator,
  FilterValue,
  OPERATOR_LABELS,
  RANGE_OPERATORS,
  VALUELESS_OPERATORS,
  generateConditionId,
  isConditionComplete,
} from '../models/filter.model';

type PreparedCondition<T> = { cond: FilterCondition; col: ColumnDef<T> | undefined; type: FilterDataType };

type Predicate = (cell: unknown, value: FilterValue) => boolean;

@Injectable()
export class FilterEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  /** Latest mutation, used by the grid shell to emit `filterChange` once. */
  private readonly lastChange = signal<FilterEvent | null>(null);

  readonly conditions: Signal<FilterCondition[]> = computed(
    () => this.state.filterModel().conditions
  );

  readonly hasActiveFilters = computed(
    () =>
      this.conditions().length > 0 ||
      Object.values(this.state.quickFilters()).some((v) => v != null && v !== ''),
  );

  readonly lastEvent = this.lastChange.asReadonly();

  // ------------------------------------------------------------------
  // Mutations
  // ------------------------------------------------------------------

  /** Replaces the whole model in one go. Used by the drawer's Apply button. */
  setModel(model: FilterModel, reason: FilterChangeReason = 'replace'): void {
    this.state.filterModel.set({ conditions: [...model.conditions] });
    this.state.pageIndex.set(0);
    this.notify(reason, null);
  }

  addCondition(condition: FilterCondition): void {
    this.state.filterModel.update((m) => ({
      conditions: [...m.conditions, condition],
    }));
    this.state.pageIndex.set(0);
    this.notify('add', condition);
  }

  updateCondition(id: string, patch: Partial<FilterCondition>): void {
    let updated: FilterCondition | null = null;
    this.state.filterModel.update((m) => ({
      conditions: m.conditions.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch, value: { ...c.value, ...(patch.value ?? {}) } };
        updated = next;
        return next;
      }),
    }));
    this.state.pageIndex.set(0);
    if (updated) this.notify('update', updated);
  }

  removeCondition(id: string): void {
    const removed = this.state.filterModel().conditions.find((c) => c.id === id) ?? null;
    this.state.filterModel.update((m) => ({
      conditions: m.conditions.filter((c) => c.id !== id),
    }));
    this.state.pageIndex.set(0);
    this.notify('remove', removed);
  }

  reorderConditions(fromIndex: number, toIndex: number): void {
    this.state.filterModel.update((m) => {
      if (fromIndex === toIndex) return m;
      const next = [...m.conditions];
      const [item] = next.splice(fromIndex, 1);
      if (!item) return m;
      next.splice(toIndex, 0, item);
      return { conditions: next };
    });
    this.state.pageIndex.set(0);
    this.notify('reorder', null);
  }

  clearAll(): void {
    if (this.state.filterModel().conditions.length === 0) return;
    this.state.filterModel.set({ conditions: [] });
    this.state.pageIndex.set(0);
    this.notify('clear', null);
  }

  /** Convenience: drop all conditions that target a given field. */
  removeByField(field: string): void {
    const before = this.state.filterModel().conditions;
    const after = before.filter((c) => c.field !== field);
    if (after.length === before.length) return;
    this.state.filterModel.set({ conditions: after });
    this.state.pageIndex.set(0);
    this.notify('replace', null);
  }

  /**
   * Quick filters — per-column inline inputs (rendered by the
   * `<ad-grid-quick-filter-row>` component above the body). Independent
   * of the builder model: composed at evaluation time with AND semantics.
   * Set an empty / nullish value to clear the entry.
   */
  setQuickFilter(field: string, value: string | null | undefined): void {
    this.state.quickFilters.update((cur) => {
      const next = { ...cur };
      if (value == null || value === '') {
        delete next[field];
      } else {
        next[field] = value;
      }
      return next;
    });
    this.state.pageIndex.set(0);
  }

  /** Returns the current quick-filter value for the given column, or `''`. */
  getQuickFilter(field: string): string {
    return this.state.quickFilters()[field] ?? '';
  }

  /** Clears every quick-filter input in one go. */
  clearQuickFilters(): void {
    if (Object.keys(this.state.quickFilters()).length === 0) return;
    this.state.quickFilters.set({});
    this.state.pageIndex.set(0);
  }

  /**
   * Drops conditions whose value is not yet complete. Called when a filter
   * builder is dismissed: a row the user added but never filled in must not
   * linger in the model as a phantom active filter.
   */
  dropIncompleteConditions(): void {
    const defMap = this.state.columnDefMap();
    const before = this.state.filterModel().conditions;
    const after = before.filter((c) => this.isComplete(c, defMap.get(c.field)));
    if (after.length === before.length) return;
    this.state.filterModel.set({ conditions: after });
    this.state.pageIndex.set(0);
    this.notify('replace', null);
  }

  // ------------------------------------------------------------------
  // Evaluation
  // ------------------------------------------------------------------

  /**
   * Evaluates the current model against the provided data.
   * In `server` filterMode the grid delegates filtering to the consumer — returns input as-is.
   *
   * Quick filters (per-column inline inputs) and builder conditions live in
   * independent state slots. They are composed here at evaluation time: a
   * row survives iff (every quick filter passes) AND (the builder model
   * passes). Quick filters always AND together — there is no combinator
   * picker on the inline row. This matches the Vue grid's behaviour.
   */
  filterData(data: T[]): T[] {
    if (this.state.filterMode() === 'server') return data;

    const defMap = this.state.columnDefMap();
    const conditions = this.state.filterModel().conditions.filter((c) =>
      this.isComplete(c, defMap.get(c.field))
    );

    const quickFilters = this.state.quickFilters();
    const quickFields = Object.keys(quickFilters).filter((f) => {
      const v = quickFilters[f];
      return v != null && v !== '';
    });

    if (conditions.length === 0 && quickFields.length === 0) return data;

    const prepared: PreparedCondition<T>[] = conditions.map((c) => ({
      cond: c,
      col: defMap.get(c.field),
      type: resolveFilterType(defMap.get(c.field)),
    }));

    return data.filter((row) => {
      // Quick filters first — bail out as soon as one fails (cheap AND).
      for (const field of quickFields) {
        const col = defMap.get(field);
        const raw = col?.valueGetter
          ? col.valueGetter(row)
          : (row as Record<string, unknown>)[field];
        const needle = String(quickFilters[field]).toLowerCase();
        if (!String(raw ?? '').toLowerCase().includes(needle)) return false;
      }
      if (prepared.length === 0) return true;
      let pass = this.matchRow(row, prepared[0]);
      for (let i = 1; i < prepared.length; i++) {
        const result = this.matchRow(row, prepared[i]);
        pass = prepared[i].cond.combinator === 'and' ? pass && result : pass || result;
      }
      return pass;
    });
  }

  private isComplete(condition: FilterCondition, col: ColumnDef<T> | undefined): boolean {
    if (resolveFilterType(col) === 'custom') {
      const fn = col?.filterIsComplete;
      return fn
        ? fn(condition.value)
        : condition.value.value != null && condition.value.value !== '';
    }
    return isConditionComplete(condition);
  }

  private matchRow(row: T, item: PreparedCondition<T>): boolean {
    if (item.type === 'custom') {
      const fn = item.col?.filterPredicate;
      return fn ? fn(row, item.cond.value) : true;
    }
    return matchOne(row, item.cond, item.col, item.type);
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** Returns a human-readable label for a condition ("Status equals En stock"). */
  toLabel(condition: FilterCondition): string {
    const def = this.state.columnDefMap().get(condition.field);
    const col = def?.headerName ?? condition.field;
    const op = OPERATOR_LABELS[condition.operator] ?? condition.operator;

    if (VALUELESS_OPERATORS.has(condition.operator)) {
      return `${col} ${op}`;
    }
    const value = formatValue(condition.value.value, def);
    if (RANGE_OPERATORS.has(condition.operator)) {
      const to = formatValue(condition.value.valueTo, def);
      return `${col} ${op} ${value} – ${to}`;
    }
    return `${col} ${op} ${value}`;
  }

  /** Returns the filter data type inferred for a column. */
  getFilterType(field: string): FilterDataType {
    return resolveFilterType(this.state.columnDefMap().get(field));
  }

  /**
   * Builds the column descriptors consumed by the filter builder UI.
   *
   * All `filterable` columns are included, even those that ship a custom
   * `filterTemplate`. The custom template drives the inline header filter
   * row (quick per-column UI), while the builder — rendered in the toolbar
   * drawer and in the column-menu overlay — always uses the generic editors.
   * The two mechanisms are complementary and can coexist on the same column.
   */
  describeFilterableColumns(): FilterColumnDescriptor[] {
    const defs = this.state.columnDefs();
    return defs.filter((d) => d.filterable).map((d) => this.describeColumn(d));
  }

  describeColumn(def: ColumnDef<T>): FilterColumnDescriptor {
    if (def.filterComponent) {
      return {
        field: def.field,
        headerName: def.headerName ?? def.field,
        filterType: 'custom',
        operators: [],
        defaultOperator: 'equals',
        filterComponent: def.filterComponent,
        filterIsComplete: def.filterIsComplete,
      };
    }
    const type = resolveFilterType(def);
    const operators =
      def.filterOperators && def.filterOperators.length > 0
        ? def.filterOperators
        : DEFAULT_OPERATORS[type];
    const defaultOp = def.defaultFilterOperator ?? DEFAULT_OPERATOR_PER_TYPE[type];
    return {
      field: def.field,
      headerName: def.headerName ?? def.field,
      filterType: type,
      operators,
      defaultOperator: operators.includes(defaultOp) ? defaultOp : operators[0],
      options: def.filterOptions ?? inferOptionsFromData(this.state.sourceData(), def, type),
    };
  }

  /** Factory for new conditions created by the UI. */
  makeCondition(
    field: string,
    isFirst: boolean,
    overrides: Partial<FilterCondition> = {}
  ): FilterCondition {
    const def = this.state.columnDefMap().get(field);
    const descriptor = def ? this.describeColumn(def) : null;
    return {
      id: generateConditionId(),
      combinator: isFirst ? 'and' : 'and',
      field,
      operator: descriptor?.defaultOperator ?? 'contains',
      value: {},
      ...overrides,
    };
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private notify(reason: FilterChangeReason, condition: FilterCondition | null): void {
    this.lastChange.set({
      model: { conditions: this.state.filterModel().conditions.slice() },
      condition,
      reason,
    });
  }
}

// --------------------------------------------------------------------
// Pure helpers
// --------------------------------------------------------------------

function resolveFilterType<T>(def: ColumnDef<T> | undefined): FilterDataType {
  if (!def) return 'text';
  if (def.filterType) return def.filterType;
  switch (def.cellEditor) {
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    case 'select':
      return 'set';
    case 'checkbox':
    case 'toggle':
      return 'boolean';
    default:
      return 'text';
  }
}

function matchOne<T>(
  row: T,
  condition: FilterCondition,
  col: ColumnDef<T> | undefined,
  type: FilterDataType
): boolean {
  const raw = col?.valueGetter
    ? col.valueGetter(row)
    : (row as Record<string, unknown>)[condition.field];

  const predicate = PREDICATES[type]?.[condition.operator];
  if (!predicate) return true;
  return predicate(raw, condition.value);
}

function formatValue<T>(value: unknown, def: ColumnDef<T> | undefined): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) {
    return value.map((v) => formatSingleOption(v, def)).join(', ');
  }
  return formatSingleOption(value, def);
}

function formatSingleOption<T>(value: unknown, def: ColumnDef<T> | undefined): string {
  if (def?.filterOptions) {
    const opt = def.filterOptions.find((o) => String(o.value) === String(value));
    if (opt) return String(opt.label);
  }
  return String(value);
}

function inferOptionsFromData<T>(
  data: T[],
  def: ColumnDef<T>,
  type: FilterDataType
): { value: unknown; label: string }[] | undefined {
  if (type !== 'set') return undefined;
  const seen = new Set<string>();
  const out: { value: unknown; label: string }[] = [];
  for (const row of data) {
    const v = def.valueGetter ? def.valueGetter(row) : (row as Record<string, unknown>)[def.field];
    if (v == null) continue;
    const key = String(v);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ value: v, label: key });
    if (out.length >= 200) break;
  }
  return out;
}

// --------------------------------------------------------------------
// Predicate table — dispatched by (filterType, operator)
// --------------------------------------------------------------------

const textContains: Predicate = (cell, { value }) =>
  String(cell ?? '')
    .toLowerCase()
    .includes(String(value ?? '').toLowerCase());

const textNotContains: Predicate = (cell, v) => !textContains(cell, v);

const textEquals: Predicate = (cell, { value }) =>
  String(cell ?? '').toLowerCase() === String(value ?? '').toLowerCase();

const textNotEquals: Predicate = (cell, v) => !textEquals(cell, v);

const textStartsWith: Predicate = (cell, { value }) =>
  String(cell ?? '')
    .toLowerCase()
    .startsWith(String(value ?? '').toLowerCase());

const textEndsWith: Predicate = (cell, { value }) =>
  String(cell ?? '')
    .toLowerCase()
    .endsWith(String(value ?? '').toLowerCase());

const blank: Predicate = (cell) => cell == null || cell === '';
const notBlank: Predicate = (cell) => !blank(cell, { value: undefined });

const numEquals: Predicate = (cell, { value }) => toNum(cell) === toNum(value);
const numNotEquals: Predicate = (cell, v) => !numEquals(cell, v);
const numGt: Predicate = (cell, { value }) => toNum(cell) > toNum(value);
const numGte: Predicate = (cell, { value }) => toNum(cell) >= toNum(value);
const numLt: Predicate = (cell, { value }) => toNum(cell) < toNum(value);
const numLte: Predicate = (cell, { value }) => toNum(cell) <= toNum(value);
const numBetween: Predicate = (cell, { value, valueTo }) => {
  const n = toNum(cell);
  return n >= toNum(value) && n <= toNum(valueTo);
};

const dateEquals: Predicate = (cell, { value }) => toTime(cell) === toTime(value);
const dateNotEquals: Predicate = (cell, v) => !dateEquals(cell, v);
const dateGt: Predicate = (cell, { value }) => toTime(cell) > toTime(value);
const dateGte: Predicate = (cell, { value }) => toTime(cell) >= toTime(value);
const dateLt: Predicate = (cell, { value }) => toTime(cell) < toTime(value);
const dateLte: Predicate = (cell, { value }) => toTime(cell) <= toTime(value);
const dateBetween: Predicate = (cell, { value, valueTo }) => {
  const t = toTime(cell);
  return t >= toTime(value) && t <= toTime(valueTo);
};

const setIn: Predicate = (cell, { value }) => {
  const arr = Array.isArray(value) ? value : [value];
  if (arr.length === 0) return true;
  return arr.some((v) => String(v) === String(cell));
};
const setNotIn: Predicate = (cell, v) => !setIn(cell, v);

const boolEquals: Predicate = (cell, { value }) => {
  const expected = value === true || value === 'true' || value === 1;
  const actual = cell === true || cell === 'true' || cell === 1;
  return expected === actual;
};

function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function toTime(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const parsed = Date.parse(v);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
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
  // custom filters are evaluated via ColumnDef.filterPredicate — no predicates here.
  custom: {},
};
