// @ts-nocheck — Adapted from Angular `formula.engine.spec.ts`. Strict typing
// pending review against the composable's runtime shape.

import { computed, ref } from 'vue'
import { describe, it, expect } from 'vitest'
import { useFormulaEngine } from '../useFormulaEngine'
import type { GridState } from '../../../state/useGridState'
import type { ColumnDef, ColumnStateEntry } from '../../../models/column.model'

/**
 * Minimal mock of `GridState` — the engine only touches `columnDefs`,
 * `columnDefMap`, `visibleColumns`, `rowIdField`, `sourceData`,
 * `cellEditState` and `formulaBarEditingActive`. We expose writable refs
 * so tests can mutate source data and trigger re-evaluation.
 */
function mockState(
  rows: Record<string, unknown>[],
  fields: string[],
): GridState & { sourceData: ReturnType<typeof ref> } {
  const columnDefs = ref<ColumnDef[]>(
    fields.map((f) => ({ field: f, headerName: f, allowFormula: true }) as ColumnDef),
  )
  const columnDefMap = computed(() => {
    const map = new Map<string, ColumnDef>()
    for (const c of columnDefs.value) map.set(c.field, c)
    return map
  })
  const visibleColumns = computed<Partial<ColumnStateEntry>[]>(() =>
    fields.map((f, i) => ({ field: f, order: i, visible: true })),
  )
  const rowIdField = ref<string>('id')
  const state = {
    columnDefs,
    columnDefMap,
    visibleColumns,
    rowIdField,
    rowIdResolver: ref(
      (row: Record<string, unknown>) => row[rowIdField.value] as string | number | undefined,
    ),
    sourceData: ref<unknown[]>(rows),
    cellEditState: ref({ editingCell: null }),
    formulaBarEditingActive: ref(false),
  } as unknown as GridState & { sourceData: ReturnType<typeof ref> }
  return state
}

function makeEngine(rows: Record<string, unknown>[], fields: string[]) {
  const state = mockState(rows, fields)
  const engine = useFormulaEngine(state)
  return { engine, state }
}

const ref_ = (field: string, row: number): string =>
  `REF(COLUMN("${field}"),ROW(${row}))`

describe('useFormulaEngine — basic set / evaluate', () => {
  it('evaluates an arithmetic formula referencing source cells (A1 input)', () => {
    const { engine } = makeEngine(
      [{ id: 'r1', price: 10, qty: 3 }],
      ['price', 'qty', 'total'],
    )
    const value = engine.set({ rowId: 'r1', field: 'total' }, '=A1*B1')
    expect(value).toEqual({ kind: 'number', value: 30 })
    expect(engine.valueAt({ rowId: 'r1', field: 'total' })).toEqual({
      kind: 'number',
      value: 30,
    })
  })

  it('accepts REF long-form input as-is (round-trip stable)', () => {
    const { engine } = makeEngine(
      [
        { id: 'r1', price: 10, qty: 3 },
        { id: 'r2', price: 5, qty: 2 },
      ],
      ['price', 'qty', 'total'],
    )
    engine.set(
      { rowId: 'r1', field: 'total' },
      `=${ref_('price', 1)}*${ref_('qty', 1)}`,
    )
    engine.set(
      { rowId: 'r2', field: 'total' },
      `=${ref_('price', 2)}*${ref_('qty', 2)}`,
    )
    expect(engine.valueAt({ rowId: 'r1', field: 'total' })).toEqual({
      kind: 'number',
      value: 30,
    })
    expect(engine.valueAt({ rowId: 'r2', field: 'total' })).toEqual({
      kind: 'number',
      value: 10,
    })
  })

  it('recomputes dependents on invalidate', () => {
    const { engine, state } = makeEngine(
      [
        { id: 'r1', price: 10, qty: 3 },
        { id: 'r2', price: 5, qty: 2 },
      ],
      ['price', 'qty', 'total'],
    )
    engine.set({ rowId: 'r1', field: 'total' }, '=A1*B1')
    state.sourceData.value = [
      { id: 'r1', price: 20, qty: 3 },
      { id: 'r2', price: 5, qty: 2 },
    ]
    engine.invalidate({ rowId: 'r1', field: 'price' })
    expect(engine.valueAt({ rowId: 'r1', field: 'total' })).toEqual({
      kind: 'number',
      value: 60,
    })
  })

  it('displayFormula re-renders stored long-form as A1', () => {
    const { engine } = makeEngine(
      [{ id: 'r1', price: 10, qty: 3 }],
      ['price', 'qty', 'total'],
    )
    engine.set({ rowId: 'r1', field: 'total' }, '=A1*B1')
    expect(engine.displayFormula({ rowId: 'r1', field: 'total' })).toBe('=A1*B1')
  })
})

describe('useFormulaEngine — cycles', () => {
  it('flags a 2-cycle as #CYCLE!', () => {
    const { engine } = makeEngine([{ id: 'r1', a: 0, b: 0 }], ['a', 'b'])
    engine.set({ rowId: 'r1', field: 'a' }, '=B1')
    const result = engine.set({ rowId: 'r1', field: 'b' }, '=A1')
    expect(result).toEqual({ kind: 'error', error: '#CYCLE!' })
    expect(engine.valueAt({ rowId: 'r1', field: 'a' })).toEqual({
      kind: 'error',
      error: '#CYCLE!',
    })
  })

  it('clears the cycle error when one side is replaced', () => {
    const { engine } = makeEngine([{ id: 'r1', a: 0, b: 0 }], ['a', 'b'])
    engine.set({ rowId: 'r1', field: 'a' }, '=B1')
    engine.set({ rowId: 'r1', field: 'b' }, '=A1')
    engine.set({ rowId: 'r1', field: 'b' }, '=42')
    expect(engine.valueAt({ rowId: 'r1', field: 'b' })).toEqual({
      kind: 'number',
      value: 42,
    })
    engine.invalidate({ rowId: 'r1', field: 'b' })
    expect(engine.valueAt({ rowId: 'r1', field: 'a' })).toEqual({
      kind: 'number',
      value: 42,
    })
  })
})

describe('useFormulaEngine — errors', () => {
  it('stores #PARSE! for malformed input', () => {
    const { engine } = makeEngine([{ id: 'r1' }], ['a'])
    const result = engine.set({ rowId: 'r1', field: 'a' }, '=1 +')
    expect(result).toEqual({ kind: 'error', error: '#PARSE!' })
  })

  it('surfaces #REF! when a stored REF points to an unknown field', () => {
    const { engine } = makeEngine([{ id: 'r1', a: 1 }], ['a'])
    const result = engine.set(
      { rowId: 'r1', field: 'a' },
      `=${ref_('missing', 1)}`,
    )
    expect(result).toEqual({ kind: 'error', error: '#REF!' })
  })

  it('removes formulas and re-evaluates dependents', () => {
    const { engine } = makeEngine(
      [{ id: 'r1', a: 1, b: 2, c: 0 }],
      ['a', 'b', 'c'],
    )
    engine.set({ rowId: 'r1', field: 'c' }, '=A1+B1')
    engine.set({ rowId: 'r1', field: 'b' }, '=A1*10')
    expect(engine.valueAt({ rowId: 'r1', field: 'c' })).toEqual({
      kind: 'number',
      value: 11,
    })
    engine.remove({ rowId: 'r1', field: 'b' })
    expect(engine.valueAt({ rowId: 'r1', field: 'c' })).toEqual({
      kind: 'number',
      value: 3,
    })
  })
})

describe('useFormulaEngine — cross-row formulas', () => {
  it('sums a range that spans rows', () => {
    const { engine } = makeEngine(
      [
        { id: 'r1', price: 10 },
        { id: 'r2', price: 20 },
        { id: 'r3', price: 30 },
      ],
      ['price', 'total'],
    )
    const result = engine.set(
      { rowId: 'r1', field: 'total' },
      `=SUM(${ref_('price', 1)}:${ref_('price', 3)})`,
    )
    expect(result).toEqual({ kind: 'number', value: 60 })
  })
})

describe('useFormulaEngine — same-row refs', () => {
  it('resolves [field] against the host cell row (different result per row)', () => {
    const { engine } = makeEngine(
      [
        { id: 'r1', price: 10, qty: 3 },
        { id: 'r2', price: 5, qty: 4 },
      ],
      ['price', 'qty', 'total'],
    )
    engine.set({ rowId: 'r1', field: 'total' }, '=[price]*[qty]')
    engine.set({ rowId: 'r2', field: 'total' }, '=[price]*[qty]')
    expect(engine.valueAt({ rowId: 'r1', field: 'total' })).toEqual({
      kind: 'number',
      value: 30,
    })
    expect(engine.valueAt({ rowId: 'r2', field: 'total' })).toEqual({
      kind: 'number',
      value: 20,
    })
  })

  it('renders same-row storage as concrete A1 refs per host row', () => {
    const { engine } = makeEngine(
      [
        { id: 'r1', price: 10, qty: 3 },
        { id: 'r2', price: 5, qty: 4 },
      ],
      ['price', 'qty', 'total'],
    )
    engine.set({ rowId: 'r1', field: 'total' }, '=[price]*[qty]')
    engine.set({ rowId: 'r2', field: 'total' }, '=[price]*[qty]')
    expect(engine.displayFormula({ rowId: 'r1', field: 'total' })).toBe('=A1*B1')
    expect(engine.displayFormula({ rowId: 'r2', field: 'total' })).toBe('=A2*B2')
  })

  it('collapses A1 refs pointing at the host row back to same-row storage', () => {
    const { engine } = makeEngine(
      [
        { id: 'r1', price: 10, qty: 3 },
        { id: 'r2', price: 5, qty: 4 },
      ],
      ['price', 'qty', 'total'],
    )
    engine.set({ rowId: 'r1', field: 'total' }, '=A1*B1')
    expect(engine.displayFormula({ rowId: 'r1', field: 'total' })).toBe('=A1*B1')
    engine.set({ rowId: 'r2', field: 'total' }, '=A2*B2')
    expect(engine.valueAt({ rowId: 'r2', field: 'total' })).toEqual({
      kind: 'number',
      value: 20,
    })
  })

  it('tracks dependencies correctly and recomputes on invalidate', () => {
    const { engine, state } = makeEngine(
      [{ id: 'r1', price: 10, qty: 3 }],
      ['price', 'qty', 'total'],
    )
    engine.set({ rowId: 'r1', field: 'total' }, '=[price]*[qty]')
    expect(engine.valueAt({ rowId: 'r1', field: 'total' })).toEqual({
      kind: 'number',
      value: 30,
    })
    state.sourceData.value = [{ id: 'r1', price: 20, qty: 3 }]
    engine.invalidate({ rowId: 'r1', field: 'price' })
    expect(engine.valueAt({ rowId: 'r1', field: 'total' })).toEqual({
      kind: 'number',
      value: 60,
    })
  })
})

describe('useFormulaEngine — reactive surface', () => {
  it('exposes `values` Ref reflecting all stored formulas', () => {
    const { engine } = makeEngine(
      [{ id: 'r1', a: 1, b: 2 }],
      ['a', 'b', 'c'],
    )
    expect(engine.values.value.size).toBe(0)
    engine.set({ rowId: 'r1', field: 'c' }, '=A1+B1')
    expect(engine.values.value.size).toBe(1)
    expect(engine.values.value.get('r1|c')).toEqual({ kind: 'number', value: 3 })
  })

  it('hasAnyFormula is reactive', () => {
    const { engine } = makeEngine([{ id: 'r1', a: 1 }], ['a'])
    expect(engine.hasAnyFormula.value).toBe(false)
    engine.set({ rowId: 'r1', field: 'a' }, '=42')
    expect(engine.hasAnyFormula.value).toBe(true)
    engine.clear()
    expect(engine.hasAnyFormula.value).toBe(false)
  })

  it('clear() drops all entries', () => {
    const { engine } = makeEngine([{ id: 'r1', a: 1 }], ['a', 'b'])
    engine.set({ rowId: 'r1', field: 'a' }, '=42')
    engine.set({ rowId: 'r1', field: 'b' }, '=A1*2')
    expect(engine.values.value.size).toBe(2)
    engine.clear()
    expect(engine.values.value.size).toBe(0)
  })
})

describe('useFormulaEngine — syncFromSource', () => {
  it('registers `=…` strings baked into source rows', () => {
    const { engine } = makeEngine(
      [{ id: 'r1', a: 5, b: 3, total: '=A1+B1' }],
      ['a', 'b', 'total'],
    )
    engine.syncFromSource((field) => field === 'total')
    expect(engine.hasFormula({ rowId: 'r1', field: 'total' })).toBe(true)
    expect(engine.valueAt({ rowId: 'r1', field: 'total' })).toEqual({
      kind: 'number',
      value: 8,
    })
  })

  it('drops formulas for rows that no longer have a backing `=…` string', () => {
    const { engine, state } = makeEngine(
      [{ id: 'r1', a: 5, total: '=A1*2' }],
      ['a', 'total'],
    )
    engine.syncFromSource((field) => field === 'total')
    expect(engine.hasFormula({ rowId: 'r1', field: 'total' })).toBe(true)
    state.sourceData.value = [{ id: 'r1', a: 5, total: 10 }]
    engine.syncFromSource((field) => field === 'total')
    expect(engine.hasFormula({ rowId: 'r1', field: 'total' })).toBe(false)
  })

  it('uses `rowIdResolver` for rows without an `id` field (regression)', () => {
    // Stress-demo shape: rows are `{col_0, col_1, …}` with no `id` field.
    // Without a custom resolver, `r['id']` is undefined and every row was
    // silently skipped, leaving formulas unparsed and the cell rendering
    // its raw `=[col_0]+100` source string.
    const { engine, state } = makeEngine(
      [
        { col_0: 1, col_1: 'a', col_2: '=[col_0]+100' },
        { col_0: 2, col_1: 'b', col_2: '=[col_0]+100' },
      ],
      ['col_0', 'col_1', 'col_2'],
    )
    state.rowIdResolver.value = (row: Record<string, unknown>) => String(row.col_0)
    engine.syncFromSource((field) => field === 'col_2')
    expect(engine.hasFormula({ rowId: '1', field: 'col_2' })).toBe(true)
    expect(engine.valueAt({ rowId: '1', field: 'col_2' })).toEqual({
      kind: 'number',
      value: 101,
    })
    expect(engine.valueAt({ rowId: '2', field: 'col_2' })).toEqual({
      kind: 'number',
      value: 102,
    })
  })
})
