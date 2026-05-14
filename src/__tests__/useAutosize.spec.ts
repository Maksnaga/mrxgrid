import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useAutosize } from '@/composables/useAutosize'
import { useGridState, type GridState } from '@/components/MrxGrid/state/useGridState'
import type { ColumnDef, RowData } from '@/components/MrxGrid/types'

// jsdom's canvas returns 0 for measureText — we shim it so the layout-free
// canvas measurement used by `useAutosize` behaves deterministically. Width
// is proportional to string length so assertions don't depend on font
// metrics. The `+ SAFETY_PAD` baked into expectations matches the prod
// formula (canvas vs DOM divergence buffer).
const PX_PER_CHAR = 10
const SAFETY_PAD = 4
const HEADER_AFFORDANCE = 52
const FLOOR = 50

// jsdom ships without a real canvas implementation, so `CanvasRenderingContext2D`
// is undefined and `getContext('2d')` returns null. We stub the canvas
// element's `getContext` to return a minimal context shape (writable `font`
// + char-length-based `measureText`) just for the autosize composable.
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext | null = null

beforeEach(() => {
  const proto = HTMLCanvasElement.prototype
  originalGetContext = proto.getContext
  proto.getContext = function getContextShim(this: HTMLCanvasElement, contextId: string) {
    if (contextId !== '2d') return null
    return {
      font: '',
      measureText(text: string) {
        return { width: (text ?? '').length * PX_PER_CHAR } as TextMetrics
      },
    } as unknown as CanvasRenderingContext2D
  } as typeof proto.getContext
})

afterEach(() => {
  if (originalGetContext) {
    HTMLCanvasElement.prototype.getContext = originalGetContext
  }
  document.body.innerHTML = ''
})

function makeFixture(columns: ColumnDef[], rows: RowData[]) {
  const gridState: GridState<RowData> = useGridState<RowData>()
  gridState.initColumns(columns)

  const wrapper = document.createElement('div')
  document.body.appendChild(wrapper)
  const wrapperRef = ref<HTMLElement | null>(wrapper)
  const rowsRef = ref<RowData[]>(rows)

  const { autosizeColumn, autosizeAllColumns } = useAutosize({
    gridState,
    wrapperRef,
    rows: rowsRef,
  })

  return { gridState, wrapper, autosizeColumn, autosizeAllColumns }
}

function widthOf(state: GridState<RowData>, field: string): number | undefined {
  return state.columnStates.value.find((c) => c.field === field)?.currentWidth
}

describe('useAutosize', () => {
  it('writes max(header + affordance, longest cell) into currentWidth', () => {
    const cols: ColumnDef[] = [
      { field: 'name', headerName: 'Name' }, // header = 4 chars
    ]
    const rows: RowData[] = [
      { name: 'Alice' }, // 5
      { name: 'Bob' }, // 3
      { name: 'Christopher' }, // 11 — longest
    ]
    const { gridState, autosizeColumn } = makeFixture(cols, rows)

    autosizeColumn('name')

    // header width = 4 * 10 + 4 (pad) + 52 = 96 ; longest cell = 11 * 10 + 4 = 114 → max = 114
    expect(widthOf(gridState, 'name')).toBe(110 + SAFETY_PAD)
  })

  it('falls back to header width when cells are shorter', () => {
    const cols: ColumnDef[] = [
      { field: 'status', headerName: 'Subscription Status' }, // 19 chars
    ]
    const rows: RowData[] = [{ status: 'OK' }, { status: 'KO' }]
    const { gridState, autosizeColumn } = makeFixture(cols, rows)

    autosizeColumn('status')

    // header = 19 * 10 + 4 (pad) + 52 = 246, cell = 2 * 10 + 4 = 24 → 246
    expect(widthOf(gridState, 'status')).toBe(242 + SAFETY_PAD)
  })

  it('clamps below the 50px floor', () => {
    const cols: ColumnDef[] = [{ field: 'x', headerName: '' }]
    const rows: RowData[] = [{ x: '' }]
    const { gridState, autosizeColumn } = makeFixture(cols, rows)

    autosizeColumn('x')

    // header empty → 0 + 4 (pad) + 52 = 56, FLOOR (50) — 56 > 50 → 56
    expect(widthOf(gridState, 'x')).toBe(Math.max(FLOOR, HEADER_AFFORDANCE + SAFETY_PAD))
  })

  it('respects column.minWidth and column.maxWidth', () => {
    const cols: ColumnDef[] = [
      { field: 'a', headerName: 'A', minWidth: '200px' },
      { field: 'b', headerName: 'B', maxWidth: '80px' },
    ]
    const rows: RowData[] = [{ a: 'x', b: 'a-very-long-value' }]
    const { gridState, autosizeColumn } = makeFixture(cols, rows)

    autosizeColumn('a')
    autosizeColumn('b')

    // a: measured ~ 1*10 vs header 1*10+52=62 → 62, floored by minWidth 200
    expect(widthOf(gridState, 'a')).toBe(200)
    // b: cell 16*10 = 160, header 1*10+52=62 → 160, capped at maxWidth 80
    expect(widthOf(gridState, 'b')).toBe(80)
  })

  it('uses valueFormatter for the displayed text', () => {
    const cols: ColumnDef[] = [
      {
        field: 'price',
        headerName: 'P',
        valueFormatter: (v) => `$ ${v} USD`,
      },
    ]
    const rows: RowData[] = [{ price: 12 }] // formatted = "$ 12 USD" → 8 chars
    const { gridState, autosizeColumn } = makeFixture(cols, rows)

    autosizeColumn('price')

    // header = 1 * 10 + 4 (pad) + 52 = 66 ; cell = 8 * 10 + 4 = 84 → 84
    expect(widthOf(gridState, 'price')).toBe(80 + SAFETY_PAD)
  })

  it('autosizeAllColumns touches every visible column and skips hidden ones', () => {
    const cols: ColumnDef[] = [
      { field: 'a', headerName: 'AA' },
      { field: 'b', headerName: 'BB', visible: false },
      { field: 'c', headerName: 'CC' },
    ]
    const rows: RowData[] = [
      { a: 'short', b: 'never-measured-because-hidden', c: 'medium-cell' },
    ]
    const { gridState, autosizeAllColumns } = makeFixture(cols, rows)

    const before = {
      a: widthOf(gridState, 'a'),
      b: widthOf(gridState, 'b'),
      c: widthOf(gridState, 'c'),
    }

    autosizeAllColumns()

    expect(widthOf(gridState, 'a')).not.toBe(before.a)
    expect(widthOf(gridState, 'c')).not.toBe(before.c)
    // hidden column is left untouched
    expect(widthOf(gridState, 'b')).toBe(before.b)
  })

  it('skips group rows when measuring', () => {
    const cols: ColumnDef[] = [{ field: 'name', headerName: 'N' }]
    const rows: RowData[] = [
      // group row should be ignored even if its `name` field is huge
      {
        __mrxType: 'group',
        name: 'this-is-a-very-very-very-long-group-header',
      },
      { name: 'Alice' }, // 5 chars
    ]
    const { gridState, autosizeColumn } = makeFixture(cols, rows)

    autosizeColumn('name')

    // header = 1*10 + 4 (pad) + 52 = 66, cell = 5*10 + 4 = 54 → 66. If the
    // group row leaked through, value would be 42 * 10 + 4 = 424.
    expect(widthOf(gridState, 'name')).toBe(62 + SAFETY_PAD)
  })
})
