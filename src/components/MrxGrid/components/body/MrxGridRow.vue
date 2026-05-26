<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import type { CellFlags, ColumnDef, RowData } from '../../types'
import { MButton, MCheckbox } from '@mozaic-ds/vue'
import { ChevronDown20, ChevronRight20 } from '@mozaic-ds/icons-vue'
import MrxGridCell from './MrxGridCell.vue'

const EMPTY_FLAGS: CellFlags = {}

const props = defineProps<{
  row: RowData
  rowIndex: number
  /** Center (unpinned) columns — may be a virtualized slice. */
  columns: ColumnDef[]
  pinnedLeftColumns: ColumnDef[]
  pinnedRightColumns: ColumnDef[]
  hasPinned: boolean
  selectable?: boolean
  selected?: boolean
  expandable?: boolean
  expanded?: boolean
  activeField?: string | null
  /** Field currently being edited in this row (null if none). */
  editingField?: string | null
  /** Draft value of the cell being edited. */
  editValue?: unknown
  /** Returns per-cell visual flags (selection, edges, fill handle). */
  getCellFlags?: (rowIndex: number, field: string) => CellFlags
  getColumnWidth?: (field: string) => string | undefined
  getPinnedStyle: (side: 'left' | 'right', index: number, isHeader: boolean) => CSSProperties
  getUtilityStyle: (
    type: 'rownum' | 'checkbox' | 'expand',
    isHeader: boolean,
  ) => CSSProperties | undefined
  showRowNumbers?: boolean
  /** Display row number (1-based, in source data order). When grouping is
   *  active this is the row's `__mrxOriginalIndex` + 1. */
  rowNumber?: number
  leftSpacerWidth?: string
  rightSpacerWidth?: string
  /** Field of the column that should `flex: 1` to absorb trailing empty
   *  space (typically the last unpinned column when no right-pinned column
   *  is present and horizontal virtualisation is off). */
  fillField?: string | null
}>()

/** Inline style for an unpinned center cell. The `fillField` column gets
 *  `min-width: declaredWidth` only — the `flex: 1 1 auto` lives on
 *  `.mrx-grid-cell--fill` (scoped to MrxGridCell) so it isn't lost in
 *  the parent/child `:style` fall-through merge.
 *
 *  Non-fill cells get BOTH `width` and `minWidth` set to the declared
 *  width. Without `minWidth`, flexbox's default `min-width: auto`
 *  resolves to `min-content`, which forces the cell to grow to fit
 *  long unbreakable content (e.g. "Marseille Plan-de-Campagne").
 *  Result: rows with long content have a wider cell than rows with
 *  short content, shifting subsequent cells out of column alignment.
 *  Locking `minWidth = width` keeps every row's cell at the declared
 *  size; `overflow: hidden + text-overflow: ellipsis` clips overflow. */
function centerCellStyle(field: string): Record<string, string | undefined> {
  const w = props.getColumnWidth ? props.getColumnWidth(field) : undefined
  if (props.fillField && field === props.fillField) {
    return { minWidth: w }
  }
  return { width: w, minWidth: w }
}

const isSkeleton = computed(() => !!props.row.__mrxSkeleton)

/** Call getCellFlags once per cell per render (not 7×). */
function flags(field: string): CellFlags {
  return props.getCellFlags?.(props.rowIndex, field) ?? EMPTY_FLAGS
}

const emit = defineEmits<{
  toggleSelect: [event?: MouseEvent]
  toggleExpand: []
  activateCell: [field: string, e: MouseEvent]
  editStart: [field: string]
  editInput: [value: unknown]
  editCommit: [direction: 'down' | 'right' | 'left']
  editCancel: []
  editBlur: []
  fillHandleMousedown: [e: MouseEvent]
}>()
</script>

<template>
  <!-- Skeleton row -->
  <div v-if="isSkeleton" class="mrx-grid-row mrx-grid-row--skeleton" aria-hidden="true">
    <div class="mrx-grid-skeleton-cell">
      <div class="mrx-grid-skeleton-shimmer" />
    </div>
  </div>

  <!-- Data row -->
  <div v-else class="mrx-grid-row" :class="{ 'mrx-grid-row--selected': selected }" role="row">
    <!-- Row number (sticky-left, auto-on with formula columns) -->
    <div v-if="showRowNumbers" class="mrx-grid-cell mrx-grid-rownum-cell"
      :class="{ 'mrx-grid-cell--pinned': hasPinned }" :style="getUtilityStyle('rownum', false)" role="rowheader">
      {{ rowNumber }}
    </div>

    <!-- Checkbox (sticky left when pinned) -->
    <div v-if="selectable" class="mrx-grid-cell mrx-grid-checkbox-cell" :class="{ 'mrx-grid-cell--pinned': hasPinned }"
      :style="getUtilityStyle('checkbox', false)" role="gridcell"
      @click.capture="(e: MouseEvent) => emit('toggleSelect', e)">
      <MCheckbox :id="`mrx-row-cb-${rowIndex}`" :model-value="selected" />
    </div>

    <!-- Expand button (sticky left when pinned) -->
    <div v-if="expandable" class="mrx-grid-cell mrx-grid-expand-cell" :class="{ 'mrx-grid-cell--pinned': hasPinned }"
      :style="getUtilityStyle('expand', false)" role="gridcell">
      <MButton class="mrx-grid-expand-btn" type="button" :ghost="true"
        :aria-label="expanded ? 'Collapse row' : 'Expand row'" :aria-expanded="expanded" @click="emit('toggleExpand')">
        <component :is="expanded ? ChevronDown20 : ChevronRight20" class="mrx-grid-expand-icon" aria-hidden="true" />
      </MButton>
    </div>

    <!-- Left-pinned columns (always rendered, sticky left) -->
    <MrxGridCell v-for="(col, idx) in pinnedLeftColumns" :key="'pl-' + col.field" :value="row[col.field]" :row="row"
      :field="col.field" :row-index="rowIndex" :column="col" :active="activeField === col.field"
      :editing="editingField === col.field" :edit-value="editingField === col.field ? editValue : undefined"
      :selected="flags(col.field).selected" :edge-top="flags(col.field).edgeTop"
      :edge-bottom="flags(col.field).edgeBottom" :edge-left="flags(col.field).edgeLeft"
      :edge-right="flags(col.field).edgeRight" :fill-handle="flags(col.field).fillHandle"
      :fill-target="flags(col.field).fillTarget" :fill-target-invalid="flags(col.field).fillTargetInvalid"
      :invalid="flags(col.field).invalid" :invalid-message="flags(col.field).invalidMessage"
      :cut-source="flags(col.field).cutSource" :cut-edge-top="flags(col.field).cutEdgeTop"
      :cut-edge-bottom="flags(col.field).cutEdgeBottom" :cut-edge-left="flags(col.field).cutEdgeLeft"
      :cut-edge-right="flags(col.field).cutEdgeRight" class="mrx-grid-cell--pinned" :class="{
        'mrx-grid-cell--pinned-left-edge': idx === pinnedLeftColumns.length - 1,
        'mrx-grid-cell--pinned-row-start': idx === 0,
      }" :style="{
        ...getPinnedStyle('left', idx, false),
        width: getColumnWidth ? getColumnWidth(col.field) : undefined,
        minWidth: getColumnWidth ? getColumnWidth(col.field) : undefined,
      }" @activate="emit('activateCell', col.field, $event)" @edit-start="emit('editStart', col.field)"
      @edit-input="emit('editInput', $event)" @edit-commit="emit('editCommit', $event)"
      @edit-cancel="emit('editCancel')" @edit-blur="emit('editBlur')"
      @fill-handle-mousedown="emit('fillHandleMousedown', $event)">
      <template v-if="$slots.cell" #default="cellSlot">
        <slot name="cell" v-bind="cellSlot" />
      </template>
    </MrxGridCell>

    <!-- Left spacer (for virtual center columns). Skip rendering when the
         width is missing or `0px` so the row doesn't carry a phantom flex
         child that would otherwise expand inside the trailing empty space. -->
    <div v-if="leftSpacerWidth && leftSpacerWidth !== '0px'" aria-hidden="true" class="mrx-grid-spacer"
      :style="{ width: leftSpacerWidth, minWidth: leftSpacerWidth }" />

    <!-- Center columns (virtual slice or all unpinned) -->
    <MrxGridCell v-for="col in columns" :key="col.field" :value="row[col.field]" :row="row" :field="col.field"
      :row-index="rowIndex" :column="col" :active="activeField === col.field" :editing="editingField === col.field"
      :edit-value="editingField === col.field ? editValue : undefined" :selected="flags(col.field).selected"
      :edge-top="flags(col.field).edgeTop" :edge-bottom="flags(col.field).edgeBottom"
      :edge-left="flags(col.field).edgeLeft" :edge-right="flags(col.field).edgeRight"
      :fill-handle="flags(col.field).fillHandle" :fill-target="flags(col.field).fillTarget"
      :fill-target-invalid="flags(col.field).fillTargetInvalid" :invalid="flags(col.field).invalid"
      :invalid-message="flags(col.field).invalidMessage" :cut-source="flags(col.field).cutSource"
      :cut-edge-top="flags(col.field).cutEdgeTop" :cut-edge-bottom="flags(col.field).cutEdgeBottom"
      :cut-edge-left="flags(col.field).cutEdgeLeft" :cut-edge-right="flags(col.field).cutEdgeRight"
      :class="{ 'mrx-grid-cell--fill': fillField && col.field === fillField }" :style="centerCellStyle(col.field)"
      @activate="emit('activateCell', col.field, $event)" @edit-start="emit('editStart', col.field)"
      @edit-input="emit('editInput', $event)" @edit-commit="emit('editCommit', $event)"
      @edit-cancel="emit('editCancel')" @edit-blur="emit('editBlur')"
      @fill-handle-mousedown="emit('fillHandleMousedown', $event)">
      <template v-if="$slots.cell" #default="cellSlot">
        <slot name="cell" v-bind="cellSlot" />
      </template>
    </MrxGridCell>

    <!-- Right spacer (for virtual center columns). See note on left spacer. -->
    <div v-if="rightSpacerWidth && rightSpacerWidth !== '0px'" aria-hidden="true" class="mrx-grid-spacer"
      :style="{ width: rightSpacerWidth, minWidth: rightSpacerWidth }" />

    <!-- Right-pinned columns (always rendered, sticky right) -->
    <MrxGridCell v-for="(col, idx) in pinnedRightColumns" :key="'pr-' + col.field" :value="row[col.field]" :row="row"
      :field="col.field" :row-index="rowIndex" :column="col" :active="activeField === col.field"
      :editing="editingField === col.field" :edit-value="editingField === col.field ? editValue : undefined"
      :selected="flags(col.field).selected" :edge-top="flags(col.field).edgeTop"
      :edge-bottom="flags(col.field).edgeBottom" :edge-left="flags(col.field).edgeLeft"
      :edge-right="flags(col.field).edgeRight" :fill-handle="flags(col.field).fillHandle"
      :fill-target="flags(col.field).fillTarget" :fill-target-invalid="flags(col.field).fillTargetInvalid"
      :invalid="flags(col.field).invalid" :invalid-message="flags(col.field).invalidMessage"
      :cut-source="flags(col.field).cutSource" :cut-edge-top="flags(col.field).cutEdgeTop"
      :cut-edge-bottom="flags(col.field).cutEdgeBottom" :cut-edge-left="flags(col.field).cutEdgeLeft"
      :cut-edge-right="flags(col.field).cutEdgeRight" class="mrx-grid-cell--pinned" :class="{
        'mrx-grid-cell--pinned-right-edge': idx === 0,
        'mrx-grid-cell--pinned-row-end': idx === pinnedRightColumns.length - 1,
      }" :style="{
        ...getPinnedStyle('right', idx, false),
        width: getColumnWidth ? getColumnWidth(col.field) : undefined,
        minWidth: getColumnWidth ? getColumnWidth(col.field) : undefined,
      }" @activate="emit('activateCell', col.field, $event)" @edit-start="emit('editStart', col.field)"
      @edit-input="emit('editInput', $event)" @edit-commit="emit('editCommit', $event)"
      @edit-cancel="emit('editCancel')" @edit-blur="emit('editBlur')"
      @fill-handle-mousedown="emit('fillHandleMousedown', $event)">
      <template v-if="$slots.cell" #default="cellSlot">
        <slot name="cell" v-bind="cellSlot" />
      </template>
    </MrxGridCell>
  </div>
</template>

<style scoped lang="scss">
.mrx-grid-row {
  display: flex;
  height: var(--mrx-row-height, 48px);
  background-color: var(--color-background-primary);
  contain: style;
  min-width: 100%;
}

.mrx-grid-row--selected {
  background-color: var(--color-background-accent);
}

// Hover lives on the cell, not the row — only the cell directly under
// the cursor highlights, matching the spreadsheet/AG-Grid pattern.
// Painted via a ::before so we get an inset rounded chip instead of
// flooding the whole cell rectangle. `inset: 3px` is what gives the chip
// its size — without it the pseudo collapses to 0×0 and the hover is
// invisible.
:deep(.mrx-grid-cell)::before {
  content: '';
  position: absolute;
  border-radius: 4px;
  background: transparent;
  pointer-events: none;
  z-index: -1;
}

:deep(.mrx-grid-cell:hover)::before {
  background: #f1f3f4;
}

:deep(.mrx-grid-cell--active)::before,
:deep(.mrx-grid-cell--selected)::before,
:deep(.mrx-grid-cell--fill-target)::before,
:deep(.mrx-grid-cell--fill-target-invalid)::before {
  background: transparent;
}

.mrx-grid-cell {
  padding: m.get-spacing('100') m.get-spacing('150');
  border-bottom: m.get-token('border-width', 's') solid var(--color-border-primary);
  color: var(--color-text-primary);
  box-sizing: border-box;
  flex-shrink: 0;
}

.mrx-grid-cell--pinned {
  background-color: inherit;
}

:deep(.mrx-grid-cell--pinned.mrx-grid-cell--selected) {
  background-color: var(--color-background-accent);
}

:deep(.mrx-grid-cell--pinned.mrx-grid-cell--fill-target) {
  background-color: var(--color-background-accent);
}

// `clip-path` extends the cell's painting region 4px past the pinned edge
// so the drop-shadow (set via `--mrx-cell-outer-shadow` inside
// `MrxGridCell.vue`'s `box-shadow` stack) is visible across the boundary.
.mrx-grid-cell--pinned-left-edge {
  clip-path: inset(0 -4px 0 0);
}

.mrx-grid-cell--pinned-right-edge {
  clip-path: inset(0 0 0 -4px);
}

.mrx-grid-checkbox-cell,
.mrx-grid-expand-cell {
  width: 50px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mrx-grid-rownum-cell {
  width: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary, #6c727c);
  background: var(--color-background-secondary, #f6f7f8);
  border-right: 1px solid var(--color-border-primary, #e3e6ea);
  padding: 0;
}

.mrx-grid-expand-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  border-radius: m.get-radius('s');
  cursor: pointer;
  padding: 0;
  color: var(--color-text-secondary);
}

.mrx-grid-expand-btn:hover {
  background: var(--color-background-secondary);
  color: var(--color-text-primary);
}

.mrx-grid-expand-icon {
  width: 20px;
  height: 20px;
}

.mrx-grid-expand-icon :deep(svg) {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

.mrx-grid-spacer {
  flex-shrink: 0;
  padding: 0;
  border: none;
}

.mrx-grid-row--skeleton {
  pointer-events: none;
  min-width: 100%;
}

.mrx-grid-skeleton-cell {
  flex: 1;
  padding: m.get-spacing('100') m.get-spacing('150');
  border-bottom: m.get-token('border-width', 's') solid var(--color-border-primary);
}

.mrx-grid-skeleton-shimmer {
  height: 14px;
  border-radius: m.get-radius('s');
  background: linear-gradient(90deg,
      var(--color-background-secondary) 25%,
      var(--color-background-primary) 50%,
      var(--color-background-secondary) 75%);
  background-size: 200% 100%;
  animation: mrx-shimmer 1.4s infinite linear;
}

@keyframes mrx-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>

<style>
/* Mozaic checkbox overrides inside grid cells */
.mrx-grid-checkbox-cell .mc-checkbox {
  padding: 0;
  gap: 0;
}

.mrx-grid-checkbox-cell .mc-checkbox__label {
  display: none;
}
</style>
