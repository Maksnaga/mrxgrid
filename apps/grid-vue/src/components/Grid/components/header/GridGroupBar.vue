<script setup lang="ts">
import type { GroupEntry } from '@/composables/useGrouping'

defineOptions({ name: 'AdGridGroupBar' })

defineProps<{
  groups: GroupEntry[]
}>()

const emit = defineEmits<{
  removeGroup: [field: string]
  clearGroups: []
}>()
</script>

<template>
  <div class="grid-group-bar">
    <span class="grid-group-bar__label">GROUPED BY</span>
    <div class="grid-group-bar__tags">
      <span v-for="group in groups" :key="group.field" class="grid-group-bar__tag">
        {{ group.headerName }}
        <button class="grid-group-bar__tag-remove" @click="emit('removeGroup', group.field)">
          &times;
        </button>
      </span>
      <button class="grid-group-bar__action" @click="emit('clearGroups')">
        Remove all
      </button>
    </div>
  </div>
</template>

<style scoped>
.grid-group-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-size: var(--font-size-100, 13px);
}

.grid-group-bar__label {
  font-size: var(--font-size-25, 11px);
  font-weight: var(--font-weight-semi-bold, 600);
  color: var(--color-text-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.grid-group-bar__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.grid-group-bar__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: var(--color-background-accent-inverse, #1e293b);
  color: #fff;
  /* white on dark accent — intentional */
  border-radius: var(--border-radius-s, 4px);
  font-size: var(--font-size-50, 12px);
  font-weight: var(--font-weight-medium, 500);
  white-space: nowrap;
}

.grid-group-bar__tag-remove {
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

.grid-group-bar__tag-remove:hover {
  background: rgba(255, 255, 255, 0.35);
}

.grid-group-bar__action {
  padding: 4px 10px;
  border: 1px solid var(--color-border-primary, #cbd5e1);
  background: var(--color-background-primary, white);
  color: var(--color-text-primary, #334155);
  border-radius: var(--border-radius-s, 4px);
  font-size: var(--font-size-50, 12px);
  cursor: pointer;
  white-space: nowrap;
}

.grid-group-bar__action:hover {
  background-color: var(--color-background-secondary, #f1f5f9);
}
</style>
