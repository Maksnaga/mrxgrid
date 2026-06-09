/**
 * Maps structured refs (A1-backed, field-keyed) to / from long-form
 * `CellAddress` tuples, and converts formula *source strings* between the
 * A1 edit surface and the `REF(COLUMN("…"),ROW(N))` storage form.
 *
 * The mapper is the only component aware of the grid's current column
 * order — every other layer works exclusively with addresses, so reordering
 * columns or renaming a field's display label never breaks a stored formula.
 *
 * Surface round-trip:
 *
 *   Editor types          →  a1ToLongForm(ctx)   →  REF(COLUMN(…),ROW(…))  (stored)
 *   Stored REF long-form  →  longFormToA1(ctx)   →  A1                    (displayed)
 *
 * The mapper is intentionally stateless and receives its dependencies
 * (fields list + row id list) through the method parameters. This keeps
 * it unit-testable without instantiating the whole grid.
 */

import { CellAddress } from '../../models/formula.model';
import {
  FormulaAst,
  StructuredRef,
  cellRefToA1,
  cellRefToLongForm,
  columnIndexToLetters,
  columnLettersToIndex,
  formatField,
} from './formula-ast';

export interface RefMapperContext {
  /**
   * Ordered list of column fields that can participate in formulas. Used
   * for A1 letter ↔ field conversion and for existence checks (an unknown
   * field yields `#REF!`).
   */
  readonly fields: readonly string[];
  /**
   * Row identifiers in display order. Index 0 = row `1` in the user-facing
   * surface syntax. For grids in server mode, callers typically provide the
   * *currently loaded* subset — unresolved references surface as `#REF!`
   * which is the expected behaviour for page-scoped formulas.
   */
  readonly rowIds: readonly (string | number)[];
  /**
   * Row id of the formula being resolved. The editor-side A1 helpers use
   * this to detect same-row refs (so the display can be relative by
   * default).
   */
  readonly currentRowId?: string | number;
}

// ─── AST ↔ CellAddress ──────────────────────────────────────────────────────

/** Convert a structured ref to a stable `CellAddress`. */
export function structuredRefToAddress(
  ref: StructuredRef,
  ctx: RefMapperContext,
): CellAddress | undefined {
  if (!ctx.fields.includes(ref.field)) return undefined;
  if (ref.sameRow) {
    if (ctx.currentRowId === undefined) return undefined;
    return { rowId: ctx.currentRowId, field: ref.field };
  }
  const rowId = ctx.rowIds[ref.row - 1];
  if (rowId === undefined) return undefined;
  return { rowId, field: ref.field };
}

/**
 * Expand a range ref into a flat, row-major list of addresses. Out-of-range
 * coordinates yield `undefined` entries so the evaluator can precisely
 * propagate `#REF!` per cell rather than blanket-failing the whole range.
 */
export function rangeToAddresses(
  start: StructuredRef,
  end: StructuredRef,
  ctx: RefMapperContext,
): ReadonlyArray<CellAddress | undefined> {
  const startIdx = ctx.fields.indexOf(start.field);
  const endIdx = ctx.fields.indexOf(end.field);

  // Same-row range `[a]:[c]` — one row (host), columns from a to c. Mixed
  // same-row + explicit-row is nonsensical (the "a" endpoint has no row
  // and "c" has a specific one) so we fail the whole range.
  if (start.sameRow && end.sameRow) {
    const rowId = ctx.currentRowId;
    if (startIdx < 0 || endIdx < 0 || rowId === undefined) return [undefined];
    const colLo = Math.min(startIdx, endIdx);
    const colHi = Math.max(startIdx, endIdx);
    const out: (CellAddress | undefined)[] = [];
    for (let c = colLo; c <= colHi; c++) {
      const field = ctx.fields[c];
      out.push(field ? { rowId, field } : undefined);
    }
    return out;
  }
  if (start.sameRow !== end.sameRow) return [undefined];

  const rowLo = Math.min(start.row, end.row);
  const rowHi = Math.max(start.row, end.row);
  if (startIdx < 0 || endIdx < 0) {
    const cells = rowHi - rowLo + 1;
    return Array.from({ length: cells }, () => undefined);
  }
  const colLo = Math.min(startIdx, endIdx);
  const colHi = Math.max(startIdx, endIdx);

  const out: (CellAddress | undefined)[] = [];
  for (let r = rowLo; r <= rowHi; r++) {
    const rowId = ctx.rowIds[r - 1];
    for (let c = colLo; c <= colHi; c++) {
      const field = ctx.fields[c];
      out.push(rowId !== undefined && field ? { rowId, field } : undefined);
    }
  }
  return out;
}

/**
 * Walk a parsed AST and attach `resolved` addresses to every `ref` and
 * `range` node. The returned tree is a **new** structure — input nodes
 * are not mutated, which keeps the parser's output cache safe to reuse.
 */
export function resolveAst(ast: FormulaAst, ctx: RefMapperContext): FormulaAst {
  switch (ast.kind) {
    case 'ref':
      return { kind: 'ref', ref: ast.ref, resolved: structuredRefToAddress(ast.ref, ctx) };
    case 'range':
      return {
        kind: 'range',
        start: ast.start,
        end: ast.end,
        resolved: rangeToAddresses(ast.start, ast.end, ctx),
      };
    case 'unary':
      return { kind: 'unary', op: ast.op, operand: resolveAst(ast.operand, ctx) };
    case 'binary':
      return {
        kind: 'binary',
        op: ast.op,
        left: resolveAst(ast.left, ctx),
        right: resolveAst(ast.right, ctx),
      };
    case 'call':
      return {
        kind: 'call',
        name: ast.name,
        args: ast.args.map((a) => resolveAst(a, ctx)),
      };
    default:
      return ast;
  }
}

/** `(addr) → "A1"` using the current column order. */
export function addressToA1(
  addr: CellAddress,
  ctx: RefMapperContext,
): string | undefined {
  const idx = ctx.fields.indexOf(addr.field);
  if (idx < 0) return undefined;
  const rowIndex = ctx.rowIds.indexOf(addr.rowId);
  if (rowIndex < 0) return undefined;
  return `${columnIndexToLetters(idx)}${rowIndex + 1}`;
}

// ─── Source-string transformers (A1 ↔ REF long-form) ────────────────────────

/**
 * Regex that matches A1-style cell refs: `$?LETTERS$?DIGITS`. Only uppercase
 * letters are considered — lowercase letters+digits are identifiers
 * (`foo1` is not a ref).
 */
const A1_REF_RE = /(\$?)([A-Z]+)(\$?)(\d+)/g;

/**
 * Matches the `[field]` same-row surface shorthand. Field names may contain
 * any chars except `]`; callers that need `]` in a field must fall back to
 * the full `REF(COLUMN("…"))` form.
 */
const SAME_ROW_SURFACE_RE = /\[([^\]]+)\]/g;

/**
 * Convert an A1-form source string to REF long-form storage. Refs that
 * point to unknown columns are replaced with a literal `#REF!` to match
 * Excel's convention for broken refs.
 *
 * When `ctx.currentRowId` is known, relative refs pointing at the current
 * row (`=B5` on row 5, neither `$` lock set) collapse to same-row storage
 * (`REF(COLUMN("field"))` with no ROW arg). This preserves the "one
 * formula covers every row" property across an edit → commit round-trip
 * when the user only views / tweaks the formula without changing rows.
 *
 *   a1ToLongForm('=A1+B2', ctx)                        // no currentRowId
 *     → '=REF(COLUMN("price"),ROW(1))+REF(COLUMN("qty"),ROW(2))'
 *   a1ToLongForm('=A1*B1', { ...ctx, currentRowId: 'r_1' })
 *     → '=REF(COLUMN("price"))*REF(COLUMN("qty"))'   // collapsed to same-row
 *   a1ToLongForm('=[price]*[qty]', ctx)
 *     → '=REF(COLUMN("price"))*REF(COLUMN("qty"))'
 */
export function a1ToLongForm(source: string, ctx: RefMapperContext): string {
  // Index of the host row in the display order. Used below to detect refs
  // that point at the current row and can therefore collapse to same-row
  // storage. `-1` when unknown or unresolved — the collapse is skipped in
  // that case and refs remain explicit-row.
  const currentRowIndex =
    ctx.currentRowId !== undefined ? ctx.rowIds.indexOf(ctx.currentRowId) : -1;

  // Pass 1: `[field]` → `REF(COLUMN("field"))`. Runs first so the A1 scan in
  // pass 2 never sees letters+digits *inside* a user-authored `[A1]`.
  const afterSameRow = replaceOutsideStrings(source, (body) =>
    body.replace(SAME_ROW_SURFACE_RE, (_match, rawField: string) => {
      if (!ctx.fields.includes(rawField)) return '#REF!';
      return `REF(COLUMN("${rawField.replace(/"/g, '""')}"))`;
    }),
  );

  // Pass 2: A1 refs. A separate `replaceOutsideStrings` run so the freshly
  // introduced `"…"` quoting from pass 1 is honoured — otherwise the `A1`
  // in `REF(COLUMN("A1"))` would be rewritten a second time.
  return replaceOutsideStrings(afterSameRow, (body) =>
    body.replace(A1_REF_RE, (match, absCol: string, letters: string, absRow: string, digits: string, offset: number, full: string) => {
      if (isIdentLikeContext(full, offset, match.length)) return match;
      // `ATAN2(…)` — letters+digits followed by `(` is a function call.
      if (full[offset + match.length] === '(') return match;
      const idx = columnLettersToIndex(letters);
      const field = ctx.fields[idx];
      const row = Number(digits);
      if (!field || !Number.isFinite(row) || row < 1) return '#REF!';
      const isAbsField = absCol === '$';
      const isAbsRow = absRow === '$';
      // Collapse to same-row storage when: we know the host row, the ref
      // targets exactly that row, and neither axis is locked. Locked refs
      // (`$…`) convey "always this row / column" and must stay explicit.
      if (
        currentRowIndex >= 0 &&
        row === currentRowIndex + 1 &&
        !isAbsRow &&
        !isAbsField
      ) {
        return formatRefLongFormWithLocks({
          field,
          row: 0,
          absField: false,
          absRow: false,
          sameRow: true,
        });
      }
      const ref: StructuredRef = {
        field,
        row,
        absField: isAbsField,
        absRow: isAbsRow,
      };
      return formatRefLongFormWithLocks(ref);
    }),
  );
}

/**
 * Convert REF long-form storage to A1 surface for display. Tolerant —
 * unknown fields and out-of-range rows become `#REF!` in the output.
 *
 * Same-row storage (`REF(COLUMN("field"))`, no ROW) renders as a concrete
 * A1 ref tied to the **host row** when `ctx.currentRowId` is provided —
 * this matches spreadsheet intuition (a cell on row 5 shows `=C5*D5`, a
 * cell on row 6 shows `=C6*D6`). Without a host row (tests, offline tools),
 * it falls back to the `[field]` bracket shorthand that round-trips losslessly.
 *
 *   longFormToA1('=REF(COLUMN("price"),ROW(1))+1', ctx)
 *     → '=A1+1'
 *   longFormToA1('=REF(COLUMN("price"))*REF(COLUMN("qty"))', ctxRow1)
 *     → '=A1*B1'                            // with currentRowId → row 1
 *   longFormToA1('=REF(COLUMN("price"))*REF(COLUMN("qty"))', ctx)
 *     → '=[price]*[qty]'                    // no currentRowId → fallback
 */
export function longFormToA1(source: string, ctx: RefMapperContext): string {
  let out = source;
  // Resolve the host row once — undefined when the caller didn't provide
  // one or the id is not in the current window. When undefined, same-row
  // refs render in bracket form so they still round-trip through a1ToLongForm.
  const hostRow =
    ctx.currentRowId !== undefined ? ctx.rowIds.indexOf(ctx.currentRowId) + 1 : 0;

  // Same-row form first: `REF(COLUMN("field"))` → `B5` (host row) or `[field]`
  // (no host row). Must run before the row-form regex because they share the
  // `REF(COLUMN("…")` prefix; the row-form regex does not match the no-ROW
  // shape, so order is about clarity rather than correctness.
  const SAME_ROW_RE = /REF\(COLUMN\("((?:[^"]|"")*)"\)\)/g;
  out = out.replace(SAME_ROW_RE, (_match, rawField: string) => {
    const field = rawField.replace(/""/g, '"');
    if (hostRow >= 1) {
      return cellRefToA1(
        { field, row: hostRow, absField: false, absRow: false },
        ctx.fields,
      );
    }
    return cellRefToA1(
      { field, row: 0, absField: false, absRow: false, sameRow: true },
      ctx.fields,
    );
  });
  // Naive scan: find every `REF(COLUMN("…"),ROW(N)[,"…"])` call.
  // The ref grammar is simple enough that a regex is sufficient here.
  const RE = /REF\(COLUMN\("((?:[^"]|"")*)"\),ROW\((\d+)\)(?:,"(\$C|\$R|\$CR)")?\)/g;
  out = out.replace(RE, (_match, rawField: string, digits: string, lock: string | undefined) => {
    const field = rawField.replace(/""/g, '"');
    const row = Number(digits);
    const absField = lock === '$C' || lock === '$CR';
    const absRow = lock === '$R' || lock === '$CR';
    return cellRefToA1({ field, row, absField, absRow }, ctx.fields);
  });
  return out;
}

/**
 * Serialize a single ref to its long-form storage representation. Emits
 * the optional lock marker only when at least one dimension is absolute.
 */
export function formatRefLongFormWithLocks(ref: StructuredRef): string {
  const base = cellRefToLongForm(ref);
  // Same-row refs use the `REF(COLUMN("…"))` shape — no ROW to lock. Locks
  // aren't meaningful there, so we leave the base string untouched.
  if (ref.sameRow) return base;
  if (!ref.absField && !ref.absRow) return base;
  const lock = ref.absField && ref.absRow ? '$CR' : ref.absField ? '$C' : '$R';
  // base ends with `))`; inject `,"lock"` before the final `)`.
  return `${base.slice(0, -1)},"${lock}")`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Walk `source` and only apply `fn` to stretches that are *not* inside a
 * `"…"` string literal (which may appear in function args like
 * `CONCAT("A1 literal", …)`). Preserves `""` as an escaped quote.
 */
function replaceOutsideStrings(source: string, fn: (chunk: string) => string): string {
  const out: string[] = [];
  let i = 0;
  let plainStart = 0;
  const len = source.length;
  while (i < len) {
    if (source[i] === '"') {
      out.push(fn(source.slice(plainStart, i)));
      const strStart = i;
      i++;
      while (i < len) {
        if (source[i] === '"') {
          if (source[i + 1] === '"') {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      out.push(source.slice(strStart, i));
      plainStart = i;
      continue;
    }
    i++;
  }
  out.push(fn(source.slice(plainStart)));
  return out.join('');
}

/**
 * An A1 match `A1` inside `foo1` or `A1bar` or after `_` must NOT be
 * rewritten — it belongs to a larger identifier. Returns true when the
 * preceding or following character would make the match part of an ident.
 */
function isIdentLikeContext(source: string, offset: number, length: number): boolean {
  const before = source[offset - 1];
  const after = source[offset + length];
  if (before && (isAlphaNum(before) || before === '_' || before === '.')) return true;
  if (after && (isAlphaNum(after) || after === '_' || after === '.')) return true;
  return false;
}

function isAlphaNum(ch: string): boolean {
  return (
    (ch >= 'A' && ch <= 'Z') ||
    (ch >= 'a' && ch <= 'z') ||
    (ch >= '0' && ch <= '9')
  );
}

/**
 * Produce the field-quoting used inside COLUMN("…") — exposed so the editor
 * can build REF strings when inserting click-to-pick refs.
 */
export function quoteFieldForColumn(field: string): string {
  return formatField(field);
}
