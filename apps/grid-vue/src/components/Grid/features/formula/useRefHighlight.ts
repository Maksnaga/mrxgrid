/**
 * Vue port of Angular `FormulaRefHighlightService` — bridges a formula
 * editor and the cells that render ref-coloured borders during edit.
 *
 * Responsibilities:
 *   - Owns the list of `RefHighlight`s describing which cells are
 *     referenced by the formula currently being edited.
 *   - Exposes a per-cell colour lookup (`colorByCell`) consumed by
 *     `AdGridCell` to render coloured borders.
 *   - Acts as a message bus for click-to-pick: cells emit `pickCell` /
 *     `pickRange*` events, the active editor receives them through a
 *     registered `PickHandler`.
 *
 * Zero-cost when no editor is active: `isActive` stays `false`, the maps
 * stay empty, no work happens in cell render paths.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { CellAddress } from '../../models/formula.model'
import { FormulaRefPalette, paletteColorVar } from './formula-ref-palette'

export interface RefHighlight {
  /** Normalised key (e.g. `"A1"`, `"A1:B3"`). Drives the colour slot. */
  readonly key: string
  /** Source-relative character range of the token in the edit buffer. */
  readonly tokenStart: number
  readonly tokenEnd: number
  /** Resolved cells covered by the ref (1 entry for a simple ref). */
  readonly cells: readonly CellAddress[]
  readonly colorIndex: number
  /** `var(--ad-grid-ref-color-N)` — ready to use in `[style]` bindings. */
  readonly cssVar: string
}

export interface PickHandler {
  pickCell(addr: CellAddress, opts: { absolute: boolean }): void
  pickRangeStart(addr: CellAddress, opts: { absolute: boolean }): void
  pickRangeExtend(end: CellAddress): void
  pickRangeCommit(): void
}

export interface RefHighlightApi {
  readonly highlights: Ref<readonly RefHighlight[]>
  /** `true` while any formula editor is active — drives ref colours + column badges. */
  readonly isActive: Ref<boolean>
  /** `true` when cell clicks should be intercepted to insert refs. */
  readonly isPickMode: Ref<boolean>
  /** `true` between `pickRangeStart` and `pickRangeCommit`. */
  readonly isPickDragging: Ref<boolean>
  /** `rowId|field` → CSS var — used by cells to paint ref borders. */
  readonly colorByCell: ComputedRef<ReadonlyMap<string, string>>

  activate(handler: PickHandler, options?: { pickMode?: boolean }): void
  deactivate(): void

  colorFor(key: string): { index: number; cssVar: string }
  setHighlights(next: readonly RefHighlight[]): void

  /** Cell-side pick events — forwarded to the active editor. */
  pickCell(addr: CellAddress, opts: { absolute: boolean }): void
  pickRangeStart(addr: CellAddress, opts: { absolute: boolean }): void
  pickRangeExtend(end: CellAddress): void
  pickRangeCommit(): void
}

function cellKey(addr: CellAddress): string {
  return `${addr.rowId}|${addr.field}`
}

export function useRefHighlight(): RefHighlightApi {
  const palette = new FormulaRefPalette()

  const highlights = ref<readonly RefHighlight[]>([])
  const isActive = ref(false)
  const isPickMode = ref(false)
  const isPickDragging = ref(false)

  const colorByCell = computed<ReadonlyMap<string, string>>(() => {
    const map = new Map<string, string>()
    for (const h of highlights.value) {
      for (const cell of h.cells) {
        map.set(cellKey(cell), h.cssVar)
      }
    }
    return map
  })

  let pickHandler: PickHandler | null = null

  function activate(handler: PickHandler, options?: { pickMode?: boolean }): void {
    pickHandler = handler
    isActive.value = true
    isPickMode.value = options?.pickMode ?? true
  }

  function deactivate(): void {
    pickHandler = null
    isActive.value = false
    isPickMode.value = false
    isPickDragging.value = false
    highlights.value = []
    palette.clear()
  }

  function colorFor(key: string): { index: number; cssVar: string } {
    const index = palette.indexFor(key)
    return { index, cssVar: paletteColorVar(index) }
  }

  function setHighlights(next: readonly RefHighlight[]): void {
    highlights.value = next
  }

  // ─── Pick API — called by cells ──────────────────────────────────────────

  function pickCell(addr: CellAddress, opts: { absolute: boolean }): void {
    pickHandler?.pickCell(addr, opts)
  }
  function pickRangeStart(addr: CellAddress, opts: { absolute: boolean }): void {
    isPickDragging.value = true
    pickHandler?.pickRangeStart(addr, opts)
  }
  function pickRangeExtend(end: CellAddress): void {
    if (!isPickDragging.value) return
    pickHandler?.pickRangeExtend(end)
  }
  function pickRangeCommit(): void {
    if (!isPickDragging.value) return
    isPickDragging.value = false
    pickHandler?.pickRangeCommit()
  }

  return {
    highlights,
    isActive,
    isPickMode,
    isPickDragging,
    colorByCell,
    activate,
    deactivate,
    colorFor,
    setHighlights,
    pickCell,
    pickRangeStart,
    pickRangeExtend,
    pickRangeCommit,
  }
}
