import { inject, Injectable } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { SortDirection } from '../models/column.model';
import { SortDef } from '../models/sort.model';
import { FilterCondition, generateConditionId } from '../models/filter.model';

export interface PersistedGridState {
  columns: Array<{
    field: string;
    currentWidth: number;
    order: number;
    visible: boolean;
    pinned: 'start' | 'end' | null;
  }>;
  sorts: SortDef[];
  /** Serialised filter conditions. `id` is regenerated on restore. */
  filters?: Array<Omit<FilterCondition, 'id'>>;
}

@Injectable()
export class StatePersistenceEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  save(storageKey: string): void {
    const persisted: PersistedGridState = {
      columns: this.state.columnStates().map((col) => ({
        field: col.field,
        currentWidth: col.currentWidth,
        order: col.order,
        visible: col.visible,
        pinned: col.pinned,
      })),
      sorts: this.state.activeSorts(),
      filters: this.state.filterModel().conditions.map((condition) => {
        const { id, ...rest } = condition;
        void id;
        return rest;
      }),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(persisted));
    } catch {
      // localStorage may be unavailable or full
    }
  }

  restore(storageKey: string): boolean {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return false;

      const persisted: PersistedGridState = JSON.parse(raw);
      if (!persisted.columns?.length) return false;

      this.state.columnStates.update((currentStates) => {
        return currentStates.map((col) => {
          const saved = persisted.columns.find((s) => s.field === col.field);
          if (!saved) return col;
          return {
            ...col,
            currentWidth: saved.currentWidth,
            order: saved.order,
            visible: saved.visible,
            pinned: saved.pinned,
          };
        });
      });

      if (persisted.sorts?.length) {
        this.state.activeSorts.set(persisted.sorts);
        this.state.columnStates.update((states) =>
          states.map((s) => {
            const sortDef = persisted.sorts.find((sd) => sd.field === s.field);
            return sortDef
              ? {
                  ...s,
                  sort: sortDef.direction as SortDirection,
                  sortIndex: persisted.sorts.indexOf(sortDef),
                }
              : { ...s, sort: null as SortDirection, sortIndex: null };
          })
        );
      }

      if (persisted.filters?.length) {
        this.state.filterModel.set({
          conditions: persisted.filters.map((f) => ({ ...f, id: generateConditionId() })),
        });
      }

      return true;
    } catch {
      return false;
    }
  }

  clear(storageKey: string): void {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // localStorage may be unavailable
    }
  }
}
