<script setup lang="ts">
/**
 * Filter row cell — Sprint 6 (REFONTE-PLAN-V2 §2.5).
 *
 * Single-responsibility cell rendered three times by `MrxGridFilterRow`
 * (left-pinned / center / right-pinned). Resolves the renderer in this
 * priority order:
 *
 *   1. `#filter-{field}` / `<MrxColumn> #filter` slot
 *   2. `column.filterRenderer` Vue component
 *   3. `column.filter` built-in shape (text/select/date) → Mozaic inputs
 *      (`MTextInput` with search icon, `MSelect` for select, `MDatepicker`
 *      paired range for date)
 *
 * Centralising the rendering here removes the ~150 LOC of duplicated
 * branches that previously lived inline in `MrxGridFilterRow.vue`.
 */

import { computed } from 'vue'
import { MTextInput, MSelect, MDatepicker } from '@mozaic-ds/vue'
import { Search24 } from '@mozaic-ds/icons-vue'
import type { ColumnDef } from '../../types'
import { injectMrxGridSlots, resolveFilterSlot } from '../../state/MrxGridSlots'

const props = defineProps<{
  column: ColumnDef
  value: unknown
  /** Debounce timer key — usually the field name. */
  debounceMs?: number
}>()

const emit = defineEmits<{
  /** Debounced — used for free-typed text input. */
  input: [value: unknown]
  /** Immediate — used for select / date / explicit clears. */
  commit: [value: unknown]
}>()

const _gridSlots = injectMrxGridSlots()
const slot = computed(() => resolveFilterSlot(_gridSlots, props.column.field))

const selectOptions = computed(() => {
  const opts = props.column.filter?.options ?? []
  return opts.map((o) => ({ text: o.label, value: o.value as string | number }))
})

// `MSelect` requires a value-less placeholder option to render the "All"
// reset entry, so prepend one when the column declares a placeholder.
const selectOptionsWithPlaceholder = computed(() => {
  const placeholder = props.column.filter?.placeholder ?? 'All'
  return [{ text: placeholder, value: '' }, ...selectOptions.value]
})

const dateRange = computed<{ from: string; to: string }>(() => {
  const v = props.value as { from?: string | null; to?: string | null } | null
  return { from: v?.from ?? '', to: v?.to ?? '' }
})

function onTextInput(e: Event) {
  emit('input', (e.target as HTMLInputElement).value)
}

function onSelectChange(v: string | number) {
  emit('commit', v === '' ? null : v)
}

function onDateFrom(v: string | number) {
  emit('commit', { from: v === '' ? null : String(v), to: dateRange.value.to || null })
}

function onDateTo(v: string | number) {
  emit('commit', { from: dateRange.value.from || null, to: v === '' ? null : String(v) })
}
</script>

<template>
  <!-- 1. User-provided slot wins. -->
  <component
    v-if="slot"
    :is="slot"
    :column="column"
    :value="value"
    :set-value="(v: unknown) => emit('commit', v)"
    :clear="() => emit('commit', null)"
  />

  <!-- 2. `column.filterRenderer` Vue component. -->
  <component
    v-else-if="column.filterRenderer"
    :is="column.filterRenderer"
    :column="column"
    :value="value"
    :set-value="(v: unknown) => emit('commit', v)"
    :clear="() => emit('commit', null)"
  />

  <!-- 3. Built-in Mozaic inputs based on `column.filter.type`. -->
  <template v-else-if="column.filter">
    <!-- Text — MTextInput with leading search icon (search inputType pairs
         with the icon slot to render the magnifier inside the field). -->
    <MTextInput
      v-if="column.filter.type === 'text'"
      :id="`mrx-filter-${column.field}`"
      size="s"
      input-type="search"
      :placeholder="column.filter.placeholder ?? 'Filter...'"
      :model-value="value == null ? '' : String(value)"
      @input="onTextInput"
    >
      <template #icon><Search24 /></template>
    </MTextInput>

    <!-- Select — MSelect with placeholder "All" entry. -->
    <MSelect
      v-else-if="column.filter.type === 'select'"
      :id="`mrx-filter-${column.field}`"
      size="s"
      :options="selectOptionsWithPlaceholder"
      :model-value="(value as string | number) ?? ''"
      @update:modelValue="onSelectChange"
    />

    <!-- Date range — paired MDatepickers. -->
    <div v-else-if="column.filter.type === 'date'" class="mrx-filter-cell__date-range">
      <MDatepicker
        :id="`mrx-filter-${column.field}-from`"
        size="s"
        :model-value="dateRange.from"
        @update:modelValue="onDateFrom"
      />
      <MDatepicker
        :id="`mrx-filter-${column.field}-to`"
        size="s"
        :model-value="dateRange.to"
        @update:modelValue="onDateTo"
      />
    </div>

    <!-- Custom component name (legacy escape hatch). -->
    <component
      v-else
      :is="column.filter.type"
      :model-value="value"
      :field="column.field"
      :column="column"
      @update:model-value="(v: unknown) => emit('commit', v)"
    />
  </template>
</template>

<style scoped lang="scss">
.mrx-filter-cell__date-range {
  display: flex;
  gap: m.get-spacing('050');
  width: 100%;
}
</style>
