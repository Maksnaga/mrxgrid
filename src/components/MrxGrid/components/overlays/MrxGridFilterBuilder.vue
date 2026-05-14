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
import {
  OPERATOR_LABELS,
  RANGE_OPERATORS,
  VALUELESS_OPERATORS,
  type FilterColumnDescriptor,
  type FilterCombinator,
  type FilterCondition,
  type FilterOperator,
} from '../../models/filter.model'

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
      <select
        v-else
        class="mrx-filter-builder__field mrx-filter-builder__field--combinator"
        :value="condition.combinator"
        @change="onCombinatorChange(condition.id, ($event.target as HTMLSelectElement).value)"
      >
        <option value="and">AND</option>
        <option value="or">OR</option>
      </select>

      <!-- Field picker -->
      <select
        class="mrx-filter-builder__field"
        :value="condition.field"
        @change="onFieldChange(condition.id, ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="col in columns" :key="col.field" :value="col.field">
          {{ col.headerName }}
        </option>
      </select>

      <!-- Operator picker -->
      <select
        class="mrx-filter-builder__field mrx-filter-builder__field--operator"
        :value="condition.operator"
        @change="onOperatorChange(condition.id, ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="op in operatorsFor(condition.field)" :key="op" :value="op">
          {{ OPERATOR_LABELS[op] ?? op }}
        </option>
      </select>

      <!-- Value input(s) — shape depends on operator + filter type -->
      <template v-if="!isValueless(condition.operator)">
        <!-- set / multi-select -->
        <div
          v-if="descriptorFor(condition.field)?.filterType === 'set'"
          class="mrx-filter-builder__set"
        >
          <label
            v-for="opt in descriptorFor(condition.field)?.options ?? []"
            :key="String(opt.value)"
            class="mrx-filter-builder__set-option"
          >
            <input
              type="checkbox"
              :checked="isSetChecked(condition, opt.value)"
              @change="
                onSetToggle(
                  condition,
                  opt.value,
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            {{ opt.label }}
          </label>
        </div>

        <!-- boolean -->
        <select
          v-else-if="descriptorFor(condition.field)?.filterType === 'boolean'"
          class="mrx-filter-builder__field"
          :value="condition.value.value === true ? 'true' : condition.value.value === false ? 'false' : ''"
          @change="
            onValueChange(
              condition.id,
              ($event.target as HTMLSelectElement).value === 'true',
            )
          "
        >
          <option value="">—</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>

        <!-- range: value + valueTo -->
        <template v-else-if="isRange(condition.operator)">
          <input
            :type="inputTypeFor(descriptorFor(condition.field))"
            class="mrx-filter-builder__value"
            :value="(condition.value.value as string | number | null) ?? ''"
            placeholder="from"
            @input="onValueChange(condition.id, ($event.target as HTMLInputElement).value)"
          />
          <span class="mrx-filter-builder__range-sep">–</span>
          <input
            :type="inputTypeFor(descriptorFor(condition.field))"
            class="mrx-filter-builder__value"
            :value="(condition.value.valueTo as string | number | null) ?? ''"
            placeholder="to"
            @input="onValueToChange(condition.id, ($event.target as HTMLInputElement).value)"
          />
        </template>

        <!-- scalar -->
        <input
          v-else
          :type="inputTypeFor(descriptorFor(condition.field))"
          class="mrx-filter-builder__value"
          :value="(condition.value.value as string | number | null) ?? ''"
          placeholder="value"
          @input="onValueChange(condition.id, ($event.target as HTMLInputElement).value)"
        />
      </template>

      <button
        type="button"
        class="mrx-filter-builder__remove"
        :aria-label="`Remove condition`"
        @click="emit('remove', condition.id)"
      >
        &times;
      </button>
    </div>

    <div class="mrx-filter-builder__footer">
      <button type="button" class="mrx-filter-builder__add" @click="emit('add')">
        + Add filter
      </button>
      <button
        v-if="conditions.length"
        type="button"
        class="mrx-filter-builder__clear"
        @click="emit('clear')"
      >
        Clear all
      </button>
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

.mrx-filter-builder__field,
.mrx-filter-builder__value {
  padding: 4px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 13px;
  color: #1e293b;
  background: white;
  outline: none;
  box-sizing: border-box;
}

.mrx-filter-builder__field--combinator {
  min-width: 60px;
}

.mrx-filter-builder__field--operator {
  min-width: 120px;
}

.mrx-filter-builder__value {
  flex: 1 1 120px;
  min-width: 80px;
}

.mrx-filter-builder__field:focus,
.mrx-filter-builder__value:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.mrx-filter-builder__range-sep {
  font-weight: 600;
  color: #64748b;
}

.mrx-filter-builder__set {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 4px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  flex: 1 1 200px;
  min-width: 150px;
}

.mrx-filter-builder__set-option {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #1e293b;
  cursor: pointer;
}

.mrx-filter-builder__remove {
  margin-left: auto;
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: #64748b;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.mrx-filter-builder__remove:hover {
  border-color: #e2e8f0;
  color: #dc2626;
}

.mrx-filter-builder__footer {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}

.mrx-filter-builder__add {
  padding: 6px 12px;
  border: 1px dashed #cbd5e1;
  background: white;
  color: #334155;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.mrx-filter-builder__add:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.mrx-filter-builder__clear {
  margin-left: auto;
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #dc2626;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}

.mrx-filter-builder__clear:hover {
  background: #fef2f2;
  border-color: #fecaca;
}
</style>
