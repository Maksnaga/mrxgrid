/**
 * Shifts every *relative* reference inside a stored REF long-form formula
 * by a given row / column offset. Used by the clipboard engine when a
 * formula is dragged across a fill range: the relative row part slides
 * with the target row, and the column (named by `field`) slides across
 * the visible column order.
 *
 * Absolute markers (`$C` / `$R` / `$CR`) are preserved untouched — they
 * match Excel's `$A$1` semantics. Shifts that push a row below 1 or a
 * column outside the visible range emit `#REF!` in place of the ref, so
 * the evaluator can surface the broken reference.
 *
 * The function operates on the long-form storage string directly (no
 * parse / re-print round-trip) because shifting preserves the surrounding
 * tokens verbatim — safest and cheapest.
 */

import { cellRefToLongForm, formatField, StructuredRef } from './formula-ast';

export interface ShiftOptions {
  readonly rowDelta: number;
  readonly colDelta: number;
  /**
   * Ordered list of visible column fields. Required when `colDelta !== 0`;
   * when column shifts are not needed, an empty array is fine.
   */
  readonly fieldOrder: readonly string[];
}

/**
 * Matches a REF long-form call including its optional lock marker. The
 * regex is conservative — it requires the exact `REF(COLUMN("…"),ROW(N))`
 * shape — so any non-ref content (numbers, function calls, strings) is
 * left alone.
 */
const LONG_FORM_RE =
  /REF\(COLUMN\("((?:[^"]|"")*)"\),ROW\((\d+)\)(?:,"(\$C|\$R|\$CR)")?\)/g;

export function shiftFormulaRefs(source: string, options: ShiftOptions): string {
  const { rowDelta, colDelta, fieldOrder } = options;
  if (rowDelta === 0 && colDelta === 0) return source;

  return source.replace(LONG_FORM_RE, (_match, rawField: string, digits: string, lock: string | undefined) => {
    const field = rawField.replace(/""/g, '"');
    const row = Number(digits);
    const absField = lock === '$C' || lock === '$CR';
    const absRow = lock === '$R' || lock === '$CR';

    let nextField = field;
    if (!absField && colDelta !== 0) {
      const idx = fieldOrder.indexOf(field);
      if (idx < 0) return '#REF!';
      const nextIdx = idx + colDelta;
      const candidate = fieldOrder[nextIdx];
      if (candidate === undefined) return '#REF!';
      nextField = candidate;
    }

    let nextRow = row;
    if (!absRow && rowDelta !== 0) {
      nextRow = row + rowDelta;
      if (nextRow < 1) return '#REF!';
    }

    const nextRef: StructuredRef = { field: nextField, row: nextRow, absField, absRow };
    // Use the field-only helper to get a clean `REF(COLUMN("…"),ROW(N))`,
    // then re-append the lock marker when at least one dim is absolute.
    const base = cellRefToLongForm(nextRef);
    if (!absField && !absRow) return base;
    const nextLock = absField && absRow ? '$CR' : absField ? '$C' : '$R';
    return `${base.slice(0, -1)},"${nextLock}")`;
  });

  // `formatField` is not used directly because field-name quoting inside
  // COLUMN("…") uses the same "double any embedded quote" rule as
  // `cellRefToLongForm` — which `cellRefToLongForm` already applies.
  void formatField;
}
