import { type Ref } from 'vue'
import type { ColumnDef, RowData } from '@/components/AdeoGrid/types'

export interface KeyboardOptions {
  /** All columns in flat display order (left-pinned + center + right-pinned). */
  allColumns: Ref<ColumnDef[]>
  /** All renderable rows. */
  rows: Ref<RowData[]>

  // --- Callbacks ---

  /** Called to move the active cell by a delta. */
  onMove: (rowDelta: number, colDelta: number) => void
  /** Called when Shift+Arrow extends selection by a delta. */
  onExtend: (rowDelta: number, colDelta: number) => void
  /** Called when Ctrl+Arrow jumps to an edge. */
  onJumpToEdge: (direction: 'up' | 'down' | 'left' | 'right') => void
  /** Called on Tab (forward) or Shift+Tab (backward). */
  onTab: (forward: boolean) => void
  /** Called on Enter — move down (or up with Shift). */
  onEnter: (forward: boolean) => void
  /** Called on Home/End navigation. */
  onHomeEnd: (key: 'Home' | 'End', ctrl: boolean) => void
  /** Called on PageUp/PageDown. */
  onPage: (direction: 'up' | 'down') => void
  /** Called on Escape. */
  onEscape: () => void
  /** Called on Ctrl+A / Cmd+A. */
  onSelectAll: () => void
  /** Called on Shift+Ctrl+Arrow — jump to edge AND extend selection. */
  onJumpExtend?: (direction: 'up' | 'down' | 'left' | 'right') => void
  /** Called on Ctrl+C / Cmd+C. */
  onCopy?: () => void
  /** Called on Ctrl+X / Cmd+X. */
  onCut?: () => void
  /** Called on Ctrl+V / Cmd+V. */
  onPaste?: () => void
  /** Called on Delete / Backspace when not editing. */
  onDelete?: () => void

  // --- Guards ---

  /** Return true if the grid has an active cell (keyboard should be handled). */
  isActive: () => boolean
  /** Return true if a cell is currently being edited (skip navigation). */
  isEditing: () => boolean
}

/**
 * Central keyboard handler for the grid.
 *
 * Translates raw KeyboardEvents into semantic callbacks so the grid
 * orchestrator can dispatch to the appropriate composable (active cell,
 * cell selection, cell editing).
 *
 * ## Design
 *
 * This composable does **not** own any state. It is a pure event→callback
 * translator. The grid-level `onGridKeyDown` handler calls `handleKeyDown`
 * and the composable invokes the correct callback based on modifier keys.
 *
 * ## Modifier matrix
 *
 * | Key           | Plain       | Shift           | Ctrl/Cmd        | Ctrl+Shift      |
 * |---------------|-------------|-----------------|-----------------|-----------------|
 * | Arrow         | move(1)     | extend(1)       | jumpToEdge      | jumpToEdge+ext  |
 * | Tab           | tab(fwd)    | tab(bwd)        | —               | —               |
 * | Enter         | enter(fwd)  | enter(bwd)      | —               | —               |
 * | Home          | home        | —               | ctrl+home       | —               |
 * | End           | end         | —               | ctrl+end        | —               |
 * | PageUp/Down   | page        | —               | —               | —               |
 * | Escape        | escape      | —               | —               | —               |
 * | Ctrl+A        | —           | —               | selectAll       | —               |
 */
export function useKeyboard(options: KeyboardOptions) {
  const {
    onMove,
    onExtend,
    onJumpToEdge,
    onJumpExtend,
    onTab,
    onEnter,
    onHomeEnd,
    onPage,
    onEscape,
    onSelectAll,
    onCopy,
    onCut,
    onPaste,
    onDelete,
    isActive,
    isEditing,
  } = options

  function handleKeyDown(e: KeyboardEvent) {
    if (!isActive()) return
    // When editing, the input's own @keydown.stop handles Enter/Tab/Escape.
    // Other keys should not trigger navigation.
    if (isEditing()) return

    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        if (ctrl && shift && onJumpExtend) {
          onJumpExtend('up')
        } else if (ctrl) {
          onJumpToEdge('up')
        } else if (shift) {
          onExtend(-1, 0)
        } else {
          onMove(-1, 0)
        }
        break

      case 'ArrowDown':
        e.preventDefault()
        if (ctrl && shift && onJumpExtend) {
          onJumpExtend('down')
        } else if (ctrl) {
          onJumpToEdge('down')
        } else if (shift) {
          onExtend(1, 0)
        } else {
          onMove(1, 0)
        }
        break

      case 'ArrowLeft':
        e.preventDefault()
        if (ctrl && shift && onJumpExtend) {
          onJumpExtend('left')
        } else if (ctrl) {
          onJumpToEdge('left')
        } else if (shift) {
          onExtend(0, -1)
        } else {
          onMove(0, -1)
        }
        break

      case 'ArrowRight':
        e.preventDefault()
        if (ctrl && shift && onJumpExtend) {
          onJumpExtend('right')
        } else if (ctrl) {
          onJumpToEdge('right')
        } else if (shift) {
          onExtend(0, 1)
        } else {
          onMove(0, 1)
        }
        break

      case 'Tab':
        e.preventDefault()
        onTab(!shift)
        break

      case 'Enter':
        // Enter is intercepted for editing at the AdeoGrid level before
        // reaching here. If it arrives, treat it as navigation.
        e.preventDefault()
        onEnter(!shift)
        break

      case 'Home':
        e.preventDefault()
        onHomeEnd('Home', ctrl)
        break

      case 'End':
        e.preventDefault()
        onHomeEnd('End', ctrl)
        break

      case 'PageUp':
        e.preventDefault()
        onPage('up')
        break

      case 'PageDown':
        e.preventDefault()
        onPage('down')
        break

      case 'Escape':
        e.preventDefault()
        onEscape()
        break

      case 'a':
        if (ctrl) {
          e.preventDefault()
          onSelectAll()
        }
        break

      case 'c':
        if (ctrl && onCopy) {
          e.preventDefault()
          onCopy()
        }
        break

      case 'x':
        if (ctrl && onCut) {
          e.preventDefault()
          onCut()
        }
        break

      case 'v':
        if (ctrl && onPaste) {
          e.preventDefault()
          onPaste()
        }
        break

      case 'Delete':
      case 'Backspace':
        if (onDelete) {
          e.preventDefault()
          onDelete()
        }
        break
    }
  }

  return { handleKeyDown }
}
