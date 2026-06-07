/**
 * AdeoGridSlots — provides the root `<AdeoGrid>` scoped slots to deeply nested
 * subcomponents (`AdeoGridCell`, `AdeoGridHeaderCell`, `AdeoGridGroupRow`,
 * `AdeoGridDetailRow`, `AdeoGridFilterRow`) without prop-drilling slot through
 * 4–5 levels of nesting.
 *
 * Resolution order — Phase 3.3 — for each rendered cell, the consumer can
 * provide:
 *
 *   1. `#cell-{field}`   — most specific (per-column scoped slot)
 *   2. `column.renderer` — column-level Component ref
 *   3. `#cell`           — generic fallback (any cell)
 *   4. `column.valueFormatter(value, row)` — built-in text fallback
 *   5. `String(value)`
 *
 * Same pattern for `#header-{field}` / `#header`, `#filter-{field}` /
 * `#filter`, `#edit-{field}` / `#edit`. The grid-level `<AdeoColumn>` slots
 * (Phase 3.2) are merged in and take priority over both per-field and
 * generic slots from `<AdeoGrid>` itself, since the consumer expressed slot
 * intent against a specific column.
 */

import { inject, type InjectionKey, type Slot } from 'vue'
import type { AdeoColumnRegistry } from './AdeoColumnRegistry'
import type { FormulaEngine } from '../features/formula/useFormulaEngine'
import type { RefHighlightApi } from '../features/formula/useRefHighlight'

export interface AdeoGridSlotsContext {
  /** Generic `#cell` slot from the `<AdeoGrid>` root, or `undefined`. */
  cell?: Slot
  /** Generic `#header` slot. */
  header?: Slot
  /** Generic `#filter` slot. */
  filter?: Slot
  /** Generic `#edit` slot. */
  edit?: Slot
  /** Per-field slot map: `cell-status`, `header-status`, etc. */
  perField: Record<string, Slot>
  /** The column registry — slots declared on a `<AdeoColumn>` win over
   *  matching generic / per-field slots from `<AdeoGrid>`. */
  registry: AdeoColumnRegistry | null
  /** Formula engine — exposed so cells can substitute raw `=…` source values
   *  with the evaluated `FormulaValue` at render time without prop-drilling
   *  the engine through AdeoGridBody → AdeoGridRow → AdeoGridCell. */
  formula?: FormulaEngine | null
  /** Resolve a stable row id for an index — used to build a `CellAddress`
   *  (`{ rowId, field }`) when looking up formula values. Returns `undefined`
   *  when the index is out of range (group/skeleton rows). */
  resolveRowId?: (rowIndex: number) => string | undefined
  /** Ref-highlight bridge — drives the coloured borders on cells referenced
   *  by the formula being edited. Cells read `colorByCell.value.get(key)`
   *  per render to apply `--moz-grid-ref-color`. Undefined when no formula
   *  edit is active. */
  refHighlight?: RefHighlightApi | null
  /** Field name of the column currently being dragged for reorder, or
   *  `null` when no drag is active. Cells read this to apply the
   *  `--moving` dim class atomically with their normal Vue render. */
  movingField?: import('vue').Ref<string | null>
  /** Editor-side formula helpers — the cell input invokes these on its own
   *  shortcuts (e.g. `F4`) without having to know how tokens are encoded. */
  formulaActions?: {
    /** Cycle the ref token under the caret through the four absolute
     *  modes : `A1` → `$A$1` → `A$1` → `$A1` → `A1`. Pass the current
     *  caret offset (or `null` to fall back to the end of the value). */
    cycleAbsoluteAtCursor: (caret: number | null) => void
    /** Visible-column field order (left → right). Used by the formula
     *  editor to map A/B/C letters to actual fields when colourising
     *  ref tokens. */
    fieldOrder: () => readonly string[]
    /** Stable per-token colour resolver shared with the cell highlight
     *  border palette so a ref string colours both the editor span AND
     *  the matching cell border with the SAME colour. */
    colorFor: (key: string) => { index: number; cssVar: string }
  }
}

export const MRX_GRID_SLOTS_KEY: InjectionKey<AdeoGridSlotsContext> = Symbol(
  'AdeoGridSlots',
)

export function injectAdeoGridSlots(): AdeoGridSlotsContext | null {
  return inject(MRX_GRID_SLOTS_KEY, null)
}

/**
 * Resolve the cell slot for a given field — checks (in order):
 * 1. `<AdeoColumn field={field}>` `#cell` slot via the registry
 * 2. `<AdeoGrid>` `#cell-{field}` slot
 * 3. `<AdeoGrid>` `#cell` generic slot
 * Returns `undefined` if none — caller falls back to `column.renderer` or text.
 */
export function resolveCellSlot(
  ctx: AdeoGridSlotsContext | null,
  field: string,
): Slot | undefined {
  if (!ctx) return undefined
  // 1. Slot declared on <AdeoColumn> takes priority (slot lookup happens via
  //    Vue's render context — registry only knows whether it exists).
  //    The actual slot reference is stored on the registry by AdeoColumn.
  const reg = ctx.registry?.list().find((r) => r.id === field)
  if (reg?.hasCellSlot && reg.cellSlot) return reg.cellSlot
  // 2. Per-field slot on the grid root.
  const perField = ctx.perField[`cell-${field}`]
  if (perField) return perField
  // 3. Generic fallback.
  return ctx.cell
}

export function resolveHeaderSlot(
  ctx: AdeoGridSlotsContext | null,
  field: string,
): Slot | undefined {
  if (!ctx) return undefined
  const reg = ctx.registry?.list().find((r) => r.id === field)
  if (reg?.hasHeaderSlot && reg.headerSlot) return reg.headerSlot
  const perField = ctx.perField[`header-${field}`]
  if (perField) return perField
  return ctx.header
}

export function resolveFilterSlot(
  ctx: AdeoGridSlotsContext | null,
  field: string,
): Slot | undefined {
  if (!ctx) return undefined
  const reg = ctx.registry?.list().find((r) => r.id === field)
  if (reg?.hasFilterSlot && reg.filterSlot) return reg.filterSlot
  const perField = ctx.perField[`filter-${field}`]
  if (perField) return perField
  return ctx.filter
}

export function resolveEditSlot(
  ctx: AdeoGridSlotsContext | null,
  field: string,
): Slot | undefined {
  if (!ctx) return undefined
  const reg = ctx.registry?.list().find((r) => r.id === field)
  if (reg?.hasEditSlot && reg.editSlot) return reg.editSlot
  const perField = ctx.perField[`edit-${field}`]
  if (perField) return perField
  return ctx.edit
}
