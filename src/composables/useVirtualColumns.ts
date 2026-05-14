import { computed, onUnmounted, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import type { ColumnDef } from '@/components/MrxGrid/types'

const DEFAULT_COL_WIDTH = 150

export interface VirtualColumnsOptions {
  columns: Ref<ColumnDef[]>
  getColumnWidth?: (field: string) => string | undefined
  overscan?: number
  defaultWidth?: number
  /** When false, `_compute` is short-circuited and the spacer widths stay
   *  at `'0px'` — see callers that toggle this via the `virtualColumns` prop. */
  enabled?: Ref<boolean> | boolean
}

/** Parse a CSS px value to a number. Returns fallback for non-px or missing values. */
function parsePx(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  if (value.endsWith('px')) {
    const n = parseFloat(value)
    if (!Number.isNaN(n)) return n
  }
  return fallback
}

/**
 * Find the rightmost index whose value is ≤ target via binary search.
 * `positions` must be sorted ascending (cumulative offsets always are).
 * Returns -1 if target < positions[0].
 */
function upperBound(positions: number[], target: number): number {
  let lo = 0
  let hi = positions.length - 1
  let result = -1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if ((positions[mid] ?? 0) <= target) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return result
}

/**
 * Horizontal virtualization.
 *
 * Same rAF + shallowRef pattern as useVirtualScroll:
 * - `onHorizontalScroll(scrollLeft, containerWidth)` is called by the parent
 *   scroll handler with raw numbers — no reactive ref written on every pixel.
 * - A single rAF is scheduled per paint frame; all shallowRefs are written
 *   atomically only when the visible column window actually shifts.
 * - `colPositions` stays as a `computed` because it only changes on column
 *   layout changes (resize/add/remove), never during scroll.
 */
export function useVirtualColumns(options: VirtualColumnsOptions) {
  const {
    columns,
    getColumnWidth,
    overscan = 2,
    defaultWidth = DEFAULT_COL_WIDTH,
    enabled = true,
  } = options
  const enabledRef = computed(() =>
    typeof enabled === 'boolean' ? enabled : enabled.value,
  )

  function resolveWidth(col: ColumnDef): number {
    const resolved = getColumnWidth ? getColumnWidth(col.field) : undefined
    return parsePx(resolved ?? col.width, defaultWidth)
  }

  /**
   * Cumulative left-edge positions — only recomputes on column layout change.
   * colPositions[i] = left edge of column i in px.
   * colPositions[cols.length] = total width.
   */
  const colPositions: ComputedRef<number[]> = computed(() => {
    const cols = columns.value
    const pos: number[] = Array.from<number>({ length: cols.length + 1 })
    pos[0] = 0
    for (let i = 0; i < cols.length; i++) {
      pos[i + 1] = (pos[i] ?? 0) + resolveWidth(cols[i]!)
    }
    return pos
  })

  const totalWidth = computed(() => {
    const pos = colPositions.value
    return pos[pos.length - 1] ?? 0
  })

  // --- shallowRef outputs (never derived via computed from scrollLeft) ---
  const startColIndex = shallowRef(0)
  const endColIndex = shallowRef(columns.value.length)
  const visibleColumns = shallowRef<ColumnDef[]>(columns.value.slice())
  const leftSpacerWidth = shallowRef('0px')
  const rightSpacerWidth = shallowRef('0px')

  // Raw scroll state — NOT reactive.
  let _scrollLeft = 0
  let _containerWidth = 0
  let _rafId = 0

  function _compute() {
    _rafId = 0
    // When virtualisation is off, leave the visible window covering all
    // columns and the spacers at `0px`. Bypasses the `_containerWidth = 0`
    // edge case on first paint (which used to slice the columns down to
    // the first 2 and produce a phantom right-side spacer).
    if (!enabledRef.value) {
      const cols = columns.value
      if (startColIndex.value !== 0) startColIndex.value = 0
      if (endColIndex.value !== cols.length) endColIndex.value = cols.length
      const prev = visibleColumns.value
      const same = prev.length === cols.length && prev.every((c, i) => c.field === cols[i]?.field)
      if (!same) visibleColumns.value = cols.slice()
      if (leftSpacerWidth.value !== '0px') leftSpacerWidth.value = '0px'
      if (rightSpacerWidth.value !== '0px') rightSpacerWidth.value = '0px'
      return
    }
    const pos = colPositions.value
    const cols = columns.value
    const left = _scrollLeft
    const right = left + _containerWidth
    const os = overscan

    const idxL = upperBound(pos, left)
    const ns = Math.max(0, Math.max(0, idxL - 1) - os)

    const idxR = upperBound(pos, right)
    const ne = Math.min(cols.length, Math.min(cols.length, idxR) + os)

    // Write-on-change guard — skip re-render if window didn't shift
    // AND the columns within the window are the same (order may change).
    if (ns === startColIndex.value && ne === endColIndex.value) {
      const prev = visibleColumns.value
      const same = prev.length === ne - ns && prev.every((c, i) => c.field === cols[ns + i]?.field)
      if (same) return
    }

    startColIndex.value = ns
    endColIndex.value = ne
    visibleColumns.value = cols.slice(ns, ne)
    leftSpacerWidth.value = `${pos[ns] ?? 0}px`
    rightSpacerWidth.value = `${Math.max(0, (pos[pos.length - 1] ?? 0) - (pos[ne] ?? 0))}px`
  }

  /**
   * Call this from the parent scroll handler with raw numbers.
   * Schedules ONE rAF per paint frame — multiple scroll events between
   * two paints collapse into a single _compute call.
   */
  function onHorizontalScroll(scrollLeft: number, containerWidth: number) {
    _scrollLeft = scrollLeft
    _containerWidth = containerWidth
    if (_rafId === 0) {
      _rafId = requestAnimationFrame(_compute)
    }
  }

  onUnmounted(() => {
    if (_rafId) cancelAnimationFrame(_rafId)
  })

  // Re-compute immediately when columns or their widths change. Also fires
  // when `enabled` flips so toggling virtualisation on/off re-syncs the
  // visible window without waiting for a scroll event.
  watch(
    [colPositions, () => columns.value.length, enabledRef],
    () => {
      if (_rafId) {
        cancelAnimationFrame(_rafId)
        _rafId = 0
      }
      _compute()
    },
    { immediate: true },
  )

  return {
    visibleColumns,
    startColIndex,
    endColIndex,
    leftSpacerWidth,
    rightSpacerWidth,
    totalWidth,
    resolveWidth,
    onHorizontalScroll,
  }
}
