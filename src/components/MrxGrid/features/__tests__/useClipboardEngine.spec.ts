import { describe, it, expect, beforeEach } from 'vitest'
import { useGridState } from '../../state/useGridState'
import { useClipboardEngine, PASTE_SKIP } from '../useClipboardEngine'
import type { ColumnDef } from '../../types'

interface Row {
  id: number
  name: string
  age: number | null
  active: boolean
  status: string
}

const columns: ColumnDef<Row>[] = [
  { field: 'id', headerName: 'ID' },
  { field: 'name', headerName: 'Name', editable: true, cellEditor: 'text' },
  { field: 'age', headerName: 'Age', editable: true, cellEditor: 'number' },
  { field: 'active', headerName: 'Active', editable: true, cellEditor: 'checkbox' },
  {
    field: 'status',
    headerName: 'Status',
    editable: true,
    cellEditor: 'select',
    cellEditorOptions: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  },
]

function setup(rows: Row[] = seed()) {
  const state = useGridState<Row>()
  state.initColumns(columns)
  state.sourceData.value = rows
  const clipboard = useClipboardEngine<Row>(state, (i) => i)
  return { state, clipboard }
}

function seed(): Row[] {
  return [
    { id: 1, name: 'Alice', age: 30, active: true, status: 'open' },
    { id: 2, name: 'Bob', age: 25, active: false, status: 'closed' },
    { id: 3, name: 'Carol', age: 40, active: true, status: 'open' },
  ]
}

describe('useClipboardEngine / coerceAndValidate', () => {
  let state: ReturnType<typeof setup>['state']
  let clipboard: ReturnType<typeof setup>['clipboard']
  beforeEach(() => {
    ;({ state, clipboard } = setup())
  })

  it('returns PASTE_SKIP for non-editable fields', () => {
    expect(clipboard.coerceAndValidate('id', 42, state.sourceData.value[0]!)).toBe(PASTE_SKIP)
  })

  it('coerces numbers and rejects NaN', () => {
    expect(clipboard.coerceAndValidate('age', '50', state.sourceData.value[0]!)).toBe(50)
    expect(clipboard.coerceAndValidate('age', 'xxx', state.sourceData.value[0]!)).toBe(PASTE_SKIP)
  })

  it('coerces checkbox strings', () => {
    expect(clipboard.coerceAndValidate('active', 'true', state.sourceData.value[0]!)).toBe(true)
    expect(clipboard.coerceAndValidate('active', 'false', state.sourceData.value[0]!)).toBe(false)
    expect(clipboard.coerceAndValidate('active', 'other', state.sourceData.value[0]!)).toBe(PASTE_SKIP)
  })

  it('rejects select values outside the option set', () => {
    expect(clipboard.coerceAndValidate('status', 'open', state.sourceData.value[0]!)).toBe('open')
    expect(clipboard.coerceAndValidate('status', 'foo', state.sourceData.value[0]!)).toBe(PASTE_SKIP)
  })

  it('clears to type-appropriate defaults on null input', () => {
    expect(clipboard.coerceAndValidate('age', null, state.sourceData.value[0]!)).toBe(null)
    expect(clipboard.coerceAndValidate('active', null, state.sourceData.value[0]!)).toBe(false)
    expect(clipboard.coerceAndValidate('name', null, state.sourceData.value[0]!)).toBe('')
  })
})

describe('useClipboardEngine / fill + clear + paste', () => {
  it('fillDown writes source row values into subsequent rows and skips source', () => {
    const { state, clipboard } = setup()
    const changes = clipboard.fillDown({
      start: { row: 0, col: 1 },
      end: { row: 2, col: 2 },
    })
    expect(changes).toHaveLength(4)
    expect(state.sourceData.value[1]).toMatchObject({ name: 'Alice', age: 30 })
    expect(state.sourceData.value[2]).toMatchObject({ name: 'Alice', age: 30 })
    expect(state.sourceData.value[0]).toMatchObject({ name: 'Alice', age: 30 })
  })

  it('fillRight writes column-0 value across a single row', () => {
    const { state, clipboard } = setup()
    const changes = clipboard.fillRight({
      start: { row: 0, col: 1 },
      end: { row: 0, col: 2 },
    })
    // only editable columns change, 'age' is number so 'Alice' → NaN → PASTE_SKIP
    expect(changes).toEqual([])
    expect(state.sourceData.value[0]).toMatchObject({ name: 'Alice', age: 30 })
  })

  it('clearRange wipes editable cells, leaves read-only alone', () => {
    const { state, clipboard } = setup()
    const changes = clipboard.clearRange({
      start: { row: 0, col: 0 },
      end: { row: 0, col: 2 },
    })
    // id is non-editable → only name + age cleared
    expect(changes).toHaveLength(2)
    expect(state.sourceData.value[0]).toMatchObject({ id: 1, name: '', age: null })
  })

  it('applyPaste writes a TSV block starting at range.start', () => {
    const { state, clipboard } = setup()
    const changes = clipboard.applyPaste(
      { start: { row: 1, col: 1 }, end: { row: 2, col: 2 } },
      [
        ['Zoe', '99'],
        ['Yan', '11'],
      ],
    )
    expect(changes).toHaveLength(4)
    expect(state.sourceData.value[1]).toMatchObject({ name: 'Zoe', age: 99 })
    expect(state.sourceData.value[2]).toMatchObject({ name: 'Yan', age: 11 })
  })

  it('applyChanges reverts to `before` and re-applies on `after`', () => {
    const { state, clipboard } = setup()
    const changes = [
      { rowIndex: 0, field: 'name', before: 'Alice', after: 'Z' },
      { rowIndex: 0, field: 'age', before: 30, after: 99 },
    ]
    clipboard.applyChanges(changes, 'after')
    expect(state.sourceData.value[0]).toMatchObject({ name: 'Z', age: 99 })
    clipboard.applyChanges(changes, 'before')
    expect(state.sourceData.value[0]).toMatchObject({ name: 'Alice', age: 30 })
  })
})

describe('useClipboardEngine / tsv + cut', () => {
  it('extractTsv stringifies via valueFormatter when present', () => {
    const { clipboard } = setup()
    const tsv = clipboard.extractTsv({ start: { row: 0, col: 1 }, end: { row: 1, col: 2 } })
    expect(tsv).toEqual([
      ['Alice', '30'],
      ['Bob', '25'],
    ])
  })

  it('cutEdges returns the four outline booleans plus `any`', () => {
    const { state, clipboard } = setup()
    state.cutSource.value = { start: { row: 1, col: 1 }, end: { row: 2, col: 2 } }
    expect(clipboard.cutEdges(1, 1)).toEqual({
      top: true,
      right: false,
      bottom: false,
      left: true,
      any: true,
    })
    expect(clipboard.cutEdges(2, 2)).toEqual({
      top: false,
      right: true,
      bottom: true,
      left: false,
      any: true,
    })
    expect(clipboard.cutEdges(5, 5).any).toBe(false)
  })
})
