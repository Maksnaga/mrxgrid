<script setup lang="ts">
/**
 * Grid toolbar — Sprint 2 (REFONTE-PLAN-V2 §2.2 + §2.13).
 *
 * Mirrors the Mozaic Angular grid toolbar: ghost icon-buttons on the left
 * (fullscreen / export / settings / group / keyboard / formula reference),
 * a "Filters" `MButton` with a count badge, an inline selection banner
 * (when rows are selected) replacing the floating selection-bar, and slots
 * for consumer-driven start / end actions.
 */

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

defineProps<{
  /** Whether the grid is currently fullscreen. Toggles the icon. */
  fullscreen?: boolean
  /** Show the Fullscreen icon-button. */
  showFullscreen?: boolean
  /** Show the Export (download) icon-button. */
  showExport?: boolean
  /** Show the Filters button (with optional count badge). */
  showFilters?: boolean
  /** Show the Settings icon-button. */
  showSettings?: boolean
  /** Show the Group icon-button. */
  showGroup?: boolean
  /** Show the Keyboard shortcuts icon-button. */
  showKeyboard?: boolean
  /** Show the Formula reference icon-button (only when grid has formula columns). */
  showFormulaReference?: boolean
  /** Active filter conditions count — displayed as a badge on the Filters button. */
  activeFilterCount?: number

  /** Selection banner — displayed inline when rows are selected. */
  selectedCount?: number
  /** Total selectable rows — for the "Select all N rows" CTA. */
  totalCount?: number
  /** True when every selectable row is selected. Hides the "Select all" CTA. */
  allSelected?: boolean
}>()

const emit = defineEmits<{
  'toggle-fullscreen': []
  export: []
  filters: []
  settings: []
  group: []
  keyboard: []
  'formula-reference': []
  'select-all-rows': []
  'clear-selection': []
}>()
</script>

<template>
  <div class="moz-grid__toolbar">
    <div class="moz-grid__toolbar-left">
      <MIconButton v-if="showFullscreen" id="grid-fullscreen" ghost size="s"
        :aria-label="fullscreen ? 'Exit fullscreen' : 'Fullscreen'" @click="emit('toggle-fullscreen')">
        <template #icon>
          <FullscreenExit24 v-if="fullscreen" />
          <FullscreenEnter24 v-else />
        </template>
      </MIconButton>

      <MIconButton v-if="showExport" id="grid-export" ghost size="s" aria-label="Export CSV" @click="emit('export')">
        <template #icon>
          <Download24 />
        </template>
      </MIconButton>

      <div v-if="showFilters" class="moz-grid__toolbar-filter">
        <MIconButton id="grid-filter" ghost size="s" aria-label="Filters" @click="emit('filters')">
          <template #icon>
            <Filter24 />
          </template>
        </MIconButton>
        <MNumberBadge
          v-if="activeFilterCount && activeFilterCount > 0"
          class="moz-grid__toolbar-filter-badge"
          :label="activeFilterCount"
          appearance="accent"
        />
      </div>

      <MIconButton v-if="showSettings" id="grid-settings" ghost size="s" aria-label="Settings"
        @click="emit('settings')">
        <template #icon>
          <Settings24 />
        </template>
      </MIconButton>

      <MIconButton v-if="showGroup" id="grid-group" ghost size="s" aria-label="Group" @click="emit('group')">
        <template #icon>
          <Group24 />
        </template>
      </MIconButton>

      <MIconButton v-if="showKeyboard" id="grid-keyboard" ghost size="s" aria-label="Keyboard shortcuts"
        @click="emit('keyboard')">
        <template #icon>
          <Keyboard24 />
        </template>
      </MIconButton>

      <MIconButton v-if="showFormulaReference" id="grid-formula-reference" ghost size="s" aria-label="Formula reference"
        @click="emit('formula-reference')">
        <template #icon>
          <Calculator24 />
        </template>
      </MIconButton>

      <slot name="toolbar-start" />
    </div>

    <!-- Selection banner — inline, replacing the floating SelectionBar. -->
    <div v-if="selectedCount && selectedCount > 0" class="moz-grid__selection-banner">
      <span class="moz-grid__selection-text">
        {{ selectedCount }} row{{ selectedCount === 1 ? '' : 's' }} selected
      </span>
      <MButton v-if="!allSelected && totalCount && selectedCount < totalCount" ghost size="s" appearance="accent"
        @click="emit('select-all-rows')">
        Select all {{ totalCount }} rows
      </MButton>
      <MButton ghost size="s" @click="emit('clear-selection')">
        Clear
      </MButton>
      <slot name="selection-actions" />
    </div>

    <div class="moz-grid__toolbar-right">
      <slot name="toolbar-end" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.moz-grid__toolbar {
  display: flex;
  align-items: center;
  gap: m.get-spacing('200');
  padding: m.get-spacing('100') 0;
  flex-wrap: wrap;
}

.moz-grid__toolbar-left,
.moz-grid__toolbar-right {
  display: flex;
  align-items: center;
  gap: m.get-spacing('050');
}

.moz-grid__toolbar-right {
  margin-left: auto;
}

// Inline wrap so the `MStatusBadge` (filter count) can sit floating in the
// top-right corner of the icon-only Filters button.
.moz-grid__toolbar-filter {
  position: relative;
  display: inline-flex;
}

.moz-grid__toolbar-filter-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  pointer-events: none;
  z-index: 1;
}

/* Selection banner — inline in the toolbar, neutral input-style frame
   (white background + subtle border) that stretches to fill the row.
   The banner is rendered inside the right-aligned flex track between
   `__toolbar-left` and `__toolbar-right`, so `flex: 1` lets it consume
   the remaining horizontal space while the content stays centered. */
.moz-grid__selection-banner {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: m.get-spacing('200');
  border: m.get-token('border-width', 's') solid var(--color-border-primary, #e2e8f0);
  border-radius: m.get-radius('s');
  background: var(--color-background-primary, #fff);
  font-size: 14px;
  color: var(--color-text-primary);
  display: flex;
padding: 0 8px 0 16px;
  min-width: 0;
}

.moz-grid__selection-text {
  font-weight: 400;
  color: var(--color-text-secondary, #64748b);
  white-space: nowrap;
}
</style>
