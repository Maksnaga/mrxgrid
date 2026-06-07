<script setup lang="ts">
/**
 * Group row — a single horizontal band that summarises a group of rows.
 * The row spans the full grid content width (so the horizontal
 * scrollbar lines up with data rows). The label (chevron + field
 * + value + count) is `position: sticky; left: 0` so it stays anchored
 * to the visible viewport while the user scrolls the body horizontally.
 * The count sits right next to the title rather than at the row's far
 * right edge, so the eye doesn't have to travel the full row width.
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
    <!-- Sticky-left: chevron + (field above value) + count. The count
         sits right next to the title — the whole block stays anchored
         to the visible viewport during horizontal scroll. -->
    <div class="mrx-group-row__label" :style="{ paddingLeft: `${depth * INDENT_PX + 16}px` }">
      <component :is="expanded ? ChevronDown20 : ChevronRight20" class="mrx-group-row__toggle" aria-hidden="true" />
      <div class="mrx-group-row__info">
        <span class="mrx-group-row__field">{{ headerName }}</span>
        <span class="mrx-group-row__value">{{ value ?? '(empty)' }}</span>
      </div>
      <span class="mrx-group-row__count">{{ count }}</span>
    </div>
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

// Inline pill sitting right next to the group title — soft neutral
// background so it reads as a count, not a tappable element. Lives
// inside `__label`, so it inherits the sticky-left anchoring during
// horizontal scroll.
.mrx-group-row__count {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  background-color: #e2e8f0;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  line-height: 1.2;
}
</style>
