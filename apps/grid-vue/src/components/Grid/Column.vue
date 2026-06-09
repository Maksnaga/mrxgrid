<script setup lang="ts">
/**
 * Declarative column definition — alternative to the `:columns` prop.
 *
 * Mirrors Angular `<ad-grid-column-def field="…">` content children. Use
 * inside `<ad-grid-vue>` to attach scoped slots (`#cell`, `#edit`, `#filter`,
 * `#header`) directly to the column. The `<ad-grid-column>` itself renders no
 * DOM — it only registers a `ColumnDef` (and slot presence flags) into the
 * `ColumnRegistry` provided by the parent grid.
 *
 * @example
 * <ad-grid-vue :rows="rows">
 *   <ad-grid-column field="name" header-name="Name" />
 *   <ad-grid-column field="status" header-name="Status">
 *     <template #cell="{ value }">
 *       <MozBadge>{{ value }}</MozBadge>
 *     </template>
 *   </ad-grid-column>
 * </ad-grid-vue>
 */

import { computed, onMounted, onScopeDispose, useSlots, watch } from 'vue'
import type { Component, Raw } from 'vue'
import type { ColumnDef, FilterDef, RowData } from './types'
import type { CellError } from './models/cell.model'
import type { CellEditorType } from './models/column.model'
import type { FilterConfig } from './models/filter.model'
import { injectColumnRegistry } from './state/ColumnRegistry'

defineOptions({ name: 'AdGridColumn' })

let _orderSeq = 0

const props = withDefaults(
  defineProps<{
    field: string
    headerName?: string
    width?: string
    minWidth?: string
    maxWidth?: string
    flex?: number
    sortable?: boolean
    sortComparator?: (a: RowData, b: RowData) => number
    resizable?: boolean
    reorderable?: boolean
    groupable?: boolean
    filterable?: boolean
    pinned?: 'start' | 'end' | 'left' | 'right' | null
    visible?: boolean
    hideable?: boolean
    freezable?: boolean
    searchVisible?: boolean
    headerMenuDisabled?: boolean
    valueGetter?: (row: RowData) => unknown
    valueFormatter?: (value: unknown, row: RowData) => string
    cellClass?: string | ((row: RowData) => string)
    headerClass?: string
    editable?: boolean
    cellEditor?: CellEditorType
    cellEditorOptions?: { value: unknown; label: string }[]
    cellEditorValidator?: (value: unknown, row: RowData) => boolean | string
    valueValidator?: (value: unknown) => boolean
    cellValidator?: (value: unknown, row: RowData) => CellError | null
    /** Custom renderer component (alternative to `#cell` slot). */
    renderer?: 'text' | Raw<Component>
    rendererProps?: Record<string, unknown>
    /**
     * Filter config — inline filter row config ({ type, options, … }) or
     * custom filter config ({ component, doesFilterPass, filterParams }).
     */
    filter?: FilterDef | FilterConfig<RowData, unknown, unknown>
  }>(),
  {
    sortable: true,
    resizable: true,
    reorderable: true,
    visible: true,
    hideable: true,
    freezable: true,
  },
)

const slots = useSlots()
const registry = injectColumnRegistry()
const order = _orderSeq++

if (!registry && import.meta.env?.DEV) {
  console.warn(
    `[grid] <ad-grid-column field="${props.field}"> rendered outside a <ad-grid-vue> — registration ignored.`,
  )
}

const def = computed<ColumnDef>(() => ({
  field: props.field,
  headerName: props.headerName ?? props.field,
  width: props.width,
  minWidth: props.minWidth,
  maxWidth: props.maxWidth,
  flex: props.flex,
  sortable: props.sortable,
  sortComparator: props.sortComparator,
  resizable: props.resizable,
  reorderable: props.reorderable,
  groupable: props.groupable,
  filterable: props.filterable,
  pinned: props.pinned,
  visible: props.visible,
  hideable: props.hideable,
  freezable: props.freezable,
  searchVisible: props.searchVisible,
  headerMenuDisabled: props.headerMenuDisabled,
  valueGetter: props.valueGetter,
  valueFormatter: props.valueFormatter,
  cellClass: props.cellClass,
  headerClass: props.headerClass,
  editable: props.editable,
  cellEditor: props.cellEditor,
  cellEditorOptions: props.cellEditorOptions,
  cellEditorValidator: props.cellEditorValidator,
  valueValidator: props.valueValidator,
  cellValidator: props.cellValidator,
  renderer: props.renderer,
  rendererProps: props.rendererProps,
  filter: props.filter,
}))

function snapshot() {
  return {
    id: props.field,
    def: def.value,
    order,
    hasCellSlot: !!slots.cell,
    hasEditSlot: !!slots.edit,
    hasFilterSlot: !!slots.filter,
    hasHeaderSlot: !!slots.header,
    cellSlot: slots.cell,
    editSlot: slots.edit,
    filterSlot: slots.filter,
    headerSlot: slots.header,
  }
}

onMounted(() => {
  registry?.register(snapshot())
})

// Re-register on prop change so the grid sees the latest column def.
watch(
  def,
  () => {
    registry?.register(snapshot())
  },
  { deep: true },
)

onScopeDispose(() => {
  registry?.unregister(props.field)
})
</script>

<template>
  <!-- Render-less component: only registers itself, no DOM. The slots are
       captured by the registry and forwarded by <ad-grid-vue> at render time. -->
  <div style="display: none"></div>
</template>