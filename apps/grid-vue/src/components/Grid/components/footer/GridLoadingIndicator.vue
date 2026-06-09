<script setup lang="ts">
/**
 * Loading indicator — Angular parity (`ad-grid-loading-indicator`).
 *
 * Thin leaf component displayed below the grid body while the async loading
 * strategy is fetching more rows. Mirrors the Angular `<ad-grid-loading-indicator>`:
 * a small Mozaic `MLoader` with an optional text label, sitting on top of a
 * separator to visually detach it from the last rendered row.
 */

import { MLoader } from '@mozaic-ds/vue'

defineOptions({ name: 'AdGridLoadingIndicator' })

withDefaults(
  defineProps<{
    /** Label next to the spinner. Defaults to "Loading more data…" for parity. */
    text?: string
    /** Loader size — passed through to `MLoader`. */
    size?: 'xs' | 's' | 'm' | 'l'
  }>(),
  {
    text: 'Loading more data...',
    size: 's',
  },
)
</script>

<template>
  <div class="grid-loading-indicator">
    <MLoader :size="size" :text="text" />
  </div>
</template>

<style scoped lang="scss">
.grid-loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: m.get-spacing('200');
  border-top: m.get-token('border-width', 's') solid var(--color-border-primary);
  background: var(--color-background-primary);
}
</style>
