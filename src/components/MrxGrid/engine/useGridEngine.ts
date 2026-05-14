/**
 * Grid pipeline — Angular parity (moz-grid / `GridEngine`).
 *
 * Composes the data pipeline on top of the central `GridState`:
 *
 *   sourceData → sortedData → filteredData → paginatedData → displayRows
 *
 * Phase 1 scope: every stage is a **pass-through**. The real sort / filter /
 * group implementations are wired in when the matching feature engine lands
 * (sort → Phase 2, filter → Phase 3, group/infinite → later). The pagination
 * slice is already in place because it's pure arithmetic over state refs.
 *
 * Keeping the stages as computed refs (not functions) means consumers can
 * already depend on `engine.displayRows` even before any feature engine is
 * implemented — they just see the raw data until each stage gets replaced.
 */

import { computed, type ComputedRef } from 'vue'
import type { DisplayRow } from '../models/display-row.model'
import type { GridState } from '../state/useGridState'
import type { RowData } from '../types'
import { useSortEngine, type SortEngine } from '../features/useSortEngine'
import { usePaginationEngine, type PaginationEngine } from '../features/usePaginationEngine'
import {
  useColumnResizeEngine,
  type ColumnResizeEngine,
} from '../features/useColumnResizeEngine'
import {
  useRowSelectionEngine,
  type RowSelectionEngine,
} from '../features/useRowSelectionEngine'
import {
  useRowExpansionEngine,
  type RowExpansionEngine,
} from '../features/useRowExpansionEngine'
import {
  useColumnReorderEngine,
  type ColumnReorderEngine,
} from '../features/useColumnReorderEngine'
import {
  useColumnDragEngine,
  type ColumnDragEngine,
} from '../features/useColumnDragEngine'
import {
  useHorizontalVirtualScrollEngine,
  type HorizontalVirtualScrollEngine,
} from '../features/useHorizontalVirtualScrollEngine'
import { useFilterEngine, type FilterEngine } from '../features/useFilterEngine'
import { useClipboardEngine, type ClipboardEngine } from '../features/useClipboardEngine'
import { useHistoryEngine, type HistoryEngine } from '../features/useHistoryEngine'
import {
  useCellValidationEngine,
  type CellValidationEngine,
} from '../features/useCellValidationEngine'
import { useInlineEditEngine, type InlineEditEngine } from '../features/useInlineEditEngine'
import { useKeyboardEngine, type KeyboardEngine } from '../features/useKeyboardEngine'
import {
  useCellSelectionEngine,
  type CellSelectionEngine,
} from '../features/useCellSelectionEngine'
import { useGroupEngine, type GroupEngine } from '../features/useGroupEngine'
import { useTreeEngine, type TreeEngine } from '../features/useTreeEngine'
import { useExportEngine, type ExportEngine } from '../features/useExportEngine'
import {
  useStatePersistenceEngine,
  type StatePersistenceEngine,
} from '../features/useStatePersistenceEngine'
import { useFormulaEngine, type FormulaEngine } from '../features/formula/useFormulaEngine'

/** Shape returned by `useGridEngine()` — mirrors `GridEngine` (Angular). */
export interface GridEngine<T = RowData> {
  readonly sortedData: ComputedRef<T[]>
  readonly filteredData: ComputedRef<T[]>
  readonly paginatedData: ComputedRef<T[]>
  readonly displayRows: ComputedRef<DisplayRow<T>[]>
  readonly computedTotalItems: ComputedRef<number>
  /** Feature engines — exposed so templates and host components can bind to them. */
  readonly sort: SortEngine<T>
  readonly filter: FilterEngine<T>
  readonly pagination: PaginationEngine
  readonly columnResize: ColumnResizeEngine
  readonly rowSelection: RowSelectionEngine<T>
  readonly rowExpansion: RowExpansionEngine
  readonly columnReorder: ColumnReorderEngine
  readonly columnDrag: ColumnDragEngine
  readonly horizontalVirtualScroll: HorizontalVirtualScrollEngine
  readonly clipboard: ClipboardEngine<T>
  readonly history: HistoryEngine
  readonly cellValidation: CellValidationEngine
  readonly inlineEdit: InlineEditEngine<T>
  readonly keyboard: KeyboardEngine
  readonly cellSelection: CellSelectionEngine
  readonly group: GroupEngine<T>
  readonly tree: TreeEngine<T>
  readonly export: ExportEngine<T>
  readonly statePersistence: StatePersistenceEngine
  readonly formula: FormulaEngine
  /**
   * Resolves a `DisplayRow.index` back to the index in `sourceData`. Returns
   * `-1` when the display index is unknown (row not in current page / filter).
   */
  displayIndexToSourceIndex(displayIndex: number): number
}

export function useGridEngine<T = RowData>(state: GridState<T>): GridEngine<T> {
  // Phase 2.1 — real sort stage via `useSortEngine`.
  const sortEngine = useSortEngine<T>(state)
  const sortedData = computed<T[]>(() => sortEngine.sortData(state.sourceData.value))

  // Phase 3.2 — real filter stage via `useFilterEngine`.
  const filterEngine = useFilterEngine<T>(state)
  const filteredData = computed<T[]>(() => filterEngine.filterData(sortedData.value))

  // Phase 2.2 — pagination engine (imperative handle; the paginatedData
  // computed below already consumes `state.pageIndex` / `pageSize`).
  const paginationEngine = usePaginationEngine<T>(state)

  // Phase 2.3 — column resize engine (writes `currentWidth` to columnStates).
  const columnResizeEngine = useColumnResizeEngine<T>(state)

  const paginatedData = computed<T[]>(() => {
    const data = filteredData.value
    if (state.mode.value === 'server') return data
    if (state.loadingStrategy.value === 'infinite-scroll') return data
    if (!state.paginationEnabled.value) return data
    const start = state.pageIndex.value * state.pageSize.value
    return data.slice(start, start + state.pageSize.value)
  })

  // Phase 2.4 — row selection engine (depends on `paginatedData`).
  const rowSelectionEngine = useRowSelectionEngine<T>(state, paginatedData)

  // Phase 2.5 — row expansion engine (keyed on row ID).
  const rowExpansionEngine = useRowExpansionEngine<T>(state)

  // Phase 2.6 — column reorder + column drag engines.
  //   - reorder = pure state mutation on columnStates (splice + re-number order)
  //   - drag    = mirrors draggingColumn / dropIndicatorIndex, invokes reorderUnpinned on drop
  const columnReorderEngine = useColumnReorderEngine<T>(state)
  const columnDragEngine = useColumnDragEngine<T>(state, columnReorderEngine)

  // Phase 2.7 — horizontal virtual scroll engine (writes visibleColumnRange
  // and scrollContentTotalWidth based on unpinned columns).
  const horizontalVirtualScrollEngine = useHorizontalVirtualScrollEngine<T>(state)

  // Phase 4 — clipboard / history / cell-validation / inline-edit / keyboard.
  //   clipboard      → pure cell mutations (fill / paste / clear / TSV / cut outline)
  //   history        → undo/redo over clipboard.applyChanges, optional localStorage
  //   cellValidation → Map<"row:field", CellError> driven by column cellValidators
  //   inlineEdit     → cellEditState lifecycle; records single-cell edits on history
  //   keyboard       → non-editing key dispatch (shortcuts + navigation)
  // All five delegate row-index resolution to the function declared below —
  // function declarations are hoisted, so passing it here is safe.
  const clipboardEngine = useClipboardEngine<T>(state, (i) => displayIndexToSourceIndex(i))
  const historyEngine = useHistoryEngine<T>(clipboardEngine)
  const cellValidationEngine = useCellValidationEngine<T>(state)
  const inlineEditEngine = useInlineEditEngine<T>(state, historyEngine, (i) =>
    displayIndexToSourceIndex(i),
  )
  const keyboardEngine = useKeyboardEngine<T>(state, inlineEditEngine)

  // Phase 5 — cell-selection engine (focus + range + fill handle). Registered
  // on the keyboard engine immediately so arrow keys, Home/End, PageUp/Down,
  // Tab, Ctrl+A and the fill/selection actions all work without the host
  // having to wire anything up.
  const cellSelectionEngine = useCellSelectionEngine<T>(state)
  keyboardEngine.setCellSelection(cellSelectionEngine)

  // Phase 6 — group + tree engines.
  //   group → hierarchical DisplayRow output when `state.groupColumns` is non-empty
  //   tree  → flattens nested children arrays into TreeDisplayRow[] (ad-hoc use by host)
  const groupEngine = useGroupEngine<T>(state)
  const treeEngine = useTreeEngine<T>(state)

  // Phase 7 — export (CSV / JSON) + state persistence (localStorage round-trip
  // of columns / sorts / filters). Stateless engines; both are safe to build
  // upfront regardless of whether the host grid opts in.
  const exportEngine = useExportEngine<T>(state)
  const statePersistenceEngine = useStatePersistenceEngine<T>(state)

  // Phase 6b — formula engine. Active when at least one column declares
  // `allowFormula: true`. Idle (no allocations) otherwise.
  const formulaEngine = useFormulaEngine(state as unknown as GridState)

  const displayRows = computed<DisplayRow<T>[]>(() => {
    // When grouping is active, the group engine produces the flat group/data
    // stream itself — including nested group headers and collapsed subtrees.
    if (state.groupColumns.value.length > 0) {
      return groupEngine.groupData(paginatedData.value)
    }
    const isInfiniteScroll = state.loadingStrategy.value === 'infinite-scroll'
    const data = paginatedData.value
    const rows: DisplayRow<T>[] = new Array(data.length)
    for (let i = 0; i < data.length; i++) {
      const globalIndex = isInfiniteScroll
        ? i
        : state.pageIndex.value * state.pageSize.value + i
      rows[i] = { type: 'data', data: data[i]!, index: globalIndex, depth: 0 }
    }
    return rows
  })

  const computedTotalItems = computed<number>(() => {
    if (state.mode.value === 'server') return state.totalItems.value
    return filteredData.value.length
  })

  function displayIndexToSourceIndex(displayIndex: number): number {
    const rows = displayRows.value
    const row = rows.find((r) => r.type === 'data' && r.index === displayIndex)
    if (!row || row.type !== 'data') return -1
    return state.sourceData.value.indexOf(row.data)
  }

  return {
    sortedData,
    filteredData,
    paginatedData,
    displayRows,
    computedTotalItems,
    sort: sortEngine,
    filter: filterEngine,
    pagination: paginationEngine,
    columnResize: columnResizeEngine,
    rowSelection: rowSelectionEngine,
    rowExpansion: rowExpansionEngine,
    columnReorder: columnReorderEngine,
    columnDrag: columnDragEngine,
    horizontalVirtualScroll: horizontalVirtualScrollEngine,
    clipboard: clipboardEngine,
    history: historyEngine,
    cellValidation: cellValidationEngine,
    inlineEdit: inlineEditEngine,
    keyboard: keyboardEngine,
    cellSelection: cellSelectionEngine,
    group: groupEngine,
    tree: treeEngine,
    export: exportEngine,
    statePersistence: statePersistenceEngine,
    formula: formulaEngine,
    displayIndexToSourceIndex,
  }
}
