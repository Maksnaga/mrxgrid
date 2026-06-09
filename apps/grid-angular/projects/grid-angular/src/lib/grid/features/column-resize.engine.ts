import { Injectable, inject, signal, NgZone } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { ColumnResizeEvent } from '../models/column.model';

const MIN_COLUMN_WIDTH = 50;

@Injectable()
export class ColumnResizeEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);
  private readonly ngZone = inject(NgZone);

  /**
   * Timestamp (from `performance.now()`) of the last resize-end event.
   * Read by `grid-header-cell` to guard against a spurious click→sort
   * event firing immediately after a resize drag completes.
   */
  readonly lastResizeEndedAt = signal(0);

  private resizing = false;
  private resizeField: string | null = null;
  private startX = 0;
  private startWidth = 0;
  private invertDelta = false;

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.resizing || !this.resizeField) return;
    const rawDelta = event.clientX - this.startX;
    const delta = this.invertDelta ? -rawDelta : rawDelta;
    const def = this.state.columnDefMap().get(this.resizeField);
    const min = def?.minWidth ? parseInt(def.minWidth, 10) : MIN_COLUMN_WIDTH;
    const max = def?.maxWidth ? parseInt(def.maxWidth, 10) : Infinity;
    const newWidth = Math.max(min, Math.min(max, this.startWidth + delta));
    this.state.updateColumnState(this.resizeField, { currentWidth: newWidth });
  };

  private readonly onMouseUp = (): void => {
    if (!this.resizing) return;
    this.resizing = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    // Record the end timestamp so grid-header-cell can suppress the
    // click→sort event that fires in the same event loop tick.
    this.lastResizeEndedAt.set(performance.now());
  };

  startResize(field: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const colState = this.state.columnStates().find((c) => c.field === field);
    if (!colState) return;

    this.resizing = true;
    this.resizeField = field;
    this.startX = event.clientX;
    this.startWidth = colState.currentWidth;
    this.invertDelta = colState.pinned === 'end';

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
    });
  }

  getResizeEvent(field: string, previousWidth: number): ColumnResizeEvent {
    const colState = this.state.columnStates().find((c) => c.field === field);
    return {
      field,
      previousWidth,
      newWidth: colState?.currentWidth ?? previousWidth,
    };
  }
}
