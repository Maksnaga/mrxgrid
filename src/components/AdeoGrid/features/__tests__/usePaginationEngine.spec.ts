import { describe, it, expect } from 'vitest'
import { useGridState } from '../../state/useGridState'
import { usePaginationEngine } from '../usePaginationEngine'
import type { ColumnDef } from '../../types'

interface Row {
  id: number
}

const columns: ColumnDef<Row>[] = [{ field: 'id', headerName: 'ID' }]

function setup(total = 25, size = 10) {
  const state = useGridState<Row>()
  state.initColumns(columns)
  state.sourceData.value = Array.from({ length: total }, (_, i) => ({ id: i + 1 }))
  state.pageSize.value = size
  const pagination = usePaginationEngine<Row>(state)
  return { state, pagination }
}

describe('usePaginationEngine', () => {
  it('computes totalPages from sourceData.length in client mode', () => {
    const { pagination } = setup(25, 10)
    expect(pagination.totalPages.value).toBe(3)
  })

  it('computes totalPages from totalItems in server mode', () => {
    const { state, pagination } = setup(25, 10)
    state.mode.value = 'server'
    state.totalItems.value = 48
    expect(pagination.totalPages.value).toBe(5)
  })

  it('startItem / endItem are 1-based and clamped on last page', () => {
    const { state, pagination } = setup(25, 10)
    expect(pagination.startItem.value).toBe(1)
    expect(pagination.endItem.value).toBe(10)
    state.pageIndex.value = 2
    expect(pagination.startItem.value).toBe(21)
    expect(pagination.endItem.value).toBe(25) // not 30
  })

  it('startItem is 0 when no data', () => {
    const { pagination } = setup(0, 10)
    expect(pagination.startItem.value).toBe(0)
  })

  it('goToPage clamps to valid range', () => {
    const { state, pagination } = setup(25, 10)
    pagination.goToPage(-1)
    expect(state.pageIndex.value).toBe(0)
    pagination.goToPage(99)
    expect(state.pageIndex.value).toBe(0)
    pagination.goToPage(2)
    expect(state.pageIndex.value).toBe(2)
  })

  it('nextPage / previousPage respect bounds', () => {
    const { state, pagination } = setup(25, 10)
    pagination.nextPage()
    expect(state.pageIndex.value).toBe(1)
    pagination.nextPage()
    expect(state.pageIndex.value).toBe(2)
    pagination.nextPage() // last page — no-op
    expect(state.pageIndex.value).toBe(2)
    pagination.previousPage()
    expect(state.pageIndex.value).toBe(1)
  })

  it('setPageSize resets to page 0', () => {
    const { state, pagination } = setup(25, 10)
    state.pageIndex.value = 2
    pagination.setPageSize(5)
    expect(state.pageSize.value).toBe(5)
    expect(state.pageIndex.value).toBe(0)
  })

  it('isFirstPage / isLastPage track correctly', () => {
    const { state, pagination } = setup(25, 10)
    expect(pagination.isFirstPage.value).toBe(true)
    expect(pagination.isLastPage.value).toBe(false)
    state.pageIndex.value = 2
    expect(pagination.isLastPage.value).toBe(true)
  })
})
