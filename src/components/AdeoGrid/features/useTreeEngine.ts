/**
 * Tree engine — Angular parity (moz-grid / `TreeEngine`).
 *
 * Flattens a hierarchical data structure (e.g. file trees, org charts) into
 * an index-based `TreeDisplayRow<T>[]` suitable for the virtualizer. Node
 * identity is built from a stable `idField` per node, prefixed by each
 * ancestor's nodeKey joined with `/`, so subtrees collapse cleanly when a
 * parent is collapsed.
 *
 * Expand/collapse state is shared with `state.expandedRowIds` so a single
 * grid can coexist with the expandable-row engine — each uses a disjoint
 * space of keys (row IDs for detail, nodeKeys for tree). No double-write.
 */

import type { GridState } from '../state/useGridState'
import type { RowData } from '../types'

export interface TreeNodeConfig {
  childrenField: string
  hasChildrenField?: string
  expandedByDefault?: boolean
}

export interface TreeDisplayRow<T = RowData> {
  type: 'data'
  data: T
  index: number
  depth: number
  hasChildren: boolean
  expanded: boolean
  nodeKey: string
}

export interface TreeEngine<T = RowData> {
  flatten(
    data: T[],
    config: TreeNodeConfig,
    expandedNodes: Set<string>,
    idField: string,
  ): TreeDisplayRow<T>[]
  toggleNode(nodeKey: string): void
  expandAll(data: T[], config: TreeNodeConfig, idField: string): void
  collapseAll(): void
}

export function useTreeEngine<T = RowData>(state: GridState<T>): TreeEngine<T> {
  function flatten(
    data: T[],
    config: TreeNodeConfig,
    expandedNodes: Set<string>,
    idField: string,
  ): TreeDisplayRow<T>[] {
    const rows: TreeDisplayRow<T>[] = []
    let index = 0

    const walk = (items: T[], depth: number, parentKey: string): void => {
      for (const item of items) {
        const record = item as Record<string, unknown>
        const id = String(record[idField] ?? index)
        const nodeKey = parentKey ? `${parentKey}/${id}` : id
        const children = (record[config.childrenField] as T[] | undefined) ?? []
        const hasChildren = config.hasChildrenField
          ? Boolean(record[config.hasChildrenField])
          : children.length > 0
        const expanded = expandedNodes.has(nodeKey)

        rows.push({
          type: 'data',
          data: item,
          index: index++,
          depth,
          hasChildren,
          expanded,
          nodeKey,
        })

        if (hasChildren && expanded) {
          walk(children, depth + 1, nodeKey)
        }
      }
    }

    walk(data, 0, '')
    return rows
  }

  function toggleNode(nodeKey: string): void {
    const next = new Set(state.expandedRowIds.value)
    if (next.has(nodeKey)) next.delete(nodeKey)
    else next.add(nodeKey)
    state.expandedRowIds.value = next
  }

  function expandAll(data: T[], config: TreeNodeConfig, idField: string): void {
    const keys = new Set<unknown>()

    const walk = (items: T[], parentKey: string): void => {
      for (const item of items) {
        const record = item as Record<string, unknown>
        const id = String(record[idField] ?? '')
        const nodeKey = parentKey ? `${parentKey}/${id}` : id
        const children = (record[config.childrenField] as T[] | undefined) ?? []
        if (children.length > 0) {
          keys.add(nodeKey)
          walk(children, nodeKey)
        }
      }
    }

    walk(data, '')
    state.expandedRowIds.value = keys
  }

  function collapseAll(): void {
    state.expandedRowIds.value = new Set()
  }

  return { flatten, toggleNode, expandAll, collapseAll }
}
