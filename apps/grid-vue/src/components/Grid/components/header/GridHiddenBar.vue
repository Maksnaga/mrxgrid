<script setup lang="ts">
defineProps<{
  hiddenColumns: Array<{ field: string; headerName: string }>
}>()

const emit = defineEmits<{
  show: [field: string]
  showAll: []
}>()
</script>

<template>
  <div v-if="hiddenColumns.length > 0" class="adeo-grid-hidden-bar">
    <span class="adeo-grid-hidden-bar__label">HIDDEN</span>
    <div class="adeo-grid-hidden-bar__tags">
      <span
        v-for="col in hiddenColumns"
        :key="col.field"
        class="adeo-grid-hidden-bar__tag"
      >
        {{ col.headerName }}
        <button
          class="adeo-grid-hidden-bar__tag-remove"
          @click="emit('show', col.field)"
        >
          &times;
        </button>
      </span>
      <button
        class="adeo-grid-hidden-bar__action"
        @click="emit('showAll')"
      >
        Show all
      </button>
    </div>
  </div>
</template>

<style scoped>
.adeo-grid-hidden-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
}

.adeo-grid-hidden-bar__label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.adeo-grid-hidden-bar__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.adeo-grid-hidden-bar__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: #64748b;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.adeo-grid-hidden-bar__tag-remove {
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

.adeo-grid-hidden-bar__tag-remove:hover {
  background: rgba(255, 255, 255, 0.35);
}

.adeo-grid-hidden-bar__action {
  padding: 4px 10px;
  border: 1px solid #cbd5e1;
  background: white;
  color: #334155;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.adeo-grid-hidden-bar__action:hover {
  background-color: #f1f5f9;
}
</style>
