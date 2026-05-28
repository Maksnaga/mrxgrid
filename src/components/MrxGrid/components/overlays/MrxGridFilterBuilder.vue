<script setup lang="ts">
/**
 * Filter builder UI — Angular parity (`moz-grid-filter-builder`).
 *
 * Renders one row per `FilterCondition`:
 * [combinator] [field] [operator] [value] [(valueTo)] [remove]
 *
 * Stateless: emits granular events (`add` / `update` / `remove` / `reorder`)
 * instead of a bulk `update:model`. Parents mutate the engine through
 * `useFilterEngine` and the model flows back in through props — same contract
 * as the Angular component.
 *
 * Operator and value shape are driven by the column's `FilterColumnDescriptor`
 * (from `filterEngine.describeFilterableColumns()`):
 * - `VALUELESS_OPERATORS`   → hide value inputs
 * - `RANGE_OPERATORS`       → render `value` + `valueTo`
 * - `set` filter type       → render multi-checkbox using `descriptor.options`
 * - `boolean`               → true/false select
 * - everything else         → typed `<input>` (text/number/date)
 */

import { computed } from 'vue'
import { MSelect, MTextInput, MCheckbox, MButton, MIconButton } from '@mozaic-ds/vue'
import { Trash24, ListAdd24 } from '@mozaic-ds/icons-vue'
import {
  OPERATOR_LABELS,
  RANGE_OPERATORS,
  VALUELESS_OPERATORS,
  type FilterColumnDescriptor,
  type FilterCombinator,
  type FilterCondition,
  type FilterOperator,
} from '../../models/filter.model'

// --- MSelect option helpers ---------------------------------------------------
const COMBINATOR_OPTIONS = [
  { text: 'And', value: 'and' },
  { text: 'Or', value: 'or' },
]

const BOOLEAN_OPTIONS = [
  { text: '—', value: '' },
  { text: 'True', value: 'true' },
  { text: 'False', value: 'false' },
]

const props = defineProps<{
  conditions: FilterCondition[]
  columns: FilterColumnDescriptor[]
}>()

const emit = defineEmits<{
  add: []
  update: [id: string, patch: Partial<FilterCondition>]
  remove: [id: string]
  reorder: [fromIndex: number, toIndex: number]
  clear: []
}>()

const columnByField = computed(() => {
  const map = new Map<string, FilterColumnDescriptor>()
  for (const c of props.columns) map.set(c.field, c)
  return map
})

function descriptorFor(field: string): FilterColumnDescriptor | undefined {
  return columnByField.value.get(field)
}

function operatorsFor(field: string): FilterOperator[] {
  return descriptorFor(field)?.operators ?? []
}

function fieldOptions(): Array<{ text: string; value: string }> {
  return props.columns.map((c) => ({ text: c.headerName, value: c.field }))
}

function operatorOptions(field: string): Array<{ text: string; value: string }> {
  return operatorsFor(field).map((op) => ({
    text: OPERATOR_LABELS[op] ?? op,
    value: op,
  }))
}

function asString(v: unknown): string {
  return v == null ? '' : String(v)
}

function booleanSelectValue(condition: FilterCondition): string {
  if (condition.value.value === true) return 'true'
  if (condition.value.value === false) return 'false'
  return ''
}

function onCombinatorChange(id: string, value: string): void {
  emit('update', id, { combinator: value as FilterCombinator })
}

function onFieldChange(id: string, value: string): void {
  const descriptor = descriptorFor(value)
  emit('update', id, {
    field: value,
    operator: descriptor?.defaultOperator ?? 'contains',
    value: {},
  })
}

function onOperatorChange(id: string, value: string): void {
  emit('update', id, { operator: value as FilterOperator, value: {} })
}

function onValueChange(id: string, value: unknown): void {
  emit('update', id, { value: { value } })
}

function onValueToChange(id: string, valueTo: unknown): void {
  emit('update', id, { value: { valueTo } })
}

function onBooleanSelect(id: string, raw: string | number): void {
  const s = String(raw)
  emit('update', id, { value: { value: s === 'true' ? true : s === 'false' ? false : null } })
}

function onTextInput(id: string, e: Event, field: string): void {
  const raw = (e.target as HTMLInputElement).value
  const typed = descriptorFor(field)?.filterType === 'number' ? (raw === '' ? null : Number(raw)) : raw
  emit('update', id, { value: { value: typed } })
}

function onTextInputTo(id: string, e: Event, field: string): void {
  const raw = (e.target as HTMLInputElement).value
  const typed = descriptorFor(field)?.filterType === 'number' ? (raw === '' ? null : Number(raw)) : raw
  emit('update', id, { value: { valueTo: typed } })
}

// --- Custom filter wiring -----------------------------------------------------

/**
 * Fallback `column` value passed inside the bundled `params` object when
 * the descriptor wasn't built with a `colDef` reference. The minimal
 * shape carries `field` + `headerName`, which is all most filter UIs need.
 */
function columnFor(field: string): unknown {
  const d = descriptorFor(field)
  return d?.colDef ?? { field, headerName: d?.headerName ?? field }
}

/**
 * Optional lifecycle methods a custom filter component MAY expose via
 * `defineExpose`. All optional — the builder branches on what's present.
 */
interface FilterInstanceLike {
  isFilterActive?(): boolean
  refresh?(params: unknown): boolean | void
  afterGuiAttached?(params?: { suppressFocus?: boolean }): void
  getModelAsString?(model: unknown): string
}
const agInstances = new Map<string, FilterInstanceLike>()

/**
 * Returns a function-ref bound to the given condition. Pulling the arrow
 * out of the template lets us keep TypeScript's `noImplicitAny` happy
 * without leaking TS annotations into the template (which Vue's parser
 * doesn't accept).
 */
function bindRefFor(condition: FilterCondition): (inst: unknown) => void {
  return (inst) => bindAGFilterInstance(condition, inst)
}

function bindAGFilterInstance(condition: FilterCondition, inst: unknown): void {
  if (inst == null) {
    agInstances.delete(condition.id)
    return
  }
  if (typeof inst !== 'object') return
  const candidate = inst as FilterInstanceLike
  agInstances.set(condition.id, candidate)
  // Re-hydrate from the persisted model on mount / draft swap.
  if (condition.model != null) {
    try {
      candidate.refresh?.(buildFilterParams(condition))
    } catch {
      // Defensive — a bad refresh shouldn't break the UI.
    }
  }
  candidate.afterGuiAttached?.()
}

/**
 * `MrxFilterParams.onModelChange` handler — emit an `update` patch with
 * the new model. The drawer's parent maps that through the filter engine.
 */
function onModelChange(condition: FilterCondition, nextModel: unknown): void {
  // Optional override via `isFilterActive` lets components flag "non-null
  // model but inactive" (e.g. empty array). Default heuristic: model != null.
  const inst = agInstances.get(condition.id)
  const isActive =
    typeof inst?.isFilterActive === 'function' ? inst.isFilterActive() : nextModel != null
  emit('update', condition.id, { model: isActive ? nextModel : null })
}

/**
 * Builds the bundled `params` object passed to the filter component as
 * its single `params` prop.
 */
function buildFilterParams(condition: FilterCondition) {
  const d = descriptorFor(condition.field)
  return {
    model: condition.model,
    column: columnFor(condition.field),
    filterParams: d?.filter?.filterParams,
    getValue: (_field: string) => undefined as unknown,
    onModelChange: (m: unknown) => onModelChange(condition, m),
  }
}

function onSetToggle(condition: FilterCondition, optionValue: unknown, checked: boolean): void {
  const current = Array.isArray(condition.value.value)
    ? [...(condition.value.value as unknown[])]
    : []
  const idx = current.findIndex((v) => String(v) === String(optionValue))
  if (checked && idx < 0) current.push(optionValue)
  if (!checked && idx >= 0) current.splice(idx, 1)
  emit('update', condition.id, { value: { value: current } })
}

function isSetChecked(condition: FilterCondition, optionValue: unknown): boolean {
  const arr = condition.value.value
  if (!Array.isArray(arr)) return false
  return arr.some((v) => String(v) === String(optionValue))
}

function isValueless(op: FilterOperator): boolean {
  return VALUELESS_OPERATORS.has(op)
}

function isRange(op: FilterOperator): boolean {
  return RANGE_OPERATORS.has(op)
}

function inputTypeFor(descriptor: FilterColumnDescriptor | undefined): string {
  switch (descriptor?.filterType) {
    case 'number':
      return 'number'
    case 'date':
      return 'date'
    default:
      return 'text'
  }
}

// --- Drag reorder (same pattern as MrxGroupingDrawer) ---
const dragState = { from: null as number | null }

function onDragStart(index: number, e: DragEvent): void {
  dragState.from = index
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDrop(index: number): void {
  const from = dragState.from
  dragState.from = null
  if (from == null || from === index) return
  emit('reorder', from, index)
}
</script>

<template>
  <div class="mrx-filter-builder">
    <div v-if="!conditions.length" class="mrx-filter-builder__empty">
      No filters yet. Click <strong>Add filter</strong> to build one.
    </div>

    <div
      v-for="(condition, index) in conditions"
      :key="condition.id"
      class="mrx-filter-builder__row"
      draggable="true"
      @dragstart="onDragStart(index, $event)"
      @dragover.prevent
      @drop.prevent="onDrop(index)"
    >
      <!-- Combinator: "Where" for first row, AND/OR picker otherwise -->
      <span v-if="index === 0" class="mrx-filter-builder__where">Where</span>
      <div v-else class="mrx-filter-builder__slot mrx-filter-builder__slot--combinator">
        <MSelect
          :id="`mrx-filter-builder-comb-${condition.id}`"
          size="s"
          :options="COMBINATOR_OPTIONS"
          :model-value="condition.combinator"
          @update:modelValue="(v: string | number) => onCombinatorChange(condition.id, String(v))"
        />
      </div>

      <!-- Field picker -->
      <div class="mrx-filter-builder__slot mrx-filter-builder__slot--field">
        <MSelect
          :id="`mrx-filter-builder-field-${condition.id}`"
          size="s"
          :options="fieldOptions()"
          :model-value="condition.field"
          @update:modelValue="(v: string | number) => onFieldChange(condition.id, String(v))"
        />
      </div>

      <!-- Operator picker — hidden for 'custom' filters, which own their semantics -->
      <div
        v-if="descriptorFor(condition.field)?.filterType !== 'custom'"
        class="mrx-filter-builder__slot mrx-filter-builder__slot--operator"
      >
        <MSelect
          :id="`mrx-filter-builder-op-${condition.id}`"
          size="s"
          :options="operatorOptions(condition.field)"
          :model-value="condition.operator"
          @update:modelValue="(v: string | number) => onOperatorChange(condition.id, String(v))"
        />
      </div>

      <!-- Custom filter component. Receives a single bundled `params` prop
           ({ model, column, filterParams, getValue, onModelChange }); the
           operator picker and value editors are hidden because the
           component covers both. -->
      <component
        v-if="
          descriptorFor(condition.field)?.filterType === 'custom' &&
          descriptorFor(condition.field)?.filter
        "
        :is="descriptorFor(condition.field)!.filter!.component"
        :ref="bindRefFor(condition)"
        class="mrx-filter-builder__custom"
        :params="buildFilterParams(condition)"
      />
      <template v-else-if="!isValueless(condition.operator)">
        <!-- set / multi-select — MCheckbox-per-option -->
        <div
          v-if="descriptorFor(condition.field)?.filterType === 'set'"
          class="mrx-filter-builder__set"
        >
          <MCheckbox
            v-for="opt in descriptorFor(condition.field)?.options ?? []"
            :key="String(opt.value)"
            :id="`mrx-filter-builder-set-${condition.id}-${String(opt.value)}`"
            :model-value="isSetChecked(condition, opt.value)"
            :label="opt.label"
            @update:modelValue="(v: boolean) => onSetToggle(condition, opt.value, v)"
          />
        </div>

        <!-- boolean -->
        <div
          v-else-if="descriptorFor(condition.field)?.filterType === 'boolean'"
          class="mrx-filter-builder__slot mrx-filter-builder__slot--value"
        >
          <MSelect
            :id="`mrx-filter-builder-bool-${condition.id}`"
            size="s"
            :options="BOOLEAN_OPTIONS"
            :model-value="booleanSelectValue(condition)"
            @update:modelValue="(v: string | number) => onBooleanSelect(condition.id, v)"
          />
        </div>

        <!-- range: value + valueTo -->
        <template v-else-if="isRange(condition.operator)">
          <div class="mrx-filter-builder__slot mrx-filter-builder__slot--value">
            <MTextInput
              :id="`mrx-filter-builder-val-${condition.id}`"
              size="s"
              :type="inputTypeFor(descriptorFor(condition.field))"
              :model-value="asString(condition.value.value)"
              placeholder="from"
              @input="(e: Event) => onTextInput(condition.id, e, condition.field)"
            />
          </div>
          <span class="mrx-filter-builder__range-sep">–</span>
          <div class="mrx-filter-builder__slot mrx-filter-builder__slot--value">
            <MTextInput
              :id="`mrx-filter-builder-val-to-${condition.id}`"
              size="s"
              :type="inputTypeFor(descriptorFor(condition.field))"
              :model-value="asString(condition.value.valueTo)"
              placeholder="to"
              @input="(e: Event) => onTextInputTo(condition.id, e, condition.field)"
            />
          </div>
        </template>

        <!-- scalar -->
        <div v-else class="mrx-filter-builder__slot mrx-filter-builder__slot--value">
          <MTextInput
            :id="`mrx-filter-builder-val-${condition.id}`"
            size="s"
            :type="inputTypeFor(descriptorFor(condition.field))"
            :model-value="asString(condition.value.value)"
            placeholder="value"
            @input="(e: Event) => onTextInput(condition.id, e, condition.field)"
          />
        </div>
      </template>

      <MIconButton
        ghost
        size="s"
        class="mrx-filter-builder__remove"
        aria-label="Remove condition"
        @click="emit('remove', condition.id)"
      >
        <template #icon><Trash24 /></template>
      </MIconButton>
    </div>

    <div class="mrx-filter-builder__footer">
      <MButton
        ghost
        size="s"
        appearance="accent"
        iconPosition="left"
        @click="emit('add')"
      >
        <template #icon><ListAdd24 /></template>
        Add condition
      </MButton>
      <MButton
        v-if="conditions.length"
        ghost
        size="s"
        appearance="danger"
        class="mrx-filter-builder__clear"
        @click="emit('clear')"
      >
        Clear all
      </MButton>
    </div>
  </div>
</template>

<style scoped>
.mrx-filter-builder {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: system-ui, -apple-system, sans-serif;
}

.mrx-filter-builder__empty {
  padding: 24px 8px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
}

.mrx-filter-builder__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  cursor: grab;
}

.mrx-filter-builder__row:active {
  cursor: grabbing;
}

.mrx-filter-builder__where {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 4px;
  min-width: 52px;
}

/* Slot widths — let each input area participate in flex layout. */
.mrx-filter-builder__slot {
  display: flex;
  align-items: center;
}

.mrx-filter-builder__slot--combinator {
  flex: 0 0 auto;
  width: 88px;
}

.mrx-filter-builder__slot--field,
.mrx-filter-builder__slot--operator {
  flex: 0 0 auto;
  min-width: 140px;
}

.mrx-filter-builder__slot--value {
  flex: 1 1 160px;
  min-width: 120px;
}

.mrx-filter-builder__slot--value > * {
  flex: 1 1 0;
  min-width: 0;
}

.mrx-filter-builder__custom {
  flex: 1 1 200px;
  min-width: 150px;
}

.mrx-filter-builder__range-sep {
  font-weight: 600;
  color: #64748b;
}

.mrx-filter-builder__set {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  flex: 1 1 200px;
  min-width: 150px;
}

.mrx-filter-builder__remove {
  margin-left: auto;
  flex-shrink: 0;
}

.mrx-filter-builder__footer {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}

.mrx-filter-builder__clear {
  margin-left: auto;
}
</style>
