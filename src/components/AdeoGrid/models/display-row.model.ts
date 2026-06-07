/**
 * Flat display-row model — Angular parity (moz-grid).
 *
 * Kept alongside the legacy `__adg`-prefixed flat shape used by the current
 * virtualizer. Phase 6 will decide whether to migrate the virtualizer to
 * this discriminated union or keep the flat `RowData & GroupRowMeta` shape.
 */

export interface GroupRow<T = unknown> {
  type: 'group'
  field: string
  value: unknown
  displayValue: string
  depth: number
  count: number
  expanded: boolean
  groupKey: string
  children: (GroupRow<T> | T)[]
  parent: GroupRow<T> | null
}

export type DisplayRow<T = unknown> =
  | { type: 'data'; data: T; index: number; depth: number }
  | { type: 'group'; group: GroupRow<T> }
  | { type: 'detail'; data: T; index: number }
