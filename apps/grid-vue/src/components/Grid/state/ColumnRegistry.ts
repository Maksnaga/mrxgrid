/**
 * ColumnRegistry — Vue equivalent of Angular `@ContentChildren(AdeoGridColumnDef)`.
 *
 * `<ad-grid-vue>` provides a registry. Each `<ad-grid-column>` child registers itself
 * in `onMounted` and unregisters in `onScopeDispose`. The grid merges the
 * registered columns with the imperative `:columns` prop (registered columns
 * take priority for matching `field`s, since the consumer presumably expressed
 * the slot intent declaratively).
 */

import { inject, type InjectionKey, type Slot } from 'vue'
import type { ColumnDef } from '../types'

export interface ColumnRegistration {
  /** Stable id (typically `field`) used to dedupe registrations. */
  id: string
  /** The column definition produced by `<ad-grid-column>` (reactive snapshot). */
  def: ColumnDef
  /** Order — auto-incremented at registration time so siblings stay stable. */
  order: number
  /** True when the column owns a `#cell` slot. */
  hasCellSlot: boolean
  hasEditSlot: boolean
  hasFilterSlot: boolean
  hasHeaderSlot: boolean
  /** Slot references — read by `AdGridCell` / `AdGridHeaderCell` via the
   *  `GridSlots` injection. Optional: when no slot is provided, the
   *  generic grid-level slot (or built-in fallback) is used instead. */
  cellSlot?: Slot
  editSlot?: Slot
  filterSlot?: Slot
  headerSlot?: Slot
}

export interface ColumnRegistry {
  register(reg: ColumnRegistration): void
  unregister(id: string): void
  /** Read snapshot of all registered columns, sorted by `order`. */
  list(): ColumnRegistration[]
}

export const GRID_COLUMN_REGISTRY_KEY: InjectionKey<ColumnRegistry> = Symbol(
  'ColumnRegistry',
)

/** Type-safe inject helper. Returns `null` when no registry is provided —
 *  consumers using only `:columns` prop don't need to create a registry. */
export function injectColumnRegistry(): ColumnRegistry | null {
  return inject(GRID_COLUMN_REGISTRY_KEY, null)
}
