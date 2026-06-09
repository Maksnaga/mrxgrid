<script setup lang="ts">
/**
 * Grid toolbar — single batteries-included toolbar for `<ad-grid-vue>`.
 *
 * Pass `:grid="gridRef"` and the toolbar auto-wires:
 *  - Fullscreen toggle, CSV export, settings / grouping / filters /
 *    keyboard shortcuts drawers, formula reference drawer.
 *  - Inline selection banner ("X rows selected · Select all N · Clear")
 *    that reads `selectedCount / selectionTotalCount / selectionModel`
 *    directly from the grid's exposed refs.
 *
 * State that flows back to `<ad-grid-vue>` props is exposed via v-models:
 *  - `v-model:fullscreen` → `<ad-grid-vue :fullscreen>`
 *  - `v-model:hidden-fields` → `<ad-grid-vue :hidden-fields>`
 *  - `v-model:density` → `<ad-grid-vue :density>`
 *  - `v-model:column-order` → `<ad-grid-vue :column-order>`
 *  - `v-model:active-groups` → derive `groupFields = activeGroups.map(g.field)`
 *  - `v-model:filter-model` (also relays to the grid via `setFilterModel`)
 *
 * Slots: `#toolbar-start`, `#toolbar-end`, `#selection-actions`.
 */

import { computed, ref } from 'vue'
import { MIconButton, MButton, MNumberBadge } from '@mozaic-ds/vue'
import {
  FullscreenEnter24,
  FullscreenExit24,
  Download24,
  Filter24,
  Settings24,
  Group24,
  Keyboard24,
  Calculator24,
} from '@mozaic-ds/icons-vue'
import AdGridSettingsDrawer from './TableMenuDrawer.vue'
import AdGridGroupingDrawer from './GroupingDrawer.vue'
import AdGridFilterDrawer from './GridFilterDrawer.vue'
import AdGridKeyboardShortcutsDrawer from './KeyboardShortcutsDrawer.vue'
import {
  DEFAULT_OPERATORS,
  DEFAULT_OPERATOR_PER_TYPE,
  type FilterColumnDescriptor,
  type FilterDataType,
  type FilterModel,
} from '../../models/filter.model'
import type { ColumnDef } from '../../types'
import type { DataDensity } from './TableMenuDrawer.vue'
import type { GroupingItem } from './GroupingDrawer.vue'

defineOptions({ name: 'AdGridToolbar' })

// Subset of the grid's `defineExpose` we touch — just enough for the
// toolbar's actions. Typed loosely so any grid ref with these methods
// works without dragging the full type around.
interface GridImperativeAPI {
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
    grid?: GridImperativeAPI | null
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
    showFullscreen: true,
    showExport: true,
    showFilters: true,
    showSettings: true,
    showGroup: true,
    showKeyboard: true,
    showFormulaReference: false,
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
      options:
        col.filterOptions ??
        (col.filter && 'type' in col.filter ? col.filter.options : undefined),
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
  <div class="ad-grid__toolbar">
    <div class="ad-grid__toolbar-left">
      <MIconButton v-if="showFullscreen" id="grid-fullscreen" ghost size="s"
        :aria-label="fullscreen ? 'Exit fullscreen' : 'Fullscreen'" @click="onToggleFullscreen">
        <template #icon>
          <FullscreenExit24 v-if="fullscreen" />
          <FullscreenEnter24 v-else />
        </template>
      </MIconButton>

      <MIconButton v-if="showExport" id="grid-export" ghost size="s" aria-label="Export CSV" @click="onExport">
        <template #icon>
          <Download24 />
        </template>
      </MIconButton>

      <div v-if="showFilters" class="ad-grid__toolbar-filter">
        <MIconButton id="grid-filter" ghost size="s" aria-label="Filters" @click="filtersOpen = !filtersOpen">
          <template #icon>
            <Filter24 />
          </template>
        </MIconButton>
        <MNumberBadge
          v-if="activeFilterCount > 0"
          class="ad-grid__toolbar-filter-badge"
          :label="activeFilterCount"
          appearance="accent"
        />
      </div>

      <MIconButton v-if="showSettings" id="grid-settings" ghost size="s" aria-label="Settings"
        @click="settingsOpen = !settingsOpen">
        <template #icon>
          <Settings24 />
        </template>
      </MIconButton>

      <MIconButton v-if="showGroup" id="grid-group" ghost size="s" aria-label="Group"
        @click="groupingOpen = !groupingOpen">
        <template #icon>
          <Group24 />
        </template>
      </MIconButton>

      <MIconButton v-if="showKeyboard" id="grid-keyboard" ghost size="s" aria-label="Keyboard shortcuts"
        @click="keyboardOpen = !keyboardOpen">
        <template #icon>
          <Keyboard24 />
        </template>
      </MIconButton>

      <MIconButton v-if="showFormulaReference" id="grid-formula-reference" ghost size="s"
        aria-label="Formula reference" @click="emit('formula-reference')">
        <template #icon>
          <Calculator24 />
        </template>
      </MIconButton>

      <slot name="toolbar-start" />
    </div>

    <!-- Selection banner — inline, replaces the floating SelectionBar. -->
    <div v-if="selectedCount > 0" class="ad-grid__selection-banner">
      <span class="ad-grid__selection-text">
        {{ selectedCount }} row{{ selectedCount === 1 ? '' : 's' }} selected
      </span>
      <MButton v-if="!allSelected && totalCount > 0 && selectedCount < totalCount" ghost size="s" appearance="accent"
        @click="onSelectAllRows">
        Select all {{ totalCount }} rows
      </MButton>
      <MButton ghost size="s" @click="onClearSelection">
        Clear
      </MButton>
      <slot name="selection-actions" />
    </div>

    <div class="ad-grid__toolbar-right">
      <slot name="toolbar-end" />
    </div>
  </div>

  <!-- Drawers — auto-mounted when the corresponding feature is enabled. -->
  <ad-grid-settings-drawer
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
  <ad-grid-grouping-drawer
    v-if="showGroup"
    :open="groupingOpen"
    :columns="columns"
    :active-groups="activeGroups"
    @update:open="groupingOpen = $event"
    @apply="onApplyGrouping"
    @reset="onResetGrouping"
  />
  <ad-grid-filter-drawer
    v-if="showFilters"
    :open="filtersOpen"
    :model="filterModel"
    :columns="filterColumns"
    @update:open="filtersOpen = $event"
    @apply="onApplyFilters"
    @clear="onClearFilters"
  />
  <ad-grid-keyboard-shortcuts-drawer
    v-if="showKeyboard"
    :open="keyboardOpen"
    @update:open="keyboardOpen = $event"
  />
</template>

<style scoped lang="scss">
.ad-grid__toolbar {
  display: flex;
  align-items: center;
  gap: m.get-spacing('200');
  padding: m.get-spacing('100') 0;
  flex-wrap: wrap;
}

.ad-grid__toolbar-left,
.ad-grid__toolbar-right {
  display: flex;
  align-items: center;
  gap: m.get-spacing('050');
}

.ad-grid__toolbar-right {
  margin-left: auto;
}

// Inline wrap so the badge can sit floating in the top-right corner of
// the icon-only Filters button.
.ad-grid__toolbar-filter {
  position: relative;
  display: inline-flex;
}

.ad-grid__toolbar-filter-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  pointer-events: none;
  z-index: 1;
}

/* Selection banner — inline in the toolbar, neutral input-style frame
   that stretches to fill the row. */
.ad-grid__selection-banner {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: m.get-spacing('200');
  border: m.get-token('border-width', 's') solid var(--color-border-primary, #e2e8f0);
  border-radius: m.get-radius('s');
  background: var(--color-background-primary, #fff);
  font-size: var(--font-size-200, 14px);
  color: var(--color-text-primary);
  padding: 0 8px 0 16px;
  min-width: 0;
}

.ad-grid__selection-text {
  font-weight: var(--font-weight-regular, 400);
  color: var(--color-text-secondary, #64748b);
  white-space: nowrap;
}
</style>
