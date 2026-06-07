import { computed, shallowRef, type ComputedRef, type Ref } from 'vue'
import type { RowData, SelectionRange } from '@/components/AdeoGrid/types'
import type { GridState } from '@/components/AdeoGrid/state/useGridState'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRange(
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): SelectionRange {
  return {
    r1: Math.min(r1, r2),
    c1: Math.min(c1, c2),
    r2: Math.max(r1, r2),
    c2: Math.max(c1, c2),
  }
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export interface CellSelectionOptions {
  /** Central grid state — owns `selectedCell` and `cellRange` (Angular shapes). */
  gridState: GridState<RowData>
  totalRows: Ref<number>
  totalCols: Ref<number>
}

/**
 * Cell selection — Angular-parity storage for the single-cell + shift-extend
 * range, with a local supplement for multi-range (Ctrl+Click) which has no
 * Angular pendant.
 *
 * Phase 2.11 mapping:
 * - `gridState.selectedCell {row, col}`        ↔ `activeRow/activeCol`
 * - `gridState.cellRange {start, end}`         ↔ shift-extend range; `start` doubles as the anchor
 * - `frozenRanges: SelectionRange[]` (local)   — Ctrl+Click multi-selection
 *
 * The `cellRange.start` is the **anchor** (fixed corner of a Shift-extend).
 * The `cellRange.end` follows the active cell — `extendTo` updates only `end`,
 * `activate` resets `start = end = clicked cell` (single-cell selection that
 * lights up the focus ring without a multi-cell range).
 */
export function useCellSelection(options: CellSelectionOptions) {
  const { gridState, totalRows, totalCols } = options

  // --- Local-only state: multi-range (no Angular pendant) ---
  const frozenRanges = shallowRef<SelectionRange[]>([])

  // --- State projections over gridState ---

  const activeRow: ComputedRef<number> = computed(
    () => gridState.selectedCell.value?.row ?? -1,
  )
  const activeCol: ComputedRef<number> = computed(
    () => gridState.selectedCell.value?.col ?? -1,
  )
  const anchorRow: ComputedRef<number> = computed(
    () => gridState.cellRange.value?.start.row ?? -1,
  )
  const anchorCol: ComputedRef<number> = computed(
    () => gridState.cellRange.value?.start.col ?? -1,
  )

  // --- Derived ---

  const isActive = computed(() => activeRow.value >= 0)

  /** The live range being built (anchor → active). */
  const currentRange = computed<SelectionRange | null>(() => {
    const range = gridState.cellRange.value
    if (!range) return null
    return normalizeRange(range.start.row, range.start.col, range.end.row, range.end.col)
  })

  /** All ranges: frozen (Ctrl+Click) + current (Shift-extend). */
  const allRanges = computed<SelectionRange[]>(() => {
    const result = [...frozenRanges.value]
    if (currentRange.value) result.push(currentRange.value)
    return result
  })

  /** True when more than a single cell is selected. */
  const hasSelection = computed(() => {
    if (frozenRanges.value.length > 0) return true
    const r = currentRange.value
    return r !== null && (r.r1 !== r.r2 || r.c1 !== r.c2)
  })

  /** Bottom-right corner of the last range (for the fill handle). */
  const fillHandleRow = computed(() => {
    const ranges = allRanges.value
    if (ranges.length > 0) return ranges[ranges.length - 1]!.r2
    return activeRow.value
  })

  const fillHandleCol = computed(() => {
    const ranges = allRanges.value
    if (ranges.length > 0) return ranges[ranges.length - 1]!.c2
    return activeCol.value
  })

  // --- Clamping ---

  function clampRow(row: number): number {
    return Math.max(0, Math.min(row, totalRows.value - 1))
  }

  function clampCol(col: number): number {
    return Math.max(0, Math.min(col, totalCols.value - 1))
  }

  // --- Mutations ---

  /** Click — activate cell, reset anchor, clear multi-selection. */
  function activate(row: number, col: number): void {
    const r = clampRow(row)
    const c = clampCol(col)
    gridState.selectedCell.value = { row: r, col: c }
    gridState.cellRange.value = { start: { row: r, col: c }, end: { row: r, col: c } }
    frozenRanges.value = []
  }

  /** Shift+Click / Shift+Arrow — extend current range from anchor. */
  function extendTo(row: number, col: number): void {
    const range = gridState.cellRange.value
    if (!range) return
    const r = clampRow(row)
    const c = clampCol(col)
    gridState.selectedCell.value = { row: r, col: c }
    gridState.cellRange.value = { start: range.start, end: { row: r, col: c } }
  }

  /** Ctrl+Click — freeze current range, start a new one at (row, col). */
  function addRange(row: number, col: number): void {
    if (currentRange.value) {
      frozenRanges.value = [...frozenRanges.value, currentRange.value]
    }
    const r = clampRow(row)
    const c = clampCol(col)
    gridState.selectedCell.value = { row: r, col: c }
    gridState.cellRange.value = { start: { row: r, col: c }, end: { row: r, col: c } }
  }

  /** Ctrl+A — select the entire grid. */
  function selectAll(): void {
    const lastRow = totalRows.value - 1
    const lastCol = totalCols.value - 1
    if (lastRow < 0 || lastCol < 0) return
    gridState.selectedCell.value = { row: lastRow, col: lastCol }
    gridState.cellRange.value = {
      start: { row: 0, col: 0 },
      end: { row: lastRow, col: lastCol },
    }
    frozenRanges.value = []
  }

  /** Escape (first press) — collapse selection back to active cell. */
  function clearRanges(): void {
    frozenRanges.value = []
    const sel = gridState.selectedCell.value
    if (sel) {
      gridState.cellRange.value = { start: { ...sel }, end: { ...sel } }
    }
  }

  /** Escape (second press) / blur — full deactivation. */
  function deactivate(): void {
    gridState.selectedCell.value = null
    gridState.cellRange.value = null
    frozenRanges.value = []
  }

  // --- Queries (called per cell during render) ---

  function isCellSelected(row: number, col: number): boolean {
    for (const r of allRanges.value) {
      if (row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2) {
        return true
      }
    }
    return false
  }

  function getCellEdges(
    row: number,
    col: number,
  ): { top: boolean; bottom: boolean; left: boolean; right: boolean } {
    let top = false
    let bottom = false
    let left = false
    let right = false
    for (const r of allRanges.value) {
      if (row >= r.r1 && row <= r.r2 && col >= r.c1 && col <= r.c2) {
        if (row === r.r1) top = true
        if (row === r.r2) bottom = true
        if (col === r.c1) left = true
        if (col === r.c2) right = true
      }
    }
    return { top, bottom, left, right }
  }

  return {
    // State (read-only projections of gridState — writes go through mutators)
    activeRow,
    activeCol,
    anchorRow,
    anchorCol,
    frozenRanges,

    // Derived
    isActive,
    currentRange,
    allRanges,
    hasSelection,
    fillHandleRow,
    fillHandleCol,

    // Mutations
    activate,
    extendTo,
    addRange,
    selectAll,
    clearRanges,
    deactivate,

    // Queries
    isCellSelected,
    getCellEdges,
  }
}
