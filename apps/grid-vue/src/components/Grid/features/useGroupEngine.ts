/**
 * Group engine — Angular parity (moz-grid / `GroupEngine`).
 *
 * Owns `state.groupColumns` + `state.expandedGroups` and produces a flat
 * `DisplayRow<T>[]` from a data slice when grouping is active. Output mixes
 * `{ type: 'group', group }` headers with `{ type: 'data' }` rows. When
 * `groupColumns` is empty `groupData` returns `[]` so callers fall back to
 * the plain `{ type: 'data' }` flattening in `useGridEngine`.
 *
 * Group keys encode the parent path so collapsing a parent closes the
 * subtree: `parentKey|field:value`. `state.expandedGroups` is a `Set<string>`
 * of these keys.
 */

import type { GridState } from '../state/useGridState'
import type { DisplayRow, GroupRow } from '../models/display-row.model'
import type { GroupEntry } from '../models/grid-events.model'
import type { RowData } from '../types'

export interface GroupEngine<T = RowData> {
  addGroup(field: string): void
  removeGroup(field: string): void
  applyGroups(groups: GroupEntry[]): void
  clearGroups(): void
  toggleGroupExpand(groupKey: string): void
  isGroupExpanded(groupKey: string): boolean
  groupData(data: T[]): DisplayRow<T>[]
}

export function useGroupEngine<T = RowData>(state: GridState<T>): GroupEngine<T> {
  function addGroup(field: string): void {
    const current = state.groupColumns.value
    if (current.some((g) => g.field === field)) return
    state.groupColumns.value = [...current, { field, sortDirection: 'asc' }]
    state.pageIndex.value = 0
  }

  function removeGroup(field: string): void {
    state.groupColumns.value = state.groupColumns.value.filter((g) => g.field !== field)
    state.pageIndex.value = 0
  }

  function applyGroups(groups: GroupEntry[]): void {
    state.groupColumns.value = [...groups]
  }

  function clearGroups(): void {
    state.groupColumns.value = []
    state.expandedGroups.value = new Set()
  }

  function toggleGroupExpand(groupKey: string): void {
    const next = new Set(state.expandedGroups.value)
    if (next.has(groupKey)) next.delete(groupKey)
    else next.add(groupKey)
    state.expandedGroups.value = next
  }

  function isGroupExpanded(groupKey: string): boolean {
    return state.expandedGroups.value.has(groupKey)
  }

  function groupData(data: T[]): DisplayRow<T>[] {
    const entries = state.groupColumns.value
    if (entries.length === 0) return []
    const root = buildGroups(data, entries, 0, null, '')
    return flattenGroups(root)
  }

  function buildGroups(
    data: T[],
    entries: GroupEntry[],
    depth: number,
    parent: GroupRow<T> | null,
    parentKey: string,
  ): GroupRow<T>[] {
    if (depth >= entries.length) return []

    const entry = entries[depth]
    if (!entry) return []
    const field = entry.field
    const def = state.columnDefMap.value.get(field)

    const groups = new Map<string, T[]>()
    for (const row of data) {
      const rawValue = def?.valueGetter
        ? def.valueGetter(row)
        : (row as Record<string, unknown>)[field]
      const key = String(rawValue ?? '')
      const bucket = groups.get(key) ?? []
      bucket.push(row)
      groups.set(key, bucket)
    }

    const result: GroupRow<T>[] = []
    for (const [value, rows] of groups) {
      const groupKey = parentKey ? `${parentKey}|${field}:${value}` : `${field}:${value}`
      const firstRow = rows[0] as T
      const displayValue = def?.valueFormatter ? def.valueFormatter(value, firstRow) : value

      const groupRow: GroupRow<T> = {
        type: 'group',
        field,
        value,
        displayValue: `${def?.headerName ?? field}: ${displayValue}`,
        depth,
        count: rows.length,
        expanded: state.expandedGroups.value.has(groupKey),
        groupKey,
        children: [],
        parent,
      }

      if (depth + 1 < entries.length) {
        groupRow.children = buildGroups(rows, entries, depth + 1, groupRow, groupKey)
      } else {
        groupRow.children = rows
      }

      result.push(groupRow)
    }

    const sortDir = entry.sortDirection === 'desc' ? -1 : 1
    result.sort((a, b) => {
      const aVal = String(a.value)
      const bVal = String(b.value)
      const numA = Number(aVal)
      const numB = Number(bVal)
      if (!isNaN(numA) && !isNaN(numB)) {
        return (numA - numB) * sortDir
      }
      return aVal.localeCompare(bVal) * sortDir
    })

    return result
  }

  function flattenGroups(groups: GroupRow<T>[]): DisplayRow<T>[] {
    const result: DisplayRow<T>[] = []
    let dataIndex = 0

    const walk = (list: GroupRow<T>[]): void => {
      for (const group of list) {
        result.push({ type: 'group', group })
        if (!group.expanded) continue

        const childGroups = group.children.filter(
          (c): c is GroupRow<T> =>
            typeof c === 'object' &&
            c !== null &&
            'type' in c &&
            (c as GroupRow<T>).type === 'group',
        )
        const childData = group.children.filter(
          (c): c is T =>
            !(
              typeof c === 'object' &&
              c !== null &&
              'type' in c &&
              (c as GroupRow<T>).type === 'group'
            ),
        )

        if (childGroups.length > 0) walk(childGroups)

        for (const data of childData) {
          result.push({
            type: 'data',
            data,
            index: dataIndex++,
            depth: group.depth + 1,
          })
        }
      }
    }

    walk(groups)
    return result
  }

  return {
    addGroup,
    removeGroup,
    applyGroups,
    clearGroups,
    toggleGroupExpand,
    isGroupExpanded,
    groupData,
  }
}
