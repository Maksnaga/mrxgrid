import { inject, Injectable } from '@angular/core';
import { GridStateManager } from '../state/grid-state';

export interface TreeNodeConfig {
  childrenField: string;
  hasChildrenField?: string;
  expandedByDefault?: boolean;
}

export interface TreeDisplayRow<T = unknown> {
  type: 'data';
  data: T;
  index: number;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  nodeKey: string;
}

@Injectable()
export class TreeEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  flatten(
    data: T[],
    config: TreeNodeConfig,
    expandedNodes: Set<string>,
    idField: string
  ): TreeDisplayRow<T>[] {
    const rows: TreeDisplayRow<T>[] = [];
    let index = 0;

    const walk = (items: T[], depth: number, parentKey: string): void => {
      for (const item of items) {
        const record = item as Record<string, unknown>;
        const id = String(record[idField] ?? index);
        const nodeKey = parentKey ? `${parentKey}/${id}` : id;
        const children = (record[config.childrenField] as T[] | undefined) ?? [];
        const hasChildren = config.hasChildrenField
          ? Boolean(record[config.hasChildrenField])
          : children.length > 0;
        // B22 — expandedByDefault: treat the node as expanded when the flag is
        // true and the node has not been explicitly toggled (i.e. not in
        // expandedNodes). A node that the user has collapsed after an
        // "expand-all" would need to be tracked separately by the host; our
        // convention (matching the Vue engine) is that absent-from-set means
        // "never toggled", so expandedByDefault === true implies expanded.
        const expanded = expandedNodes.has(nodeKey) || (config.expandedByDefault === true);

        rows.push({
          type: 'data',
          data: item,
          index: index++,
          depth,
          hasChildren,
          expanded,
          nodeKey,
        });

        if (hasChildren && expanded) {
          walk(children, depth + 1, nodeKey);
        }
      }
    };

    walk(data, 0, '');
    return rows;
  }

  toggleNode(nodeKey: string): void {
    this.state.expandedRowIds.update((set) => {
      const next = new Set(set);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  }

  expandAll(data: T[], config: TreeNodeConfig, idField: string): void {
    const keys = new Set<string>();

    const walk = (items: T[], parentKey: string): void => {
      for (const item of items) {
        const record = item as Record<string, unknown>;
        const id = String(record[idField] ?? '');
        const nodeKey = parentKey ? `${parentKey}/${id}` : id;
        const children = (record[config.childrenField] as T[] | undefined) ?? [];
        if (children.length > 0) {
          keys.add(nodeKey);
          walk(children, nodeKey);
        }
      }
    };

    walk(data, '');
    this.state.expandedRowIds.set(keys as Set<unknown>);
  }

  collapseAll(): void {
    this.state.expandedRowIds.set(new Set());
  }
}
