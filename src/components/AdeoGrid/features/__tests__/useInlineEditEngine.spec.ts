import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'
import { useGridState } from '../../state/useGridState'
import { useClipboardEngine } from '../useClipboardEngine'
import { useHistoryEngine } from '../useHistoryEngine'
import { useInlineEditEngine } from '../useInlineEditEngine'
import type { FormulaEngine } from '../formula/useFormulaEngine'
import type { FormulaValue } from '../../models/formula.model'
import type { ColumnDef } from '../../types'

// ─── Shared helpers ──────────────────────────────────────────────────────────

interface Row {
  id: number
  price: number | string
  qty: number | string
  label: string
}

const columns: ColumnDef<Row>[] = [
  { field: 'id', headerName: 'ID' },
  { field: 'price', headerName: 'Price', editable: true },
  { field: 'qty', headerName: 'Qty', editable: true },
  { field: 'label', headerName: 'Label', editable: true },
]

function setup(formulaEngine: FormulaEngine | null = null) {
  const state = useGridState<Row>()
  state.initColumns(columns)
  state.sourceData.value = [
    { id: 1, price: 10, qty: 3, label: 'Alpha' },
    { id: 2, price: 20, qty: 5, label: 'Beta' },
  ]
  const clipboard = useClipboardEngine<Row>(state, (i) => i)
  const history = useHistoryEngine<Row>(clipboard)
  const engine = useInlineEditEngine<Row>(state, history, (i) => i, formulaEngine)
  return { state, history, engine }
}

// ─── Non-formula edits ───────────────────────────────────────────────────────

describe('useInlineEditEngine — basic edits', () => {
  it('startEdit populates cellEditState with the raw value', () => {
    const { state, engine } = setup()
    engine.startEdit(0, 'label')
    expect(state.cellEditState.value.editingCell).toEqual({ row: 0, col: 3 })
    expect(state.cellEditState.value.draftValue).toBe('Alpha')
    expect(state.cellEditState.value.originalValue).toBe('Alpha')
  })

  it('startEdit is a no-op when the column is not editable', () => {
    const { state, engine } = setup()
    engine.startEdit(0, 'id')
    expect(state.cellEditState.value.editingCell).toBeNull()
  })

  it('startEdit is a no-op when the field is unknown', () => {
    const { state, engine } = setup()
    engine.startEdit(0, '__nonexistent')
    expect(state.cellEditState.value.editingCell).toBeNull()
  })

  it('updateDraft changes draftValue without affecting originalValue', () => {
    const { state, engine } = setup()
    engine.startEdit(0, 'label')
    engine.updateDraft('Modified')
    expect(state.cellEditState.value.draftValue).toBe('Modified')
    expect(state.cellEditState.value.originalValue).toBe('Alpha')
  })

  it('commitEdit writes the draft to sourceData and clears cellEditState', () => {
    const { state, engine } = setup()
    engine.startEdit(0, 'label')
    engine.updateDraft('Modified')
    const event = engine.commitEdit()
    expect(event).not.toBeNull()
    expect(event?.newValue).toBe('Modified')
    expect(event?.oldValue).toBe('Alpha')
    expect(state.sourceData.value[0]?.label).toBe('Modified')
    expect(state.cellEditState.value.editingCell).toBeNull()
  })

  it('commitEdit returns null when no edit is in progress', () => {
    const { engine } = setup()
    expect(engine.commitEdit()).toBeNull()
  })

  it('cancelEdit returns the original value and clears state', () => {
    const { state, engine } = setup()
    engine.startEdit(0, 'label')
    engine.updateDraft('Ignored')
    const event = engine.cancelEdit()
    expect(event?.originalValue).toBe('Alpha')
    expect(state.cellEditState.value.editingCell).toBeNull()
    // Source data must NOT be mutated
    expect(state.sourceData.value[0]?.label).toBe('Alpha')
  })

  it('isEditing returns true only for the currently edited cell', () => {
    const { engine } = setup()
    engine.startEdit(1, 'qty')
    // col index of 'qty' is 2
    expect(engine.isEditing(1, 2)).toBe(true)
    expect(engine.isEditing(0, 2)).toBe(false)
    expect(engine.isEditing(1, 1)).toBe(false)
  })
})

// ─── Formula A1↔storage conversion in startEdit ──────────────────────────────

describe('useInlineEditEngine — formula A1 surface on startEdit', () => {
  function makeFormulaEngine(
    displayFormulaResult: string | undefined,
  ): FormulaEngine {
    return {
      values: ref<ReadonlyMap<string, FormulaValue>>(new Map()),
      hasAnyFormula: computed(() => false),
      isFormulaEditActive: computed(() => false),
      setFunctions: vi.fn(),
      getFunctions: vi.fn().mockReturnValue({}),
      setLocale: vi.fn(),
      hasFormula: vi.fn().mockReturnValue(true),
      getFormula: vi.fn().mockReturnValue(undefined),
      valueAt: vi.fn().mockReturnValue(undefined),
      displayFormula: vi.fn().mockReturnValue(displayFormulaResult),
      set: vi.fn().mockReturnValue({ kind: 'number', value: 0 }),
      remove: vi.fn(),
      invalidate: vi.fn(),
      clear: vi.fn(),
      syncFromSource: vi.fn(),
      rebuild: vi.fn(),
    }
  }

  it('leaves draftValue unchanged when formulaEngine is null', () => {
    const { state } = setup()
    // Override price column to allow formula and store a long-form value
    state.initColumns([
      ...columns.slice(0, 1),
      { field: 'price', headerName: 'Price', editable: true, allowFormula: true },
      ...columns.slice(2),
    ])
    state.sourceData.value = [
      { id: 1, price: '=REF(COLUMN("qty"),ROW(1))', qty: 3, label: 'Alpha' },
    ]
    const clipboard = useClipboardEngine(state, (i) => i)
    const history = useHistoryEngine(clipboard)
    const engine = useInlineEditEngine(state, history, (i) => i, null)
    engine.startEdit(0, 'price')
    // Without formula engine, raw long-form is used as-is
    expect(state.cellEditState.value.draftValue).toBe('=REF(COLUMN("qty"),ROW(1))')
  })

  it('converts long-form to A1 via displayFormula when formulaEngine is provided', () => {
    const { state } = setup()
    state.initColumns([
      ...columns.slice(0, 1),
      { field: 'price', headerName: 'Price', editable: true, allowFormula: true },
      ...columns.slice(2),
    ])
    state.sourceData.value = [
      { id: 1, price: '=REF(COLUMN("qty"),ROW(1))', qty: 3, label: 'Alpha' },
    ]
    const fe = makeFormulaEngine('=C1')
    const clipboard = useClipboardEngine(state, (i) => i)
    const history = useHistoryEngine(clipboard)
    const engine = useInlineEditEngine(state, history, (i) => i, fe)

    engine.startEdit(0, 'price')

    // draftValue and originalValue must both be the A1 form
    expect(state.cellEditState.value.draftValue).toBe('=C1')
    expect(state.cellEditState.value.originalValue).toBe('=C1')
    // displayFormula was called with the correct addr
    expect(fe.displayFormula).toHaveBeenCalledWith({ rowId: 1, field: 'price' })
  })

  it('falls back to raw value when displayFormula returns undefined', () => {
    const { state } = setup()
    state.initColumns([
      ...columns.slice(0, 1),
      { field: 'price', headerName: 'Price', editable: true, allowFormula: true },
      ...columns.slice(2),
    ])
    state.sourceData.value = [
      { id: 1, price: '=REF(COLUMN("qty"),ROW(1))', qty: 3, label: 'Alpha' },
    ]
    const fe = makeFormulaEngine(undefined) // engine has no entry for this cell
    const clipboard = useClipboardEngine(state, (i) => i)
    const history = useHistoryEngine(clipboard)
    const engine = useInlineEditEngine(state, history, (i) => i, fe)

    engine.startEdit(0, 'price')
    // Falls back to the stored long-form (no crash)
    expect(state.cellEditState.value.draftValue).toBe('=REF(COLUMN("qty"),ROW(1))')
  })

  it('does not call displayFormula for non-formula columns', () => {
    const { state } = setup()
    // 'label' column does NOT have allowFormula
    const fe = makeFormulaEngine('=A1')
    const clipboard = useClipboardEngine(state, (i) => i)
    const history = useHistoryEngine(clipboard)
    const engine = useInlineEditEngine(state, history, (i) => i, fe)

    engine.startEdit(0, 'label')
    expect(fe.displayFormula).not.toHaveBeenCalled()
    expect(state.cellEditState.value.draftValue).toBe('Alpha')
  })

  it('does not call displayFormula when stored value is not a formula', () => {
    const { state } = setup()
    state.initColumns([
      ...columns.slice(0, 1),
      { field: 'price', headerName: 'Price', editable: true, allowFormula: true },
      ...columns.slice(2),
    ])
    state.sourceData.value = [
      { id: 1, price: 42, qty: 3, label: 'Alpha' },
    ]
    const fe = makeFormulaEngine('=A1')
    const clipboard = useClipboardEngine(state, (i) => i)
    const history = useHistoryEngine(clipboard)
    const engine = useInlineEditEngine(state, history, (i) => i, fe)

    engine.startEdit(0, 'price')
    expect(fe.displayFormula).not.toHaveBeenCalled()
    expect(state.cellEditState.value.draftValue).toBe(42)
  })
})
