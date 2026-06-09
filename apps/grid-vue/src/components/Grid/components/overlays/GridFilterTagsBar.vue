<script setup lang="ts">
/**
 * FILTERED BY tag-bar — Angular parity (`ad-grid-filter-tags-bar`).
 *
 * Displays each active `FilterCondition` as a removable tag. Visually matches
 * `AdGridGroupBar` / `AdGridHiddenBar` so the three bars sit consistently
 * under the toolbar.
 *
 * Labels are produced by the filter engine's `toLabel` so the bar doesn't
 * need to know anything about operators or value formatting.
 */

import type { FilterCondition } from '../../models/filter.model'

defineOptions({ name: 'AdGridFilterTagsBar' })

defineProps<{
  conditions: FilterCondition[]
  toLabel: (condition: FilterCondition) => string
}>()

const emit = defineEmits<{
  removeCondition: [id: string]
  clearAll: []
  openBuilder: []
}>()
</script>

<template>
  <div v-if="conditions.length" class="grid-filter-tags-bar">
    <span class="grid-filter-tags-bar__label">FILTERED BY</span>
    <div class="grid-filter-tags-bar__tags">
      <span
        v-for="condition in conditions"
        :key="condition.id"
        class="grid-filter-tags-bar__tag"
        :class="{
          'grid-filter-tags-bar__tag--or':
            condition !== conditions[0] && condition.combinator === 'or',
        }"
      >
        <span v-if="condition !== conditions[0]" class="grid-filter-tags-bar__combinator">
          {{ condition.combinator === 'or' ? 'OR' : 'AND' }}
        </span>
        <span class="grid-filter-tags-bar__tag-label">{{ toLabel(condition) }}</span>
        <button
          type="button"
          class="grid-filter-tags-bar__tag-remove"
          :aria-label="`Remove filter ${toLabel(condition)}`"
          @click="emit('removeCondition', condition.id)"
        >
          &times;
        </button>
      </span>
      <button type="button" class="grid-filter-tags-bar__action" @click="emit('openBuilder')">
        Edit
      </button>
      <button type="button" class="grid-filter-tags-bar__action" @click="emit('clearAll')">
        Remove all
      </button>
    </div>
  </div>
</template>

<style scoped>
.grid-filter-tags-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-family: var(--font-family, system-ui, -apple-system, sans-serif);
  font-size: var(--font-size-100, 13px);
}

.grid-filter-tags-bar__label {
  font-size: var(--font-size-25, 11px);
  font-weight: var(--font-weight-semi-bold, 600);
  color: var(--color-text-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.grid-filter-tags-bar__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.grid-filter-tags-bar__tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: var(--color-background-accent-inverse, #1e293b);
  color: #fff; /* white on dark tag — intentional, no Mozaic token */
  border-radius: var(--border-radius-s, 4px);
  font-size: var(--font-size-50, 12px);
  font-weight: var(--font-weight-medium, 500);
  white-space: nowrap;
}

.grid-filter-tags-bar__tag--or {
  background-color: var(--color-text-secondary, #475569);
}

.grid-filter-tags-bar__combinator {
  font-size: var(--font-size-0, 10px);
  font-weight: var(--font-weight-bold, 700);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.8;
}

.grid-filter-tags-bar__tag-label {
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grid-filter-tags-bar__tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border-radius: var(--border-radius-full, 50%);
  font-size: var(--font-size-50, 12px);
  line-height: 1;
  cursor: pointer;
}

.grid-filter-tags-bar__tag-remove:hover {
  background: rgba(255, 255, 255, 0.35);
}

.grid-filter-tags-bar__action {
  padding: 4px 10px;
  border: 1px solid var(--color-border-primary, #cbd5e1);
  background: var(--color-background-primary, white);
  color: var(--color-text-primary, #334155);
  border-radius: var(--border-radius-s, 4px);
  font-size: var(--font-size-50, 12px);
  cursor: pointer;
  white-space: nowrap;
}

.grid-filter-tags-bar__action:hover {
  background-color: var(--color-background-secondary, #f1f5f9);
}
</style>
