/**
 * AdeoColumnRegistry — Vue equivalent of Angular `@ContentChildren(MozGridColumnDef)`.
 *
 * `<AdeoGrid>` provides a registry. Each `<AdeoColumn>` child registers itself
 * in `onMounted` and unregisters in `onScopeDispose`. The grid merges the
 * registered columns with the imperative `:columns` prop (registered columns
 * take priority for matching `field`s, since the consumer presumably expressed
 * the slot intent declaratively).
 */

import { inject, type InjectionKey, type Slot } from 'vue'
import type { ColumnDef } from '../types'

export interface AdeoColumnRegistration {
  /** Stable id (typically `field`) used to dedupe registrations. */
  id: string
  /** The column definition produced by `<AdeoColumn>` (reactive snapshot). */
  def: ColumnDef
  /** Order — auto-incremented at registration time so siblings stay stable. */
  order: number
  /** True when the column owns a `#cell` slot. */
  hasCellSlot: boolean
  hasEditSlot: boolean
  hasFilterSlot: boolean
  hasHeaderSlot: boolean
  /** Slot references — read by `AdeoGridCell` / `AdeoGridHeaderCell` via the
   *  `AdeoGridSlots` injection. Optional: when no slot is provided, the
   *  generic grid-level slot (or built-in fallback) is used instead. */
  cellSlot?: Slot
  editSlot?: Slot
  filterSlot?: Slot
  headerSlot?: Slot
}

export interface AdeoColumnRegistry {
  register(reg: AdeoColumnRegistration): void
  unregister(id: string): void
  /** Read snapshot of all registered columns, sorted by `order`. */
  list(): AdeoColumnRegistration[]
}

export const ADEO_GRID_COLUMN_REGISTRY_KEY: InjectionKey<AdeoColumnRegistry> = Symbol(
  'AdeoColumnRegistry',
)

/** Type-safe inject helper. Returns `null` when no registry is provided —
 *  consumers using only `:columns` prop don't need to create a registry. */
export function injectMrxColumnRegistry(): AdeoColumnRegistry | null {
  return inject(ADEO_GRID_COLUMN_REGISTRY_KEY, null)
}
