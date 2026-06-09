<script setup lang="ts">
/**
 * Header cell — Angular parity (`ad-grid-header-cell`).
 *
 * One header cell, as rendered by `AdGridHeader`. Formerly the cell markup
 * was duplicated three times in `AdGridHeader.vue` (left-pinned / center /
 * right-pinned). This component consolidates the three copies into a single
 * definition; the parent keeps control of positioning (pinning offsets,
 * spacers, sticky layers, edge shadows) via the `cellStyle` / `cellClass`
 * props.
 *
 * Responsibilities of this component:
 *   - render the header cell wrapper (`div.grid-header-cell`)
 *   - render label + sort indicator + kebab menu trigger
 *   - render the resize handle when enabled
 *   - forward mousedown events for column drag (parent wires up reorder)
 *
 * Sort-direction / sort-index / column metadata are passed in; the component
 * stays stateless.
 */

import { computed, type CSSProperties } from 'vue'
import { Settings20, Filter20, SortDown20, SortTop20 } from '@mozaic-ds/icons-vue'
import type { ColumnDef, SortDirection } from '../../types'
import { injectGridSlots, resolveHeaderSlot } from '../../state/GridSlots'
import { useGridContext } from '../../state/GridContext'

defineOptions({ name: 'AdGridHeaderCell' })

// B25 — engine-layer sort guard: read lastResizeEndedAt from GridState
// (written by useColumnResizeEngine on mouseup). This is the sole check;
// the legacy wasResizingRecently() module flag has been removed.

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

// Phase 3.3 — resolve `#header-{field}` / `<ad-grid-column> #header` / `#header` slot.
const _gridSlots = injectGridSlots()
const resolvedHeaderSlot = computed(() => resolveHeaderSlot(_gridSlots, props.column.field))

// --- Filter-aware kebab icon + tooltip (Angular parity) ---
const _gridState = useGridContext()

/** Active filter conditions on this column. */
const activeFilterConditions = computed(() => {
  if (!_gridState) return []
  return _gridState.filterModel.value.conditions.filter((c) => c.field === props.column.field)
})

/** True when at least one filter condition targets this column. */
const hasActiveFilter = computed(() => activeFilterConditions.value.length > 0)

/** Icon for the kebab menu trigger: Filter when active, Settings otherwise. */
const menuIcon = computed(() => (hasActiveFilter.value ? Filter20 : Settings20))

/** Tooltip text for the kebab menu trigger listing active conditions. */
const menuTooltip = computed(() => {
  if (!hasActiveFilter.value) return undefined
  const labels = activeFilterConditions.value
    .map((c) => {
      const op = c.operator ?? ''
      const val = c.value?.value != null ? String(c.value.value) : ''
      return val ? `${c.field} ${op} "${val}"` : `${c.field} ${op}`
    })
    .join(', ')
  return `Filtres : ${labels}`
})

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
    target.closest('.grid-resize-handle') ||
    target.closest('.grid-menu-trigger')
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
  if (target.closest('.grid-resize-handle') || target.closest('.grid-menu-trigger')) {
    return
  }
  // Suppress the synthetic click fired by the browser right after a
  // resize-handle mouseup. The mousedown landed on the handle but the
  // mouseup landed elsewhere (the cursor follows the column edge during
  // the drag), so the common-ancestor click fires on the *header cell*
  // and `e.target` is no longer the handle — the `closest()` guard
  // above can't catch it.
  //
  // B25 — engine-layer sort guard: `lastResizeEndedAt` is written by
  // useColumnResizeEngine on mouseup and injected via useGridContext().
  // A 200ms window is wide enough to cover any synthetic click after mouseup.
  const _resizeEngineAt = _gridState?.lastResizeEndedAt?.value ?? 0
  if (performance.now() - _resizeEngineAt < 200) return
  if (!isSortable.value) return
  emit('sort', props.column.field, e.shiftKey)
}

function onResizeMouseDown(e: MouseEvent): void {
  emit('resizeStart', props.column.field, e, resizeFromLeft.value)
}
</script>

<template>
  <div class="grid-header-cell" :class="[cellClass, { 'grid-header-cell--moving': isMoving }]" :style="fill
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
    <span class="grid-header-content">
      <component v-if="resolvedHeaderSlot" :is="resolvedHeaderSlot" :column="column"
        :sort-direction="sortDirection ?? null" />
      <span v-else class="grid-header-label">{{ column.headerName }}</span>
      <span v-if="sortIcon" class="grid-sort-indicator" aria-hidden="true">
        <component :is="sortIcon" class="grid-sort-icon" />
        <span v-if="sortIndex" class="grid-sort-index">
          {{ sortIndex }}
        </span>
      </span>
      <button
        type="button"
        class="grid-menu-trigger"
        :class="{ 'grid-menu-trigger--has-filter': hasActiveFilter }"
        :aria-label="menuTooltip ?? 'Menu de la colonne'"
        :title="menuTooltip"
        @click.stop="onMenuClick"
      >
        <component :is="menuIcon" class="grid-menu-icon" />
      </button>
    </span>
    <div v-if="resizable" class="grid-resize-handle" :class="{ 'grid-resize-handle--left': resizeFromLeft }"
      @mousedown.prevent="onResizeMouseDown" />
  </div>
</template>

<style scoped lang="scss">
.grid-header-cell {
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
  user-select: none;
  position: relative;
  box-sizing: border-box;
  flex-shrink: 0;
  // Clip any internal overflow within the cell. Without this, when a
  // consumer declares a tight `ColumnDef.width` (below the 120 px floor
  // that the resize handle enforces — see `useColumnResize.MIN_WIDTH`),
  // the sort arrow + kebab trigger overflow into the next column's
  // header. The resize floor is the primary defense; this is the
  // safety net for declared widths.
  overflow: hidden;
  // Stretch to the row's 47px height (set on `.grid-header`) and
  // vertically center the inline content (label + sort indicator + kebab).
  // Padding stays for horizontal spacing — overflow stays inside the cell.
  display: flex;
  align-items: center;
}

// Pinned columns at the grid extremity carry no border on their outer
// edge — the table boundary itself is the visual separator.
.grid-header-cell.grid-cell--pinned-row-end {
  border-right: none;
}

.grid-header-cell.grid-cell--pinned-row-start {
  border-left: none;
}

.grid-header-content {
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

.grid-header-label {
  // `flex: 1 1 0` + `min-width: 0` is the canonical recipe for a
  // shrinkable flex child whose content would otherwise set a non-zero
  // min-content. Without `min-width: 0` the label refuses to shrink
  // below its longest word and pushes the sort + kebab out of the cell.
  flex: 1 1 0;
  min-width: 0;
  // Single-line ellipsis. We previously used `overflow-wrap: anywhere`
  // for multi-line readability of long column names, but combined with
  // the now-mandatory `min-width: 0` it wrapped the label INSIDE the
  // flex row, dropping the kebab icon between the wrapped pieces of
  // text ("MAINTENANCE OF [⚙] THE WALLPAPER") which is unreadable. A
  // truncated `…` is the lesser evil — the full label is one column
  // resize / hover away.
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.25;
}

.grid-sort-indicator {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.grid-sort-icon {
  width: 20px;
  height: 20px;
  display: block;
  fill: currentColor;
}

.grid-sort-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.grid-sort-index {
  font-size: 9px; /* custom value — no matching Mozaic token (below --font-size-25 = 11px) */
  color: var(--color-text-tertiary);
  vertical-align: super;
}

.grid-menu-trigger {
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

.grid-menu-icon {
  width: 16px;
  height: 16px;
  display: block;
  fill: currentColor;
}

.grid-menu-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.grid-header-cell:hover .grid-menu-trigger {
  opacity: 1;
}

.grid-menu-trigger:hover {
  color: var(--color-text-primary);
}

// When a filter is active on this column the menu trigger stays permanently
// visible (opacity 1) and uses the brand accent colour to signal the state.
.grid-menu-trigger--has-filter {
  opacity: 1;
  color: var(--color-text-accent, #2563eb);
}

.grid-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
}

.grid-resize-handle--left {
  right: auto;
  left: 0;
}

.grid-resize-handle:hover {
  background-color: var(--color-border-secondary);
}
</style>
