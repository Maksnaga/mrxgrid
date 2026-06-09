import { Injectable, inject } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { CellEditEvent, CellEditCancelEvent } from '../models/cell.model';
import { CellEditorType } from '../models/column.model';
import { HistoryEngine } from './history.engine';
import { GridEngine } from '../engine/grid-engine';
import { FormulaEngine } from './formula/formula.engine';
import { a1ToLongForm } from './formula/formula-ref-mapper';

@Injectable()
export class InlineEditEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);
  private readonly history = inject<HistoryEngine<T>>(HistoryEngine);
  private readonly gridEngine = inject<GridEngine<T>>(GridEngine);
  // Optional — tests that do not set up the formula provider keep working.
  private readonly formulaEngine = inject<FormulaEngine<T> | null>(FormulaEngine, {
    optional: true,
  });

  startEdit(rowIndex: number, field: string): void {
    const defMap = this.state.columnDefMap();
    const def = defMap.get(field);
    if (!def?.editable) return;

    const colIndex = this.state.visibleColumns().findIndex((c) => c.field === field);
    if (colIndex < 0) return;

    const sourceIndex = this.gridEngine.displayIndexToSourceIndex(rowIndex);
    const row = sourceIndex >= 0 ? this.state.sourceData()[sourceIndex] : undefined;
    if (!row) return;

    const value = def.valueGetter ? def.valueGetter(row) : (row as Record<string, unknown>)[field];
    // Formula-enabled cells open with the A1 surface form so the user edits
    // column letters, not the `REF(COLUMN("…"),ROW(…))` storage.
    let draftValue: unknown = value;
    if (def.allowFormula && this.formulaEngine) {
      const rowId = (row as Record<string, unknown>)[this.state.rowIdField()] as
        | string
        | number
        | undefined;
      if (rowId !== undefined && rowId !== null) {
        const a1 = this.formulaEngine.displayFormula({ rowId, field });
        if (a1 !== undefined) draftValue = a1;
      }
    }

    this.state.cellEditState.set({
      editingCell: { row: rowIndex, col: colIndex },
      originalValue: value,
      draftValue,
      validationError: null,
    });
  }

  /**
   * Excel-style "typing-to-edit": starts the editor with the cell value replaced
   * by the character the user just typed. For non-text editors (select / date /
   * checkbox / number) we coerce: the character is kept if it's compatible with
   * the editor, otherwise the editor opens on a cleared value.
   */
  startEditWithChar(rowIndex: number, field: string, char: string): void {
    const defMap = this.state.columnDefMap();
    const def = defMap.get(field);
    if (!def?.editable) return;

    const colIndex = this.state.visibleColumns().findIndex((c) => c.field === field);
    if (colIndex < 0) return;

    const sourceIndex = this.gridEngine.displayIndexToSourceIndex(rowIndex);
    const row = sourceIndex >= 0 ? this.state.sourceData()[sourceIndex] : undefined;
    if (!row) return;

    const currentValue = def.valueGetter
      ? def.valueGetter(row)
      : (row as Record<string, unknown>)[field];
    const editorType = def.cellEditor ?? this.resolveEditorType(field, currentValue);

    let draftValue: unknown = char;
    switch (editorType) {
      case 'number': {
        const n = Number(char);
        draftValue = Number.isNaN(n) ? '' : n;
        break;
      }
      case 'checkbox':
        // A character press toggles the checkbox to true — closest Excel-equivalent
        // (Excel doesn't have checkbox cells but booleans flip on typing).
        draftValue = true;
        break;
      case 'select':
      case 'date':
        // These editors have picker UIs; typing just opens them with an empty draft.
        draftValue = '';
        break;
      default:
        draftValue = char;
    }

    this.state.cellEditState.set({
      editingCell: { row: rowIndex, col: colIndex },
      originalValue: currentValue,
      draftValue,
      validationError: null,
    });
  }

  updateDraft(value: unknown): void {
    this.state.cellEditState.update((s) => ({ ...s, draftValue: value }));
  }

  commitEdit(): CellEditEvent<T> | null {
    const editState = this.state.cellEditState();
    if (!editState.editingCell) return null;

    const { row: rowIndex, col: colIndex } = editState.editingCell;
    const visibleCols = this.state.visibleColumns();
    const field = visibleCols[colIndex]?.field;
    if (!field) return null;

    const def = this.state.columnDefMap().get(field);
    const sourceIndex = this.gridEngine.displayIndexToSourceIndex(rowIndex);
    if (sourceIndex < 0) return null;
    let row = this.state.sourceData()[sourceIndex];
    if (!row) return null;

    // Validation
    if (def?.cellEditorValidator) {
      const result = def.cellEditorValidator(editState.draftValue, row);
      if (result === false) {
        this.state.cellEditState.update((s) => ({
          ...s,
          validationError: 'Invalid value',
        }));
        return null;
      }
      if (typeof result === 'string') {
        this.state.cellEditState.update((s) => ({
          ...s,
          validationError: result,
        }));
        return null;
      }
    }

    // Formula drafts are authored in A1 — normalise to REF long-form before
    // persisting, so sourceData always holds storage form (shift, paste and
    // syncFromSource all rely on it).
    const storedDraftValue =
      def?.allowFormula === true &&
      typeof editState.draftValue === 'string' &&
      editState.draftValue.trimStart().startsWith('=')
        ? this.a1DraftToStorage(editState.draftValue)
        : editState.draftValue;

    // Always update data immutably so signals detect the change, regardless
    // of client/server mode. Consumers can still re-fetch/override via output.
    this.state.sourceData.update((data) => {
      const updated = [...data];
      updated[sourceIndex] = { ...updated[sourceIndex], [field]: storedDraftValue } as T;
      return updated;
    });
    // Re-read the updated row for the event
    row = this.state.sourceData()[sourceIndex];

    // Route formula-capable cells through the formula engine. The raw
    // formula string is kept in the source data (inline storage mode) and
    // the rendering layer reads the evaluated value via `valueAt(addr)`.
    // Non-formula cells still trigger `invalidate` so dependents recompute.
    this.updateFormulaEngine(
      def?.allowFormula === true,
      row,
      field,
      storedDraftValue,
      editState.originalValue
    );

    const event: CellEditEvent<T> = {
      row,
      rowIndex: sourceIndex,
      field,
      oldValue: editState.originalValue,
      newValue: storedDraftValue,
    };

    if (event.oldValue !== event.newValue) {
      this.history.record('edit', [
        { rowIndex: sourceIndex, field, before: event.oldValue, after: event.newValue },
      ]);
    }

    this.state.cellEditState.set({
      editingCell: null,
      originalValue: undefined,
      draftValue: undefined,
      validationError: null,
    });

    return event;
  }

  cancelEdit(): CellEditCancelEvent | null {
    const editState = this.state.cellEditState();
    if (!editState.editingCell) return null;

    const { row: rowIndex, col: colIndex } = editState.editingCell;
    const field = this.state.visibleColumns()[colIndex]?.field;

    this.state.cellEditState.set({
      editingCell: null,
      originalValue: undefined,
      draftValue: undefined,
      validationError: null,
    });

    return field ? { rowIndex, field, originalValue: editState.originalValue } : null;
  }

  isEditing(rowIndex: number, colIndex: number): boolean {
    const editState = this.state.cellEditState();
    return editState.editingCell?.row === rowIndex && editState.editingCell?.col === colIndex;
  }

  /**
   * Convert an A1-surface formula draft to REF long-form storage. Strings
   * that do not start with `=` are returned untouched — callers should
   * only invoke this on values they already know to be formulas.
   */
  private a1DraftToStorage(draft: string): string {
    const rowIds = this.state.sourceData().map((row) => {
      const r = row as Record<string, unknown>;
      return (r[this.state.rowIdField()] as string | number | undefined) ?? '';
    });
    const fields = this.state.visibleColumns().map((c) => c.field);
    return a1ToLongForm(draft, { fields, rowIds });
  }

  resolveEditorType(field: string, value: unknown): CellEditorType {
    const def = this.state.columnDefMap().get(field);
    if (def?.cellEditor) return def.cellEditor;

    // Auto-detect
    if (def?.cellEditorOptions?.length) return 'select';
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    if (value instanceof Date) return 'date';
    return 'text';
  }

  /**
   * Route a cell-edit commit through the formula engine when appropriate:
   *  - `allowFormula` column + new value starts with `=` → register formula.
   *  - `allowFormula` column + old value was a formula but new one isn't
   *    → remove the stored formula (reverts to a plain literal).
   *  - Any cell change → invalidate dependents so their cached value
   *    refreshes (no-op when the engine has zero dependents on this cell).
   */
  private updateFormulaEngine(
    allowFormula: boolean,
    row: T,
    field: string,
    newValue: unknown,
    oldValue: unknown
  ): void {
    const engine = this.formulaEngine;
    if (!engine) return;

    const rowId = (row as Record<string, unknown>)[this.state.rowIdField()] as
      | string
      | number
      | undefined;
    if (rowId === undefined) return;
    const addr = { rowId, field };

    const isFormula = (v: unknown): v is string =>
      typeof v === 'string' && v.trimStart().startsWith('=');

    if (allowFormula && isFormula(newValue)) {
      engine.set(addr, newValue);
    } else if (allowFormula && isFormula(oldValue) && !isFormula(newValue)) {
      engine.remove(addr);
    }

    engine.invalidate(addr);
  }
}
