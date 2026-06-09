/**
 * AutosizeEngine — measures cell content via canvas `measureText` (layout-free)
 * and writes the resulting width to `state.columnStates[].currentWidth`.
 *
 * Ported from Vue `useAutosize.ts` (mrxgrid/src/composables/useAutosize.ts).
 * Spec: REFONTE-PLAN-V2 task B8.
 *
 * TODO(adeo-sync): grid.ts must inject AutosizeEngine and call
 * `autosizeAllColumns()` once after the first data render (AfterViewInit +
 * state.sourceData set). The "Autosize column" / "Autosize all columns"
 * header menu actions must also call the appropriate method here.
 */

import { Injectable, inject } from '@angular/core';
import { GridStateManager } from '../state/grid-state';

/** Maximum rows sampled per column. */
const SAMPLE_CAP = 1000;

/** Absolute minimum column width in px. */
const MIN_WIDTH = 50;

/** Hard cap — no column exceeds this regardless of content. */
const MAX_WIDTH = 800;

/**
 * Extra pixels added to the canvas-measured content width to absorb
 * canvas↔DOM measurement divergence (kerning, ligatures) plus left/right
 * cell padding and a small ellipsis safety buffer.
 */
const PADDING_PX = 24;

/**
 * Header-specific affordance: sort indicator (~14 px) + gap + kebab
 * trigger (~28 px with padding). Layered on top of `PADDING_PX` for
 * header-text width calculation only.
 */
const HEADER_AFFORDANCE = 52;

// Module-level canvas singleton — avoids GC pressure when autosizing
// many columns in a single "Autosize all" pass.
let measurementCanvas: HTMLCanvasElement | null = null;

function getMeasurementCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measurementCanvas) measurementCanvas = document.createElement('canvas');
  return measurementCanvas.getContext('2d');
}

/** CSS-escape a value for use in attribute selectors. */
function cssEscape(value: string): string {
  const css = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS;
  if (css?.escape) return css.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}

@Injectable()
export class AutosizeEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  /**
   * Options accepted by `autosizeColumn` / `autosizeAllColumns`.
   */

  /**
   * Autosize a single column. Measures content via canvas and updates
   * `state.columnStates[field].currentWidth`.
   *
   * @param field     Column field identifier.
   * @param wrapperEl Optional DOM wrapper element for font sampling and
   *                  custom-renderer DOM probe. When `null`, font defaults
   *                  to `14px sans-serif` and the DOM probe is skipped.
   * @param options   Optional overrides. `maxWidth` caps the computed width
   *                  (default: 800 px).
   */
  autosizeColumn(
    field: string,
    wrapperEl: HTMLElement | null = null,
    options?: { maxWidth?: number },
  ): void {
    const ctx = getMeasurementCtx();
    if (!ctx) return;

    const env = this.sampleCellEnv(wrapperEl, field, ctx);
    const width = this.measureColumn(field, env, ctx, wrapperEl, options?.maxWidth);
    if (width == null) return;
    this.state.updateColumnState(field, { currentWidth: width });
  }

  /**
   * Autosize all currently visible columns in a single pass.
   * Hoists the `getComputedStyle` DOM read outside the per-column loop so
   * the style-recalc cost is O(1) instead of O(n-columns).
   *
   * @param wrapperEl Optional DOM wrapper element (same as `autosizeColumn`).
   * @param options   Optional overrides. `maxWidth` caps the computed width
   *                  (default: 800 px).
   */
  autosizeAllColumns(wrapperEl: HTMLElement | null = null, options?: { maxWidth?: number }): void {
    const ctx = getMeasurementCtx();
    if (!ctx) return;

    // Single shared env for all columns — all `.ad-grid-cell` share the
    // same font / padding, so one sample is representative for everyone.
    const env = this.sampleCellEnv(wrapperEl, null, ctx);

    for (const col of this.state.visibleColumns()) {
      const width = this.measureColumn(col.field, env, ctx, wrapperEl, options?.maxWidth);
      if (width != null) {
        this.state.updateColumnState(col.field, { currentWidth: width });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Sample a real grid cell to extract the canvas font string and the
   * horizontal padding/border reserve. Hoisted so "autosize all" can call
   * it once and share the result across every column.
   */
  private sampleCellEnv(
    wrapperEl: HTMLElement | null,
    field: string | null,
    ctx: CanvasRenderingContext2D,
  ): { reserve: number; borderX: number } {
    if (!wrapperEl) {
      // No DOM available — fall back to a reasonable default font.
      ctx.font = '14px sans-serif';
      return { reserve: PADDING_PX, borderX: 0 };
    }

    const sample = this.pickStyleSample(wrapperEl, field ?? '');
    const cs = window.getComputedStyle(sample);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const padX =
      (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const borderX =
      (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    return { reserve: padX + borderX + 4 /* safety pad */, borderX };
  }

  private measureColumn(
    field: string,
    env: { reserve: number; borderX: number },
    ctx: CanvasRenderingContext2D,
    wrapperEl: HTMLElement | null,
    maxWidthOverride?: number,
  ): number | null {
    const def = this.state.columnDefMap().get(field);
    if (!def) return null;

    const { reserve, borderX } = env;

    const minDef = def.minWidth ? parseInt(def.minWidth, 10) : NaN;
    const maxDef = def.maxWidth ? parseInt(def.maxWidth, 10) : NaN;
    const min = Number.isFinite(minDef) ? Math.max(MIN_WIDTH, minDef) : MIN_WIDTH;
    // maxWidthOverride from caller > per-column def > module constant.
    const cap = maxWidthOverride ?? (Number.isFinite(maxDef) ? maxDef : MAX_WIDTH);

    // --- Header width ---
    const headerText = def.headerName ?? def.field;
    let maxWidth = ctx.measureText(headerText).width + reserve + HEADER_AFFORDANCE;
    if (maxWidth >= cap) return Math.max(min, Math.ceil(cap));

    // --- Body data sample ---
    const data = this.state.sourceData();
    const total = data.length;
    const stride = total > SAMPLE_CAP ? Math.ceil(total / SAMPLE_CAP) : 1;

    for (let i = 0; i < total; i += stride) {
      const row = data[i];
      if (!row) continue;
      const displayValue = this.getDisplayValue(row, def);
      const w = ctx.measureText(displayValue).width + reserve;
      if (w > maxWidth) {
        maxWidth = w;
        if (maxWidth >= cap) {
          maxWidth = cap;
          break;
        }
      }
    }

    // --- Custom cellTemplate fallback: probe rendered DOM cells ---
    // Canvas measureText only knows about the raw string. Columns with
    // cellTemplate (badge, avatar, chip…) have wider true widths. For
    // these we also read scrollWidth of the currently rendered cells.
    // Limitation: only covers rows inside the current virtual viewport.
    if (def.cellTemplate != null && wrapperEl) {
      const escaped = cssEscape(field);
      const renderedCells = wrapperEl.querySelectorAll<HTMLElement>(
        `[data-field="${escaped}"]`,
      );
      for (const cell of renderedCells) {
        const w = cell.scrollWidth + borderX + 4;
        if (w > maxWidth) {
          maxWidth = w;
          if (maxWidth >= cap) {
            maxWidth = cap;
            break;
          }
        }
      }
    }

    return Math.max(min, Math.min(cap, Math.ceil(maxWidth + PADDING_PX)));
  }

  private getDisplayValue(row: T, def: { valueGetter?: (r: T) => unknown; valueFormatter?: (v: unknown, r: T) => string; field: string }): string {
    const raw = def.valueGetter ? def.valueGetter(row) : (row as Record<string, unknown>)[def.field];
    if (def.valueFormatter) return def.valueFormatter(raw, row);
    if (raw === null || raw === undefined) return '';
    return String(raw);
  }

  /** Picks a rendered cell element to derive font/padding from. */
  private pickStyleSample(wrapper: HTMLElement, field: string): HTMLElement {
    const escaped = cssEscape(field);
    if (field) {
      const colCell = wrapper.querySelector(`[data-field="${escaped}"]`) as HTMLElement | null;
      if (colCell) return colCell;
    }
    const anyCell = wrapper.querySelector('[data-field]') as HTMLElement | null;
    return anyCell ?? wrapper;
  }
}
