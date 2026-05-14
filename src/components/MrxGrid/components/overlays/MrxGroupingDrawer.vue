<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MDrawer, MButton, MIconButton, MSelect } from '@mozaic-ds/vue'
import { Cross20, Drag24, ListAdd24 } from '@mozaic-ds/icons-vue'
import type { ColumnDef } from '../../types'

export interface GroupingItem {
  field: string
  headerName: string
  direction: 'asc' | 'desc'
}

const props = defineProps<{
  open: boolean
  columns: ColumnDef[]
  /** Currently active group fields (from parent state). */
  activeGroups: GroupingItem[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  apply: [groups: GroupingItem[]]
  reset: []
}>()

// --- Local draft state (copy of activeGroups, editable until Apply) ---
const draftGroups = ref<GroupingItem[]>([])

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      draftGroups.value = props.activeGroups.map((g) => ({ ...g }))
    }
  },
)

const availableColumns = computed(() =>
  props.columns.filter((col) => !draftGroups.value.some((g) => g.field === col.field)),
)

const sortOptions = [
  { text: 'A \u2192 Z', value: 'asc' },
  { text: 'Z \u2192 A', value: 'desc' },
]

function addColumn(col: ColumnDef) {
  draftGroups.value = [
    ...draftGroups.value,
    { field: col.field, headerName: col.headerName, direction: 'asc' },
  ]
}

function removeColumn(field: string) {
  draftGroups.value = draftGroups.value.filter((g) => g.field !== field)
}

function updateDirection(field: string, direction: string | number) {
  draftGroups.value = draftGroups.value.map((g) =>
    g.field === field ? { ...g, direction: direction as 'asc' | 'desc' } : g,
  )
}

// --- Drag & drop reordering ---
const dragIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)

function onDragStart(index: number, e: DragEvent) {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

function onDragOver(index: number) {
  dropIndex.value = index
}

function onDrop(index: number) {
  if (dragIndex.value === null || dragIndex.value === index) return
  const items = [...draftGroups.value]
  const [moved] = items.splice(dragIndex.value, 1)
  if (moved) {
    items.splice(index, 0, moved)
    draftGroups.value = items
  }
}

function onDragEnd() {
  dragIndex.value = null
  dropIndex.value = null
}

function onApply() {
  emit('apply', [...draftGroups.value])
  emit('update:open', false)
}

function onReset() {
  draftGroups.value = []
  emit('reset')
  emit('update:open', false)
}
</script>

<template>
  <MDrawer
    :open="open"
    title="Group by"
    :close-on-overlay="true"
    :extended="true"
    position="right"
    @update:open="emit('update:open', $event)"
  >
    <div class="mrx-grouping-drawer">
      <!-- Active groups -->
      <div v-if="draftGroups.length" class="mrx-grouping-drawer__section">
        <div
          v-for="(group, index) in draftGroups"
          :key="group.field"
          class="mrx-grouping-drawer__active-item"
          draggable="true"
          @dragstart="onDragStart(index, $event)"
          @dragover.prevent="onDragOver(index)"
          @drop.prevent="onDrop(index)"
          @dragend="onDragEnd"
        >
          <span class="mrx-grouping-drawer__drag-handle">
            <Drag24 aria-hidden="true" />
          </span>
          <span class="mrx-grouping-drawer__field-name">{{ group.headerName || group.field }}</span>
          <MSelect
            :id="`group-dir-${group.field}`"
            size="s"
            :options="sortOptions"
            :model-value="group.direction"
            class="mrx-grouping-drawer__sort-select"
            @update:model-value="updateDirection(group.field, $event)"
          />
          <MIconButton size="s" :ghost="true" @click="removeColumn(group.field)">
            <template #icon>
              <Cross20 aria-hidden="true" />
            </template>
          </MIconButton>
        </div>
      </div>

      <!-- Available columns -->
      <div class="mrx-grouping-drawer__section">
        <h3 class="mrx-grouping-drawer__section-title">AVAILABLE COLUMNS</h3>
        <div
          v-for="col in availableColumns"
          :key="col.field"
          class="mrx-grouping-drawer__available-item"
        >
          <span class="mrx-grouping-drawer__field-name">{{ col.headerName }}</span>
          <MIconButton size="s" :ghost="true" @click="addColumn(col)">
            <template #icon>
              <ListAdd24 aria-hidden="true" />
            </template>
          </MIconButton>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="mrx-grouping-drawer__footer">
        <MButton appearance="accent" @click="onApply">Apply</MButton>
        <MButton :outlined="true" @click="onReset">Reset</MButton>
      </div>
    </template>
  </MDrawer>
</template>

<style scoped>
.mrx-grouping-drawer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

.mrx-grouping-drawer__section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: #1e293b;
  letter-spacing: 0.04em;
  margin: 0 0 8px;
  padding: 0 4px;
}

.mrx-grouping-drawer__active-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 4px;
  border-bottom: 1px solid #e2e8f0;
}

.mrx-grouping-drawer__drag-handle {
  display: flex;
  align-items: center;
  cursor: grab;
  color: #94a3b8;
}

.mrx-grouping-drawer__field-name {
  flex: 1 1 0%;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  min-width: 250px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mrx-grouping-drawer__sort-select {
  flex: 0 0 auto;
  width: 100px;
  max-width: 100px;
  min-width: 0;
  overflow: hidden;
}

.mrx-grouping-drawer__sort-select :deep(.mc-select) {
  width: 100%;
  min-width: 0;
}

.mrx-grouping-drawer__sort-select :deep(.mc-select__control) {
  width: 100%;
  min-width: 0;
}

.mrx-grouping-drawer__active-item[draggable='true'] {
  cursor: grab;
}

.mrx-grouping-drawer__active-item[draggable='true']:active {
  cursor: grabbing;
  opacity: 0.6;
}

.mrx-grouping-drawer__available-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 4px;
  border-bottom: 1px solid #f1f5f9;
}

.mrx-grouping-drawer__footer {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
