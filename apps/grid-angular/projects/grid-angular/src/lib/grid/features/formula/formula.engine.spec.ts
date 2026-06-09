import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { FormulaEngine } from './formula.engine';
import { GridStateManager } from '../../state/grid-state';
import type { ColumnDef, ColumnStateEntry } from '../../models/column.model';

/**
 * Minimal mock of `GridStateManager` — the engine only touches
 * `columnDefs`, `columnDefMap`, `visibleColumns`, `rowIdField`, `sourceData`,
 * `cellEditState` and `formulaBarEditingActive`. We expose writable signals
 * so tests can mutate source data and trigger re-evaluation.
 */
function mockState(rows: Record<string, unknown>[], fields: string[]): GridStateManager {
  const columnDefs = signal<ColumnDef[]>(
    fields.map((f) => ({ field: f, allowFormula: true }) as ColumnDef),
  );
  const columnDefMap = computed(() => {
    const map = new Map<string, ColumnDef>();
    for (const c of columnDefs()) map.set(c.field, c);
    return map;
  });
  const state = {
    columnDefs,
    columnDefMap,
    visibleColumns: signal<Partial<ColumnStateEntry>[]>(
      fields.map((f, i) => ({ field: f, order: i, visible: true })),
    ),
    rowIdField: signal<string>('id'),
    sourceData: signal<unknown[]>(rows),
    cellEditState: signal({ editingCell: null }),
    formulaBarEditingActive: signal(false),
  } as unknown as GridStateManager;
  return state;
}

function makeEngine(rows: Record<string, unknown>[], fields: string[]): FormulaEngine {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: GridStateManager, useValue: mockState(rows, fields) }, FormulaEngine],
  });
  return TestBed.inject(FormulaEngine);
}

const ref = (field: string, row: number): string => `REF(COLUMN("${field}"),ROW(${row}))`;

describe('FormulaEngine — basic set / evaluate', () => {
  it('evaluates an arithmetic formula referencing source cells (A1 input)', () => {
    const engine = makeEngine([{ id: 'r1', price: 10, qty: 3 }], ['price', 'qty', 'total']);
    // The engine normalises A1 → REF long-form at `set` time.
    const value = engine.set({ rowId: 'r1', field: 'total' }, '=A1*B1');
    expect(value).toEqual({ kind: 'number', value: 30 });
    expect(engine.valueAt({ rowId: 'r1', field: 'total' })).toEqual({
      kind: 'number',
      value: 30,
    });
  });

  it('accepts REF long-form input as-is (round-trip stable)', () => {
    const engine = makeEngine(
      [
        { id: 'r1', price: 10, qty: 3 },
        { id: 'r2', price: 5, qty: 2 },
      ],
      ['price', 'qty', 'total'],
    );
    engine.set({ rowId: 'r1', field: 'total' }, `=${ref('price', 1)}*${ref('qty', 1)}`);
    engine.set({ rowId: 'r2', field: 'total' }, `=${ref('price', 2)}*${ref('qty', 2)}`);
    expect(engine.valueAt({ rowId: 'r1', field: 'total' })).toEqual({
      kind: 'number',
      value: 30,
    });
    expect(engine.valueAt({ rowId: 'r2', field: 'total' })).toEqual({
      kind: 'number',
      value: 10,
    });
  });

  it('recomputes dependents on invalidate', () => {
    const engine = makeEngine(
      [
        { id: 'r1', price: 10, qty: 3 },
        { id: 'r2', price: 5, qty: 2 },
      ],
      ['price', 'qty', 'total'],
    );
    engine.set({ rowId: 'r1', field: 'total' }, '=A1*B1');
    const state = TestBed.inject(GridStateManager);
    (state.sourceData as unknown as { set: (v: unknown) => void }).set([
      { id: 'r1', price: 20, qty: 3 },
      { id: 'r2', price: 5, qty: 2 },
    ]);
    engine.invalidate({ rowId: 'r1', field: 'price' });
    expect(engine.valueAt({ rowId: 'r1', field: 'total' })).toEqual({
      kind: 'number',
      value: 60,
    });
  });

  it('displayFormula re-renders stored long-form as A1', () => {
    const engine = makeEngine([{ id: 'r1', price: 10, qty: 3 }], ['price', 'qty', 'total']);
    engine.set({ rowId: 'r1', field: 'total' }, '=A1*B1');
    expect(engine.displayFormula({ rowId: 'r1', field: 'total' })).toBe('=A1*B1');
  });
});

describe('FormulaEngine — cycles', () => {
  it('flags a 2-cycle as #CYCLE!', () => {
    const engine = makeEngine([{ id: 'r1', a: 0, b: 0 }], ['a', 'b']);
    engine.set({ rowId: 'r1', field: 'a' }, '=B1');
    const result = engine.set({ rowId: 'r1', field: 'b' }, '=A1');
    expect(result).toEqual({ kind: 'error', error: '#CYCLE!' });
    expect(engine.valueAt({ rowId: 'r1', field: 'a' })).toEqual({
      kind: 'error',
      error: '#CYCLE!',
    });
  });

  it('clears the cycle error when one side is replaced', () => {
    const engine = makeEngine([{ id: 'r1', a: 0, b: 0 }], ['a', 'b']);
    engine.set({ rowId: 'r1', field: 'a' }, '=B1');
    engine.set({ rowId: 'r1', field: 'b' }, '=A1');
    engine.set({ rowId: 'r1', field: 'b' }, '=42');
    expect(engine.valueAt({ rowId: 'r1', field: 'b' })).toEqual({
      kind: 'number',
      value: 42,
    });
    engine.invalidate({ rowId: 'r1', field: 'b' });
    expect(engine.valueAt({ rowId: 'r1', field: 'a' })).toEqual({
      kind: 'number',
      value: 42,
    });
  });
});

describe('FormulaEngine — errors', () => {
  it('stores #PARSE! for malformed input', () => {
    const engine = makeEngine([{ id: 'r1' }], ['a']);
    const result = engine.set({ rowId: 'r1', field: 'a' }, '=1 +');
    expect(result).toEqual({ kind: 'error', error: '#PARSE!' });
  });

  it('surfaces #REF! when a stored REF points to an unknown field', () => {
    const engine = makeEngine([{ id: 'r1', a: 1 }], ['a']);
    const result = engine.set({ rowId: 'r1', field: 'a' }, `=${ref('missing', 1)}`);
    expect(result).toEqual({ kind: 'error', error: '#REF!' });
  });

  it('removes formulas and re-evaluates dependents', () => {
    const engine = makeEngine([{ id: 'r1', a: 1, b: 2, c: 0 }], ['a', 'b', 'c']);
    engine.set({ rowId: 'r1', field: 'c' }, '=A1+B1');
    engine.set({ rowId: 'r1', field: 'b' }, '=A1*10');
    expect(engine.valueAt({ rowId: 'r1', field: 'c' })).toEqual({
      kind: 'number',
      value: 11,
    });
    engine.remove({ rowId: 'r1', field: 'b' });
    expect(engine.valueAt({ rowId: 'r1', field: 'c' })).toEqual({
      kind: 'number',
      value: 3,
    });
  });
});

describe('FormulaEngine — cross-row formulas', () => {
  it('sums a range that spans rows', () => {
    const engine = makeEngine(
      [
        { id: 'r1', price: 10 },
        { id: 'r2', price: 20 },
        { id: 'r3', price: 30 },
      ],
      ['price', 'total'],
    );
    const result = engine.set(
      { rowId: 'r1', field: 'total' },
      `=SUM(${ref('price', 1)}:${ref('price', 3)})`,
    );
    expect(result).toEqual({ kind: 'number', value: 60 });
  });
});

describe('FormulaEngine — same-row refs', () => {
  it('resolves [field] against the host cell row (different result per row)', () => {
    const engine = makeEngine(
      [
        { id: 'r1', price: 10, qty: 3 },
        { id: 'r2', price: 5, qty: 4 },
      ],
      ['price', 'qty', 'total'],
    );
    engine.set({ rowId: 'r1', field: 'total' }, '=[price]*[qty]');
    engine.set({ rowId: 'r2', field: 'total' }, '=[price]*[qty]');
    expect(engine.valueAt({ rowId: 'r1', field: 'total' })).toEqual({
      kind: 'number',
      value: 30,
    });
    expect(engine.valueAt({ rowId: 'r2', field: 'total' })).toEqual({
      kind: 'number',
      value: 20,
    });
  });

  it('renders same-row storage as concrete A1 refs per host row', () => {
    const engine = makeEngine(
      [
        { id: 'r1', price: 10, qty: 3 },
        { id: 'r2', price: 5, qty: 4 },
      ],
      ['price', 'qty', 'total'],
    );
    // Same `[field]` input on two rows stores as a shared same-row formula,
    // but `displayFormula` materialises it with each row's concrete A1.
    engine.set({ rowId: 'r1', field: 'total' }, '=[price]*[qty]');
    engine.set({ rowId: 'r2', field: 'total' }, '=[price]*[qty]');
    expect(engine.displayFormula({ rowId: 'r1', field: 'total' })).toBe('=A1*B1');
    expect(engine.displayFormula({ rowId: 'r2', field: 'total' })).toBe('=A2*B2');
  });

  it('collapses A1 refs pointing at the host row back to same-row storage', () => {
    const engine = makeEngine(
      [
        { id: 'r1', price: 10, qty: 3 },
        { id: 'r2', price: 5, qty: 4 },
      ],
      ['price', 'qty', 'total'],
    );
    // User types `=A1*B1` on row 1 — the display/commit round-trip preserves
    // the "applies to current row" meaning rather than pinning it to row 1.
    engine.set({ rowId: 'r1', field: 'total' }, '=A1*B1');
    expect(engine.displayFormula({ rowId: 'r1', field: 'total' })).toBe('=A1*B1');
    // And if the stored formula is shared by r2 (via source init), it
    // resolves against r2's cells without rewriting.
    engine.set({ rowId: 'r2', field: 'total' }, '=A2*B2');
    expect(engine.valueAt({ rowId: 'r2', field: 'total' })).toEqual({
      kind: 'number',
      value: 20,
    });
  });

  it('tracks dependencies correctly and recomputes on invalidate', () => {
    const engine = makeEngine(
      [{ id: 'r1', price: 10, qty: 3 }],
      ['price', 'qty', 'total'],
    );
    engine.set({ rowId: 'r1', field: 'total' }, '=[price]*[qty]');
    expect(engine.valueAt({ rowId: 'r1', field: 'total' })).toEqual({
      kind: 'number',
      value: 30,
    });
    // Simulate a source-data change on `price` — the dependent must refresh.
    (
      engine as unknown as {
        state: { sourceData: { set: (rows: unknown[]) => void } };
      }
    ).state.sourceData.set([{ id: 'r1', price: 20, qty: 3 }]);
    engine.invalidate({ rowId: 'r1', field: 'price' });
    expect(engine.valueAt({ rowId: 'r1', field: 'total' })).toEqual({
      kind: 'number',
      value: 60,
    });
  });
});
