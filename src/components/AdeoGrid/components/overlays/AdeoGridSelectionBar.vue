<script setup lang="ts">
/**
 * Selection bar — Angular parity (`moz-grid-selection-bar`).
 *
 * Floating toolbar shown when the current selection is non-empty. Replaces the
 * former split between `AdeoGridActionBar` (toolbar) and `AdeoGridSelectionBar`
 * (Gmail-style banner): both are now unified under this single component, in
 * line with the Angular implementation.
 *
 * Triggered by EITHER:
 *   - row selection (≥ 1 row, requires `selectable`)
 *   - cell range selection (≥ 2 cells)
 *
 * The bar is visually detached from the grid body (absolute, bottom-center)
 * and shows:
 *   - a close button (clears selection)
 *   - a counter that adapts to the active mode (rows vs cells)
 *   - row-mode only: a "Select all N rows" prompt when the current page is
 *     fully selected but the full dataset has not yet been marked, plus an
 *     "(all N)" label when allSelected is active
 *   - built-in Edit / Copy / Paste / Delete actions, toggleable via flags
 *   - a kebab trigger that, when clicked, opens a popup hosting the
 *     consumer-supplied `#actions` slot. When the slot has no content the
 *     trigger stays hidden — same logic as the Mozaic split-button family.
 */

import { computed, onBeforeUnmount, ref, useSlots, watch } from 'vue'
import type { SelectionModel } from '@/composables/useRowSelection'

type SelectionMode = 'row' | 'cell'

const props = defineProps<{
  /** Number of selected items (rows or cells, depending on `mode`). */
  selectedCount: number
  /** What the count refers to. Drives label + which built-in actions wire to
   *  row vs cell selection on the parent side. */
  mode: SelectionMode
  /** Full row selection model — only meaningful in `mode === 'row'`. */
  selectionModel?: SelectionModel
  /** Total rows in the dataset (used for the "Select all N" prompt). */
  totalCount?: number
  /** Number of data rows on the current page. */
  pageCount?: number
  /** True when every row on the current page is selected. */
  pageFullySelected?: boolean
  /** Show Edit action (just emits `edit` — consumer wires the modal/router). */
  showEdit?: boolean
  /** Show Copy action. */
  showCopy?: boolean
  /** Show Paste action. */
  showPaste?: boolean
  /** Show Delete action. */
  showDelete?: boolean
  /** Compact mode: drop the count, the close (X) and the "Select all N" link
   *  so the bar only renders the action buttons. Use this when the host
   *  surfaces the selection summary in its own toolbar. */
  compact?: boolean
}>()

const emit = defineEmits<{
  clear: []
  edit: []
  copy: []
  paste: []
  delete: []
  selectAll: []
}>()

const slots = useSlots()

const label = computed(() => {
  const n = props.selectedCount
  if (props.mode === 'cell') {
    return n === 1 ? '1 cell selected' : `${n.toLocaleString()} cells selected`
  }
  return n === 1 ? '1 row selected' : `${n.toLocaleString()} rows selected`
})

/** Show "Select all X rows" link when page is fully selected but not allSelected.
 *  Only relevant in row mode — cell ranges don't have a "fill the dataset"
 *  concept, the user already drew the range they wanted. */
const showSelectAll = computed(
  () =>
    props.mode === 'row' &&
    !!props.pageFullySelected &&
    !props.selectionModel?.allSelected,
)

/** Show "All X selected" indicator when allSelected is active. */
const showAllSelectedLabel = computed(
  () => props.mode === 'row' && !!props.selectionModel?.allSelected,
)

/** Kebab popup is only useful when the consumer provided an `#actions` slot. */
const hasActionsSlot = computed(() => !!slots.actions)

const popupOpen = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const popupRef = ref<HTMLDivElement | null>(null)

function toggleMore() {
  popupOpen.value = !popupOpen.value
}

function closeMore() {
  popupOpen.value = false
}

// Click-outside to close the kebab popup. Listener is attached only while
// the popup is open so we don't pay for it during the common case.
function onDocClick(e: MouseEvent) {
  const t = e.target as Node | null
  if (!t) return
  if (popupRef.value?.contains(t)) return
  if (triggerRef.value?.contains(t)) return
  popupOpen.value = false
}

watch(popupOpen, (open) => {
  if (open) document.addEventListener('mousedown', onDocClick, true)
  else document.removeEventListener('mousedown', onDocClick, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick, true)
})
</script>

<template>
  <div class="adeo-grid-grid-selection-bar" role="toolbar" aria-label="Bulk actions">
    <template v-if="!compact">
      <!-- Close + counter -->
      <button
        class="adeo-grid-grid-selection-bar__close"
        type="button"
        aria-label="Clear selection"
        @click="emit('clear')"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M11 3L3 11M3 3l8 8"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <span class="adeo-grid-grid-selection-bar__count">{{ label }}</span>

      <!-- Select all prompt (Gmail-style) — row mode only. -->
      <button
        v-if="showSelectAll"
        class="adeo-grid-grid-selection-bar__link"
        type="button"
        @click="emit('selectAll')"
      >
        Select all {{ (totalCount ?? 0).toLocaleString() }}
      </button>
      <span v-if="showAllSelectedLabel" class="adeo-grid-grid-selection-bar__all-label">
        (all {{ (totalCount ?? 0).toLocaleString() }})
      </span>

      <span class="adeo-grid-grid-selection-bar__separator" />
    </template>

    <!-- Built-in actions -->
    <button v-if="showEdit" class="adeo-grid-grid-selection-bar__btn" type="button" @click="emit('edit')">
      Edit
    </button>
    <button v-if="showCopy" class="adeo-grid-grid-selection-bar__btn" type="button" @click="emit('copy')">
      Copy
    </button>
    <button
      v-if="showPaste"
      class="adeo-grid-grid-selection-bar__btn"
      type="button"
      @click="emit('paste')"
    >
      Paste
    </button>
    <button
      v-if="showDelete"
      class="adeo-grid-grid-selection-bar__btn adeo-grid-selection-bar__btn--danger"
      type="button"
      @click="emit('delete')"
    >
      Delete
    </button>

    <!-- Kebab — opens a popup hosting the `#actions` slot. Hidden when the
         slot is empty so the trigger doesn't read as "always-empty menu". -->
    <template v-if="hasActionsSlot">
      <span class="adeo-grid-grid-selection-bar__separator" />
      <button
        ref="triggerRef"
        class="adeo-grid-grid-selection-bar__kebab"
        type="button"
        aria-label="More actions"
        :aria-expanded="popupOpen"
        @click="toggleMore"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" fill="currentColor" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="13" r="1.5" fill="currentColor" />
        </svg>
      </button>
      <div v-if="popupOpen" ref="popupRef" class="adeo-grid-grid-selection-bar__popup" role="menu">
        <slot
          name="actions"
          :selected-count="selectedCount"
          :mode="mode"
          :selection-model="selectionModel"
          :clear-selection="() => emit('clear')"
          :close="closeMore"
        />
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.adeo-grid-grid-selection-bar {
  position: absolute;
  bottom: 64px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;

  display: flex;
  align-items: center;
  gap: m.get-spacing('100');
  padding: m.get-spacing('100') m.get-spacing('200');
  background: var(--color-background-primary);
  border: m.get-token('border-width', 's') solid var(--color-border-primary);
  border-radius: m.get-radius('m');
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  font-size: m.get-font-size('100');
  color: var(--color-text-primary);
  white-space: nowrap;
}

.adeo-grid-grid-selection-bar__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: m.get-radius('full');
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.adeo-grid-grid-selection-bar__close:hover {
  background: var(--color-background-accent);
  color: var(--color-text-accent);
}

.adeo-grid-grid-selection-bar__count {
  font-weight: m.get-font-weight('semi-bold');
  color: var(--color-text-primary);
}

.adeo-grid-grid-selection-bar__link {
  background: none;
  border: none;
  padding: 0;
  font-size: m.get-font-size('50');
  font-weight: m.get-font-weight('semi-bold');
  color: var(--color-text-accent);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: transparent;
}

.adeo-grid-grid-selection-bar__link:hover {
  text-decoration-color: currentColor;
}

.adeo-grid-grid-selection-bar__all-label {
  font-size: m.get-font-size('50');
  color: var(--color-text-tertiary);
}

.adeo-grid-grid-selection-bar__separator {
  width: 1px;
  height: 18px;
  background: var(--color-border-primary);
  margin: 0 m.get-spacing('050');
  flex-shrink: 0;
}

.adeo-grid-grid-selection-bar__btn {
  background: none;
  border: none;
  padding: m.get-spacing('050') m.get-spacing('150');
  border-radius: m.get-radius('s');
  font-size: m.get-font-size('100');
  font-weight: m.get-font-weight('semi-bold');
  color: var(--color-text-accent);
  cursor: pointer;
}

.adeo-grid-grid-selection-bar__btn:hover {
  background: var(--color-background-secondary);
}

.adeo-grid-selection-bar__btn--danger {
  color: var(--color-status-text-error);
}

.adeo-grid-selection-bar__btn--danger:hover {
  background: var(--color-status-background-error);
}

.adeo-grid-grid-selection-bar__kebab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: none;
  border: none;
  border-radius: m.get-radius('s');
  color: var(--color-text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
}

.adeo-grid-grid-selection-bar__kebab:hover {
  background: var(--color-background-secondary);
  color: var(--color-text-primary);
}

.adeo-grid-grid-selection-bar__popup {
  position: absolute;
  bottom: calc(100% + #{m.get-spacing('050')});
  right: 0;
  min-width: 180px;
  padding: m.get-spacing('050');
  background: var(--color-background-primary);
  border: m.get-token('border-width', 's') solid var(--color-border-primary);
  border-radius: m.get-radius('s');
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 5;
}
</style>
