import { Injectable, computed, inject } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { CellRange } from '../models/cell.model';
import { GridEngine } from '../engine/grid-engine';
import { shiftFormulaRefs } from './formula/formula-shift';

export const PASTE_SKIP = Symbol('PASTE_SKIP');

export interface HistoryCellChange {
  rowIndex: number;
  field: string;
  before: unknown;
  after: unknown;
}

/**
 * Applies a set of cell-level mutations to sourceData and returns the list of
 * actual changes that occurred, so the caller (usually the history engine) can
 * record them. `PASTE_SKIP` return values are filtered out transparently.
 */
@Injectable()
export class ClipboardEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);
  private readonly gridEngine = inject<GridEngine<T>>(GridEngine);

  /** Derived by components (marching-ants outline). */
  readonly cutRange = computed(() => this.state.cutSource());

  /**
   * Maps every display row index inside `range` to its actual sourceData
   * index. Unknown indices (e.g. outside the current page) are skipped so
   * callers can safely iterate only over rows that exist in sourceData.
   */
  private resolveRangeSourceIndices(range: CellRange): number[] {
    const out: number[] = [];
    for (let r = range.start.row; r <= range.end.row; r++) {
      const srcIdx = this.gridEngine.displayIndexToSourceIndex(r);
      if (srcIdx >= 0) out.push(srcIdx);
    }
    return out;
  }

  /**
   * Like {@link resolveRangeSourceIndices} but also keeps each row's display
   * position. Needed by formula-aware fills, where the shift applied to
   * relative refs is driven by the *display* row delta (column axis is named,
   * so field references never rewrite on horizontal fill).
   */
  private resolveRangeWithDisplay(range: CellRange): { display: number; source: number }[] {
    const out: { display: number; source: number }[] = [];
    for (let r = range.start.row; r <= range.end.row; r++) {
      const srcIdx = this.gridEngine.displayIndexToSourceIndex(r);
      if (srcIdx >= 0) out.push({ display: r, source: srcIdx });
    }
    return out;
  }

  /**
   * Shifts the relative refs of a spreadsheet-style formula when the value
   * is being dropped on a different row/column during a fill operation.
   * Non-formula values (anything that doesn't start with `=`) are returned
   * as-is, so downstream coercion still runs over the raw string.
   */
  private shiftIfFormula(value: unknown, allowFormula: boolean, rowDelta: number, colDelta: number): unknown {
    if (!allowFormula) return value;
    if (typeof value !== 'string') return value;
    if (!value.trimStart().startsWith('=')) return value;
    if (rowDelta === 0 && colDelta === 0) return value;
    const fieldOrder = this.state.visibleColumns().map((c) => c.field);
    return shiftFormulaRefs(value, { rowDelta, colDelta, fieldOrder });
  }

  markCut(range: CellRange): void {
    this.state.cutSource.set(range);
  }

  clearCut(): void {
    this.state.cutSource.set(null);
  }

  // ── B21 — Series detection for fill handle ────────────────────────────

  private detectSeries(sourceValues: unknown[]): { type: 'number' | 'date'; step: number; base: number } | null {
    if (sourceValues.length < 2) return null;

    const allNumbers = sourceValues.every((v) => typeof v === 'number' && isFinite(v as number));
    if (allNumbers) {
      const nums = sourceValues as number[];
      const step = nums[1]! - nums[0]!;
      const isArithmetic = nums.every((v, i) => i === 0 || Math.abs(v - nums[i - 1]! - step) < 1e-9);
      if (isArithmetic) return { type: 'number', step, base: nums[nums.length - 1]! };
    }

    const parsedDates = sourceValues.map((v) => {
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? null : t; }
      return null;
    });
    if (parsedDates.every((t) => t !== null)) {
      const timestamps = parsedDates as number[];
      const step = timestamps[1]! - timestamps[0]!;
      const isArithmetic = timestamps.every((t, i) => i === 0 || Math.abs(t - timestamps[i - 1]! - step) < 1);
      if (isArithmetic) return { type: 'date', step, base: timestamps[timestamps.length - 1]! };
    }
    return null;
  }

  private projectSeries(series: { type: 'number' | 'date'; step: number; base: number }, offset: number): unknown {
    if (series.type === 'number') return series.base + series.step * offset;
    return new Date(series.base + series.step * offset).toISOString().slice(0, 10);
  }

  /** Vertical fill: row 0 of the range is the source, subsequent rows are targets. */
  fillDown(range: CellRange): HistoryCellChange[] {
    if (range.start.row === range.end.row) return [];
    const cols = this.state.visibleColumns();
    const defMap = this.state.columnDefMap();
    const changes: HistoryCellChange[] = [];
    const rows = this.resolveRangeWithDisplay(range);
    if (rows.length < 2) return [];
    const [source, ...targets] = rows;

    this.state.sourceData.update((data) => {
      const updated = [...data];
      const sourceRow = updated[source.source];
      if (!sourceRow) return updated;

      // B21: pre-compute series per column from the entire range's source rows.
      const seriesMap = new Map<string, ReturnType<typeof this.detectSeries>>();
      const allRows = [source, ...targets];
      for (let c = range.start.col; c <= range.end.col; c++) {
        const field = cols[c]?.field;
        if (!field) continue;
        const def = defMap.get(field);
        if (!def?.editable) continue;
        // Collect values from all-but-last rows as "source" values for series
        // detection. Using allRows.slice(0, -1) means [source, ...targets.slice(0, -1)]
        // so a range like [1, 2] → fill 5 rows detects step=1 → projects 3,4,5,6,7.
        const sourceRows = allRows.slice(0, -1);
        const vals = sourceRows.map(({ source: si }) => {
          const r = updated[si];
          if (!r) return undefined;
          return def.valueGetter ? def.valueGetter(r) : (r as Record<string, unknown>)[field];
        }).filter((v) => v !== undefined);
        seriesMap.set(field, this.detectSeries(vals));
      }

      for (const target of targets) {
        if (!updated[target.source]) continue;
        const rowCopy = { ...updated[target.source] } as Record<string, unknown>;
        let changed = false;
        const rowDelta = target.display - source.display;
        for (let c = range.start.col; c <= range.end.col; c++) {
          const field = cols[c]?.field;
          if (!field) continue;
          const def = defMap.get(field);
          if (!def?.editable) continue;
          const sourceValue = def.valueGetter
            ? def.valueGetter(sourceRow)
            : (sourceRow as Record<string, unknown>)[field];
          const series = seriesMap.get(field) ?? null;
          const fillValue = series
            ? this.projectSeries(series, rowDelta)
            : this.shiftIfFormula(sourceValue, def.allowFormula === true, rowDelta, 0);
          const coerced = this.coerceAndValidate(field, fillValue, updated[target.source]);
          if (coerced === PASTE_SKIP) continue;
          const before = (updated[target.source] as Record<string, unknown>)[field];
          if (before === coerced) continue;
          rowCopy[field] = coerced;
          changes.push({ rowIndex: target.source, field, before, after: coerced });
          changed = true;
        }
        if (changed) updated[target.source] = rowCopy as T;
      }
      return updated;
    });

    return changes;
  }

  /** Horizontal fill: col 0 of the range is the source, subsequent cols are targets. */
  fillRight(range: CellRange): HistoryCellChange[] {
    if (range.start.col === range.end.col) return [];
    const cols = this.state.visibleColumns();
    const defMap = this.state.columnDefMap();
    const sourceField = cols[range.start.col]?.field;
    if (!sourceField) return [];
    const sourceDef = defMap.get(sourceField);
    if (!sourceDef) return [];
    const changes: HistoryCellChange[] = [];

    const sourceIndices = this.resolveRangeSourceIndices(range);
    this.state.sourceData.update((data) => {
      const updated = [...data];
      for (const sourceIdx of sourceIndices) {
        const row = updated[sourceIdx];
        if (!row) continue;

        // B21: collect source values across all columns (except last) for series detection.
        const sourceColValues: unknown[] = [];
        for (let c = range.start.col; c < range.end.col; c++) {
          const f = cols[c]?.field;
          if (!f) break;
          const d = defMap.get(f);
          sourceColValues.push(d?.valueGetter ? d.valueGetter(row) : (row as Record<string, unknown>)[f]);
        }
        const series = this.detectSeries(sourceColValues);

        const sourceValue = sourceDef.valueGetter
          ? sourceDef.valueGetter(row)
          : (row as Record<string, unknown>)[sourceField];
        const rowCopy = { ...row } as Record<string, unknown>;
        let changed = false;
        for (let c = range.start.col + 1; c <= range.end.col; c++) {
          const field = cols[c]?.field;
          if (!field) continue;
          const def = defMap.get(field);
          if (!def?.editable) continue;
          const colDelta = c - range.start.col;
          const fillValue = series
            ? this.projectSeries(series, colDelta)
            : this.shiftIfFormula(sourceValue, def.allowFormula === true, 0, colDelta);
          const coerced = this.coerceAndValidate(field, fillValue, row);
          if (coerced === PASTE_SKIP) continue;
          const before = (row as Record<string, unknown>)[field];
          if (before === coerced) continue;
          rowCopy[field] = coerced;
          changes.push({ rowIndex: sourceIdx, field, before, after: coerced });
          changed = true;
        }
        if (changed) updated[sourceIdx] = rowCopy as T;
      }
      return updated;
    });

    return changes;
  }

  /** Ctrl+Enter: write `value` into every editable cell of `range`. */
  fillSelection(range: CellRange, value: unknown): HistoryCellChange[] {
    const cols = this.state.visibleColumns();
    const defMap = this.state.columnDefMap();
    const changes: HistoryCellChange[] = [];
    const sourceIndices = this.resolveRangeSourceIndices(range);

    this.state.sourceData.update((data) => {
      const updated = [...data];
      for (const sourceIdx of sourceIndices) {
        const row = updated[sourceIdx];
        if (!row) continue;
        const rowCopy = { ...row } as Record<string, unknown>;
        let changed = false;
        for (let c = range.start.col; c <= range.end.col; c++) {
          const field = cols[c]?.field;
          if (!field) continue;
          const def = defMap.get(field);
          if (!def?.editable) continue;
          const coerced = this.coerceAndValidate(field, value, row);
          if (coerced === PASTE_SKIP) continue;
          const before = (row as Record<string, unknown>)[field];
          if (before === coerced) continue;
          rowCopy[field] = coerced;
          changes.push({ rowIndex: sourceIdx, field, before, after: coerced });
          changed = true;
        }
        if (changed) updated[sourceIdx] = rowCopy as T;
      }
      return updated;
    });

    return changes;
  }

  /** Clears every editable cell in `range` and returns the undo payload. */
  clearRange(range: CellRange): HistoryCellChange[] {
    const cols = this.state.visibleColumns();
    const defMap = this.state.columnDefMap();
    const changes: HistoryCellChange[] = [];
    const sourceIndices = this.resolveRangeSourceIndices(range);

    this.state.sourceData.update((data) => {
      const updated = [...data];
      for (const sourceIdx of sourceIndices) {
        const row = updated[sourceIdx];
        if (!row) continue;
        const rowCopy = { ...row } as Record<string, unknown>;
        let changed = false;
        for (let c = range.start.col; c <= range.end.col; c++) {
          const field = cols[c]?.field;
          if (!field) continue;
          const def = defMap.get(field);
          if (!def?.editable) continue;
          const coerced = this.coerceAndValidate(field, null, row);
          if (coerced === PASTE_SKIP) continue;
          const before = (row as Record<string, unknown>)[field];
          if (before === coerced) continue;
          rowCopy[field] = coerced;
          changes.push({ rowIndex: sourceIdx, field, before, after: coerced });
          changed = true;
        }
        if (changed) updated[sourceIdx] = rowCopy as T;
      }
      return updated;
    });

    return changes;
  }

  /** Applies TSV `pasteRows` starting at `range.start`, returning actual changes.
   *  B20 — Excel-style tile: when the selection dimensions are integer multiples
   *  of the source block (or the source is 1×1), the source block is tiled to
   *  fill the whole selection. Otherwise pastes the block as-is. */
  applyPaste(range: CellRange, pasteRows: string[][]): HistoryCellChange[] {
    const cols = this.state.visibleColumns();
    const changes: HistoryCellChange[] = [];

    const selRows = range.end.row - range.start.row + 1;
    const selCols = range.end.col - range.start.col + 1;
    const srcRows = pasteRows.length;
    const srcCols = Math.max(...pasteRows.map((r) => r.length), 1);

    const tileRow = srcRows === 1 || selRows % srcRows === 0;
    const tileCol = srcCols === 1 || selCols % srcCols === 0;
    const shouldTile = tileRow && tileCol && (srcRows > 1 || srcCols > 1 || (pasteRows[0]?.length ?? 0) === 1);

    this.state.sourceData.update((data) => {
      const updated = [...data];

      if (shouldTile) {
        for (let dr = 0; dr < selRows; dr++) {
          const targetDisplayRow = range.start.row + dr;
          const sourceIdx = this.gridEngine.displayIndexToSourceIndex(targetDisplayRow);
          if (sourceIdx < 0) continue;
          const row = updated[sourceIdx];
          if (!row) continue;
          const pasteRow = pasteRows[dr % srcRows];
          if (!pasteRow) continue;
          const rowCopy = { ...row } as Record<string, unknown>;
          let changed = false;
          for (let dc = 0; dc < selCols; dc++) {
            const targetCol = range.start.col + dc;
            if (targetCol >= cols.length) break;
            const field = cols[targetCol]?.field;
            if (!field) continue;
            const cellVal = pasteRow[dc % srcCols] ?? '';
            const coerced = this.coerceAndValidate(field, cellVal, row);
            if (coerced === PASTE_SKIP) continue;
            const before = (row as Record<string, unknown>)[field];
            if (before === coerced) continue;
            rowCopy[field] = coerced;
            changes.push({ rowIndex: sourceIdx, field, before, after: coerced });
            changed = true;
          }
          if (changed) updated[sourceIdx] = rowCopy as T;
        }
      } else {
        for (let ri = 0; ri < pasteRows.length; ri++) {
          const targetDisplayRow = range.start.row + ri;
          const sourceIdx = this.gridEngine.displayIndexToSourceIndex(targetDisplayRow);
          if (sourceIdx < 0) continue;
          const row = updated[sourceIdx];
          if (!row) continue;
          const rowCopy = { ...row } as Record<string, unknown>;
          let changed = false;
          for (let ci = 0; ci < pasteRows[ri].length; ci++) {
            const targetCol = range.start.col + ci;
            if (targetCol >= cols.length) break;
            const field = cols[targetCol]?.field;
            if (!field) continue;
            const coerced = this.coerceAndValidate(field, pasteRows[ri][ci], row);
            if (coerced === PASTE_SKIP) continue;
            const before = (row as Record<string, unknown>)[field];
            if (before === coerced) continue;
            rowCopy[field] = coerced;
            changes.push({ rowIndex: sourceIdx, field, before, after: coerced });
            changed = true;
          }
          if (changed) updated[sourceIdx] = rowCopy as T;
        }
      }

      return updated;
    });

    return changes;
  }

  /**
   * Reverses a previously-recorded list of changes by writing `before` back into
   * the cells. Used by the history engine for both undo and redo.
   */
  applyChanges(changes: HistoryCellChange[], direction: 'before' | 'after'): void {
    if (changes.length === 0) return;
    this.state.sourceData.update((data) => {
      const updated = [...data];
      // Group changes by rowIndex so each row is cloned once.
      const byRow = new Map<number, HistoryCellChange[]>();
      for (const change of changes) {
        const list = byRow.get(change.rowIndex) ?? [];
        list.push(change);
        byRow.set(change.rowIndex, list);
      }
      for (const [rowIndex, rowChanges] of byRow) {
        const row = updated[rowIndex];
        if (!row) continue;
        const rowCopy = { ...row } as Record<string, unknown>;
        for (const change of rowChanges) {
          rowCopy[change.field] = direction === 'before' ? change.before : change.after;
        }
        updated[rowIndex] = rowCopy as T;
      }
      return updated;
    });
  }

  /**
   * Coerces a raw value (string from TSV, unknown from fill, null for clears)
   * into the editor's expected type, running the field's validator when present.
   * Returns PASTE_SKIP when the column isn't editable or the value is rejected.
   */
  coerceAndValidate(field: string, rawValue: unknown, row: T): unknown {
    const def = this.state.columnDefMap().get(field);
    if (!def?.editable) return PASTE_SKIP;

    const editorType = def.cellEditor;

    if (rawValue === null) {
      let clearValue: unknown;
      switch (editorType) {
        case 'number':
          clearValue = null;
          break;
        case 'checkbox':
          clearValue = false;
          break;
        default:
          clearValue = '';
      }
      if (def.cellEditorValidator) {
        const result = def.cellEditorValidator(clearValue, row);
        if (result === false || typeof result === 'string') return PASTE_SKIP;
      }
      return clearValue;
    }

    let value: unknown = rawValue;

    if (editorType === 'number') {
      const num = Number(rawValue);
      if (isNaN(num)) return PASTE_SKIP;
      value = num;
    } else if (editorType === 'checkbox') {
      if (rawValue === 'true' || rawValue === true) {
        value = true;
      } else if (rawValue === 'false' || rawValue === false) {
        value = false;
      } else {
        return PASTE_SKIP;
      }
    } else if (
      (editorType === 'select' || editorType === 'custom') &&
      def.cellEditorOptions?.length
    ) {
      // Whitelist clipboard values against the declared allowed set. Applies
      // to both the built-in `select` editor and `custom` editors that expose
      // a constrained option list (combobox, pill-picker, …).
      const allowed = def.cellEditorOptions.map((o) => String(o.value));
      if (!allowed.includes(String(rawValue))) return PASTE_SKIP;
      value = rawValue;
    }

    if (def.cellEditorValidator) {
      const result = def.cellEditorValidator(value, row);
      if (result === false || typeof result === 'string') return PASTE_SKIP;
    }

    return value;
  }

  // ── B19 — RFC-4180 TSV escape / unescape ─────────────────────────────

  private escapeTsvCell(v: unknown): string {
    const s = v == null ? '' : String(v);
    if (s.includes('\t') || s.includes('\n') || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /**
   * Parses a single TSV row string into cells, handling RFC-4180 quoted fields
   * that may contain embedded tabs, newlines, or double-quote pairs.
   */
  parseTsvRow(line: string): string[] {
    const cells: string[] = [];
    let i = 0;
    while (i <= line.length) {
      if (line[i] === '"') {
        i++;
        let cell = '';
        while (i < line.length) {
          if (line[i] === '"') {
            if (line[i + 1] === '"') {
              cell += '"';
              i += 2;
            } else {
              i++;
              break;
            }
          } else {
            cell += line[i++];
          }
        }
        cells.push(cell);
        if (line[i] === '\t') i++;
      } else {
        const end = line.indexOf('\t', i);
        if (end === -1) {
          cells.push(line.slice(i));
          break;
        } else {
          cells.push(line.slice(i, end));
          i = end + 1;
        }
      }
    }
    return cells;
  }

  /** TSV string for a range — used by copy / cut.
   *  B19: cells are RFC-4180 escaped so tab/newline/quote in values don't corrupt the TSV. */
  extractTsv(range: CellRange): string[][] {
    const cols = this.state.visibleColumns();
    const data = this.state.sourceData();
    const defMap = this.state.columnDefMap();
    const values: string[][] = [];

    for (let r = range.start.row; r <= range.end.row; r++) {
      const row = data[r];
      if (!row) continue;
      const rowValues: string[] = [];
      for (let c = range.start.col; c <= range.end.col; c++) {
        const field = cols[c]?.field;
        if (!field) {
          rowValues.push('');
          continue;
        }
        const def = defMap.get(field);
        const val = def?.valueGetter
          ? def.valueGetter(row)
          : (row as Record<string, unknown>)[field];
        rowValues.push(this.escapeTsvCell(val));
      }
      values.push(rowValues);
    }
    return values;
  }

  /**
   * Checks whether a cell sits on any edge of the current cut outline. Four
   * booleans rather than a single "isCut" so the view can paint only the edges
   * that face outward — which is what produces the Excel-like marching ants.
   */
  cutEdges(
    row: number,
    col: number
  ): { top: boolean; right: boolean; bottom: boolean; left: boolean; any: boolean } {
    const cut = this.state.cutSource();
    if (!cut) return { top: false, right: false, bottom: false, left: false, any: false };
    const minRow = Math.min(cut.start.row, cut.end.row);
    const maxRow = Math.max(cut.start.row, cut.end.row);
    const minCol = Math.min(cut.start.col, cut.end.col);
    const maxCol = Math.max(cut.start.col, cut.end.col);
    if (row < minRow || row > maxRow || col < minCol || col > maxCol) {
      return { top: false, right: false, bottom: false, left: false, any: false };
    }
    return {
      top: row === minRow,
      right: col === maxCol,
      bottom: row === maxRow,
      left: col === minCol,
      any: true,
    };
  }
}
