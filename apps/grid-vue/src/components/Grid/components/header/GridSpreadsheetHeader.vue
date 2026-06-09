<script setup lang="ts">
/**
 * Spreadsheet column-letter strip — sits above the regular header when at
 * least one column has `allowFormula: true`. Shows A / B / C / … aligned on
 * each visible column (including pinned start/end and row-number / checkbox
 * / expand utility columns) so formula refs (`=D5`) read like Excel.
 *
 * Letters reflect the GLOBAL display order across pinned-left + center +
 * pinned-right, computed once per column-set change.
 *
 * Heavily mirrors `AdGridHeader.vue` for layout — pinned offsets, virtual
 * spacers, and content min-width handling are identical so the strip stays
 * in pixel-perfect sync with the columns underneath during scroll / resize.
 */
import type { CSSProperties } from 'vue'
import type { ColumnDef } from '../../types'
import { columnIndexToLetters } from '../../features/formula/formula-ast'

defineOptions({ name: 'AdGridSpreadsheetHeader' })

const props = defineProps<{
  columns: ColumnDef[]
  pinnedLeftColumns: ColumnDef[]
  pinnedRightColumns: ColumnDef[]
  hasPinned: boolean
  showRowNumbers?: boolean
  selectable?: boolean
  expandable?: boolean
  getColumnWidth?: (field: string) => string | undefined
  getPinnedStyle: (side: 'left' | 'right', index: number, isHeader: boolean) => CSSProperties
  getUtilityStyle: (
    type: 'rownum' | 'checkbox' | 'expand',
    isHeader: boolean,
  ) => CSSProperties | undefined
  leftSpacerWidth?: string
  rightSpacerWidth?: string
  contentMinWidth?: string
  /** Index of the FIRST center column in the global column order — used to
   *  produce the letter sequence for virtualized center slices. */
  centerStartIndex: number
  /** Total number of center columns (= virtualized + non-virtualized). Used
   *  to offset the letters of pinned-right columns past every center column,
   *  not just the rendered slice. */
  centerTotalCount: number
  /** Field of the last unpinned column that should `flex: 1 1 auto` to absorb
   *  trailing empty space — must match the value passed to AdGridHeader so
   *  the strip aligns pixel-perfect with the columns underneath. */
  fillField?: string | null
}>()

function widthFor(col: ColumnDef): string {
  return props.getColumnWidth?.(col.field) ?? col.width ?? '150px'
}
</script>

<template>
  <div
    class="grid-spreadsheet-header"
    role="row"
    aria-hidden="true"
    :style="{ minWidth: contentMinWidth ? `max(100%, ${contentMinWidth})` : '100%' }"
  >
    <!-- Top-left "corner" cell (above row-number column) — empty -->
    <div
      v-if="showRowNumbers"
      class="grid-spreadsheet-header__cell grid-spreadsheet-header__cell--corner"
      :style="{ ...(getUtilityStyle('rownum', true) ?? {}), width: '56px', minWidth: '56px' }"
    />

    <!-- Above checkbox (no letter) -->
    <div
      v-if="selectable"
      class="grid-spreadsheet-header__cell grid-spreadsheet-header__cell--utility"
      :style="getUtilityStyle('checkbox', true)"
    />

    <!-- Above expand (no letter) -->
    <div
      v-if="expandable"
      class="grid-spreadsheet-header__cell grid-spreadsheet-header__cell--utility"
      :style="getUtilityStyle('expand', true)"
    />

    <!-- Letters above pinned-left -->
    <div
      v-for="(col, idx) in pinnedLeftColumns"
      :key="'pl-' + col.field"
      class="grid-spreadsheet-header__cell"
      :class="{
        'grid-cell--pinned': true,
        'grid-cell--pinned-left-edge': idx === pinnedLeftColumns.length - 1,
      }"
      :style="{
        ...getPinnedStyle('left', idx, true),
        width: widthFor(col),
        minWidth: widthFor(col),
      }"
    >
      {{ columnIndexToLetters(idx) }}
    </div>

    <!-- Left spacer for virtual center scroll -->
    <div
      v-if="leftSpacerWidth && leftSpacerWidth !== '0px'"
      class="grid-spreadsheet-header__cell grid-spreadsheet-header__cell--spacer"
      :style="{ width: leftSpacerWidth, minWidth: leftSpacerWidth }"
    />

    <!-- Letters above center columns (offset by centerStartIndex when virtualized).
         The `fillField` cell flexes to absorb trailing space so the strip
         stays pixel-aligned with the data row underneath (whose last
         unpinned cell flexes too). -->
    <div
      v-for="(col, idx) in columns"
      :key="col.field"
      class="grid-spreadsheet-header__cell"
      :class="{ 'grid-spreadsheet-header__cell--fill': fillField && col.field === fillField }"
      :style="
        fillField && col.field === fillField
          ? { flex: '1 1 0', minWidth: widthFor(col) }
          : { width: widthFor(col), minWidth: widthFor(col) }
      "
    >
      {{ columnIndexToLetters(centerStartIndex + idx) }}
    </div>

    <!-- Right spacer for virtual center scroll -->
    <div
      v-if="rightSpacerWidth && rightSpacerWidth !== '0px'"
      class="grid-spreadsheet-header__cell grid-spreadsheet-header__cell--spacer"
      :style="{ width: rightSpacerWidth, minWidth: rightSpacerWidth }"
    />

    <!-- Letters above pinned-right -->
    <div
      v-for="(col, idx) in pinnedRightColumns"
      :key="'pr-' + col.field"
      class="grid-spreadsheet-header__cell"
      :class="{
        'grid-cell--pinned': true,
        'grid-cell--pinned-right-edge': idx === 0,
      }"
      :style="{
        ...getPinnedStyle('right', idx, true),
        width: widthFor(col),
        minWidth: widthFor(col),
      }"
    >
      {{
        columnIndexToLetters(
          pinnedLeftColumns.length + centerTotalCount + idx,
        )
      }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.grid-spreadsheet-header {
  display: flex;
  height: 22px; /* custom value — no matching Mozaic token */
  background: var(--color-background-secondary, #f6f7f8);
  border-bottom: 1px solid var(--color-border-primary, #e3e6ea);
  font-family: var(--font-family-monospace, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: var(--font-size-25, 11px);
  font-weight: var(--font-weight-semi-bold, 600);
  letter-spacing: 0.04em;
  color: var(--color-text-secondary, #4a5364);
  user-select: none;
}

.grid-spreadsheet-header__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  border-right: 1px solid var(--color-border-primary, #e3e6ea);
  background: var(--color-background-secondary, #f6f7f8);
}

.grid-spreadsheet-header__cell--corner,
.grid-spreadsheet-header__cell--utility {
  background: var(--color-background-secondary, #f6f7f8);
}

.grid-spreadsheet-header__cell--spacer {
  border-right: none;
  background: transparent;
}

.grid-cell--pinned-left-edge {
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.06);
  clip-path: inset(0 -4px 0 0);
}

.grid-cell--pinned-right-edge {
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.06);
  clip-path: inset(0 0 0 -4px);
}
</style>
