<script setup lang="ts">
import type { GroupEntry } from '@/composables/useGrouping'

defineProps<{
  groups: GroupEntry[]
}>()

const emit = defineEmits<{
  removeGroup: [field: string]
  clearGroups: []
}>()
</script>

<template>
  <div class="mrx-group-bar">
    <span class="mrx-group-bar__label">GROUPED BY</span>
    <div class="mrx-group-bar__tags">
      <span
        v-for="group in groups"
        :key="group.field"
        class="mrx-group-bar__tag"
      >
        {{ group.headerName }}
        <button
          class="mrx-group-bar__tag-remove"
          @click="emit('removeGroup', group.field)"
        >
          &times;
        </button>
      </span>
      <button
        class="mrx-group-bar__action"
        @click="emit('clearGroups')"
      >
        Remove all
      </button>
    </div>
  </div>
</template>

<style scoped>
.mrx-group-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
}

.mrx-group-bar__label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.mrx-group-bar__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.mrx-group-bar__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: #1e293b;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.mrx-group-bar__tag-remove {
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

.mrx-group-bar__tag-remove:hover {
  background: rgba(255, 255, 255, 0.35);
}

.mrx-group-bar__action {
  padding: 4px 10px;
  border: 1px solid #cbd5e1;
  background: white;
  color: #334155;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.mrx-group-bar__action:hover {
  background-color: #f1f5f9;
}
</style>
