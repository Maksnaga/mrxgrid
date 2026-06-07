import { describe, it, expect } from 'vitest'
import { useGridState } from '../../state/useGridState'
import { useGroupEngine } from '../useGroupEngine'
import type { ColumnDef } from '../../types'
import type { GroupRow } from '../../models/display-row.model'

interface Row {
  id: number
  team: string
  role: string
  name: string
}

const columns: ColumnDef<Row>[] = [
  { field: 'id', headerName: 'ID' },
  { field: 'team', headerName: 'Team' },
  { field: 'role', headerName: 'Role' },
  { field: 'name', headerName: 'Name' },
]

function setup() {
  const state = useGridState<Row>()
  state.initColumns(columns)
  state.sourceData.value = [
    { id: 1, team: 'Alpha', role: 'Dev', name: 'Alice' },
    { id: 2, team: 'Alpha', role: 'QA', name: 'Bob' },
    { id: 3, team: 'Beta', role: 'Dev', name: 'Carol' },
    { id: 4, team: 'Beta', role: 'Dev', name: 'Dave' },
  ]
  const group = useGroupEngine<Row>(state)
  return { state, group }
}

describe('useGroupEngine / mutations', () => {
  it('addGroup ignores duplicates and resets pageIndex', () => {
    const { state, group } = setup()
    state.pageIndex.value = 3
    group.addGroup('team')
    group.addGroup('team')
    expect(state.groupColumns.value).toEqual([{ field: 'team', sortDirection: 'asc' }])
    expect(state.pageIndex.value).toBe(0)
  })

  it('removeGroup filters out the field', () => {
    const { state, group } = setup()
    group.addGroup('team')
    group.addGroup('role')
    group.removeGroup('team')
    expect(state.groupColumns.value.map((g) => g.field)).toEqual(['role'])
  })

  it('clearGroups empties groups and expanded set', () => {
    const { state, group } = setup()
    group.addGroup('team')
    state.expandedGroups.value = new Set(['team:Alpha'])
    group.clearGroups()
    expect(state.groupColumns.value).toEqual([])
    expect(state.expandedGroups.value.size).toBe(0)
  })

  it('toggleGroupExpand flips membership', () => {
    const { state, group } = setup()
    group.toggleGroupExpand('team:Alpha')
    expect(state.expandedGroups.value.has('team:Alpha')).toBe(true)
    group.toggleGroupExpand('team:Alpha')
    expect(state.expandedGroups.value.has('team:Alpha')).toBe(false)
  })
})

describe('useGroupEngine / groupData', () => {
  it('returns [] when no group columns are active', () => {
    const { state, group } = setup()
    expect(group.groupData(state.sourceData.value)).toEqual([])
  })

  it('emits collapsed group headers by default', () => {
    const { state, group } = setup()
    group.addGroup('team')
    const rows = group.groupData(state.sourceData.value)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.type === 'group')).toBe(true)
    expect((rows[0] as { type: 'group'; group: GroupRow<Row> }).group.groupKey).toBe('team:Alpha')
  })

  it('expanded group emits data rows after the header', () => {
    const { state, group } = setup()
    group.addGroup('team')
    state.expandedGroups.value = new Set(['team:Alpha'])
    const rows = group.groupData(state.sourceData.value)
    // Alpha (group) → 2 data rows → Beta (group, collapsed)
    expect(rows).toHaveLength(4)
    expect(rows[0]?.type).toBe('group')
    expect(rows[1]?.type).toBe('data')
    expect(rows[2]?.type).toBe('data')
    expect(rows[3]?.type).toBe('group')
  })

  it('sorts group values alphabetically (asc) by default', () => {
    const { state, group } = setup()
    group.addGroup('team')
    const rows = group.groupData(state.sourceData.value)
    expect((rows[0] as { group: GroupRow<Row> }).group.value).toBe('Alpha')
    expect((rows[1] as { group: GroupRow<Row> }).group.value).toBe('Beta')
  })

  it('respects desc sort direction', () => {
    const { state, group } = setup()
    state.groupColumns.value = [{ field: 'team', sortDirection: 'desc' }]
    const rows = group.groupData(state.sourceData.value)
    expect((rows[0] as { group: GroupRow<Row> }).group.value).toBe('Beta')
  })

  it('nested grouping builds a hierarchy', () => {
    const { state, group } = setup()
    state.groupColumns.value = [
      { field: 'team', sortDirection: 'asc' },
      { field: 'role', sortDirection: 'asc' },
    ]
    state.expandedGroups.value = new Set(['team:Alpha', 'team:Alpha|role:Dev'])
    const rows = group.groupData(state.sourceData.value)
    // Alpha open → Dev open (1 data) + QA collapsed ; Beta collapsed
    //   row 0: team:Alpha
    //   row 1: team:Alpha|role:Dev
    //   row 2: data Alice (depth 2)
    //   row 3: team:Alpha|role:QA (collapsed)
    //   row 4: team:Beta
    expect(rows).toHaveLength(5)
    expect((rows[1] as { group: GroupRow<Row> }).group.groupKey).toBe('team:Alpha|role:Dev')
    expect(rows[2]?.type).toBe('data')
  })
})
