<script setup lang="ts">
/**
 * Detail row — Angular parity (`moz-grid-detail-row`).
 *
 * Wrapper row for detail content rendered below a data row (formerly named
 * `MrxGridExpandedRow`). The inner div uses `position: sticky` so the detail
 * viewport stays fixed during horizontal scroll. Width is constrained to the
 * viewport via the `--mrx-viewport-width` CSS custom property set by the
 * parent grid.
 */
</script>

<template>
  <div class="mrx-grid-detail-row" role="row">
    <div class="mrx-grid-detail-row__cell">
      <div class="mrx-grid-detail-row__viewport">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.mrx-grid-detail-row {
  display: flex;
  background-color: #f8fafc;
}

.mrx-grid-detail-row__cell {
  flex: 1;
  padding: 0;
  border-bottom: 1px solid #e2e8f0;
}

.mrx-grid-detail-row__viewport {
  position: sticky;
  left: 0;
  width: var(--mrx-viewport-width, 100%);
  padding: 12px 16px;
  overflow: hidden;
}
</style>
