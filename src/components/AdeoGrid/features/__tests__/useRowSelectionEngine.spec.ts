import { describe, it, expect } from 'vitest'
import { computed } from 'vue'
import { useGridState } from '../../state/useGridState'
import { useRowSelectionEngine } from '../useRowSelectionEngine'
import type { ColumnDef } from '../../types'

interface Row {
  id: number
  name: string
}

const columns: ColumnDef<Row>[] = [
  { field: 'id', headerName: 'ID' },
  { field: 'name', headerName: 'Name' },
]

function setup(pageSize = 3) {
  const state = useGridState<Row>()
  state.initColumns(columns)
  state.sourceData.value = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Carol' },
    { id: 4, name: 'Dave' },
    { id: 5, name: 'Eve' },
  ]
  state.pageSize.value = pageSize
  const paginated = computed(() =>
    state.sourceData.value.slice(
      state.pageIndex.value * state.pageSize.value,
      (state.pageIndex.value + 1) * state.pageSize.value,
    ),
  )
  const sel = useRowSelectionEngine<Row>(state, paginated)
  return { state, sel, paginated }
}

describe('useRowSelectionEngine', () => {
  it('toggleRow adds/removes from selectedRowIds', () => {
    const { state, sel, paginated } = setup()
    sel.toggleRow(paginated.value[0]!)
    expect(state.selectedRowIds.value.has(1)).toBe(true)
    expect(state.selectAllMode.value).toBe('page')
    sel.toggleRow(paginated.value[0]!)
    expect(state.selectedRowIds.value.has(1)).toBe(false)
    expect(state.selectAllMode.value).toBe('none')
  })

  it('isRowSelected reflects page selection', () => {
    const { sel, paginated } = setup()
    sel.toggleRow(paginated.value[1]!)
    expect(sel.isRowSelected(paginated.value[1]!)).toBe(true)
    expect(sel.isRowSelected(paginated.value[0]!)).toBe(false)
  })

  it('selectAll mode inverts logic: isRowSelected true except excluded', () => {
    const { state, sel, paginated } = setup()
    sel.selectAll()
    expect(state.selectAllMode.value).toBe('all')
    expect(sel.isRowSelected(paginated.value[0]!)).toBe(true)
    sel.toggleRow(paginated.value[0]!)
    expect(state.excludedRowIds.value.has(1)).toBe(true)
    expect(sel.isRowSelected(paginated.value[0]!)).toBe(false)
  })

  it('selectAllPage checks all page rows (page mode)', () => {
    const { sel, paginated } = setup()
    sel.selectAllPage()
    expect(sel.isAllSelected.value).toBe(true)
    expect(sel.pageSelectedCount.value).toBe(paginated.value.length)
  })

  it('deselectAll wipes selection + mode', () => {
    const { state, sel } = setup()
    sel.selectAll()
    sel.deselectAll()
    expect(state.selectAllMode.value).toBe('none')
    expect(state.selectedRowIds.value.size).toBe(0)
    expect(state.excludedRowIds.value.size).toBe(0)
  })

  it('toggleSelectAllPage: selects when none, deselects when all', () => {
    const { sel } = setup()
    sel.toggleSelectAllPage()
    expect(sel.isAllSelected.value).toBe(true)
    sel.toggleSelectAllPage()
    expect(sel.isAllSelected.value).toBe(false)
  })

  it('isIndeterminate: only some page rows selected', () => {
    const { sel, paginated } = setup()
    sel.toggleRow(paginated.value[0]!)
    expect(sel.isIndeterminate.value).toBe(true)
  })

  it('selectRowRangeToRow picks contiguous page range via anchor', () => {
    const { state, sel, paginated } = setup()
    sel.toggleRow(paginated.value[0]!) // anchor set manually via range
    sel.lastToggledRow.value = paginated.value[0]!
    sel.selectRowRangeToRow(paginated.value[2]!)
    expect(state.selectedRowIds.value.has(1)).toBe(true)
    expect(state.selectedRowIds.value.has(2)).toBe(true)
    expect(state.selectedRowIds.value.has(3)).toBe(true)
  })

  it('count in selectAll mode = total - excluded', () => {
    const { sel, paginated } = setup()
    sel.selectAll()
    sel.toggleRow(paginated.value[0]!) // exclude 1
    // total 5 - 1 excluded
    expect(sel.count.value).toBe(4)
  })

  it('getSelectionEvent returns ids/rows/mode', () => {
    const { sel, paginated } = setup()
    sel.toggleRow(paginated.value[0]!)
    sel.toggleRow(paginated.value[1]!)
    const event = sel.getSelectionEvent()
    expect(event.mode).toBe('page')
    expect(event.selectedIds.sort()).toEqual([1, 2])
    expect(event.count).toBe(2)
  })
})
