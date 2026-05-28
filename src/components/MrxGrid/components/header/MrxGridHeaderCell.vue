<script setup lang="ts">
/**
 * Header cell — Angular parity (`moz-grid-header-cell`).
 *
 * One header cell, as rendered by `MrxGridHeader`. Formerly the cell markup
 * was duplicated three times in `MrxGridHeader.vue` (left-pinned / center /
 * right-pinned). This component consolidates the three copies into a single
 * definition; the parent keeps control of positioning (pinning offsets,
 * spacers, sticky layers, edge shadows) via the `cellStyle` / `cellClass`
 * props.
 *
 * Responsibilities of this component:
 *   - render the header cell wrapper (`div.mrx-grid-header-cell`)
 *   - render label + sort indicator + kebab menu trigger
 *   - render the resize handle when enabled
 *   - forward mousedown events for column drag (parent wires up reorder)
 *
 * Sort-direction / sort-index / column metadata are passed in; the component
 * stays stateless.
 */

import { computed, type CSSProperties } from 'vue'
import { Settings20, SortDown20, SortTop20 } from '@mozaic-ds/icons-vue'
import type { ColumnDef, SortDirection } from '../../types'
import { injectMrxGridSlots, resolveHeaderSlot } from '../../state/MrxGridSlots'

const props = defineProps<{
  column: ColumnDef
  /** Computed width (`"120px"`, `"auto"`, …). */
  width?: string
  /** Extra style merged onto the header cell wrapper (pinned offsets, etc.). */
  cellStyle?: CSSProperties
  /** Extra class merged onto the header cell wrapper. */
  cellClass?: string | string[] | Record<string, boolean>
  /** Sort direction for this field, if any. */
  sortDirection?: SortDirection | null
  /**
   * 1-based sort priority shown next to the indicator when multiple sorts are
   * active. `null`/`undefined`/`0` hides the hint.
   */
  sortIndex?: number | null
  /** When true, render the resize handle on the right edge of the cell. */
  resizable?: boolean
  /** When true, the cell flex-grows to absorb trailing empty space. The
   *  declared `width` becomes the cell's `min-width` so it never shrinks
   *  below its column-config width. Used for the last unpinned column
   *  when no right-pinned column is present. */
  fill?: boolean
}>()

const emit = defineEmits<{
  menu: [field: string, event: MouseEvent]
  /** `fromLeft` is true when the resize handle on the left edge of a
   *  right-pinned cell is grabbed — the parent inverts the delta sign
   *  so dragging leftward enlarges the column. */
  resizeStart: [field: string, event: MouseEvent, fromLeft: boolean]
  dragStart: [field: string, event: MouseEvent]
  /** Click on the header cell (not on kebab/resize/filter input) — cycles sort. Shift+click = multi-sort. */
  sort: [field: string, isMultiSort: boolean]
}>()

const isSortable = computed(() => props.column.sortable !== false)

/** Right-pinned columns are anchored to the right edge of the viewport,
 *  so growing them rightward would push them out of view. We flip the
 *  resize handle to the LEFT edge — dragging it leftward then extends
 *  the column into the viewport, which matches user intuition for
 *  fixed-end columns. */
const resizeFromLeft = computed(
  () =>
    props.column.pinned === 'right' || props.column.pinned === 'end',
)

const sortIcon = computed(() => {
  if (props.sortDirection === 'asc') return SortTop20
  if (props.sortDirection === 'desc') return SortDown20
  return null
})

// Phase 3.3 — resolve `#header-{field}` / `<MrxColumn> #header` / `#header` slot.
const _gridSlots = injectMrxGridSlots()
const resolvedHeaderSlot = computed(() => resolveHeaderSlot(_gridSlots, props.column.field))

/** True while this header is the column being drag-reordered — drives the
 *  `--moving` dim class. Reactive via the slot context: applied / removed
 *  in the same Vue render as the column reorder so virtualised remounts
 *  pick up the right state without a flicker. */
const isMoving = computed(
  () => _gridSlots?.movingField?.value === props.column.field,
)

function onHeaderMouseDown(e: MouseEvent): void {
  // Don't start column drag from resize handle or menu button
  const target = e.target as HTMLElement
  if (
    target.closest('.mrx-grid-resize-handle') ||
    target.closest('.mrx-grid-menu-trigger')
  ) {
    return
  }
  emit('dragStart', props.column.field, e)
}

function onMenuClick(e: MouseEvent): void {
  emit('menu', props.column.field, e)
}

function onHeaderClick(e: MouseEvent): void {
  // Skip clicks that originated on the kebab menu or the resize handle —
  // those have their own behaviour. Slot-rendered controls in `#header-{field}`
  // can opt out by calling `event.stopPropagation()`.
  const target = e.target as HTMLElement
  if (target.closest('.mrx-grid-resize-handle') || target.closest('.mrx-grid-menu-trigger')) {
    return
  }
  if (!isSortable.value) return
  emit('sort', props.column.field, e.shiftKey)
}

function onResizeMouseDown(e: MouseEvent): void {
  emit('resizeStart', props.column.field, e, resizeFromLeft.value)
}
</script>

<template>
  <div class="mrx-grid-header-cell" :class="[cellClass, { 'mrx-grid-header-cell--moving': isMoving }]" :style="fill
    ? {
      ...cellStyle,
      // basis 0 (not auto) so a long header label can't push the
      // cell past `declaredWidth`. min-width still floors the cell
      // at the configured size; flex-grow absorbs any trailing
      // empty space in the header row.
      flex: '1 1 0',
      width: 'auto',
      minWidth: width ?? column.width,
      cursor: isSortable ? 'pointer' : 'grab',
    }
    : {
      ...cellStyle,
      width: width ?? column.width,
      minWidth: width ?? column.width,
      cursor: isSortable ? 'pointer' : 'grab',
    }
    " role="columnheader" :data-field="column.field" @mousedown="onHeaderMouseDown" @click="onHeaderClick">
    <span class="mrx-grid-header-content">
      <component v-if="resolvedHeaderSlot" :is="resolvedHeaderSlot" :column="column"
        :sort-direction="sortDirection ?? null" />
      <span v-else class="mrx-grid-header-label">{{ column.headerName }}</span>
      <span v-if="sortIcon" class="mrx-grid-sort-indicator" aria-hidden="true">
        <component :is="sortIcon" class="mrx-grid-sort-icon" />
        <span v-if="sortIndex" class="mrx-grid-sort-index">
          {{ sortIndex }}
        </span>
      </span>
      <button type="button" class="mrx-grid-menu-trigger" aria-label="Menu de la colonne" @click.stop="onMenuClick">
        <Settings20 class="mrx-grid-menu-icon" />
      </button>
    </span>
    <div v-if="resizable" class="mrx-grid-resize-handle" :class="{ 'mrx-grid-resize-handle--left': resizeFromLeft }"
      @mousedown.prevent="onResizeMouseDown" />
  </div>
</template>

<style scoped lang="scss">
.mrx-grid-header-cell {
  padding: m.get-spacing('100') m.get-spacing('150');
  text-align: left;
  font-size: m.get-font-size('50');
  font-weight: m.get-font-weight('bold');
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--color-text-primary);
  background-color: var(--color-background-primary);
  border-bottom: m.get-token('border-width', 's') solid var(--color-border-primary);
  border-right: m.get-token('border-width', 's') solid var(--color-border-primary);
  // Allow the column name to wrap onto multiple lines instead of being
  // truncated with an ellipsis (the truncated `…` reads visually as the
  // column separator next to it).
  white-space: normal;
  word-break: break-word;
  user-select: none;
  position: relative;
  box-sizing: border-box;
  flex-shrink: 0;
  // Stretch to the row's 47px height (set on `.mrx-grid-header`) and
  // vertically center the inline content (label + sort indicator + kebab).
  // Padding stays for horizontal spacing — overflow stays inside the cell.
  display: flex;
  align-items: center;
}

// Pinned columns at the grid extremity carry no border on their outer
// edge — the table boundary itself is the visual separator.
.mrx-grid-header-cell.mrx-grid-cell--pinned-row-end {
  border-right: none;
}

.mrx-grid-header-cell.mrx-grid-cell--pinned-row-start {
  border-left: none;
}

.mrx-grid-header-content {
  display: flex;
  align-items: center;
  gap: m.get-spacing('050');
  // Span the full cell width so the inner `flex: 1` on the label pushes
  // the sort indicator and the menu trigger ("settings" gear) to the
  // right edge of the column. `min-width: 0` lets the label shrink so
  // its `text-overflow: ellipsis` actually kicks in.
  flex: 1;
  min-width: 0;
}

.mrx-grid-header-label {
  flex: 1;
  // Multi-line wrap — drops the previous `text-overflow: ellipsis` so
  // long column names are fully readable. `line-height` tightened so a
  // 2-line label still fits within roughly two row heights.
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.mrx-grid-sort-indicator {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.mrx-grid-sort-icon {
  width: 20px;
  height: 20px;
  display: block;
  fill: currentColor;
}

.mrx-grid-sort-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.mrx-grid-sort-index {
  font-size: 9px;
  color: var(--color-text-tertiary);
  vertical-align: super;
}

.mrx-grid-menu-trigger {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 m.get-spacing('050');
  color: var(--color-text-tertiary);
  line-height: 0;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mrx-grid-menu-icon {
  width: 16px;
  height: 16px;
  display: block;
  fill: currentColor;
}

.mrx-grid-menu-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.mrx-grid-header-cell:hover .mrx-grid-menu-trigger {
  opacity: 1;
}

.mrx-grid-menu-trigger:hover {
  color: var(--color-text-primary);
}

.mrx-grid-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
}

.mrx-grid-resize-handle--left {
  right: auto;
  left: 0;
}

.mrx-grid-resize-handle:hover {
  background-color: var(--color-border-secondary);
}
</style>
