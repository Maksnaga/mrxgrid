/**
 * Central grid state — Angular parity (ad-grid / `GridStateManager`).
 *
 * Each `<ad-grid-vue>` instance creates one `GridState` via `useGridState()` and
 * provides it under `GRID_STATE_KEY`. Feature composables read/write through
 * the returned refs/computeds. Names match Angular 1-for-1: when in doubt,
 * read `projects/mozaic-ng/src/lib/grid/state/grid-state.ts` side-by-side.
 *
 * Phase 1 scope: the full surface area is in place, but the legacy
 * composables still own their local state. Phase 2+ flip each feature to
 * read/write here instead.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'

import type {
  CellEditorType,
  ColumnFreezeEvent,
  ColumnReorderEvent,
  ColumnResizeEvent,
  ColumnSearchToggleEvent,
  ColumnStateEntry,
  ColumnVisibilityEvent,
  HeaderMenuActionId,
  HeaderMenuConfig,
  PinnedSide,
} from '../models/column.model'
import type { CellCoord, CellEditState } from '../models/cell.model'
import type { FilterMode, FilterModel } from '../models/filter.model'
import type { LoadingStrategy } from '../models/pagination.model'
import type { GridDensity } from '../models/grid-events.model'
import type { GroupEntry } from '../models/grid-events.model'
import type { SortDef } from '../models/sort.model'
import type { ColumnDef, RowData } from '../types'
import { DEFAULT_COLUMN_WIDTH, DEFAULT_PAGE_SIZE, DEFAULT_ROW_HEIGHT } from './defaults'

// Re-exported for back-compat — new code should import from './GridContext' directly.
export { GRID_STATE_KEY, useGridContext as injectGridState } from './GridContext'

/** Shape returned by `useGridState()` — mirrors `GridStateManager` (Angular). */
export interface GridState<T = RowData> {
  // --- Source data ---
  readonly sourceData: Ref<T[]>
  readonly totalItems: Ref<number>
  /**
   * Manual reactivity trigger for in-place row mutations.
   *
   * Bumped by the grid after every mutation that writes directly into an
   * existing row object (`row.field = value`) rather than replacing the
   * whole array. Affected operations: cell edit commit (`applyFills`),
   * fill-handle drag, bulk clear, paste.
   *
   * **Why this exists:** Vue's `computed` only tracks reactive reads that
   * actually occur during its execution. When `filteredRows` short-circuits
   * on "no active filter" it returns `props.rows` without iterating over
   * individual row properties — so mutations on those properties are
   * invisible to the computed's dependency tracker. Reading `dataVersion`
   * once at the top of the computed gives Vue a concrete dep to invalidate
   * every time a row is mutated in place, forcing the entire
   * filter → sort → group pipeline to recompute.
   *
   * **Why not Option A (immutable updates)?** Replacing a single row inside
   * a 100k-row array is O(N) — `[...data.slice(0,i), newRow, ...data.slice(i+1)]`
   * on every keystroke would be prohibitive. The in-place mutation + version
   * bump pattern keeps edits O(1) while still driving reactivity correctly.
   *
   * **Why not `triggerRef` / `shallowRef`?** `triggerRef` requires touching
   * `sourceData` which creates the same allocation problem. A plain counter
   * costs a single integer read and is trivially serialisable.
   *
   * **Internal API.** Consumers should generally prefer assigning a new
   * array to `sourceData` (immutable update) which triggers reactivity
   * automatically and does not require knowing about this counter. Only
   * direct in-place mutations — those that bypass `sourceData` assignment —
   * need to bump this after the fact.
   */
  readonly dataVersion: Ref<number>

  // --- Mode ---
  readonly mode: Ref<'client' | 'server'>
  readonly loadingStrategy: Ref<LoadingStrategy>

  // --- Columns ---
  readonly columnDefs: Ref<ColumnDef<T>[]>
  readonly columnStates: Ref<ColumnStateEntry[]>

  // --- Sort ---
  readonly activeSorts: Ref<SortDef[]>

  // --- Group ---
  readonly groupColumns: Ref<GroupEntry[]>
  readonly expandedGroups: Ref<Set<string>>
  /**
   * Grouping evaluation mode — `'client'` (default) runs the in-memory
   * `GroupEngine`, `'server'` routes group summaries + per-group row pages
   * through `ServerGroupEngine` (`useServerGroupEngine`). Decoupled from the
   * grid-level `mode` so server pagination and client grouping can coexist
   * when the consumer wants a per-page client grouping on top of paginated
   * server data.
   */
  readonly groupMode: Ref<'client' | 'server'>

  // --- Filter ---
  readonly filterModel: Ref<FilterModel>
  /**
   * Filter evaluation mode, decoupled from the grid-level `mode`. Default `'client'`.
   * `Grid.vue` derives it from the `filterMode` prop (falling back to `serverFilter`).
   */
  readonly filterMode: Ref<FilterMode>

  // --- Pagination ---
  readonly pageIndex: Ref<number>
  readonly pageSize: Ref<number>
  readonly visibleRowCount: Ref<number>
  /**
   * Vue-specific: whether the pagination pipe step is active. Angular always
   * slices when `loadingStrategy === 'pagination'`; Vue allows the grid to
   * render without pagination entirely (`pagination: false`), so we need a
   * second knob. Defaults to `true`.
   */
  readonly paginationEnabled: Ref<boolean>

  // --- Scroll ---
  readonly scrollLeft: Ref<number>
  readonly scrollTop: Ref<number>
  readonly scrollViewportWidth: Ref<number>
  readonly scrollViewportHeight: Ref<number>
  readonly scrollContentTotalWidth: Ref<number>

  // --- Horizontal virtual scroll ---
  readonly horizontalVirtualScrollEnabled: Ref<boolean>
  readonly visibleColumnRange: Ref<{ start: number; end: number }>

  // --- UI ---
  readonly isLoading: Ref<boolean>
  readonly rowHeight: Ref<number>
  readonly density: Ref<GridDensity>

  // --- Row selection ---
  readonly selectedRowIds: Ref<Set<unknown>>
  readonly excludedRowIds: Ref<Set<unknown>>
  readonly selectAllMode: Ref<'none' | 'page' | 'all'>

  // --- Cell selection ---
  readonly focusedCell: Ref<CellCoord | null>
  readonly selectedCell: Ref<CellCoord | null>
  readonly cellRange: Ref<{ start: CellCoord; end: CellCoord } | null>
  readonly isDragging: Ref<boolean>
  readonly focusSource: Ref<'click' | 'keyboard' | null>

  // --- Fill handle ---
  readonly isFilling: Ref<boolean>
  readonly fillAnchor: Ref<CellCoord | null>
  readonly fillTarget: Ref<CellCoord | null>

  // --- Cut (Ctrl+X) — marching-ants source ---
  readonly cutSource: Ref<{ start: CellCoord; end: CellCoord } | null>

  // --- Expandable rows ---
  readonly expandedRowIds: Ref<Set<unknown>>
  readonly rowIdField: Ref<string>
  /**
   * Quick / per-column filters from the inline filter row. Independent
   * from the formal multi-condition `filterModel` written by the filter
   * drawer + "filter in this column" overlay. Both surfaces compose
   * (AND) when `filterData` evaluates a row, but neither overwrites the
   * other on apply.
   *
   * Shape: `{ [field]: value }` where value is the raw input (string for
   * text, value for select, `{from, to}` for date ranges, etc.).
   */
  readonly quickFilters: Ref<Record<string, unknown>>
  /**
   * Resolves the stable row id from a row + its index in `sourceData`. Used
   * by the formula engine and any downstream feature that needs row ids
   * without assuming a specific field name. Default reads `row[rowIdField]`,
   * but `Grid` overrides this with the user-supplied `rowId` function
   * prop so grids whose row data has no `id` field still work end-to-end.
   */
  readonly rowIdResolver: Ref<
    (row: Record<string, unknown>, index: number) => string | number | undefined
  >

  // --- Selection mode (rows XOR cells) ---
  readonly activeSelectionMode: Ref<'rows' | 'cells' | 'none'>

  // --- Column drag ---
  readonly draggingColumn: Ref<string | null>
  readonly dropIndicatorIndex: Ref<number | null>

  // --- Formula bar edit mode (drives A1 column-letter badges in headers) ---
  readonly formulaBarEditingActive: Ref<boolean>

  /**
   * `performance.now()` timestamp of the last column-resize mouseup.
   * Written by `useColumnResizeEngine` (engine layer). Sub-components
   * (notably `AdGridHeaderCell`) read this to suppress the synthetic
   * click-after-mouseup that would otherwise trigger a spurious sort
   * within ~200 ms of a resize.  Exposed on `GridState` so it is
   * injectable via `useGridContext()` without requiring the full engine.
   * Initialized to `0` (no resize ever happened).
   */
  readonly lastResizeEndedAt: Ref<number>

  // --- Cell edit ---
  readonly cellEditState: Ref<CellEditState>

  // --- Computed: visible / pinned column subsets ---
  readonly visibleColumns: ComputedRef<ColumnStateEntry[]>
  readonly pinnedLeftColumns: ComputedRef<ColumnStateEntry[]>
  readonly unpinnedColumns: ComputedRef<ColumnStateEntry[]>
  readonly pinnedRightColumns: ComputedRef<ColumnStateEntry[]>
  readonly pinnedLeftWidth: ComputedRef<number>
  readonly pinnedRightWidth: ComputedRef<number>
  readonly unpinnedWidth: ComputedRef<number>

  // --- Computed: horizontal virtual scroll helpers ---
  readonly effectiveColumnRange: ComputedRef<{ start: number; end: number }>
  readonly renderedUnpinnedColumns: ComputedRef<ColumnStateEntry[]>
  readonly leadingColumnSpacer: ComputedRef<number>
  readonly trailingColumnSpacer: ComputedRef<number>

  // --- Computed: lookups / layout ---
  readonly columnDefMap: ComputedRef<Map<string, ColumnDef<T>>>
  readonly gridTemplateColumns: ComputedRef<string>
  readonly totalContentWidth: ComputedRef<number>
  readonly totalPages: ComputedRef<number>
  readonly hasMore: ComputedRef<boolean>
  readonly hasFormulaColumns: ComputedRef<boolean>

  // --- Methods ---
  initColumns(defs: ColumnDef<T>[]): void
  updateColumnState(field: string, updates: Partial<ColumnStateEntry>): void
}

/** Create a fresh grid state. Call once per `<ad-grid-vue>` instance. */
export function useGridState<T = RowData>(): GridState<T> {
  // --- Source data ---
  const sourceData = ref([]) as Ref<T[]>
  const totalItems = ref(0)
  // Manual reactivity trigger for in-place row mutations.
  // See the comment on `GridState.dataVersion` for the full rationale.
  const dataVersion = ref(0)

  // --- Mode ---
  const mode = ref<'client' | 'server'>('client')
  const loadingStrategy = ref<LoadingStrategy>('pagination')

  // --- Columns ---
  const columnDefs = ref([]) as Ref<ColumnDef<T>[]>
  const columnStates = ref<ColumnStateEntry[]>([])

  // --- Sort ---
  const activeSorts = ref<SortDef[]>([])

  // --- Group ---
  const groupColumns = ref<GroupEntry[]>([])
  const expandedGroups = ref<Set<string>>(new Set())
  const groupMode = ref<'client' | 'server'>('client')

  // --- Filter ---
  const filterModel = ref<FilterModel>({ conditions: [] })
  const filterMode = ref<FilterMode>('client')

  // --- Pagination ---
  const pageIndex = ref(0)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const visibleRowCount = ref(0)
  const paginationEnabled = ref(true)

  // --- Scroll ---
  const scrollLeft = ref(0)
  const scrollTop = ref(0)
  const scrollViewportWidth = ref(0)
  const scrollViewportHeight = ref(0)
  const scrollContentTotalWidth = ref(0)

  // --- Horizontal virtual scroll ---
  // Default ON: column virtualization is always-on for the consumer
  // (no input gate). Internal code (e.g. column-drag) may toggle this
  // off transiently to avoid clipping the drag preview.
  const horizontalVirtualScrollEnabled = ref(true)
  const visibleColumnRange = ref<{ start: number; end: number }>({ start: 0, end: 0 })

  // --- UI ---
  const isLoading = ref(false)
  const rowHeight = ref(DEFAULT_ROW_HEIGHT)
  const density = ref<GridDensity>('default')

  // --- Row selection ---
  const selectedRowIds = ref<Set<unknown>>(new Set())
  const excludedRowIds = ref<Set<unknown>>(new Set())
  const selectAllMode = ref<'none' | 'page' | 'all'>('none')

  // --- Cell selection ---
  const focusedCell = ref<CellCoord | null>(null)
  const selectedCell = ref<CellCoord | null>(null)
  const cellRange = ref<{ start: CellCoord; end: CellCoord } | null>(null)
  const isDragging = ref(false)
  const focusSource = ref<'click' | 'keyboard' | null>(null)

  // --- Fill handle ---
  const isFilling = ref(false)
  const fillAnchor = ref<CellCoord | null>(null)
  const fillTarget = ref<CellCoord | null>(null)

  // --- Cut source ---
  const cutSource = ref<{ start: CellCoord; end: CellCoord } | null>(null)

  // --- Expandable rows ---
  const expandedRowIds = ref<Set<unknown>>(new Set())
  const rowIdField = ref('id')
  const quickFilters = ref<Record<string, unknown>>({})
  const rowIdResolver = ref<
    (row: Record<string, unknown>, index: number) => string | number | undefined
  >((row, _index) => row[rowIdField.value] as string | number | undefined)

  // --- Selection mode mutex ---
  const activeSelectionMode = ref<'rows' | 'cells' | 'none'>('none')

  // --- Column drag ---
  const draggingColumn = ref<string | null>(null)
  const dropIndicatorIndex = ref<number | null>(null)

  // --- Column-resize timestamp (read by AdGridHeaderCell sort guard) ---
  const lastResizeEndedAt = ref(0)

  // --- Formula bar edit mode ---
  const formulaBarEditingActive = ref(false)

  // --- Cell edit ---
  const cellEditState = ref<CellEditState>({
    editingCell: null,
    originalValue: undefined,
    draftValue: undefined,
    validationError: null,
  })

  // --- Computed: visible columns (pinned-start | unpinned | pinned-end, by order) ---
  const visibleColumns = computed<ColumnStateEntry[]>(() => {
    const cols = columnStates.value
      .filter((col) => col.visible)
      .sort((a, b) => a.order - b.order)
    const pinnedLeft = cols.filter((c) => c.pinned === 'start')
    const unpinned = cols.filter((c) => !c.pinned)
    const pinnedRight = cols.filter((c) => c.pinned === 'end')
    return [...pinnedLeft, ...unpinned, ...pinnedRight]
  })

  const pinnedLeftColumns = computed<ColumnStateEntry[]>(() =>
    visibleColumns.value.filter((c) => c.pinned === 'start'),
  )
  const unpinnedColumns = computed<ColumnStateEntry[]>(() =>
    visibleColumns.value.filter((c) => !c.pinned),
  )
  const pinnedRightColumns = computed<ColumnStateEntry[]>(() =>
    visibleColumns.value.filter((c) => c.pinned === 'end'),
  )

  const pinnedLeftWidth = computed<number>(() =>
    pinnedLeftColumns.value.reduce((sum, c) => sum + c.currentWidth, 0),
  )
  const pinnedRightWidth = computed<number>(() =>
    pinnedRightColumns.value.reduce((sum, c) => sum + c.currentWidth, 0),
  )
  const unpinnedWidth = computed<number>(() =>
    unpinnedColumns.value.reduce((sum, c) => sum + c.currentWidth, 0),
  )

  /**
   * Column range widened to always include the cell being edited, so the
   * editor stays mounted while it scrolls out of the visible window.
   */
  const effectiveColumnRange = computed<{ start: number; end: number }>(() => {
    const raw = visibleColumnRange.value
    const editing = cellEditState.value.editingCell
    if (!editing) return raw
    const pinnedLeftCount = pinnedLeftColumns.value.length
    const unpinnedIdx = editing.col - pinnedLeftCount
    const total = unpinnedColumns.value.length
    if (unpinnedIdx < 0 || unpinnedIdx >= total) return raw
    return {
      start: Math.min(raw.start, unpinnedIdx),
      end: Math.max(raw.end, unpinnedIdx + 1),
    }
  })

  const renderedUnpinnedColumns = computed<ColumnStateEntry[]>(() => {
    const all = unpinnedColumns.value
    if (!horizontalVirtualScrollEnabled.value) return all
    const { start, end } = effectiveColumnRange.value
    if (end <= start || end > all.length) return all
    return all.slice(start, end)
  })

  const leadingColumnSpacer = computed<number>(() => {
    if (!horizontalVirtualScrollEnabled.value) return 0
    const start = effectiveColumnRange.value.start
    const cols = unpinnedColumns.value
    let w = 0
    for (let i = 0; i < start && i < cols.length; i++) w += cols[i]!.currentWidth
    return w
  })

  const trailingColumnSpacer = computed<number>(() => {
    if (!horizontalVirtualScrollEnabled.value) return 0
    const end = effectiveColumnRange.value.end
    const cols = unpinnedColumns.value
    let w = 0
    for (let i = end; i < cols.length; i++) w += cols[i]!.currentWidth
    return w
  })

  const columnDefMap = computed<Map<string, ColumnDef<T>>>(() => {
    const map = new Map<string, ColumnDef<T>>()
    for (const def of columnDefs.value) {
      map.set(def.field, def)
    }
    return map
  })

  const gridTemplateColumns = computed<string>(() =>
    visibleColumns.value.map((col) => `${col.currentWidth}px`).join(' '),
  )

  const totalContentWidth = computed<number>(() =>
    visibleColumns.value.reduce((sum, col) => sum + col.currentWidth, 0),
  )

  const totalPages = computed<number>(() => {
    const total = mode.value === 'server' ? totalItems.value : sourceData.value.length
    return Math.max(1, Math.ceil(total / pageSize.value))
  })

  const hasMore = computed<boolean>(() => sourceData.value.length < totalItems.value)

  const hasFormulaColumns = computed<boolean>(() =>
    columnDefs.value.some((d) => d.allowFormula === true),
  )

  // --- Methods ---

  function initColumns(defs: ColumnDef<T>[]): void {
    columnDefs.value = [...defs]
    columnStates.value = defs.map((def, index) => ({
      field: def.field,
      currentWidth: resolveWidth(def),
      order: index,
      visible: def.visible !== false,
      sort: null,
      sortIndex: null,
      pinned: normalizePinned(def.pinned),
      searchVisible: def.searchVisible ?? false,
    }))
  }

  function updateColumnState(field: string, updates: Partial<ColumnStateEntry>): void {
    columnStates.value = columnStates.value.map((state) =>
      state.field === field ? { ...state, ...updates } : state,
    )
  }

  return {
    sourceData,
    dataVersion,
    totalItems,
    mode,
    loadingStrategy,
    columnDefs,
    columnStates,
    activeSorts,
    groupColumns,
    expandedGroups,
    groupMode,
    filterModel,
    filterMode,
    pageIndex,
    pageSize,
    visibleRowCount,
    paginationEnabled,
    scrollLeft,
    scrollTop,
    scrollViewportWidth,
    scrollViewportHeight,
    scrollContentTotalWidth,
    horizontalVirtualScrollEnabled,
    visibleColumnRange,
    isLoading,
    rowHeight,
    density,
    selectedRowIds,
    excludedRowIds,
    selectAllMode,
    focusedCell,
    selectedCell,
    cellRange,
    isDragging,
    focusSource,
    isFilling,
    fillAnchor,
    fillTarget,
    cutSource,
    expandedRowIds,
    rowIdField,
    rowIdResolver,
    quickFilters,
    activeSelectionMode,
    draggingColumn,
    dropIndicatorIndex,
    lastResizeEndedAt,
    formulaBarEditingActive,
    cellEditState,
    visibleColumns,
    pinnedLeftColumns,
    unpinnedColumns,
    pinnedRightColumns,
    pinnedLeftWidth,
    pinnedRightWidth,
    unpinnedWidth,
    effectiveColumnRange,
    renderedUnpinnedColumns,
    leadingColumnSpacer,
    trailingColumnSpacer,
    columnDefMap,
    gridTemplateColumns,
    totalContentWidth,
    totalPages,
    hasMore,
    hasFormulaColumns,
    initColumns,
    updateColumnState,
  }
}

function resolveWidth<T>(def: ColumnDef<T>): number {
  if (def.width) {
    const n = parseInt(def.width, 10)
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_COLUMN_WIDTH
  }
  return DEFAULT_COLUMN_WIDTH
}

/** Normalize legacy `'left' | 'right'` into Angular-parity `'start' | 'end'`. */
function normalizePinned(
  pinned: 'start' | 'end' | 'left' | 'right' | null | undefined,
): PinnedSide | null {
  if (pinned === 'left' || pinned === 'start') return 'start'
  if (pinned === 'right' || pinned === 'end') return 'end'
  return null
}

// Re-export helper types referenced by the interface above so deep consumers
// don't have to chase them across files.
export type {
  CellEditorType,
  ColumnFreezeEvent,
  ColumnReorderEvent,
  ColumnResizeEvent,
  ColumnSearchToggleEvent,
  ColumnVisibilityEvent,
  HeaderMenuActionId,
  HeaderMenuConfig,
}
