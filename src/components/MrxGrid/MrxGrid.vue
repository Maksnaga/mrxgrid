<script setup lang="ts">
import {
  computed,
  getCurrentInstance,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  useSlots,
  watch,
} from 'vue'
import type {
  CellFlags,
  ColumnDef,
  ColumnMenuAction,
  FillEvent,
  PaginationConfig,
  RowData,
  ServerGroupingOptions,
} from './types'
import type { SelectionModel } from '@/composables/useRowSelection'
import type { DataDensity } from './components/overlays/MrxTableMenuDrawer.vue'
import { isGroupRow } from './types'
import { useRowSelection } from '@/composables/useRowSelection'
import { useRowExpansion } from '@/composables/useRowExpansion'
import { useColumnResize } from '@/composables/useColumnResize'
import { useAutosize } from '@/composables/useAutosize'
import { useVirtualGrid } from '@/composables/useVirtualGrid'
import { usePinnedColumns } from '@/composables/usePinnedColumns'
import { useActiveCell } from '@/composables/useActiveCell'
import { useColumns } from '@/composables/useColumns'
import { useGrouping } from '@/composables/useGrouping'
import { useServerGrouping } from '@/composables/useServerGrouping'
import { useCellEditing } from '@/composables/useCellEditing'
import type { CellEditEvent } from '@/composables/useCellEditing'
import { useCellSelection } from '@/composables/useCellSelection'
import { useKeyboard } from '@/composables/useKeyboard'
import { useFillHandle } from '@/composables/useFillHandle'
import { useColumnDnD } from '@/composables/useColumnDnD'
import { useClipboard } from '@/composables/useClipboard'
import { useMouseSelection } from '@/composables/useMouseSelection'
import { usePagination } from '@/composables/usePagination'
import { useFiltering } from '@/composables/useFiltering'

import { GRID_STATE_KEY, useGridState } from './state/useGridState'
import {
  MRX_COLUMN_REGISTRY_KEY,
  type MrxColumnRegistration,
  type MrxColumnRegistry,
} from './state/MrxColumnRegistry'
import { MRX_GRID_SLOTS_KEY, type MrxGridSlotsContext } from './state/MrxGridSlots'
import { useGridEngine } from './engine/useGridEngine'
import { useRefHighlight } from './features/formula/useRefHighlight'
import { columnIndexToLetters } from './features/formula/formula-ast'
import { a1ToLongForm, longFormToA1 } from './features/formula/formula-ref-mapper'
import { extractEditorRefTokens, tokenizeFormulaEditor } from './features/formula/formula-tokenizer'
import type { GridDensity } from './models/grid-events.model'

import MrxGridHeader from './components/header/MrxGridHeader.vue'
import MrxGridSpreadsheetHeader from './components/header/MrxGridSpreadsheetHeader.vue'
import MrxGridFilterRow from './components/header/MrxGridFilterRow.vue'
import MrxGridFooter from './components/footer/MrxGridFooter.vue'
import MrxGridBody from './components/body/MrxGridBody.vue'
import MrxGridEmptyState from './components/body/MrxGridEmptyState.vue'
import MrxGridTagBar from './components/header/MrxGridTagBar.vue'
import MrxGridSelectionBar from './components/overlays/MrxGridSelectionBar.vue'
import { OPERATOR_LABELS, VALUELESS_OPERATORS, RANGE_OPERATORS } from './models/filter.model'
import type { FilterCondition } from './models/filter.model'

const UTILITY_COL_WIDTH = 50

/** Row heights per density — must match CSS padding in the scoped styles. */
const DENSITY_ROW_HEIGHT: Record<DataDensity, number> = {
  compact: 32,
  default: 48,
  comfortable: 64,
}

const props = withDefaults(
  defineProps<{
    /**
     * Imperative column list. Optional when using the declarative
     * `<MrxColumn>` children API (Phase 3.2). When both are provided the
     * registered columns override the prop on matching `field`.
     */
    columns?: ColumnDef[]
    rows: RowData[]
    selectable?: boolean
    /**
     * Compact selection bar — drop the count, close (X) and "Select all N"
     * link from the floating bar so it only renders the action buttons
     * (Edit / Copy / Paste / Delete / consumer #actions). Use this when the
     * host already surfaces the selection summary in its own toolbar.
     */
    selectionBarCompact?: boolean
    expandable?: boolean
    /**
     * Function to extract a unique string ID from a row.
     * Defaults to using the row index as string.
     */
    rowId?: (row: RowData, index: number) => string
    /** Enable vertical virtual scrolling for large row counts. */
    virtualScroll?: boolean
    /** Enable horizontal virtual scrolling for many columns. */
    virtualColumns?: boolean
    /** Visible viewport height in px when virtualScroll is enabled. Default 600. */
    containerHeight?: number
    /** Rows rendered above/below viewport as buffer. Default 5. */
    overscan?: number
    /** Columns rendered left/right of viewport as buffer. Default 2. */
    columnOverscan?: number
    /** Called when the visible row range changes. Use to trigger lazy data fetching. */
    onVisibleRangeChange?: (start: number, end: number) => void
    /**
     * Total number of rows in the full dataset (including unloaded).
     * Required when using lazy loading to prevent scroll jumps.
     * When provided, scrollbar height = totalCount × rowHeight regardless
     * of how many rows are actually loaded in the rows array.
     */
    totalCount?: number
    /** Fields to hide (synced from settings drawer). */
    hiddenFields?: string[]
    /** Group fields (synced from grouping drawer). */
    groupFields?: string[]
    /** Data density ('compact' | 'default' | 'comfortable'). */
    density?: DataDensity
    /** When true the grid covers the entire viewport. */
    fullscreen?: boolean
    /** External column display order (field names). Synced to internal useColumns. */
    columnOrder?: string[]
    /**
     * Server-side grouping configuration for lazy/async data sources.
     * When provided and grouping is active, group summaries and group rows
     * are fetched from the server instead of computed client-side.
     */
    /**
     * When true, filtering is delegated to the server.
     * The grid still shows filter UI and emits `filterChange` events,
     * but does NOT filter rows client-side. The consumer must react to
     * `filterChange`, update `totalCount`, invalidate the data source,
     * and pass the filtered rows back via `:rows`.
     */
    serverFilter?: boolean
    serverGrouping?: ServerGroupingOptions
    /**
     * Enable pagination with virtual scroll.
     * Pass `true` for defaults or a PaginationConfig for custom page sizes.
     */
    pagination?: boolean | PaginationConfig
    /**
     * When true, shows the loading overlay (slot `#loading` or default
     * indicator). The grid keeps rendering existing rows underneath so the
     * user keeps context during refetches.
     */
    loading?: boolean
    /**
     * Optional error to surface — drives the `#error` slot. Pass `null` to
     * clear. The grid emits `retry` when the consumer wires the slot's
     * retry callback.
     */
    error?: Error | null
    /**
     * When set, the grid auto-saves column layout (width / order /
     * visibility / pin) + active sorts + filter conditions to
     * `localStorage.<persistKey>` on every change, and auto-restores from
     * that key on first mount. Use a stable string per consumer view —
     * don't share it across grids that show different data.
     */
    persistKey?: string
    /**
     * Optional history attachment id. When set, the undo/redo stacks are
     * mirrored to `localStorage` under `mrx-grid-history:<historyId>` so
     * undo/redo survive a reload.
     */
    historyId?: string
    /**
     * Plugin list (§9.3). Each plugin's `init({ state, engine })` runs once
     * on mount; its return value (if any) is called on unmount as cleanup.
     * Use plugins for cross-cutting behaviour the core grid doesn't ship.
     */
    plugins?: import('./models/plugin.model').MrxGridPlugin[]
    /**
     * Disable the FLIP slide animation when columns reorder during drag.
     * Mirrors AG Grid's `suppressColumnMoveAnimation`. Disable if you have
     * extreme column counts and notice frame drops.
     */
    suppressColumnMoveAnimation?: boolean
    /**
     * Height applied to `.mrx-grid-root` as inline CSS. Accepts any CSS
     * length (`'560px'`, `'80vh'`) or a number (interpreted as px).
     * Default `'auto'` — the grid grows to its content. Pass a fixed value
     * when embedding in a layout that doesn't constrain height itself.
     */
    height?: string | number
  }>(),
  {
    containerHeight: 600,
    overscan: 5,
    columnOverscan: 2,
    height: 'auto',
  },
)

const emit = defineEmits<{
  'update:selection': [model: SelectionModel]
  'update:hiddenFields': [fields: string[]]
  columnMenuAction: [action: ColumnMenuAction]
  cellEdit: [event: CellEditEvent]
  fill: [event: FillEvent]
  /** Emitted when the pagination page or page size changes. */
  pageChange: [range: { page: number; pageSize: number; startIndex: number; endIndex: number }]
  /** Emitted when filters change. Use with serverFilter to apply filters server-side. */
  filterChange: [filters: Record<string, unknown>]
  /** Emitted when the user clicks Delete in the action bar. Includes all cell clears to apply in one batch. */
  bulkDelete: [
    payload: {
      selection: SelectionModel
      fills: Array<{ rowIndex: number; field: string; oldValue: unknown }>
    },
  ]
  /** Emitted when the user clicks Edit in the floating action bar. The grid
   *  doesn't open any modal — it just signals intent. Consumers wire this to
   *  their own bulk-edit dialog / route. Payload describes the active mode
   *  (row or cell selection) so a single listener can branch on it. */
  selectionEdit: [
    payload:
      | { mode: 'row'; selection: SelectionModel }
      | { mode: 'cell'; ranges: ReadonlyArray<{ r1: number; r2: number; c1: number; c2: number }> },
  ]
  /** Emitted when the user clicks Retry from the `#error` slot. Wire to your refetch. */
  retry: []
}>()

// ---------------------------------------------------------------------------
// Central grid state + engine (Phase 1 — Angular parity).
// The legacy composables below still own their local state; in Phase 2+ each
// feature migrates to read/write through `gridState` instead. Until then
// this block only mirrors the props that are cheap to keep in sync so
// feature engines can start reading from state as they land.
// ---------------------------------------------------------------------------
const gridState = useGridState<RowData>()
const gridEngine = useGridEngine<RowData>(gridState)

// Install the row-id resolver before any feature watcher reads it. The
// formula engine in particular reads this on every `syncFromSource` to
// detect existing `=…` strings — without it, grids whose rows have no
// `id` field never register their formulas (regression seen on the
// stress demo where rows are shaped as `{col_0, col_1, …}`).
gridState.rowIdResolver.value = (row, index) => {
  if (props.rowId) return props.rowId(row as RowData, index)
  const r = row as Record<string, unknown>
  return (r[gridState.rowIdField.value] as string | number | undefined) ?? index
}

// Shared ref-highlight instance — one per grid. The activation watcher
// further down flips `isActive` on/off based on the current edit state.
const refHighlight = useRefHighlight()
// Field name of the column currently being dragged for reorder. Owned
// here (rather than inside `useColumnDnD`) so the slot context can
// reference it BEFORE the DnD composable is instantiated further down.
const movingField = ref<string | null>(null)
provide(GRID_STATE_KEY, gridState)

// --- Declarative column registry (<MrxColumn> children) ---
// Children call register/unregister on mount/dispose. The grid combines
// these with the imperative `:columns` prop in `mergedColumns` below.
const declarativeColumns = ref<Map<string, MrxColumnRegistration>>(new Map())
const columnRegistry: MrxColumnRegistry = {
  register(reg) {
    const next = new Map(declarativeColumns.value)
    next.set(reg.id, reg)
    declarativeColumns.value = next
  },
  unregister(id) {
    if (!declarativeColumns.value.has(id)) return
    const next = new Map(declarativeColumns.value)
    next.delete(id)
    declarativeColumns.value = next
  },
  list() {
    return [...declarativeColumns.value.values()].sort((a, b) => a.order - b.order)
  },
}
provide(MRX_COLUMN_REGISTRY_KEY, columnRegistry)

// --- Provide root slots (Phase 3.3) so deeply nested components can resolve
// `#cell-{field}` / `#header-{field}` / `#filter-{field}` / `#edit-{field}`
// without prop-drilling.
const _rootSlots = useSlots()
const _slotsContext: MrxGridSlotsContext = {
  get cell() {
    return _rootSlots.cell
  },
  get header() {
    return _rootSlots.header
  },
  get filter() {
    return _rootSlots.filter
  },
  get edit() {
    return _rootSlots.edit
  },
  get perField() {
    const out: Record<string, NonNullable<ReturnType<typeof useSlots>[string]>> = {}
    for (const name of Object.keys(_rootSlots)) {
      if (
        name.startsWith('cell-') ||
        name.startsWith('header-') ||
        name.startsWith('filter-') ||
        name.startsWith('edit-')
      ) {
        const slot = _rootSlots[name]
        if (slot) out[name] = slot
      }
    }
    return out
  },
  registry: columnRegistry,
  formula: gridEngine.formula,
  movingField,
  formulaActions: {
    cycleAbsoluteAtCursor,
    fieldOrder: () => gridState.visibleColumns.value.map((c) => c.field),
    colorFor: (key) => refHighlight.colorFor(key),
  },
  resolveRowId: (rowIndex) => {
    const r = renderableRows.value[rowIndex]
    if (!r || isGroupRow(r)) return undefined
    const originalIndex = Number(r.__mrxOriginalIndex ?? rowIndex)
    return resolveRowId(r, originalIndex)
  },
  refHighlight,
}
provide(MRX_GRID_SLOTS_KEY, _slotsContext)

// ─── Phase 6b — Ref-highlight activation hook ──────────────────────────
// One shared `useRefHighlight()` instance per grid. Activates whenever an
// edit starts on a formula-enabled column, deactivates on commit / cancel.
// While active, the draft value is tokenised every keystroke and the
// resulting refs become coloured highlights — cells render matching
// `--moz-grid-ref-color` borders by reading `colorByCell`.
//
// `formulaPickHandler` implements click-to-insert / drag-to-range behaviour :
// while pick mode is on (i.e. while editing a formula cell), every cell
// mousedown is intercepted and converted into a ref token inserted at the
// caret position of the live formula input. Drag extends the token into a
// range (`A1:B5`).

/** Track the anchor of an active range pick — set on `pickRangeStart`,
 *  read by `pickRangeExtend` to compute the rectangle. */
let pickAnchor: { row: number; col: number } | null = null
/** Length (in chars) of the most recently inserted ref token. Used so a
 *  drag-extend can REPLACE the just-inserted token with a wider `anchor:end`
 *  range instead of appending more text. */
let pickInsertLength = 0
/** Cursor offset (in the input value) at which the in-progress range
 *  token starts. */
let pickInsertOffset = 0

function refToA1(rowIndex0: number, colIndex0: number, absolute = false): string {
  const colLetters = columnIndexToLetters(colIndex0)
  const colPart = absolute ? `$${colLetters}` : colLetters
  const rowPart = absolute ? `$${rowIndex0 + 1}` : String(rowIndex0 + 1)
  return colPart + rowPart
}

type FormulaEditorEl = HTMLInputElement | HTMLDivElement

/** Find the live formula editor regardless of its underlying tag — either
 *  the contenteditable (`<div class="mrx-formula-editor">` for `allowFormula`
 *  cells) or the legacy plain `<input class="mrx-grid-cell__input">`. */
function getActiveFormulaEditor(): FormulaEditorEl | null {
  if (typeof document === 'undefined') return null
  return document.querySelector(
    '.mrx-grid-cell--editing .mrx-formula-editor, .mrx-grid-cell--editing .mrx-grid-cell__input',
  ) as FormulaEditorEl | null
}

function getEditorValue(el: FormulaEditorEl | null): string {
  if (!el) return ''
  if (el instanceof HTMLInputElement) return el.value
  return el.textContent ?? ''
}

/** Caret offset (in characters) of the active editor — works for both the
 *  plain input (`selectionStart`) and the contenteditable (Range API). */
function getEditorCaret(el: FormulaEditorEl | null): number {
  if (!el) return 0
  if (el instanceof HTMLInputElement) return el.selectionStart ?? el.value.length
  if (typeof window === 'undefined') return el.textContent?.length ?? 0
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return el.textContent?.length ?? 0
  const range = sel.getRangeAt(0)
  if (!el.contains(range.endContainer)) return el.textContent?.length ?? 0
  const pre = range.cloneRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.endContainer, range.endOffset)
  return pre.toString().length
}

function setEditorCaret(el: FormulaEditorEl | null, offset: number) {
  if (!el) return
  if (el instanceof HTMLInputElement) {
    try {
      el.setSelectionRange(offset, offset)
    } catch {
      /* ignored */
    }
    return
  }
  // contenteditable: walk text nodes until we reach `offset` chars.
  if (typeof window === 'undefined') return
  const range = document.createRange()
  let i = 0
  let placed = false
  function walk(node: Node) {
    if (placed) return
    if (node.nodeType === 3) {
      const len = node.nodeValue?.length ?? 0
      if (i + len >= offset) {
        range.setStart(node, Math.max(0, offset - i))
        range.collapse(true)
        placed = true
        return
      }
      i += len
    } else {
      for (const c of Array.from(node.childNodes)) walk(c)
    }
  }
  walk(el)
  if (!placed) {
    range.selectNodeContents(el)
    range.collapse(false)
  }
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

function applyDraftAndCursor(value: string, cursor: number) {
  gridState.cellEditState.value = {
    ...gridState.cellEditState.value,
    draftValue: value,
  }
  // Plain `<input>` doesn't react to `localEditValue` updates from prop
  // changes (it seeds only on edit start), so for that branch we still push
  // the new value via the live DOM. The contenteditable editor watches its
  // `modelValue` prop on its own — no DOM poke needed there.
  const el = getActiveFormulaEditor()
  if (el instanceof HTMLInputElement) {
    el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  nextTick(() => {
    const live = getActiveFormulaEditor()
    if (!live) return
    live.focus()
    setEditorCaret(live, cursor)
  })
}

/** Index lookup for a CellAddress → 0-based (rowIndex, colIndex) in the
 *  grid's CURRENT display order. Returns null when the address can't be
 *  resolved (row id no longer present, hidden column, …). */
function resolveAddrIndex(addr: {
  rowId: string | number
  field: string
}): { row: number; col: number } | null {
  const cols = gridState.visibleColumns.value
  const colIdx = cols.findIndex((c) => c.field === addr.field)
  if (colIdx < 0) return null
  const idField = gridState.rowIdField.value
  const data = gridState.sourceData.value
  const rowIdx = data.findIndex((r) => {
    const rid = (r as Record<string, unknown>)[idField]
    return rid !== undefined && String(rid) === String(addr.rowId)
  })
  if (rowIdx < 0) return null
  return { row: rowIdx, col: colIdx }
}

/** Re-encode an A1-style ref string at a given absoluteness — preserves the
 *  underlying letters / digits, just toggles `$`. Used by F4 to cycle the
 *  token under the caret through the four absolute modes. */
function rewriteRefAbsolute(refText: string, absField: boolean, absRow: boolean): string {
  const m = refText.match(/^\$?([A-Za-z]+)\$?(\d+)$/)
  if (!m) return refText
  const letters = m[1]
  const row = m[2]
  return (absField ? '$' : '') + letters + (absRow ? '$' : '') + row
}

function cycleAbsoluteAtCursor(caret: number | null) {
  const cur = (gridState.cellEditState.value.draftValue as string) ?? ''
  if (!cur.trimStart().startsWith('=')) return
  const fieldOrder = gridState.visibleColumns.value.map((c) => c.field)
  const tokens = tokenizeFormulaEditor(cur, { fieldOrder })
  // Find the ref token that contains (or sits just before) the caret. F4 in
  // Excel applies to the ref *containing* the cursor, falling back to the
  // ref immediately to the left when the cursor is right after it.
  const pos = caret ?? cur.length
  let target: (typeof tokens)[number] | null = null
  for (const t of tokens) {
    if (t.kind !== 'ref') continue
    if (pos >= t.start && pos <= t.end) {
      target = t
      break
    }
  }
  if (!target) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i]!
      if (t.kind === 'ref' && t.end <= pos) {
        target = t
        break
      }
    }
  }
  if (!target || target.kind !== 'ref' || !target.ref) return
  // Cycle: rel(0,0) → $A$1(1,1) → A$1(0,1) → $A1(1,0) → rel(0,0)
  const af = target.ref.absField
  const ar = target.ref.absRow
  const next =
    af && ar
      ? { absField: false, absRow: true }
      : !af && ar
        ? { absField: true, absRow: false }
        : af && !ar
          ? { absField: false, absRow: false }
          : { absField: true, absRow: true }
  const newText = rewriteRefAbsolute(target.text, next.absField, next.absRow)
  const value = cur.slice(0, target.start) + newText + cur.slice(target.end)
  applyDraftAndCursor(value, target.start + newText.length)
}

const formulaPickHandler = {
  pickCell(addr: { rowId: string | number; field: string }, opts: { absolute: boolean }) {
    const idx = resolveAddrIndex(addr)
    if (!idx) return
    const ref = refToA1(idx.row, idx.col, opts.absolute)
    const el = getActiveFormulaEditor()
    const cur = getEditorValue(el) || ((gridState.cellEditState.value.draftValue as string) ?? '')
    const start = getEditorCaret(el)
    const next = cur.slice(0, start) + ref + cur.slice(start)
    pickInsertOffset = start
    pickInsertLength = ref.length
    pickAnchor = null
    applyDraftAndCursor(next, start + ref.length)
  },
  pickRangeStart(addr: { rowId: string | number; field: string }, opts: { absolute: boolean }) {
    const idx = resolveAddrIndex(addr)
    if (!idx) return
    const ref = refToA1(idx.row, idx.col, opts.absolute)
    const el = getActiveFormulaEditor()
    const cur = getEditorValue(el) || ((gridState.cellEditState.value.draftValue as string) ?? '')
    const start = getEditorCaret(el)
    const next = cur.slice(0, start) + ref + cur.slice(start)
    pickInsertOffset = start
    pickInsertLength = ref.length
    pickAnchor = idx
    applyDraftAndCursor(next, start + ref.length)
  },
  pickRangeExtend(end: { rowId: string | number; field: string }) {
    const idx = resolveAddrIndex(end)
    if (!idx || !pickAnchor) return
    const startRef = refToA1(pickAnchor.row, pickAnchor.col)
    const endRef = refToA1(idx.row, idx.col)
    const range =
      pickAnchor.row === idx.row && pickAnchor.col === idx.col ? startRef : `${startRef}:${endRef}`
    const cur = (gridState.cellEditState.value.draftValue as string) ?? ''
    const before = cur.slice(0, pickInsertOffset)
    const after = cur.slice(pickInsertOffset + pickInsertLength)
    const next = before + range + after
    pickInsertLength = range.length
    applyDraftAndCursor(next, pickInsertOffset + range.length)
  },
  pickRangeCommit() {
    pickAnchor = null
    pickInsertLength = 0
    pickInsertOffset = 0
  },
}

/** Convert any formula source (`[field]` shorthand, A1, or already long-form)
 *  to the canonical A1 surface that the user expects to see in the editor.
 *  Same-row refs collapse to relative A1 tied to the host row (`=C5*D5`
 *  on row 5) so formulas read like Excel. Returns the input unchanged when
 *  conversion isn't applicable. */
function convertFormulaToA1Surface(source: string, displayRowIndex: number): string {
  if (!source.startsWith('=')) return source
  const fields = gridState.visibleColumns.value.map((c) => c.field)
  const idField = gridState.rowIdField.value
  const rendered = renderableRows.value
  // Walk the rendered rows in display order, skipping group rows so row
  // letters map to data rows only (matches AG-Grid behaviour).
  const rowIds: (string | number)[] = []
  let currentRowId: string | number | undefined
  for (let i = 0; i < rendered.length; i++) {
    const r = rendered[i]
    if (!r || isGroupRow(r)) continue
    const rid = (r as Record<string, unknown>)[idField] as string | number | undefined
    const id = rid ?? i
    rowIds.push(id)
    if (i === displayRowIndex) currentRowId = id
  }
  try {
    const longForm = a1ToLongForm(source, { fields, rowIds, currentRowId })
    return longFormToA1(longForm, { fields, rowIds, currentRowId })
  } catch {
    return source
  }
}

watch(
  () => gridState.cellEditState.value.editingCell,
  (editing) => {
    if (!editing) {
      refHighlight.deactivate()
      pickAnchor = null
      return
    }
    const field = gridState.visibleColumns.value[editing.col]?.field
    const def = field ? gridState.columnDefMap.value.get(field) : undefined
    if (def?.allowFormula) {
      refHighlight.activate(formulaPickHandler, { pickMode: true })
      // Translate the stored formula to A1 surface so the editor opens with
      // `=C5*D5` rather than the raw `=[qty]*[price]` storage form.
      const cur = gridState.cellEditState.value.draftValue
      if (typeof cur === 'string' && cur.startsWith('=')) {
        const a1 = convertFormulaToA1Surface(cur, editing.row)
        if (a1 !== cur) {
          gridState.cellEditState.value = {
            ...gridState.cellEditState.value,
            originalValue: a1,
            draftValue: a1,
          }
        }
      }
    } else refHighlight.deactivate()
  },
)

// Recompute highlights from the live draft whenever it changes during a
// formula edit. Builds a `RefHighlight[]` from `extractEditorRefTokens`
// against the current visible-column field order.
watch(
  () => gridState.cellEditState.value.draftValue,
  (raw) => {
    if (!refHighlight.isActive.value) return
    const text = typeof raw === 'string' ? raw : ''
    if (!text.trimStart().startsWith('=')) {
      refHighlight.setHighlights([])
      return
    }
    const fieldOrder = gridState.visibleColumns.value.map((c) => c.field)
    const tokens = tokenizeFormulaEditor(text, { fieldOrder })
    const refs = extractEditorRefTokens(tokens)
    const idField = gridState.rowIdField.value
    const sourceData = gridState.sourceData.value
    const highlights = refs.map((ref) => {
      const cells = ref.refs.map((r) => {
        const row = sourceData[r.row - 1]
        const rowId = row ? ((row as Record<string, unknown>)[idField] as string | number) : ''
        return { rowId, field: r.field }
      })
      const { index, cssVar } = refHighlight.colorFor(ref.text)
      return {
        key: ref.text,
        tokenStart: ref.start,
        tokenEnd: ref.end,
        cells,
        colorIndex: index,
        cssVar,
      }
    })
    refHighlight.setHighlights(highlights)
  },
)

/**
 * Merged column list: imperative `:columns` prop + declarative `<MrxColumn>`
 * registrations. Declarative wins on duplicate `field` (consumer expressed
 * slot intent more explicitly). Order: prop first, then any declarative
 * columns not already in the prop, in registration order.
 */
const mergedColumns = computed<ColumnDef[]>(() => {
  const propCols = props.columns ?? []
  const decls = columnRegistry.list()
  if (decls.length === 0) return propCols
  const declMap = new Map(decls.map((d) => [d.id, d.def]))
  const seen = new Set<string>()
  const out: ColumnDef[] = []
  for (const col of propCols) {
    seen.add(col.field)
    out.push(declMap.get(col.field) ?? col)
  }
  for (const decl of decls) {
    if (!seen.has(decl.id)) out.push(decl.def)
  }
  return out
})

/** Every column that can host a filter condition. Drives the field picker
 *  inside the per-column filter overlay so the user can re-target a
 *  condition row at any column from the same panel. Computed from the
 *  full `mergedColumns` (NOT from the virtualised header slice) so columns
 *  scrolled off-screen still appear in the dropdown. */
const filterableColumns = computed<ColumnDef[]>(() =>
  mergedColumns.value.filter((c) => c.filterable),
)

function mapDensityToGrid(d: DataDensity | undefined): GridDensity {
  if (d === 'compact') return 'small'
  if (d === 'comfortable') return 'large'
  return 'default'
}

// rows → sourceData
watch(
  () => props.rows,
  (rows) => {
    gridState.sourceData.value = rows
  },
  { immediate: true },
)

// Phase 6b — auto-sync formulas baked into the source data. When at least
// one column has `allowFormula: true`, the engine reconciles `=…` strings
// in the row values into registered formula cells. Idle when no column
// declares formulas (cheap allow-list check).
watch(
  [() => gridState.hasFormulaColumns.value, () => gridState.sourceData.value, mergedColumns],
  ([hasFormulas]) => {
    if (!hasFormulas) return
    const allowed = new Set<string>()
    for (const def of gridState.columnDefs.value) {
      if (def.allowFormula) allowed.add(def.field)
    }
    gridEngine.formula.syncFromSource((field) => allowed.has(field))
  },
  { immediate: true, deep: false },
)

// Re-parse formulas when visible columns change (reorder / hide affects
// A1 letter mapping). Cheap when no formulas are tracked.
watch(
  () => gridState.visibleColumns.value.map((c) => c.field).join('|'),
  () => {
    if (gridEngine.formula.hasAnyFormula.value) gridEngine.formula.rebuild()
  },
)

// columns → columnDefs + columnStates (via initColumns).
// Watches `mergedColumns` so declarative `<MrxColumn>` registrations
// also drive a re-init.
watch(
  mergedColumns,
  (cols) => {
    gridState.initColumns(cols)
  },
  { immediate: true },
)

// totalCount → totalItems (server mode / lazy loading)
watch(
  () => props.totalCount,
  (total) => {
    gridState.totalItems.value = total ?? props.rows.length
  },
  { immediate: true },
)

// density (legacy DataDensity) → Angular-parity GridDensity
watch(
  () => props.density,
  (d) => {
    gridState.density.value = mapDensityToGrid(d)
  },
  { immediate: true },
)

// loading prop → state.isLoading (drives top progress bar + `#loading` slot).
watch(
  () => props.loading,
  (l) => {
    gridState.isLoading.value = l === true
  },
  { immediate: true },
)

// Phase 1.0 — `persistKey`: auto-save view on column/sort/filter mutation,
// auto-restore on mount. Restore happens after `initColumns` so the saved
// per-field state lands on a freshly initialised columnStates array.
let _hasRestoredPersistedView = false
watch(
  () => props.persistKey,
  (key) => {
    if (!key || _hasRestoredPersistedView) return
    gridEngine.statePersistence.restore(key)
    _hasRestoredPersistedView = true
  },
  { immediate: true, flush: 'post' },
)
watch(
  [
    () => gridState.columnStates.value,
    () => gridState.activeSorts.value,
    () => gridState.filterModel.value,
  ],
  () => {
    if (!props.persistKey || !_hasRestoredPersistedView) return
    gridEngine.statePersistence.save(props.persistKey)
  },
  { deep: true },
)

// Phase 1.0 — history attach: mirror undo/redo stacks to localStorage when
// `historyId` is set. Detach on prop change.
watch(
  () => props.historyId,
  (id) => {
    gridEngine.history.attach(id ?? null)
  },
  { immediate: true },
)

// ──────────────────────────────────────────────────────────────────────
// Auto-apply edits to rows
// ──────────────────────────────────────────────────────────────────────
// As long as a column is marked `editable: true`, the grid writes the
// new value directly into the user's row object before emitting the
// matching event. Consumers still receive `@cell-edit` / `@fill` /
// `@bulk-delete` for tracking, history, or any side-effect they want —
// but they no longer have to mutate the row themselves for the grid to
// stay in sync. `props.rows[i]` is a reactive proxy under Vue 3 deep
// ref reactivity, so assigning a property triggers re-render via the
// consumer's reactive system without violating prop immutability
// (we mutate the object, never reassign the array).
function applyEditAt(rowIndex: number, field: string, value: unknown): void {
  // Prefer renderableRows because that's the index emit sites use.
  // Object references are shared with props.rows, so the mutation
  // propagates back to the consumer's source array automatically.
  const row = renderableRows.value[rowIndex]
  if (row && !isGroupRow(row) && !(row as Record<string, unknown>).__mrxSkeleton) {
    ;(row as Record<string, unknown>)[field] = value
  }
}

// History emits cellEdit on every reverted / replayed change. The
// engine's built-in `undo()` mutates `state.sourceData` via
// `clipboard.applyChanges`, but the render pipeline
// (`filteredRows` → `sortedRows` → `renderableRows`) reads `props.rows`,
// not `state.sourceData`. So the engine's mutation is functionally a
// no-op for the visible grid — what actually drives the revert is the
// `cellEdit` emit going to the consumer, who mutates their `rows` ref;
// Vue's per-cell reactivity then re-renders the affected cells.
const _origUndo = gridEngine.history.undo.bind(gridEngine.history)
const _origRedo = gridEngine.history.redo.bind(gridEngine.history)
gridEngine.history.undo = () => {
  console.log('[MrxGrid] history.undo() called')
  const op = _origUndo()
  console.log('[MrxGrid] _origUndo returned:', op)
  if (op) {
    // Reverting: c.after is the value currently on the row, c.before is
    // the revert target. Match the consumer's cellEdit signature so the
    // same handler that processes fresh edits also processes undos.
    for (const c of op.changes) {
      applyEditAt(c.rowIndex, c.field, c.before)
      emit('cellEdit', {
        rowIndex: c.rowIndex,
        field: c.field,
        oldValue: c.after,
        newValue: c.before,
      })
    }
  }
  return op
}
gridEngine.history.redo = () => {
  const op = _origRedo()
  if (op) {
    for (const c of op.changes) {
      applyEditAt(c.rowIndex, c.field, c.after)
      emit('cellEdit', {
        rowIndex: c.rowIndex,
        field: c.field,
        oldValue: c.before,
        newValue: c.after,
      })
    }
  }
  return op
}

// Phase 1.0 — cell validation: auto-run when rows or columns change AND at
// least one column declares `cellValidator`. Cheap allow-list check first.
const _hasValidators = computed(() =>
  mergedColumns.value.some((c) => typeof c.cellValidator === 'function'),
)
watch(
  [() => props.rows, mergedColumns, _hasValidators],
  ([rows, , hasV]) => {
    if (!hasV) {
      gridEngine.cellValidation.clearAll()
      return
    }
    gridEngine.cellValidation.validateAll(rows)
  },
  { immediate: true },
)

// Phase 1.0 — plugins (§9.3): run each plugin's `init({ state, engine })`
// once on mount; the returned cleanup (if any) runs on unmount. Plugins
// are not reactive — adding/removing requires a remount. Keep the prop
// stable per grid instance.
const _pluginCleanups: Array<() => void> = []
onMounted(() => {
  for (const p of props.plugins ?? []) {
    try {
      const cleanup = p.init({ state: gridState, engine: gridEngine })
      if (typeof cleanup === 'function') _pluginCleanups.push(cleanup)
    } catch (err) {
      console.error(`[mrxgrid] plugin "${p.name}" init failed:`, err)
    }
  }
})
onBeforeUnmount(() => {
  for (const c of _pluginCleanups) {
    try {
      c()
    } catch (err) {
      console.error('[mrxgrid] plugin cleanup failed:', err)
    }
  }
  _pluginCleanups.length = 0
})

// serverFilter prop → state.mode. Engines downstream (filter, sort, etc.)
// branch on this to know whether to run client-side evaluation or pass through.
watch(
  () => props.serverFilter ?? !!props.serverGrouping,
  (isServer) => {
    gridState.mode.value = isServer ? 'server' : 'client'
  },
  { immediate: true },
)

// --- Column state (visibility, pinning overrides) ---
// Phase 2.8 — `useColumns` is a thin adapter on `gridState.columnStates[]`.
// Visibility, pinning, order, and per-column search-visible all live in the
// state array; the legacy `Set<string>` / `Map<…>` mirrors are gone.
const {
  visibleColumns,
  hideColumn,
  showColumn,
  isHidden,
  pinColumn,
  unpinColumn,
  getPinning,
  toggleFilter,
  reorderColumn,
  columnOrder: columnOrderState,
} = useColumns(gridState)

/** Columns currently hidden — for the hidden-columns bar. */
const hiddenColumnsList = computed(() =>
  mergedColumns.value
    .filter((c) => isHidden(c.field))
    .map((c) => ({ field: c.field, headerName: c.headerName })),
)

function onShowColumn(field: string) {
  showColumn(field)
  emit(
    'update:hiddenFields',
    hiddenColumnsList.value.filter((c) => c.field !== field).map((c) => c.field),
  )
}

function showAllColumns() {
  for (const col of hiddenColumnsList.value) {
    showColumn(col.field)
  }
  emit('update:hiddenFields', [])
}

// --- Filtering (first stage — before sort/group) ---
// Phase 2.12 — `gridState.filterModel.conditions[]` is now the single source
// of truth. `useFiltering` is a thin adapter: `filters` is a derived
// `Record<field, value>` for `MrxGridFilterRow`; `setFilter` writes new
// conditions into the model. The mirror watch that converted Record → Conditions
// (~70 LOC) is gone, and `gridEngine.filter.filterData` reads the same
// conditions for row evaluation.
const {
  filters,
  hasActiveFilters,
  setFilter: rawSetFilter,
  clearFilters: rawClearFilters,
} = useFiltering(gridState, mergedColumns)

// When serverFilter is enabled, bypass client-side filtering — pass rows through.
// The filter UI still works: we emit filterChange so the consumer handles it.
const filteredRows = computed(() =>
  props.serverFilter ? props.rows : gridEngine.filter.filterData(props.rows),
)

function setFilter(field: string, value: unknown) {
  rawSetFilter(field, value)
  if (props.serverFilter) {
    // Emit after updating internal state so `filters` ref is current
    nextTick(() => emit('filterChange', { ...filters.value }))
  }
}

/** Clear EVERYTHING — both the filter row inputs (quick filters) and the
 *  drawer / per-column overlay model. Surfaces have separate state slots
 *  now, so a single `clearFilters` call needs to wipe both for the
 *  legacy "reset all" semantics consumers expect. */
function clearFilters() {
  rawClearFilters() // quick filters (filter row)
  gridEngine.filter.clearAll() // formal model (drawer + overlay)
  if (props.serverFilter) {
    nextTick(() => emit('filterChange', {}))
  }
}

/** Clear only the formal multi-condition model (drawer + per-column
 *  overlay). Used by the FILTERED BY tag-bar's "Remove all" since those
 *  chips only represent formal-model conditions. */
function clearFilterModel() {
  gridEngine.filter.clearAll()
  if (props.serverFilter) {
    nextTick(() => emit('filterChange', { ...filters.value }))
  }
}

// --- Tag-bar helpers (Sprint 3 — REFONTE-PLAN-V2 §2.3) ---
// Build the human-readable chips fed to the unified <MrxGridTagBar> for
// the FILTERED BY / GROUPED BY / HIDDEN COLUMNS bars. Filter labels reuse
// `OPERATOR_LABELS` so the chip stays in sync with the filter drawer wording.

function describeFilterCondition(c: FilterCondition): string {
  const col = mergedColumns.value.find((m) => m.field === c.field)
  const header = col?.headerName ?? c.field
  const op = OPERATOR_LABELS[c.operator] ?? c.operator
  if (VALUELESS_OPERATORS.has(c.operator)) return `${header} ${op}`
  const v = c.value?.value
  if (RANGE_OPERATORS.has(c.operator)) {
    const vTo = c.value?.valueTo
    return `${header} ${op} ${formatChipValue(v)} – ${formatChipValue(vTo)}`
  }
  return `${header} ${op} ${formatChipValue(v)}`
}

function formatChipValue(v: unknown): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

const activeFilterTags = computed(() =>
  gridState.filterModel.value.conditions.map((c) => ({
    id: c.id,
    label: describeFilterCondition(c),
  })),
)

function onRemoveFilter(conditionId: string) {
  const next = gridState.filterModel.value.conditions.filter((c) => c.id !== conditionId)
  gridState.filterModel.value = { conditions: next }
  if (props.serverFilter) {
    nextTick(() => emit('filterChange', { ...filters.value }))
  }
}

function onRemoveAllFilters() {
  clearFilterModel()
}

const groupTags = computed(() => groups.value.map((g) => ({ id: g.field, label: g.headerName })))

const hiddenTags = computed(() =>
  hiddenColumnsList.value.map((c) => ({ id: c.field, label: c.headerName })),
)

// --- Sorting (operates on filtered data) ---
// Phase 2.1 — `gridEngine.sort` (Angular parity) is the single source of truth.
// Reads/writes flow through `gridState.activeSorts`; column-state sort/sortIndex
// is kept in sync internally by the engine. The render pipeline stays
// filter → sort → paginate, so we apply `sortData` to `filteredRows` here.
const sortEngine = gridEngine.sort
const getSortDirection = sortEngine.getSortDirection
const getSortIndex = sortEngine.getSortIndex
const setSort = sortEngine.setSort
const sortedRows = computed(() => sortEngine.sortData(filteredRows.value))

// --- Pagination (BEFORE grouping — so grouping operates per page) ---
const paginationEnabled = computed(() => !!props.pagination)

const paginationConfig = computed(() => {
  if (typeof props.pagination === 'object') return props.pagination
  return {}
})

// Phase 2.5 — `usePagination` is now a thin facade over `gridState.pageIndex`
// (0-based) / `gridState.pageSize`. The footer keeps its 1-based `currentPage`
// shape via writable computeds inside the composable; the mirror watch is gone.
const paginationState = usePagination(gridState, {
  rows: sortedRows,
  pageSizeOptions: paginationConfig.value.pageSizeOptions,
  defaultPageSize: paginationConfig.value.defaultPageSize,
})

// Sync `paginationEnabled` and `loadingStrategy` flags into gridState (still
// derived from the `pagination` prop, not from the composable).
watch(
  paginationEnabled,
  (enabled) => {
    gridState.paginationEnabled.value = enabled
    gridState.loadingStrategy.value = 'pagination'
  },
  { immediate: true },
)

/**
 * Rows fed into the grouping composable.
 * When pagination is active, group only the current page.
 * Otherwise group the full sorted dataset.
 */
const preGroupRows = computed(() =>
  paginationEnabled.value ? paginationState.paginatedRows.value : sortedRows.value,
)

// --- Grouping (operates on paginated or full data) ---
// Phase 2.7 — `useGrouping` reads/writes `gridState.groupColumns` +
// `gridState.expandedGroups`. The legacy `RowData` output (with `__mrx*`
// metadata) is preserved for `MrxGridBody` / `MrxGridGroupRow`. Server-side
// grouping keeps its own state — different async lifecycle.
const {
  groups: clientGroups,
  hasGroups: clientHasGroups,
  flatRows: clientFlatRows,
  addGroup: clientAddGroup,
  removeGroup: clientRemoveGroup,
  clearGroups: clientClearGroups,
  toggleGroupExpand: clientToggleGroupExpand,
  isGroupExpanded: clientIsGroupExpanded,
} = useGrouping(gridState, mergedColumns, preGroupRows)

// --- Server-side grouping (for lazy/async data without pagination) ---
const serverGroupingRef = computed(() => props.serverGrouping)
const {
  active: serverGroupingActive_,
  groups: serverGroups,
  hasGroups: serverHasGroups,
  flatRows: serverFlatRows,
  addGroup: serverAddGroup,
  removeGroup: serverRemoveGroup,
  clearGroups: serverClearGroups,
  toggleGroupExpand: serverToggleGroupExpand,
  isGroupExpanded: serverIsGroupExpanded,
  onVisibleRangeChange: serverGroupVisibleRangeChange,
} = useServerGrouping(mergedColumns, serverGroupingRef)

// Server grouping is NOT used in pagination mode — pagination already slices
// the data, so client-side grouping on the page is correct and cheaper.
const serverGroupingActive = computed(() => serverGroupingActive_.value && !paginationEnabled.value)

// --- Unified grouping interface ---
const groups = computed(() =>
  serverGroupingActive.value ? serverGroups.value : clientGroups.value,
)
const hasGroups = computed(() =>
  serverGroupingActive.value ? serverHasGroups.value : clientHasGroups.value,
)
const flatRows = computed(() =>
  serverGroupingActive.value ? serverFlatRows.value : clientFlatRows.value,
)

function addGroup(field: string) {
  if (props.serverGrouping) serverAddGroup(field)
  clientAddGroup(field)
}
function removeGroup(field: string) {
  if (props.serverGrouping) serverRemoveGroup(field)
  clientRemoveGroup(field)
}
function clearGroups() {
  if (props.serverGrouping) serverClearGroups()
  clientClearGroups()
}
function toggleGroupExpand(key: string) {
  if (serverGroupingActive.value) serverToggleGroupExpand(key)
  else clientToggleGroupExpand(key)
}
function isGroupExpanded(key: string): boolean {
  if (serverGroupingActive.value) return serverIsGroupExpanded(key)
  return clientIsGroupExpanded(key)
}

// --- Sync external props to internal composables ---

// Sync hiddenFields prop → useColumns
watch(
  () => props.hiddenFields,
  (fields) => {
    if (!fields) return
    const desired = new Set(fields)
    for (const col of mergedColumns.value) {
      if (desired.has(col.field)) {
        if (!isHidden(col.field)) hideColumn(col.field)
      } else {
        if (isHidden(col.field)) showColumn(col.field)
      }
    }
  },
  { immediate: true },
)

// Sync columnOrder prop → useColumns
watch(
  () => props.columnOrder,
  (order) => {
    if (!order || order.length === 0) return
    columnOrderState.value = [...order]
  },
  { immediate: true },
)

// Sync groupFields prop → useGrouping (client + server)
watch(
  () => props.groupFields,
  (fields) => {
    if (!fields) return
    clearGroups()
    for (const field of fields) {
      addGroup(field)
    }
  },
)

// The rows fed to the virtualizer — flatRows already accounts for
// pagination (grouping operates on the paginated slice) and server grouping.
const renderableRows = computed(() => flatRows.value)

// Emit pageChange when pagination page, size, or the dataset length changes.
// The length dependency is what re-triggers a fetch after a server-side filter
// shrinks totalRows without changing the current page.
watch(
  [
    () => paginationState.currentPage.value,
    () => paginationState.pageSize.value,
    () => paginationState.totalRows.value,
  ],
  ([page, size, total]) => {
    if (!paginationEnabled.value) return
    const start = (page - 1) * size
    const end = Math.min(start + size, total)
    emit('pageChange', { page, pageSize: size, startIndex: start, endIndex: end })
  },
  { immediate: true },
)

// --- Reactive row height (changes with density) ---
const rowHeight = computed(() => DENSITY_ROW_HEIGHT[props.density ?? 'default'] ?? 48)

// --- Row ID helper ---
const getRowId = (row: RowData, index: number): string => {
  if (props.rowId) return props.rowId(row, index)
  return String(index)
}

// --- Row Selection (Gmail-style) ---
// Phase 2.6 — `useRowSelection` now reads / writes `gridState.selectAllMode`
// + `selectedRowIds` + `excludedRowIds` directly. The Gmail-shape
// `selectionModel` is a derived computed; the consumer-facing v-model is
// preserved by the `watch(selectionModel)` further down. The legacy mirror
// watch that re-projected the Gmail shape into gridState is gone.
const selectionTotalCount = computed(() => props.totalCount ?? props.rows.length)
const {
  selectionModel,
  selectedCount,
  isSelected: isIdSelected,
  toggleRow,
  selectPage,
  selectAll,
  clearSelection,
  togglePage,
  pageSelectionState,
} = useRowSelection(gridState, selectionTotalCount)

/** Check if a rendered row is selected, resolving its ID. */
function isRowSelected(row: RowData, index: number): boolean {
  const originalIndex = Number(row.__mrxOriginalIndex ?? index)
  return isIdSelected(getRowId(row, originalIndex))
}

/** Resolve a rendered row's ID. */
function resolveRowId(row: RowData, index: number): string {
  const originalIndex = Number(row.__mrxOriginalIndex ?? index)
  return getRowId(row, originalIndex)
}

/** IDs of all data rows on the current visible page (non-group, non-skeleton). */
const visiblePageIds = computed(() => {
  const ids: string[] = []
  const rows = renderableRows.value
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    if (isGroupRow(row) || row.__mrxSkeleton) continue
    ids.push(resolveRowId(row, i))
  }
  return ids
})

/** Header checkbox state — reflects the current PAGE, not the entire dataset. */
const headerSelectionState = computed(() => pageSelectionState(visiblePageIds.value))

/** Toggle header checkbox — selects/deselects the current page only. */
function toggleAll() {
  togglePage(visiblePageIds.value)
}

// --- Shift+Click range selection ---
const lastClickedIndex = ref<number | null>(null)

/** Toggle a rendered row, with shift+click range support. */
function handleToggleRow(row: RowData, index: number, event?: MouseEvent) {
  const id = resolveRowId(row, index)

  if (event?.shiftKey && lastClickedIndex.value !== null) {
    const from = Math.min(lastClickedIndex.value, index)
    const to = Math.max(lastClickedIndex.value, index)
    const rangeIds: string[] = []
    for (let i = from; i <= to; i++) {
      const r = renderableRows.value[i]
      if (r && !isGroupRow(r) && !r.__mrxSkeleton) {
        rangeIds.push(resolveRowId(r, i))
      }
    }
    selectPage(rangeIds)
  } else {
    toggleRow(id)
  }

  lastClickedIndex.value = index
}

watch(selectionModel, (val) => {
  emit('update:selection', val)
})

/** Number of data rows currently visible (rendered page). */
const visiblePageRowCount = computed(() => visiblePageIds.value.length)

// Action-bar visibility is driven by row OR cell selection — see the
// computeds defined further down once `cellSelection` is initialised.

/** Whether every data row on the current page is selected. */
const isPageFullySelected = computed(() => headerSelectionState.value === 'all')

/** Show Delete in the action bar only if the consumer listens to bulkDelete. */
const hasBulkDeleteListener = computed(() => !!getCurrentInstance()?.vnode.props?.onBulkDelete)

/**
 * Collect all editable cells in selected rows and emit a single bulkDelete
 * event with the full list of fills. The consumer applies them in one batch
 * and calls notify() once — no per-cell reactivity overhead.
 */
function emitBulkDelete() {
  const cols = allColumnsFlat.value
  const fills: Array<{ rowIndex: number; field: string; oldValue: unknown }> = []

  for (let i = 0; i < renderableRows.value.length; i++) {
    const row = renderableRows.value[i]!
    if (row.__mrxSkeleton || isGroupRow(row)) continue
    if (!isRowSelected(row, i)) continue

    for (const col of cols) {
      if (!col.editable) continue
      if (col.valueValidator && !col.valueValidator('')) continue
      const oldValue = row[col.field]
      if (oldValue === '' || oldValue == null) continue
      fills.push({ rowIndex: i, field: col.field, oldValue })
    }
  }

  // Auto-apply: clear each fill target on the consumer's rows.
  for (const f of fills) {
    applyEditAt(f.rowIndex, f.field, '')
  }
  emit('bulkDelete', { selection: selectionModel.value, fills })
}

/**
 * Copy all selected rows as TSV to the system clipboard.
 * Operates on the row checkbox selection (not cell range selection).
 */
async function copySelectedRows() {
  const cols = allColumnsFlat.value
  const lines: string[] = []

  for (let i = 0; i < renderableRows.value.length; i++) {
    const row = renderableRows.value[i]!
    if (row.__mrxSkeleton || isGroupRow(row)) continue
    if (!isRowSelected(row, i)) continue

    const cells: string[] = []
    for (const col of cols) {
      const v = row[col.field]
      cells.push(v == null ? '' : String(v))
    }
    lines.push(cells.join('\t'))
  }

  if (lines.length === 0) return
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
  } catch {
    // clipboard access denied
  }
}

/**
 * Paste from system clipboard into all selected rows.
 * Each clipboard row is applied to one selected row, cycling if needed.
 */
async function pasteIntoSelectedRows() {
  let text: string
  try {
    text = await navigator.clipboard.readText()
  } catch {
    return
  }
  if (!text) return

  const grid = text.split('\n').map((line) => line.split('\t'))
  if (grid.length === 0) return

  const cols = allColumnsFlat.value
  const clipRows = grid.length

  // Collect selected row indices
  const selectedIndices: number[] = []
  for (let i = 0; i < renderableRows.value.length; i++) {
    const row = renderableRows.value[i]!
    if (row.__mrxSkeleton || isGroupRow(row)) continue
    if (isRowSelected(row, i)) selectedIndices.push(i)
  }

  if (selectedIndices.length === 0) return

  for (let si = 0; si < selectedIndices.length; si++) {
    const rowIdx = selectedIndices[si]!
    const row = renderableRows.value[rowIdx]
    if (!row) continue

    const clipRow = grid[si % clipRows]!
    for (let c = 0; c < clipRow.length && c < cols.length; c++) {
      const col = cols[c]!
      if (!col.editable) continue
      const value = clipRow[c] ?? ''
      if (col.valueValidator && !col.valueValidator(value)) continue
      applyEditAt(rowIdx, col.field, value)
      emit('cellEdit', {
        rowIndex: rowIdx,
        field: col.field,
        oldValue: row[col.field],
        newValue: value,
      })
    }
  }
}

// --- Expansion ---
// Phase 2.4 — `gridState.expandedRowIds` (id-keyed) is now the single source
// of truth. `useRowExpansion` is a thin index↔id adapter so `MrxGridBody`
// keeps its index-based API (`isExpanded(rowIndex)`, `toggleExpansion(...)`).
const { isExpanded, toggleExpansion } = useRowExpansion(gridState, () => renderableRows.value)

// --- Column Resize ---
// Phase 2.3 — `useColumnResize` is now a thin DOM adapter that reads/writes
// `gridState.columnStates[i].currentWidth` directly. The legacy `widths` map
// and its mirror watch are gone — single source of truth.
const { getColumnWidth, onResizeStart } = useColumnResize(gridState)

// --- Spreadsheet mode (formula-enabled grid) ---
// When at least one column opts in via `allowFormula`, the grid switches to
// "spreadsheet mode" : a strip with column letters (A / B / C / …) above the
// header, and an auto-numbered leftmost column matching Excel / AG Grid
// conventions for formula refs.
const hasFormulaColumns = computed(() => mergedColumns.value.some((c) => c.allowFormula === true))
const ROW_NUMBER_WIDTH = 56

// --- Pinned Columns ---
const rowNumWidth = computed(() => (hasFormulaColumns.value ? ROW_NUMBER_WIDTH : 0))
const selectableWidthRef = computed(() => (props.selectable ? UTILITY_COL_WIDTH : 0))
const expandableWidthRef = computed(() => (props.expandable ? UTILITY_COL_WIDTH : 0))
const {
  leftColumns,
  centerColumns,
  rightColumns,
  hasPinned,
  leftTotalWidth,
  rightTotalWidth,
  getPinnedStyle,
  getUtilityStyle,
} = usePinnedColumns({
  columns: visibleColumns,
  getColumnWidth,
  rowNumWidth,
  selectableWidth: selectableWidthRef,
  expandableWidth: expandableWidthRef,
})

// --- All columns in flat display order (for active cell navigation) ---
const allColumnsFlat = computed(() => [
  ...leftColumns.value,
  ...centerColumns.value,
  ...rightColumns.value,
])

// --- Two-axis virtualization (center columns only) ---
const containerHeightRef = ref(props.containerHeight)
watch(
  () => props.containerHeight,
  (v) => {
    containerHeightRef.value = v
  },
)

/**
 * Sync the actual body height into the virtualizer on mount / resize.
 *
 * When virtualScroll is on AND containerHeight is explicitly provided,
 * the CSS sets a fixed height — but in fullscreen mode the consumer may
 * omit containerHeight, and the grid stretches via flex. In that case
 * (or when virtualScroll is off) we must measure the DOM element.
 *
 * We always accept measured values: this handles fullscreen toggle,
 * density changes that affect header height, and any other layout shift.
 */
function syncContainerHeight(height: number) {
  if (height <= 0) return
  containerHeightRef.value = height
}

/**
 * Total row count for the virtualizer.
 *
 * When grouping is active, the virtualizer must use the grouped flat list
 * length — NOT the original totalCount. The flat list contains group headers
 * + expanded data rows, which is a completely different number than the
 * original dataset size. Using totalCount here would make getRow() fall
 * through to SKELETON_ROW for most indices.
 *
 * Only pass totalCount to the virtualizer when there's no grouping.
 */
const totalCountRef = computed(() => {
  if (paginationEnabled.value) return renderableRows.value.length
  if (hasGroups.value) return renderableRows.value.length
  if (hasActiveFilters.value) return renderableRows.value.length
  return props.totalCount ?? renderableRows.value.length
})

const {
  wrapperRef,
  handleScroll,
  renderRange,
  renderColumns: renderCenterColumns,
  getRenderRow,
  startRowIndex,
  endRowIndex,
  startColIndex,
  endColIndex,
  offsetY,
  leftSpacerWidth,
  rightSpacerWidth,
  totalWidth: centerTotalWidth,
  totalHeight,
} = useVirtualGrid({
  rows: renderableRows,
  columns: centerColumns,
  rowHeight,
  containerHeight: containerHeightRef,
  virtualizeRows: computed(() => (props.virtualScroll ?? false) || paginationEnabled.value),
  virtualizeColumns: computed(() => props.virtualColumns ?? false),
  rowOverscan: props.overscan,
  columnOverscan: props.columnOverscan,
  getColumnWidth,
  totalCount: totalCountRef,
})

// --- Autosize ---
// Mounts an offscreen probe inside `wrapperRef` to measure header + visible
// cell text per column. Writes back via `gridState.updateColumnState` — same
// pipe as drag-resize.
const { autosizeColumn, autosizeAllColumns } = useAutosize({
  gridState,
  wrapperRef,
  rows: renderableRows,
})

// --- Active cell ---
const pinnedLeftCount = computed(() => leftColumns.value.length)
const pinnedRightCount = computed(() => rightColumns.value.length)

// Phase 2.9 — `useActiveCell` is now a thin adapter over `gridState.focusedCell`
// (Angular `{row, col}` shape). The legacy `{rowIndex, field}` API is
// preserved via a writable computed; field↔col is resolved against
// `allColumnsFlat` on read/write.
const activeCell_ = useActiveCell({
  gridState,
  allColumns: allColumnsFlat,
  rows: renderableRows,
  wrapperRef,
  rowHeight,
  getColumnWidth,
  startRowIndex,
  endRowIndex,
  startColIndex,
  endColIndex,
  pinnedLeftCount,
  pinnedRightCount,
})

const {
  activeCell,
  activeFieldForRow,
  activate: activateCell,
  colIndex: fieldToColIndex,
  scrollIntoView,
} = activeCell_

// --- Cell Selection ---
const totalRows = computed(() => renderableRows.value.length)
const totalCols = computed(() => allColumnsFlat.value.length)

// Phase 2.11 — `useCellSelection` is now backed by `gridState.selectedCell`
// + `gridState.cellRange` (Angular shapes). `cellRange.start` doubles as the
// shift-extend anchor; `frozenRanges` (Ctrl+Click multi-selection) stays
// local since it has no Angular pendant.
const cellSelection = useCellSelection({ gridState, totalRows, totalCols })

/** Total cells covered by the cell selection ranges. Sums each range as
 *  `(r2-r1+1) × (c2-c1+1)`; ranges may overlap, but for the toolbar
 *  counter that approximation matches the "N rectangles totalling X cells"
 *  mental model the user has when ctrl-clicking multiple ranges. */
const selectedCellsCount = computed(() => {
  let n = 0
  for (const r of cellSelection.allRanges.value) {
    n += (r.r2 - r.r1 + 1) * (r.c2 - r.c1 + 1)
  }
  return n
})

/** Mode the floating action bar is operating in. Row selection takes
 *  precedence: if a user has both an active cell range AND selected rows,
 *  the row counter is the load-bearing signal (cell range is a navigation
 *  artefact at that point). */
const actionBarMode = computed<'row' | 'cell'>(() =>
  props.selectable && selectedCount.value > 0 ? 'row' : 'cell',
)

const actionBarCount = computed(() =>
  actionBarMode.value === 'row' ? selectedCount.value : selectedCellsCount.value,
)

/** Show the floating action bar when EITHER any row is selected OR a
 *  multi-cell range is drawn. A single active cell (1×1) doesn't trigger
 *  the bar — there's nothing to bulk-act on yet. */
const showActionBar = computed(
  () => (!!props.selectable && selectedCount.value > 0) || cellSelection.hasSelection.value,
)

/** Mode-aware dispatchers for the floating bar. Row mode reuses the
 *  bulk-row helpers (which round-trip clipboard text + emit `bulkDelete`
 *  with all the cell fills); cell mode delegates to the clipboard
 *  composable that already handles the active range. */
function onActionBarClear() {
  if (actionBarMode.value === 'row') clearSelection()
  else cellSelection.deactivate()
}

function onActionBarEdit() {
  if (actionBarMode.value === 'row') {
    emit('selectionEdit', { mode: 'row', selection: selectionModel.value })
  } else {
    emit('selectionEdit', { mode: 'cell', ranges: cellSelection.allRanges.value })
  }
}

function onActionBarCopy() {
  if (actionBarMode.value === 'row') void copySelectedRows()
  else clipboard.copy()
}

function onActionBarPaste() {
  if (actionBarMode.value === 'row') void pasteIntoSelectedRows()
  else clipboard.paste()
}

function onActionBarDelete() {
  if (actionBarMode.value === 'row') emitBulkDelete()
  else clipboard.clearSelection()
}

watch(activeCell, (cell) => {
  if (!cell) {
    cellSelection.deactivate()
    return
  }
  const col = fieldToColIndex(cell.field)
  if (col >= 0) {
    cellSelection.activate(cell.rowIndex, col)
  }
})

// --- Cell editing ---
const {
  editingCell,
  isEditing,
  isEditable,
  startEditing,
  updateDraft,
  commit: commitEdit,
  cancel: cancelEdit,
  editingFieldForRow,
} = useCellEditing({
  // Phase 2.10 — `useCellEditing` is now backed by `gridState.cellEditState`
  // (Angular shape `{editingCell: {row, col}, originalValue, draftValue, ...}`).
  // The legacy `{rowIndex, field, ...}` shape is preserved via a writable computed.
  gridState,
  columns: allColumnsFlat,
  rows: renderableRows,
})

// --- Fill Handle ---
const lastSelectionRange = computed(() => {
  const ranges = cellSelection.allRanges.value
  return ranges.length > 0 ? ranges[ranges.length - 1]! : null
})

const fillHandle = useFillHandle({
  allColumns: allColumnsFlat,
  rows: renderableRows,
  rowHeight,
  wrapperRef,
  sourceRange: lastSelectionRange,
  getColumnWidth,
  utilityWidth:
    (props.selectable ? UTILITY_COL_WIDTH : 0) + (props.expandable ? UTILITY_COL_WIDTH : 0),
  onFill: (event: FillEvent) => {
    // Auto-apply each fill target to the consumer's rows.
    for (const f of event.fills) {
      applyEditAt(f.rowIndex, f.field, f.value)
    }
    emit('fill', event)
  },
})

// --- Clipboard (copy / cut / paste / delete) ---
// Phase 3.1 — Cut now sets `gridState.cutSource` for the marching-ants
// outline (Excel-style move semantics). Paste detects the pending cut and
// clears the source range before applying. `cancelCut()` (Esc) drops the
// outline without clearing data.
const clipboard = useClipboard({
  gridState,
  allColumns: allColumnsFlat,
  rows: renderableRows,
  allRanges: cellSelection.allRanges,
  activeRow: cellSelection.activeRow,
  activeCol: cellSelection.activeCol,
  totalRows,
  totalCols,
  isEditable,
  onPaste(fills) {
    for (const fill of fills) {
      const row = renderableRows.value[fill.rowIndex]
      if (row) {
        applyEditAt(fill.rowIndex, fill.field, fill.value)
        emit('cellEdit', {
          rowIndex: fill.rowIndex,
          field: fill.field,
          oldValue: row[fill.field],
          newValue: fill.value,
        })
      }
    }
  },
  onClear(fills) {
    const changes: { rowIndex: number; field: string; before: unknown; after: unknown }[] = []
    for (const fill of fills) {
      const row = renderableRows.value[fill.rowIndex]
      if (!row) continue
      const oldValue = row[fill.field]
      if (oldValue === '') continue
      changes.push({ rowIndex: fill.rowIndex, field: fill.field, before: oldValue, after: '' })
      applyEditAt(fill.rowIndex, fill.field, '')
      emit('cellEdit', {
        rowIndex: fill.rowIndex,
        field: fill.field,
        oldValue,
        newValue: '',
      })
    }
    if (changes.length > 0) {
      gridEngine.history.record('edit', changes)
    }
  },
})

// --- Mouse drag selection ---
const mouseSelection = useMouseSelection({
  allColumns: allColumnsFlat,
  rows: renderableRows,
  rowHeight,
  wrapperRef,
  getColumnWidth,
  utilityWidth:
    (props.selectable ? UTILITY_COL_WIDTH : 0) + (props.expandable ? UTILITY_COL_WIDTH : 0),
  pinnedLeftCount,
  pinnedRightCount,
  onDragMove(row, col) {
    cellSelection.extendTo(row, col)
  },
  onDragEnd() {
    // Selection is finalized
  },
})

// --- Keyboard handler (useKeyboard) ---
const { handleKeyDown: handleKeyboardKeyDown } = useKeyboard({
  allColumns: allColumnsFlat,
  rows: renderableRows,
  isActive: () => activeCell.value !== null,
  isEditing: () => isEditing.value,

  onMove(rowDelta, colDelta) {
    activeCell_.move(rowDelta, colDelta)
  },

  onExtend(rowDelta, colDelta) {
    const row = cellSelection.activeRow.value + rowDelta
    const col = cellSelection.activeCol.value + colDelta
    const clampedCol = Math.max(0, Math.min(col, totalCols.value - 1))
    let clampedRow = Math.max(0, Math.min(row, totalRows.value - 1))
    // Skip group / skeleton rows in the direction of the extension so the
    // selection rectangle never includes a non-data row.
    if (rowDelta !== 0) {
      const step: 1 | -1 = rowDelta > 0 ? 1 : -1
      const next = activeCell_.findNavigableRow(clampedRow, step)
      if (next < 0) return
      clampedRow = next
    }
    cellSelection.extendTo(clampedRow, clampedCol)

    const targetField = allColumnsFlat.value[clampedCol]?.field
    if (targetField) {
      scrollIntoView(clampedRow, targetField)
    }
  },

  onJumpToEdge(direction) {
    activeCell_.jumpToEdge(direction)
  },

  onJumpExtend(direction) {
    // Jump to edge AND extend selection (Shift+Ctrl+Arrow)
    const lastRow = totalRows.value - 1
    const firstNavigable = activeCell_.findNavigableRow(0, 1)
    const lastNavigable = activeCell_.findNavigableRow(lastRow, -1)
    const targetRow =
      direction === 'up'
        ? Math.max(firstNavigable, 0)
        : direction === 'down'
          ? Math.max(lastNavigable, 0)
          : cellSelection.activeRow.value
    const targetCol =
      direction === 'left'
        ? 0
        : direction === 'right'
          ? totalCols.value - 1
          : cellSelection.activeCol.value
    cellSelection.extendTo(targetRow, targetCol)

    const targetField = allColumnsFlat.value[targetCol]?.field
    if (targetField) scrollIntoView(targetRow, targetField)
  },

  onTab(forward) {
    activeCell_.tab(forward)
  },

  onEnter(forward) {
    activeCell_.enter(forward)
  },

  onHomeEnd(key, ctrl) {
    activeCell_.homeEnd(key, ctrl)
  },

  onPage(direction) {
    activeCell_.page(direction)
  },

  onEscape() {
    // Drop a pending cut outline first — same precedence as Excel.
    if (gridState.cutSource.value) {
      clipboard.cancelCut()
      return
    }
    if (cellSelection.hasSelection.value) {
      cellSelection.clearRanges()
      return
    }
    activeCell_.deactivate()
  },

  onSelectAll() {
    cellSelection.selectAll()
  },

  onCopy() {
    clipboard.copy()
  },

  onCut() {
    clipboard.cut()
  },

  onPaste() {
    clipboard.paste()
  },

  onDelete() {
    clipboard.clearSelection()
  },
})

/**
 * Commit any in-progress edit and emit the result.
 *
 * Phase 6b — formula integration: when the column declares `allowFormula`,
 * a value that starts with `=` is registered with `useFormulaEngine` (so it
 * gets parsed, dependencies tracked, and evaluated). Non-formula edits on
 * any column trigger `formula.invalidate(addr)` so dependent formulas
 * pick up the upstream change.
 */
function flushEdit() {
  const event = commitEdit()
  if (!event) return
  // Record the edit in the history stack BEFORE emitting cellEdit. Order
  // matters because the consumer's `cellEdit` handler may trigger a
  // re-render that resets `gridState.sourceData` from the new
  // `props.rows`, but the history op only references (rowIndex, field,
  // before, after) by value so it stays valid either way.
  if (event.oldValue !== event.newValue) {
    gridEngine.history.record('edit', [
      {
        rowIndex: event.rowIndex,
        field: event.field,
        before: event.oldValue,
        after: event.newValue,
      },
    ])
  }
  applyEditAt(event.rowIndex, event.field, event.newValue)
  emit('cellEdit', event)

  // Resolve a stable row id for the formula engine — falls back to the
  // index-as-string when no `rowId` resolver is provided.
  const row = renderableRows.value[event.rowIndex]
  if (!row || isGroupRow(row)) return
  const originalIndex = Number(row.__mrxOriginalIndex ?? event.rowIndex)
  const rowId = resolveRowId(row, originalIndex)
  const addr = { rowId, field: event.field }

  const col = mergedColumns.value.find((c) => c.field === event.field)
  const isFormulaCol = col?.allowFormula === true
  const newStr = typeof event.newValue === 'string' ? event.newValue : ''

  if (isFormulaCol && newStr.trimStart().startsWith('=')) {
    gridEngine.formula.set(addr, newStr)
  } else if (gridEngine.formula.hasFormula(addr)) {
    // The user replaced a formula with a literal — drop the formula entry.
    gridEngine.formula.remove(addr)
  } else {
    // Non-formula edit on a regular cell — refresh dependents only.
    gridEngine.formula.invalidate(addr)
  }
}

// --- Handle cell activation from row click ---
function onActivateCell(rowIndex: number, field: string, e?: MouseEvent) {
  const ec = editingCell.value
  if (ec && (ec.rowIndex !== rowIndex || ec.field !== field)) {
    flushEdit()
  }

  const colIdx = fieldToColIndex(field)

  if (e?.shiftKey) {
    cellSelection.extendTo(rowIndex, colIdx)
  } else if (e?.ctrlKey || e?.metaKey) {
    cellSelection.addRange(rowIndex, colIdx)
  } else {
    // Sync selection state synchronously BEFORE starting drag,
    // so the anchor is set correctly when the first mousemove fires.
    // The async watch on activeCell would also call activate(), but
    // it runs as a microtask — too late if a mousemove queues first.
    cellSelection.activate(rowIndex, colIdx)
    activateCell(rowIndex, field)
    // Start mouse drag selection (extend on mousemove)
    if (e) mouseSelection.startDrag(e)
  }
}

// --- Cell edit event handlers (bubbled from MrxGridCell → MrxGridRow) ---

function onEditStart(rowIndex: number, field: string) {
  const row = renderableRows.value[rowIndex]
  if (!row || isGroupRow(row)) return
  flushEdit()
  startEditing(rowIndex, field)
}

function onEditInput(value: unknown) {
  updateDraft(value)
}

function onEditCommit(direction: 'down' | 'right' | 'left') {
  const state = editingCell.value
  if (!state) return

  flushEdit()

  const { rowIndex, field } = state
  if (direction === 'down') {
    const nextRow = rowIndex + 1
    if (nextRow < renderableRows.value.length) {
      activateCell(nextRow, field)
    }
  } else {
    const cols = allColumnsFlat.value
    const idx = cols.findIndex((c) => c.field === field)
    if (direction === 'right' && idx < cols.length - 1) {
      activateCell(rowIndex, cols[idx + 1]!.field)
    } else if (direction === 'left' && idx > 0) {
      activateCell(rowIndex, cols[idx - 1]!.field)
    }
  }

  wrapperRef.value?.focus()
}

function onEditCancel() {
  cancelEdit()
  wrapperRef.value?.focus()
}

function onEditBlur() {
  if (!isEditing.value) return
  flushEdit()
}

// ---------------------------------------------------------------------------
// Grid-level keyboard handler
// ---------------------------------------------------------------------------

function onGridKeyDown(e: KeyboardEvent) {
  // Undo / redo — wire here (NOT on a window-level listener) so the
  // shortcut is scoped to the grid wrapper. The wrapper has tabindex="0"
  // so it can take focus on click; once focused, every keydown lands
  // here regardless of which iframe Storybook is embedding the grid in.
  // Skip when an inline editor is active so the browser's native
  // text-undo inside the input keeps working as expected.
  // Use `e.key` (the letter on the keycap) — `e.code` is the US-QWERTY
  // physical position, which breaks undo/redo on AZERTY (`code==='KeyW'`
  // for the Z key).
  const undoKey = e.key.toLowerCase()
  if (!isEditing.value && (e.ctrlKey || e.metaKey) && (undoKey === 'z' || undoKey === 'y')) {
    const wantsRedo = (undoKey === 'z' && e.shiftKey) || (undoKey === 'y' && !e.shiftKey)
    if (wantsRedo) {
      if (gridEngine.history.canRedo.value) {
        e.preventDefault()
        gridEngine.history.redo()
      }
    } else if (undoKey === 'z' && !e.shiftKey) {
      if (gridEngine.history.canUndo.value) {
        e.preventDefault()
        gridEngine.history.undo()
      }
    }
    return
  }

  const cell = activeCell.value
  if (cell && !isEditing.value && isEditable(cell.field)) {
    const row = renderableRows.value[cell.rowIndex]
    if (row && !isGroupRow(row)) {
      if (e.key === 'F2' || e.key === 'Enter') {
        e.preventDefault()
        startEditing(cell.rowIndex, cell.field)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (cellSelection.hasSelection.value) {
          // Multi-cell selection: clear all selected cells via clipboard composable
          // Let it fall through to handleKeyboardKeyDown which calls onDelete
        } else {
          e.preventDefault()
          startEditing(cell.rowIndex, cell.field, '')
          return
        }
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        startEditing(cell.rowIndex, cell.field, e.key)
        return
      }
    }
  }

  handleKeyboardKeyDown(e)
}

// ---------------------------------------------------------------------------
// Cell flags — computed per-cell for selection visuals
// ---------------------------------------------------------------------------

function getCellFlags(rowIndex: number, field: string): CellFlags {
  const colIdx = fieldToColIndex(field)
  if (colIdx < 0) return {}

  const sel = cellSelection.isCellSelected(rowIndex, colIdx)
  const edges = cellSelection.getCellEdges(rowIndex, colIdx)

  const isFillHandleCell =
    rowIndex === cellSelection.fillHandleRow.value &&
    colIdx === cellSelection.fillHandleCol.value &&
    !fillHandle.isDragging.value &&
    !isEditing.value

  const fillTarget = fillHandle.fillTargetRange.value
  const isFillTarget =
    fillTarget !== null &&
    fillTarget.r1 >= 0 &&
    rowIndex >= fillTarget.r1 &&
    rowIndex <= fillTarget.r2 &&
    colIdx >= fillTarget.c1 &&
    colIdx <= fillTarget.c2

  // Cells inside the fill-target range whose column refuses the write
  // (non-editable) are flagged separately so the cell can render a red
  // dashed outline — it tells the user the fill will skip this cell
  // before they release the mouse.
  const targetCol = isFillTarget ? allColumnsFlat.value[colIdx] : null
  const isFillTargetInvalid = isFillTarget && (!targetCol || !targetCol.editable)

  // --- Cut / marching-ants outline (Phase 3.1) ---
  const cut = gridState.cutSource.value
  const inCutSource =
    cut !== null &&
    rowIndex >= cut.start.row &&
    rowIndex <= cut.end.row &&
    colIdx >= cut.start.col &&
    colIdx <= cut.end.col
  const cutEdgeTop = inCutSource && cut !== null && rowIndex === cut.start.row
  const cutEdgeBottom = inCutSource && cut !== null && rowIndex === cut.end.row
  const cutEdgeLeft = inCutSource && cut !== null && colIdx === cut.start.col
  const cutEdgeRight = inCutSource && cut !== null && colIdx === cut.end.col

  // --- Cell validation ---
  let invalid: boolean | undefined
  let invalidMessage: string | undefined

  const col = allColumnsFlat.value[colIdx]
  if (col?.cellValidator) {
    const row = renderableRows.value[rowIndex]
    if (row && !isGroupRow(row)) {
      const result = col.cellValidator(row[field], row)
      if (result !== true) {
        invalid = true
        invalidMessage = result
      }
    }
  }

  return {
    selected: sel,
    edgeTop: edges.top,
    edgeBottom: edges.bottom,
    edgeLeft: edges.left,
    edgeRight: edges.right,
    fillHandle: isFillHandleCell,
    fillTarget: isFillTarget && !isFillTargetInvalid,
    fillTargetInvalid: isFillTargetInvalid,
    invalid,
    invalidMessage,
    cutSource: inCutSource,
    cutEdgeTop,
    cutEdgeBottom,
    cutEdgeLeft,
    cutEdgeRight,
  }
}

// --- Column menu action dispatcher ---
function onColumnSort(field: string, isMultiSort: boolean) {
  gridEngine.sort.toggleSort(field, isMultiSort)
}

function onColumnMenuAction(action: ColumnMenuAction) {
  switch (action.type) {
    case 'sort-asc':
      setSort(action.field, 'asc')
      break
    case 'sort-desc':
      setSort(action.field, 'desc')
      break
    case 'pin-left':
      pinColumn(action.field, 'left')
      break
    case 'pin-right':
      pinColumn(action.field, 'right')
      break
    case 'unpin':
      unpinColumn(action.field)
      break
    case 'hide':
      hideColumn(action.field)
      break
    case 'filter':
      toggleFilter(action.field)
      break
    case 'filter-column':
      // Sprint 5 — the per-column filter overlay handles the actual write
      // via the `column-filter-apply` event from `MrxGridHeader`. We still
      // forward the menu action so external listeners can react.
      break
    case 'group-by':
      addGroup(action.field)
      break
    case 'autosize-this':
      autosizeColumn(action.field)
      break
    case 'autosize-all':
      autosizeAllColumns()
      break
    default:
      break
  }
  emit('columnMenuAction', action)
}

// Sprint 5 — apply the per-column "Filter in this column" overlay output.
// If a condition for this field already exists we replace it, so the
// overlay behaves as edit-or-add rather than always appending.
function onColumnFilterApply(condition: FilterCondition) {
  // Match by id so multiple conditions can coexist on the same field —
  // the per-column overlay can stack 'name contains X' AND 'name does
  // not contain Y'. Falling back to field-match would clobber the wrong
  // row and limit overlays to one condition per column.
  const existing = gridState.filterModel.value.conditions.find((c) => c.id === condition.id)
  if (existing) {
    gridEngine.filter.updateCondition(existing.id, {
      operator: condition.operator,
      value: condition.value,
    })
  } else {
    gridEngine.filter.addCondition(condition)
  }
  if (props.serverFilter) {
    nextTick(() => emit('filterChange', { ...filters.value }))
  }
}

function onColumnFilterRemove(id: string) {
  gridEngine.filter.removeCondition(id)
  if (props.serverFilter) {
    nextTick(() => emit('filterChange', { ...filters.value }))
  }
}

function onColumnFilterReorder(movedId: string, targetId: string | null) {
  // Translate engine-condition IDs to engine indices, then defer to the
  // engine's `reorderConditions` so listeners (URL persistence, etc.) get
  // a single notify event.
  const conditions = gridState.filterModel.value.conditions
  const fromIndex = conditions.findIndex((c) => c.id === movedId)
  if (fromIndex < 0) return
  let toIndex =
    targetId == null ? conditions.length - 1 : conditions.findIndex((c) => c.id === targetId)
  if (toIndex < 0) toIndex = conditions.length - 1
  // After splicing the moved condition out, the target index needs to
  // shift left by one if it was past the source.
  if (toIndex > fromIndex) toIndex -= 1
  if (toIndex === fromIndex) return
  gridEngine.filter.reorderConditions(fromIndex, toIndex)
  if (props.serverFilter) {
    nextTick(() => emit('filterChange', { ...filters.value }))
  }
}

// --- Column drag-and-drop reordering ---
// Phase 2.8 — `useColumns.reorderColumn` now mutates `gridState.columnStates[].order`
// directly, so the previous engine-sync wrapper is gone (single source of truth).

const totalUtilityWidth = computed(
  () => rowNumWidth.value + selectableWidthRef.value + expandableWidthRef.value,
)

const { startDrag: startColumnDrag } = useColumnDnD({
  movingField,
  allColumns: allColumnsFlat,
  leftColumns,
  centerColumns,
  rightColumns,
  getColumnWidth,
  wrapperRef,
  utilityWidth: totalUtilityWidth,
  onReorder: reorderColumn,
  onPin: (field, pinned) => {
    if (pinned === null) unpinColumn(field)
    else pinColumn(field, pinned)
  },
})

// Total content width — always computed so rows are wide enough for sticky to work.
const gridContentWidth = computed(() => {
  const w = centerTotalWidth.value + leftTotalWidth.value + rightTotalWidth.value
  return w > 0 ? `${w}px` : undefined
})

// Last unpinned column flex-fills the trailing gap so the grid never
// shows empty horizontal space. Works regardless of right-pinned columns
// (the right pin is sticky to the wrapper, so the center column flexes
// up to its left edge without overlapping). Active even with horizontal
// virtualisation: the fill applies to the GLOBAL last unpinned column,
// not the slice-last — so it only flex-grows when the user scrolls to
// the very end (right spacer = 0). At that point the row's natural
// width equals the body width and the flex-grow has nothing to do; if
// any subpixel rounding or layout drift leaves a sliver of empty space
// it gets absorbed instead of becoming a white zone past the cells.
const fillField = computed<string | null>(() => {
  const centers = centerColumns.value
  if (centers.length === 0) return null
  return centers[centers.length - 1]!.field
})

// Sprint 6 — the filter row only appears when at least one column opts
// in via either:
//   • a built-in `filter` shape (legacy, text/select/date)
//   • a Vue `filterRenderer` component (custom Mozaic input mix)
//   • a `<MrxColumn> #filter` slot or root `#filter-{field}` slot
// Other columns render an empty cell on that row but the row itself
// stays hidden when nobody opts in (matches Angular's behaviour where
// the filter row only renders if `filterTemplate` is declared).
const hasFilterRow = computed(() => {
  const cols = mergedColumns.value
  if (cols.some((c) => c.filter || c.filterRenderer)) return true
  if (columnRegistry.list().some((r) => r.hasFilterSlot)) return true
  if (_rootSlots.filter) return true
  return cols.some((c) => `filter-${c.field}` in _rootSlots)
})

const isVirtual = computed(
  () => props.virtualScroll || props.virtualColumns || paginationEnabled.value,
)

// Notify consumer when visible row range changes (for lazy data fetching).
// Skip in pagination mode — paginated data is already loaded in full.
function notifyVisibleRange() {
  const s = startRowIndex.value
  const e = endRowIndex.value
  if (props.onVisibleRangeChange && !paginationEnabled.value) {
    props.onVisibleRangeChange(s, e)
  }
  if (serverGroupingActive.value) {
    serverGroupVisibleRangeChange(s, e)
  }
}

watch([startRowIndex, endRowIndex], () => notifyVisibleRange(), { immediate: true })

// Re-notify visible range when rows change (e.g. after server-side filter
// invalidates the cache). Without this, skeleton rows in the current viewport
// would stay forever because the scroll position hasn't moved.
watch(
  () => props.rows,
  () => notifyVisibleRange(),
)

// --- Fill handle mousedown handler ---
function onFillHandleMousedown(e: MouseEvent) {
  fillHandle.startDrag(e)
}

// --- Viewport width CSS property for group/expanded row content clamping ---
let resizeObserver: ResizeObserver | undefined

function syncViewportWidth(width: number) {
  wrapperRef.value?.style.setProperty('--mrx-viewport-width', `${width}px`)
}

onMounted(() => {
  if (wrapperRef.value) {
    syncViewportWidth(wrapperRef.value.clientWidth)
    syncContainerHeight(wrapperRef.value.clientHeight)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry) {
          syncViewportWidth(entry.contentRect.width)
          syncContainerHeight(entry.contentRect.height)
        }
      })
      resizeObserver.observe(wrapperRef.value)
    }
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  document.documentElement.style.removeProperty('--drawer-z-index')
  document.documentElement.style.removeProperty('--overlay-z-index')
})

// When fullscreen is active, Mozaic overlays & drawers must sit above the
// fullscreen grid (z-index: 1000). The overlay wraps the drawer and creates
// a stacking context, so both need to be raised.
watch(
  () => props.fullscreen,
  (fs) => {
    const el = document.documentElement.style
    if (fs) {
      el.setProperty('--overlay-z-index', '1001')
      el.setProperty('--drawer-z-index', '1002')
    } else {
      el.removeProperty('--overlay-z-index')
      el.removeProperty('--drawer-z-index')
    }
  },
  { immediate: true },
)

/**
 * Return all selected data rows currently in memory (non-skeleton, non-group).
 * For lazy-loaded grids, only rows that have been fetched are returned.
 * Use selectionModel for server-side export when allSelected is true.
 */
function getSelectedRows(): RowData[] {
  const result: RowData[] = []
  for (let i = 0; i < renderableRows.value.length; i++) {
    const row = renderableRows.value[i]!
    if (row.__mrxSkeleton || isGroupRow(row)) continue
    if (isRowSelected(row, i)) result.push(row)
  }
  return result
}

// ─── Imperative ref API (Phase 1.0) ────────────────────────────────────
// Exposes engine methods to the consumer via `defineExpose`. The grid is
// the public seam — engines stay private. Consumers acquire the ref:
//
//   const grid = ref<InstanceType<typeof MrxGrid>>()
//   grid.value.exportCsv({ filename: 'rows.csv' })
//   grid.value.undo()
//   grid.value.scrollToRow(1234)

/** Export current display rows as CSV (download triggered). */
function exportCsv(options?: { filename?: string; separator?: string; columns?: string[] }) {
  const data = renderableRows.value.filter((r) => !isGroupRow(r) && !r.__mrxSkeleton) as RowData[]
  gridEngine.export.exportCsv(data, options)
}

/** Export current display rows as JSON (download triggered). */
function exportJson(options?: { filename?: string; columns?: string[] }) {
  const data = renderableRows.value.filter((r) => !isGroupRow(r) && !r.__mrxSkeleton) as RowData[]
  gridEngine.export.exportJson(data, options)
}

/** Undo the last cell-change group (clipboard / inline-edit driven). */
function undo() {
  return gridEngine.history.undo()
}

/** Redo the last undone group. */
function redo() {
  return gridEngine.history.redo()
}

/** Clear the whole undo/redo history. */
function clearHistory() {
  gridEngine.history.clear()
}

/** Run every column's `cellValidator` against the current rows; populates
 *  `getCellError` / `hasCellError` for cell-level UI cues. */
function validateAll() {
  gridEngine.cellValidation.validateAll(props.rows)
}

/** Active sort stack (read-only snapshot). */
function getSortModel() {
  return [...gridState.activeSorts.value]
}

/** Active filter conditions (read-only snapshot). */
function getFilterModel() {
  return { conditions: [...gridState.filterModel.value.conditions] }
}

/** Active group stack (read-only snapshot). */
function getGroupModel() {
  return [...gridState.groupColumns.value]
}

/** Persist current view (columns + sorts + filters) to localStorage. */
function persistView(storageKey: string) {
  gridEngine.statePersistence.save(storageKey)
}

/** Restore a previously persisted view. Returns `false` if the key is
 *  absent or the payload can't be applied. */
function restoreView(storageKey: string): boolean {
  return gridEngine.statePersistence.restore(storageKey)
}

defineExpose({
  // Filter — surfaces are independent. `setFilter` writes to the quick
  // (filter row) state; `setFilterModel` writes to the formal builder
  // state. `clearFilters` wipes BOTH so the legacy "reset" semantics is
  // preserved; `clearQuickFilters` / `clearFilterModel` are the
  // surface-scoped variants.
  clearFilters,
  clearQuickFilters: rawClearFilters,
  clearFilterModel,
  setFilter,
  getFilterModel,
  /** Replace the entire formal filter model in one shot — used by the
   *  multi-condition `MrxGridFilterDrawer` on Apply. */
  setFilterModel: (model: { conditions: typeof gridState.filterModel.value.conditions }) =>
    gridEngine.filter.setModel(model, 'replace'),
  // Selection
  selectionModel,
  selectedCount,
  selectionTotalCount,
  selectAll,
  clearSelection,
  getSelectedRows,
  // Sort / group
  getSortModel,
  clearSort: () => gridEngine.sort.clearSort(),
  getGroupModel,
  clearGroups,
  // Export
  exportCsv,
  exportJson,
  // History (undo / redo)
  undo,
  redo,
  clearHistory,
  // Validation
  validateAll,
  getCellError: gridEngine.cellValidation.getCellError,
  hasCellError: gridEngine.cellValidation.hasCellError,
  // Formula
  setFormula: gridEngine.formula.set,
  getFormula: gridEngine.formula.getFormula,
  getFormulaValue: gridEngine.formula.valueAt,
  // Persistence (manual; see `persistKey` prop for auto)
  persistView,
  restoreView,
  // Tree (opt-in; consumers feed a hierarchical dataset via the engine).
  // The engine flattens to `TreeDisplayRow[]` consumed by virtualisation.
  tree: {
    flatten: gridEngine.tree.flatten,
    toggleNode: gridEngine.tree.toggleNode,
    expandAll: gridEngine.tree.expandAll,
    collapseAll: gridEngine.tree.collapseAll,
  },
})
</script>

<template>
  <div
    class="mrx-grid-root"
    :class="{ 'mrx-grid-root--fullscreen': props.fullscreen }"
    :style="
      props.fullscreen
        ? undefined
        : { height: typeof props.height === 'number' ? `${props.height}px` : props.height }
    "
  >
    <slot name="toolbar" />

    <!-- Hidden default slot — render-less <MrxColumn> children live here.
         They register themselves into the column registry on mount and
         contribute their definitions to `mergedColumns`. The slot has
         `display: none` because <MrxColumn> already renders no DOM, but
         this guarantees Vue actually instantiates them. -->
    <div style="display: none" aria-hidden="true">
      <slot />
    </div>

    <!-- Error overlay — replaces the body entirely when set. -->
    <slot v-if="props.error" name="error" :error="props.error" :retry="() => emit('retry')">
      <div class="mrx-grid-error" role="alert">
        <p>{{ props.error.message || 'An error occurred.' }}</p>
        <button type="button" @click="emit('retry')">Retry</button>
      </div>
    </slot>

    <!-- Loading overlay — sits above the grid wrapper, body keeps rendering. -->
    <slot v-if="props.loading" name="loading">
      <div class="mrx-grid-loading-bar" aria-hidden="true" />
    </slot>

    <!-- Sprint 3 — unified Mozaic tag bars (HIDDEN / GROUPED / FILTERED) -->
    <MrxGridTagBar
      v-if="!props.error && hiddenTags.length > 0"
      label="HIDDEN COLUMNS"
      :items="hiddenTags"
      action-label="Restore all"
      @remove="onShowColumn"
      @action="showAllColumns"
    />
    <MrxGridTagBar
      v-if="!props.error && hasGroups"
      label="GROUPED BY"
      :items="groupTags"
      action-label="Remove all"
      @remove="removeGroup"
      @action="clearGroups"
    />
    <MrxGridTagBar
      v-if="!props.error && activeFilterTags.length > 0"
      label="FILTERED BY"
      :items="activeFilterTags"
      action-label="Remove all"
      @remove="onRemoveFilter"
      @action="onRemoveAllFilters"
    />

    <div
      ref="wrapperRef"
      class="mrx-grid-wrapper"
      :class="{
        'mrx-grid-wrapper--virtual': isVirtual,
        'mrx-grid-wrapper--compact': props.density === 'compact',
        'mrx-grid-wrapper--comfortable': props.density === 'comfortable',
        'mrx-grid-wrapper--paginated': paginationEnabled,
      }"
      :style="{
        '--mrx-row-height': `${rowHeight}px`,
        ...((virtualScroll || paginationEnabled) && !props.fullscreen
          ? { height: `${containerHeight}px` }
          : {}),
      }"
      tabindex="0"
      role="grid"
      @scroll="handleScroll"
      @keydown="onGridKeyDown"
    >
      <!--
      The grid is structured as:
      1. Sticky header (position: sticky, top: 0)
      2. Body container:
         - Virtual: sizer div (totalHeight) + top spacer + rows
         - Non-virtual: rows rendered directly
      No transform on any ancestor of rows — this preserves position:sticky
      on pinned column cells (transform creates a containing block that
      traps sticky descendants).
    -->

      <!-- Sticky header block (spreadsheet letters + header + optional filter row).
           Hidden whenever the empty-state card takes over (both `pristine`
           and `filtered` variants) — same condition as the empty-state
           `<slot>` below, inverted. Headers stay visible during
           loading / error so the user keeps the column context. -->
      <div
        v-if="props.loading || props.error || (props.rows.length > 0 && renderableRows.length > 0)"
        class="mrx-grid-sticky-header"
      >
        <!-- A / B / C / … strip — auto-on when any column has `allowFormula`. -->
        <MrxGridSpreadsheetHeader
          v-if="hasFormulaColumns"
          :columns="renderCenterColumns"
          :pinned-left-columns="leftColumns"
          :pinned-right-columns="rightColumns"
          :has-pinned="hasPinned"
          :show-row-numbers="hasFormulaColumns"
          :selectable="selectable"
          :expandable="expandable"
          :get-column-width="getColumnWidth"
          :get-pinned-style="getPinnedStyle"
          :get-utility-style="getUtilityStyle"
          :left-spacer-width="leftSpacerWidth"
          :right-spacer-width="rightSpacerWidth"
          :content-min-width="gridContentWidth"
          :center-start-index="leftColumns.length + startColIndex"
          :center-total-count="centerColumns.length"
          :fill-field="fillField"
        />

        <MrxGridHeader
          :columns="renderCenterColumns"
          :pinned-left-columns="leftColumns"
          :pinned-right-columns="rightColumns"
          :has-pinned="hasPinned"
          :selectable="selectable"
          :expandable="expandable"
          :show-row-numbers="hasFormulaColumns"
          :selection-state="headerSelectionState"
          :get-column-width="getColumnWidth"
          :on-resize-start="onResizeStart"
          :get-pinned-style="getPinnedStyle"
          :get-utility-style="getUtilityStyle"
          :left-spacer-width="leftSpacerWidth"
          :right-spacer-width="rightSpacerWidth"
          :get-sort-direction="getSortDirection"
          :get-sort-index="getSortIndex"
          :get-pinning="getPinning"
          :content-min-width="gridContentWidth"
          :fill-field="fillField"
          :filterable-columns="filterableColumns"
          @toggle-all="toggleAll"
          @column-menu-action="onColumnMenuAction"
          @column-drag-start="startColumnDrag"
          @column-filter-apply="onColumnFilterApply"
          @column-filter-remove="onColumnFilterRemove"
          @column-filter-reorder="onColumnFilterReorder"
          @column-sort="onColumnSort"
        />

        <MrxGridFilterRow
          v-if="hasFilterRow"
          :columns="renderCenterColumns"
          :pinned-left-columns="leftColumns"
          :pinned-right-columns="rightColumns"
          :has-pinned="hasPinned"
          :selectable="selectable"
          :expandable="expandable"
          :show-row-numbers="hasFormulaColumns"
          :filters="filters"
          :get-column-width="getColumnWidth"
          :get-pinned-style="getPinnedStyle"
          :get-utility-style="getUtilityStyle"
          :left-spacer-width="leftSpacerWidth"
          :right-spacer-width="rightSpacerWidth"
          :content-min-width="gridContentWidth"
          :fill-field="fillField"
          @filter-change="setFilter"
        />
      </div>

      <!-- Empty state — fires both when the input array is empty AND when
         filters reduce the visible set to zero. The variant in the card
         (pristine vs filtered) is driven by `hasActiveFilters` so the
         user sees the right call-to-action. -->
      <slot
        v-if="
          !props.loading && !props.error && (props.rows.length === 0 || renderableRows.length === 0)
        "
        name="empty"
        :has-filters="hasActiveFilters"
        :clear-filters="clearFilters"
      >
        <MrxGridEmptyState :has-filters="hasActiveFilters" @clear-filters="clearFilters">
          <template #actions="actionsScope">
            <!-- Consumer hook: drop "Add row" / "Import CSV" / etc. here.
               The scope exposes the variant ('filtered' | 'pristine') so
               actions can adapt their copy / icon to the situation. -->
            <slot name="empty-actions" v-bind="actionsScope" />
          </template>
        </MrxGridEmptyState>
      </slot>

      <MrxGridBody
        v-else
        :virtual="virtualScroll || paginationEnabled"
        :grid-content-width="gridContentWidth"
        :total-height="totalHeight"
        :offset-y="offsetY"
        :render-range="renderRange"
        :columns="renderCenterColumns"
        :left-columns="leftColumns"
        :right-columns="rightColumns"
        :has-pinned="hasPinned"
        :selectable="selectable"
        :expandable="expandable"
        :show-row-numbers="hasFormulaColumns"
        :get-render-row="getRenderRow"
        :is-row-selected="isRowSelected"
        :is-expanded="isExpanded"
        :is-group-expanded="isGroupExpanded"
        :active-field-for-row="activeFieldForRow"
        :editing-field-for-row="editingFieldForRow"
        :editing-draft="editingCell?.draftValue"
        :get-cell-flags="getCellFlags"
        :get-column-width="getColumnWidth"
        :get-pinned-style="getPinnedStyle"
        :get-utility-style="getUtilityStyle"
        :left-spacer-width="leftSpacerWidth"
        :right-spacer-width="rightSpacerWidth"
        :fill-field="fillField"
        @toggle-select="(i: number, e?: MouseEvent) => handleToggleRow(getRenderRow(i), i, e)"
        @toggle-expand="(i: number) => toggleExpansion(i)"
        @activate-cell="(i: number, field: string, e: MouseEvent) => onActivateCell(i, field, e)"
        @edit-start="(i: number, field: string) => onEditStart(i, field)"
        @edit-input="onEditInput"
        @edit-commit="onEditCommit"
        @edit-cancel="onEditCancel"
        @edit-blur="onEditBlur"
        @fill-handle-mousedown="onFillHandleMousedown"
        @toggle-group="toggleGroupExpand"
      >
        <template v-if="$slots.cell" #cell="cellSlot">
          <slot name="cell" v-bind="cellSlot" />
        </template>
        <template v-if="$slots['expand-row']" #expand-row="slotProps">
          <slot name="expand-row" v-bind="slotProps" />
        </template>
      </MrxGridBody>
    </div>

    <!-- Floating selection bar -->
    <MrxGridSelectionBar
      v-if="showActionBar"
      :selected-count="actionBarCount"
      :mode="actionBarMode"
      :selection-model="selectionModel"
      :total-count="selectionTotalCount"
      :page-count="visiblePageRowCount"
      :page-fully-selected="isPageFullySelected"
      :compact="props.selectionBarCompact"
      show-edit
      :show-copy="true"
      :show-paste="mergedColumns.some((c) => c.editable)"
      :show-delete="actionBarMode === 'cell' || hasBulkDeleteListener"
      @clear="onActionBarClear"
      @edit="onActionBarEdit"
      @copy="onActionBarCopy"
      @paste="onActionBarPaste"
      @delete="onActionBarDelete"
      @select-all="selectAll"
    >
      <template v-if="$slots['selection-actions']" #actions="slotProps">
        <slot name="selection-actions" v-bind="slotProps" />
      </template>
    </MrxGridSelectionBar>

    <!-- Footer (pagination + async loading indicator) -->
    <MrxGridFooter
      :show-pagination="paginationEnabled"
      :current-page="paginationState.currentPage.value"
      :page-size="paginationState.pageSize.value"
      :total-pages="paginationState.totalPages.value"
      :total-rows="paginationState.totalRows.value"
      :range-start="paginationState.rangeStart.value"
      :range-end="paginationState.rangeEnd.value"
      :page-size-options="paginationState.pageSizeOptions"
      @update:page-size="paginationState.setPageSize"
      @update:current-page="paginationState.setPage"
      @prev="paginationState.prevPage"
      @next="paginationState.nextPage"
    />
  </div>
</template>

<style scoped lang="scss">
.mrx-grid-root {
  position: relative;
  font-family: var(--font-family), sans-serif;
  // Make the root flex-friendly so it can fill a constrained parent (e.g.
  // a fixed-height card or a `display: flex; flex-direction: column` host).
  // `min-height: 0` is the standard escape hatch for nested flex shrink.
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.mrx-grid-root--fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: var(--color-background-primary);
}

.mrx-grid-root--fullscreen .mrx-grid-wrapper {
  flex: 1;
  height: auto !important;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-bottom: none;
}

.mrx-grid-wrapper {
  overflow: auto;
  background: var(--color-background-primary);
  border-radius: 1rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  font-size: m.get-font-size('100');
  color: var(--color-text-primary);
  outline: none;
  user-select: none;
  // Fill remaining vertical space inside `.mrx-grid-root` so the wrapper —
  // not the page — owns vertical scrolling whenever the host constrains
  // height (fullscreen, fixed card, paginated/virtualScroll). Without this
  // the wrapper would size to its intrinsic content and the parent would
  // clip rows below the visible viewport. `min-height: 0` allows the flex
  // item to shrink below its content size.
  flex: 1;
  min-height: 0;
}

.mrx-grid-wrapper--virtual {
  will-change: scroll-position;
}

.mrx-grid-wrapper--paginated {
  border-radius: m.get-radius('m') m.get-radius('m') 0 0;
  border-bottom: none;
}

.mrx-grid-sticky-header {
  position: sticky;
  top: 0;
  z-index: 3;
}

.mrx-grid-body {
  position: relative;
}

.mrx-grid-sizer {
  position: relative;
}

.mrx-grid-top-spacer {
  flex-shrink: 0;
}

// Density only affects body cells — the header height stays constant so
// column controls (sort, kebab menu, filters) stay at the same vertical
// position regardless of how dense the data rows are.
.mrx-grid-wrapper--compact :deep(.mrx-grid-cell) {
  padding-top: m.get-spacing('025');
  padding-bottom: m.get-spacing('025');
  font-size: m.get-font-size('50');
}

.mrx-grid-wrapper--comfortable :deep(.mrx-grid-cell) {
  padding-top: m.get-spacing('150');
  padding-bottom: m.get-spacing('150');
}
</style>

<style>
/* Formula ref-highlight palette — non-scoped so the CSS custom properties
 * resolve from any cell in the grid (scoped styles can only target one
 * Vue component's data-v hash). Override these on `:root` or any
 * scoping ancestor to rebrand the colours. */
:root {
  --moz-grid-ref-color-0: #1a73e8;
  --moz-grid-ref-color-1: #34a853;
  --moz-grid-ref-color-2: #fbbc04;
  --moz-grid-ref-color-3: #ea4335;
  --moz-grid-ref-color-4: #9c27b0;
  --moz-grid-ref-color-5: #00838f;
  --moz-grid-ref-color-6: #f06292;
  --moz-grid-ref-color-7: #5e35b1;
}

/* Column-move dim — applied to every cell of the column being dragged.
 * Reactive class binding from each cell (via the slot context) so it
 * applies/removes atomically with the Vue render. No transition: a
 * fade-in/out would flicker on every reorder commit during the drag. */
.mrx-grid-cell--moving,
.mrx-grid-header-cell--moving {
  opacity: 0.45;
  outline: 1px dashed var(--color-text-accent, #2563eb);
  outline-offset: -1px;
  background: rgba(37, 99, 235, 0.05);
}

/* Force the grabbing cursor everywhere inside the wrapper while a column
 * is being dragged. Without this, header cells with `cursor: grab` and
 * body cells with their own cursor would override the document-level
 * grabbing — making the cursor icon flicker between grab / grabbing /
 * default as the pointer moves across cell boundaries. */
.mrx-grid-wrapper[data-moving-field],
.mrx-grid-wrapper[data-moving-field] * {
  cursor: grabbing !important;
}

/* Live drag animation — every cell with a `data-field` smoothly
 * interpolates its `transform` while a column is being dragged. The
 * composable mutates `style.transform` on cells directly (no Vue
 * re-render involved) so live reorders don't trigger the cascade that
 * caused the previous flicker. */
.mrx-grid-wrapper[data-moving-field]:not([data-col-drop-commit]) [data-field] {
  transition: transform 220ms cubic-bezier(0.2, 0.7, 0.4, 1);
  will-change: transform;
}

/* During the drop commit (between mouseup → Vue's render flush) we
 * disable the transition so the transform-clear + DOM reorder happen
 * atomically with no visible animation. The combined effect is that
 * cells stay at their final visual position seamlessly. */
.mrx-grid-wrapper[data-col-drop-commit] [data-field] {
  transition: none !important;
}
</style>
