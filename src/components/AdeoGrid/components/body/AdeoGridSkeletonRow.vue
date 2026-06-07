<script setup lang="ts">
/**
 * Skeleton row — rendered while `props.loading` is true.
 *
 * Mirrors the structure of `AdeoGridRow` (utility cells → left-pinned →
 * spacer → center → spacer → right-pinned) so the column widths and the
 * sticky-pinned offsets stay consistent with the real rows that will
 * appear once data arrives. Each "cell" hosts a single shimmer bar
 * (gray gradient animated horizontally) — no real text, no real flags,
 * no editing handlers.
 *
 * The shimmer width is randomised per-cell (within a clamped range) so
 * the loading state doesn't read as a perfectly aligned column of bars
 * — that pattern is jarring to the eye and reads more like a UI bug
 * than a placeholder.
 *
 * The component is fully presentational: it emits nothing, accepts no
 * events, and intentionally renders no inputs so the keyboard layer
 * can't accidentally focus a skeleton cell.
 */

import type { CSSProperties } from 'vue'
import type { ColumnDef } from '../../types'

const props = defineProps<{
  /** 0-based index — used as a deterministic seed for the per-cell width. */
  rowIndex: number
  /** Center (unpinned) columns — may be a virtualised slice. */
  columns: ColumnDef[]
  pinnedLeftColumns: ColumnDef[]
  pinnedRightColumns: ColumnDef[]
  hasPinned: boolean
  selectable?: boolean
  expandable?: boolean
  showRowNumbers?: boolean
  /** Per-column width string (e.g. "180px") — same accessor as the data row. */
  getColumnWidth?: (field: string) => string | undefined
  /** Pinned-cell positioning (left/right offsets, z-index, shadow). */
  getPinnedStyle: (side: 'left' | 'right', index: number, isHeader: boolean) => CSSProperties
  /** Utility-cell positioning (row-number / checkbox / expand). */
  getUtilityStyle: (
    type: 'rownum' | 'checkbox' | 'expand',
    isHeader: boolean,
  ) => CSSProperties | undefined
  leftSpacerWidth?: string
  rightSpacerWidth?: string
  /** Field that gets `flex: 1` to absorb the trailing gap — matches the data row. */
  fillField?: string | null
}>()

/**
 * Deterministic per-row, per-column shimmer width.
 * - Pseudo-random in `[55%, 90%]` so the skeleton feels organic
 *   without ever stretching to the cell edges (which would look
 *   identical to a filled cell and lose the "loading" signal).
 * - Deterministic ⇒ no width thrash on every render.
 */
function shimmerWidth(field: string): string {
  // FNV-ish hash on rowIndex + field, modulo 36 → range [55, 90].
  let h = 2166136261 ^ props.rowIndex
  for (let i = 0; i < field.length; i++) {
    h ^= field.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  const pct = 55 + (h % 36)
  return `${pct}%`
}

function centerCellStyle(field: string): Record<string, string | undefined> {
  const w = props.getColumnWidth ? props.getColumnWidth(field) : undefined
  if (props.fillField && field === props.fillField) {
    return { minWidth: w }
  }
  return { width: w, minWidth: w }
}
</script>

<template>
  <div class="mrx-grid-row mrx-grid-skeleton-row" role="row" aria-hidden="true">
    <!-- Row number (sticky-left, auto-on with formula columns) -->
    <div
      v-if="showRowNumbers"
      class="mrx-grid-cell mrx-grid-rownum-cell"
      :class="{ 'mrx-grid-cell--pinned': hasPinned }"
      :style="getUtilityStyle('rownum', false)"
    >
      <span class="mrx-grid-skeleton-bar" :style="{ width: '60%' }" />
    </div>

    <!-- Checkbox utility cell -->
    <div
      v-if="selectable"
      class="mrx-grid-cell mrx-grid-checkbox-cell"
      :class="{ 'mrx-grid-cell--pinned': hasPinned }"
      :style="getUtilityStyle('checkbox', false)"
    >
      <span class="mrx-grid-skeleton-square" />
    </div>

    <!-- Expand utility cell -->
    <div
      v-if="expandable"
      class="mrx-grid-cell mrx-grid-expand-cell"
      :class="{ 'mrx-grid-cell--pinned': hasPinned }"
      :style="getUtilityStyle('expand', false)"
    >
      <span class="mrx-grid-skeleton-square" />
    </div>

    <!-- Left-pinned columns -->
    <div
      v-for="(col, idx) in pinnedLeftColumns"
      :key="'pl-' + col.field"
      class="mrx-grid-cell mrx-grid-cell--pinned"
      :class="{
        'mrx-grid-cell--pinned-left-edge': idx === pinnedLeftColumns.length - 1,
        'mrx-grid-cell--pinned-row-start': idx === 0,
      }"
      :style="{
        ...getPinnedStyle('left', idx, false),
        width: getColumnWidth ? getColumnWidth(col.field) : undefined,
        minWidth: getColumnWidth ? getColumnWidth(col.field) : undefined,
      }"
    >
      <span class="mrx-grid-skeleton-bar" :style="{ width: shimmerWidth(col.field) }" />
    </div>

    <!-- Left spacer (virtual horizontal scroll only). -->
    <div
      v-if="leftSpacerWidth && leftSpacerWidth !== '0px'"
      aria-hidden="true"
      class="mrx-grid-spacer"
      :style="{ width: leftSpacerWidth, minWidth: leftSpacerWidth }"
    />

    <!-- Center columns -->
    <div
      v-for="col in columns"
      :key="col.field"
      class="mrx-grid-cell"
      :class="{ 'mrx-grid-cell--fill': fillField && col.field === fillField }"
      :style="centerCellStyle(col.field)"
    >
      <span class="mrx-grid-skeleton-bar" :style="{ width: shimmerWidth(col.field) }" />
    </div>

    <!-- Right spacer. -->
    <div
      v-if="rightSpacerWidth && rightSpacerWidth !== '0px'"
      aria-hidden="true"
      class="mrx-grid-spacer"
      :style="{ width: rightSpacerWidth, minWidth: rightSpacerWidth }"
    />

    <!-- Right-pinned columns -->
    <div
      v-for="(col, idx) in pinnedRightColumns"
      :key="'pr-' + col.field"
      class="mrx-grid-cell mrx-grid-cell--pinned"
      :class="{
        'mrx-grid-cell--pinned-right-edge': idx === 0,
        'mrx-grid-cell--pinned-row-end': idx === pinnedRightColumns.length - 1,
      }"
      :style="{
        ...getPinnedStyle('right', idx, false),
        width: getColumnWidth ? getColumnWidth(col.field) : undefined,
        minWidth: getColumnWidth ? getColumnWidth(col.field) : undefined,
      }"
    >
      <span class="mrx-grid-skeleton-bar" :style="{ width: shimmerWidth(col.field) }" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.mrx-grid-row {
  display: flex;
  height: var(--mrx-row-height, 48px);
  background-color: var(--color-background-primary);
  min-width: 100%;
}

.mrx-grid-skeleton-row {
  // Block any pointer interaction — these are inert placeholders.
  pointer-events: none;
  user-select: none;
}

.mrx-grid-cell {
  padding: m.get-spacing('100') m.get-spacing('150');
  border-bottom: m.get-token('border-width', 's') solid var(--color-border-primary);
  color: var(--color-text-primary);
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.mrx-grid-cell--pinned {
  background-color: inherit;
}

.mrx-grid-cell--pinned-left-edge {
  clip-path: inset(0 -4px 0 0);
}

.mrx-grid-cell--pinned-right-edge {
  clip-path: inset(0 0 0 -4px);
}

.mrx-grid-cell--fill {
  flex: 1 1 auto;
}

.mrx-grid-checkbox-cell,
.mrx-grid-expand-cell {
  width: 50px;
  justify-content: center;
}

.mrx-grid-rownum-cell {
  width: 56px;
  justify-content: center;
  background: var(--color-background-secondary, #f6f7f8);
  border-right: 1px solid var(--color-border-primary, #e3e6ea);
  padding: 0;
}

.mrx-grid-spacer {
  flex-shrink: 0;
  padding: 0;
  border: none;
}

// ---------------------------------------------------------------------------
// Shimmer primitives
// ---------------------------------------------------------------------------
// `--mrx-skel-base` / `--mrx-skel-highlight` are pulled from Mozaic tokens
// with safe fallbacks so the skeleton renders correctly even outside the
// design system context (e.g. isolated component tests).
.mrx-grid-skeleton-bar {
  display: inline-block;
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--mrx-skel-base, var(--color-background-secondary, #eef0f3)) 0%,
    var(--mrx-skel-highlight, var(--color-background-primary, #f8fafc)) 50%,
    var(--mrx-skel-base, var(--color-background-secondary, #eef0f3)) 100%
  );
  background-size: 200% 100%;
  animation: mrx-skeleton-shimmer 1.4s ease-in-out infinite;
}

.mrx-grid-skeleton-square {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background: linear-gradient(
    90deg,
    var(--mrx-skel-base, var(--color-background-secondary, #eef0f3)) 0%,
    var(--mrx-skel-highlight, var(--color-background-primary, #f8fafc)) 50%,
    var(--mrx-skel-base, var(--color-background-secondary, #eef0f3)) 100%
  );
  background-size: 200% 100%;
  animation: mrx-skeleton-shimmer 1.4s ease-in-out infinite;
}

// `@keyframes mrx-skeleton-shimmer` est défini dans le `<style>` non-scopé
// de `AdeoGridCell.vue` (à côté des marching-ants) — partagé avec le
// cell-level pending (`.mrx-grid-cell--pending::after`).

// Respect users who opt out of motion — keep the colour delta visible but
// freeze the animation.
@media (prefers-reduced-motion: reduce) {
  .mrx-grid-skeleton-bar,
  .mrx-grid-skeleton-square {
    animation: none;
    background: var(--mrx-skel-base, var(--color-background-secondary, #eef0f3));
  }
}
</style>
