<script setup lang="ts">
/**
 * Grid footer — Angular parity (`ad-grid-footer`).
 *
 * Thin composition that stacks `AdGridLoadingIndicator` (shown while more
 * rows are being fetched) above `AdGridPagination`. All pagination props
 * and events are forwarded 1-for-1; the footer has no logic of its own.
 *
 * The footer is only the *shell*. The parent grid continues to own the
 * pagination/loading state and wires it back via the engine — this component
 * just groups the two pieces so the root `Grid.vue` can render a single
 * `<ad-grid-footer>` block instead of two siblings.
 */

import AdGridPagination from './GridPagination.vue'
import AdGridLoadingIndicator from './GridLoadingIndicator.vue'

defineOptions({ name: 'AdGridFooter' })

defineProps<{
  /** Show pagination controls (parent already decides based on loadingStrategy). */
  showPagination: boolean
  /** Show loading indicator (async strategy is fetching more rows). */
  loading?: boolean
  /** Optional label override for the loading indicator. */
  loadingText?: string

  // ——— forwarded to AdGridPagination ——————————————————————————————————
  currentPage: number
  pageSize: number
  totalPages: number
  totalRows: number
  rangeStart: number
  rangeEnd: number
  pageSizeOptions: number[]
}>()

const emit = defineEmits<{
  'update:pageSize': [size: number]
  'update:currentPage': [page: number]
  prev: []
  next: []
}>()
</script>

<template>
  <div class="grid-footer">
    <ad-grid-loading-indicator v-if="loading" :text="loadingText" />

    <ad-grid-pagination
      v-if="showPagination"
      :current-page="currentPage"
      :page-size="pageSize"
      :total-pages="totalPages"
      :total-rows="totalRows"
      :range-start="rangeStart"
      :range-end="rangeEnd"
      :page-size-options="pageSizeOptions"
      @update:page-size="emit('update:pageSize', $event)"
      @update:current-page="emit('update:currentPage', $event)"
      @prev="emit('prev')"
      @next="emit('next')"
    />
  </div>
</template>

<style scoped>
.grid-footer {
  display: flex;
  flex-direction: column;
}
</style>
