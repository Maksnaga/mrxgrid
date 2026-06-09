/**
 * Grid-scoped service that bridges the formula editor and the cells.
 *
 * Responsibilities:
 *   - Owns the list of `RefHighlight`s describing which cells are
 *     referenced by the formula currently being edited.
 *   - Exposes a per-cell lookup (`colorByCell`) consumed by
 *     `AdeoGridCellComponent` to render coloured borders.
 *   - Acts as a message bus for click-to-pick: cells emit `pickCell` /
 *     `pickRange` events, the active editor receives them through a
 *     registered `PickHandler`.
 *
 * The service has *no* behaviour when no editor is active — `isActive`
 * stays `false`, the signal maps stay empty, and no CPU is spent in cell
 * templates. This keeps the grid zero-cost for consumers that never use
 * formulas.
 */

import { Injectable, Signal, computed, signal } from '@angular/core';
import type { CellAddress } from '../../models/formula.model';
import { FormulaRefPalette, paletteColorVar } from './formula-ref-palette';

export interface RefHighlight {
  /** Normalised key (e.g. `"A1"`, `"A1:B3"`). Drives the colour slot. */
  readonly key: string;
  /** Source-relative character range of the token in the edit buffer. */
  readonly tokenStart: number;
  readonly tokenEnd: number;
  /** Resolved cells covered by the ref (1 entry for a simple ref). */
  readonly cells: readonly CellAddress[];
  readonly colorIndex: number;
  /** `var(--ad-grid-ref-color-N)` — ready to use in `[style]` bindings. */
  readonly cssVar: string;
}

export interface PickHandler {
  pickCell(addr: CellAddress, opts: { absolute: boolean }): void;
  pickRangeStart(addr: CellAddress, opts: { absolute: boolean }): void;
  pickRangeExtend(end: CellAddress): void;
  pickRangeCommit(): void;
}

function cellKey(addr: CellAddress): string {
  return `${addr.rowId}|${addr.field}`;
}

@Injectable()
export class FormulaRefHighlightService {
  private readonly palette = new FormulaRefPalette();

  private readonly highlightsSignal = signal<readonly RefHighlight[]>([]);
  private readonly isActiveSignal = signal(false);
  private readonly isPickModeSignal = signal(false);
  private readonly isPickDraggingSignal = signal(false);

  readonly highlights: Signal<readonly RefHighlight[]> = this.highlightsSignal.asReadonly();
  /** `true` while any formula editor is active — used by cells/headers to
   *  render ref-color borders and column-letter badges. Orthogonal to
   *  pick mode: a text-only editor (e.g. the formula bar) still marks itself
   *  active so highlights appear, but never flips pick mode on. */
  readonly isActive: Signal<boolean> = this.isActiveSignal.asReadonly();
  /** `true` when cell clicks should be intercepted to insert refs into the
   *  active editor. The formula bar deliberately disables this to keep its
   *  input purely text-driven. */
  readonly isPickMode: Signal<boolean> = this.isPickModeSignal.asReadonly();
  /** `true` between `pickRangeStart` and `pickRangeCommit` — used by cells
   *  to know that a mouseenter should extend the range being built. */
  readonly isPickDragging: Signal<boolean> = this.isPickDraggingSignal.asReadonly();

  /** `rowId|field` → CSS var — used by grid cells to paint ref borders. */
  readonly colorByCell: Signal<ReadonlyMap<string, string>> = computed(() => {
    const map = new Map<string, string>();
    for (const h of this.highlightsSignal()) {
      for (const cell of h.cells) {
        map.set(cellKey(cell), h.cssVar);
      }
    }
    return map;
  });

  private pickHandler: PickHandler | null = null;

  /**
   * Called by the editor on mount. Registers the handler used by cells
   * to dispatch pick events.
   *
   * `isActive` flips on unconditionally so cells paint ref-color borders
   * and headers show column-letter badges — the *visual* feedback is
   * useful in both inline and formula-bar editors.
   *
   * `pickMode` (default `true`) controls whether cell clicks are
   * intercepted to insert refs. The formula bar passes `false` so typing
   * stays keyboard-only and normal cell selection keeps working.
   */
  activate(handler: PickHandler, options?: { pickMode?: boolean }): void {
    this.pickHandler = handler;
    this.isActiveSignal.set(true);
    this.isPickModeSignal.set(options?.pickMode ?? true);
  }

  /** Called on editor teardown. Resets state + palette. */
  deactivate(): void {
    this.pickHandler = null;
    this.isActiveSignal.set(false);
    this.isPickModeSignal.set(false);
    this.isPickDraggingSignal.set(false);
    this.highlightsSignal.set([]);
    this.palette.clear();
  }

  /** Produce a {index, cssVar} pair for a normalised ref key. */
  colorFor(key: string): { index: number; cssVar: string } {
    const index = this.palette.indexFor(key);
    return { index, cssVar: paletteColorVar(index) };
  }

  /** Replaces the highlight list — typically from an editor effect. */
  setHighlights(next: readonly RefHighlight[]): void {
    this.highlightsSignal.set(next);
  }

  // ─── Pick API — called by cells ──────────────────────────────────────────

  pickCell(addr: CellAddress, opts: { absolute: boolean }): void {
    this.pickHandler?.pickCell(addr, opts);
  }
  pickRangeStart(addr: CellAddress, opts: { absolute: boolean }): void {
    this.isPickDraggingSignal.set(true);
    this.pickHandler?.pickRangeStart(addr, opts);
  }
  pickRangeExtend(end: CellAddress): void {
    if (!this.isPickDraggingSignal()) return;
    this.pickHandler?.pickRangeExtend(end);
  }
  pickRangeCommit(): void {
    if (!this.isPickDraggingSignal()) return;
    this.isPickDraggingSignal.set(false);
    this.pickHandler?.pickRangeCommit();
  }
}
