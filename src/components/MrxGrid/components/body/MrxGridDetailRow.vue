<script setup lang="ts">
/**
 * Detail row — Angular parity (`moz-grid-detail-row`).
 *
 * Wrapper row for detail content rendered below a data row (formerly named
 * `MrxGridExpandedRow`). The inner div uses `position: sticky` so the detail
 * viewport stays glued to the visible viewport during horizontal scroll —
 * otherwise the slot content (with its own padding) would scroll off the
 * left edge and the user would see an empty band between rows. The outer
 * row is intentionally a block container (NOT `display: flex`) because
 * `position: sticky` inside a flex item is buggy on Webkit/Chromium —
 * the sticky never sticks. Width is clamped to the actual visible viewport
 * via the `--mrx-viewport-width` CSS custom property set by the parent grid.
 */
</script>

<template>
  <div class="mrx-grid-detail-row" role="row">
    <div class="mrx-grid-detail-row__viewport">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.mrx-grid-detail-row {
  /* Spans the full body width (= total grid content width) so the band sits
     visually between data rows even when the grid is horizontally scrolled. */
  display: block;
  min-width: 100%;
  background-color: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.mrx-grid-detail-row__viewport {
  /* Sticks to the left edge of the scroll container so user-set padding on
     the slot content stays inside the visible viewport, no matter how far
     the grid is scrolled horizontally. */
  position: sticky;
  left: 0;
  width: var(--mrx-viewport-width, 100%);
  max-width: 100%;
  padding: 12px 16px;
  box-sizing: border-box;
  overflow: hidden;
}
</style>
