import { shallowRef, computed, isRef, onBeforeUnmount, type Ref } from 'vue'
import type {
  ColumnDef,
  FillEvent,
  RowData,
  SelectionRange,
} from '@/components/AdeoGrid/types'

export interface FillHandleOptions {
  /** All columns in flat display order. */
  allColumns: Ref<ColumnDef[]>
  /** All renderable rows. */
  rows: Ref<RowData[]>
  /** Row height in px — used to map mouse Y to row index. May be reactive. */
  rowHeight: Ref<number> | number
  /** Scroll container ref. */
  wrapperRef: Ref<HTMLElement | null>
  /** The source selection range (bottom-right corner shows the handle). */
  sourceRange: Ref<SelectionRange | null>
  /** Resolve runtime column width in px (after resize). */
  getColumnWidth?: (field: string) => string | undefined
  /** Width of utility columns (checkbox + expand) before the first data column. */
  utilityWidth?: number
  /** Called when drag completes. */
  onFill: (event: FillEvent) => void
}

export interface FillDragState {
  /** The fixed source range being extended. */
  source: SelectionRange
  /** Current target range being filled into (disjoint from source). */
  target: SelectionRange
  direction: 'down' | 'up' | 'right' | 'left'
}

/**
 * Manages the fill-handle drag interaction.
 *
 * ## How it works
 *
 * 1. The fill handle is a small 6×6 square at the bottom-right corner of
 *    the active selection. AdeoGridCell renders it when `fillHandle` is true.
 *
 * 2. On mousedown on the fill handle, this composable captures the source
 *    range and starts tracking mouse movement.
 *
 * 3. As the mouse moves, it computes the target range (the new rows/columns
 *    being filled into) and the direction of the fill.
 *
 * 4. On mouseup, it computes the fill values by replicating the source
 *    pattern into the target range and calls `onFill`.
 *
 * ## Virtualization
 *
 * The fill handle works with absolute row/column indices. The mouse position
 * is converted to absolute indices using the scroll offset and row height.
 * The fill target range is stored as absolute indices so the cell flags
 * computation at the grid level can highlight target cells correctly.
 */
export function useFillHandle(options: FillHandleOptions) {
  const {
    allColumns,
    rows,
    wrapperRef,
    sourceRange,
    getColumnWidth,
    utilityWidth = 0,
    onFill,
  } = options

  const rowHeight = computed(() => isRef(options.rowHeight) ? options.rowHeight.value : options.rowHeight)

  function resolveColWidth(col: ColumnDef): number {
    if (getColumnWidth) {
      const w = getColumnWidth(col.field)
      if (w) return parseWidth(w)
    }
    return parseWidth(col.width)
  }

  const dragState = shallowRef<FillDragState | null>(null)
  const isDragging = computed(() => dragState.value !== null)

  /** The target range being previewed during drag. */
  const fillTargetRange = computed(() => dragState.value?.target ?? null)

  // --- Mouse → grid coordinate mapping ---

  function getHeaderHeight(): number {
    const el = wrapperRef.value
    if (!el) return 0
    const header = el.querySelector('.adeo-grid-grid-header')
    if (!header) return 0
    return header.getBoundingClientRect().height
  }

  function mouseToCell(e: MouseEvent): { row: number; col: number } | null {
    const el = wrapperRef.value
    if (!el) return null

    const rect = el.getBoundingClientRect()
    const headerH = getHeaderHeight()
    const x = e.clientX - rect.left - el.clientLeft + el.scrollLeft
    const y = e.clientY - rect.top - el.clientTop + el.scrollTop - headerH

    const row = Math.floor(y / rowHeight.value)
    const clampedRow = Math.max(0, Math.min(row, rows.value.length - 1))

    // Walk cumulative column widths to find the column index
    const cols = allColumns.value
    let acc = utilityWidth
    let col = 0
    for (let i = 0; i < cols.length; i++) {
      const w = resolveColWidth(cols[i]!)
      if (x < acc + w) {
        col = i
        break
      }
      acc += w
      col = i
    }
    const clampedCol = Math.max(0, Math.min(col, cols.length - 1))

    return { row: clampedRow, col: clampedCol }
  }

  // --- Drag lifecycle ---

  function startDrag(e: MouseEvent) {
    const src = sourceRange.value
    if (!src) return

    e.preventDefault()
    e.stopPropagation()

    dragState.value = {
      source: { ...src },
      target: { ...src },
      direction: 'down',
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  /**
   * Compute the pixel boundaries of the source range relative to the
   * scroll container's content. Used to compare mouse distance in
   * pixels (not cell units) so direction detection feels natural
   * regardless of row height vs column width differences.
   */
  function getSourcePixelRect(src: SelectionRange) {
    const cols = allColumns.value
    const top = src.r1 * rowHeight.value
    const bottom = (src.r2 + 1) * rowHeight.value

    let left = utilityWidth
    for (let i = 0; i < src.c1 && i < cols.length; i++) {
      left += resolveColWidth(cols[i]!)
    }
    let right = left
    for (let i = src.c1; i <= src.c2 && i < cols.length; i++) {
      right += resolveColWidth(cols[i]!)
    }

    return { top, bottom, left, right }
  }

  function onMouseMove(e: MouseEvent) {
    const state = dragState.value
    if (!state) return

    const el = wrapperRef.value
    if (!el) return

    const cell = mouseToCell(e)
    if (!cell) return

    const src = state.source
    const { row, col } = cell

    // Compute pixel distance from the mouse to the source range edges.
    const rect = el.getBoundingClientRect()
    const headerH = getHeaderHeight()
    const mouseContentX = e.clientX - rect.left - el.clientLeft + el.scrollLeft
    const mouseContentY = e.clientY - rect.top - el.clientTop + el.scrollTop - headerH
    const srcRect = getSourcePixelRect(src)

    const pxDistY = mouseContentY > srcRect.bottom ? mouseContentY - srcRect.bottom
      : mouseContentY < srcRect.top ? srcRect.top - mouseContentY
      : 0
    const pxDistX = mouseContentX > srcRect.right ? mouseContentX - srcRect.right
      : mouseContentX < srcRect.left ? srcRect.left - mouseContentX
      : 0

    let direction: FillDragState['direction'] = 'down'
    let target: SelectionRange

    if (pxDistY === 0 && pxDistX === 0) {
      // Mouse is within the source range — no target
      target = { r1: -1, c1: -1, r2: -1, c2: -1 }
    } else if (pxDistY >= pxDistX) {
      // Vertical fill wins (or tie goes to vertical)
      if (row > src.r2) {
        direction = 'down'
        target = { r1: src.r2 + 1, c1: src.c1, r2: row, c2: src.c2 }
      } else {
        direction = 'up'
        target = { r1: row, c1: src.c1, r2: src.r1 - 1, c2: src.c2 }
      }
    } else {
      // Horizontal fill wins
      if (col > src.c2) {
        direction = 'right'
        target = { r1: src.r1, c1: src.c2 + 1, r2: src.r2, c2: col }
      } else {
        direction = 'left'
        target = { r1: src.r1, c1: col, r2: src.r2, c2: src.c1 - 1 }
      }
    }

    dragState.value = { source: src, target, direction }
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)

    const state = dragState.value
    dragState.value = null

    if (!state || state.target.r1 < 0) return

    // Compute fill values by replicating the source pattern
    const fills = computeFills(state)
    if (fills.length > 0) {
      onFill({
        sourceRange: state.source,
        targetRange: state.target,
        direction: state.direction,
        fills,
      })
    }
  }

  // --- Fill value computation ---

  /**
   * Read a cell's value honouring `col.valueGetter` when present.
   * Same routing as the clipboard `buildTsv` / `AdeoGridRow.cellValue` —
   * without it, fill on synthetic / derived columns propagates `undefined`
   * and the user sees nothing happen on drag-fill.
   */
  function readCellValue(col: ColumnDef, row: RowData): unknown {
    return col.valueGetter ? col.valueGetter(row) : row[col.field]
  }

  function computeFills(
    state: FillDragState,
  ): FillEvent['fills'] {
    const { source, target, direction } = state
    const cols = allColumns.value
    const result: FillEvent['fills'] = []

    // Source dimensions
    const srcRows = source.r2 - source.r1 + 1
    const srcCols = source.c2 - source.c1 + 1

    if (direction === 'down' || direction === 'up') {
      // Replicate source rows cyclically into target rows
      for (let r = target.r1; r <= target.r2; r++) {
        const srcRowOffset = direction === 'down'
          ? (r - target.r1) % srcRows
          : (target.r2 - r) % srcRows
        const srcRowIdx = direction === 'down'
          ? source.r1 + srcRowOffset
          : source.r2 - srcRowOffset

        const srcRow = rows.value[srcRowIdx]
        if (!srcRow) continue

        for (let c = source.c1; c <= source.c2; c++) {
          const col = cols[c]
          if (!col || !col.editable) continue
          result.push({
            rowIndex: r,
            field: col.field,
            value: readCellValue(col, srcRow),
          })
        }
      }
    } else {
      // Replicate source columns cyclically into target columns.
      for (let c = target.c1; c <= target.c2; c++) {
        const srcColOffset = direction === 'right'
          ? (c - target.c1) % srcCols
          : (target.c2 - c) % srcCols
        const srcColIdx = direction === 'right'
          ? source.c1 + srcColOffset
          : source.c2 - srcColOffset

        const srcCol = cols[srcColIdx]
        const tgtCol = cols[c]
        if (!srcCol || !tgtCol || !tgtCol.editable) continue
        // Skip target columns whose cell editor doesn't match the source's —
        // propagating across editor types (e.g. text → number) would push a
        // value the typed column can't accept.
        if (!areCompatibleColumns(srcCol, tgtCol)) continue

        for (let r = source.r1; r <= source.r2; r++) {
          const srcRow = rows.value[r]
          if (!srcRow) continue
          const value = readCellValue(srcCol, srcRow)
          // Honour the target column's `valueValidator` — its doc states it
          // is "called before paste / fill writes a value". Keeps the fill
          // handle aligned with the clipboard's paste path.
          if (tgtCol.valueValidator && !tgtCol.valueValidator(value)) continue
          result.push({
            rowIndex: r,
            field: tgtCol.field,
            value,
          })
        }
      }
    }

    return result
  }

  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  })

  return {
    isDragging,
    dragState,
    fillTargetRange,
    startDrag,
  }
}

function parseWidth(w: string | undefined): number {
  if (!w) return 150
  return parseInt(w, 10) || 150
}

/**
 * Two columns share a "fill type" when their cell editors agree (an
 * undefined editor defaults to plain text). The fill handle uses this to
 * skip target columns whose type doesn't match the source — text → number
 * would otherwise push a string into a typed column.
 */
function areCompatibleColumns(src: ColumnDef, tgt: ColumnDef): boolean {
  const srcType = src.cellEditor ?? 'text'
  const tgtType = tgt.cellEditor ?? 'text'
  return srcType === tgtType
}
