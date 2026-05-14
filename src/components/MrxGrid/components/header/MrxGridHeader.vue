<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue'
import type { ColumnDef, ColumnMenuAction, SelectionState, SortDirection } from '../../types'
import { MCheckbox } from '@mozaic-ds/vue'
import MrxGridHeaderCell from './MrxGridHeaderCell.vue'
import MrxGridHeaderMenu from './MrxGridHeaderMenu.vue'
import MrxColumnFilterOverlay from './MrxColumnFilterOverlay.vue'
import type { FilterCondition } from '../../models/filter.model'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  /** Center (unpinned) columns — may be a virtualized slice. */
  columns: ColumnDef[]
  pinnedLeftColumns: ColumnDef[]
  pinnedRightColumns: ColumnDef[]
  hasPinned: boolean
  selectable?: boolean
  expandable?: boolean
  showRowNumbers?: boolean
  selectionState?: SelectionState
  getColumnWidth?: (field: string) => string | undefined
  onResizeStart?: (
    field: string,
    startX: number,
    startWidth: number,
    fromLeft?: boolean,
  ) => void
  getPinnedStyle: (side: 'left' | 'right', index: number, isHeader: boolean) => CSSProperties
  getUtilityStyle: (
    type: 'rownum' | 'checkbox' | 'expand',
    isHeader: boolean,
  ) => CSSProperties | undefined
  leftSpacerWidth?: string
  rightSpacerWidth?: string
  getSortDirection?: (field: string) => SortDirection | null
  getSortIndex?: (field: string) => number | null
  getPinning?: (field: string) => 'left' | 'right' | null | undefined
  contentMinWidth?: string
  /** Field of the last unpinned column to flex-fill the trailing gap. */
  fillField?: string | null
  /** Full list of filterable columns (NOT a virtualized slice). Drives
   *  the field picker inside the per-column filter overlay. */
  filterableColumns: ColumnDef[]
}>()

const emit = defineEmits<{
  toggleAll: []
  columnMenuAction: [action: ColumnMenuAction]
  columnDragStart: [field: string, e: MouseEvent]
  /** Sprint 5 — emitted by the per-column filter overlay (Apply). */
  columnFilterApply: [condition: FilterCondition]
  /** Per-column filter overlay → user removed a row. */
  columnFilterRemove: [id: string]
  /** Per-column filter overlay → user dragged a row to a new position. */
  columnFilterReorder: [movedId: string, targetId: string | null]
  /** Header click → cycle sort. `isMultiSort` is true when shift was held. */
  columnSort: [field: string, isMultiSort: boolean]
}>()

const openMenuField = ref<string | null>(null)
const menuTriggerRect = ref<DOMRect | null>(null)

const openMenuColumn = computed<ColumnDef | null>(() => {
  const f = openMenuField.value
  if (!f) return null
  return (
    [...props.pinnedLeftColumns, ...props.columns, ...props.pinnedRightColumns].find(
      (c) => c.field === f,
    ) ?? null
  )
})

function handleResizeMouseDown(field: string, e: MouseEvent, fromLeft = false) {
  if (!props.onResizeStart) return
  const cell = (e.target as HTMLElement).parentElement
  if (!cell) return
  props.onResizeStart(field, e.clientX, cell.offsetWidth, fromLeft)
}

function toggleMenu(field: string, e: MouseEvent) {
  if (openMenuField.value === field) {
    openMenuField.value = null
    menuTriggerRect.value = null
  } else {
    const btn = e.currentTarget as HTMLElement
    menuTriggerRect.value = btn.getBoundingClientRect()
    openMenuField.value = field
  }
}

// Sprint 5 — when the menu emits `filter-column`, swap the kebab listbox
// for the per-column filter overlay (anchored on the same trigger rect).
const openFilterField = ref<string | null>(null)
const filterTriggerRect = ref<DOMRect | null>(null)

const openFilterColumn = computed<ColumnDef | null>(() => {
  const f = openFilterField.value
  if (!f) return null
  return (
    [...props.pinnedLeftColumns, ...props.columns, ...props.pinnedRightColumns].find(
      (c) => c.field === f,
    ) ?? null
  )
})


function onMenuAction(action: ColumnMenuAction) {
  if (action.type === 'filter-column') {
    openFilterField.value = action.field
    filterTriggerRect.value = menuTriggerRect.value
    openMenuField.value = null
    menuTriggerRect.value = null
    return
  }
  emit('columnMenuAction', action)
  openMenuField.value = null
  menuTriggerRect.value = null
}

function onColumnFilterApply(condition: FilterCondition) {
  // Live-apply: just forward, never close. The overlay closes on outside
  // click, Escape, or its own remove-last-row path (via `cancel`).
  emit('columnFilterApply', condition)
}

function onColumnFilterRemove(id: string) {
  emit('columnFilterRemove', id)
}

function onColumnFilterReorder(movedId: string, targetId: string | null) {
  emit('columnFilterReorder', movedId, targetId)
}

function onColumnFilterCancel() {
  openFilterField.value = null
  filterTriggerRect.value = null
}

function closeMenu() {
  openMenuField.value = null
  menuTriggerRect.value = null
}

function onDragStart(field: string, e: MouseEvent) {
  emit('columnDragStart', field, e)
}

function widthFor(col: ColumnDef): string | undefined {
  return props.getColumnWidth ? props.getColumnWidth(col.field) : col.width
}

function isResizable(col: ColumnDef): boolean {
  return col.resizable !== false && !!props.onResizeStart
}
</script>

<template>
  <div
    class="mrx-grid-header"
    role="row"
    :style="{ minWidth: contentMinWidth ? `max(100%, ${contentMinWidth})` : '100%' }"
  >
    <!-- Row-number column header (auto-on with formula columns) -->
    <div
      v-if="showRowNumbers"
      class="mrx-grid-header-cell mrx-grid-rownum-cell"
      :style="getUtilityStyle('rownum', true)"
      role="columnheader"
      aria-label="Row number"
    />

    <!-- Checkbox (sticky left when pinned) -->
    <div
      v-if="selectable"
      class="mrx-grid-header-cell mrx-grid-checkbox-cell"
      :class="{ 'mrx-grid-cell--pinned': hasPinned }"
      :style="getUtilityStyle('checkbox', true)"
      role="columnheader"
    >
      <MCheckbox
        id="mrx-header-cb-all"
        :model-value="selectionState === 'all'"
        :indeterminate="selectionState === 'some'"
        @update:model-value="emit('toggleAll')"
      />
    </div>

    <!-- Expand placeholder (sticky left when pinned) -->
    <div
      v-if="expandable"
      class="mrx-grid-header-cell mrx-grid-expand-cell"
      :class="{ 'mrx-grid-cell--pinned': hasPinned }"
      :style="getUtilityStyle('expand', true)"
      role="columnheader"
    />

    <!-- Left-pinned columns -->
    <MrxGridHeaderCell
      v-for="(col, idx) in pinnedLeftColumns"
      :key="'pl-' + col.field"
      :column="col"
      :width="widthFor(col)"
      :cell-style="getPinnedStyle('left', idx, true)"
      :cell-class="{
        'mrx-grid-cell--pinned': true,
        'mrx-grid-cell--pinned-left-edge': idx === pinnedLeftColumns.length - 1,
        'mrx-grid-cell--pinned-row-start': idx === 0,
      }"
      :sort-direction="getSortDirection?.(col.field)"
      :sort-index="getSortIndex?.(col.field)"
      :resizable="isResizable(col)"
      @menu="toggleMenu"
      @resize-start="handleResizeMouseDown"
      @drag-start="onDragStart"
      @sort="(f, m) => emit('columnSort', f, m)"
    />

    <!-- Left spacer (virtual scroll) -->
    <div
      v-if="leftSpacerWidth && leftSpacerWidth !== '0px'"
      aria-hidden="true"
      class="mrx-grid-header-cell--spacer"
      :style="{
        width: leftSpacerWidth,
        minWidth: leftSpacerWidth,
      }"
    />

    <!-- Center columns -->
    <MrxGridHeaderCell
      v-for="col in columns"
      :key="col.field"
      :column="col"
      :width="widthFor(col)"
      :sort-direction="getSortDirection?.(col.field)"
      :sort-index="getSortIndex?.(col.field)"
      :resizable="isResizable(col)"
      :fill="!!fillField && col.field === fillField"
      @menu="toggleMenu"
      @resize-start="handleResizeMouseDown"
      @drag-start="onDragStart"
      @sort="(f, m) => emit('columnSort', f, m)"
    />

    <!-- Right spacer (virtual scroll) -->
    <div
      v-if="rightSpacerWidth && rightSpacerWidth !== '0px'"
      aria-hidden="true"
      class="mrx-grid-header-cell--spacer"
      :style="{
        width: rightSpacerWidth,
        minWidth: rightSpacerWidth,
      }"
    />

    <!-- Right-pinned columns -->
    <MrxGridHeaderCell
      v-for="(col, idx) in pinnedRightColumns"
      :key="'pr-' + col.field"
      :column="col"
      :width="widthFor(col)"
      :cell-style="getPinnedStyle('right', idx, true)"
      :cell-class="{
        'mrx-grid-cell--pinned': true,
        'mrx-grid-cell--pinned-right-edge': idx === 0,
        'mrx-grid-cell--pinned-row-end': idx === pinnedRightColumns.length - 1,
      }"
      :sort-direction="getSortDirection?.(col.field)"
      :sort-index="getSortIndex?.(col.field)"
      :resizable="isResizable(col)"
      @menu="toggleMenu"
      @resize-start="handleResizeMouseDown"
      @drag-start="onDragStart"
      @sort="(f, m) => emit('columnSort', f, m)"
    />
  </div>

  <!-- Column menu -->
  <MrxGridHeaderMenu
    v-if="openMenuField && menuTriggerRect && openMenuColumn"
    :field="openMenuField"
    :column="openMenuColumn"
    :sort-direction="getSortDirection?.(openMenuField)"
    :pinned="getPinning?.(openMenuField)"
    :trigger-rect="menuTriggerRect"
    @action="onMenuAction"
    @close="closeMenu"
  />

  <!-- Per-column "Filter in this column" overlay (Sprint 5) -->
  <MrxColumnFilterOverlay
    v-if="openFilterField && filterTriggerRect && openFilterColumn"
    :field="openFilterField"
    :column="openFilterColumn"
    :filterable-columns="props.filterableColumns"
    :trigger-rect="filterTriggerRect"
    @apply="onColumnFilterApply"
    @remove="onColumnFilterRemove"
    @reorder="onColumnFilterReorder"
    @cancel="onColumnFilterCancel"
  />
</template>

<style scoped lang="scss">
.mrx-grid-header {
  display: flex;
  // `min-height` (not fixed `height`) so the header row can grow when a
  // long column name wraps to multiple lines.
  min-height: 47px;
  background-color: var(--color-background-primary);
}

/* Stub cells (checkbox / expand / spacers) still live in the header itself.
   The data-header cell styles now come from `MrxGridHeaderCell`. */
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
  white-space: nowrap;
  user-select: none;
  position: relative;
  box-sizing: border-box;
  flex-shrink: 0;
  // Vertically center utility cell content (checkbox / expand) within
  // the 47px header row height.
  display: flex;
  align-items: center;
}

.mrx-grid-header-cell--spacer {
  background-color: var(--color-background-primary);
  border-bottom: m.get-token('border-width', 's') solid var(--color-border-primary);
  flex-shrink: 0;
  padding: 0;
}

.mrx-grid-cell--pinned {
  background-color: var(--color-background-primary);
}

.mrx-grid-cell--pinned-left-edge {
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.06);
  clip-path: inset(0 -4px 0 0);
}

.mrx-grid-cell--pinned-right-edge {
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.06);
  clip-path: inset(0 0 0 -4px);
}

.mrx-grid-checkbox-cell,
.mrx-grid-expand-cell {
  width: 50px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: none;
}

.mrx-grid-rownum-cell {
  width: 56px;
  background: var(--color-background-secondary, #f6f7f8);
  border-right: 1px solid var(--color-border-primary, #e3e6ea);
}
</style>

<style>
/* Mozaic checkbox overrides inside header cells */
.mrx-grid-header .mrx-grid-checkbox-cell .mc-checkbox {
  padding: 0;
  gap: 0;
}

.mrx-grid-header .mrx-grid-checkbox-cell .mc-checkbox__label {
  display: none;
}
</style>
