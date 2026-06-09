/**
 * `FormulaEngine` — grid-scoped service that owns every formula cell, the
 * dependency DAG linking them, and the evaluator that turns stored
 * formulas into `FormulaValue`s.
 *
 * Responsibilities (Phase 1):
 *   - Parse + resolve a raw formula when the user commits an edit.
 *   - Update the dependency graph and detect cycles (`#CYCLE!`).
 *   - Re-evaluate the mutated cell and every descendant in topological order.
 *   - Expose a `values` signal the grid renders against.
 *   - Provide an explicit `invalidate(addr)` so inline-edit can refresh
 *     dependents after a *non-formula* source cell changes — avoiding a
 *     blanket re-eval of the whole dataset.
 *
 * Out of scope (Phase ≥ 2):
 *   - Editor component + autocomplete (uses `longFormToA1` under the hood).
 *   - Clipboard / fill-handle rebasing of relative refs.
 *   - History integration (undo/redo of formula mutations).
 */

import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { GridStateManager } from '../../state/grid-state';
import {
  CellAddress,
  FormulaError,
  FormulaEvalContext,
  FormulaFunctionRegistry,
  FormulaValue,
  FormulaValues,
} from '../../models/formula.model';
import { FormulaAst } from './formula-ast';
import { FormulaDag } from './formula-dag';
import { evaluate } from './formula-evaluator';
import { DEFAULT_FORMULA_FUNCTIONS } from './formula-functions.default';
import { FormulaParseError, parseFormula } from './formula-parser';
import {
  RefMapperContext,
  a1ToLongForm,
  addressToA1,
  longFormToA1,
  resolveAst,
} from './formula-ref-mapper';

interface CellEntry {
  /** Raw formula string as entered by the user (after normalisation). */
  readonly formula: string;
  /** Parsed AST with resolved addresses — rebuilt on column/row changes. */
  readonly ast: FormulaAst;
  /** Last computed value. `empty` before the first evaluation. */
  value: FormulaValue;
}

function makeKey(addr: CellAddress): string {
  return `${addr.rowId}|${addr.field}`;
}

function keyToAddress(key: string): CellAddress {
  const sep = key.indexOf('|');
  const rowId = key.slice(0, sep);
  const field = key.slice(sep + 1);
  return { rowId, field };
}

@Injectable()
export class FormulaEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  private readonly cells = new Map<string, CellEntry>();
  private readonly dag = new FormulaDag();

  // ─── B11: Dynamic rowId resolver ─────────────────────────────────────────

  /**
   * Optional callback that resolves a row's identity. When set, it is used
   * instead of `state.rowIdField()` in `readSourceValue` / `syncFromSource`.
   *
   * Default: resolves via `state.rowIdField()` (the `id` property).
   *
   * Call `setRowIdResolver(null)` to reset to the default.
   */
  private _rowIdResolver: ((row: T, index: number) => string | number) | null = null;

  setRowIdResolver(fn: ((row: T, index: number) => string | number) | null): void {
    this._rowIdResolver = fn;
    // Invalidate the row-index cache since identity semantics changed.
    this._rowIndexCacheRef = null;
    this._rowIndexCache.clear();
  }

  /**
   * Resolve the row id for a given row object + its array index, using the
   * custom resolver when set, or falling back to `rowIdField`.
   */
  private resolveRowId(row: T, index: number): string | number | undefined {
    if (this._rowIdResolver) return this._rowIdResolver(row, index);
    const idField = this.state.rowIdField();
    const raw = (row as Record<string, unknown>)[idField];
    if (raw === null || raw === undefined) return undefined;
    return raw as string | number;
  }

  // ─── B13: Row-index LRU cache ─────────────────────────────────────────────

  /**
   * Cache mapping `rowId → index` in `state.sourceData()`.
   * Invalidated whenever `sourceData` array reference changes.
   */
  private _rowIndexCache = new Map<string | number, number>();
  /** Reference to the last-seen `sourceData` array — used for change detection. */
  private _rowIndexCacheRef: T[] | null = null;

  private ensureRowIndexCache(): Map<string | number, number> {
    const data = this.state.sourceData();
    if (data !== this._rowIndexCacheRef) {
      // Source array reference changed — rebuild the full index map.
      this._rowIndexCache.clear();
      for (let i = 0; i < data.length; i++) {
        const id = this.resolveRowId(data[i]!, i);
        if (id !== undefined) this._rowIndexCache.set(id, i);
      }
      this._rowIndexCacheRef = data;
    }
    return this._rowIndexCache;
  }

  // ─── B12: Batch mechanism ─────────────────────────────────────────────────

  private _batchDepth = 0;
  private _pendingCommit = false;

  /**
   * Wraps `fn` in a batch: `commitValues()` is deferred until the outermost
   * `withBatch` call returns. Prevents N signal emissions for N formula
   * re-evaluations during `rebuild()` / `syncFromSource()`.
   */
  withBatch<U>(fn: () => U): U {
    this._batchDepth++;
    try {
      return fn();
    } finally {
      this._batchDepth--;
      if (this._batchDepth === 0 && this._pendingCommit) {
        this._pendingCommit = false;
        this.commitValues();
      }
    }
  }

  /** Last-evaluated values keyed by `rowId|field`. */
  private readonly valuesSignal = signal<ReadonlyMap<string, FormulaValue>>(new Map());

  /** Function registry — consumers can replace via `setFunctions`. */
  private functions: FormulaFunctionRegistry = DEFAULT_FORMULA_FUNCTIONS;

  /** Active locale for the parser/evaluator. */
  private locale: 'en' | 'fr' = 'en';

  // ─── Public reactive surface ─────────────────────────────────────────────

  /** Snapshot of all evaluated formula values. Consumers read by key. */
  readonly values: Signal<ReadonlyMap<string, FormulaValue>> = this.valuesSignal.asReadonly();

  /** Whether any formula is currently tracked. */
  readonly hasAnyFormula = computed(() => this.values().size > 0);

  /**
   * `true` when the user is currently editing a cell whose column has
   * `allowFormula: true`. The grid's header uses this to surface the
   * structured-ref column badges (`[price]`, `[qty]`, …) above each
   * header, matching what the user types in their formula.
   */
  readonly isFormulaEditActive = computed(() => {
    // The formula bar edits aren't bound to any cell's cellEditState, so we
    // treat it as a first-class source of "formula is being typed".
    if (this.state.formulaBarEditingActive()) return true;
    const editing = this.state.cellEditState().editingCell;
    if (!editing) return false;
    const field = this.state.visibleColumns()[editing.col]?.field;
    if (!field) return false;
    return this.state.columnDefMap().get(field)?.allowFormula === true;
  });

  // ─── Configuration ───────────────────────────────────────────────────────

  /** Merge / replace the function registry (called once at grid init). */
  setFunctions(functions: FormulaFunctionRegistry): void {
    this.functions = functions;
  }

  /** Read-only view of the current function registry — used by the editor's
   *  autocomplete panel to enumerate available names + their docs. */
  getFunctions(): FormulaFunctionRegistry {
    return this.functions;
  }

  setLocale(locale: 'en' | 'fr'): void {
    this.locale = locale;
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  hasFormula(addr: CellAddress): boolean {
    return this.cells.has(makeKey(addr));
  }

  /** Raw formula string, or `undefined` when none is stored. */
  getFormula(addr: CellAddress): string | undefined {
    return this.cells.get(makeKey(addr))?.formula;
  }

  /** Last-evaluated value, or `undefined` when no formula is stored. */
  valueAt(addr: CellAddress): FormulaValue | undefined {
    return this.values().get(makeKey(addr));
  }

  /**
   * Formula re-presented as A1 surface syntax for the current column /
   * row order. Returns `undefined` when the cell has no formula. Used by
   * the editor when opening a cell for edit.
   */
  displayFormula(addr: CellAddress): string | undefined {
    const entry = this.cells.get(makeKey(addr));
    if (!entry) return undefined;
    return longFormToA1(entry.formula, this.refMapperContext(addr.rowId));
  }

  // ─── Mutations ───────────────────────────────────────────────────────────

  /**
   * Registers or updates a formula at `addr`. Returns the freshly-computed
   * value. Invalid formulas are stored with their error as value so the
   * grid can render `#PARSE!` / `#REF!` etc. instead of silently dropping.
   */
  set(addr: CellAddress, rawFormula: string): FormulaValue {
    const key = makeKey(addr);
    const trimmed = rawFormula.trim();
    const prefixed = trimmed.startsWith('=') ? trimmed : `=${trimmed}`;
    // Normalize A1 surface → REF long-form storage. If the input is already
    // REF long-form (persisted data, paste), the transformer leaves it
    // untouched, so round-trips are stable.
    const ctx = this.refMapperContext(addr.rowId);
    const source = a1ToLongForm(prefixed, ctx);

    let ast: FormulaAst;
    try {
      ast = parseFormula(source, { locale: this.locale });
    } catch (err) {
      return this.storeError(key, source, err instanceof FormulaParseError ? '#PARSE!' : '#VALUE!');
    }

    ast = resolveAst(ast, ctx);

    // Update DAG (must happen before cycle detection).
    const deps = collectDeps(ast);
    this.dag.setDependencies(key, deps);

    // Store entry with a placeholder value; evaluation picks up cycle
    // detection lazily, so setting a new formula that breaks a previous
    // cycle (e.g. `=[b]1 / =[a]1` → `=[b]1 / =42`) naturally clears the error
    // on every former cycle member when they are re-evaluated.
    const entry: CellEntry = { formula: source, ast, value: FormulaValues.empty() };
    this.cells.set(key, entry);

    // Evaluate self + every descendant. When the node itself still
    // participates in a cycle, `revalidateFrom` marks it as `#CYCLE!`.
    this.revalidateFrom([key]);
    return entry.value;
  }

  /** Removes the formula at `addr`. Descendants are re-evaluated. */
  remove(addr: CellAddress): void {
    const key = makeKey(addr);
    if (!this.cells.has(key)) return;
    this.cells.delete(key);
    // Snapshot dependents before we disconnect `key` from the DAG so we
    // can re-evaluate them (they will most likely flip to `#REF!`).
    const dependents = [...this.dag.dependentsOf(key)];
    this.dag.remove(key);
    this.revalidateFrom(dependents);
    this.commitValues();
  }

  /**
   * Notifies the engine that a non-formula cell changed. Only dependents
   * are re-evaluated — this is the hook used by `InlineEditEngine` after
   * committing a plain value edit.
   */
  invalidate(addr: CellAddress): void {
    const key = makeKey(addr);
    const dependents = [...this.dag.dependentsOf(key)];
    if (dependents.length === 0) return;
    this.revalidateFrom(dependents);
  }

  /** Wipes every formula / value. */
  clear(): void {
    this.cells.clear();
    this.dag.clear();
    this.commitValues();
  }

  /**
   * Reconciles the engine against `sourceData()`: any cell whose column
   * declares `allowFormula: true` and whose value is a `=…` string is
   * registered (or updated). Cells previously registered but no longer
   * present (row removed, value changed to a literal) are dropped.
   *
   * Designed to be called from a grid-level effect tracking
   * `(formulas, sourceData, columnDefMap)` so that formulas baked into
   * the initial dataset are evaluated on first render — without it, the
   * engine would only learn about a formula after the user committed an
   * inline edit on it.
   *
   * The reconciliation is incremental: identical formula strings short-
   * circuit (no re-parse, no re-eval) so the call is cheap on stable data.
   */
  syncFromSource(allowFormula: (field: string) => boolean): void {
    this.withBatch(() => {
      const data = this.state.sourceData();

      const expected = new Set<string>();
      for (let i = 0; i < data.length; i++) {
        const row = data[i]!;
        const r = row as Record<string, unknown>;
        // B11: use resolver instead of direct idField access.
        const rowId = this.resolveRowId(row, i);
        if (rowId === undefined || rowId === null) continue;
        for (const field of Object.keys(r)) {
          if (!allowFormula(field)) continue;
          const raw = r[field];
          if (typeof raw !== 'string' || !raw.trimStart().startsWith('=')) continue;
          const key = `${rowId}|${field}`;
          expected.add(key);
          const existing = this.cells.get(key);
          if (existing && existing.formula === raw) continue;
          this.set({ rowId, field }, raw);
        }
      }

      // Drop entries that no longer have a backing formula in the source.
      for (const key of [...this.cells.keys()]) {
        if (expected.has(key)) continue;
        const sep = key.indexOf('|');
        this.remove({ rowId: key.slice(0, sep), field: key.slice(sep + 1) });
      }
    });
  }

  /**
   * Re-parses every stored formula so refs pick up the latest column
   * order / row list. Called by the grid shell when visibility or row
   * identity changes (reorder, filter flip, …).
   */
  rebuild(): void {
    this.withBatch(() => {
      for (const [key, entry] of this.cells) {
        const addr = keyToAddress(key);
        const ctx = this.refMapperContext(addr.rowId);
        // Mutate the entry to avoid rebuilding map keys. Cast away readonly.
        (entry as { ast: FormulaAst }).ast = resolveAst(
          parseFormulaOrEmpty(entry.formula, this.locale),
          ctx,
        );
        this.dag.setDependencies(key, collectDeps(entry.ast));
      }
      this.revalidateFrom([...this.cells.keys()]);
    });
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private refMapperContext(currentRowId?: string | number): RefMapperContext {
    // A1 letters map to fields in visible-column order, so we use the
    // reactive `visibleColumns()` list rather than the full column def
    // set. `allowFormula` only gates whether a cell may *host* a formula;
    // any visible column can be referenced.
    const visible = this.state.visibleColumns();
    const fields = visible.map((c) => c.field);
    // B11: use resolver for building row-id list.
    const data = this.state.sourceData();
    const rowIds = data.map((row, i) => {
      const id = this.resolveRowId(row, i);
      return id !== undefined ? id : '';
    });
    return { fields, rowIds, currentRowId };
  }

  private storeError(key: string, source: string, error: FormulaError): FormulaValue {
    const value = FormulaValues.error(error);
    // No deps — `#PARSE!` can't reach anyone.
    this.dag.setDependencies(key, []);
    this.cells.set(key, {
      formula: source,
      ast: { kind: 'string', value: error },
      value,
    });
    this.commitValues();
    return value;
  }

  /**
   * Evaluate the given seeds and every descendant in topological order.
   * Each node is first checked for cycle participation — any node inside
   * a cycle reports `#CYCLE!` without attempting evaluation (which would
   * recurse through the cached values and either spin or yield garbage).
   */
  private revalidateFrom(seeds: string[]): void {
    if (seeds.length === 0) {
      this.commitValues();
      return;
    }
    const cycleError = FormulaValues.error('#CYCLE!');
    const order = this.dag.topoFrom(seeds);
    for (const key of order) {
      const entry = this.cells.get(key);
      if (!entry) continue;
      const cycle = this.dag.detectCycle(key);
      if (cycle) {
        entry.value = cycleError;
        continue;
      }
      entry.value = evaluate(entry.ast, this.functions, this.makeEvalContext(key));
    }
    this.commitValues();
  }

  private makeEvalContext(selfKey: string): FormulaEvalContext {
    return {
      addr: keyToAddress(selfKey),
      locale: this.locale,
      resolveRef: (target) => this.resolveRef(target),
    };
  }

  /** Resolve a reference: formula cell → cached value, else source data. */
  private resolveRef(addr: CellAddress): FormulaValue {
    const key = makeKey(addr);
    const formula = this.cells.get(key);
    if (formula) return formula.value;
    return this.readSourceValue(addr);
  }

  private readSourceValue(addr: CellAddress): FormulaValue {
    // B13: use the O(1) rowId → index cache instead of Array.find.
    const cache = this.ensureRowIndexCache();
    const index = cache.get(addr.rowId as string | number);
    if (index === undefined) return FormulaValues.empty();
    const data = this.state.sourceData();
    const row = data[index];
    if (!row) return FormulaValues.empty();
    const raw = (row as Record<string, unknown>)[addr.field];
    return coerceJsValue(raw);
  }

  private commitValues(): void {
    // B12: if inside a batch, defer the signal emission.
    if (this._batchDepth > 0) {
      this._pendingCommit = true;
      return;
    }
    // Emit a *new* map instance so downstream `computed`s see a fresh
    // reference and recompute. Map iteration order matches insertion order,
    // which is fine for consumers since they only look up by key.
    const next = new Map<string, FormulaValue>();
    for (const [key, entry] of this.cells) {
      next.set(key, entry.value);
    }
    this.valuesSignal.set(next);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Collect every long-form dependency referenced by the AST. */
function collectDeps(ast: FormulaAst): Set<string> {
  const out = new Set<string>();
  visit(ast, out);
  return out;
}

function visit(node: FormulaAst, out: Set<string>): void {
  switch (node.kind) {
    case 'ref':
      if (node.resolved) out.add(makeKey(node.resolved));
      return;
    case 'range':
      if (node.resolved) {
        for (const a of node.resolved) if (a) out.add(makeKey(a));
      }
      return;
    case 'unary':
      visit(node.operand, out);
      return;
    case 'binary':
      visit(node.left, out);
      visit(node.right, out);
      return;
    case 'call':
      for (const a of node.args) visit(a, out);
      return;
    default:
      return;
  }
}

/** Coerce a plain JS value from a row object into a `FormulaValue`. */
function coerceJsValue(raw: unknown): FormulaValue {
  if (raw === null || raw === undefined) return FormulaValues.empty();
  if (typeof raw === 'number') return FormulaValues.number(raw);
  if (typeof raw === 'boolean') return FormulaValues.boolean(raw);
  if (typeof raw === 'string') return FormulaValues.string(raw);
  // Everything else (Date, Object…) — stringify conservatively.
  return FormulaValues.string(String(raw));
}

function parseFormulaOrEmpty(source: string, locale: 'en' | 'fr'): FormulaAst {
  try {
    return parseFormula(source, { locale });
  } catch {
    return { kind: 'string', value: '#PARSE!' };
  }
}

// Re-export used by the grid/cell to format addresses during edit.
export { addressToA1 };
