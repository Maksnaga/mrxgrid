import { inject, Injectable } from '@angular/core';
import { GridStateManager } from '../state/grid-state';

@Injectable()
export class ColumnReorderEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  reorder(previousIndex: number, newIndex: number): void {
    if (previousIndex === newIndex) return;

    this.state.columnStates.update((states) => {
      const reordered = [...states];
      const [moved] = reordered.splice(previousIndex, 1);
      reordered.splice(newIndex, 0, moved);
      return reordered.map((s, i) => ({ ...s, order: i }));
    });
  }

  /**
   * Reorder using indices relative to unpinned columns only.
   * Translates to global columnStates indices before applying.
   */
  reorderUnpinned(unpinnedPrevIndex: number, unpinnedNewIndex: number): void {
    if (unpinnedPrevIndex === unpinnedNewIndex) return;

    const states = this.state.columnStates();
    const sorted = [...states].sort((a, b) => a.order - b.order);
    const visible = sorted.filter((s) => s.visible);
    const unpinned = visible.filter((s) => !s.pinned);

    const prevField = unpinned[unpinnedPrevIndex]?.field;
    const nextField = unpinned[unpinnedNewIndex]?.field;
    if (!prevField || !nextField) return;

    const globalPrev = sorted.findIndex((s) => s.field === prevField);
    const globalNext = sorted.findIndex((s) => s.field === nextField);
    if (globalPrev === -1 || globalNext === -1) return;

    this.reorder(globalPrev, globalNext);
  }
}
