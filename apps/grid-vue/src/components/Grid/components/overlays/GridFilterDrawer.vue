<script setup lang="ts">
/**
 * Filter drawer — Angular parity (`ad-grid-filter-drawer`).
 *
 * Wraps `AdGridFilterBuilder` in an `MDrawer`. Uses a **local draft** of the
 * filter model that resets every time the drawer opens, so the user can edit
 * freely and commit with Apply (or discard with Cancel). When
 * `applyMode === 'auto'`, edits are emitted immediately and the footer is
 * hidden.
 *
 * The drawer itself never mutates the engine directly — it forwards intent:
 * - `apply: [FilterModel]`  — user validated the draft
 * - `cancel: []`            — user dismissed, parent should keep its model
 * - `clear: []`             — empty the model (only forwarded in auto mode)
 *
 * In manual mode the parent typically calls `filterEngine.setModel(event, 'replace')`
 * on `apply`. In auto mode, each builder event should round-trip through the
 * engine immediately.
 */

import { computed, ref, watch } from 'vue'
import { MDrawer, MButton } from '@mozaic-ds/vue'
import AdGridFilterBuilder from './GridFilterBuilder.vue'
import {
  generateConditionId,
  type FilterApplyMode,
  type FilterColumnDescriptor,
  type FilterCondition,
  type FilterModel,
} from '../../models/filter.model'

defineOptions({ name: 'AdGridFilterDrawer' })

const props = defineProps<{
  open: boolean
  model: FilterModel
  columns: FilterColumnDescriptor[]
  applyMode?: FilterApplyMode
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  apply: [model: FilterModel]
  cancel: []
  clear: []
  change: [model: FilterModel]
}>()

const mode = computed<FilterApplyMode>(() => props.applyMode ?? 'manual')

// Local draft — editable until Apply. In auto mode we still use it as the
// single source of truth for the UI, but push every change upstream via
// `change` so the parent can mirror into the engine.
const draft = ref<FilterCondition[]>([])

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) draft.value = cloneConditions(props.model.conditions)
  },
  { immediate: true },
)

// In auto mode, also keep the draft in sync with live model changes while
// open — the parent may accept them from another surface (quick-filter row,
// tag-bar remove, etc.).
watch(
  () => props.model,
  (next) => {
    if (mode.value === 'auto' && props.open) draft.value = cloneConditions(next.conditions)
  },
  { deep: true },
)

function cloneConditions(list: FilterCondition[]): FilterCondition[] {
  return list.map((c) => ({
    ...c,
    value: { ...c.value },
    // Deep-clone the opaque AG-Grid-style filter model so two drafts don't
    // alias the same nested object. `structuredClone` falls back to a JSON
    // round-trip for older runtimes (the model is required to be
    // JSON-serializable anyway — see FilterInstance docs).
    model: c.model == null ? c.model : cloneModel(c.model),
  }))
}

function cloneModel(model: unknown): unknown {
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(model)
      : JSON.parse(JSON.stringify(model))
  } catch {
    return model
  }
}

function emitChange(): void {
  if (mode.value === 'auto') {
    emit('change', { conditions: cloneConditions(draft.value) })
  }
}

function onAdd(): void {
  const firstColumn = props.columns[0]
  if (!firstColumn) return
  draft.value = [
    ...draft.value,
    {
      id: generateConditionId(),
      combinator: 'and',
      field: firstColumn.field,
      operator: firstColumn.defaultOperator,
      value: {},
    },
  ]
  emitChange()
}

function onUpdate(id: string, patch: Partial<FilterCondition>): void {
  draft.value = draft.value.map((c) => {
    if (c.id !== id) return c
    return {
      ...c,
      ...patch,
      value: { ...c.value, ...patch.value },
    }
  })
  emitChange()
}

function onRemove(id: string): void {
  draft.value = draft.value.filter((c) => c.id !== id)
  emitChange()
}

function onReorder(from: number, to: number): void {
  const next = [...draft.value]
  const [item] = next.splice(from, 1)
  if (!item) return
  next.splice(to, 0, item)
  draft.value = next
  emitChange()
}

function onClear(): void {
  draft.value = []
  if (mode.value === 'auto') {
    emit('clear')
  }
}

function onApply(): void {
  emit('apply', { conditions: cloneConditions(draft.value) })
  emit('update:open', false)
}

function onCancel(): void {
  emit('cancel')
  emit('update:open', false)
}
</script>

<template>
  <!--
    Teleport the drawer to <body> so it sits OUTSIDE the grid's stacking
    context. Without this the MDrawer renders as a descendant of
    `.grid-root` and shares its (numerically tied) z-index with the
    grid's sticky header + pinned columns (both z-index 5). Because the
    pinned cells follow the drawer in DOM order, they would paint on top
    of the dialog and the user would see status badges / column headers
    "bleed" through the drawer panel.
  -->
  <Teleport to="body">
    <!-- `close-on-overlay` explicitly false. Mozaic's MDrawer defaults
         to true and treats clicks on the dialog body whitespace as
         overlay clicks — the panel would shut while the user clicks
         between filter rows / fields. The user dismisses via the close
         button. -->
    <MDrawer :open="open" title="Filters" :extended="true" :close-on-overlay="false" position="right"
      @update:open="emit('update:open', $event)">
      <div class="grid-filter-drawer">
        <ad-grid-filter-builder :conditions="draft" :columns="columns" @add="onAdd" @update="onUpdate"
          @remove="onRemove" @reorder="onReorder" @clear="onClear" />
      </div>

      <template v-if="mode === 'manual'" #footer>
        <div class="grid-filter-drawer__footer">
          <MButton appearance="accent" @click="onApply">Apply</MButton>
          <MButton :outlined="true" @click="onCancel">Cancel</MButton>
        </div>
      </template>
    </MDrawer>
  </Teleport>
</template>

<style scoped>
.grid-filter-drawer {
  padding: 8px 0;
}

.grid-filter-drawer__footer {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
