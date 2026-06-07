<script setup lang="ts">
/**
 * FILTERED BY tag-bar — Angular parity (`moz-grid-filter-tags-bar`).
 *
 * Displays each active `FilterCondition` as a removable tag. Visually matches
 * `AdeoGridGroupBar` / `AdeoGridHiddenBar` so the three bars sit consistently
 * under the toolbar.
 *
 * Labels are produced by the filter engine's `toLabel` so the bar doesn't
 * need to know anything about operators or value formatting.
 */

import type { FilterCondition } from '../../models/filter.model'

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
  <div v-if="conditions.length" class="adeo-grid-filter-tags-bar">
    <span class="adeo-grid-filter-tags-bar__label">FILTERED BY</span>
    <div class="adeo-grid-filter-tags-bar__tags">
      <span
        v-for="condition in conditions"
        :key="condition.id"
        class="adeo-grid-filter-tags-bar__tag"
        :class="{
          'adeo-grid-filter-tags-bar__tag--or':
            condition !== conditions[0] && condition.combinator === 'or',
        }"
      >
        <span v-if="condition !== conditions[0]" class="adeo-grid-filter-tags-bar__combinator">
          {{ condition.combinator === 'or' ? 'OR' : 'AND' }}
        </span>
        <span class="adeo-grid-filter-tags-bar__tag-label">{{ toLabel(condition) }}</span>
        <button
          type="button"
          class="adeo-grid-filter-tags-bar__tag-remove"
          :aria-label="`Remove filter ${toLabel(condition)}`"
          @click="emit('removeCondition', condition.id)"
        >
          &times;
        </button>
      </span>
      <button type="button" class="adeo-grid-filter-tags-bar__action" @click="emit('openBuilder')">
        Edit
      </button>
      <button type="button" class="adeo-grid-filter-tags-bar__action" @click="emit('clearAll')">
        Remove all
      </button>
    </div>
  </div>
</template>

<style scoped>
.adeo-grid-filter-tags-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
}

.adeo-grid-filter-tags-bar__label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.adeo-grid-filter-tags-bar__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.adeo-grid-filter-tags-bar__tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: #1e293b;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.adeo-grid-filter-tags-bar__tag--or {
  background-color: #475569;
}

.adeo-grid-filter-tags-bar__combinator {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.8;
}

.adeo-grid-filter-tags-bar__tag-label {
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.adeo-grid-filter-tags-bar__tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 50%;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}

.adeo-grid-filter-tags-bar__tag-remove:hover {
  background: rgba(255, 255, 255, 0.35);
}

.adeo-grid-filter-tags-bar__action {
  padding: 4px 10px;
  border: 1px solid #cbd5e1;
  background: white;
  color: #334155;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.adeo-grid-filter-tags-bar__action:hover {
  background-color: #f1f5f9;
}
</style>
