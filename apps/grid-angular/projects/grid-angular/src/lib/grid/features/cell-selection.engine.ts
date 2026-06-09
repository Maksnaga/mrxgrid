import { Injectable, inject, signal, computed } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { CellRange } from '../models/cell.model';

@Injectable()
export class CellSelectionEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  // ---------------------------------------------------------------------------
  // Multi-range (Ctrl+Click) — Angular-parity port of Vue useCellSelection
  // ---------------------------------------------------------------------------

  /**
   * Frozen ranges from previous Ctrl+Click operations.
   * Each entry is a snapshot of a completed `cellRange` that was "frozen"
   * when the user held Ctrl and clicked elsewhere.
   */
  readonly frozenRanges = signal<CellRange[]>([]);

  /**
   * All active ranges: frozen (Ctrl+Click) + the current live range.
   * Consumed by grid-cell to paint multi-range highlights.
   */
  readonly allRanges = computed<CellRange[]>(() => {
    const cur = this.state.cellRange();
    return [...this.frozenRanges(), ...(cur ? [cur] : [])];
  });

  /**
   * Freeze the current live range and start a new single-cell selection at
   * `range`. Caller is responsible for also updating `state.cellRange` to
   * the new anchor so keyboard extend keeps working from the new cell.
   */
  addRange(range: CellRange): void {
    const cur = this.state.cellRange();
    if (cur) {
      this.frozenRanges.update((prev) => [...prev, cur]);
    }
    this.state.cellRange.set(range);
    this.state.focusedCell.set(range.start);
    this.state.selectedCell.set(range.start);
  }

  /** Discard all frozen ranges (single selection revert). */
  clearFrozenRanges(): void {
    this.frozenRanges.set([]);
  }

  /**
   * Returns true when (row, col) belongs to any active range
   * (frozen or current). Used by grid-cell for multi-range highlight.
   */
  isCellInAnyRange(row: number, col: number): boolean {
    for (const range of this.allRanges()) {
      const minRow = Math.min(range.start.row, range.end.row);
      const maxRow = Math.max(range.start.row, range.end.row);
      const minCol = Math.min(range.start.col, range.end.col);
      const maxCol = Math.max(range.start.col, range.end.col);
      if (row >= minRow && row <= maxRow && col >= minCol && col <= maxCol) {
        return true;
      }
    }
    return false;
  }

  focusCell(row: number, col: number, source: 'click' | 'keyboard' = 'click'): void {
    this.state.focusSource.set(source);
    this.state.focusedCell.set({ row, col });
    this.state.selectedCell.set({ row, col });
    this.state.cellRange.set(null);
    this.state.isDragging.set(false);
    // A plain focus always resets multi-range selection.
    this.frozenRanges.set([]);
  }

  clearFocus(): void {
    this.state.focusSource.set(null);
    this.state.focusedCell.set(null);
    this.state.selectedCell.set(null);
    this.state.cellRange.set(null);
    this.state.isDragging.set(false);
    this.frozenRanges.set([]);
  }

  isCellFocused(row: number, col: number): boolean {
    const focused = this.state.focusedCell();
    return focused?.row === row && focused?.col === col;
  }

  isCellInRange(row: number, col: number): boolean {
    const range = this.state.cellRange();
    if (!range) {
      return this.isCellFocused(row, col);
    }
    const minRow = Math.min(range.start.row, range.end.row);
    const maxRow = Math.max(range.start.row, range.end.row);
    const minCol = Math.min(range.start.col, range.end.col);
    const maxCol = Math.max(range.start.col, range.end.col);
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  }

  selectRange(start: { row: number; col: number }, end: { row: number; col: number }): void {
    this.state.cellRange.set({ start, end });
    this.state.isDragging.set(false);
  }

  startRangeSelection(row: number, col: number): void {
    this.state.focusedCell.set({ row, col });
    this.state.cellRange.set({ start: { row, col }, end: { row, col } });
    this.state.isDragging.set(true);
  }

  extendRange(row: number, col: number): void {
    if (!this.state.isDragging()) return;
    const range = this.state.cellRange();
    if (!range) return;
    this.state.cellRange.set({ start: range.start, end: { row, col } });
  }

  endRangeSelection(): void {
    this.state.isDragging.set(false);
  }

  moveUp(): void {
    this.moveBy(-1, 0);
  }

  moveDown(): void {
    this.moveBy(1, 0);
  }

  moveLeft(): void {
    this.moveBy(0, -1);
  }

  moveRight(): void {
    this.moveBy(0, 1);
  }

  // --- Home / End / Grid bounds -------------------------------------------------

  moveToRowStart(): void {
    const focused = this.state.focusedCell();
    if (!focused) return;
    this.focusCell(focused.row, 0, 'keyboard');
  }

  moveToRowEnd(): void {
    const focused = this.state.focusedCell();
    if (!focused) return;
    const maxCol = this.state.visibleColumns().length - 1;
    if (maxCol < 0) return;
    this.focusCell(focused.row, this.findLastNonEmptyCol(focused.row, maxCol), 'keyboard');
  }

  moveToGridStart(): void {
    const pageStart = this.state.pageIndex() * this.state.pageSize();
    this.focusCell(pageStart, 0, 'keyboard');
  }

  moveToGridEnd(): void {
    const pageStart = this.state.pageIndex() * this.state.pageSize();
    const pageEnd = pageStart + Math.max(0, this.state.visibleRowCount() - 1);
    const maxCol = this.state.visibleColumns().length - 1;
    if (maxCol < 0) return;
    this.focusCell(pageEnd, this.findLastNonEmptyCol(pageEnd, maxCol), 'keyboard');
  }

  /**
   * Excel-style Ctrl+Arrow: jump to the edge of the current data block.
   * If on an empty cell, jumps to the next non-empty cell. If on a filled
   * cell, jumps to the last filled cell before the next empty transition
   * (or to the grid edge if no empty cell is encountered).
   */
  jumpToEdge(direction: 'up' | 'down' | 'left' | 'right'): void {
    const focused = this.state.focusedCell();
    if (!focused) return;
    const { dRow, dCol } = this.directionVector(direction);
    const bounds = this.pageBounds();
    const maxCol = this.state.visibleColumns().length - 1;
    if (maxCol < 0) return;

    const startFilled = this.isCellFilled(focused.row, focused.col);
    let row = focused.row;
    let col = focused.col;

    // Step once to start looking at the neighbour
    let nextRow = row + dRow;
    let nextCol = col + dCol;
    while (this.inBounds(nextRow, nextCol, bounds, maxCol)) {
      const filled = this.isCellFilled(nextRow, nextCol);
      if (startFilled) {
        // Moving through filled cells — stop right before the next empty gap.
        if (!filled) break;
        row = nextRow;
        col = nextCol;
      } else {
        // Moving through empty cells — stop on the first filled cell we meet.
        if (filled) {
          row = nextRow;
          col = nextCol;
          break;
        }
        row = nextRow;
        col = nextCol;
      }
      nextRow += dRow;
      nextCol += dCol;
    }

    this.focusCell(row, col, 'keyboard');
  }

  movePage(direction: 'up' | 'down'): void {
    const focused = this.state.focusedCell();
    if (!focused) return;
    const step = this.pageRowStep() * (direction === 'down' ? 1 : -1);
    this.moveBy(step, 0);
  }

  // --- Shift + navigation : extend current range --------------------------------

  extendRangeBy(dRow: number, dCol: number): void {
    const focused = this.state.focusedCell();
    if (!focused) return;
    const range = this.state.cellRange();
    const bounds = this.pageBounds();
    const maxCol = this.state.visibleColumns().length - 1;
    if (maxCol < 0) return;

    const currentEnd = range ? range.end : focused;
    const newEnd = {
      row: Math.max(bounds.start, Math.min(bounds.end, currentEnd.row + dRow)),
      col: Math.max(0, Math.min(maxCol, currentEnd.col + dCol)),
    };
    const start = range ? range.start : focused;
    this.state.cellRange.set({ start, end: newEnd });
  }

  /**
   * Extends the current selection from the focused-cell anchor to (row, col).
   * Mirrors Vue's `extendRangeTo(row, col)` — used for Shift+Click without drag.
   */
  extendRangeTo(row: number, col: number): void {
    const anchor = this.state.focusedCell() ?? this.state.cellRange()?.start;
    if (!anchor) return;
    this.state.cellRange.set({ start: anchor, end: { row, col } });
  }

  extendRangeToRowStart(): void {
    const focused = this.state.focusedCell();
    if (!focused) return;
    const range = this.state.cellRange();
    const start = range?.start ?? focused;
    this.state.cellRange.set({ start, end: { row: (range?.end ?? focused).row, col: 0 } });
  }

  extendRangeToRowEnd(): void {
    const focused = this.state.focusedCell();
    if (!focused) return;
    const maxCol = this.state.visibleColumns().length - 1;
    if (maxCol < 0) return;
    const range = this.state.cellRange();
    const start = range?.start ?? focused;
    this.state.cellRange.set({ start, end: { row: (range?.end ?? focused).row, col: maxCol } });
  }

  extendRangeToGridStart(): void {
    const focused = this.state.focusedCell();
    if (!focused) return;
    const bounds = this.pageBounds();
    const range = this.state.cellRange();
    const start = range?.start ?? focused;
    this.state.cellRange.set({ start, end: { row: bounds.start, col: 0 } });
  }

  extendRangeToGridEnd(): void {
    const focused = this.state.focusedCell();
    if (!focused) return;
    const bounds = this.pageBounds();
    const maxCol = this.state.visibleColumns().length - 1;
    if (maxCol < 0) return;
    const range = this.state.cellRange();
    const start = range?.start ?? focused;
    this.state.cellRange.set({ start, end: { row: bounds.end, col: maxCol } });
  }

  extendRangeJumpToEdge(direction: 'up' | 'down' | 'left' | 'right'): void {
    const focused = this.state.focusedCell();
    if (!focused) return;
    const range = this.state.cellRange();
    const anchor = range?.start ?? focused;
    const end = range?.end ?? focused;
    const target = this.edgeFromCell(end, direction);
    this.state.cellRange.set({ start: anchor, end: target });
  }

  extendRangeByPage(direction: 'up' | 'down'): void {
    const step = this.pageRowStep() * (direction === 'down' ? 1 : -1);
    this.extendRangeBy(step, 0);
  }

  // --- Whole row / column / grid selection --------------------------------------

  selectRow(row: number): void {
    const maxCol = this.state.visibleColumns().length - 1;
    if (maxCol < 0) return;
    this.state.focusedCell.set({ row, col: 0 });
    this.state.focusSource.set('keyboard');
    this.state.cellRange.set({
      start: { row, col: 0 },
      end: { row, col: maxCol },
    });
  }

  selectColumn(col: number): void {
    const bounds = this.pageBounds();
    this.state.focusedCell.set({ row: bounds.start, col });
    this.state.focusSource.set('keyboard');
    this.state.cellRange.set({
      start: { row: bounds.start, col },
      end: { row: bounds.end, col },
    });
  }

  selectAll(): void {
    const bounds = this.pageBounds();
    const maxCol = this.state.visibleColumns().length - 1;
    if (maxCol < 0) return;
    this.state.focusedCell.set({ row: bounds.start, col: 0 });
    this.state.focusSource.set('keyboard');
    this.state.cellRange.set({
      start: { row: bounds.start, col: 0 },
      end: { row: bounds.end, col: maxCol },
    });
  }

  // --- Private helpers ----------------------------------------------------------

  private pageBounds(): { start: number; end: number } {
    const start = this.state.pageIndex() * this.state.pageSize();
    const end = start + Math.max(0, this.state.visibleRowCount() - 1);
    return { start, end };
  }

  private pageRowStep(): number {
    const rowHeight = this.state.rowHeight() || 48;
    const viewportHeight = this.state.scrollViewportHeight();
    if (viewportHeight > 0) {
      return Math.max(1, Math.floor(viewportHeight / rowHeight));
    }
    // Fallback: a sensible default when the viewport hasn't been measured yet.
    return Math.max(1, Math.floor(this.state.visibleRowCount() / 2) || 10);
  }

  private directionVector(dir: 'up' | 'down' | 'left' | 'right'): { dRow: number; dCol: number } {
    switch (dir) {
      case 'up':
        return { dRow: -1, dCol: 0 };
      case 'down':
        return { dRow: 1, dCol: 0 };
      case 'left':
        return { dRow: 0, dCol: -1 };
      case 'right':
        return { dRow: 0, dCol: 1 };
    }
  }

  private inBounds(
    row: number,
    col: number,
    bounds: { start: number; end: number },
    maxCol: number,
  ): boolean {
    return row >= bounds.start && row <= bounds.end && col >= 0 && col <= maxCol;
  }

  private isCellFilled(row: number, col: number): boolean {
    const cols = this.state.visibleColumns();
    const field = cols[col]?.field;
    if (!field) return false;
    const data = this.state.sourceData();
    const rowData = data[row];
    if (!rowData) return false;
    const def = this.state.columnDefMap().get(field);
    const value = def?.valueGetter
      ? def.valueGetter(rowData)
      : (rowData as Record<string, unknown>)[field];
    return value !== null && value !== undefined && value !== '';
  }

  private findLastNonEmptyCol(row: number, maxCol: number): number {
    for (let c = maxCol; c >= 0; c--) {
      if (this.isCellFilled(row, c)) return c;
    }
    return maxCol;
  }

  private edgeFromCell(
    from: { row: number; col: number },
    direction: 'up' | 'down' | 'left' | 'right',
  ): { row: number; col: number } {
    const { dRow, dCol } = this.directionVector(direction);
    const bounds = this.pageBounds();
    const maxCol = this.state.visibleColumns().length - 1;
    if (maxCol < 0) return from;

    const startFilled = this.isCellFilled(from.row, from.col);
    let row = from.row;
    let col = from.col;
    let nextRow = row + dRow;
    let nextCol = col + dCol;
    while (this.inBounds(nextRow, nextCol, bounds, maxCol)) {
      const filled = this.isCellFilled(nextRow, nextCol);
      if (startFilled) {
        if (!filled) break;
      } else if (filled) {
        row = nextRow;
        col = nextCol;
        break;
      }
      row = nextRow;
      col = nextCol;
      nextRow += dRow;
      nextCol += dCol;
    }
    return { row, col };
  }

  moveToNextEditableCell(): void {
    const focused = this.state.focusedCell();
    if (!focused) return;
    const cols = this.state.visibleColumns();
    let col = focused.col + 1;
    let row = focused.row;

    while (row < this.state.sourceData().length) {
      if (col >= cols.length) {
        col = 0;
        row++;
      }
      if (row >= this.state.sourceData().length) break;

      const def = this.state.columnDefMap().get(cols[col]?.field ?? '');
      if (def?.editable) {
        this.focusCell(row, col);
        return;
      }
      col++;
    }
  }

  // --- Fill Handle (Google Sheets style) — supports vertical and horizontal fills ---

  startFill(row: number, col: number): void {
    this.state.fillAnchor.set({ row, col });
    this.state.fillTarget.set({ row, col });
    this.state.isFilling.set(true);
  }

  /**
   * Extends the fill range. The dominant axis (the one with the largest delta
   * from the anchor) wins: vertical if |dRow| >= |dCol|, otherwise horizontal.
   * The fill is 1D — it's always locked to a single row or a single column.
   */
  extendFill(row: number, col: number): void {
    if (!this.state.isFilling()) return;
    const anchor = this.state.fillAnchor();
    if (!anchor) return;
    const dRow = Math.abs(row - anchor.row);
    const dCol = Math.abs(col - anchor.col);
    if (dRow >= dCol) {
      this.state.fillTarget.set({ row, col: anchor.col });
    } else {
      this.state.fillTarget.set({ row: anchor.row, col });
    }
  }

  endFill(): { anchor: { row: number; col: number }; target: { row: number; col: number } } | null {
    if (!this.state.isFilling()) return null;
    const anchor = this.state.fillAnchor();
    const target = this.state.fillTarget();
    this.state.isFilling.set(false);
    this.state.fillAnchor.set(null);
    this.state.fillTarget.set(null);
    if (!anchor || !target) return null;
    if (anchor.row === target.row && anchor.col === target.col) return null;
    return { anchor, target };
  }

  cancelFill(): void {
    this.state.isFilling.set(false);
    this.state.fillAnchor.set(null);
    this.state.fillTarget.set(null);
  }

  isCellInFillRange(row: number, col: number): boolean {
    const anchor = this.state.fillAnchor();
    const target = this.state.fillTarget();
    if (!anchor || !target) return false;
    if (row === anchor.row && col === anchor.col) return false; // skip anchor

    const vertical = target.col === anchor.col;
    if (vertical) {
      if (col !== anchor.col) return false;
      const minRow = Math.min(anchor.row, target.row);
      const maxRow = Math.max(anchor.row, target.row);
      return row >= minRow && row <= maxRow;
    }

    // Horizontal fill: single row, col range — skip non-editable columns and
    // type-incompatible columns so the highlight mirrors exactly which cells
    // will actually be written.
    if (row !== anchor.row) return false;
    const minCol = Math.min(anchor.col, target.col);
    const maxCol = Math.max(anchor.col, target.col);
    if (col < minCol || col > maxCol) return false;
    return this.isColEditable(col) && this.isColTypeCompatible(anchor.col, col);
  }

  /**
   * During a horizontal fill, cells that sit inside the drag bounding box but
   * belong to a non-editable column cannot receive the filled value. We expose
   * them here so the view can paint a red dashed outline — a visual cue that
   * the fill is skipping that column.
   */
  isCellInFillRejectRange(row: number, col: number): boolean {
    const anchor = this.state.fillAnchor();
    const target = this.state.fillTarget();
    if (!anchor || !target) return false;
    if (anchor.row === target.row && anchor.col === target.col) return false;

    const vertical = target.col === anchor.col;
    if (vertical) return false; // vertical fills stay on the anchor column

    if (row !== anchor.row) return false;
    const minCol = Math.min(anchor.col, target.col);
    const maxCol = Math.max(anchor.col, target.col);
    if (col < minCol || col > maxCol) return false;
    // Reject if non-editable OR editable but type-incompatible with anchor
    return !this.isColEditable(col) || !this.isColTypeCompatible(anchor.col, col);
  }

  private isColEditable(colIndex: number): boolean {
    const cols = this.state.visibleColumns();
    const colEntry = cols[colIndex];
    if (!colEntry) return false;
    const def = this.state.columnDefMap().get(colEntry.field);
    return def?.editable === true;
  }

  /**
   * Returns the effective editor type for a column index.
   * Falls back to 'text' when no explicit cellEditor is defined.
   */
  private getColEditorType(colIndex: number): string {
    const cols = this.state.visibleColumns();
    const colEntry = cols[colIndex];
    if (!colEntry) return 'text';
    const def = this.state.columnDefMap().get(colEntry.field);
    return def?.cellEditor ?? 'text';
  }

  /**
   * Checks whether the source column's editor type is compatible with the
   * target column's editor type for a horizontal fill operation.
   * text↔text, number↔number, select↔select, etc. — only same-type is allowed.
   */
  private isColTypeCompatible(sourceCol: number, targetCol: number): boolean {
    return this.getColEditorType(sourceCol) === this.getColEditorType(targetCol);
  }

  private moveBy(dRow: number, dCol: number): void {
    const focused = this.state.focusedCell();
    if (!focused) return;

    // Clamp to the global row range of the current page
    const pageStart = this.state.pageIndex() * this.state.pageSize();
    const pageEnd = pageStart + Math.max(0, this.state.visibleRowCount() - 1);
    const maxCol = this.state.visibleColumns().length - 1;
    const newRow = Math.max(pageStart, Math.min(pageEnd, focused.row + dRow));
    const newCol = Math.max(0, Math.min(maxCol, focused.col + dCol));

    this.focusCell(newRow, newCol, 'keyboard');
  }

  getNormalizedRange(): CellRange | null {
    const range = this.state.cellRange();
    if (!range) {
      const focused = this.state.focusedCell();
      if (!focused) return null;
      return { start: focused, end: focused };
    }
    return {
      start: {
        row: Math.min(range.start.row, range.end.row),
        col: Math.min(range.start.col, range.end.col),
      },
      end: {
        row: Math.max(range.start.row, range.end.row),
        col: Math.max(range.start.col, range.end.col),
      },
    };
  }
}
