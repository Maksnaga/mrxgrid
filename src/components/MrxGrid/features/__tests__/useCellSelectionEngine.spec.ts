import { describe, it, expect, beforeEach } from 'vitest'
import { useGridState } from '../../state/useGridState'
import { useCellSelectionEngine } from '../useCellSelectionEngine'
import type { ColumnDef } from '../../types'

interface Row {
  a: string
  b: string
  c: string
}

const columns: ColumnDef<Row>[] = [
  { field: 'a', headerName: 'A', editable: true, cellEditor: 'text' },
  { field: 'b', headerName: 'B', editable: true, cellEditor: 'text' },
  { field: 'c', headerName: 'C', editable: false, cellEditor: 'number' },
]

function setup() {
  const state = useGridState<Row>()
  state.initColumns(columns)
  state.sourceData.value = [
    { a: 'a0', b: 'b0', c: 'c0' },
    { a: '', b: 'b1', c: '' },
    { a: 'a2', b: '', c: 'c2' },
    { a: 'a3', b: 'b3', c: 'c3' },
  ]
  state.pageSize.value = 10
  state.visibleRowCount.value = 4
  const sel = useCellSelectionEngine<Row>(state)
  return { state, sel }
}

describe('useCellSelectionEngine / focus + range', () => {
  let state: ReturnType<typeof setup>['state']
  let sel: ReturnType<typeof setup>['sel']
  beforeEach(() => {
    ;({ state, sel } = setup())
  })

  it('focusCell sets focused + selectedCell, clears range/drag', () => {
    sel.focusCell(1, 2)
    expect(state.focusedCell.value).toEqual({ row: 1, col: 2 })
    expect(state.selectedCell.value).toEqual({ row: 1, col: 2 })
    expect(state.cellRange.value).toBeNull()
    expect(state.isDragging.value).toBe(false)
  })

  it('startRangeSelection / extendRange / endRangeSelection round-trip', () => {
    sel.startRangeSelection(0, 0)
    expect(state.isDragging.value).toBe(true)
    sel.extendRange(2, 1)
    expect(state.cellRange.value).toEqual({ start: { row: 0, col: 0 }, end: { row: 2, col: 1 } })
    sel.endRangeSelection()
    expect(state.isDragging.value).toBe(false)
  })

  it('isCellInRange uses normalized bounds', () => {
    sel.selectRange({ row: 2, col: 2 }, { row: 0, col: 0 })
    expect(sel.isCellInRange(1, 1)).toBe(true)
    expect(sel.isCellInRange(3, 1)).toBe(false)
  })

  it('getNormalizedRange swaps start/end when needed', () => {
    sel.selectRange({ row: 2, col: 2 }, { row: 0, col: 0 })
    expect(sel.getNormalizedRange()).toEqual({
      start: { row: 0, col: 0 },
      end: { row: 2, col: 2 },
    })
  })
})

describe('useCellSelectionEngine / navigation', () => {
  let state: ReturnType<typeof setup>['state']
  let sel: ReturnType<typeof setup>['sel']
  beforeEach(() => {
    ;({ state, sel } = setup())
  })

  it('moveBy clamps to page bounds and column count', () => {
    sel.focusCell(0, 0)
    sel.moveLeft()
    expect(state.focusedCell.value).toEqual({ row: 0, col: 0 })
    sel.moveRight()
    sel.moveRight()
    sel.moveRight() // clamps at col 2
    expect(state.focusedCell.value).toEqual({ row: 0, col: 2 })
  })

  it('jumpToEdge (down) from filled skips to last filled before empty gap', () => {
    sel.focusCell(0, 0)
    sel.jumpToEdge('down')
    // col 0 sequence: a0, '', a2, a3 → startFilled, step to row 1 empty → stop at row 0
    expect(state.focusedCell.value).toEqual({ row: 0, col: 0 })
  })

  it('jumpToEdge (down) from empty jumps to next filled', () => {
    sel.focusCell(1, 0) // row 1 col 0 is ''
    sel.jumpToEdge('down')
    expect(state.focusedCell.value).toEqual({ row: 2, col: 0 })
  })

  it('extendRangeBy anchors off focused/range end and clamps', () => {
    sel.focusCell(0, 0)
    sel.extendRangeBy(2, 1)
    expect(state.cellRange.value).toEqual({
      start: { row: 0, col: 0 },
      end: { row: 2, col: 1 },
    })
  })

  it('moveToRowEnd lands on the last non-empty column', () => {
    sel.focusCell(0, 0)
    sel.moveToRowEnd()
    expect(state.focusedCell.value).toEqual({ row: 0, col: 2 })
  })

  it('selectAll covers the whole visible grid', () => {
    sel.selectAll()
    expect(state.cellRange.value).toEqual({
      start: { row: 0, col: 0 },
      end: { row: 3, col: 2 },
    })
  })
})

describe('useCellSelectionEngine / fill handle', () => {
  let state: ReturnType<typeof setup>['state']
  let sel: ReturnType<typeof setup>['sel']
  beforeEach(() => {
    ;({ state, sel } = setup())
  })

  it('extendFill locks to dominant axis (vertical)', () => {
    sel.startFill(0, 0)
    sel.extendFill(2, 1) // dRow=2, dCol=1 → vertical
    expect(state.fillTarget.value).toEqual({ row: 2, col: 0 })
  })

  it('extendFill locks to dominant axis (horizontal)', () => {
    sel.startFill(0, 0)
    sel.extendFill(1, 3) // dRow=1, dCol=3 → horizontal
    expect(state.fillTarget.value).toEqual({ row: 0, col: 3 })
  })

  it('isCellInFillRange skips anchor + respects editable + type compat', () => {
    sel.startFill(0, 0) // col 0 = text editable
    sel.extendFill(0, 2) // horizontal to col 2 = number non-editable
    expect(sel.isCellInFillRange(0, 0)).toBe(false) // skip anchor
    expect(sel.isCellInFillRange(0, 1)).toBe(true) // col 1 text editable, compat
    expect(sel.isCellInFillRange(0, 2)).toBe(false) // col 2 non-editable
  })

  it('isCellInFillRejectRange flags non-editable or type-incompatible columns', () => {
    sel.startFill(0, 0)
    sel.extendFill(0, 2)
    expect(sel.isCellInFillRejectRange(0, 2)).toBe(true)
  })

  it('endFill returns anchor/target pair and clears state', () => {
    sel.startFill(1, 1)
    sel.extendFill(3, 1)
    const result = sel.endFill()
    expect(result).toEqual({
      anchor: { row: 1, col: 1 },
      target: { row: 3, col: 1 },
    })
    expect(state.isFilling.value).toBe(false)
    expect(state.fillAnchor.value).toBeNull()
  })
})
