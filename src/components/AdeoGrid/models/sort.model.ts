/**
 * Sort model — Angular parity (moz-grid).
 *
 * `SortDirection` matches the existing Vue narrow shape (`'asc' | 'desc'`).
 * Places where Angular uses `SortDirection | null` (e.g. `ColumnStateEntry.sort`,
 * `HeaderMenuConfig.currentSort`) spell the nullability inline, so consumers
 * typed on the narrow shape keep compiling.
 */
export type SortDirection = 'asc' | 'desc'

/** One entry in the multi-column sort stack. `priority` is the 0-based order. */
export interface SortDef {
  field: string
  direction: SortDirection
  priority: number
}

export interface SortEvent {
  sorts: SortDef[]
}
