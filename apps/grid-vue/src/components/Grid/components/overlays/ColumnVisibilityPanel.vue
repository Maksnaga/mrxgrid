<script setup lang="ts">
import { computed, inject } from 'vue'
import { GRID_STATE_KEY } from '../../state/GridContext'

defineOptions({ name: 'AdGridColumnVisibilityPanel' })

/**
 * Popover panel listing currently hidden columns. Distinct from the full
 * settings drawer — typically opened from a "+ N hidden" chip in the header
 * strip. Mirrors Angular `AdeoGridColumnVisibilityPanelComponent`.
 *
 * Reads `gridState.columnStates[].visible` and `columnDefs` directly via
 * the injected `GridContext`. Emits restore intents for the host to wire.
 *
 * Tolerant to mounting outside `<ad-grid-vue>` — when no context is found, the
 * panel renders an empty list (not an error). This lets it sit beside the
 * grid in a toolbar without forcing the host to wrap everything in slots.
 */
const gridState = inject(GRID_STATE_KEY, null)

const emit = defineEmits<{
  restoreColumn: [field: string]
  restoreAll: []
}>()

const hiddenColumns = computed(() => {
  if (!gridState) return []
  const defMap = gridState.columnDefMap.value
  return gridState.columnStates.value
    .filter((c) => !c.visible)
    .map((c) => ({ field: c.field, label: defMap.get(c.field)?.headerName ?? c.field }))
})

function onRestore(field: string): void {
  emit('restoreColumn', field)
}

function onRestoreAll(): void {
  emit('restoreAll')
}
</script>

<template>
  <div v-if="hiddenColumns.length > 0" class="column-visibility-panel">
    <span class="column-visibility-panel__label">Hidden columns:</span>
    <button
      v-for="col in hiddenColumns"
      :key="col.field"
      type="button"
      class="column-visibility-panel__chip"
      :aria-label="`Restore column ${col.label}`"
      @click="onRestore(col.field)"
    >
      {{ col.label }}
      <span class="column-visibility-panel__chip-icon" aria-hidden="true">+</span>
    </button>
    <button
      v-if="hiddenColumns.length > 1"
      type="button"
      class="column-visibility-panel__restore-all"
      @click="onRestoreAll"
    >
      Restore all
    </button>
  </div>
</template>

<style scoped lang="scss">
.column-visibility-panel {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  flex-wrap: wrap;

  &__label {
    font-size: var(--font-size-50, 12px);
    color: var(--color-text-secondary, #666);
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid var(--color-border-primary, #ddd);
    border-radius: var(--border-radius-l, 16px);
    background: var(--color-background-primary, #fff);
    font-size: var(--font-size-50, 12px);
    cursor: pointer;

    &:hover {
      background: var(--color-background-secondary, #f5f5f5);
    }
  }

  &__chip-icon {
    font-weight: var(--font-weight-bold, 700);
    color: var(--color-text-secondary, #666);
  }

  &__restore-all {
    margin-left: auto;
    padding: 2px 8px;
    border: none;
    background: transparent;
    color: var(--color-text-accent, #1a73e8);
    font-size: var(--font-size-50, 12px);
    cursor: pointer;
    text-decoration: underline;
  }
}
</style>
