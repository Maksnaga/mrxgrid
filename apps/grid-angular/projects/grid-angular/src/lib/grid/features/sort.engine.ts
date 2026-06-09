import { Injectable, inject } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { SortDef } from '../models/sort.model';
import { SortDirection } from '../models/column.model';

@Injectable()
export class SortEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  toggleSort(field: string, isMultiSort: boolean): void {
    const currentSorts = this.state.activeSorts();
    const existing = currentSorts.find((s) => s.field === field);

    let nextDirection: SortDirection;
    if (!existing) {
      nextDirection = 'asc';
    } else if (existing.direction === 'asc') {
      nextDirection = 'desc';
    } else {
      nextDirection = null;
    }

    let newSorts: SortDef[];
    if (isMultiSort) {
      if (nextDirection === null) {
        newSorts = currentSorts.filter((s) => s.field !== field);
      } else if (existing) {
        newSorts = currentSorts.map((s) =>
          s.field === field ? { ...s, direction: nextDirection! } : s
        );
      } else {
        newSorts = [...currentSorts, { field, direction: nextDirection, priority: currentSorts.length }];
      }
    } else {
      newSorts = nextDirection ? [{ field, direction: nextDirection, priority: 0 }] : [];
    }

    this.state.activeSorts.set(newSorts);
    this.syncColumnSortState(newSorts);
  }

  setSort(field: string, direction: SortDirection): void {
    const newSorts: SortDef[] = direction
      ? [{ field, direction, priority: 0 }]
      : [];
    this.state.activeSorts.set(newSorts);
    this.syncColumnSortState(newSorts);
  }

  clearSort(): void {
    this.state.activeSorts.set([]);
    this.syncColumnSortState([]);
  }

  sortData(data: T[]): T[] {
    const sorts = this.state.activeSorts();
    if (sorts.length === 0) return data;

    const defMap = this.state.columnDefMap();

    return [...data].sort((a, b) => {
      for (const sort of sorts) {
        const def = defMap.get(sort.field);
        if (def?.sortComparator) {
          const result = def.sortComparator(a, b);
          if (result !== 0) return sort.direction === 'asc' ? result : -result;
          continue;
        }

        const valA = this.getValue(a, sort.field, def);
        const valB = this.getValue(b, sort.field, def);
        const result = this.defaultCompare(valA, valB);
        if (result !== 0) return sort.direction === 'asc' ? result : -result;
      }
      return 0;
    });
  }

  private syncColumnSortState(sorts: SortDef[]): void {
    this.state.columnStates.update((states) =>
      states.map((state) => {
        const sortDef = sorts.find((s) => s.field === state.field);
        return {
          ...state,
          sort: sortDef?.direction ?? null,
          sortIndex: sortDef ? sorts.indexOf(sortDef) : null,
        };
      })
    );
  }

  private getValue(row: T, field: string, def?: { valueGetter?: (row: T) => unknown }): unknown {
    if (def?.valueGetter) return def.valueGetter(row);
    return (row as Record<string, unknown>)[field];
  }

  private defaultCompare(a: unknown, b: unknown): number {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    if (typeof a === 'string' && typeof b === 'string') {
      return a.localeCompare(b);
    }
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    return String(a).localeCompare(String(b));
  }
}
