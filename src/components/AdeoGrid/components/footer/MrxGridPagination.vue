<script setup lang="ts">
import { computed } from 'vue'
import { MSelect, MIconButton } from '@mozaic-ds/vue'
import { ChevronLeft24, ChevronRight24 } from '@mozaic-ds/icons-vue'

/**
 * Pagination footer — Sprint 2 (REFONTE-PLAN-V2 §2.6).
 *
 * Uses Mozaic components: `MSelect` for rows-per-page + page selector,
 * `MIconButton` (ghost rounded) for prev/next. Mirrors the Angular
 * `<moz-pagination>` look-and-feel.
 *
 * `prev` / `next` events are kept for back-compat with the legacy footer;
 * `update:currentPage` (1-based) is the canonical seam used by `usePagination`.
 */

const props = defineProps<{
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

// MSelect expects `{ text, value }` — map the legacy `pageSizeOptions` numbers.
const pageSizeSelectOptions = computed(() =>
  props.pageSizeOptions.map((n) => ({ text: String(n), value: n })),
)

const pageSelectOptions = computed(() =>
  Array.from({ length: props.totalPages }, (_, i) => ({
    text: String(i + 1),
    value: i + 1,
  })),
)

function onPageSizeChange(value: string | number): void {
  emit('update:pageSize', typeof value === 'number' ? value : Number(value))
}
function onPageChange(value: string | number): void {
  emit('update:currentPage', typeof value === 'number' ? value : Number(value))
}
</script>

<template>
  <div class="mrx-pagination">
    <!-- Left: rows per page + range label -->
    <div class="mrx-pagination__left">
      <span class="mrx-pagination__label">Rows per page</span>
      <MSelect id="mrx-pagination-page-size" size="s" :options="pageSizeSelectOptions" :model-value="pageSize"
        class="mrx-pagination__select-mozaic" @update:modelValue="onPageSizeChange" />
      <span class="mrx-pagination__range">
        {{ rangeStart }}-{{ rangeEnd }} of {{ totalRows }} items
      </span>
    </div>

    <!-- Right: prev / page-of-N / next -->
    <div class="mrx-pagination__right">
      <MIconButton id="mrx-pagination-prev" ghost size="s" aria-label="Previous page" :disabled="currentPage <= 1"
        @click="emit('prev')">
        <template #icon>
          <ChevronLeft24 />
        </template>
      </MIconButton>

      <span class="mrx-pagination__label">Page</span>
      <MSelect id="mrx-pagination-current" size="s" :options="pageSelectOptions" :model-value="currentPage"
        class="mrx-pagination__select-mozaic" @update:modelValue="onPageChange" />
      <span class="mrx-pagination__label">of {{ totalPages }}</span>

      <MIconButton id="mrx-pagination-next" ghost size="s" aria-label="Next page" :disabled="currentPage >= totalPages"
        @click="emit('next')">
        <template #icon>
          <ChevronRight24 />
        </template>
      </MIconButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mrx-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: m.get-spacing('100') m.get-spacing('200');
  background: var(--color-background-primary, #fff);
  border-top: m.get-token('border-width', 's') solid var(--color-border-primary);
  font-size: m.get-font-size('50');
  color: var(--color-text-secondary);
  flex-wrap: wrap;
  gap: m.get-spacing('100');
  border-radius: 0 0 m.get-spacing('200') m.get-spacing('200');
}

.mrx-pagination__left,
.mrx-pagination__right {
  display: flex;
  align-items: center;
  gap: m.get-spacing('100');
}

.mrx-pagination__label {
  white-space: nowrap;
}

.mrx-pagination__range {
  white-space: nowrap;
  margin-left: m.get-spacing('050');
  font-weight: m.get-font-weight('semi-bold');
  color: var(--color-text-primary);
}

/* MSelect width — narrow it to the content (page numbers / 10/25/50/100) */
.mrx-pagination__select-mozaic {
  min-width: 84px;
}
</style>
