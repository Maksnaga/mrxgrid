import { describe, it, expect } from 'vitest'
import { useGridState } from '../../state/useGridState'
import { useCellValidationEngine } from '../useCellValidationEngine'
import type { ColumnDef } from '../../types'

interface Row {
  id: number
  name: string
  age: number
}

const columns: ColumnDef<Row>[] = [
  { field: 'id', headerName: 'ID' },
  {
    field: 'name',
    headerName: 'Name',
    cellValidator: (value) => (typeof value === 'string' && value.length > 0 ? true : 'Required'),
  },
  {
    field: 'age',
    headerName: 'Age',
    cellValidator: (value) => (typeof value === 'number' && value >= 0 ? true : 'Must be >= 0'),
  },
]

function setup(rows: Row[] = seed()) {
  const state = useGridState<Row>()
  state.initColumns(columns)
  state.sourceData.value = rows
  const validation = useCellValidationEngine<Row>(state)
  return { state, validation }
}

function seed(): Row[] {
  return [
    { id: 1, name: 'Alice', age: 30 },
    { id: 2, name: '', age: -1 },
    { id: 3, name: 'Carol', age: 25 },
  ]
}

describe('useCellValidationEngine', () => {
  it('validateAll populates cellErrors and errorCount', () => {
    const { state, validation } = setup()
    validation.validateAll(state.sourceData.value)
    // row 1: name empty + age negative → 2 errors
    expect(validation.errorCount.value).toBe(2)
    expect(validation.getCellError(1, 'name')).toEqual({ message: 'Required' })
    expect(validation.getCellError(1, 'age')).toEqual({ message: 'Must be >= 0' })
  })

  it('hasCellError / getCellError return null when no error', () => {
    const { state, validation } = setup()
    validation.validateAll(state.sourceData.value)
    expect(validation.hasCellError(0, 'name')).toBe(false)
    expect(validation.getCellError(0, 'name')).toBeNull()
  })

  it('validateCell adds an error when invalid', () => {
    const { validation } = setup()
    validation.validateCell(0, 'name', '', { id: 1, name: '', age: 30 })
    expect(validation.hasCellError(0, 'name')).toBe(true)
    expect(validation.getCellError(0, 'name')).toEqual({ message: 'Required' })
  })

  it('validateCell removes an error when value becomes valid', () => {
    const { validation } = setup()
    validation.validateCell(0, 'name', '', { id: 1, name: '', age: 30 })
    expect(validation.hasCellError(0, 'name')).toBe(true)
    validation.validateCell(0, 'name', 'Alice', { id: 1, name: 'Alice', age: 30 })
    expect(validation.hasCellError(0, 'name')).toBe(false)
  })

  it('validateCell is a noop for columns without a validator', () => {
    const { validation } = setup()
    validation.validateCell(0, 'id', 42, { id: 42, name: 'Alice', age: 30 })
    expect(validation.errorCount.value).toBe(0)
  })

  it('clearAll wipes all errors', () => {
    const { state, validation } = setup()
    validation.validateAll(state.sourceData.value)
    expect(validation.errorCount.value).toBeGreaterThan(0)
    validation.clearAll()
    expect(validation.errorCount.value).toBe(0)
  })

  it('toError adapter: true → no error, string → CellError { message }', () => {
    const state = useGridState<Row>()
    state.initColumns([
      {
        field: 'name',
        headerName: 'Name',
        cellValidator: (v) => (v === 'ok' ? true : 'bad'),
      },
    ])
    state.sourceData.value = [{ id: 1, name: 'ok', age: 0 }] as Row[]
    const validation = useCellValidationEngine<Row>(state)
    validation.validateAll(state.sourceData.value)
    expect(validation.errorCount.value).toBe(0)
    validation.validateCell(0, 'name', 'nope', state.sourceData.value[0])
    expect(validation.getCellError(0, 'name')).toEqual({ message: 'bad' })
  })
})
