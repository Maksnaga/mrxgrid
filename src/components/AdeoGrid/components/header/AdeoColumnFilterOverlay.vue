<script setup lang="ts">
/**
 * "Filter in this column" overlay — Sprint 5 (REFONTE-PLAN-V2 §2.4).
 *
 * Notion-style "SHOW ROWS" filter builder anchored on a column header.
 * Manages one or more `Draft` rows locally (one row = one operator/value
 * pair for the column). Live-applies on every change: operator picks
 * commit immediately, free-typed values debounce at 200ms. The host
 * (`AdeoGrid`) routes each emit through the existing filter engine so
 * the FILTERED BY tag bar updates without an explicit "Apply" press.
 *
 * Adding a row appends a new draft anchored to the same column. Removing
 * the last draft closes the overlay.
 */

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MSelect, MTextInput, MIconButton, MButton } from '@mozaic-ds/vue'
import { Trash24, Drag24, ListAdd24 } from '@mozaic-ds/icons-vue'
import type { ColumnDef } from '../../types'
import {
  DEFAULT_OPERATORS,
  DEFAULT_OPERATOR_PER_TYPE,
  OPERATOR_LABELS,
  RANGE_OPERATORS,
  VALUELESS_OPERATORS,
  generateConditionId,
} from '../../models/filter.model'
import type {
  FilterCombinator,
  FilterCondition,
  FilterDataType,
  FilterOperator,
  FilterValue,
} from '../../models/filter.model'

const props = defineProps<{
  /** Field of the column the overlay was opened from — used to seed the
   *  first draft so the user immediately filters that column. */
  field: string
  /** Definition of the column the overlay was opened from. */
  column: ColumnDef
  /** Every column the user is allowed to filter on (`filterable: true`).
   *  Drives the per-row field picker so the user can change which column
   *  a row targets, not just the original one. */
  filterableColumns: ColumnDef[]
  /** Bounding rect of the trigger button — used to position the overlay. */
  triggerRect: DOMRect
  /** Existing condition for this column, if any (edit mode). */
  existing?: FilterCondition | null
}>()

const emit = defineEmits<{
  apply: [condition: FilterCondition]
  remove: [id: string]
  /** Re-order one engine condition relative to another. The host translates
   *  the IDs to engine indices and calls `reorderConditions(from, to)`.
   *  `targetId === null` means "move to the end". Only complete drafts (the
   *  ones registered with the engine) ever appear in this event. */
  reorder: [movedId: string, targetId: string | null]
  cancel: []
}>()

// ---------------------------------------------------------------------------
// Field catalog — populated from the host's `filterableColumns`. The first
// draft is locked to `props.field` (the column the kebab was opened from);
// added rows can target any other filterable column.
// ---------------------------------------------------------------------------

const fieldOptions = computed(() =>
  props.filterableColumns.map((c) => ({
    text: c.headerName ?? c.field,
    value: c.field,
  })),
)

const columnByField = computed(() => {
  const map = new Map<string, ColumnDef>()
  for (const c of props.filterableColumns) map.set(c.field, c)
  // Make sure the originating column is reachable even if the host didn't
  // include it in `filterableColumns` (defensive — shouldn't happen in
  // practice since the kebab only opens for filterable columns).
  if (!map.has(props.field)) map.set(props.field, props.column)
  return map
})

function getColumn(field: string): ColumnDef {
  return columnByField.value.get(field) ?? props.column
}

function getFilterType(field: string): FilterDataType {
  return (getColumn(field).filterType ?? 'text') as FilterDataType
}

function getAllowedOperators(field: string): FilterOperator[] {
  const col = getColumn(field)
  return col.filterOperators ?? DEFAULT_OPERATORS[getFilterType(field)]
}

function getOperatorOptions(field: string) {
  return getAllowedOperators(field).map((op) => ({
    text: OPERATOR_LABELS[op] ?? op,
    value: op,
  }))
}

// `set`/`boolean` filters expose a fixed option list — text/number/date
// fall back to a free-typed input.
function getValueOptions(field: string) {
  const col = getColumn(field)
  const ft = getFilterType(field)
  if (ft === 'set') {
    return (col.filterOptions ?? []).map((o) => ({
      text: o.label,
      value: o.value as string | number,
    }))
  }
  if (ft === 'boolean') {
    return [
      { text: 'True', value: 'true' },
      { text: 'False', value: 'false' },
    ]
  }
  return null
}

function getInputType(field: string): string {
  return getFilterType(field) === 'number' ? 'number' : 'text'
}

// MSelect's `model-value` is typed `string | number`. The `|` token in a
// template expression is parsed as the legacy Vue 2 filter operator
// (deprecated/removed in Vue 3) — so casting inline as
// `draft.value as string | number` triggers a "Filters are deprecated"
// compile warning. Keep the cast in script-land instead.
function selectValue(v: unknown): string | number {
  return (v == null ? '' : v) as string | number
}

// ---------------------------------------------------------------------------
// Drafts — one per condition row currently visible in the overlay.
// ---------------------------------------------------------------------------

interface Draft {
  id: string
  field: string
  operator: FilterOperator
  combinator: FilterCombinator
  value: unknown
  valueTo: unknown
  /**
   * Custom-filter model — captured each time the filter component calls
   * `params.onModelChange(value)`. Carried through to the engine via
   * `condition.model` for evaluation by `col.filter.doesFilterPass`.
   * `null` means "no filter applied".
   */
  model: unknown
}

/**
 * Methods a custom filter component may expose via `defineExpose`. All
 * fields are optional — the grid auto-detects which ones are present
 * (`isFilterActive` overrides the default "model != null" heuristic;
 * `refresh` is called on external model updates; `afterGuiAttached` runs
 * after first mount).
 */
interface FilterInstanceLike {
  isFilterActive?(): boolean
  refresh?(params: unknown): boolean | void
  afterGuiAttached?(params?: { suppressFocus?: boolean }): void
  getModelAsString?(model: unknown): string
}

/** Active instance refs keyed by draft id. */
const instanceRefs = new Map<string, FilterInstanceLike>()
function setInstanceRef(id: string, inst: unknown): void {
  if (inst && typeof inst === 'object') {
    instanceRefs.set(id, inst as FilterInstanceLike)
  } else {
    instanceRefs.delete(id)
  }
}

const COMBINATOR_OPTIONS = [
  { text: 'And', value: 'and' },
  { text: 'Or', value: 'or' },
]

function defaultDraft(seedField: string, seed?: FilterCondition | null): Draft {
  const col = getColumn(seedField)
  return {
    id: seed?.id ?? generateConditionId(),
    field: seedField,
    operator:
      seed?.operator ??
      col.defaultFilterOperator ??
      DEFAULT_OPERATOR_PER_TYPE[getFilterType(seedField)],
    combinator: seed?.combinator ?? 'and',
    value: seed?.value?.value ?? '',
    valueTo: seed?.value?.valueTo ?? '',
    model: seed?.model ?? null,
  }
}

const drafts = ref<Draft[]>([defaultDraft(props.field, props.existing)])

watch(
  () => props.existing,
  (next) => {
    if (next) drafts.value = [defaultDraft(next.field ?? props.field, next)]
  },
)

function isValueless(op: FilterOperator) {
  return VALUELESS_OPERATORS.has(op)
}

function isRange(op: FilterOperator) {
  return RANGE_OPERATORS.has(op)
}

function isDraftComplete(d: Draft): boolean {
  const col = getColumn(d.field)
  const cfg = customFilterFor(col)
  if (cfg) {
    // Custom filter — prefer the instance's `isFilterActive()` when
    // available (lets the consumer say "non-null model is still inactive"
    // for empty arrays / full ranges). Otherwise rely on `model != null`.
    const inst = instanceRefs.get(d.id)
    if (inst?.isFilterActive) return inst.isFilterActive()
    return d.model != null
  }
  if (isValueless(d.operator)) return true
  if (d.value == null || d.value === '') return false
  if (isRange(d.operator) && (d.valueTo == null || d.valueTo === '')) return false
  return true
}

/**
 * Returns `col.filter` when it carries the AG-Grid-style shape
 * (`component` + optional `doesFilterPass`). Returns `undefined` when
 * `col.filter` is the inline FilterDef shape or absent.
 */
function customFilterFor(col: ColumnDef) {
  const f = col.filter
  if (f && 'component' in f) return f
  return undefined
}

// ---------------------------------------------------------------------------
// Live apply — emit a fresh condition whenever a draft becomes complete or
// changes. Free-typed text debounces so the grid doesn't re-filter on every
// keystroke. Operator + select changes commit immediately.
// ---------------------------------------------------------------------------

const TEXT_DEBOUNCE_MS = 200
const textTimers = new Map<string, ReturnType<typeof setTimeout>>()

function buildCondition(d: Draft): FilterCondition {
  const cleanValue: FilterValue = isValueless(d.operator)
    ? {}
    : isRange(d.operator)
      ? { value: d.value, valueTo: d.valueTo }
      : { value: d.value }
  const base: FilterCondition = {
    id: d.id,
    combinator: d.combinator,
    field: d.field,
    operator: d.operator,
    value: cleanValue,
  }
  // Carry the AG-Grid-style opaque model through — the engine reads
  // this on every evaluation, and the drawer round-trips it via
  // `update:filterModel`.
  if (d.model != null) base.model = d.model
  return base
}

function emitApply(d: Draft) {
  if (!isDraftComplete(d)) return
  emit('apply', buildCondition(d))
}

function scheduleTextApply(d: Draft) {
  const existing = textTimers.get(d.id)
  if (existing) clearTimeout(existing)
  textTimers.set(
    d.id,
    setTimeout(() => emitApply(d), TEXT_DEBOUNCE_MS),
  )
}

function onFieldChange(d: Draft, v: string | number) {
  const nextField = String(v)
  if (nextField === d.field) return
  // Drop the row from the engine before re-targeting — its old (field,
  // operator, value) is no longer represented in the overlay.
  if (isDraftComplete(d)) emit('remove', d.id)
  // Switching field invalidates operator + value because the new column's
  // filter type may not support them. Reset to the new column's defaults.
  const col = getColumn(nextField)
  d.field = nextField
  d.operator = col.defaultFilterOperator ?? DEFAULT_OPERATOR_PER_TYPE[getFilterType(nextField)]
  d.value = ''
  d.valueTo = ''
  // Valueless operators commit immediately; value-bearing ones wait for
  // a non-empty value.
  if (isValueless(d.operator)) emitApply(d)
}

function onOperatorChange(d: Draft, v: string | number) {
  d.operator = v as FilterOperator
  // Operator-only ops (`is empty`, `is not empty`) commit immediately;
  // value-bearing operators wait for a non-empty value.
  if (isValueless(d.operator)) emitApply(d)
}

function onCombinatorChange(d: Draft, v: string | number) {
  d.combinator = v as FilterCombinator
  // Re-emit so the engine swaps AND/OR for an already-registered row.
  emitApply(d)
}

function onTextInput(d: Draft, e: Event) {
  const raw = (e.target as HTMLInputElement).value
  d.value = getFilterType(d.field) === 'number' ? (raw === '' ? '' : Number(raw)) : raw
  scheduleTextApply(d)
}

function onTextInputTo(d: Draft, e: Event) {
  const raw = (e.target as HTMLInputElement).value
  d.valueTo = getFilterType(d.field) === 'number' ? (raw === '' ? '' : Number(raw)) : raw
  scheduleTextApply(d)
}

function onValueSelect(d: Draft, v: string | number) {
  d.value = v
  emitApply(d)
}

/**
 * `AdeoFilterParams.onModelChange` — invoked by the filter component each
 * time it announces a new model. Mirrors the model onto the draft, then
 * emits `apply` (still active) or `remove` (cleared). Idempotent: a
 * subsequent `onModelChange(null)` is a safe no-op when nothing was set.
 */
function onModelChange(d: Draft, nextModel: unknown) {
  d.model = nextModel
  if (isDraftComplete(d)) {
    emit('apply', buildCondition(d))
    return
  }
  // No longer active — drop the engine row idempotently.
  emit('remove', d.id)
  d.model = null
}

/**
 * Builds the bundled `params` object passed to the filter component as
 * its single `params` prop. Re-evaluated on each render so the component
 * sees the current model whenever Vue patches it.
 */
function buildFilterParams(d: Draft) {
  const col = getColumn(d.field)
  const cfg = customFilterFor(col)
  return {
    model: d.model,
    column: col,
    filterParams: cfg?.filterParams,
    // At UI time we don't have a row context. Resolvers that need it
    // are used by the engine, where a real row IS available.
    getValue: (_field: string) => undefined as unknown,
    onModelChange: (m: unknown) => onModelChange(d, m),
  }
}

/**
 * Returns a function-ref bound to the given draft. Out-of-template arrow
 * so `noImplicitAny` stays happy without leaking TS annotations into the
 * template (Vue's parser doesn't accept them).
 */
function bindRefFor(d: Draft): (inst: unknown) => void {
  return (inst) => bindAGFilterInstance(d, inst)
}

/**
 * Function-ref handler. Stores the live instance keyed by draft id,
 * calls `refresh?()` to re-hydrate from any persisted model, then fires
 * `afterGuiAttached?()`. The destructor branch (Vue passes `null` on
 * unmount) cleans up the map.
 */
function bindAGFilterInstance(d: Draft, inst: unknown) {
  if (inst == null) {
    instanceRefs.delete(d.id)
    return
  }
  setInstanceRef(d.id, inst)
  const live = instanceRefs.get(d.id)
  if (!live) return
  if (d.model != null) {
    try {
      live.refresh?.(buildFilterParams(d))
    } catch {
      // Defensive — a bad refresh shouldn't break the UI.
    }
  }
  live.afterGuiAttached?.()
}

// ---------------------------------------------------------------------------
// Add / remove rows.
// ---------------------------------------------------------------------------

function onAddCondition() {
  // Seed new rows with the same column the overlay was opened from — the
  // user can then change it via the field picker if they want.
  drafts.value = [...drafts.value, defaultDraft(props.field)]
}

// ---------------------------------------------------------------------------
// Drag-and-drop reorder. The handle (`Drag24`) only sets the cursor — drag
// events live on the whole row so the native HTML5 drag image picks up the
// full chip. Reorder fires on `dragover` for live preview, then commits via
// the `reorder` event so the engine can match the new order.
// ---------------------------------------------------------------------------

const dragFromIndex = ref<number | null>(null)

function onDragStart(index: number, e: DragEvent) {
  dragFromIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // Setting any data is required for Firefox to fire `drop`.
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(index: number, e: DragEvent) {
  if (dragFromIndex.value == null || dragFromIndex.value === index) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDrop(toIndex: number) {
  const fromIndex = dragFromIndex.value
  dragFromIndex.value = null
  if (fromIndex == null || fromIndex === toIndex) return

  const next = [...drafts.value]
  const moved = next[fromIndex]
  if (!moved) return
  next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  drafts.value = next

  // Only emit when the moved row is registered with the engine; in-flight
  // drafts (still empty) have nothing to re-order. Target is the next row
  // in the new order, or `null` when dropped at the end so the engine
  // appends.
  if (!isDraftComplete(moved)) return
  const movedId = moved.id
  const after = next[toIndex + 1]
  const targetId =
    after && isDraftComplete(after) ? after.id : null
  emit('reorder', movedId, targetId)
}

function onDragEnd() {
  dragFromIndex.value = null
}

function onRemoveDraft(d: Draft) {
  // Drop any pending debounce for this row so it doesn't fire post-removal.
  const timer = textTimers.get(d.id)
  if (timer) clearTimeout(timer)
  textTimers.delete(d.id)
  // Forget the AG-Grid-style instance handle (the component will unmount
  // with the row; defensive cleanup in case Vue's ref destructor races).
  instanceRefs.delete(d.id)

  // If the row was registered with the engine (i.e. had a complete value at
  // some point), tell the host to drop it.
  if (isDraftComplete(d)) emit('remove', d.id)

  if (drafts.value.length <= 1) {
    // Removing the only row → close. The host already has zero conditions
    // for this field at this point.
    emit('cancel')
    return
  }

  drafts.value = drafts.value.filter((x) => x !== d)
}

// ---------------------------------------------------------------------------
// Positioning — measure the rendered overlay against the viewport and clamp
// it inside, flipping above the trigger when there isn't enough room below.
// Re-runs on mount, on every `triggerRect` change, and on window resize so
// scrolling / responsive layout doesn't push the panel off-screen.
// ---------------------------------------------------------------------------

const VIEWPORT_PADDING = 8

const position = ref<{ top: number; left: number }>({
  top: props.triggerRect.bottom + 6,
  left: props.triggerRect.right,
})

/**
 * Drag-to-move state. Once the user drags the overlay by its header, we
 * pin the manually-chosen position and stop the auto-reposition logic from
 * fighting it (the user is now in charge).
 */
const userMoved = ref(false)
let _dragStart: { x: number; y: number } | null = null
let _dragOrigin: { top: number; left: number } | null = null

function onHeaderMouseDown(e: MouseEvent) {
  // Ignore clicks on interactive children — only drag from the bare label.
  if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return
  e.preventDefault()
  _dragStart = { x: e.clientX, y: e.clientY }
  _dragOrigin = { top: position.value.top, left: position.value.left }
  userMoved.value = true
  document.addEventListener('mousemove', onHeaderDragMove)
  document.addEventListener('mouseup', onHeaderDragEnd)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'grabbing'
}

function onHeaderDragMove(e: MouseEvent) {
  if (!_dragStart || !_dragOrigin) return
  const overlay = overlayRef.value
  if (!overlay) return
  const overlayRect = overlay.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const dx = e.clientX - _dragStart.x
  const dy = e.clientY - _dragStart.y
  // Clamp to keep the panel inside the viewport — same padding as `reposition`.
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, _dragOrigin.left + dx),
    Math.max(VIEWPORT_PADDING, vw - VIEWPORT_PADDING - overlayRect.width),
  )
  const top = Math.min(
    Math.max(VIEWPORT_PADDING, _dragOrigin.top + dy),
    Math.max(VIEWPORT_PADDING, vh - VIEWPORT_PADDING - overlayRect.height),
  )
  position.value = { top, left }
}

function onHeaderDragEnd() {
  _dragStart = null
  _dragOrigin = null
  document.removeEventListener('mousemove', onHeaderDragMove)
  document.removeEventListener('mouseup', onHeaderDragEnd)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

function reposition() {
  // Once the user dragged the panel by its header, respect their choice and
  // skip the auto-position logic — otherwise a `triggerRect` change (re-render,
  // scroll, etc.) would snap it back next to the kebab.
  if (userMoved.value) return
  const overlay = overlayRef.value
  if (!overlay) return

  const overlayRect = overlay.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Horizontal: align overlay's right edge to trigger's right edge so the
  // panel grows leftwards. Slide right when that overflows the left side;
  // clamp to the viewport when both edges run out of room.
  let left = props.triggerRect.right - overlayRect.width
  if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING
  if (left + overlayRect.width > vw - VIEWPORT_PADDING) {
    left = Math.max(VIEWPORT_PADDING, vw - VIEWPORT_PADDING - overlayRect.width)
  }

  // Vertical: prefer below; flip above when below would overflow AND there's
  // more room above. Final clamp keeps the panel inside the viewport.
  const spaceBelow = vh - props.triggerRect.bottom - VIEWPORT_PADDING
  const spaceAbove = props.triggerRect.top - VIEWPORT_PADDING
  let top = props.triggerRect.bottom + 6
  if (overlayRect.height > spaceBelow && spaceAbove > spaceBelow) {
    top = Math.max(VIEWPORT_PADDING, props.triggerRect.top - overlayRect.height - 6)
  } else if (top + overlayRect.height > vh - VIEWPORT_PADDING) {
    top = Math.max(VIEWPORT_PADDING, vh - VIEWPORT_PADDING - overlayRect.height)
  }

  position.value = { top, left }
}

// ---------------------------------------------------------------------------
// Outside click + Escape close.
// ---------------------------------------------------------------------------

const overlayRef = ref<HTMLElement | null>(null)

function handleClickOutside(e: MouseEvent) {
  if (overlayRef.value && !overlayRef.value.contains(e.target as Node)) {
    emit('cancel')
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('cancel')
}

watch(
  () => props.triggerRect,
  () => nextTick(reposition),
)

// Re-measure when drafts are added/removed (height changes).
watch(() => drafts.value.length, () => nextTick(reposition))

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleKeyDown)
  window.addEventListener('resize', reposition)
  nextTick(reposition)
})

onBeforeUnmount(() => {
  for (const t of textTimers.values()) clearTimeout(t)
  textTimers.clear()
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('resize', reposition)
  // Defensive cleanup in case the overlay unmounts mid-drag.
  document.removeEventListener('mousemove', onHeaderDragMove)
  document.removeEventListener('mouseup', onHeaderDragEnd)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="overlayRef"
      class="mrx-column-filter-overlay"
      :style="{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }"
      role="dialog"
      :aria-label="`Filter ${column.headerName}`"
    >
      <div
        class="mrx-column-filter-overlay__header"
        title="Drag to move"
        @mousedown="onHeaderMouseDown"
      >
        <div class="mrx-column-filter-overlay__title">Filter</div>
        <div class="mrx-column-filter-overlay__subtitle">Show rows</div>
      </div>

      <div
        v-for="(draft, idx) in drafts"
        :key="draft.id"
        class="mrx-column-filter-overlay__row"
        :class="{ 'mrx-column-filter-overlay__row--dragging': dragFromIndex === idx }"
        draggable="true"
        @dragstart="onDragStart(idx, $event)"
        @dragover="onDragOver(idx, $event)"
        @drop.prevent="onDrop(idx)"
        @dragend="onDragEnd"
      >
        <span v-if="idx === 0" class="mrx-column-filter-overlay__where">Where</span>
        <div v-else class="mrx-column-filter-overlay__combinator-slot">
          <MSelect
            :id="`mrx-col-filter-comb-${draft.id}`"
            size="s"
            :options="COMBINATOR_OPTIONS"
            :model-value="draft.combinator"
            @update:modelValue="(v: string | number) => onCombinatorChange(draft, v)"
          />
        </div>

        <div class="mrx-column-filter-overlay__field-slot">
          <MSelect
            :id="`mrx-col-filter-field-${draft.id}`"
            size="s"
            :options="fieldOptions"
            :model-value="draft.field"
            @update:modelValue="(v: string | number) => onFieldChange(draft, v)"
          />
        </div>

        <div
          v-if="!customFilterFor(getColumn(draft.field))"
          class="mrx-column-filter-overlay__operator-slot"
        >
          <MSelect
            :id="`mrx-col-filter-op-${draft.id}`"
            size="s"
            :options="getOperatorOptions(draft.field)"
            :model-value="draft.operator"
            @update:modelValue="(v: string | number) => onOperatorChange(draft, v)"
          />
        </div>

        <!-- Custom filter component — `col.filter = { component, doesFilterPass }`.
             Receives a single bundled `params` prop ({ model, column,
             filterParams, getValue, onModelChange }). The component calls
             `params.onModelChange(newModel)` on user interaction; the
             builder hooks `refresh()` / `afterGuiAttached()` via the ref. -->
        <div
          v-if="customFilterFor(getColumn(draft.field))"
          class="mrx-column-filter-overlay__value-slot"
        >
          <component
            :is="customFilterFor(getColumn(draft.field))!.component"
            :ref="bindRefFor(draft)"
            :params="buildFilterParams(draft)"
          />
        </div>

        <div v-else-if="!isValueless(draft.operator)" class="mrx-column-filter-overlay__value-slot">
          <MSelect
            v-if="getValueOptions(draft.field)"
            :id="`mrx-col-filter-val-${draft.id}`"
            size="s"
            :options="getValueOptions(draft.field)!"
            :model-value="selectValue(draft.value)"
            @update:modelValue="(v: string | number) => onValueSelect(draft, v)"
          />
          <template v-else>
            <MTextInput
              :id="`mrx-col-filter-val-${draft.id}`"
              size="s"
              :type="getInputType(draft.field)"
              :model-value="draft.value == null ? '' : String(draft.value)"
              @input="(e: Event) => onTextInput(draft, e)"
            />
            <MTextInput
              v-if="isRange(draft.operator)"
              :id="`mrx-col-filter-val-to-${draft.id}`"
              size="s"
              :type="getInputType(draft.field)"
              :model-value="draft.valueTo == null ? '' : String(draft.valueTo)"
              @input="(e: Event) => onTextInputTo(draft, e)"
            />
          </template>
        </div>

        <MIconButton
          ghost
          size="s"
          :aria-label="`Remove condition`"
          class="mrx-column-filter-overlay__remove"
          @click="onRemoveDraft(draft)"
        >
          <template #icon><Trash24 /></template>
        </MIconButton>

        <span
          class="mrx-column-filter-overlay__drag-handle"
          aria-hidden="true"
          title="Drag to reorder"
        >
          <Drag24 />
        </span>
      </div>

      <div class="mrx-column-filter-overlay__add-wrapper">
        <MButton
          ghost
          size="s"
          appearance="accent"
          iconPosition="left"
          @click="onAddCondition"
        >
          <template #icon><ListAdd24 /></template>
          Add condition
        </MButton>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.mrx-column-filter-overlay {
  position: fixed;
  z-index: 9999;
  width: min(720px, calc(100vw - 32px));
  background: var(--color-background-primary, #fff);
  border: 1px solid var(--color-border-primary, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  font-family: var(--font-family), system-ui, -apple-system, sans-serif;
  padding: 14px 16px 12px;
}

// Header — "Filter" title + "Show rows" subtitle. Also doubles as the drag
// handle for the whole overlay (see `onHeaderMouseDown`).
.mrx-column-filter-overlay__header {
  margin-bottom: 12px;
  padding-bottom: 4px;
  cursor: grab;
  user-select: none;

  &:active {
    cursor: grabbing;
  }
}

.mrx-column-filter-overlay__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #0f172a);
  line-height: 1.3;
}

.mrx-column-filter-overlay__subtitle {
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-secondary, #64748b);
  line-height: 1.4;
  margin-top: 2px;
}

.mrx-column-filter-overlay__row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  padding: 4px;
}

.mrx-column-filter-overlay__row + .mrx-column-filter-overlay__row {
  margin-top: 4px;
}

.mrx-column-filter-overlay__row--dragging {
  opacity: 0.4;
}

.mrx-column-filter-overlay__where {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary, #475569);
  flex-shrink: 0;
  padding: 0 6px;
  min-width: 50px;
}

.mrx-column-filter-overlay__combinator-slot {
  flex: 0 0 auto;
  width: 88px;
}

.mrx-column-filter-overlay__field-slot,
.mrx-column-filter-overlay__operator-slot {
  flex: 0 0 auto;
  min-width: 140px;
}

.mrx-column-filter-overlay__value-slot {
  flex: 1 1 200px;
  min-width: 160px;
  display: flex;
  gap: 6px;
}

.mrx-column-filter-overlay__value-slot > * {
  flex: 1 1 0;
  min-width: 0;
}

.mrx-column-filter-overlay__remove {
  flex-shrink: 0;
}

.mrx-column-filter-overlay__drag-handle {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--color-text-tertiary, #94a3b8);
  cursor: grab;
  user-select: none;
}

.mrx-column-filter-overlay__drag-handle:hover {
  color: var(--color-text-secondary, #64748b);
}

// Wrapper around the `MButton`-based "Add condition" CTA — just gives it
// the same horizontal indent as the rows above so it lines up under "Where".
.mrx-column-filter-overlay__add-wrapper {
  margin-top: 8px;
  padding: 0 4px;
}
</style>
