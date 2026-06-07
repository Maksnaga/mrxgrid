/**
 * Column drag engine — Angular parity (moz-grid / `ColumnDragEngine`).
 *
 * Reads / writes the central `GridState`:
 * - `state.draggingColumn`     — field of the column being dragged (or null)
 * - `state.dropIndicatorIndex` — unpinned index where the drop line shows
 *
 * The visual drag layer (ghost, drop indicator, auto-scroll) still lives in
 * the legacy `useColumnDnD` composable during Phase 2. This engine mirrors
 * the Angular surface — `startDrag` sets the dragging-column state, the
 * drop-indicator setter is called during mousemove, and `endDrag` invokes the
 * `onReorder` callback which delegates to `ColumnReorderEngine.reorderUnpinned`.
 *
 * Once Phase 10 removes the legacy composable, this engine will own the DOM
 * layer directly (ghost + drop line + rAF auto-scroll), matching Angular 1-for-1.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { GridState } from '../state/useGridState'
import type { RowData } from '../types'
import type { ColumnReorderEngine } from './useColumnReorderEngine'

export interface ColumnDragEngine {
  readonly draggingColumn: ComputedRef<string | null>
  readonly dropIndicatorIndex: ComputedRef<number | null>
  readonly isActive: ComputedRef<boolean>
  /** Callback invoked after `endDrag` completes a reorder. Set by the host. */
  readonly onReorder: Ref<((previousIndex: number, currentIndex: number) => void) | null>
  /** Mark a drag as started for the given field. */
  startDrag(field: string): void
  /** Update the drop indicator position (unpinned index), or null to hide. */
  setDropIndicator(index: number | null): void
  /**
   * Commit the drag: if `dropIndex` is valid and distinct from `sourceIndex`,
   * calls `reorderEngine.reorderUnpinned` and fires `onReorder`. Clears state
   * either way.
   */
  endDrag(sourceIndex: number, dropIndex: number | null): void
  /** Abort the drag without committing (Escape / mouseup before threshold). */
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

  function startDrag(field: string): void {
    state.draggingColumn.value = field
    state.dropIndicatorIndex.value = null
  }

  function setDropIndicator(index: number | null): void {
    if (state.dropIndicatorIndex.value !== index) {
      state.dropIndicatorIndex.value = index
    }
  }

  function endDrag(sourceIndex: number, dropIndex: number | null): void {
    state.draggingColumn.value = null
    state.dropIndicatorIndex.value = null

    if (dropIndex === null) return
    if (dropIndex === sourceIndex || dropIndex === sourceIndex + 1) return

    // If dropping after the source, subtract 1 because the source is removed first.
    const targetIndex = dropIndex > sourceIndex ? dropIndex - 1 : dropIndex
    reorderEngine.reorderUnpinned(sourceIndex, targetIndex)
    onReorder.value?.(sourceIndex, targetIndex)
  }

  function cancelDrag(): void {
    state.draggingColumn.value = null
    state.dropIndicatorIndex.value = null
  }

  return {
    draggingColumn,
    dropIndicatorIndex,
    isActive,
    onReorder,
    startDrag,
    setDropIndicator,
    endDrag,
    cancelDrag,
  }
}
