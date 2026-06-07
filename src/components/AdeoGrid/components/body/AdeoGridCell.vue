<script setup lang="ts">
import {
  computed,
  defineComponent,
  ref,
  watch,
  watchEffect,
  nextTick,
  type Component,
  type Slot,
} from 'vue'
import { Danger24 } from '@mozaic-ds/icons-vue'
import { MSelect, MTooltip } from '@mozaic-ds/vue'
import type { ColumnDef, RowData } from '../../types'
import { injectAdeoGridSlots, resolveCellSlot, resolveEditSlot } from '../../state/AdeoGridSlots'
import { BUILTIN_RENDERERS, type BuiltinRendererName } from '../../features/renderers/builtin'
import AdeoGridFormulaEditor from './AdeoGridFormulaEditor.vue'

/**
 * `<SlotInvoker>` — functional wrapper qui invoque une `Slot` (resolved
 * depuis l'inject de slots du grid) avec un `scope` arbitraire en argument.
 *
 * Pourquoi pas `<component :is="slotFn" :a="x" :b="y">` ? Le pattern par
 * `:is` traite la slot fn comme un functional component : Vue normalise
 * les attrs en kebab/camel et perd la trace de certaines clés selon
 * comment le compilateur les a annotées. Concrètement les scope props
 * comme `:update-value` arrivaient `undefined` côté `<template #edit-foo
 * ="slotProps">` parce que `slotProps.updateValue` était jamais set.
 *
 * Avec ce wrapper on passe le scope **comme un seul objet** à la slot fn
 * (signature naturelle `slot(scope)`), ce qui matche exactement ce que
 * fait `<slot :a="x" :b="y">` côté templating standard.
 */
const SlotInvoker = defineComponent<{
  slotFn: Slot
  scope: Record<string, unknown>
}>(
  (props) => () => props.slotFn(props.scope),
  { props: ['slotFn', 'scope'], inheritAttrs: false },
)

const props = defineProps<{
  value: unknown
  row: RowData
  field: string
  rowIndex: number
  column: ColumnDef
  active?: boolean
  editing?: boolean
  editValue?: unknown
  selected?: boolean
  edgeTop?: boolean
  edgeBottom?: boolean
  edgeLeft?: boolean
  edgeRight?: boolean
  fillHandle?: boolean
  fillTarget?: boolean
  /** Cell is in the fill-target range but its column refuses the write —
   *  rendered as a red dashed outline so the user knows it'll be skipped. */
  fillTargetInvalid?: boolean
  invalid?: boolean
  invalidMessage?: string
  /** True when the cell is inside a pending Ctrl+X cut range. */
  cutSource?: boolean
  cutEdgeTop?: boolean
  cutEdgeBottom?: boolean
  cutEdgeLeft?: boolean
  cutEdgeRight?: boolean
  /** True when an async mutation is in-flight for this (row, field). */
  pending?: boolean
}>()

const emit = defineEmits<{
  activate: [e: MouseEvent]
  editStart: []
  editInput: [value: unknown]
  editCommit: [direction: 'down' | 'right' | 'left' | 'stay']
  editCancel: []
  editBlur: []
  fillHandleMousedown: [e: MouseEvent]
}>()

// --- Slot resolution (Phase 3.3) ---
// Per-field slots from <AdeoGrid> root, or <AdeoColumn>-attached slots, are
// resolved dynamically via the injected `AdeoGridSlots` context. The local
// default slot (passed by AdeoGridRow) wins when present — that's how the
// row forwards explicit overrides, and is the path used in tests today.
const _gridSlots = injectAdeoGridSlots()
const resolvedCellSlot = computed(() => resolveCellSlot(_gridSlots, props.field))
const resolvedEditSlot = computed(() => resolveEditSlot(_gridSlots, props.field))

// --- Renderer ---

// Sprint 1 — Mozaic select editor options. The `cellEditorOptions` shape
// is `{ label, value }` (Vue convention); MSelect expects `{ text, value }`.
const selectOptions = computed(() => {
  const opts = props.column.cellEditorOptions ?? []
  return opts.map((o) => ({
    text: String(o.label ?? o.value),
    value: o.value as string | number,
  }))
})

// Sprint 4 — resolve `renderer` to a Component:
//   - null / undefined / 'text' → plain text path (no custom renderer)
//   - string in BUILTIN_RENDERERS  → built-in alias (e.g. 'tag' → MTag wrapper)
//   - Component                    → consumer-provided renderer
// Unknown strings fall back to the text path so a typo doesn't crash the cell.
const rendererComponent = computed<Component | null>(() => {
  const r = props.column.renderer
  if (r == null || r === 'text') return null
  if (typeof r === 'string') return BUILTIN_RENDERERS[r as BuiltinRendererName] ?? null
  return r as Component
})

const isCustomRenderer = computed(() => rendererComponent.value != null)

const rendererProps = computed(() => {
  if (!isCustomRenderer.value) return null
  return {
    value: props.value,
    row: props.row,
    field: props.field,
    rowIndex: props.rowIndex,
    column: props.column,
    ...props.column.rendererProps,
  }
})

/**
 * Ref-highlight CSS colour for this cell. Set whenever a formula is being
 * edited and this cell is referenced in the draft. Powers the
 * `--ref-highlight` border via the `--moz-grid-ref-color` CSS variable.
 */
const refHighlightColor = computed<string | undefined>(() => {
  const rh = _gridSlots?.refHighlight
  if (!rh || !rh.isActive.value) return undefined
  const rowId = _gridSlots?.resolveRowId?.(props.rowIndex)
  if (rowId === undefined) return undefined
  return rh.colorByCell.value.get(`${rowId}|${props.field}`)
})

/** True while this cell's column is being drag-reordered — drives the
 *  `--moving` dim class. Reactive read of `slot.movingField` so the
 *  class applies/removes in the same render cycle as the column reorder
 *  itself (no JS-side classList toggling, no flicker). */
const isMovingColumn = computed(() => _gridSlots?.movingField?.value === props.field)

/**
 * Formula-aware display value. When `column.allowFormula` and a formula is
 * registered for `(rowId, field)`, render the evaluated `FormulaValue`
 * instead of the raw `=…` source string. The engine's `values` ref is
 * reactive so this stays in sync with dependencies changing upstream.
 */
const formulaDisplayValue = computed(() => {
  if (!props.column.allowFormula || !_gridSlots?.formula) return undefined
  const rowId = _gridSlots.resolveRowId?.(props.rowIndex)
  if (rowId === undefined) return undefined
  const fv = _gridSlots.formula.valueAt({ rowId, field: props.field })
  if (!fv) return undefined
  if (fv.kind === 'error') return fv.error
  if (fv.kind === 'empty') return ''
  return fv.value
})

/** Error code (`#REF!`, `#DIV/0!`, …) when the cell holds a formula whose
 *  evaluation failed. Drives the `.mrx-grid-cell--formula-error` class so
 *  the value renders in red with a hover tooltip explaining the cause. */
const formulaError = computed<string | null>(() => {
  if (!props.column.allowFormula || !_gridSlots?.formula) return null
  const rowId = _gridSlots.resolveRowId?.(props.rowIndex)
  if (rowId === undefined) return null
  const fv = _gridSlots.formula.valueAt({ rowId, field: props.field })
  return fv?.kind === 'error' ? fv.error : null
})

const FORMULA_ERROR_MESSAGES: Record<string, string> = {
  '#DIV/0!': 'Division par zéro.',
  '#VALUE!': "Type de valeur incompatible avec l'opération.",
  '#REF!': 'Référence vers une cellule qui n’existe plus.',
  '#NAME?': 'Nom de fonction ou de plage inconnu.',
  '#NUM!': 'Nombre invalide ou hors plage.',
  '#N/A': 'Valeur non disponible.',
  '#CYCLE!': 'Référence circulaire détectée entre cellules.',
  '#PARSE!': 'Formule incomplète ou syntaxe invalide.',
}
const formulaErrorMessage = computed(() => {
  const code = formulaError.value
  if (!code) return ''
  return FORMULA_ERROR_MESSAGES[code] ?? 'Erreur de formule.'
})

/** Memoized text display — avoids toString work on every render cycle. */
const displayText = computed(() => {
  if (isCustomRenderer.value) return ''
  const formulaValue = formulaDisplayValue.value
  const v = formulaValue !== undefined ? formulaValue : props.value
  return v == null ? '' : String(v)
})

// --- Built-in text editor fallback ---

const editInputRef = ref<HTMLInputElement | null>(null)
const cellContentRef = ref<HTMLElement | null>(null)

/**
 * Local value that drives the DOM <input>.
 *
 * Using a local ref instead of binding `:value="editValue"` directly
 * avoids cursor-position resets: the prop round-trip (input → emit →
 * composable → prop) is async, but the local ref updates synchronously
 * so the browser's caret never jumps.
 *
 * The prop is only used to *seed* the local value when editing starts
 * or when the cell remounts during an active edit (virtualization).
 */
const localEditValue = ref('')

watch(
  () => props.editing,
  (isEditing) => {
    if (isEditing) {
      const v = props.editValue
      localEditValue.value = v == null ? '' : String(v)
      nextTick(() => {
        // Built-in fallback input
        const input = editInputRef.value
        if (input) {
          input.focus()
          if (localEditValue.value.length > 1) {
            if (input.type === 'number') {
              // select() throws InvalidStateError for type="number" in all browsers.
              // Temporarily switch to text so select() works, then restore.
              input.type = 'text'
              input.select()
              input.type = 'number'
            } else {
              input.select()
            }
          }
          return
        }
        // Slot content — focus the first focusable element.
        // Only focus, never click: clicking would toggle components like
        // comboboxes that are already in their default (closed) state,
        // and a second user click would toggle them shut instead of open.
        const el = cellContentRef.value
        if (!el) return
        const focusable = el.querySelector<HTMLElement>(
          'input, button, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        focusable?.focus()
      })
    }
  },
  { immediate: true },
)

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  localEditValue.value = raw
  let value: unknown = raw
  if (props.column.cellEditor === 'number' && raw !== '') {
    value = Number(raw)
  }
  emit('editInput', value)
}

function onFormulaEditorInput(value: string) {
  localEditValue.value = value
  emit('editInput', value)
}

const formulaFieldOrder = computed<readonly string[]>(
  () => _gridSlots?.formulaActions?.fieldOrder?.() ?? [],
)
const formulaColorFor = computed(() => _gridSlots?.formulaActions?.colorFor)

// External updates to `editValue` (e.g. when click-to-pick inserts a ref
// into the formula editor) must propagate into our local cache so the
// next user keystroke builds on the picked value, not the stale one.
watch(
  () => props.editValue,
  (v) => {
    if (!props.editing) return
    const next = v == null ? '' : String(v)
    if (localEditValue.value !== next) localEditValue.value = next
  },
)

// ─── Formula pick mode (click-to-insert ref / drag-to-insert range) ──────
// While a formula cell is being edited, every other cell intercepts its
// mousedown/mouseenter so the click inserts an A1 ref into the formula
// editor instead of activating the cell. Drag extends the ref into a range.
function buildCellAddress(): { rowId: string | number; field: string } | null {
  const rowId = _gridSlots?.resolveRowId?.(props.rowIndex)
  if (rowId === undefined) return null
  return { rowId, field: props.field }
}

function inPickMode(): boolean {
  const rh = _gridSlots?.refHighlight
  return !!rh?.isPickMode.value
}

function onCellMouseDown(e: MouseEvent) {
  const rh = _gridSlots?.refHighlight
  if (rh && inPickMode() && !props.editing) {
    const addr = buildCellAddress()
    if (addr) {
      e.preventDefault()
      e.stopPropagation()
      // Shift+click locks the ref as absolute (`$A$1`). Plain click stays
      // relative — formulas survive sort / row insertion via long-form
      // storage regardless.
      rh.pickRangeStart(addr, { absolute: e.shiftKey })
      // Global mouseup commits the range and clears the drag-anchor.
      const onUp = () => {
        rh.pickRangeCommit()
        document.removeEventListener('mouseup', onUp, true)
      }
      document.addEventListener('mouseup', onUp, true)
    }
    return
  }
  emit('activate', e)
}

function onCellMouseEnter() {
  const rh = _gridSlots?.refHighlight
  if (!rh || !rh.isPickDragging.value) return
  const addr = buildCellAddress()
  if (addr) rh.pickRangeExtend(addr)
}

// Click-outside commit. Mozaic's `MSelect` doesn't expose a `blur`/`close`
// event, so a user who opens the dropdown and clicks elsewhere stays
// stuck in edit mode forever. Watching `mousedown` on the document while
// editing covers every editor type (text, select, date, custom slot) —
// when the click target is neither inside the cell nor inside a known
// Mozaic portaled overlay (select dropdown, datepicker calendar), we
// flush the edit. The native `@blur` on the text/date inputs still
// fires; `flushEdit` is idempotent.
const MOZAIC_OVERLAY_SELECTORS =
  '.mc-select__dropdown, .mc-select__menu, .mc-datepicker__calendar, [role="listbox"]'

function isInsideCellOrOverlay(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null
  if (!node) return false
  const cell = cellContentRef.value
  if (cell && cell.contains(node)) return true
  // Other cells reachable while formula pick mode is active — clicking them
  // inserts a ref into the editor, NOT a blur. Without this exception the
  // click-outside watchdog fires editBlur and the editor exits before the
  // pick handler runs.
  if (_gridSlots?.refHighlight?.isPickMode.value && node.closest?.('.mrx-grid-cell')) {
    return true
  }
  return !!node.closest?.(MOZAIC_OVERLAY_SELECTORS)
}

watchEffect((onCleanup) => {
  if (!props.editing) return
  function onDocMouseDown(e: MouseEvent) {
    if (!isInsideCellOrOverlay(e.target)) emit('editBlur')
  }
  // Use the capture phase so we react before any stopPropagation upstream.
  document.addEventListener('mousedown', onDocMouseDown, true)
  onCleanup(() => document.removeEventListener('mousedown', onDocMouseDown, true))
})

/**
 * Whether the cell was in editing mode when the current keydown event
 * started. Captured in the capture phase so it's set BEFORE slot handlers
 * fire — slot commit/cancel may synchronously flip `editing` to false
 * before the event bubbles back to the cell div.
 */
let wasEditingOnKeydown = false

function onCellKeydownCapture() {
  wasEditingOnKeydown = !!props.editing
}

function onCellKeydown(e: KeyboardEvent) {
  if (wasEditingOnKeydown) {
    e.stopPropagation()
  }
  wasEditingOnKeydown = false
}

// --- Validation tooltip ---
// `MTooltip` paints its popover as an absolutely-positioned sibling of the
// trigger. The cell normally has `overflow: hidden` + `contain: paint`,
// which clip that popover (the only reason it appears in edit mode is that
// `.mrx-grid-cell--editing` sets `overflow: visible` + drops `paint`).
// We mirror that escape on `.mrx-grid-cell--invalid` so the tooltip is
// visible on hover whether or not the cell is being edited.
const tooltipId = computed(() => `mrx-cell-error-${props.field}-${props.rowIndex}`)

function onEditKeydown(e: KeyboardEvent) {
  // F4 cycles the ref token at the caret: A1 → $A$1 → A$1 → $A1 → A1.
  // Active only on formula columns ; the slot context exposes the helper
  // that owns tokenization + cursor restoration.
  if (e.key === 'F4' && props.column.allowFormula) {
    const action = _gridSlots?.formulaActions?.cycleAbsoluteAtCursor
    if (action) {
      e.preventDefault()
      e.stopPropagation()
      const target = e.target as HTMLInputElement | null
      action(target?.selectionStart ?? null)
      return
    }
  }
  switch (e.key) {
    case 'Enter':
      e.preventDefault()
      emit('editCommit', 'down')
      break
    case 'Tab':
      e.preventDefault()
      emit('editCommit', e.shiftKey ? 'left' : 'right')
      break
    case 'Escape':
      e.preventDefault()
      emit('editCancel')
      break
  }
}
</script>

<template>
  <div
    class="mrx-grid-cell"
    :class="{
      'mrx-grid-cell--active': active,
      'mrx-grid-cell--editing': editing,
      'mrx-grid-cell--selected': selected,
      'mrx-grid-cell--edge-top': edgeTop,
      'mrx-grid-cell--edge-bottom': edgeBottom,
      'mrx-grid-cell--edge-left': edgeLeft,
      'mrx-grid-cell--edge-right': edgeRight,
      'mrx-grid-cell--fill-target': fillTarget,
      'mrx-grid-cell--fill-target-invalid': fillTargetInvalid,
      'mrx-grid-cell--invalid': invalid,
      'mrx-grid-cell--formula-error': !!formulaError,
      'mrx-grid-cell--cut': cutSource,
      'mrx-grid-cell--ref-highlight': refHighlightColor,
      'mrx-grid-cell--moving': isMovingColumn,
      'mrx-grid-cell--pending': pending,
    }"
    :style="refHighlightColor ? { '--moz-grid-ref-color': refHighlightColor } : undefined"
    ref="cellContentRef"
    role="gridcell"
    :data-field="field"
    :title="formulaError ? formulaErrorMessage : undefined"
    @mousedown="onCellMouseDown"
    @mouseenter="onCellMouseEnter"
    @dblclick="column.editable ? emit('editStart') : undefined"
    @keydown.capture="onCellKeydownCapture"
    @keydown="onCellKeydown"
  >
    <!-- Slot resolution (most specific → least specific):
         1. Local <slot> override (forwarded explicitly by AdeoGridRow)
         2. <AdeoColumn> #cell slot, or <AdeoGrid> #cell-{field} slot
         3. <AdeoGrid> #cell generic slot
         4. column.renderer
         5. column.valueFormatter / String(value)
    -->
    <slot
      :value="value"
      :row="row"
      :field="field"
      :row-index="rowIndex"
      :column="column"
      :active="active"
      :editing="editing"
      :edit-value="editValue"
      :start-edit="() => emit('editStart')"
      :update-value="(v: unknown) => emit('editInput', v)"
      :commit="(dir?: 'down' | 'right' | 'left' | 'stay') => emit('editCommit', dir ?? 'down')"
      :cancel="() => emit('editCancel')"
    >
      <!-- Editing mode — try `#edit-{field}` first, then `#edit`, then text input. -->
      <template v-if="editing">
        <!-- 1. User-provided edit slot wins. `SlotInvoker` passe le scope
             en un seul objet à la slot fn — voir le commentaire sur la
             definition pour pourquoi `<component :is>` direct ne marchait
             pas (kebab/camel mismatch). Le scope expose `setValue` ET
             `updateValue` comme alias pour matcher les deux conventions
             documentées dans les stories. -->
        <SlotInvoker
          v-if="resolvedEditSlot"
          :slot-fn="resolvedEditSlot"
          :scope="{
            value,
            row,
            field,
            rowIndex,
            column,
            editValue,
            updateValue: (v: unknown) => emit('editInput', v),
            setValue: (v: unknown) => emit('editInput', v),
            commit: (dir?: 'down' | 'right' | 'left' | 'stay') => emit('editCommit', dir ?? 'down'),
            cancel: () => emit('editCancel'),
          }"
        />
        <!-- 2. Mozaic select editor (Sprint 1 — REFONTE-PLAN-V2 §2.7) -->
        <MSelect
          v-else-if="column.cellEditor === 'select'"
          :id="`mrx-cell-select-${field}-${rowIndex}`"
          :options="selectOptions"
          :model-value="(localEditValue as string | number | undefined) ?? ''"
          size="s"
          class="mrx-grid-cell__editor-select"
          @update:modelValue="
            (v: string | number) => {
              onInput({ target: { value: v } } as unknown as Event)
              emit('editCommit', 'down')
            }
          "
        />
        <!-- 3. Date editor — native `<input type="date">`.
             Note historique : on a tenté MDatepicker Mozaic ici (cf. branch
             commentée), mais inline-cell il a un bug de rendu (les
             pseudo-éléments `::-webkit-datetime-edit-*` se stackent
             verticalement à cause de `display: flex` sur l'input + padding
             hérité de `.mc-text-input__control`). Le `<input type="date">`
             natif marche directement, montre la valeur dans le format
             locale du browser, et ouvre le picker calendrier system au
             clic sur l'icône. Même classe `.mrx-grid-cell__input` que le
             text/number fallback pour un styling consistent (inset 0,
             fond transparent, sans bordure double). -->
        <input
          v-else-if="column.cellEditor === 'date'"
          ref="editInputRef"
          class="mrx-grid-cell__input"
          type="date"
          :value="localEditValue"
          @input="onInput"
          @change="onInput"
          @keydown="onEditKeydown"
          @blur="emit('editBlur')"
        />
        <!-- 4. Spreadsheet-style editor for formula columns -->
        <AdeoGridFormulaEditor
          v-else-if="column.allowFormula"
          :model-value="(localEditValue as string) ?? ''"
          :field-order="formulaFieldOrder"
          :color-for="formulaColorFor"
          @update:model-value="onFormulaEditorInput"
          @keydown="onEditKeydown"
          @blur="emit('editBlur')"
        />
        <!-- 5. Built-in plain text input -->
        <input
          v-else
          ref="editInputRef"
          class="mrx-grid-cell__input"
          :type="column.cellEditor === 'number' ? 'number' : 'text'"
          :value="localEditValue"
          @input="onInput"
          @keydown.stop="onEditKeydown"
          @blur="emit('editBlur')"
        />
      </template>

      <!-- Display mode — try injected per-field / generic slot, then renderer, then text. -->
      <template v-else>
        <!-- Même fix que pour l'edit slot : `SlotInvoker` passe le scope
             entier à la slot fn pour éviter la perte de clés par le
             `<component :is>` direct. -->
        <SlotInvoker
          v-if="resolvedCellSlot"
          :slot-fn="resolvedCellSlot"
          :scope="{
            value,
            row,
            field,
            rowIndex,
            column,
            active,
            editing,
          }"
        />
        <component v-else-if="rendererComponent" :is="rendererComponent" v-bind="rendererProps!" />
        <!-- Wrap raw text in a span so `text-overflow: ellipsis` actually
             applies. The cell is `display: flex` (for vertical centering),
             which would otherwise turn this text into an anonymous flex
             item — text-overflow only works on real block / inline-block
             boxes, so without the wrapper long values get hard-clipped
             at the cell edge with no "…" indicator. -->
        <span v-else class="mrx-grid-cell__text">{{ displayText }}</span>
      </template>
    </slot>

    <!-- Fill handle: small square at bottom-right corner of selection.
         Only shown on editable columns — non-editable cells can't accept
         the fill so the affordance is hidden to avoid misleading users. -->
    <div
      v-if="fillHandle && column.editable"
      class="mrx-grid-cell__fill-handle"
      @mousedown="emit('fillHandleMousedown', $event)"
    />

    <!-- Marching-ants outline: each cell paints only the edges that face
         outward — the union forms the animated dashed rectangle around
         the cut region (Excel-style). -->
    <template v-if="cutSource">
      <div
        v-if="cutEdgeTop"
        class="mrx-grid-cell__cut-mark mrx-grid-cell__cut-mark--top"
        aria-hidden="true"
      />
      <div
        v-if="cutEdgeBottom"
        class="mrx-grid-cell__cut-mark mrx-grid-cell__cut-mark--bottom"
        aria-hidden="true"
      />
      <div
        v-if="cutEdgeLeft"
        class="mrx-grid-cell__cut-mark mrx-grid-cell__cut-mark--left"
        aria-hidden="true"
      />
      <div
        v-if="cutEdgeRight"
        class="mrx-grid-cell__cut-mark mrx-grid-cell__cut-mark--right"
        aria-hidden="true"
      />
    </template>

    <!-- Validation error icon — MTooltip provides the message on hover. -->
    <MTooltip
      v-if="invalid && invalidMessage"
      :id="tooltipId"
      :text="invalidMessage"
      position="top"
      class="mrx-grid-cell__error-wrapper"
    >
      <Danger24 color="var(--color-status-icon-error)" />
    </MTooltip>
  </div>
</template>

<style scoped lang="scss">
.mrx-grid-cell {
  padding: m.get-spacing('100') m.get-spacing('150');
  border-bottom: m.get-token('border-width', 's') solid var(--color-border-primary);
  border-right: m.get-token('border-width', 's') solid var(--color-border-primary);
  font-size: m.get-font-size('100');
  color: var(--color-text-primary);
  cursor: pointer;
  // Multi-line wrap so values longer than the column width go to the
  // next line. `overflow: hidden` still clips anything past the row's
  // (fixed) virtual-scroll height to keep row positions stable.
  white-space: normal;
  word-break: break-word;
  overflow: hidden;
  position: relative;
  contain: layout style paint;
  box-sizing: border-box;
  flex-shrink: 0;
  // Vertically center cell content (text, renderers, custom slots) so the
  // display state matches the editing state. Editing input is positioned
  // absolutely with `inset: 0`, so `display: flex` doesn't affect it.
  display: flex;
  align-items: center;
}

// Pinned columns at the grid extremity carry no border on their outer
// edge — the table boundary itself is the visual separator.
.mrx-grid-cell.mrx-grid-cell--pinned-row-end {
  border-right: none;
}

.mrx-grid-cell.mrx-grid-cell--pinned-row-start {
  border-left: none;
}

// Text wrapper for the default (string) renderer. Lives as a real
// inline-block flex item so `text-overflow: ellipsis` produces a "…"
// when the value exceeds the cell's declared width. `min-width: 0`
// is required to let the flex item shrink below its content's
// intrinsic size — without it the item refuses to shrink and overflow
// hidden hard-clips the last character with no ellipsis.
.mrx-grid-cell__text {
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// Last unpinned cell when the row is wider than the sum of its declared
// column widths (small dataset / few columns). The CSS class wins over
// inline-style fall-through merging, which can drop `flex: 1 1 auto`
// when the child also binds its own `:style`. The cell row sets
// `min-width: declaredWidth` inline so the column never shrinks below
// its configured size.
//
// `flex-basis: 0` (not `auto`) is critical. With `auto` the basis falls
// back to the cell's content-intrinsic width — so a row with a value
// wider than `declaredWidth` makes the fill cell expand to fit, which
// (a) skips the ellipsis clipping that `overflow: hidden + text-overflow`
// would normally apply and (b) pushes the row's width past the body's
// `gridContentWidth`, growing `scrollWidth` and creating a white zone
// to the right of all OTHER rows that don't have such long content.
// With `flex-basis: 0` the cell starts at zero, then `min-width` clamps
// it to `declaredWidth` and `flex-grow: 1` distributes extra row space.
// Content over `declaredWidth` is clipped with ellipsis as expected.
.mrx-grid-cell--fill {
  flex: 1 1 0;
}

.mrx-grid-cell--active {
  z-index: 1;
}

.mrx-grid-cell--active::after {
  content: '';
  position: absolute;
  inset: 0;
  border: m.get-token('border-width', 'm') solid var(--color-text-accent);
  border-radius: 4px;
  pointer-events: none;
}

// When the active cell is also part of a selected range, the range edges
// already draw the accent border around the rectangle. Suppress the
// per-cell active ring to avoid a doubled outline on the anchor cell.
.mrx-grid-cell--active.mrx-grid-cell--selected::after {
  display: none;
}

// Exception: a 1×1 selection (the cell carries all four edge classes) is
// just a single-cell focus. The strip box-shadows can't render rounded
// corners, so swap them off and re-enable the rounded `::after` outline
// so the focus ring keeps its 4px radius.
.mrx-grid-cell--active.mrx-grid-cell--selected.mrx-grid-cell--edge-top.mrx-grid-cell--edge-bottom.mrx-grid-cell--edge-left.mrx-grid-cell--edge-right {
  --mrx-range-edge-top: 0 0 0 0 transparent;
  --mrx-range-edge-bottom: 0 0 0 0 transparent;
  --mrx-range-edge-left: 0 0 0 0 transparent;
  --mrx-range-edge-right: 0 0 0 0 transparent;
}

.mrx-grid-cell--active.mrx-grid-cell--selected.mrx-grid-cell--edge-top.mrx-grid-cell--edge-bottom.mrx-grid-cell--edge-left.mrx-grid-cell--edge-right::after {
  display: revert;
}

.mrx-grid-cell--selected {
  background-color: var(--color-background-accent);
}

// AG-Grid-style range outline: a single thick accent border drawn around
// the selected rectangle via four `inset box-shadow` segments. Each edge
// class flips the matching CSS variable from "transparent" to a solid
// accent line, so a cell on a corner draws two segments and a cell in
// the middle draws none.
//
// The 5th slot (`--mrx-cell-outer-shadow`) is reserved for cell-level
// outer shadows (set by `.mrx-grid-cell--pinned-left-edge` /
// `--pinned-right-edge` in `AdeoGridRow.vue`). Composing all five in a
// single `box-shadow` declaration is what lets the pinned drop-shadow
// and the selection range outline coexist — declaring them in separate
// rules used to clobber each other.
.mrx-grid-cell--selected,
.mrx-grid-cell--pinned-left-edge,
.mrx-grid-cell--pinned-right-edge {
  --mrx-range-edge-top: 0 0 0 0 transparent;
  --mrx-range-edge-bottom: 0 0 0 0 transparent;
  --mrx-range-edge-left: 0 0 0 0 transparent;
  --mrx-range-edge-right: 0 0 0 0 transparent;
  --mrx-cell-outer-shadow: 0 0 0 0 transparent;
  box-shadow:
    inset var(--mrx-range-edge-top),
    inset var(--mrx-range-edge-bottom),
    inset var(--mrx-range-edge-left),
    inset var(--mrx-range-edge-right),
    var(--mrx-cell-outer-shadow);
}

.mrx-grid-cell--selected.mrx-grid-cell--edge-top {
  --mrx-range-edge-top: 0 2px 0 0 var(--color-text-accent);
}

.mrx-grid-cell--selected.mrx-grid-cell--edge-bottom {
  --mrx-range-edge-bottom: 0 -2px 0 0 var(--color-text-accent);
}

.mrx-grid-cell--selected.mrx-grid-cell--edge-left {
  --mrx-range-edge-left: 2px 0 0 0 var(--color-text-accent);
}

.mrx-grid-cell--selected.mrx-grid-cell--edge-right {
  --mrx-range-edge-right: -2px 0 0 0 var(--color-text-accent);
}

// Pinned drop-shadow lives on the same `box-shadow` slot stack so it
// composes with the selection edges. Declared here (in `AdeoGridCell.vue`)
// rather than in the parent `AdeoGridRow.vue` to keep the cascade order
// deterministic — the variable defaults above are overridden by these
// rules within the same stylesheet.
.mrx-grid-cell--pinned-left-edge {
  --mrx-cell-outer-shadow: 2px 0 4px rgba(0, 0, 0, 0.06);
}

.mrx-grid-cell--pinned-right-edge {
  --mrx-cell-outer-shadow: -2px 0 4px rgba(0, 0, 0, 0.06);
}

.mrx-grid-cell--fill-target {
  background-color: var(--color-background-accent);
  border: m.get-token('border-width', 's') dashed var(--color-text-accent);
}

// Cell that lies inside the fill-target range but whose column refuses
// the fill (non-editable). Use red dashed so it visually clashes with
// the regular blue dashed accept-target — easy to spot during drag.
.mrx-grid-cell--fill-target-invalid {
  background-color: var(--color-status-background-error, #fdecec);
  outline: m.get-token('border-width', 's') dashed var(--color-status-border-error, #d11717);
  outline-offset: -1px;
}

/* Sprint 8 §2.9 — invalid cell shows a 2px rounded red ring matching the
   focus ring (`.mrx-grid-cell--active::after`). A `::before` pseudo-element
   lets us paint the ring on top of cell content without shifting layout
   and without conflicting with active's `::after` ring. */
.mrx-grid-cell--invalid {
  z-index: 1;
  // Release the cell's clipping (overflow + paint contain) so MTooltip's
  // absolutely-positioned popover can escape on hover. Without this, the
  // tooltip is only visible in edit mode (which already sets
  // `overflow: visible`) — see `.mrx-grid-cell--editing`.
  overflow: visible;
  contain: layout style;
}

// While hovered/focused, lift the invalid cell above the sticky header
// (`z-index: 4` on `.mrx-grid-sticky-header`) so MTooltip's popover —
// which lives inside the cell's stacking context — is not occluded by
// the header. We only do this on hover/focus to avoid the cell painting
// over the header during regular scroll.
.mrx-grid-cell--invalid:hover,
.mrx-grid-cell--invalid:focus-within {
  z-index: 5;
}

.mrx-grid-cell--invalid::before {
  content: '';
  position: absolute;
  inset: 0;
  border: m.get-token('border-width', 'm') solid var(--color-status-border-error);
  border-radius: m.get-radius('s');
  pointer-events: none;
  z-index: 1;
}

// Formula evaluation error (#REF!, #DIV/0!, etc.) — render the code in
// red with an italic prefix so it stands out against numeric values, plus
// a hint tooltip via the cell's `title` attribute.
.mrx-grid-cell--formula-error {
  color: var(--color-status-text-error, #d11717);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.mrx-grid-cell--invalid.mrx-grid-cell--active {
  background-color: var(--color-status-background-error);
}

.mrx-grid-cell--editing {
  padding: 0;
  z-index: 3;
  contain: size layout style;
  overflow: visible;
}

.mrx-grid-cell__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: m.get-spacing('100') m.get-spacing('150');
  border: none;
  outline: none;
  font: inherit;
  background: transparent;
  box-sizing: border-box;
}


.mrx-grid-cell__fill-handle {
  position: absolute;
  bottom: -3px;
  right: -3px;
  width: 6px;
  height: 6px;
  background-color: var(--color-text-accent);
  border: m.get-token('border-width', 's') solid var(--color-background-primary);
  cursor: crosshair;
  z-index: 2;
}

/* Sprint 8 §2.9 — flush right, vertically centered, no spacing gap.
   `MTooltip` is the wrapper element so we apply absolute positioning
   directly to it via this class. */
.mrx-grid-cell__error-wrapper {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  cursor: help;
  z-index: 4;
}

/* --- Cut / marching-ants (Excel-style Ctrl+X) --- */
.mrx-grid-cell--cut {
  background: rgba(26, 115, 232, 0.06);
}

.mrx-grid-cell__cut-mark {
  position: absolute;
  pointer-events: none;
  z-index: 5;
  --cut-color: var(--color-background-accent-inverse, #1a73e8);
}

.mrx-grid-cell__cut-mark--top,
.mrx-grid-cell__cut-mark--bottom {
  left: 0;
  right: 0;
  height: 2px;
  background-image: linear-gradient(90deg, var(--cut-color) 50%, transparent 50%);
  background-size: 8px 2px;
  background-repeat: repeat-x;
  animation: moz-grid-marching-ants-x 0.5s linear infinite;
}

.mrx-grid-cell__cut-mark--top {
  top: 0;
}
.mrx-grid-cell__cut-mark--bottom {
  bottom: 0;
}

.mrx-grid-cell__cut-mark--left,
.mrx-grid-cell__cut-mark--right {
  top: 0;
  bottom: 0;
  width: 2px;
  background-image: linear-gradient(180deg, var(--cut-color) 50%, transparent 50%);
  background-size: 2px 8px;
  background-repeat: repeat-y;
  animation: moz-grid-marching-ants-y 0.5s linear infinite;
}

.mrx-grid-cell__cut-mark--left {
  left: 0;
}
.mrx-grid-cell__cut-mark--right {
  right: 0;
}

/* --- Ref-highlight (formula edit, Phase 6b) --- */
.mrx-grid-cell--ref-highlight {
  z-index: 2;
}

.mrx-grid-cell--ref-highlight::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid var(--moz-grid-ref-color, transparent);
  border-radius: 4px;
  pointer-events: none;
  z-index: 3;
}

// --- Pending shimmer (granular skeleton) ----------------------------------
// Overlay rendu uniquement sur les cellules ciblées par `props.pendingCells`.
// Le shimmer est volontairement bien visible : palette gris franc avec un
// flash blanc qui traverse, plus une opacity assez haute pour qu'on voie
// clairement qu'une mutation est en vol — pas un effet "premium-subtle"
// invisible sur fond clair. La valeur sous-jacente reste lisible parce
// que l'opacity est < 1, mais l'overlay domine visuellement.
// --- Pending shimmer (granular skeleton) ----------------------------------
// On change DIRECTEMENT le background-color de la cellule (pas un `::after`
// qui peut se faire clipper par `contain: paint` côté `.mrx-grid-cell`).
// Le shimmer vient d'un `background-image` gradient animé + `background-size:
// 200% 100%` qui scrolle. Pas de pseudo-element, pas de stacking context
// à gérer — visible quelle que soit la config du parent.
//
// `!important` parce que `.mrx-grid-cell` set `background-color` côté
// classes pinned / selected qui ont la même spécificité — sans ça, le
// background "pending" se ferait écraser par `--selected` quand l'user
// vient juste de cliquer / commit.
.mrx-grid-cell--pending {
  background-color: #d9dde3 !important;
  background-image: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.85) 50%,
    transparent 100%
  ) !important;
  background-size: 200% 100% !important;
  background-repeat: no-repeat !important;
  animation: mrx-skeleton-shimmer 1.4s ease-in-out infinite !important;
}

// Pendant le pending on rend le texte de la cellule transparent — comme ça
// la valeur est "remplacée" par le shimmer (vrai effet skeleton) plutôt
// que d'avoir un texte qui scintille à travers.
.mrx-grid-cell--pending > * {
  opacity: 0.25 !important;
  transition: opacity 200ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .mrx-grid-cell--pending {
    animation: none !important;
  }
}
</style>

<!-- Global @keyframes — must be unscoped so the animation names resolve
     across the cells that reference them. -->
<style lang="scss">
@keyframes moz-grid-marching-ants-x {
  from {
    background-position-x: 0;
  }
  to {
    background-position-x: 8px;
  }
}
@keyframes moz-grid-marching-ants-y {
  from {
    background-position-y: 0;
  }
  to {
    background-position-y: 8px;
  }
}

/* Skeleton shimmer — partagée entre le full-skeleton (`AdeoGridSkeletonRow`)
 * et le cell-level pending (`.mrx-grid-cell--pending::after`). Unscoped
 * pour rester accessible aux scoped styles des autres SFC qui réfèrent
 * `animation: mrx-skeleton-shimmer ...` par nom. (`_animations.scss`
 * existe mais n'est branchée dans aucun chemin d'import au runtime, c'est
 * de la doc — d'où la duplication ici comme pour les marching-ants.) */
@keyframes mrx-skeleton-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
</style>
