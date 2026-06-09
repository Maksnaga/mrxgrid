/**
 * Cell validation engine — Angular parity (ad-grid / `CellValidationEngine`).
 *
 * Tracks a `Map<"rowIndex:field", CellError>` of validation results produced
 * by each column's `cellValidator`. After the sync analysis, the public
 * `cellValidator` signature is now `(value, row) => CellError | null` directly
 * — no more `true | string` coercion. The engine is therefore a passthrough.
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
  /**
   * Run every column's `cellValidator` against `data`. Populates
   * `cellErrors` / `errorCount`. Returns the total error count after
   * validation — Angular parity (Angular `validateAll` returns `number`).
   *
   * When `data` is omitted the engine reads `state.sourceData.value`
   * directly — mirrors Angular `validateAll()` (no-arg). Backwards
   * compatible: callers that pass `data` explicitly continue to work.
   */
  validateAll(data?: unknown[]): number
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

  function validateAll(data?: unknown[]): number {
    // When no data is supplied, fall back to the engine's own sourceData —
    // Angular-parity (Angular `validateAll()` reads `this.state.sourceData()`).
    const rows: unknown[] = data ?? (state.sourceData.value as unknown[])
    const defMap = state.columnDefMap.value
    const errors = new Map<string, CellError>()

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]
      if (!row || typeof row !== 'object') continue
      for (const [field, def] of defMap) {
        if (!def.cellValidator) continue
        const value = (row as Record<string, unknown>)[field]
        const err = def.cellValidator(value, row as RowData)
        if (err) errors.set(`${rowIndex}:${field}`, err)
      }
    }

    cellErrors.value = errors
    return cellErrors.value.size
  }

  function validateCell(rowIndex: number, field: string, value: unknown, row: unknown): void {
    const def = state.columnDefMap.value.get(field)
    if (!def?.cellValidator) {
      removeCellError(rowIndex, field)
      return
    }

    const err = def.cellValidator(value, row as RowData)
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
