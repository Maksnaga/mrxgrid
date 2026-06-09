<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { GRID_STATE_KEY } from '../../state/GridContext'
import { injectGridSlots } from '../../state/GridSlots'

defineOptions({ name: 'AdGridFormulaBar' })

/**
 * Formula bar — single-line editor that reflects the active cell value or the
 * draft value when editing. Mirrors Angular `formula-editor.ts` minus the
 * full reference highlighting (porting `formula-ref-highlight.service.ts`
 * is part of the formula engine work — see §12.3).
 *
 * Active cell is read from `gridState.focusedCell`; field is resolved against
 * a flat columns array passed in by the host (the host already maintains it).
 *
 * Phase 6b — formula awareness: when the active cell hosts a formula, the
 * draft is initialised with the **A1 source string** (`displayFormula`) so
 * the user sees and edits the formula, not its evaluated value. Commits
 * starting with `=` are routed through `formula.set(addr, ...)` by the
 * grid's `flushEdit` (see `Grid.vue`); this component is unaware of
 * the storage path and just emits `commit` with the typed value.
 */

const props = defineProps<{
  /** Flat ordered columns (left-pinned + center + right-pinned). */
  allColumns: { field: string; headerName: string }[]
  /** Renderable rows (full pipeline output). */
  rows: Record<string, unknown>[]
}>()

const emit = defineEmits<{
  commit: [{ rowIndex: number; field: string; value: unknown }]
  cancel: []
}>()

// Tolerant inject — when the bar is mounted outside `<ad-grid-vue>` (above it
// in the toolbar) provide/inject does not reach across siblings. Render an
// empty disabled bar in that case rather than throwing.
const gridState = inject(GRID_STATE_KEY, null)
const _gridSlots = injectGridSlots()
const draft = ref<string>('')

const activeCell = computed(() => {
  if (!gridState) return null
  const fc = gridState.focusedCell.value
  if (!fc) return null
  const col = props.allColumns[fc.col]
  if (!col) return null
  return { rowIndex: fc.row, field: col.field, headerName: col.headerName }
})

/**
 * Source of truth for the bar's display value.
 *
 * Resolution order:
 *  1. If the active cell hosts a formula → its A1 surface form (`=…`).
 *  2. Otherwise → the raw row value, stringified.
 *
 * The formula path runs `displayFormula(addr)` which round-trips the stored
 * long-form back to A1 against the *current* visible-column order — so a
 * user reordering columns sees their formula re-letter itself live.
 */
const cellValue = computed(() => {
  const cell = activeCell.value
  if (!cell) return ''
  // Formula path
  const formula = _gridSlots?.formula
  const rowId = _gridSlots?.resolveRowId?.(cell.rowIndex)
  if (formula && rowId !== undefined) {
    const formulaSource = formula.displayFormula({ rowId, field: cell.field })
    if (formulaSource !== undefined) return formulaSource
  }
  // Plain value path
  const row = props.rows[cell.rowIndex]
  return row?.[cell.field] != null ? String(row[cell.field]) : ''
})

/**
 * True when the active cell hosts a formula AND we're currently in formula
 * mode. The header uses this to surface A1 column-letter badges (Phase 6b).
 */
const isOnFormulaCell = computed(() => {
  const cell = activeCell.value
  if (!cell) return false
  const formula = _gridSlots?.formula
  const rowId = _gridSlots?.resolveRowId?.(cell.rowIndex)
  if (!formula || rowId === undefined) return false
  return formula.hasFormula({ rowId, field: cell.field })
})

// Sync the displayed value when the active cell changes (unless editing).
watch(
  cellValue,
  (v) => {
    if (!gridState?.formulaBarEditingActive.value) draft.value = v
  },
  { immediate: true },
)

function onFocus(): void {
  if (!gridState) return
  gridState.formulaBarEditingActive.value = true
  draft.value = cellValue.value
}

function onBlur(): void {
  if (gridState?.formulaBarEditingActive.value) {
    onCommit()
  }
}

function onCommit(): void {
  const cell = activeCell.value
  if (gridState) gridState.formulaBarEditingActive.value = false
  if (!cell) return
  emit('commit', { rowIndex: cell.rowIndex, field: cell.field, value: draft.value })
}

function onCancel(): void {
  if (gridState) gridState.formulaBarEditingActive.value = false
  draft.value = cellValue.value
  emit('cancel')
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    e.preventDefault()
    onCommit()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    onCancel()
  }
}

const cellLabel = computed(() => {
  const cell = activeCell.value
  if (!cell || !gridState) return ''
  // A1 notation: column letter + 1-based row index.
  const colLetter = String.fromCharCode(65 + (gridState.focusedCell.value?.col ?? 0))
  return `${colLetter}${cell.rowIndex + 1}`
})

// ─── Imperative API ──────────────────────────────────────────────────────
// Used by `AdGridFormulaReferenceDrawer` to insert a function name at the
// caret while the bar has focus, e.g. clicking SUM in the reference drawer
// inserts `SUM(` at the cursor position. The caller is responsible for
// keeping the bar focused (or refocusing) — we don't steal focus here.

const inputRef = ref<HTMLInputElement | null>(null)

/**
 * Insert `text` at the caret. If `text` ends with `(`, position the caret
 * just after the open paren so the user can type arguments. If the bar is
 * not currently focused, append at the end.
 */
function insertText(text: string): void {
  if (!activeCell.value || !gridState) return
  if (!gridState.formulaBarEditingActive.value) {
    // Force focus so the formula bar takes precedence over a current cell edit.
    gridState.formulaBarEditingActive.value = true
    if (!draft.value.startsWith('=')) draft.value = '=' + draft.value
  }
  const el = inputRef.value
  const current = draft.value
  if (!el || el !== document.activeElement) {
    draft.value = current + text
    return
  }
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? current.length
  draft.value = current.slice(0, start) + text + current.slice(end)
  // Reposition caret after the inserted block (one frame later — DOM not yet updated).
  requestAnimationFrame(() => {
    const next = start + text.length
    el.setSelectionRange(next, next)
    el.focus()
  })
}

/** Programmatically focus the input (used by hosts wiring the reference drawer). */
function focusInput(): void {
  inputRef.value?.focus()
}

defineExpose({ insertText, focusInput })
</script>

<template>
  <div
    class="formula-bar"
    :class="{ 'formula-bar--formula': isOnFormulaCell }"
    role="group"
    aria-label="Formula bar"
  >
    <div class="formula-bar__cell-label" aria-label="Active cell">{{ cellLabel || '—' }}</div>
    <span
      class="formula-bar__fx"
      :class="{ 'formula-bar__fx--active': isOnFormulaCell }"
      :title="isOnFormulaCell ? 'This cell is a formula' : undefined"
      aria-hidden="true"
    >fx</span>
    <input
      ref="inputRef"
      class="formula-bar__input"
      type="text"
      :value="draft"
      :disabled="!activeCell"
      :placeholder="activeCell ? '' : 'Select a cell'"
      @input="draft = ($event.target as HTMLInputElement).value"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeyDown"
    />
  </div>
</template>

<style scoped lang="scss">
.formula-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--color-border-primary, #ddd);
  background: var(--color-background-primary, #fff);

  &__cell-label {
    flex: 0 0 auto;
    min-width: 60px;
    padding: 2px 8px;
    border: 1px solid var(--color-border-primary, #ddd);
    border-radius: var(--border-radius-xs, 2px);
    font-family: var(--font-family-monospace, ui-monospace, SFMono-Regular, monospace);
    font-size: var(--font-size-50, 12px);
    color: var(--color-text-primary, #222);
    text-align: center;
  }

  &__fx {
    flex: 0 0 auto;
    font-style: italic;
    font-family: serif; /* intentional: italic fx math symbol, no Mozaic token */
    color: var(--color-text-secondary, #666);
    user-select: none;
  }

  &__fx--active {
    color: var(--color-state-info-strong, #2374b9);
    font-weight: var(--font-weight-bold, 700);
  }

  &--formula {
    background: var(--color-state-info-subtle, #eef6ff);
  }

  &__input {
    flex: 1;
    min-width: 0;
    padding: 4px 6px;
    border: none;
    outline: none;
    font: inherit;
    font-size: var(--font-size-100, 13px);
    color: var(--color-text-primary, #222);
    background: transparent;

    &:focus {
      background: var(--color-background-secondary, #f5f5f5);
    }
  }
}
</style>
