import { describe, it, expect } from 'vitest'
import { useGridState } from '../../state/useGridState'
import { useSortEngine } from '../useSortEngine'
import type { ColumnDef } from '../../types'

interface Row {
  id: number
  name: string
  age: number | null
}

const columns: ColumnDef<Row>[] = [
  { field: 'id', headerName: 'ID' },
  { field: 'name', headerName: 'Name' },
  { field: 'age', headerName: 'Age' },
]

function setup(rows: Row[] = seed()) {
  const state = useGridState<Row>()
  state.initColumns(columns)
  state.sourceData.value = rows
  const sort = useSortEngine<Row>(state)
  return { state, sort }
}

function seed(): Row[] {
  return [
    { id: 1, name: 'Carol', age: 25 },
    { id: 2, name: 'Alice', age: 30 },
    { id: 3, name: 'Bob', age: null },
  ]
}

describe('useSortEngine', () => {
  it('toggleSort cycles asc → desc → none (single)', () => {
    const { state, sort } = setup()
    sort.toggleSort('name')
    expect(state.activeSorts.value).toEqual([{ field: 'name', direction: 'asc', priority: 0 }])
    sort.toggleSort('name')
    expect(state.activeSorts.value[0]?.direction).toBe('desc')
    sort.toggleSort('name')
    expect(state.activeSorts.value).toEqual([])
  })

  it('toggleSort replaces prior sort when not multi', () => {
    const { state, sort } = setup()
    sort.toggleSort('name')
    sort.toggleSort('age')
    expect(state.activeSorts.value).toEqual([{ field: 'age', direction: 'asc', priority: 0 }])
  })

  it('toggleSort multi appends new fields', () => {
    const { state, sort } = setup()
    sort.toggleSort('name', true)
    sort.toggleSort('age', true)
    expect(state.activeSorts.value.map((s) => s.field)).toEqual(['name', 'age'])
  })

  it('toggleSort multi removes field when cycled off', () => {
    const { state, sort } = setup()
    sort.toggleSort('name', true)
    sort.toggleSort('age', true)
    sort.toggleSort('name', true) // asc → desc
    sort.toggleSort('name', true) // desc → off, should remove
    expect(state.activeSorts.value.map((s) => s.field)).toEqual(['age'])
  })

  it('syncs columnStates sort + sortIndex', () => {
    const { state, sort } = setup()
    sort.toggleSort('name')
    const name = state.columnStates.value.find((c) => c.field === 'name')!
    expect(name.sort).toBe('asc')
    expect(name.sortIndex).toBe(0)
    sort.clearSort()
    expect(state.columnStates.value.find((c) => c.field === 'name')?.sort).toBeNull()
  })

  it('sortData sorts strings alphabetically', () => {
    const { state, sort } = setup()
    sort.toggleSort('name')
    const sorted = sort.sortData(state.sourceData.value)
    expect(sorted.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Carol'])
  })

  it('sortData sorts numbers numerically', () => {
    const { state, sort } = setup()
    sort.setSort('id', 'desc')
    const sorted = sort.sortData(state.sourceData.value)
    expect(sorted.map((r) => r.id)).toEqual([3, 2, 1])
  })

  it('sortData treats null as smallest (asc)', () => {
    const { state, sort } = setup()
    sort.setSort('age', 'asc')
    const sorted = sort.sortData(state.sourceData.value)
    expect(sorted.map((r) => r.age)).toEqual([null, 25, 30])
  })

  it('getSortDirection / getSortIndex return current state', () => {
    const { sort } = setup()
    sort.toggleSort('name', true)
    sort.toggleSort('age', true)
    expect(sort.getSortDirection('age')).toBe('asc')
    expect(sort.getSortIndex('name')).toBe(1)
    expect(sort.getSortIndex('missing')).toBeNull()
  })

  it('sortData uses sortComparator when provided', () => {
    const state = useGridState<Row>()
    state.initColumns([
      { field: 'id', headerName: 'ID' },
      {
        field: 'name',
        headerName: 'Name',
        sortComparator: (a, b) => a.name.length - b.name.length,
      },
      { field: 'age', headerName: 'Age' },
    ])
    state.sourceData.value = seed()
    const sort = useSortEngine<Row>(state)
    sort.setSort('name', 'asc')
    const sorted = sort.sortData(state.sourceData.value)
    // Bob (3) < Carol/Alice (5) — stable tie on length 5 keeps source order
    expect(sorted[0]?.name).toBe('Bob')
  })
})
