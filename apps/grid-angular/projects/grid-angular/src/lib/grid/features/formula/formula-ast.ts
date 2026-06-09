/**
 * Internal AST produced by the formula parser and consumed by the evaluator.
 *
 * The formula feature uses a **two-layer model**, modelled after AG-Grid:
 *
 *   1. **Edit surface** — what the user sees and types. Column letters + row
 *      numbers, A1-style: `=A1*B1`, `=SUM(A1:A5)`, `=$A$1` (absolute).
 *   2. **Storage** — long-form, field-stable: `=REF(COLUMN("price"),ROW(8))`.
 *      Survives column reorder / rename.
 *
 * The parser accepts both forms. The AST is the same in either case: a
 * `CellRefNode` carries a `StructuredRef` keyed by the column's stable
 * `field` name (never by its current visible position).
 *
 *   A1              → { field: "price",  row: 1, absRow: false, absField: false }
 *   $A$1            → { field: "price",  row: 1, absRow: true,  absField: true  }
 *   REF(COLUMN("price"), ROW(1))
 *                   → { field: "price",  row: 1, absRow: true,  absField: true  }
 *
 * Ranges use the same shape for each endpoint:
 *
 *   A1:A5 — vertical
 *   A1:B1 — horizontal
 *   A1:B5 — rectangular
 */

import type { CellAddress } from '../../models/formula.model';

/** Literal numeric constant — e.g. `3.14`. */
export interface NumberLiteralNode {
  readonly kind: 'number';
  readonly value: number;
}

/** Literal quoted string — e.g. `"hello"`. */
export interface StringLiteralNode {
  readonly kind: 'string';
  readonly value: string;
}

/** Literal boolean constant — `TRUE` / `FALSE`. */
export interface BooleanLiteralNode {
  readonly kind: 'boolean';
  readonly value: boolean;
}

/**
 * Structured cell reference — A1-compatible. The `field` is always the
 * column's stable name (never its letter) so the ref survives reorder.
 *   - `row`      — 1-indexed display position. Ignored when `sameRow`.
 *   - `absRow`   — row locked (matches `$1` / `$A$1`; won't shift under fill).
 *   - `absField` — column locked (matches `$A` / `$A$1`; won't shift under fill).
 *   - `sameRow`  — implicit current-row ref. Surface `[field]`, storage
 *                  `REF(COLUMN("field"))` (no ROW arg). Resolves against
 *                  the host cell's row at evaluation time, so the same
 *                  formula can be placed on every row without per-row
 *                  rewriting. Mutually exclusive with `absRow`.
 */
export interface StructuredRef {
  readonly field: string;
  readonly row: number;
  readonly absRow: boolean;
  readonly absField: boolean;
  readonly sameRow?: boolean;
}

export interface CellRefNode {
  readonly kind: 'ref';
  readonly ref: StructuredRef;
  /** Resolved long-form address, attached post-parse. Optional during tests. */
  readonly resolved?: CellAddress;
}

export interface RangeRefNode {
  readonly kind: 'range';
  readonly start: StructuredRef;
  readonly end: StructuredRef;
  /**
   * Resolved cells in row-major order, attached post-parse by the mapper.
   * An undefined entry means the specific coordinate pointed to a missing
   * column — the evaluator will surface `#REF!` on access.
   */
  readonly resolved?: ReadonlyArray<CellAddress | undefined>;
}

/** Unary prefix operator (`+x`, `-x`). */
export type UnaryOp = '+' | '-';

export interface UnaryOpNode {
  readonly kind: 'unary';
  readonly op: UnaryOp;
  readonly operand: FormulaAst;
}

export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '^'
  | '&'
  | '='
  | '<>'
  | '<'
  | '>'
  | '<='
  | '>=';

export interface BinaryOpNode {
  readonly kind: 'binary';
  readonly op: BinaryOp;
  readonly left: FormulaAst;
  readonly right: FormulaAst;
}

export interface FunctionCallNode {
  readonly kind: 'call';
  /** Uppercased name for case-insensitive lookup. */
  readonly name: string;
  readonly args: readonly FormulaAst[];
}

export type FormulaAst =
  | NumberLiteralNode
  | StringLiteralNode
  | BooleanLiteralNode
  | CellRefNode
  | RangeRefNode
  | UnaryOpNode
  | BinaryOpNode
  | FunctionCallNode;

// ─── Column-letter helpers ──────────────────────────────────────────────────

/**
 * Convert a 0-based column index to its A1 letter sequence.
 *   0 → A, 25 → Z, 26 → AA, 27 → AB, 701 → ZZ, 702 → AAA, …
 */
export function columnIndexToLetters(index: number): string {
  if (!Number.isInteger(index) || index < 0) return '';
  let out = '';
  let n = index;
  while (true) {
    const rem = n % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return out;
}

/**
 * Convert an A1 column-letter sequence to its 0-based index. Returns `-1`
 * for invalid input (empty string, non-letters).
 */
export function columnLettersToIndex(letters: string): number {
  if (letters.length === 0) return -1;
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    const code = letters.charCodeAt(i);
    const upper = code >= 97 && code <= 122 ? code - 32 : code;
    if (upper < 65 || upper > 90) return -1;
    n = n * 26 + (upper - 64);
  }
  return n - 1;
}

// ─── Field-name helpers ─────────────────────────────────────────────────────

/** Fields that don't need quoting inside `COLUMN("…")` storage form. */
const BARE_FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Quote a field name when it contains characters outside the bare set. */
export function formatField(field: string): string {
  if (BARE_FIELD_RE.test(field)) return field;
  return `"${field.replace(/"/g, '""')}"`;
}

// ─── Ref formatters (A1 + long-form) ────────────────────────────────────────

/**
 * Render a structured ref as A1 notation using the column order from the
 * current grid context. Returns `#REF!` when the field is not visible.
 * Same-row refs render as `[field]` surface shorthand.
 */
export function cellRefToA1(ref: StructuredRef, fieldOrder: readonly string[]): string {
  const idx = fieldOrder.indexOf(ref.field);
  if (idx < 0) return '#REF!';
  if (ref.sameRow) return `[${ref.field}]`;
  const col = columnIndexToLetters(idx);
  return `${ref.absField ? '$' : ''}${col}${ref.absRow ? '$' : ''}${ref.row}`;
}

/**
 * Render a structured ref as the long-form storage string. Same-row refs
 * omit the ROW argument entirely (`REF(COLUMN("field"))`), which is the
 * signal consumed by the parser and the ref-mapper to resolve against the
 * host cell's row at evaluation time.
 */
export function cellRefToLongForm(ref: StructuredRef): string {
  const field = ref.field.replace(/"/g, '""');
  if (ref.sameRow) return `REF(COLUMN("${field}"))`;
  return `REF(COLUMN("${field}"),ROW(${ref.row}))`;
}
