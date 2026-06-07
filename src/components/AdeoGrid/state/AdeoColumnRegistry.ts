/**
 * MrxColumnRegistry — Vue equivalent of Angular `@ContentChildren(MozGridColumnDef)`.
 *
 * `<MrxGrid>` provides a registry. Each `<MrxColumn>` child registers itself
 * in `onMounted` and unregisters in `onScopeDispose`. The grid merges the
 * registered columns with the imperative `:columns` prop (registered columns
 * take priority for matching `field`s, since the consumer presumably expressed
 * the slot intent declaratively).
 */

import { inject, type InjectionKey, type Slot } from 'vue'
import type { ColumnDef } from '../types'

export interface MrxColumnRegistration {
  /** Stable id (typically `field`) used to dedupe registrations. */
  id: string
  /** The column definition produced by `<MrxColumn>` (reactive snapshot). */
  def: ColumnDef
  /** Order — auto-incremented at registration time so siblings stay stable. */
  order: number
  /** True when the column owns a `#cell` slot. */
  hasCellSlot: boolean
  hasEditSlot: boolean
  hasFilterSlot: boolean
  hasHeaderSlot: boolean
  /** Slot references — read by `MrxGridCell` / `MrxGridHeaderCell` via the
   *  `MrxGridSlots` injection. Optional: when no slot is provided, the
   *  generic grid-level slot (or built-in fallback) is used instead. */
  cellSlot?: Slot
  editSlot?: Slot
  filterSlot?: Slot
  headerSlot?: Slot
}

export interface MrxColumnRegistry {
  register(reg: MrxColumnRegistration): void
  unregister(id: string): void
  /** Read snapshot of all registered columns, sorted by `order`. */
  list(): MrxColumnRegistration[]
}

export const MRX_COLUMN_REGISTRY_KEY: InjectionKey<MrxColumnRegistry> = Symbol(
  'MrxColumnRegistry',
)

/** Type-safe inject helper. Returns `null` when no registry is provided —
 *  consumers using only `:columns` prop don't need to create a registry. */
export function injectMrxColumnRegistry(): MrxColumnRegistry | null {
  return inject(MRX_COLUMN_REGISTRY_KEY, null)
}
