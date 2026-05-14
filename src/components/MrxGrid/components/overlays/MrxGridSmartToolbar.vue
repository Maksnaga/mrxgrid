<script setup lang="ts">
/**
 * Smart toolbar — bundles `MrxGridToolbar` + the four feature drawers
 * (settings / grouping / filters / keyboard) and wires them end-to-end so
 * the consumer gets a working toolbar by just enabling `show-*` flags.
 *
 * Use this when you want batteries-included behaviour. The plain
 * `MrxGridToolbar` is still available if you need fine-grained control
 * over each feature's hookup.
 *
 * Required:
 *  - `:grid="gridRef"` — the `<MrxGrid>` template ref. Used for the
 *    imperative export / selectAll / clearSelection / setFilterModel calls.
 *  - `:columns="columns"` — used to build filter descriptors and to drive
 *    the settings + grouping drawers.
 *
 * State that flows back to `<MrxGrid>` props is exposed via v-models:
 *  - `v-model:fullscreen` → `<MrxGrid :fullscreen>`
 *  - `v-model:hidden-fields` → `<MrxGrid :hidden-fields>`
 *  - `v-model:density` → `<MrxGrid :density>`
 *  - `v-model:column-order` → `<MrxGrid :column-order>`
 *  - `v-model:active-groups` → derive `groupFields = activeGroups.map(g.field)`
 *  - `v-model:filter-model` (also relays to the grid via setFilterModel)
 */

import { computed, ref } from 'vue'
import MrxGridToolbar from './MrxGridToolbar.vue'
import MrxTableMenuDrawer from './MrxTableMenuDrawer.vue'
import MrxGroupingDrawer from './MrxGroupingDrawer.vue'
import MrxGridFilterDrawer from './MrxGridFilterDrawer.vue'
import MrxKeyboardShortcutsDrawer from './MrxKeyboardShortcutsDrawer.vue'
import {
  DEFAULT_OPERATORS,
  DEFAULT_OPERATOR_PER_TYPE,
  type FilterColumnDescriptor,
  type FilterDataType,
  type FilterModel,
} from '../../models/filter.model'
import type { ColumnDef } from '../../types'
import type { DataDensity } from './MrxTableMenuDrawer.vue'
import type { GroupingItem } from './MrxGroupingDrawer.vue'

// Subset of the grid's `defineExpose` we touch — just enough for the
// toolbar's batteries-included actions. Typed loosely so any grid ref
// with these methods works without dragging the full type around.
interface MrxGridImperativeAPI {
  exportCsv?: (opts?: { filename?: string }) => void
  selectAll?: () => void
  clearSelection?: () => void
  setFilterModel?: (model: FilterModel) => void
  clearFilterModel?: () => void
  selectedCount?: number
  selectionTotalCount?: number
  selectionModel?: { allSelected: boolean }
}

const props = withDefaults(
  defineProps<{
    grid?: MrxGridImperativeAPI | null
    columns?: ColumnDef[]
    fullscreen?: boolean
    hiddenFields?: string[]
    density?: DataDensity
    columnOrder?: string[]
    activeGroups?: GroupingItem[]
    filterModel?: FilterModel
    showFullscreen?: boolean
    showExport?: boolean
    showFilters?: boolean
    showSettings?: boolean
    showGroup?: boolean
    showKeyboard?: boolean
    showFormulaReference?: boolean
    /** Filename for the export CSV. Default `'export.csv'`. */
    exportFilename?: string
  }>(),
  {
    columns: () => [],
    fullscreen: false,
    hiddenFields: () => [],
    density: 'default',
    columnOrder: undefined,
    activeGroups: () => [],
    filterModel: () => ({ conditions: [] }),
    exportFilename: 'export.csv',
  },
)

const emit = defineEmits<{
  'update:fullscreen': [v: boolean]
  'update:hiddenFields': [v: string[]]
  'update:density': [v: DataDensity]
  'update:columnOrder': [v: string[] | undefined]
  'update:activeGroups': [v: GroupingItem[]]
  'update:filterModel': [v: FilterModel]
  'formula-reference': []
}>()

const settingsOpen = ref(false)
const groupingOpen = ref(false)
const filtersOpen = ref(false)
const keyboardOpen = ref(false)

const activeFilterCount = computed(() => props.filterModel.conditions.length)

// Read selection state from the grid's exposed (auto-unwrapped) refs.
// Falls back to zeros until the grid mounts.
const selectedCount = computed(() => props.grid?.selectedCount ?? 0)
const totalCount = computed(() => props.grid?.selectionTotalCount ?? 0)
const allSelected = computed(() => props.grid?.selectionModel?.allSelected ?? false)

// Build filter descriptors from the columns prop so the filter drawer can
// render value pickers + operator menus per column without the consumer
// having to construct them.
const filterColumns = computed<FilterColumnDescriptor[]>(() =>
  props.columns.map((col) => {
    const filterType: FilterDataType =
      (col.filterType as FilterDataType | undefined) ?? 'text'
    const operators = col.filterOperators ?? DEFAULT_OPERATORS[filterType]
    const defaultOperator =
      col.defaultFilterOperator ?? DEFAULT_OPERATOR_PER_TYPE[filterType]
    return {
      field: col.field,
      headerName: col.headerName,
      filterType,
      operators,
      defaultOperator,
      options: col.filterOptions ?? col.filter?.options,
    }
  }),
)

function onToggleFullscreen() {
  emit('update:fullscreen', !props.fullscreen)
}
function onExport() {
  props.grid?.exportCsv?.({ filename: props.exportFilename })
}
function onSelectAllRows() {
  props.grid?.selectAll?.()
}
function onClearSelection() {
  props.grid?.clearSelection?.()
}

function onApplySettings(payload: {
  density: DataDensity
  hiddenFields: string[]
  columnOrder: string[]
}) {
  emit('update:density', payload.density)
  emit('update:hiddenFields', payload.hiddenFields)
  emit('update:columnOrder', payload.columnOrder)
}
function onResetSettings() {
  emit('update:density', 'default')
  emit('update:hiddenFields', [])
  emit('update:columnOrder', undefined)
}

function onApplyGrouping(groups: GroupingItem[]) {
  emit('update:activeGroups', groups)
}
function onResetGrouping() {
  emit('update:activeGroups', [])
}

function onApplyFilters(model: FilterModel) {
  emit('update:filterModel', model)
  props.grid?.setFilterModel?.(model)
}
function onClearFilters() {
  emit('update:filterModel', { conditions: [] })
  props.grid?.clearFilterModel?.()
}
</script>

<template>
  <MrxGridToolbar
    :show-fullscreen="showFullscreen"
    :show-export="showExport"
    :show-filters="showFilters"
    :show-settings="showSettings"
    :show-group="showGroup"
    :show-keyboard="showKeyboard"
    :show-formula-reference="showFormulaReference"
    :fullscreen="fullscreen"
    :active-filter-count="activeFilterCount"
    :selected-count="selectedCount"
    :total-count="totalCount"
    :all-selected="allSelected"
    @toggle-fullscreen="onToggleFullscreen"
    @export="onExport"
    @filters="filtersOpen = !filtersOpen"
    @settings="settingsOpen = !settingsOpen"
    @group="groupingOpen = !groupingOpen"
    @keyboard="keyboardOpen = !keyboardOpen"
    @formula-reference="emit('formula-reference')"
    @select-all-rows="onSelectAllRows"
    @clear-selection="onClearSelection"
  >
    <template v-if="$slots['toolbar-start']" #toolbar-start>
      <slot name="toolbar-start" />
    </template>
    <template v-if="$slots['toolbar-end']" #toolbar-end>
      <slot name="toolbar-end" />
    </template>
    <template v-if="$slots['selection-actions']" #selection-actions>
      <slot name="selection-actions" />
    </template>
  </MrxGridToolbar>
  <MrxTableMenuDrawer
    v-if="showSettings"
    :open="settingsOpen"
    :columns="columns"
    :hidden-fields="hiddenFields"
    :density="density"
    :column-order="columnOrder"
    @update:open="settingsOpen = $event"
    @apply="onApplySettings"
    @reset="onResetSettings"
  />
  <MrxGroupingDrawer
    v-if="showGroup"
    :open="groupingOpen"
    :columns="columns"
    :active-groups="activeGroups"
    @update:open="groupingOpen = $event"
    @apply="onApplyGrouping"
    @reset="onResetGrouping"
  />
  <MrxGridFilterDrawer
    v-if="showFilters"
    :open="filtersOpen"
    :model="filterModel"
    :columns="filterColumns"
    @update:open="filtersOpen = $event"
    @apply="onApplyFilters"
    @clear="onClearFilters"
  />
  <MrxKeyboardShortcutsDrawer
    v-if="showKeyboard"
    :open="keyboardOpen"
    @update:open="keyboardOpen = $event"
  />
</template>
