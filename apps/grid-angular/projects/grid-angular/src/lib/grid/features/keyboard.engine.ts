import { Injectable, inject } from '@angular/core';
import { CellSelectionEngine } from './cell-selection.engine';
import { InlineEditEngine } from './inline-edit.engine';
import { GridStateManager } from '../state/grid-state';

/**
 * Actions that require grid-level orchestration (event emission, clipboard
 * system access, async, UI refocus). The keyboard engine can run pure
 * navigation locally, but bounces these back to the host component.
 */
export interface KeyboardActions {
  copy: () => void;
  paste: () => void;
  cut: () => void;
  deleteRange: () => void;
  undo: () => void;
  redo: () => void;
  fillDown: () => void;
  fillRight: () => void;
  startEdit: (row: number, col: number, initialChar?: string) => void;
}

@Injectable()
export class KeyboardEngine<T = unknown> {
  private readonly cellSelection = inject<CellSelectionEngine<T>>(CellSelectionEngine);
  private readonly inlineEdit = inject<InlineEditEngine<T>>(InlineEditEngine);
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  private actions: KeyboardActions | null = null;

  registerActions(actions: KeyboardActions): void {
    this.actions = actions;
  }

  handleKeydown(event: KeyboardEvent): void {
    // Edit-mode keys are handled by AdGridAngularComponent.handleEditModeKeydown;
    // this engine only owns navigation + shortcuts in non-editing state.
    if (this.state.cellEditState().editingCell !== null) return;

    const focused = this.state.focusedCell();
    if (!focused) return;

    if (this.dispatch(event, focused)) {
      event.preventDefault();
    }
  }

  /** Returns true when the event was handled (so the caller should preventDefault). */
  private dispatch(event: KeyboardEvent, focused: { row: number; col: number }): boolean {
    const mod = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const alt = event.altKey;
    const key = event.key;

    // ---- Clipboard / history shortcuts --------------------------------------
    if (mod && !shift && !alt) {
      switch (key.toLowerCase()) {
        case 'c':
          this.actions?.copy();
          return true;
        case 'v':
          this.actions?.paste();
          return true;
        case 'x':
          this.actions?.cut();
          return true;
        case 'z':
          this.actions?.undo();
          return true;
        case 'y':
          this.actions?.redo();
          return true;
        case 'a':
          this.cellSelection.selectAll();
          return true;
        case 'd':
          this.actions?.fillDown();
          return true;
        case 'r':
          this.actions?.fillRight();
          return true;
      }
    }
    if (mod && shift && !alt && key.toLowerCase() === 'z') {
      this.actions?.redo();
      return true;
    }

    // ---- Whole row / column selection ---------------------------------------
    if (key === ' ') {
      if (mod && shift) {
        this.cellSelection.selectAll();
        return true;
      }
      if (mod) {
        this.cellSelection.selectColumn(focused.col);
        return true;
      }
      if (shift) {
        this.cellSelection.selectRow(focused.row);
        return true;
      }
    }

    // ---- Delete / Backspace: clear cells ------------------------------------
    if (key === 'Delete' || key === 'Backspace') {
      this.actions?.deleteRange();
      return true;
    }

    // ---- Arrow keys ---------------------------------------------------------
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      return this.handleArrow(key, { mod, shift });
    }

    // ---- Home / End / PageUp / PageDown -------------------------------------
    if (key === 'Home') {
      if (mod && shift) this.cellSelection.extendRangeToGridStart();
      else if (mod) this.cellSelection.moveToGridStart();
      else if (shift) this.cellSelection.extendRangeToRowStart();
      else this.cellSelection.moveToRowStart();
      return true;
    }
    if (key === 'End') {
      if (mod && shift) this.cellSelection.extendRangeToGridEnd();
      else if (mod) this.cellSelection.moveToGridEnd();
      else if (shift) this.cellSelection.extendRangeToRowEnd();
      else this.cellSelection.moveToRowEnd();
      return true;
    }
    if (key === 'PageUp') {
      if (shift) this.cellSelection.extendRangeByPage('up');
      else this.cellSelection.movePage('up');
      return true;
    }
    if (key === 'PageDown') {
      if (shift) this.cellSelection.extendRangeByPage('down');
      else this.cellSelection.movePage('down');
      return true;
    }

    // ---- Tab / Enter / F2 / Escape ------------------------------------------
    if (key === 'Tab') {
      if (shift) this.cellSelection.moveLeft();
      else this.cellSelection.moveRight();
      return true;
    }
    if (key === 'Enter') {
      const col = this.state.visibleColumns()[focused.col];
      const def = col ? this.state.columnDefMap().get(col.field) : undefined;
      if (def?.editable) {
        this.actions?.startEdit(focused.row, focused.col);
        return true;
      }
      if (shift) this.cellSelection.moveUp();
      else this.cellSelection.moveDown();
      return true;
    }
    if (key === 'F2') {
      this.actions?.startEdit(focused.row, focused.col);
      return true;
    }
    if (key === 'Escape') {
      this.cellSelection.clearFocus();
      return true;
    }

    // ---- Typing-to-edit -----------------------------------------------------
    if (!mod && !alt && this.isPrintableKey(event)) {
      this.actions?.startEdit(focused.row, focused.col, key);
      return true;
    }

    return false;
  }

  private handleArrow(
    key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
    mods: { mod: boolean; shift: boolean },
  ): boolean {
    const dir = key === 'ArrowUp' ? 'up' : key === 'ArrowDown' ? 'down' : key === 'ArrowLeft' ? 'left' : 'right';

    if (mods.mod && mods.shift) {
      this.cellSelection.extendRangeJumpToEdge(dir);
      return true;
    }
    if (mods.mod) {
      this.cellSelection.jumpToEdge(dir);
      return true;
    }
    if (mods.shift) {
      const dRow = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
      const dCol = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
      this.cellSelection.extendRangeBy(dRow, dCol);
      return true;
    }

    switch (dir) {
      case 'up':
        this.cellSelection.moveUp();
        break;
      case 'down':
        this.cellSelection.moveDown();
        break;
      case 'left':
        this.cellSelection.moveLeft();
        break;
      case 'right':
        this.cellSelection.moveRight();
        break;
    }
    return true;
  }

  /**
   * A key press is "printable" when it represents exactly one character that
   * the user intends as input — excluding named keys like F1, Home, Arrow*,
   * etc. Also excludes IME composition events (event.isComposing).
   */
  private isPrintableKey(event: KeyboardEvent): boolean {
    if (event.isComposing) return false;
    if (event.key.length !== 1) return false;
    // Guard against NUL / control characters slipping through on some layouts.
    const code = event.key.charCodeAt(0);
    return code >= 32 && code !== 127;
  }
}
