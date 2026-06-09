/**
 * Keyboard engine — Angular parity (ad-grid / `KeyboardEngine`).
 *
 * Dispatches every non-editing key event:
 *   - Ctrl+C / V / X / Z / Y / A / D / R and Ctrl+Shift+Z → `KeyboardActions`
 *   - Ctrl+Space / Shift+Space / Ctrl+Shift+Space → whole-column / row / grid
 *   - Delete / Backspace → `deleteRange`
 *   - Arrow keys (plain, shift, ctrl, ctrl+shift) → `CellSelectionActions`
 *   - Home / End / PageUp / PageDown → `CellSelectionActions`
 *   - Tab / Enter / F2 / Escape
 *   - Printable key → typing-to-edit (`startEdit` with initial char)
 *
 * The `CellSelectionActions` surface is intentionally abstract — Phase 5 will
 * supply a concrete `useCellSelectionEngine` that satisfies it, but Phase 4
 * can wire the keyboard engine against the legacy composable in the interim.
 */

import type { GridState } from '../state/useGridState'
import type { InlineEditEngine } from './useInlineEditEngine'
import type { RowData } from '../types'

export interface KeyboardActions {
  copy: () => void
  paste: () => void
  cut: () => void
  deleteRange: () => void
  undo: () => void
  redo: () => void
  fillDown: () => void
  fillRight: () => void
  startEdit: (row: number, col: number, initialChar?: string) => void
}

export interface CellSelectionActions {
  selectAll(): void
  selectColumn(col: number): void
  selectRow(row: number): void
  moveUp(): void
  moveDown(): void
  moveLeft(): void
  moveRight(): void
  moveToRowStart(): void
  moveToRowEnd(): void
  moveToGridStart(): void
  moveToGridEnd(): void
  extendRangeToRowStart(): void
  extendRangeToRowEnd(): void
  extendRangeToGridStart(): void
  extendRangeToGridEnd(): void
  movePage(direction: 'up' | 'down'): void
  extendRangeByPage(direction: 'up' | 'down'): void
  jumpToEdge(direction: 'up' | 'down' | 'left' | 'right'): void
  extendRangeJumpToEdge(direction: 'up' | 'down' | 'left' | 'right'): void
  extendRangeBy(dRow: number, dCol: number): void
  clearFocus(): void
}

export interface KeyboardEngine {
  registerActions(actions: KeyboardActions): void
  setCellSelection(actions: CellSelectionActions): void
  handleKeydown(event: KeyboardEvent): void
}

export function useKeyboardEngine<T = RowData>(
  state: GridState<T>,
  inlineEdit: InlineEditEngine<T>,
  initialCellSelection?: CellSelectionActions,
): KeyboardEngine {
  let actions: KeyboardActions | null = null
  let cellSelection: CellSelectionActions | null = initialCellSelection ?? null

  // inlineEdit is kept in the closure even though `handleKeydown` only touches
  // `state.cellEditState` — it lets the keyboard engine be extended with
  // edit-mode dispatch later without changing its construction surface.
  void inlineEdit

  function registerActions(next: KeyboardActions): void {
    actions = next
  }

  function setCellSelection(next: CellSelectionActions): void {
    cellSelection = next
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (state.cellEditState.value.editingCell !== null) return

    const focused = state.focusedCell.value
    if (!focused) return

    if (dispatch(event, focused)) {
      event.preventDefault()
    }
  }

  function dispatch(event: KeyboardEvent, focused: { row: number; col: number }): boolean {
    const mod = event.ctrlKey || event.metaKey
    const shift = event.shiftKey
    const alt = event.altKey
    const key = event.key

    if (mod && !shift && !alt) {
      switch (key.toLowerCase()) {
        case 'c':
          actions?.copy()
          return true
        case 'v':
          actions?.paste()
          return true
        case 'x':
          actions?.cut()
          return true
        case 'z':
          actions?.undo()
          return true
        case 'y':
          actions?.redo()
          return true
        case 'a':
          cellSelection?.selectAll()
          return true
        case 'd':
          actions?.fillDown()
          return true
        case 'r':
          actions?.fillRight()
          return true
      }
    }
    if (mod && shift && !alt && key.toLowerCase() === 'z') {
      actions?.redo()
      return true
    }

    if (key === ' ') {
      if (mod && shift) {
        cellSelection?.selectAll()
        return true
      }
      if (mod) {
        cellSelection?.selectColumn(focused.col)
        return true
      }
      if (shift) {
        cellSelection?.selectRow(focused.row)
        return true
      }
    }

    if (key === 'Delete' || key === 'Backspace') {
      actions?.deleteRange()
      return true
    }

    if (
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight'
    ) {
      return handleArrow(key, { mod, shift })
    }

    if (key === 'Home') {
      if (!cellSelection) return true
      if (mod && shift) cellSelection.extendRangeToGridStart()
      else if (mod) cellSelection.moveToGridStart()
      else if (shift) cellSelection.extendRangeToRowStart()
      else cellSelection.moveToRowStart()
      return true
    }
    if (key === 'End') {
      if (!cellSelection) return true
      if (mod && shift) cellSelection.extendRangeToGridEnd()
      else if (mod) cellSelection.moveToGridEnd()
      else if (shift) cellSelection.extendRangeToRowEnd()
      else cellSelection.moveToRowEnd()
      return true
    }
    if (key === 'PageUp') {
      if (!cellSelection) return true
      if (shift) cellSelection.extendRangeByPage('up')
      else cellSelection.movePage('up')
      return true
    }
    if (key === 'PageDown') {
      if (!cellSelection) return true
      if (shift) cellSelection.extendRangeByPage('down')
      else cellSelection.movePage('down')
      return true
    }

    if (key === 'Tab') {
      if (!cellSelection) return true
      if (shift) cellSelection.moveLeft()
      else cellSelection.moveRight()
      return true
    }
    if (key === 'Enter') {
      const col = state.visibleColumns.value[focused.col]
      const def = col ? state.columnDefMap.value.get(col.field) : undefined
      if (def?.editable) {
        actions?.startEdit(focused.row, focused.col)
        return true
      }
      if (!cellSelection) return true
      if (shift) cellSelection.moveUp()
      else cellSelection.moveDown()
      return true
    }
    if (key === 'F2') {
      actions?.startEdit(focused.row, focused.col)
      return true
    }
    if (key === 'Escape') {
      cellSelection?.clearFocus()
      return true
    }

    if (!mod && !alt && isPrintableKey(event)) {
      actions?.startEdit(focused.row, focused.col, key)
      return true
    }

    return false
  }

  function handleArrow(
    key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
    mods: { mod: boolean; shift: boolean },
  ): boolean {
    if (!cellSelection) return true
    const dir =
      key === 'ArrowUp'
        ? 'up'
        : key === 'ArrowDown'
          ? 'down'
          : key === 'ArrowLeft'
            ? 'left'
            : 'right'

    if (mods.mod && mods.shift) {
      cellSelection.extendRangeJumpToEdge(dir)
      return true
    }
    if (mods.mod) {
      cellSelection.jumpToEdge(dir)
      return true
    }
    if (mods.shift) {
      const dRow = dir === 'up' ? -1 : dir === 'down' ? 1 : 0
      const dCol = dir === 'left' ? -1 : dir === 'right' ? 1 : 0
      cellSelection.extendRangeBy(dRow, dCol)
      return true
    }

    switch (dir) {
      case 'up':
        cellSelection.moveUp()
        break
      case 'down':
        cellSelection.moveDown()
        break
      case 'left':
        cellSelection.moveLeft()
        break
      case 'right':
        cellSelection.moveRight()
        break
    }
    return true
  }

  function isPrintableKey(event: KeyboardEvent): boolean {
    if (event.isComposing) return false
    if (event.key.length !== 1) return false
    const code = event.key.charCodeAt(0)
    return code >= 32 && code !== 127
  }

  return { registerActions, setCellSelection, handleKeydown }
}
