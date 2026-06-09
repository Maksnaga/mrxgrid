import { Injectable, inject, signal, computed } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { CellError } from '../models/cell.model';

@Injectable()
export class CellValidationEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  /** Map<"rowIndex:field", CellError> */
  readonly cellErrors = signal<Map<string, CellError>>(new Map());

  /** Number of cells currently in error */
  readonly errorCount = computed(() => this.cellErrors().size);

  /**
   * Revalidate every cell for the given data slice.
   * Returns the number of cells that failed validation, matching the
   * Vue grid's `validateAll()` contract so consumers can branch on
   * `if (grid.validateAll() > 0) …` without re-querying `errorCount()`.
   */
  validateAll(data: T[]): number {
    const defMap = this.state.columnDefMap();
    const errors = new Map<string, CellError>();

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      for (const [field, def] of defMap) {
        if (!def.cellValidator) continue;
        const value = (row as Record<string, unknown>)[field];
        const error = def.cellValidator(value, row);
        if (error) {
          errors.set(`${rowIndex}:${field}`, error);
        }
      }
    }

    this.cellErrors.set(errors);
    return errors.size;
  }

  /** Revalidate a single cell */
  validateCell(rowIndex: number, field: string, value: unknown, row: T): void {
    const defMap = this.state.columnDefMap();
    const def = defMap.get(field);
    if (!def?.cellValidator) {
      // Remove any previous error if validator was removed
      this.removeCellError(rowIndex, field);
      return;
    }

    const error = def.cellValidator(value, row);
    const key = `${rowIndex}:${field}`;

    this.cellErrors.update((map) => {
      const next = new Map(map);
      if (error) {
        next.set(key, error);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  /** Get the error for a specific cell, or null */
  getCellError(rowIndex: number, field: string): CellError | null {
    return this.cellErrors().get(`${rowIndex}:${field}`) ?? null;
  }

  /** Check if a specific cell has an error */
  hasCellError(rowIndex: number, field: string): boolean {
    return this.cellErrors().has(`${rowIndex}:${field}`);
  }

  /** Clear all errors */
  clearAll(): void {
    this.cellErrors.set(new Map());
  }

  private removeCellError(rowIndex: number, field: string): void {
    const key = `${rowIndex}:${field}`;
    if (this.cellErrors().has(key)) {
      this.cellErrors.update((map) => {
        const next = new Map(map);
        next.delete(key);
        return next;
      });
    }
  }
}
