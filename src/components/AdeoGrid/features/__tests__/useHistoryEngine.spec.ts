import { describe, it, expect, beforeEach } from 'vitest'
import { useGridState } from '../../state/useGridState'
import { useClipboardEngine } from '../useClipboardEngine'
import { useHistoryEngine } from '../useHistoryEngine'
import type { ColumnDef } from '../../types'

interface Row {
  id: number
  name: string
}

const columns: ColumnDef<Row>[] = [
  { field: 'id', headerName: 'ID' },
  { field: 'name', headerName: 'Name', editable: true, cellEditor: 'text' },
]

function setup() {
  const state = useGridState<Row>()
  state.initColumns(columns)
  state.sourceData.value = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ]
  const clipboard = useClipboardEngine<Row>(state, (i) => i)
  const history = useHistoryEngine<Row>(clipboard)
  return { state, clipboard, history }
}

describe('useHistoryEngine', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('ignores record() with empty changes', () => {
    const { history } = setup()
    history.record('edit', [])
    expect(history.canUndo.value).toBe(false)
  })

  it('undo reverts sourceData and pushes onto redo stack', () => {
    const { state, history } = setup()
    state.sourceData.value = [
      { id: 1, name: 'Zed' },
      { id: 2, name: 'Bob' },
    ]
    history.record('edit', [{ rowIndex: 0, field: 'name', before: 'Alice', after: 'Zed' }])

    expect(history.canUndo.value).toBe(true)
    history.undo()
    expect(state.sourceData.value[0]?.name).toBe('Alice')
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(true)
  })

  it('redo re-applies after undo', () => {
    const { state, history } = setup()
    state.sourceData.value = [
      { id: 1, name: 'Zed' },
      { id: 2, name: 'Bob' },
    ]
    history.record('edit', [{ rowIndex: 0, field: 'name', before: 'Alice', after: 'Zed' }])
    history.undo()
    history.redo()
    expect(state.sourceData.value[0]?.name).toBe('Zed')
  })

  it('record clears the redo stack', () => {
    const { state, history } = setup()
    state.sourceData.value[0] = { id: 1, name: 'Zed' }
    history.record('edit', [{ rowIndex: 0, field: 'name', before: 'Alice', after: 'Zed' }])
    history.undo()
    expect(history.canRedo.value).toBe(true)
    history.record('edit', [{ rowIndex: 1, field: 'name', before: 'Bob', after: 'Carol' }])
    expect(history.canRedo.value).toBe(false)
  })

  it('caps the past stack at MAX_HISTORY (50)', () => {
    const { history } = setup()
    for (let i = 0; i < 55; i++) {
      history.record('edit', [{ rowIndex: 0, field: 'name', before: `v${i}`, after: `v${i + 1}` }])
    }
    let undoCount = 0
    while (history.canUndo.value) {
      history.undo()
      undoCount++
    }
    expect(undoCount).toBe(50)
  })

  it('attach + record persists to localStorage under mrx-grid-history:<id>', () => {
    const { history } = setup()
    history.attach('test-grid')
    history.record('edit', [{ rowIndex: 0, field: 'name', before: 'Alice', after: 'Z' }])
    const raw = localStorage.getItem('adeo-grid-grid-history:test-grid')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.past).toHaveLength(1)
    expect(parsed.past[0].type).toBe('edit')
  })

  it('attach restores previously-persisted stacks', () => {
    localStorage.setItem(
      'adeo-grid-grid-history:restored',
      JSON.stringify({
        past: [
          {
            type: 'edit',
            changes: [{ rowIndex: 0, field: 'name', before: 'a', after: 'b' }],
            timestamp: 1,
          },
        ],
        future: [],
      }),
    )
    const { history } = setup()
    history.attach('restored')
    expect(history.canUndo.value).toBe(true)
  })

  it('clear wipes both stacks and localStorage', () => {
    const { history } = setup()
    history.attach('test-grid-clear')
    history.record('edit', [{ rowIndex: 0, field: 'name', before: 'a', after: 'b' }])
    history.clear()
    expect(history.canUndo.value).toBe(false)
    expect(localStorage.getItem('adeo-grid-grid-history:test-grid-clear')).toBeNull()
  })
})
