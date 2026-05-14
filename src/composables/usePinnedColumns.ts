import { computed, isRef, unref, type CSSProperties, type MaybeRef, type Ref } from 'vue'
import type { ColumnDef } from '@/components/MrxGrid/types'

const DEFAULT_WIDTH = 150

function parsePx(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  if (value.endsWith('px')) {
    const n = parseFloat(value)
    if (!Number.isNaN(n)) return n
  }
  return fallback
}

export interface PinnedColumnsOptions {
  columns: Ref<ColumnDef[]>
  getColumnWidth: (field: string) => string | undefined
  /** Width of the row-number column in px (0 if disabled). Sits leftmost.
   *  Reactive — pass a ref / computed when the value can flip at runtime
   *  (e.g. when a formula column is added). */
  rowNumWidth?: MaybeRef<number>
  /** Width of the checkbox column in px (0 if not selectable). */
  selectableWidth?: MaybeRef<number>
  /** Width of the expand column in px (0 if not expandable). */
  expandableWidth?: MaybeRef<number>
}

/**
 * Splits columns into left-pinned, center (unpinned), and right-pinned groups.
 * Computes CSS sticky offsets so pinned columns stay visible during horizontal scroll.
 *
 * ## Layout
 *
 * ```
 * [checkbox?] [expand?] [left-pinned] [center (scrollable/virtual)] [right-pinned]
 * ```
 *
 * Left-pinned columns use `position: sticky; left: Npx`.
 * Right-pinned columns use `position: sticky; right: Npx`.
 * Checkbox and expand columns are implicitly pinned-left when any pinned column exists.
 */
export function usePinnedColumns(options: PinnedColumnsOptions) {
  const { columns, getColumnWidth } = options
  const rowNumWidth = computed(() => unref(options.rowNumWidth) ?? 0)
  const selectableWidth = computed(() => unref(options.selectableWidth) ?? 0)
  const expandableWidth = computed(() => unref(options.expandableWidth) ?? 0)

  function resolveWidth(col: ColumnDef): number {
    return parsePx(getColumnWidth(col.field) ?? col.width, DEFAULT_WIDTH)
  }

  const leftColumns = computed(() => columns.value.filter((c) => c.pinned === 'left'))

  const centerColumns = computed(() =>
    columns.value.filter((c) => c.pinned !== 'left' && c.pinned !== 'right'),
  )

  const rightColumns = computed(() => columns.value.filter((c) => c.pinned === 'right'))

  const hasPinned = computed(() => leftColumns.value.length > 0 || rightColumns.value.length > 0)

  /** Base left offset = sum of utility column widths. */
  const utilityWidth = computed(
    () => rowNumWidth.value + selectableWidth.value + expandableWidth.value,
  )

  /** Cumulative left offsets for each left-pinned column. */
  const leftOffsets = computed(() => {
    const offsets: number[] = []
    let acc = utilityWidth.value
    for (const col of leftColumns.value) {
      offsets.push(acc)
      acc += resolveWidth(col)
    }
    return offsets
  })

  /** Cumulative right offsets for each right-pinned column (from right edge inward). */
  const rightOffsets = computed(() => {
    const cols = rightColumns.value
    const offsets: number[] = Array.from<number>({ length: cols.length })
    let acc = 0
    for (let i = cols.length - 1; i >= 0; i--) {
      offsets[i] = acc
      acc += resolveWidth(cols[i]!)
    }
    return offsets
  })

  /**
   * Returns a CSS style object for a pinned column cell.
   * `isHeader` controls z-index (header pinned = 3, body pinned = 2).
   * Body pinned cells use z-index 2 so they stack above active/selected
   * center cells (z-index 1) during horizontal scroll.
   */
  function getPinnedStyle(side: 'left' | 'right', index: number, isHeader: boolean): CSSProperties {
    if (side === 'left') {
      return {
        position: 'sticky',
        left: `${leftOffsets.value[index] ?? 0}px`,
        zIndex: isHeader ? 3 : 2,
      }
    }
    return {
      position: 'sticky',
      right: `${rightOffsets.value[index] ?? 0}px`,
      zIndex: isHeader ? 3 : 2,
    }
  }

  /**
   * Returns sticky style for checkbox or expand utility columns.
   * These are implicitly pinned-left when any pinned column exists.
   */
  function getUtilityStyle(
    type: 'rownum' | 'checkbox' | 'expand',
    isHeader: boolean,
  ): CSSProperties | undefined {
    // Row-number column is implicitly sticky-left even without pinned data
    // columns — it's a navigation aid for formula refs and must stay visible
    // during horizontal scroll regardless of pinned config.
    const stickyAlways = type === 'rownum'
    if (!hasPinned.value && !isHeader && !stickyAlways) return undefined

    const base: CSSProperties = {}

    if (isHeader) {
      base.position = 'sticky'
      base.top = '0px'
      base.zIndex = hasPinned.value || stickyAlways ? 3 : 2
    }

    if (hasPinned.value || stickyAlways) {
      base.position = 'sticky'
      base.left =
        type === 'rownum'
          ? '0px'
          : type === 'checkbox'
            ? `${rowNumWidth.value}px`
            : `${rowNumWidth.value + selectableWidth.value}px`
      if (!isHeader) base.zIndex = 2
    }

    return base
  }

  /** Total width of all left-pinned columns + utility columns. */
  const leftTotalWidth = computed(
    () => utilityWidth.value + leftColumns.value.reduce((s, c) => s + resolveWidth(c), 0),
  )

  /** Total width of all right-pinned columns. */
  const rightTotalWidth = computed(() =>
    rightColumns.value.reduce((s, c) => s + resolveWidth(c), 0),
  )

  return {
    leftColumns,
    centerColumns,
    rightColumns,
    hasPinned,
    leftTotalWidth,
    rightTotalWidth,
    getPinnedStyle,
    getUtilityStyle,
  }
}
