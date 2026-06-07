import type { Ref } from 'vue'

import type { GridState } from '@/components/AdeoGrid/state/useGridState'
import type { ColumnDef, RowData } from '@/components/AdeoGrid/types'

const MIN_WIDTH = 50
// Header overhead: sort indicator (~14px) + gap + kebab trigger (~28px with
// padding) — measured against `AdeoGridHeaderCell.vue`.
const HEADER_AFFORDANCE = 52
// Tiny safety pad to absorb canvas-vs-DOM measurement divergence (kerning,
// ligatures, font fallbacks). Without it, a column tuned to the very last
// pixel may trigger `text-overflow: ellipsis` on the longest row.
const SAFETY_PAD = 4
// Hard cap on rows measured per column. With 100k rows × 15 columns that's
// 1.5M `measureText` calls — even canvas's near-zero-cost path adds up.
// Sampling uniformly hits the longest values in real-world data with very
// high probability; the user can still drag-resize if their data has an
// extreme outlier outside the sample.
//
// 1 000 used to be 5 000 — at 1 M rows × 58 cols the old cap meant 290 k
// `measureText` calls plus 58 `getComputedStyle` reads + 58 querySelector
// scans which kept the main thread busy for several seconds on
// "Autosize all columns". 1 000 samples × 58 cols = 58 k calls (~30 ms)
// and visually-equivalent results on real-world catalog data.
const SAMPLE_CAP = 1000

export interface UseAutosizeOptions {
  gridState: GridState<RowData>
  /** Grid wrapper element — used to sample a real cell's computed font/padding. */
  wrapperRef: Ref<HTMLElement | null>
  /** Currently rendered rows (already filtered/sorted/grouped). */
  rows: Ref<RowData[]>
}

// Module-level reuse: creating a fresh canvas per autosize call adds GC
// pressure when "autosize all columns" iterates 15+ times in a row.
let measurementCanvas: HTMLCanvasElement | null = null
function getMeasurementCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!measurementCanvas) measurementCanvas = document.createElement('canvas')
  return measurementCanvas.getContext('2d')
}

/**
 * Drives the "Autosize this column" / "Autosize all columns" header menu
 * actions. Measures rendered values via `Canvas#measureText` (layout-free)
 * and writes the result to `gridState.columnStates[].currentWidth` — the
 * same pipe `useColumnResize` uses, so pinned/virtual layout pick the new
 * width up automatically.
 *
 * **Why canvas, not a DOM probe.** The previous implementation appended an
 * offscreen `<div>` to the wrapper, set its `textContent` per row, and read
 * `offsetWidth` to measure. Each `offsetWidth` read forces a synchronous
 * layout flush; on 100k rows × N columns, the loop spent seconds inside
 * layout. `ctx.measureText` is layout-free — it returns the width directly
 * from the font metrics in O(string-length) without touching the DOM.
 *
 * **Sampling.** Rows are sampled uniformly with a stride so we never measure
 * more than `SAMPLE_CAP` rows per column. Real-world datasets cluster long
 * values (long product names tend to recur), so uniform sampling hits the
 * widest cell in the vast majority of cases.
 */
export function useAutosize(opts: UseAutosizeOptions) {
  function getDisplayValue(row: RowData, col: ColumnDef): string {
    const raw = col.valueGetter ? col.valueGetter(row) : row[col.field]
    if (col.valueFormatter) return col.valueFormatter(raw, row)
    if (raw === null || raw === undefined) return ''
    return String(raw)
  }

  function autosizeColumn(field: string): void {
    const ctx = getMeasurementCtx()
    const wrapper = opts.wrapperRef.value
    if (!ctx || !wrapper) return
    const env = sampleCellEnv(wrapper, field, ctx)
    const width = measureColumn(field, env, ctx)
    if (width == null) return
    opts.gridState.updateColumnState(field, { currentWidth: width })
  }

  function autosizeAllColumns(): void {
    const ctx = getMeasurementCtx()
    const wrapper = opts.wrapperRef.value
    if (!ctx || !wrapper) return

    // Hoist the layout-flush work out of the per-column loop. The
    // canvas font and padding/border reserve are derived from a real
    // `.mrx-grid-cell` via `getComputedStyle` — every call forces a
    // synchronous style recalc. Doing it once per column at 200+ cols
    // accumulates to seconds of layout time; doing it once for the
    // whole batch is sub-millisecond.
    //
    // Cells share the same font / padding regardless of which column
    // they belong to (all `.mrx-grid-cell` get the same styling). A
    // single sample is faithful for the body measure. The header
    // affordance is added per-column as a constant on top so it
    // doesn't depend on the sample either.
    const env = sampleCellEnv(wrapper, null, ctx)
    for (const c of opts.gridState.visibleColumns.value) {
      const width = measureColumn(c.field, env, ctx)
      if (width != null) opts.gridState.updateColumnState(c.field, { currentWidth: width })
    }
  }

  /**
   * Sample a real `.mrx-grid-cell` to derive the canvas font + the
   * padding/border reserve. Hoisted out of `measureColumn` so the
   * "autosize all" path can do it once and reuse the result across
   * every column.
   */
  function sampleCellEnv(
    wrapper: HTMLElement,
    field: string | null,
    ctx: CanvasRenderingContext2D,
  ): { reserve: number; borderX: number } {
    const sample = field ? pickStyleSample(wrapper, field) : pickStyleSample(wrapper, '')
    const cs = window.getComputedStyle(sample)
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const padX =
      (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
    const borderX =
      (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0)
    return { reserve: padX + borderX + SAFETY_PAD, borderX }
  }

  function measureColumn(
    field: string,
    env: { reserve: number; borderX: number },
    ctx: CanvasRenderingContext2D,
  ): number | null {
    const wrapper = opts.wrapperRef.value
    if (!wrapper) return null
    const def = opts.gridState.columnDefMap.value.get(field)
    if (!def) return null

    const { reserve, borderX } = env

    const minDef = def.minWidth ? parseInt(def.minWidth, 10) : NaN
    const maxDef = def.maxWidth ? parseInt(def.maxWidth, 10) : NaN
    const min = Number.isFinite(minDef) ? Math.max(MIN_WIDTH, minDef) : MIN_WIDTH
    const cap = Number.isFinite(maxDef) ? maxDef : Infinity

    // Header first — it has its own affordance overhead (sort indicator,
    // kebab trigger) layered on top of the text width.
    const headerText = def.headerName ?? def.field
    let max = ctx.measureText(headerText).width + reserve + HEADER_AFFORDANCE
    // Cap is a hard ceiling — no point measuring further if we already hit it.
    if (max >= cap) return Math.max(min, Math.ceil(cap))

    const allRows = opts.rows.value
    const total = allRows.length
    const stride = total > SAMPLE_CAP ? Math.ceil(total / SAMPLE_CAP) : 1

    for (let i = 0; i < total; i += stride) {
      const row = allRows[i]
      if (!row || row.__mrxType === 'group' || row.__mrxSkeleton) continue
      const w = ctx.measureText(getDisplayValue(row, def)).width + reserve
      if (w > max) {
        max = w
        // Early exit: hit the column's hard ceiling, no need to keep going.
        if (max >= cap) {
          max = cap
          break
        }
      }
    }

    // Custom renderer fallback — canvas `measureText` only knows about the
    // raw string value. A column whose cells render a badge, icon, avatar,
    // tag chip, etc. has a true visual width that's wider than the text
    // alone (chip padding, icon size, gap). For these columns we also
    // probe the rendered DOM cells via `scrollWidth` (which includes the
    // overflow content + padding) and keep the max of canvas-derived
    // width and DOM-measured width. Only the currently rendered cells
    // are probed (virtual scroll renders ~30 rows at a time) — that's
    // enough to catch typical custom-renderer overhead without forcing a
    // full DOM re-render.
    if (def.renderer != null) {
      const escaped = cssEscape(field)
      const renderedCells = wrapper.querySelectorAll<HTMLElement>(
        `.mrx-grid-cell[data-field="${escaped}"]`,
      )
      for (const cell of renderedCells) {
        // `scrollWidth` measures the content's intrinsic width — for a
        // cell with overflow:hidden + text-overflow:ellipsis it returns
        // the full content width before clipping (which is what we want).
        const w = cell.scrollWidth + borderX + SAFETY_PAD
        if (w > max) {
          max = w
          if (max >= cap) {
            max = cap
            break
          }
        }
      }
    }

    return Math.max(min, Math.min(cap, Math.ceil(max)))
  }

  return { autosizeColumn, autosizeAllColumns }
}

/** Picks a real `.mrx-grid-cell` so the canvas font matches the live cell. */
function pickStyleSample(wrapper: HTMLElement, field: string): HTMLElement {
  const escaped = cssEscape(field)
  const colCell = wrapper.querySelector(
    `.mrx-grid-cell[data-field="${escaped}"]`,
  ) as HTMLElement | null
  if (colCell) return colCell
  const anyCell = wrapper.querySelector('.mrx-grid-cell') as HTMLElement | null
  return anyCell ?? wrapper
}

function cssEscape(value: string): string {
  const css = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS
  if (css?.escape) return css.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}
