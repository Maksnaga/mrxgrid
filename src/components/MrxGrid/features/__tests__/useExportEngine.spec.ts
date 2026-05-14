import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useGridState } from '../../state/useGridState'
import { useExportEngine } from '../useExportEngine'
import type { ColumnDef } from '../../types'

interface Row {
  id: number
  name: string
  price: number
  note: string
}

const columns: ColumnDef<Row>[] = [
  { field: 'id', headerName: 'ID' },
  { field: 'name', headerName: 'Name' },
  {
    field: 'price',
    headerName: 'Price',
    valueFormatter: (v) => `€${v}`,
  },
  { field: 'note', headerName: 'Note' },
]

function setup(rows: Row[] = seed()) {
  const state = useGridState<Row>()
  state.initColumns(columns)
  state.sourceData.value = rows
  const exportEngine = useExportEngine<Row>(state)
  return { state, exportEngine }
}

function seed(): Row[] {
  return [
    { id: 1, name: 'Alice', price: 10, note: 'ok' },
    { id: 2, name: 'Bob, Jr.', price: 20, note: 'has "quotes"' },
    { id: 3, name: 'Carol\nMulti', price: 30, note: 'plain' },
  ]
}

/**
 * Capture the Blob content passed to URL.createObjectURL when a download is
 * triggered. Returns the last captured text.
 */
function installDownloadCapture(): { read: () => Promise<string>; restore: () => void } {
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  let captured: Blob | null = null
  URL.createObjectURL = vi.fn((blob: Blob) => {
    captured = blob
    return 'blob:mock'
  }) as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn()
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined)

  return {
    async read() {
      if (!captured) throw new Error('no blob captured')
      return await (captured as Blob).text()
    },
    restore() {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
      clickSpy.mockRestore()
    },
  }
}

describe('useExportEngine / csv', () => {
  let cap: ReturnType<typeof installDownloadCapture>
  beforeEach(() => {
    cap = installDownloadCapture()
  })
  afterEach(() => {
    cap.restore()
  })

  it('writes headers + rows with default separator', async () => {
    const { state, exportEngine } = setup()
    exportEngine.exportCsv(state.sourceData.value, { filename: 'test' })
    const text = await cap.read()
    const lines = text.split('\n')
    expect(lines[0]).toBe('ID,Name,Price,Note')
    expect(lines[1]).toBe('1,Alice,€10,ok')
  })

  it('escapes values containing separator, quotes, or newlines', async () => {
    const { state, exportEngine } = setup()
    exportEngine.exportCsv(state.sourceData.value)
    const text = await cap.read()
    const lines = text.split('\n')
    // row 2: "Bob, Jr." → quoted because of comma ; note has "quotes" → doubled
    expect(lines[2]).toContain('"Bob, Jr."')
    expect(lines[2]).toContain('"has ""quotes"""')
    // row 3 name has \n → gets quoted (next field continues the same logical row)
    expect(text).toContain('"Carol\nMulti"')
  })

  it('honors valueFormatter', async () => {
    const { state, exportEngine } = setup()
    exportEngine.exportCsv(state.sourceData.value)
    const text = await cap.read()
    expect(text).toContain('€10')
    expect(text).toContain('€20')
  })

  it('respects custom separator (;)', async () => {
    const { state, exportEngine } = setup()
    exportEngine.exportCsv(state.sourceData.value, { separator: ';' })
    const text = await cap.read()
    const lines = text.split('\n')
    expect(lines[0]).toBe('ID;Name;Price;Note')
    // "Bob, Jr." should NOT be quoted with ; separator
    expect(lines[2]?.startsWith('2;Bob, Jr.;')).toBe(true)
  })

  it('can skip headers', async () => {
    const { state, exportEngine } = setup()
    exportEngine.exportCsv(state.sourceData.value, { includeHeaders: false })
    const text = await cap.read()
    expect(text.split('\n')[0]).toBe('1,Alice,€10,ok')
  })

  it('filters to a specific column set when provided', async () => {
    const { state, exportEngine } = setup()
    exportEngine.exportCsv(state.sourceData.value, { columns: ['id', 'name'] })
    const text = await cap.read()
    const lines = text.split('\n')
    expect(lines[0]).toBe('ID,Name')
    expect(lines[1]).toBe('1,Alice')
  })
})

describe('useExportEngine / json', () => {
  let cap: ReturnType<typeof installDownloadCapture>
  beforeEach(() => {
    cap = installDownloadCapture()
  })
  afterEach(() => {
    cap.restore()
  })

  it('exports an array of objects keyed by field', async () => {
    const { state, exportEngine } = setup()
    exportEngine.exportJson(state.sourceData.value)
    const text = await cap.read()
    const parsed = JSON.parse(text)
    expect(parsed).toHaveLength(3)
    expect(parsed[0]).toEqual({ id: 1, name: 'Alice', price: 10, note: 'ok' })
  })

  it('uses raw values (no valueFormatter in JSON)', async () => {
    const { state, exportEngine } = setup()
    exportEngine.exportJson(state.sourceData.value)
    const parsed = JSON.parse(await cap.read())
    expect(parsed[0].price).toBe(10) // not '€10'
  })

  it('honors `columns` filter', async () => {
    const { state, exportEngine } = setup()
    exportEngine.exportJson(state.sourceData.value, { columns: ['id'] })
    const parsed = JSON.parse(await cap.read())
    expect(parsed[0]).toEqual({ id: 1 })
  })
})
