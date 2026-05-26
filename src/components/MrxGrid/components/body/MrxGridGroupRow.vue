<script setup lang="ts">
/**
 * Group row — a single horizontal band that summarises a group of rows.
 * The row spans the full grid content width (so the horizontal
 * scrollbar lines up with data rows), but the label (chevron + field
 * + value) is `position: sticky; left: 0` and the count is
 * `position: sticky; right: 0`, so both stay anchored to the visible
 * viewport while the user scrolls the body horizontally.
 */
import type { CSSProperties } from 'vue'
import { ChevronDown20, ChevronRight20 } from '@mozaic-ds/icons-vue'
import type { ColumnDef } from '../../types'

defineProps<{
  /** The grouped field's header name (e.g. "Status"). */
  headerName: string
  /** The grouped value (e.g. "active"). */
  value: unknown
  /** Total leaf rows in this group. */
  count: number
  /** Nesting depth (0-based). */
  depth: number
  /** Whether this group is expanded. */
  expanded: boolean
  /** Center (unpinned) columns — may be a virtualized slice. */
  columns: ColumnDef[]
  pinnedLeftColumns: ColumnDef[]
  pinnedRightColumns: ColumnDef[]
  hasPinned: boolean
  selectable?: boolean
  expandable?: boolean
  showRowNumbers?: boolean
  getColumnWidth?: (field: string) => string | undefined
  getPinnedStyle: (side: 'left' | 'right', index: number, isHeader: boolean) => CSSProperties
  getUtilityStyle: (
    type: 'rownum' | 'checkbox' | 'expand',
    isHeader: boolean,
  ) => CSSProperties | undefined
  leftSpacerWidth?: string
  rightSpacerWidth?: string
}>()

const emit = defineEmits<{
  toggle: []
}>()

const INDENT_PX = 24
</script>

<template>
  <div class="mrx-group-row" role="row" @click="emit('toggle')">
    <!-- Sticky-left: chevron + (field above value). Stays anchored to
         the visible viewport during horizontal scroll. -->
    <div class="mrx-group-row__label" :style="{ paddingLeft: `${depth * INDENT_PX + 16}px` }">
      <component :is="expanded ? ChevronDown20 : ChevronRight20" class="mrx-group-row__toggle" aria-hidden="true" />
      <div class="mrx-group-row__info">
        <span class="mrx-group-row__field">{{ headerName }}</span>
        <span class="mrx-group-row__value">{{ value ?? '(empty)' }}</span>
      </div>
    </div>
    <!-- Sticky-right: count stays anchored to the right edge of the
         visible viewport during horizontal scroll. -->
    <span class="mrx-group-row__count">{{ count }}</span>
  </div>
</template>

<style scoped lang="scss">
.mrx-group-row {
  display: flex;
  align-items: center;
  min-height: 64px;
  background-color: #f8fafc;
  border-bottom: 1px solid var(--color-border-primary);
  cursor: pointer;
  user-select: none;
  // Inherit the sizer's `min-width` so the row spans the full grid
  // content width and lines up with the horizontal scrollbar.
  min-width: 100%;
  box-sizing: border-box;
}

.mrx-group-row:hover {
  background-color: #f1f5f9;
}

// Sticky-left: keeps the chevron + label anchored to the visible
// viewport so it stays readable while the user scrolls the grid
// horizontally. Background matches the row (sits above the body cells
// it slides over) — `z-index` lifts it above any sticky pinned cell
// the body might paint underneath.
.mrx-group-row__label {
  position: sticky;
  left: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
  padding-right: 16px;
  background-color: inherit;
  z-index: 2;
}

.mrx-group-row__toggle {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  color: #475569;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mrx-group-row__toggle :deep(svg) {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

.mrx-group-row__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.mrx-group-row__field {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  line-height: 1.2;
}

.mrx-group-row__value {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// Sticky-right: count stays anchored to the right edge of the visible
// viewport during horizontal scroll. `margin-left: auto` pushes it to
// the row's natural end; `right: 0` then anchors it once the row would
// scroll past the viewport.
.mrx-group-row__count {
  position: sticky;
  right: 0;
  margin-left: auto;
  flex-shrink: 0;
  padding: 0 16px;
  height: 100%;
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 400;
  color: #94a3b8;
  background-color: inherit;
  z-index: 2;
}
</style>
