/**
 * Column drag engine — Angular parity (moz-grid / `ColumnDragEngine`).
 *
 * Phase 10 — complete DOM layer ownership (ghost + full-height drop line +
 * rAF auto-scroll), matching Angular's column-drag.engine.ts 1-for-1.
 *
 * Reads / writes the central `GridState`:
 * - `state.draggingColumn`     — field of the column being dragged (or null)
 * - `state.dropIndicatorIndex` — unpinned index where the drop line shows
 *
 * DOM responsibilities owned by this engine (no NgZone — just vanilla listeners):
 * - **5px threshold**: drag is not activated until the mouse moves ≥5px.
 * - **Ghost**: clones the source header cell; fixed-position, pointer-events:none.
 * - **Auto-scroll**: rAF loop when mouse is within 60px of the scroll viewport edge.
 * - **Drop line**: full-height fixed div at the drop position, 2px wide, primary colour.
 * - **scrollLeft re-sync**: on mouseup, re-pushes `scrollEl.scrollLeft` into state so
 *   virtual column recompute uses the real post-drag scroll position.
 *
 * The engine exposes `startDrag(event, sourceIndex, headerRow, scrollEl)` —
 * the header component must pass the header row element and the horizontal
 * scroll viewport element so the engine can query header cells and auto-scroll.
 * The legacy `setDropIndicator` and the old signature-less `startDrag(field)`
 * are kept as shims for backward compatibility with any callers that have not
 * yet migrated to the Phase 10 signature.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { GridState } from '../state/useGridState'
import type { RowData } from '../types'
import type { ColumnReorderEngine } from './useColumnReorderEngine'

/** Minimum pixels of mouse movement before a drag is initiated */
const DRAG_THRESHOLD = 5

/** Distance from edge in px at which auto-scroll activates */
const AUTO_SCROLL_ZONE = 60

/** Max scroll speed in px/frame */
const AUTO_SCROLL_SPEED = 12

export interface ColumnDragEngine {
  readonly draggingColumn: ComputedRef<string | null>
  readonly dropIndicatorIndex: ComputedRef<number | null>
  readonly isActive: ComputedRef<boolean>
  /** Callback invoked after a reorder completes. Set by the host component. */
  readonly onReorder: Ref<((previousIndex: number, currentIndex: number) => void) | null>

  /**
   * Phase 10 full-DOM signature.
   * Call on mousedown on a header cell — does NOT preventDefault so sort still
   * fires on short clicks. Registers listeners to detect the threshold.
   *
   * @param event        The native mousedown event.
   * @param sourceIndex  Absolute index in `state.unpinnedColumnStates` (or visible columns).
   * @param headerRow    The header row element (parent of header cells).
   * @param scrollEl     The horizontal scroll viewport element (for auto-scroll + scrollLeft sync).
   */
  startDrag(event: MouseEvent, sourceIndex: number, headerRow: HTMLElement, scrollEl: HTMLElement | null): void

  /** Update the drop indicator position (unpinned index), or null to hide. Legacy shim. */
  setDropIndicator(index: number | null): void

  /**
   * Legacy shim: activate a drag by field name without DOM context.
   * Kept for callers that have not migrated to the Phase 10 signature.
   */
  startDragByField(field: string): void

  /**
   * Commit the drag (legacy shim used by old `useColumnDnD` path).
   * Prefer the Phase 10 path where mouseup is handled internally.
   */
  endDrag(sourceIndex: number, dropIndex: number | null): void

  /** Abort the drag without committing (Escape key). */
  cancelDrag(): void
}

export function useColumnDragEngine<T = RowData>(
  state: GridState<T>,
  reorderEngine: ColumnReorderEngine,
): ColumnDragEngine {
  const draggingColumn = computed<string | null>(() => state.draggingColumn.value)
  const dropIndicatorIndex = computed<number | null>(() => state.dropIndicatorIndex.value)
  const isActive = computed<boolean>(() => state.draggingColumn.value !== null)
  const onReorder = ref<((previousIndex: number, currentIndex: number) => void) | null>(null)

  // --- Pending state (before threshold is met) ---
  let pending = false
  let startX = 0
  let startY = 0
  let pendingSourceIndex = -1
  let pendingHeaderRow: HTMLElement | null = null
  let pendingScrollEl: HTMLElement | null = null

  // --- Active drag state (after threshold is met) ---
  let active = false
  let originalIndex = -1
  let headerRow: HTMLElement | null = null
  let ghostEl: HTMLElement | null = null
  let ghostOffsetX = 0
  let ghostOffsetY = 0

  // Full-height drop indicator line
  let dropLineEl: HTMLElement | null = null

  // Auto-scroll state
  let scrollEl: HTMLElement | null = null
  let autoScrollRafId: number | null = null
  let autoScrollDirection = 0 // -1 left, 0 none, 1 right

  // ── Event handler references (stable so removeEventListener works) ──
  const onMoveHandler = (e: MouseEvent) => onMouseMove(e)
  const onUpHandler = () => onMouseUp()

  // ── Public API ──────────────────────────────────────────────────────

  function startDrag(
    event: MouseEvent,
    sourceIndex: number,
    hRow: HTMLElement,
    sEl: HTMLElement | null,
  ): void {
    pending = true
    startX = event.clientX
    startY = event.clientY
    pendingSourceIndex = sourceIndex
    pendingHeaderRow = hRow
    pendingScrollEl = sEl

    document.addEventListener('mousemove', onMoveHandler)
    document.addEventListener('mouseup', onUpHandler)
  }

  /** Legacy shim for callers that only have the field name. */
  function startDragByField(field: string): void {
    state.draggingColumn.value = field
    state.dropIndicatorIndex.value = null
  }

  function setDropIndicator(index: number | null): void {
    if (state.dropIndicatorIndex.value !== index) {
      state.dropIndicatorIndex.value = index
    }
  }

  /** Legacy shim — used by the old `useColumnDnD` path. */
  function endDrag(sourceIndex: number, dropIndex: number | null): void {
    state.draggingColumn.value = null
    state.dropIndicatorIndex.value = null

    if (dropIndex === null) return
    if (dropIndex === sourceIndex || dropIndex === sourceIndex + 1) return

    const targetIndex = dropIndex > sourceIndex ? dropIndex - 1 : dropIndex
    reorderEngine.reorderUnpinned(sourceIndex, targetIndex)
    onReorder.value?.(sourceIndex, targetIndex)
  }

  function cancelDrag(): void {
    cleanup()
    state.draggingColumn.value = null
    state.dropIndicatorIndex.value = null
  }

  // ── Internal drag lifecycle ─────────────────────────────────────────

  function activateDrag(): void {
    pending = false
    active = true
    originalIndex = pendingSourceIndex
    headerRow = pendingHeaderRow
    scrollEl = pendingScrollEl

    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    const cols = state.columnStates.value.filter((c) => !c.pinned)
    const col = cols[originalIndex]
    if (col) {
      state.draggingColumn.value = col.field
    }

    createGhost()
  }

  function createGhost(): void {
    if (!headerRow) return
    const headerCells = queryUnpinnedHeaderCells()
    const sourceCell = headerCells[originalIndex]
    if (!sourceCell) return

    const rect = sourceCell.getBoundingClientRect()

    // Read canonical width from state to avoid ghost spanning the full scroll
    // width when the source cell is the last flex-stretched cell.
    const cols = state.columnStates.value.filter((c) => !c.pinned)
    const sourceCol = cols[originalIndex]
    const width = sourceCol?.currentWidth ?? rect.width

    ghostOffsetX = Math.min(startX - rect.left, width)
    ghostOffsetY = startY - rect.top

    const ghost = sourceCell.cloneNode(true) as HTMLElement
    ghost.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${width}px;
      height: ${rect.height}px;
      opacity: 0.8;
      z-index: 10000;
      pointer-events: none;
      box-shadow: 0 8px 24px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12);
      border-radius: 6px;
      background: var(--color-background-primary, #fff);
      border: 2px solid var(--color-background-accent-inverse, #0070f3);
      transition: none;
    `
    document.body.appendChild(ghost)
    ghostEl = ghost

    sourceCell.style.opacity = '0.2'
  }

  function moveGhost(clientX: number, clientY: number): void {
    if (!ghostEl) return
    ghostEl.style.left = `${clientX - ghostOffsetX}px`
    ghostEl.style.top = `${clientY - ghostOffsetY}px`
  }

  function removeGhost(): void {
    if (ghostEl) {
      ghostEl.remove()
      ghostEl = null
    }
    // Restore opacity on all header cells.
    if (headerRow) {
      for (const cell of queryUnpinnedHeaderCells()) {
        cell.style.opacity = ''
      }
    }
  }

  /** Returns unpinned header cells in DOM order. Filters out sticky pinned cells. */
  function queryUnpinnedHeaderCells(): HTMLElement[] {
    if (!headerRow) return []
    // Selects header cell host elements that do NOT carry the pinned class.
    return Array.from(
      headerRow.querySelectorAll<HTMLElement>(
        '[data-field]:not([data-pinned])',
      ),
    )
  }

  function onMouseMove(event: MouseEvent): void {
    if (pending && !active) {
      const dx = event.clientX - startX
      const dy = event.clientY - startY
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      activateDrag()
    }

    if (!active || !headerRow) return

    moveGhost(event.clientX, event.clientY)
    updateAutoScroll(event.clientX)

    const headerCells = queryUnpinnedHeaderCells()
    const cursorX = event.clientX

    let newDropIndex: number | null = null
    for (let i = 0; i < headerCells.length; i++) {
      const rect = headerCells[i]!.getBoundingClientRect()
      const midX = rect.left + rect.width / 2
      if (cursorX < midX) {
        newDropIndex = i
        break
      }
    }

    // Past the last cell — drop at the very end.
    if (newDropIndex === null) {
      newDropIndex = headerCells.length
    }

    // Don't show indicator at the source column's own position or immediately after.
    if (newDropIndex === originalIndex || newDropIndex === originalIndex + 1) {
      newDropIndex = null
    }

    if (state.dropIndicatorIndex.value !== newDropIndex) {
      state.dropIndicatorIndex.value = newDropIndex
    }

    updateDropLine(newDropIndex, headerCells)
  }

  function onMouseUp(): void {
    document.removeEventListener('mousemove', onMoveHandler)
    document.removeEventListener('mouseup', onUpHandler)

    if (!active) {
      cleanup()
      return
    }

    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    removeGhost()

    const prevIdx = originalIndex
    const dropIdx = state.dropIndicatorIndex.value

    // Re-sync scrollLeft so virtual column recompute uses the real post-drag
    // scroll position (mirrors Angular `onMouseUp` scrollLeft re-push).
    const sEl = scrollEl
    if (sEl) {
      state.scrollLeft.value = sEl.scrollLeft
      state.scrollViewportWidth.value = sEl.clientWidth
    }

    state.draggingColumn.value = null
    state.dropIndicatorIndex.value = null

    cleanup()

    if (dropIdx !== null && dropIdx !== prevIdx && dropIdx !== prevIdx + 1) {
      const targetIndex = dropIdx > prevIdx ? dropIdx - 1 : dropIdx
      reorderEngine.reorderUnpinned(prevIdx, targetIndex)
      onReorder.value?.(prevIdx, targetIndex)
    }
  }

  // ── Drop line (full-height indicator) ──────────────────────────────

  function updateDropLine(newDropIndex: number | null, headerCells: HTMLElement[]): void {
    if (newDropIndex === null) {
      removeDropLine()
      return
    }

    let lineX: number
    if (newDropIndex >= 0 && newDropIndex < headerCells.length) {
      const rect = headerCells[newDropIndex]!.getBoundingClientRect()
      lineX = rect.left
    } else if (headerCells.length > 0) {
      const rect = headerCells[headerCells.length - 1]!.getBoundingClientRect()
      lineX = rect.right
    } else {
      removeDropLine()
      return
    }

    // Use the grid container as the reference for full-height sizing.
    const gridEl = headerRow?.closest('.adeo-grid') ?? headerRow?.closest('[class*="adeo-grid"]')
    if (!gridEl) return
    const gridRect = gridEl.getBoundingClientRect()

    if (!dropLineEl) {
      dropLineEl = document.createElement('div')
      dropLineEl.style.cssText = `
        position: fixed;
        width: 2px;
        background: var(--color-background-accent-inverse, #0070f3);
        z-index: 10001;
        pointer-events: none;
        border-radius: 1px;
      `
      document.body.appendChild(dropLineEl)
    }

    dropLineEl.style.left = `${lineX - 1}px`
    dropLineEl.style.top = `${gridRect.top}px`
    dropLineEl.style.height = `${gridRect.height}px`
  }

  function removeDropLine(): void {
    if (dropLineEl) {
      dropLineEl.remove()
      dropLineEl = null
    }
  }

  // ── Auto-scroll helpers ─────────────────────────────────────────────

  function updateAutoScroll(clientX: number): void {
    if (!scrollEl) return

    const rect = scrollEl.getBoundingClientRect()
    const distFromLeft = clientX - rect.left
    const distFromRight = rect.right - clientX

    if (distFromLeft < AUTO_SCROLL_ZONE) {
      autoScrollDirection = -1
    } else if (distFromRight < AUTO_SCROLL_ZONE) {
      autoScrollDirection = 1
    } else {
      autoScrollDirection = 0
    }

    if (autoScrollDirection !== 0 && autoScrollRafId === null) {
      startAutoScroll()
    } else if (autoScrollDirection === 0) {
      stopAutoScroll()
    }
  }

  function startAutoScroll(): void {
    const tick = () => {
      if (!scrollEl || autoScrollDirection === 0) {
        stopAutoScroll()
        return
      }
      scrollEl.scrollLeft += autoScrollDirection * AUTO_SCROLL_SPEED
      autoScrollRafId = requestAnimationFrame(tick)
    }
    autoScrollRafId = requestAnimationFrame(tick)
  }

  function stopAutoScroll(): void {
    if (autoScrollRafId !== null) {
      cancelAnimationFrame(autoScrollRafId)
      autoScrollRafId = null
    }
    autoScrollDirection = 0
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  function cleanup(): void {
    stopAutoScroll()
    removeDropLine()
    pending = false
    active = false
    originalIndex = -1
    headerRow = null
    pendingHeaderRow = null
    ghostEl = null
    scrollEl = null
    pendingScrollEl = null
  }

  return {
    draggingColumn,
    dropIndicatorIndex,
    isActive,
    onReorder,
    startDrag,
    startDragByField,
    setDropIndicator,
    endDrag,
    cancelDrag,
  }
}
