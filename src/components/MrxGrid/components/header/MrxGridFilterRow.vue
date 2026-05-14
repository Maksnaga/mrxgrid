<script setup lang="ts">
/**
 * Filter row — Sprint 6 (REFONTE-PLAN-V2 §2.5).
 *
 * Lays out the per-column filter cells under the header. Each cell is
 * delegated to `MrxGridFilterCell`, which resolves slot → filterRenderer
 * → built-in Mozaic input. This component only handles layout (left-pinned
 * / center / right-pinned, virtual-scroll spacers, utility cells) and
 * per-field debounce of free-typed text input.
 *
 * Visibility of the row itself is controlled upstream by `MrxGrid.hasFilterRow`.
 */

import { reactive, type CSSProperties } from 'vue'
import type { ColumnDef } from '../../types'
import MrxGridFilterCell from './MrxGridFilterCell.vue'

defineProps<{
  /** Center (unpinned) columns — may be a virtualized slice. */
  columns: ColumnDef[]
  pinnedLeftColumns: ColumnDef[]
  pinnedRightColumns: ColumnDef[]
  hasPinned: boolean
  selectable?: boolean
  expandable?: boolean
  showRowNumbers?: boolean
  filters: Record<string, unknown>
  getColumnWidth?: (field: string) => string | undefined
  getPinnedStyle: (side: 'left' | 'right', index: number, isHeader: boolean) => CSSProperties
  getUtilityStyle: (
    type: 'rownum' | 'checkbox' | 'expand',
    isHeader: boolean,
  ) => CSSProperties | undefined
  leftSpacerWidth?: string
  rightSpacerWidth?: string
  contentMinWidth?: string
  /** Field of the last unpinned column to flex-fill the trailing gap. */
  fillField?: string | null
}>()

const emit = defineEmits<{
  filterChange: [field: string, value: unknown]
}>()

// ---------------------------------------------------------------------------
// Debounce — per-field timers so rapid typing doesn't re-filter on every key.
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 250
const timers: Record<string, ReturnType<typeof setTimeout>> = reactive({})

function onInput(field: string, value: unknown) {
  clearTimeout(timers[field])
  timers[field] = setTimeout(() => {
    emit('filterChange', field, value)
  }, DEBOUNCE_MS)
}

/** Select / date changes are committed immediately (no typing). */
function onCommit(field: string, value: unknown) {
  clearTimeout(timers[field])
  emit('filterChange', field, value)
}

function widthFor(col: ColumnDef, getter?: (f: string) => string | undefined): string | undefined {
  return getter ? getter(col.field) : col.width
}
</script>

<template>
  <div
    class="mrx-filter-row"
    role="row"
    :style="{ minWidth: contentMinWidth ? `max(100%, ${contentMinWidth})` : '100%' }"
  >
    <!-- Row number spacer -->
    <div
      v-if="showRowNumbers"
      class="mrx-filter-cell mrx-filter-cell--rownum"
      :class="{ 'mrx-grid-cell--pinned': hasPinned }"
      :style="getUtilityStyle('rownum', true)"
    />

    <!-- Checkbox spacer -->
    <div
      v-if="selectable"
      class="mrx-filter-cell mrx-filter-cell--utility"
      :class="{ 'mrx-grid-cell--pinned': hasPinned }"
      :style="getUtilityStyle('checkbox', true)"
    />

    <!-- Expand spacer -->
    <div
      v-if="expandable"
      class="mrx-filter-cell mrx-filter-cell--utility"
      :class="{ 'mrx-grid-cell--pinned': hasPinned }"
      :style="getUtilityStyle('expand', true)"
    />

    <!-- Left-pinned filter cells -->
    <div
      v-for="(col, idx) in pinnedLeftColumns"
      :key="'fl-' + col.field"
      class="mrx-filter-cell mrx-grid-cell--pinned"
      :class="{ 'mrx-grid-cell--pinned-left-edge': idx === pinnedLeftColumns.length - 1 }"
      :style="{
        ...getPinnedStyle('left', idx, true),
        width: widthFor(col, getColumnWidth),
        minWidth: widthFor(col, getColumnWidth),
      }"
    >
      <MrxGridFilterCell
        :column="col"
        :value="filters[col.field]"
        @input="(v) => onInput(col.field, v)"
        @commit="(v) => onCommit(col.field, v)"
      />
    </div>

    <!-- Left spacer (virtual scroll) -->
    <div
      v-if="leftSpacerWidth && leftSpacerWidth !== '0px'"
      aria-hidden="true"
      class="mrx-filter-cell--spacer"
      :style="{ width: leftSpacerWidth, minWidth: leftSpacerWidth }"
    />

    <!-- Center filter cells -->
    <div
      v-for="col in columns"
      :key="col.field"
      class="mrx-filter-cell"
      :style="
        fillField && col.field === fillField
          ? { flex: '1 1 0', width: 'auto', minWidth: widthFor(col, getColumnWidth) }
          : { width: widthFor(col, getColumnWidth), minWidth: widthFor(col, getColumnWidth) }
      "
    >
      <MrxGridFilterCell
        :column="col"
        :value="filters[col.field]"
        @input="(v) => onInput(col.field, v)"
        @commit="(v) => onCommit(col.field, v)"
      />
    </div>

    <!-- Right spacer (virtual scroll) -->
    <div
      v-if="rightSpacerWidth && rightSpacerWidth !== '0px'"
      aria-hidden="true"
      class="mrx-filter-cell--spacer"
      :style="{ width: rightSpacerWidth, minWidth: rightSpacerWidth }"
    />

    <!-- Right-pinned filter cells -->
    <div
      v-for="(col, idx) in pinnedRightColumns"
      :key="'fr-' + col.field"
      class="mrx-filter-cell mrx-grid-cell--pinned"
      :class="{ 'mrx-grid-cell--pinned-right-edge': idx === 0 }"
      :style="{
        ...getPinnedStyle('right', idx, true),
        width: widthFor(col, getColumnWidth),
        minWidth: widthFor(col, getColumnWidth),
      }"
    >
      <MrxGridFilterCell
        :column="col"
        :value="filters[col.field]"
        @input="(v) => onInput(col.field, v)"
        @commit="(v) => onCommit(col.field, v)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.mrx-filter-row {
  display: flex;
  min-height: 2.75rem;
  background-color: var(--color-background-primary);
}

.mrx-filter-cell {
  padding: m.get-spacing('050') m.get-spacing('100');
  border-right: m.get-token('border-width', 's') solid var(--color-border-primary);
  border-bottom: m.get-token('border-width', 's') solid var(--color-border-primary);
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  background-color: var(--color-background-primary);
}

// Spacer cells (virtual-scroll gaps + utility columns) carry no vertical
// separator — they're layout-only, not data columns.
.mrx-filter-cell--spacer,
.mrx-filter-cell--utility {
  border-right: none;
}

.mrx-filter-cell--utility {
  width: 50px;
}

.mrx-filter-cell--rownum {
  width: 56px;
  background: var(--color-background-secondary, #f6f7f8);
  border-right: 1px solid var(--color-border-primary, #e3e6ea);
}

.mrx-filter-cell--spacer {
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
</style>
