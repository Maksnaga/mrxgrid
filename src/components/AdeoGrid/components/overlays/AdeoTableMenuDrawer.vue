<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MDrawer, MButton, MToggle, MSelect, MTextInput } from '@mozaic-ds/vue'
import { ChevronRight24, Search24 } from '@mozaic-ds/icons-vue'
import type { ColumnDef } from '../../types'
import type { GridDensity } from '../../models/grid-events.model'

/**
 * @deprecated Use `GridDensity` from `models/grid-events.model`. This alias
 * is kept for backward compatibility with consumers that imported `DataDensity`
 * from this component before the Angular-parity rename.
 */
export type DataDensity = GridDensity

const props = defineProps<{
  open: boolean
  columns: ColumnDef[]
  /** Fields currently hidden. */
  hiddenFields: string[]
  density: DataDensity
  /** Current column display order (field names). */
  columnOrder?: string[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  apply: [payload: { density: DataDensity; hiddenFields: string[]; columnOrder: string[] }]
  reset: []
}>()

// --- Subview navigation ---
type View = 'main' | 'density' | 'columns'
const currentView = ref<View>('main')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      currentView.value = 'main'
      draftDensity.value = props.density
      draftHidden.value = new Set(props.hiddenFields)
      draftOrder.value = props.columnOrder?.length
        ? [...props.columnOrder]
        : props.columns.map((c) => c.field)
      columnSearch.value = ''
    }
  },
)

// --- Draft state ---
const draftDensity = ref<DataDensity>('default')
const draftHidden = ref<Set<string>>(new Set())
const draftOrder = ref<string[]>([])
const columnSearch = ref('')

/** MSelect options for the density picker. Internal values stay
 *  `compact|default|comfortable` — only the display labels change to
 *  Small/Default/Large to match the design. */
const densityOptions = [
  { text: 'Small', value: 'compact' as DataDensity },
  { text: 'Default', value: 'default' as DataDensity },
  { text: 'Large', value: 'comfortable' as DataDensity },
]

/** Columns in draft order with their headerName. */
const orderedColumns = computed(() => {
  const colMap = new Map(props.columns.map((c) => [c.field, c]))
  return draftOrder.value
    .filter((f) => colMap.has(f))
    .map((f) => colMap.get(f)!)
})

/** Columns filtered by the search input (case-insensitive on headerName/field). */
const filteredColumns = computed(() => {
  const q = columnSearch.value.trim().toLowerCase()
  if (!q) return orderedColumns.value
  return orderedColumns.value.filter(
    (c) => c.headerName.toLowerCase().includes(q) || c.field.toLowerCase().includes(q),
  )
})

const visibleCount = computed(
  () => props.columns.length - draftHidden.value.size,
)

/** Display label for the density preview on the main menu item. */
const densityLabel = computed(
  () => densityOptions.find((o) => o.value === draftDensity.value)?.text ?? '',
)

function toggleColumnVisibility(field: string) {
  const next = new Set(draftHidden.value)
  if (next.has(field)) {
    next.delete(field)
  } else {
    next.add(field)
  }
  draftHidden.value = next
}

function hideAll() {
  draftHidden.value = new Set(props.columns.map((c) => c.field))
}

function showAll() {
  draftHidden.value = new Set()
}

function onApply() {
  emit('apply', {
    density: draftDensity.value,
    hiddenFields: [...draftHidden.value],
    columnOrder: [...draftOrder.value],
  })
  emit('update:open', false)
}

function onReset() {
  emit('reset')
  emit('update:open', false)
}

const drawerTitle = computed(() => {
  const titles: Record<View, string> = {
    main: 'Settings',
    density: 'Data density',
    columns: 'Display columns',
  }
  return titles[currentView.value]
})

const showBack = computed(() => currentView.value !== 'main')

function onBack() {
  currentView.value = 'main'
}

// --- Drag and drop column reorder ---
let dragField: string | null = null
let dragOverField: string | null = null

function onDragStart(field: string, e: DragEvent) {
  dragField = field
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', field)
  }
  // Add a slight delay so the browser captures the drag image
  const target = e.currentTarget as HTMLElement
  target.classList.add('adeo-grid-settings__column-item--dragging')
}

function onDragEnd(e: DragEvent) {
  const target = e.currentTarget as HTMLElement
  target.classList.remove('adeo-grid-settings__column-item--dragging')
  // Clear all dragover indicators
  dragField = null
  dragOverField = null
  const container = target.parentElement
  if (container) {
    container.querySelectorAll('.adeo-grid-settings__column-item--drag-over').forEach((el) => {
      el.classList.remove('adeo-grid-settings__column-item--drag-over')
    })
  }
}

function onDragOver(field: string, e: DragEvent) {
  if (!dragField || dragField === field) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'

  if (dragOverField !== field) {
    // Remove previous indicator
    const container = (e.currentTarget as HTMLElement).parentElement
    if (container) {
      container.querySelectorAll('.adeo-grid-settings__column-item--drag-over').forEach((el) => {
        el.classList.remove('adeo-grid-settings__column-item--drag-over')
      })
    }
    dragOverField = field
    ;(e.currentTarget as HTMLElement).classList.add('adeo-grid-settings__column-item--drag-over')
  }
}

function onDragLeave(e: DragEvent) {
  const target = e.currentTarget as HTMLElement
  const related = e.relatedTarget as Node | null
  // Only remove if leaving the element entirely (not entering a child)
  if (related && target.contains(related)) return
  target.classList.remove('adeo-grid-settings__column-item--drag-over')
}

function onDrop(field: string, e: DragEvent) {
  e.preventDefault()
  if (!dragField || dragField === field) return

  const order = [...draftOrder.value]
  const fromIdx = order.indexOf(dragField)
  if (fromIdx < 0) return

  order.splice(fromIdx, 1)
  const toIdx = order.indexOf(field)
  if (toIdx < 0) {
    order.push(dragField)
  } else {
    order.splice(toIdx, 0, dragField)
  }

  draftOrder.value = order
  dragField = null
  dragOverField = null

  // Cleanup indicators
  const container = (e.currentTarget as HTMLElement).parentElement
  if (container) {
    container.querySelectorAll('.adeo-grid-settings__column-item--drag-over').forEach((el) => {
      el.classList.remove('adeo-grid-settings__column-item--drag-over')
    })
  }
}
</script>

<template>
  <!-- See AdeoGridFilterDrawer.vue for why we Teleport to <body>. -->
  <Teleport to="body">
  <!-- See AdeoGroupingDrawer.vue for why `close-on-overlay` stays
       disabled (Mozaic's MDrawer fires it on dialog-body whitespace). -->
  <MDrawer
    :open="open"
    :title="drawerTitle"
    :back="showBack"
    position="right"
    :close-on-overlay="false"
    @update:open="emit('update:open', $event)"
    @back="onBack"
  >
    <!-- Main view -->
    <div v-if="currentView === 'main'" class="adeo-grid-settings">
      <div class="adeo-grid-settings__menu">
        <button class="adeo-grid-settings__menu-item" @click="currentView = 'density'">
          <div class="adeo-grid-settings__menu-item-text">
            <span class="adeo-grid-settings__menu-item-label">Data density</span>
            <span class="adeo-grid-settings__menu-item-value">{{ densityLabel }}</span>
          </div>
          <ChevronRight24 aria-hidden="true" />
        </button>
        <button class="adeo-grid-settings__menu-item" @click="currentView = 'columns'">
          <div class="adeo-grid-settings__menu-item-text">
            <span class="adeo-grid-settings__menu-item-label">Display columns</span>
            <span class="adeo-grid-settings__menu-item-value">
              {{ visibleCount }}/{{ columns.length }} displayed
            </span>
          </div>
          <ChevronRight24 aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Density subview -->
    <div v-else-if="currentView === 'density'" class="adeo-grid-settings">
      <div class="adeo-grid-settings__field">
        <label class="adeo-grid-settings__field-label" for="adeo-grid-settings-density">Density</label>
        <MSelect
          id="adeo-grid-settings-density"
          :options="densityOptions"
          :model-value="draftDensity"
          @update:model-value="(v: string | number) => (draftDensity = v as DataDensity)"
        />
      </div>
    </div>

    <!-- Columns subview -->
    <div v-else-if="currentView === 'columns'" class="adeo-grid-settings">
      <MTextInput
        id="adeo-grid-settings-column-search"
        size="s"
        input-type="search"
        placeholder="Find a column"
        :model-value="columnSearch"
        class="adeo-grid-settings__search"
        @input="(e: Event) => (columnSearch = (e.target as HTMLInputElement).value)"
      >
        <template #icon><Search24 /></template>
      </MTextInput>

      <div class="adeo-grid-settings__columns-list">
        <div
          v-for="col in filteredColumns"
          :key="col.field"
          class="adeo-grid-settings__column-item"
          draggable="true"
          @dragstart="onDragStart(col.field, $event)"
          @dragend="onDragEnd"
          @dragover="onDragOver(col.field, $event)"
          @dragleave="onDragLeave"
          @drop="onDrop(col.field, $event)"
        >
          <span class="adeo-grid-settings__column-drag-handle">&#8942;&#8942;</span>
          <!-- Sprint 7 §2.11 — switch from MCheckbox to MToggle so the
               visibility list reads as on/off switches (matches Angular). -->
          <MToggle
            :id="`col-vis-${col.field}`"
            :label="col.headerName"
            :model-value="!draftHidden.has(col.field)"
            @update:model-value="toggleColumnVisibility(col.field)"
          />
        </div>
      </div>

      <div class="adeo-grid-settings__columns-actions">
        <MButton :outlined="true" @click="hideAll">Hide all</MButton>
        <MButton :outlined="true" @click="showAll">Show all</MButton>
      </div>
    </div>

    <template #footer>
      <div class="adeo-grid-settings__footer">
        <MButton appearance="accent" @click="onApply">Apply</MButton>
        <MButton :outlined="true" @click="onReset">Reset</MButton>
      </div>
    </template>
  </MDrawer>
  </Teleport>
</template>

<style scoped>
.adeo-grid-settings {
  font-family: system-ui, -apple-system, sans-serif;
  padding: 8px 0;
}

.adeo-grid-settings__menu {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.adeo-grid-settings__menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 16px;
  border: none;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
  text-align: left;
  color: #64748b;
}

.adeo-grid-settings__menu-item:last-child {
  border-bottom: none;
}

.adeo-grid-settings__menu-item:hover {
  background-color: #f8fafc;
}

.adeo-grid-settings__menu-item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.adeo-grid-settings__menu-item-label {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.adeo-grid-settings__menu-item-value {
  font-size: 13px;
  color: #64748b;
}

.adeo-grid-settings__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.adeo-grid-settings__field-label {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.adeo-grid-settings__search {
  margin-bottom: 12px;
}

.adeo-grid-settings__columns-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.adeo-grid-settings__columns-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.adeo-grid-settings__columns-actions > * {
  flex: 1;
}

.adeo-grid-settings__column-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  border-bottom: 1px solid #f1f5f9;
  cursor: grab;
  border-radius: 4px;
  transition: background-color 0.1s;
}

.adeo-grid-settings__column-item:active {
  cursor: grabbing;
}

.adeo-grid-settings__column-item--dragging {
  opacity: 0.4;
}

.adeo-grid-settings__column-item--drag-over {
  border-top: 2px solid #2563eb;
  padding-top: 6px;
}

.adeo-grid-settings__column-drag-handle {
  color: #94a3b8;
  font-size: 12px;
  letter-spacing: -2px;
  cursor: grab;
  flex-shrink: 0;
  user-select: none;
}

.adeo-grid-settings__footer {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
