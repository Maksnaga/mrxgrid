<script setup lang="ts">
/**
 * Skeleton body — drop-in replacement for `AdGridBody` while loading.
 *
 * Rendered by `Grid.vue` whenever `props.loading === true`. It mirrors
 * the column layout (utility cells + left-pinned + center + right-pinned)
 * via `AdGridSkeletonRow` and stacks `count` shimmer rows.
 *
 * Notes
 * -----
 * - Intentionally not virtualised: skeleton counts are small (auto-sized
 *   to fit the visible viewport — usually 8 to 20 rows) so we save the
 * complexity and the row math doesn't need to stay in
 *   sync with the real `totalHeight` while loading.
 * - Sets `min-width: gridContentWidth` so the sticky-pinned cells get
 *   enough horizontal room — same as the real body.
 */

import type { CSSProperties } from 'vue'
import type { ColumnDef } from '../../types'
import AdGridSkeletonRow from './GridSkeletonRow.vue'

defineOptions({ name: 'AdGridSkeletonBody' })

defineProps<{
  /** Number of skeleton rows to render. */
  count: number
  /** Min-width so pinned columns have horizontal room — same as the real body. */
  gridContentWidth?: string
  /** Center (unpinned) columns — may be a virtualised slice. */
  columns: ColumnDef[]
  leftColumns: ColumnDef[]
  rightColumns: ColumnDef[]
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
  fillField?: string | null
}>()
</script>

<template>
  <div
    class="grid-body grid-body--skeleton"
    :style="{ minWidth: gridContentWidth ? `max(100%, ${gridContentWidth})` : '100%' }"
    aria-busy="true"
    aria-live="polite"
  >
    <ad-grid-skeleton-row
      v-for="i in count"
      :key="'skel-' + i"
      :row-index="i - 1"
      :columns="columns"
      :pinned-left-columns="leftColumns"
      :pinned-right-columns="rightColumns"
      :has-pinned="hasPinned"
      :selectable="selectable"
      :expandable="expandable"
      :show-row-numbers="showRowNumbers"
      :get-column-width="getColumnWidth"
      :get-pinned-style="getPinnedStyle"
      :get-utility-style="getUtilityStyle"
      :left-spacer-width="leftSpacerWidth"
      :right-spacer-width="rightSpacerWidth"
      :fill-field="fillField"
    />
  </div>
</template>

<style scoped lang="scss">
.grid-body {
  position: relative;
}
</style>
