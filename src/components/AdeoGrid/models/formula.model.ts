/**
 * Public types for the formula engine. These are the only symbols consumers
 * of the grid need to interact with. The parser / evaluator / DAG live in
 * `features/formula/` and expose the public surface through `FormulaEngine`.
 *
 * Shape overview:
 *   - `CellAddress`      — stable (rowId, field) tuple.
 *   - `FormulaValue`     — tagged union of numbers, strings, booleans, empty
 *                          and errors. Errors propagate through operators.
 *   - `FormulaError`     — Excel-compatible error codes + `#PARSE!`.
 *   - `FormulaFunction*` — registration shape for built-in + custom funcs.
 *   - `FormulaChange*` / `FormulaError*` — events emitted by the grid.
 */

/** Stable cell identifier, resistant to sort/filter/pagination. */
export interface CellAddress {
  rowId: string | number;
  field: string;
}

/** Excel-compatible error codes, plus mozaic-specific `#PARSE!`. */
export type FormulaError =
  | '#DIV/0!'
  | '#VALUE!'
  | '#REF!'
  | '#NAME?'
  | '#NUM!'
  | '#N/A'
  | '#CYCLE!'
  | '#PARSE!';

/**
 * Tagged union for any value that can appear as a formula operand or result.
 * `empty` represents a cell with no source value (distinct from the empty
 * string) and coerces to 0 in arithmetic contexts, `""` in textual ones.
 */
export type FormulaValue =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'empty' }
  | { kind: 'error'; error: FormulaError };

/**
 * Context passed to every function implementation. Keeps evaluation
 * side-effect free: the engine owns the cell store and only exposes a
 * `resolveRef` primitive. Range expansion is handled by the engine before
 * the function is invoked, so implementations receive a flat value array.
 */
export interface FormulaEvalContext {
  /** Current cell being evaluated (used for diagnostics only). */
  readonly addr?: CellAddress;
  /**
   * Resolve a long-form reference. Returns `#REF!` when the target is
   * missing (column removed, row deleted). The engine is responsible for
   * cycle protection — functions must not worry about recursion.
   */
  resolveRef(target: CellAddress): FormulaValue;
  /** Active locale, used by date/text helpers that are locale-aware. */
  readonly locale: 'en' | 'fr';
}

/** Arity constraint for a function registration. */
export type FormulaArity =
  | number
  | 'variadic'
  | readonly [min: number, max: number];

/**
 * Human-readable metadata shown in the autocomplete panel. When absent, the
 * suggestion listing falls back to the function name only.
 */
export interface FormulaFunctionDocs {
  /** Canonical signature string, e.g. `SUM(number1, [number2, ...])`. */
  readonly signature: string;
  /** One-line summary — displayed next to the signature in FR by default. */
  readonly summary: string;
}

export interface FormulaFunctionImpl {
  /** Number of arguments accepted. */
  readonly arity: FormulaArity;
  /**
   * Whether the function accepts a range argument (e.g. `SUM(A1:B3)`).
   * When `true`, each range is flattened into the `args` array in
   * row-major order. When `false`, passing a range yields `#VALUE!`.
   *
   * Defaults to `false`.
   */
  readonly acceptsRange?: boolean;
  /** Optional documentation — consumed by the editor's autocomplete panel. */
  readonly docs?: FormulaFunctionDocs;
  /** Evaluate the function. Must be pure (no I/O, no mutation). */
  evaluate(args: FormulaValue[], ctx: FormulaEvalContext): FormulaValue;
}

/** Lookup table of function name (uppercase) → implementation. */
export type FormulaFunctionRegistry = Readonly<Record<string, FormulaFunctionImpl>>;

/**
 * Source for storing formulas externally (instead of serialising the raw
 * formula into the row's field). Mirror of AG-Grid's `formulaDataSource`.
 */
export interface FormulaDataSource {
  getFormula(addr: CellAddress): string | undefined;
  setFormula(addr: CellAddress, formula: string | undefined): void;
  /** Optional bulk hydration — useful for persistence layers. */
  hydrate?(entries: Iterable<{ addr: CellAddress; formula: string }>): void;
}

export interface FormulaChangeEvent {
  addr: CellAddress;
  /** Canonical long-form formula (references keyed by rowId/field). */
  formula: string;
  /** Last evaluated value after the change. */
  evaluated: FormulaValue;
}

export interface FormulaErrorEvent {
  addr: CellAddress;
  formula: string;
  error: FormulaError;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Factory helpers for callers that prefer not to build literals by hand. */
export const FormulaValues = {
  number(value: number): FormulaValue {
    return Number.isFinite(value) ? { kind: 'number', value } : { kind: 'error', error: '#NUM!' };
  },
  string(value: string): FormulaValue {
    return { kind: 'string', value };
  },
  boolean(value: boolean): FormulaValue {
    return { kind: 'boolean', value };
  },
  empty(): FormulaValue {
    return { kind: 'empty' };
  },
  error(error: FormulaError): FormulaValue {
    return { kind: 'error', error };
  },
} as const;

/** Narrow a value to a number, following Excel coercion rules. */
export function toNumber(v: FormulaValue): number | FormulaError {
  switch (v.kind) {
    case 'number':
      return v.value;
    case 'boolean':
      return v.value ? 1 : 0;
    case 'empty':
      return 0;
    case 'string': {
      const trimmed = v.value.trim();
      if (trimmed === '') return 0;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : '#VALUE!';
    }
    case 'error':
      return v.error;
  }
}

/** Narrow a value to a string, following Excel coercion rules. */
export function toStringValue(v: FormulaValue): string | FormulaError {
  switch (v.kind) {
    case 'string':
      return v.value;
    case 'number':
      return String(v.value);
    case 'boolean':
      return v.value ? 'TRUE' : 'FALSE';
    case 'empty':
      return '';
    case 'error':
      return v.error;
  }
}

/** Narrow a value to a boolean, following Excel coercion rules. */
export function toBoolean(v: FormulaValue): boolean | FormulaError {
  switch (v.kind) {
    case 'boolean':
      return v.value;
    case 'number':
      return v.value !== 0;
    case 'empty':
      return false;
    case 'string': {
      const u = v.value.toUpperCase();
      if (u === 'TRUE') return true;
      if (u === 'FALSE') return false;
      return '#VALUE!';
    }
    case 'error':
      return v.error;
  }
}

/** Returns the first error found in the given values, or `null`. */
export function firstError(values: readonly FormulaValue[]): FormulaError | null {
  for (const v of values) {
    if (v.kind === 'error') return v.error;
  }
  return null;
}
