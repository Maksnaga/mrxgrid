import { computed, type ComputedRef, type Ref, type WritableComputedRef } from 'vue'
import type { ColumnDef, RowData } from '@/components/MrxGrid/types'
import type { GridState } from '@/components/MrxGrid/state/useGridState'

export interface CellEditState {
  rowIndex: number
  field: string
  originalValue: unknown
  draftValue: unknown
}

export interface CellEditEvent {
  rowIndex: number
  field: string
  oldValue: unknown
  newValue: unknown
}

export interface CellEditingOptions {
  /** Central grid state — owns the canonical Angular `cellEditState`. */
  gridState: GridState<RowData>
  columns: Ref<ColumnDef[]>
  rows: Ref<RowData[]>
}

/**
 * Single-cell inline editing — Angular-parity storage.
 *
 * Phase 2.10: state lives on `gridState.cellEditState` (shape
 * `{ editingCell: {row, col} | null, originalValue, draftValue, validationError }`).
 * The legacy `{ rowIndex, field, originalValue, draftValue }` shape is exposed
 * via a writable computed; field↔col conversion uses the `columns` ref.
 *
 * ## Virtualization invariant
 * State survives unmount/remount of the cell during virtual scroll because it
 * lives in the central state, not in the cell component.
 */
export function useCellEditing(options: CellEditingOptions) {
  const { gridState, columns, rows } = options

  function colIndex(field: string): number {
    return columns.value.findIndex((c) => c.field === field)
  }

  // --- editingCell — writable computed projection over gridState.cellEditState ---

  const editingCell: WritableComputedRef<CellEditState | null> = computed({
    get: () => {
      const s = gridState.cellEditState.value
      if (!s.editingCell) return null
      const col = columns.value[s.editingCell.col]
      if (!col) return null
      return {
        rowIndex: s.editingCell.row,
        field: col.field,
        originalValue: s.originalValue,
        draftValue: s.draftValue,
      }
    },
    set: (next) => {
      if (!next) {
        gridState.cellEditState.value = {
          editingCell: null,
          originalValue: undefined,
          draftValue: undefined,
          validationError: null,
        }
        return
      }
      const col = colIndex(next.field)
      if (col < 0) {
        gridState.cellEditState.value = {
          editingCell: null,
          originalValue: undefined,
          draftValue: undefined,
          validationError: null,
        }
        return
      }
      gridState.cellEditState.value = {
        editingCell: { row: next.rowIndex, col },
        originalValue: next.originalValue,
        draftValue: next.draftValue,
        validationError: null,
      }
    },
  })

  const isEditing: ComputedRef<boolean> = computed(() => editingCell.value !== null)

  function isEditable(field: string): boolean {
    return columns.value.some((c) => c.field === field && c.editable === true)
  }

  function startEditing(rowIndex: number, field: string, initialValue?: unknown): void {
    if (!isEditable(field)) return
    const row = rows.value[rowIndex]
    if (!row) return
    // Same valueGetter routing as the visual render path (cf. MrxGridRow.vue
    // `cellValue`). Without this, columns whose value is computed on-the-fly
    // (synthetic / stress-test / derived fields not present on the row
    // object) open the editor blank — `row[field]` returns undefined and
    // the editor's `localEditValue` seeds to `''`.
    const col = columns.value.find((c) => c.field === field)
    const currentValue = col?.valueGetter ? col.valueGetter(row) : row[field]
    editingCell.value = {
      rowIndex,
      field,
      originalValue: currentValue,
      draftValue: initialValue ?? currentValue,
    }
  }

  function updateDraft(value: unknown): void {
    const current = editingCell.value
    if (!current) return
    editingCell.value = { ...current, draftValue: value }
  }

  /**
   * Finalise the edit and clear editing state.
   * Returns the edit event (for the parent to apply), or null if nothing
   * was being edited. Idempotent — safe to call twice.
   */
  function commit(): CellEditEvent | null {
    const state = editingCell.value
    if (!state) return null
    editingCell.value = null
    return {
      rowIndex: state.rowIndex,
      field: state.field,
      oldValue: state.originalValue,
      newValue: state.draftValue,
    }
  }

  function cancel(): void {
    editingCell.value = null
  }

  /** Returns the field being edited in this row, or null. */
  function editingFieldForRow(rowIndex: number): string | null {
    const state = editingCell.value
    if (state?.rowIndex === rowIndex) return state.field
    return null
  }

  return {
    editingCell: editingCell as unknown as Ref<CellEditState | null>,
    isEditing,
    isEditable,
    startEditing,
    updateDraft,
    commit,
    cancel,
    editingFieldForRow,
  }
}
