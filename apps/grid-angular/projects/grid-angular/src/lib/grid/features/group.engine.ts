import { Injectable, inject } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { GroupRow, DisplayRow } from '../models/display-row.model';
import { GroupEntry } from '../models/grid-events.model';

@Injectable()
export class GroupEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  addGroup(field: string): void {
    const current = this.state.groupColumns();
    if (current.some((g) => g.field === field)) return;
    this.state.groupColumns.set([...current, { field, sortDirection: 'asc' }]);
    this.state.pageIndex.set(0);
  }

  removeGroup(field: string): void {
    this.state.groupColumns.update((cols) => cols.filter((g) => g.field !== field));
    this.state.pageIndex.set(0);
  }

  applyGroups(groups: GroupEntry[]): void {
    this.state.groupColumns.set(groups);
  }

  clearGroups(): void {
    this.state.groupColumns.set([]);
    this.state.expandedGroups.set(new Set());
  }

  toggleGroupExpand(groupKey: string): void {
    this.state.expandedGroups.update((set) => {
      const next = new Set(set);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  isGroupExpanded(groupKey: string): boolean {
    return this.state.expandedGroups().has(groupKey);
  }

  groupData(data: T[]): DisplayRow<T>[] {
    const groupEntries = this.state.groupColumns();
    if (groupEntries.length === 0) return [];

    const rootGroups = this.buildGroups(data, groupEntries, 0, null, '');
    return this.flattenGroups(rootGroups);
  }

  private buildGroups(
    data: T[],
    entries: GroupEntry[],
    depth: number,
    parent: GroupRow<T> | null,
    parentKey: string,
  ): GroupRow<T>[] {
    if (depth >= entries.length) return [];

    const entry = entries[depth];
    const field = entry.field;
    const defMap = this.state.columnDefMap();
    const def = defMap.get(field);

    const groups = new Map<string, T[]>();
    for (const row of data) {
      const rawValue = def?.valueGetter
        ? def.valueGetter(row)
        : (row as Record<string, unknown>)[field];
      const key = String(rawValue ?? '');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const result: GroupRow<T>[] = [];
    for (const [value, rows] of groups) {
      const groupKey = parentKey ? `${parentKey}|${field}:${value}` : `${field}:${value}`;
      const displayValue = def?.valueFormatter
        ? def.valueFormatter(value, rows[0])
        : value;

      const groupRow: GroupRow<T> = {
        type: 'group',
        field,
        value,
        displayValue: `${def?.headerName ?? field}: ${displayValue}`,
        depth,
        count: rows.length,
        expanded: this.state.expandedGroups().has(groupKey),
        groupKey,
        children: [],
        parent,
      };

      if (depth + 1 < entries.length) {
        groupRow.children = this.buildGroups(rows, entries, depth + 1, groupRow, groupKey);
      } else {
        groupRow.children = rows;
      }

      result.push(groupRow);
    }

    // Sort groups by their sort direction
    const sortDir = entry.sortDirection === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      const aVal = String(a.value);
      const bVal = String(b.value);
      const numA = Number(aVal);
      const numB = Number(bVal);
      if (!isNaN(numA) && !isNaN(numB)) {
        return (numA - numB) * sortDir;
      }
      return aVal.localeCompare(bVal) * sortDir;
    });

    return result;
  }

  private flattenGroups(groups: GroupRow<T>[]): DisplayRow<T>[] {
    const result: DisplayRow<T>[] = [];
    let dataIndex = 0;

    const flatten = (groupList: GroupRow<T>[]): void => {
      for (const group of groupList) {
        result.push({ type: 'group', group });

        if (group.expanded) {
          const childGroups = group.children.filter(
            (c): c is GroupRow<T> => typeof c === 'object' && c !== null && 'type' in c && (c as GroupRow<T>).type === 'group'
          );
          const childData = group.children.filter(
            (c): c is T => !(typeof c === 'object' && c !== null && 'type' in c && (c as GroupRow<T>).type === 'group')
          );

          if (childGroups.length > 0) {
            flatten(childGroups);
          }

          for (const data of childData) {
            result.push({
              type: 'data',
              data,
              index: dataIndex++,
              depth: group.depth + 1,
            });
          }
        }
      }
    };

    flatten(groups);
    return result;
  }
}
