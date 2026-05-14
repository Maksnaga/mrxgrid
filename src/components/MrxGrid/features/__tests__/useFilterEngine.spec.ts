import { describe, it, expect } from 'vitest'
import { useGridState } from '../../state/useGridState'
import { useFilterEngine } from '../useFilterEngine'
import { generateConditionId, type FilterCondition } from '../../models/filter.model'
import type { ColumnDef } from '../../types'

interface Row {
  id: number
  name: string
  age: number | null
  active: boolean
  status: string
}

const columns: ColumnDef<Row>[] = [
  { field: 'id', headerName: 'ID', filterable: true, cellEditor: 'number' },
  { field: 'name', headerName: 'Name', filterable: true },
  { field: 'age', headerName: 'Age', filterable: true, cellEditor: 'number' },
  { field: 'active', headerName: 'Active', filterable: true, cellEditor: 'checkbox' },
  {
    field: 'status',
    headerName: 'Status',
    filterable: true,
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
  state.pageIndex.value = 2
  const filter = useFilterEngine<Row>(state)
  return { state, filter }
}

function seed(): Row[] {
  return [
    { id: 1, name: 'Alice', age: 30, active: true, status: 'open' },
    { id: 2, name: 'Bob', age: 25, active: false, status: 'closed' },
    { id: 3, name: 'Carol', age: null, active: true, status: 'open' },
    { id: 4, name: 'Dave', age: 40, active: false, status: 'open' },
  ]
}

function cond(overrides: Partial<FilterCondition>): FilterCondition {
  return {
    id: generateConditionId(),
    combinator: 'and',
    field: 'name',
    operator: 'contains',
    value: {},
    ...overrides,
  }
}

describe('useFilterEngine / mutations', () => {
  it('addCondition appends and resets pageIndex', () => {
    const { state, filter } = setup()
    filter.addCondition(cond({ field: 'name', value: { value: 'a' } }))
    expect(filter.conditions.value).toHaveLength(1)
    expect(state.pageIndex.value).toBe(0)
    expect(filter.hasActiveFilters.value).toBe(true)
  })

  it('updateCondition merges value object', () => {
    const { filter } = setup()
    const c = cond({ field: 'age', operator: 'between', value: { value: 20 } })
    filter.addCondition(c)
    filter.updateCondition(c.id, { value: { valueTo: 30 } })
    expect(filter.conditions.value[0]?.value).toEqual({ value: 20, valueTo: 30 })
  })

  it('removeCondition drops by id', () => {
    const { filter } = setup()
    const c = cond({ field: 'name' })
    filter.addCondition(c)
    filter.removeCondition(c.id)
    expect(filter.conditions.value).toHaveLength(0)
  })

  it('clearAll wipes conditions (and is a noop when already empty)', () => {
    const { filter } = setup()
    filter.clearAll()
    expect(filter.lastEvent.value).toBeNull() // noop when empty
    filter.addCondition(cond({ field: 'name' }))
    filter.clearAll()
    expect(filter.conditions.value).toHaveLength(0)
    expect(filter.lastEvent.value?.reason).toBe('clear')
  })

  it('reorderConditions swaps entries', () => {
    const { filter } = setup()
    const a = cond({ field: 'name', value: { value: 'a' } })
    const b = cond({ field: 'age', operator: 'gt', value: { value: 20 } })
    filter.addCondition(a)
    filter.addCondition(b)
    filter.reorderConditions(0, 1)
    expect(filter.conditions.value[0]?.field).toBe('age')
  })

  it('removeByField drops all matching conditions', () => {
    const { filter } = setup()
    filter.addCondition(cond({ field: 'name', value: { value: 'a' } }))
    filter.addCondition(cond({ field: 'name', value: { value: 'b' } }))
    filter.addCondition(cond({ field: 'age', operator: 'gt', value: { value: 20 } }))
    filter.removeByField('name')
    expect(filter.conditions.value.map((c) => c.field)).toEqual(['age'])
  })
})

describe('useFilterEngine / filterData', () => {
  it('returns data unchanged when no conditions', () => {
    const { state, filter } = setup()
    expect(filter.filterData(state.sourceData.value)).toHaveLength(4)
  })

  it('drops incomplete conditions (empty value)', () => {
    const { state, filter } = setup()
    filter.addCondition(cond({ field: 'name', operator: 'contains', value: {} }))
    expect(filter.filterData(state.sourceData.value)).toHaveLength(4)
  })

  it('text contains (case-insensitive)', () => {
    const { state, filter } = setup()
    filter.addCondition(cond({ field: 'name', operator: 'contains', value: { value: 'a' } }))
    const out = filter.filterData(state.sourceData.value)
    expect(out.map((r) => r.name).sort()).toEqual(['Alice', 'Carol', 'Dave'])
  })

  it('number gt', () => {
    const { state, filter } = setup()
    filter.addCondition(
      cond({ field: 'age', operator: 'gt', value: { value: 28 } }),
    )
    const out = filter.filterData(state.sourceData.value)
    expect(out.map((r) => r.name)).toEqual(['Alice', 'Dave'])
  })

  it('number between inclusive', () => {
    const { state, filter } = setup()
    filter.addCondition(
      cond({ field: 'age', operator: 'between', value: { value: 25, valueTo: 30 } }),
    )
    const out = filter.filterData(state.sourceData.value)
    expect(out.map((r) => r.name).sort()).toEqual(['Alice', 'Bob'])
  })

  it('blank handles null and empty string', () => {
    const { state, filter } = setup()
    filter.addCondition(cond({ field: 'age', operator: 'blank', value: {} }))
    const out = filter.filterData(state.sourceData.value)
    expect(out.map((r) => r.name)).toEqual(['Carol'])
  })

  it('set in filters by value array', () => {
    const { state, filter } = setup()
    filter.addCondition(
      cond({ field: 'status', operator: 'in', value: { value: ['closed'] } }),
    )
    const out = filter.filterData(state.sourceData.value)
    expect(out.map((r) => r.name)).toEqual(['Bob'])
  })

  it('boolean equals normalizes truthy representations', () => {
    const { state, filter } = setup()
    filter.addCondition(
      cond({ field: 'active', operator: 'equals', value: { value: 'true' } }),
    )
    const out = filter.filterData(state.sourceData.value)
    expect(out.map((r) => r.name).sort()).toEqual(['Alice', 'Carol'])
  })

  it('multi-condition AND', () => {
    const { state, filter } = setup()
    filter.addCondition(
      cond({ field: 'name', operator: 'contains', value: { value: 'a' } }),
    )
    filter.addCondition(
      cond({
        field: 'age',
        operator: 'gt',
        value: { value: 20 },
        combinator: 'and',
      }),
    )
    const out = filter.filterData(state.sourceData.value)
    expect(out.map((r) => r.name).sort()).toEqual(['Alice', 'Dave'])
  })

  it('multi-condition OR', () => {
    const { state, filter } = setup()
    filter.addCondition(
      cond({ field: 'name', operator: 'equals', value: { value: 'Alice' } }),
    )
    filter.addCondition(
      cond({
        field: 'name',
        operator: 'equals',
        value: { value: 'Bob' },
        combinator: 'or',
      }),
    )
    const out = filter.filterData(state.sourceData.value)
    expect(out.map((r) => r.name).sort()).toEqual(['Alice', 'Bob'])
  })

  it('server mode bypasses filtering', () => {
    const { state, filter } = setup()
    state.mode.value = 'server'
    filter.addCondition(cond({ field: 'name', value: { value: 'a' } }))
    expect(filter.filterData(state.sourceData.value)).toHaveLength(4)
  })

  it('quickFilters apply independently and AND with the formal model', () => {
    // Quick filter (filter row) on `name` narrows to those containing 'a':
    // Alice, Carol, Dave. The formal model adds `age > 28` → Alice (30)
    // and Dave (40). Intersection = Alice, Dave.
    const { state, filter } = setup()
    state.quickFilters.value = { name: 'a' }
    filter.addCondition(cond({ field: 'age', operator: 'gt', value: { value: 28 } }))
    const out = filter.filterData(state.sourceData.value)
    expect(out.map((r) => r.name).sort()).toEqual(['Alice', 'Dave'])
  })

  it('clearing the formal model leaves quickFilters in place', () => {
    const { state, filter } = setup()
    state.quickFilters.value = { name: 'a' }
    filter.addCondition(cond({ field: 'age', operator: 'gt', value: { value: 28 } }))
    filter.clearAll()
    // Only quick filter remains → still narrows to a-rows.
    const out = filter.filterData(state.sourceData.value)
    expect(out.map((r) => r.name).sort()).toEqual(['Alice', 'Carol', 'Dave'])
  })
})

describe('useFilterEngine / metadata helpers', () => {
  it('getFilterType infers from cellEditor', () => {
    const { filter } = setup()
    expect(filter.getFilterType('age')).toBe('number')
    expect(filter.getFilterType('active')).toBe('boolean')
    expect(filter.getFilterType('status')).toBe('set')
    expect(filter.getFilterType('name')).toBe('text')
  })

  it('describeFilterableColumns skips non-filterable defs', () => {
    const state = useGridState<Row>()
    state.initColumns([
      { field: 'id', headerName: 'ID' },
      { field: 'name', headerName: 'Name', filterable: true },
    ])
    const filter = useFilterEngine<Row>(state)
    const cols = filter.describeFilterableColumns()
    expect(cols.map((c) => c.field)).toEqual(['name'])
  })

  it('makeCondition uses the column default operator', () => {
    const { filter } = setup()
    const c = filter.makeCondition('age', true)
    expect(c.operator).toBe('equals')
    expect(c.field).toBe('age')
  })

  it('toLabel renders valueless + value + range operators', () => {
    const { filter } = setup()
    expect(
      filter.toLabel(cond({ field: 'name', operator: 'blank', value: {} })),
    ).toBe('Name is blank')
    expect(
      filter.toLabel(
        cond({ field: 'name', operator: 'contains', value: { value: 'a' } }),
      ),
    ).toBe('Name contains a')
    expect(
      filter.toLabel(
        cond({ field: 'age', operator: 'between', value: { value: 10, valueTo: 20 } }),
      ),
    ).toBe('Age between 10 – 20')
  })
})
