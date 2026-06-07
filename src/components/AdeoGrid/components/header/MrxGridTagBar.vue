<script setup lang="ts">
/**
 * Generic tag bar — Sprint 3 (REFONTE-PLAN-V2 §2.3).
 *
 * One reusable bar used three times in the grid:
 *
 *   • HIDDEN COLUMNS — chips for hidden columns, click × → restore
 *   • GROUPED BY     — chips for active group fields, click × → ungroup
 *   • FILTERED BY    — chips for active filter conditions, click × → remove
 *
 * Uses Mozaic `<MTag type="removable">` so the look matches the Angular
 * grid's tag-bars exactly. Includes an optional "action" link on the right
 * (e.g. "Restore all", "Remove all") wired via `actionLabel` + `action`
 * event.
 */

import { MTag } from '@mozaic-ds/vue'

interface TagItem {
  /** Stable id used by MTag and as v-for key. */
  id: string
  /** Visible text on the chip. */
  label: string
  /** When false, the × is hidden and the tag becomes informative. */
  removable?: boolean
}

defineProps<{
  /** UPPERCASE label shown to the left, e.g. "HIDDEN COLUMNS". */
  label: string
  /** List of chips. */
  items: TagItem[]
  /** Optional right-side action button label, e.g. "Restore all". */
  actionLabel?: string
}>()

const emit = defineEmits<{
  /** Emitted when a chip's × is clicked. Payload is the chip `id`. */
  remove: [id: string]
  /** Emitted when the right-side action link is clicked. */
  action: []
}>()
</script>

<template>
  <div v-if="items.length > 0" class="moz-grid__tag-bar">
    <span class="moz-grid__tag-bar-label">{{ label }}</span>
    <MTag
      v-for="item in items"
      :key="item.id"
      :id="`tag-${label.toLowerCase().replace(/\s+/g, '-')}-${item.id}`"
      :type="item.removable === false ? 'informative' : 'removable'"
      size="s"
      :label="item.label"
      removable-label="Remove"
      @remove-tag="emit('remove', item.id)"
    />
    <button
      v-if="actionLabel && items.length > 1"
      type="button"
      class="moz-grid__tag-action-btn"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.moz-grid__tag-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: m.get-spacing('100');
  padding: m.get-spacing('100') m.get-spacing('150');
  font-size: 13px;
}

.moz-grid__tag-bar-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-secondary, #555);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.moz-grid__tag-action-btn {
  margin-left: m.get-spacing('100');
  padding: 2px 6px;
  border: none;
  background: transparent;
  color: var(--Status-Standalone-element-Primary, #0071ce);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.moz-grid__tag-action-btn:hover {
  text-decoration: underline;
}
</style>
