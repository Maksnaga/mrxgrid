import { describe, it, expect, beforeEach } from 'vitest'
import { useGridState } from '../../state/useGridState'
import { useStatePersistenceEngine } from '../useStatePersistenceEngine'
import { generateConditionId } from '../../models/filter.model'
import type { ColumnDef } from '../../types'

interface Row {
  id: number
  name: string
  age: number
}

const columns: ColumnDef<Row>[] = [
  { field: 'id', headerName: 'ID', width: '100' },
  { field: 'name', headerName: 'Name', width: '200' },
  { field: 'age', headerName: 'Age', width: '80' },
]

function setup() {
  const state = useGridState<Row>()
  state.initColumns(columns)
  const persistence = useStatePersistenceEngine<Row>(state)
  return { state, persistence }
}

describe('useStatePersistenceEngine', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('save round-trips column layout through localStorage', () => {
    const { state, persistence } = setup()
    state.updateColumnState('name', { currentWidth: 300, pinned: 'start' })
    state.activeSorts.value = [{ field: 'age', direction: 'desc', priority: 0 }]
    persistence.save('test-key')

    const raw = localStorage.getItem('test-key')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.columns).toHaveLength(3)
    const nameCol = parsed.columns.find((c: { field: string }) => c.field === 'name')
    expect(nameCol).toMatchObject({ currentWidth: 300, pinned: 'start' })
    expect(parsed.sorts).toEqual([{ field: 'age', direction: 'desc', priority: 0 }])
  })

  it('save strips FilterCondition.id', () => {
    const { state, persistence } = setup()
    state.filterModel.value = {
      conditions: [
        {
          id: generateConditionId(),
          combinator: 'and',
          field: 'name',
          operator: 'contains',
          value: { value: 'al' },
        },
      ],
    }
    persistence.save('test-key')
    const parsed = JSON.parse(localStorage.getItem('test-key')!)
    expect(parsed.filters).toHaveLength(1)
    expect(parsed.filters[0]).not.toHaveProperty('id')
    expect(parsed.filters[0]).toMatchObject({
      field: 'name',
      operator: 'contains',
      value: { value: 'al' },
    })
  })

  it('restore applies saved widths, order, visibility, and pin to existing columns', () => {
    const { persistence } = setup()
    localStorage.setItem(
      'test-key',
      JSON.stringify({
        columns: [
          { field: 'name', currentWidth: 999, order: 2, visible: false, pinned: 'end' },
          { field: 'id', currentWidth: 50, order: 0, visible: true, pinned: null },
          { field: 'age', currentWidth: 80, order: 1, visible: true, pinned: null },
        ],
        sorts: [],
      }),
    )
    const ok = persistence.restore('test-key')
    expect(ok).toBe(true)
    const { state } = setup() // fresh state to verify restore targets same instance
    // We need to use the same persistence/state, so redo
    const state2 = useGridState<Row>()
    state2.initColumns(columns)
    const p2 = useStatePersistenceEngine<Row>(state2)
    p2.restore('test-key')
    const name = state2.columnStates.value.find((c) => c.field === 'name')!
    expect(name.currentWidth).toBe(999)
    expect(name.visible).toBe(false)
    expect(name.pinned).toBe('end')
    // silence unused
    void state
  })

  it('restore regenerates filter condition ids', () => {
    const { state, persistence } = setup()
    localStorage.setItem(
      'test-key',
      JSON.stringify({
        columns: [{ field: 'id', currentWidth: 100, order: 0, visible: true, pinned: null }],
        sorts: [],
        filters: [
          { combinator: 'and', field: 'name', operator: 'contains', value: { value: 'x' } },
        ],
      }),
    )
    persistence.restore('test-key')
    expect(state.filterModel.value.conditions).toHaveLength(1)
    expect(state.filterModel.value.conditions[0]?.id).toBeTruthy()
  })

  it('restore applies sort and updates columnStates sort/sortIndex', () => {
    const { state, persistence } = setup()
    localStorage.setItem(
      'test-key',
      JSON.stringify({
        columns: [
          { field: 'age', currentWidth: 80, order: 2, visible: true, pinned: null },
          { field: 'id', currentWidth: 100, order: 0, visible: true, pinned: null },
          { field: 'name', currentWidth: 200, order: 1, visible: true, pinned: null },
        ],
        sorts: [{ field: 'age', direction: 'desc', priority: 0 }],
      }),
    )
    persistence.restore('test-key')
    expect(state.activeSorts.value).toEqual([{ field: 'age', direction: 'desc', priority: 0 }])
    const age = state.columnStates.value.find((c) => c.field === 'age')!
    expect(age.sort).toBe('desc')
    expect(age.sortIndex).toBe(0)
    const name = state.columnStates.value.find((c) => c.field === 'name')!
    expect(name.sort).toBeNull()
  })

  it('restore returns false when no saved state exists', () => {
    const { persistence } = setup()
    expect(persistence.restore('missing-key')).toBe(false)
  })

  it('restore returns false when saved state has no columns', () => {
    const { persistence } = setup()
    localStorage.setItem('empty-key', JSON.stringify({ columns: [], sorts: [] }))
    expect(persistence.restore('empty-key')).toBe(false)
  })

  it('restore ignores fields no longer present in live columns', () => {
    const { state, persistence } = setup()
    localStorage.setItem(
      'test-key',
      JSON.stringify({
        columns: [
          { field: 'ghost', currentWidth: 999, order: 5, visible: true, pinned: null },
          { field: 'name', currentWidth: 250, order: 1, visible: true, pinned: null },
        ],
        sorts: [],
      }),
    )
    persistence.restore('test-key')
    expect(state.columnStates.value.find((c) => c.field === 'ghost')).toBeUndefined()
    const name = state.columnStates.value.find((c) => c.field === 'name')!
    expect(name.currentWidth).toBe(250)
  })

  it('clear removes persisted state', () => {
    const { persistence } = setup()
    localStorage.setItem('test-key', JSON.stringify({ columns: [], sorts: [] }))
    persistence.clear('test-key')
    expect(localStorage.getItem('test-key')).toBeNull()
  })
})
