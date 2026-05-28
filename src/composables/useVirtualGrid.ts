import { computed, isRef, onMounted, ref, watch, type Ref } from 'vue'
import type { ColumnDef, RowData } from '@/components/MrxGrid/types'
import { useVirtualScroll, SKELETON_ROW } from './useVirtualScroll'
import { useVirtualColumns } from './useVirtualColumns'

export interface VirtualGridOptions {
  rows: Ref<RowData[]>
  columns: Ref<ColumnDef[]>
  /** Height of each row in px. May be reactive (Ref) for density changes. */
  rowHeight: Ref<number> | number
  /** Viewport height in px (used when virtualizeRows is true). */
  containerHeight: Ref<number>
  /** Enable vertical virtualization (row axis). May be reactive. */
  virtualizeRows: Ref<boolean> | boolean
  /** Enable horizontal virtualization (column axis). May be reactive. */
  virtualizeColumns: Ref<boolean> | boolean
  /** Extra rows above/below viewport. Default 5. */
  rowOverscan?: number
  /** Extra columns left/right of viewport. Default 2. */
  columnOverscan?: number
  /** Width resolver from useColumnResize (or custom). */
  getColumnWidth?: (field: string) => string | undefined
  /**
   * Total number of rows in the full dataset (including unloaded).
   * When provided, drives scrollbar height independently of rows.length
   * so that lazy-loading never causes scroll jumps or feedback loops.
   */
  totalCount?: Ref<number>
  /**
   * Set of row indices currently expanded. Forwarded to `useVirtualScroll`
   * so it can apply variable-height math and keep the detail panel from
   * being sliced out mid-scroll. Optional — omit for the classic
   * fixed-row-height fast path.
   */
  expandedRowIndices?: Ref<Set<number>>
  /**
   * Extra height (px) added by an expanded row on top of `rowHeight`.
   * Required when `expandedRowIndices` is provided. May be reactive.
   */
  expandedRowExtraHeight?: Ref<number> | number
}

/**
 * Unified two-axis virtualization for the grid.
 *
 * Composes useVirtualScroll (rows) and useVirtualColumns (columns) behind
 * a single scroll handler that reads both scrollTop and scrollLeft from
 * the same container element. Only the visible cell window — the
 * intersection of visible rows and visible columns — is rendered.
 */
export function useVirtualGrid(options: VirtualGridOptions) {
  const {
    rows,
    columns,
    rowHeight,
    containerHeight,
    virtualizeRows,
    virtualizeColumns,
    rowOverscan = 5,
    columnOverscan = 2,
    getColumnWidth,
    totalCount,
    expandedRowIndices,
    expandedRowExtraHeight,
  } = options

  // --- Reactive boolean flags ---
  const vRows = computed(() => isRef(virtualizeRows) ? virtualizeRows.value : virtualizeRows)
  const vCols = computed(() => isRef(virtualizeColumns) ? virtualizeColumns.value : virtualizeColumns)

  // --- Shared scroll state ---
  const wrapperRef = ref<HTMLElement | null>(null)

  onMounted(() => {
    if (wrapperRef.value && vCols.value) {
      onHorizontalScroll(0, wrapperRef.value.clientWidth)
    }
  })

  // --- Reactive row height getter ---
  const rhRef = computed(() => isRef(rowHeight) ? rowHeight.value : rowHeight)

  // --- Vertical axis ---
  const {
    totalHeight,
    startIndex: startRowIndex,
    endIndex: endRowIndex,
    offsetY,
    visibleRange,
    onScroll: onRowScroll,
    getRow,
    getScrollTop,
  } = useVirtualScroll({
    rows,
    rowHeight,
    containerHeight,
    overscan: rowOverscan,
    totalCount,
    expandedRowIndices,
    expandedRowExtraHeight,
  })

  // --- Horizontal axis ---
  // `enabled: vCols` short-circuits `_compute` inside `useVirtualColumns`
  // when horizontal virtualisation is off — guarantees `rightSpacerWidth`
  // never gets a spurious non-zero value from the first-paint compute pass
  // (which used to slice columns with `_containerWidth = 0`).
  const {
    visibleColumns,
    startColIndex,
    endColIndex,
    leftSpacerWidth: rawLeftSpacer,
    rightSpacerWidth: rawRightSpacer,
    totalWidth,
    onHorizontalScroll,
  } = useVirtualColumns({
    columns,
    getColumnWidth,
    overscan: columnOverscan,
    enabled: vCols,
  })

  // --- Scroll handler ---
  function handleScroll(e: Event) {
    const target = e.target as HTMLElement
    if (vRows.value) {
      onRowScroll(e)
    }
    if (vCols.value) {
      onHorizontalScroll(target.scrollLeft, target.clientWidth)
    }
  }

  // --- Render slices ---

  /**
   * Row indices to render. When virtualization is off, returns all indices.
   */
  const renderRange = computed(() => {
    if (vRows.value) return visibleRange.value
    const len = rows.value.length
    const arr = Array.from<number>({ length: len })
    for (let i = 0; i < len; i++) arr[i] = i
    return arr
  })

  const renderColumns = computed(() => (vCols.value ? visibleColumns.value : columns.value))

  /**
   * Get row data by absolute index. Returns skeleton if not loaded.
   * When virtualization is off, reads directly from the rows array.
   */
  function getRenderRow(index: number): RowData {
    if (vRows.value) return getRow(index)
    return rows.value[index] ?? SKELETON_ROW
  }

  // --- Clamp DOM scrollTop when content height shrinks (e.g. grouping) ---
  watch(totalHeight, (newHeight) => {
    const el = wrapperRef.value
    if (!el) return
    const maxScroll = Math.max(0, newHeight - el.clientHeight)
    if (el.scrollTop > maxScroll) {
      el.scrollTop = maxScroll
    }
  })

  // --- Sync DOM scrollTop when rowHeight changes (density switch) ---
  // useVirtualScroll already adjusts its internal _scrollTop proportionally.
  // We sync the DOM element to match.
  watch(rhRef, () => {
    const el = wrapperRef.value
    if (!el) return
    el.scrollTop = getScrollTop()
  })

  // --- Column spacers (horizontal) ---
  // Bug fix: read `vCols.value` (the unwrapped boolean) instead of the
  // `virtualizeColumns` option itself — the latter is a `Ref<boolean>` and
  // therefore always truthy, which made the spacers render at full width
  // even when horizontal virtualisation was off. The combination of that
  // and the `immediate: true` watch inside `useVirtualColumns` (which runs
  // `_compute()` with `_containerWidth = 0` on first paint) produced a
  // spurious right-side gap as wide as the trailing columns.
  const leftSpacerWidth = computed(() => (vCols.value ? rawLeftSpacer.value : undefined))
  const rightSpacerWidth = computed(() => (vCols.value ? rawRightSpacer.value : undefined))

  return {
    /** Template ref — bind to the scroll container div. */
    wrapperRef,
    /** Attach to @scroll on the wrapper. */
    handleScroll,

    /** Integer array of row indices to render (v-for). */
    renderRange,
    /** Columns to render (visible slice or all). */
    renderColumns,
    /** Get row data by absolute index (skeleton-safe). */
    getRenderRow,

    /** Absolute row range currently in the window (for data source). */
    startRowIndex,
    endRowIndex,

    /** Absolute column range currently in the window. */
    startColIndex,
    endColIndex,

    /** Y offset in px for the row container translateY. */
    offsetY,

    /** Horizontal spacers — undefined when virtualizeColumns is off. */
    leftSpacerWidth,
    rightSpacerWidth,

    /** Total content height in px. */
    totalHeight,
    /** Total content width in px. */
    totalWidth,
  }
}
