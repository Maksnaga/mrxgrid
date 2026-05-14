/**
 * Cell validation engine — Angular parity (moz-grid / `CellValidationEngine`).
 *
 * Tracks a `Map<"rowIndex:field", CellError>` of validation results produced
 * by each column's `cellValidator`. Vue's `cellValidator` returns `true |
 * string` (true = valid, string = error message); we wrap the string case
 * into a `CellError { message }` to match the Angular surface.
 *
 * The engine is passive — it only recomputes when `validateAll` or
 * `validateCell` is called. Wiring (e.g. on sourceData change, after inline
 * edit commit) stays in the host so consumers can opt in without paying the
 * cost unconditionally.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { GridState } from '../state/useGridState'
import type { CellError } from '../models/cell.model'
import type { RowData } from '../types'

export interface CellValidationEngine {
  readonly cellErrors: Ref<Map<string, CellError>>
  readonly errorCount: ComputedRef<number>
  validateAll(data: unknown[]): void
  validateCell(rowIndex: number, field: string, value: unknown, row: unknown): void
  getCellError(rowIndex: number, field: string): CellError | null
  hasCellError(rowIndex: number, field: string): boolean
  clearAll(): void
}

export function useCellValidationEngine<T = RowData>(
  state: GridState<T>,
): CellValidationEngine {
  const cellErrors = ref<Map<string, CellError>>(new Map())
  const errorCount = computed(() => cellErrors.value.size)

  function toError(result: true | string | null | undefined): CellError | null {
    if (result === true || result == null) return null
    if (typeof result === 'string') return { message: result }
    return null
  }

  function validateAll(data: unknown[]): void {
    const defMap = state.columnDefMap.value
    const errors = new Map<string, CellError>()

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex]
      if (!row || typeof row !== 'object') continue
      for (const [field, def] of defMap) {
        if (!def.cellValidator) continue
        const value = (row as Record<string, unknown>)[field]
        const result = def.cellValidator(value, row as RowData)
        const err = toError(result)
        if (err) errors.set(`${rowIndex}:${field}`, err)
      }
    }

    cellErrors.value = errors
  }

  function validateCell(rowIndex: number, field: string, value: unknown, row: unknown): void {
    const def = state.columnDefMap.value.get(field)
    if (!def?.cellValidator) {
      removeCellError(rowIndex, field)
      return
    }

    const err = toError(def.cellValidator(value, row as RowData))
    const key = `${rowIndex}:${field}`
    const next = new Map(cellErrors.value)
    if (err) next.set(key, err)
    else next.delete(key)
    cellErrors.value = next
  }

  function getCellError(rowIndex: number, field: string): CellError | null {
    return cellErrors.value.get(`${rowIndex}:${field}`) ?? null
  }

  function hasCellError(rowIndex: number, field: string): boolean {
    return cellErrors.value.has(`${rowIndex}:${field}`)
  }

  function clearAll(): void {
    cellErrors.value = new Map()
  }

  function removeCellError(rowIndex: number, field: string): void {
    const key = `${rowIndex}:${field}`
    if (!cellErrors.value.has(key)) return
    const next = new Map(cellErrors.value)
    next.delete(key)
    cellErrors.value = next
  }

  return {
    cellErrors,
    errorCount,
    validateAll,
    validateCell,
    getCellError,
    hasCellError,
    clearAll,
  }
}
