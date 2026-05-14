import { computed, type ComputedRef, type Ref } from 'vue'
import type { GridState } from '@/components/MrxGrid/state/useGridState'
import type { ColumnDef, RowData } from '@/components/MrxGrid/types'

export interface GroupEntry {
  field: string
  headerName: string
}

// ---------------------------------------------------------------------------
// Internal tree structure (never exposed — only the flat output is public)
// ---------------------------------------------------------------------------

interface GroupNode {
  key: string
  field: string
  value: unknown
  headerName: string
  children: RowData[]
  subgroups: Map<unknown, GroupNode>
  /** Insertion-order keys for stable iteration. */
  subgroupOrder: unknown[]
  count: number
}

// ---------------------------------------------------------------------------
// Pure functions — testable, no Vue reactivity
// ---------------------------------------------------------------------------

/**
 * Build a multi-level group tree from flat rows.
 *
 * Complexity: O(n × d) where n = rows, d = groupFields.length.
 * Uses Maps for O(1) group lookup at each level.
 */
function buildGroupTree(
  rows: RowData[],
  groupFields: string[],
  columns: ColumnDef[],
): GroupNode {
  const headerMap = new Map(columns.map((c) => [c.field, c.headerName]))
  const root: GroupNode = {
    key: '',
    field: '',
    value: null,
    headerName: '',
    children: [],
    subgroups: new Map(),
    subgroupOrder: [],
    count: 0,
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!

    // Skip skeleton rows (lazy-loaded but not yet fetched) — they have no
    // real data and would otherwise all land in an "(empty)" group.
    if (row.__mrxSkeleton) continue

    root.count++
    let node = root
    let keyPrefix = ''

    for (let d = 0; d < groupFields.length; d++) {
      const field = groupFields[d]!
      const value = row[field]
      const groupKey = `${keyPrefix}${field}::${String(value ?? '')}`

      let child = node.subgroups.get(value)
      if (!child) {
        child = {
          key: groupKey,
          field,
          value,
          headerName: headerMap.get(field) ?? field,
          children: [],
          subgroups: new Map(),
          subgroupOrder: [],
          count: 0,
        }
        node.subgroups.set(value, child)
        node.subgroupOrder.push(value)
      }
      child.count++
      keyPrefix = `${groupKey}|`
      node = child
    }

    // Leaf level — store the row
    node.children.push(row)
  }

  return root
}

/**
 * Flatten a group tree into a renderable list respecting expand/collapse state.
 */
function flattenTree(
  root: GroupNode,
  expandedGroups: ReadonlySet<string>,
  rowIndexMap: Map<RowData, number>,
  depth = 0,
): RowData[] {
  const result: RowData[] = []

  for (const value of root.subgroupOrder) {
    const group = root.subgroups.get(value)!

    // Emit group header row
    const groupRow: RowData = {
      __mrxType: 'group',
      __mrxKey: group.key,
      __mrxField: group.field,
      __mrxValue: group.value,
      __mrxDepth: depth,
      __mrxCount: group.count,
      __mrxHeaderName: group.headerName,
    }
    result.push(groupRow)

    if (!expandedGroups.has(group.key)) continue

    // Recurse into subgroups or emit leaf rows
    if (group.subgroupOrder.length > 0) {
      const nested = flattenTree(group, expandedGroups, rowIndexMap, depth + 1)
      for (let i = 0; i < nested.length; i++) {
        result.push(nested[i]!)
      }
    } else {
      const childDepth = depth + 1
      for (let i = 0; i < group.children.length; i++) {
        const row = group.children[i]!
        const originalIndex = rowIndexMap.get(row) ?? -1
        const dataRow: RowData = {
          ...row,
          __mrxType: 'row',
          __mrxDepth: childDepth,
          __mrxOriginalIndex: originalIndex,
        }
        result.push(dataRow)
      }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

/**
 * Client-side grouping — Angular-parity storage, legacy `RowData` output.
 *
 * Phase 2.7: state lives on `gridState.groupColumns` + `gridState.expandedGroups`
 * (the single source of truth). The legacy `groupFields` / `expandedGroups`
 * shapes are exposed as derived computeds so consumers (`MrxGridGroupBar`,
 * `MrxGridBody`, etc.) keep their existing API.
 *
 * Group keys preserve the legacy `field::value|nested::value` format
 * — `MrxGridGroupRow` reads these via `__mrxKey`. Server-side grouping
 * (`useServerGrouping`) keeps its own state, deliberately, since it has a
 * different async lifecycle.
 */
export function useGrouping<T extends RowData = RowData>(
  gridState: GridState<T>,
  columns: Ref<ColumnDef[]>,
  rows: Ref<RowData[]>,
) {
  // --- Group fields — derived from gridState.groupColumns (Angular shape) ---

  const groupFields: ComputedRef<string[]> = computed(() =>
    gridState.groupColumns.value.map((g) => g.field),
  )

  const groups = computed<GroupEntry[]>(() =>
    groupFields.value.map((field) => {
      const col = columns.value.find((c) => c.field === field)
      return { field, headerName: col?.headerName ?? field }
    }),
  )

  const hasGroups = computed(() => groupFields.value.length > 0)

  function addGroup(field: string): void {
    if (groupFields.value.includes(field)) return
    gridState.groupColumns.value = [
      ...gridState.groupColumns.value,
      { field, sortDirection: 'asc' },
    ]
  }

  function removeGroup(field: string): void {
    gridState.groupColumns.value = gridState.groupColumns.value.filter((g) => g.field !== field)
    // Clean up expanded state for removed group
    const next = new Set(gridState.expandedGroups.value)
    for (const key of next) {
      if (key.includes(`${field}::`)) next.delete(key)
    }
    gridState.expandedGroups.value = next
  }

  function clearGroups(): void {
    gridState.groupColumns.value = []
    gridState.expandedGroups.value = new Set()
  }

  function isGrouped(field: string): boolean {
    return groupFields.value.includes(field)
  }

  // --- Group expand/collapse — backed by gridState.expandedGroups ---

  const expandedGroups: ComputedRef<Set<string>> = computed(
    () => gridState.expandedGroups.value,
  )

  function toggleGroupExpand(key: string): void {
    const next = new Set(gridState.expandedGroups.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    gridState.expandedGroups.value = next
  }

  function isGroupExpanded(key: string): boolean {
    return gridState.expandedGroups.value.has(key)
  }

  // --- Row identity map (for original index tracking) ---
  const rowIndexMap = computed(() => {
    const map = new Map<RowData, number>()
    const r = rows.value
    for (let i = 0; i < r.length; i++) {
      map.set(r[i]!, i)
    }
    return map
  })

  // --- Group tree (memoized) ---
  const groupTree = computed(() => {
    if (groupFields.value.length === 0) return null
    return buildGroupTree(rows.value, groupFields.value, columns.value)
  })

  // --- Flat renderable list ---
  const flatRows = computed<RowData[]>(() => {
    if (!groupTree.value) return rows.value
    return flattenTree(groupTree.value, gridState.expandedGroups.value, rowIndexMap.value)
  })

  return {
    // State (compat shapes)
    groups,
    groupFields: groupFields as unknown as Ref<string[]>,
    hasGroups,
    flatRows,

    // Group field management
    addGroup,
    removeGroup,
    clearGroups,
    isGrouped,

    // Group expand/collapse
    toggleGroupExpand,
    isGroupExpanded,
    expandedGroups: expandedGroups as unknown as Ref<Set<string>>,
  }
}
