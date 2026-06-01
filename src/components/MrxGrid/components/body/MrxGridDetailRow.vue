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
 *
 * **Auto-measure of intrinsic height.** A `ResizeObserver` reports the
 * outer row's offsetHeight up to the parent grid via the `@measure` event.
 * The grid uses this to drive the virtual scroll's `expandedRowExtraHeight`
 * dynamically — consumers no longer need to pass `:expanded-row-height`
 * matching the slot content, and the scrollbar stays calibrated even if
 * the detail content's height changes (drawer resize, lazy data fill,
 * conditional sections, etc.).
 */

import { onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits<{
  /**
   * Fired whenever the rendered height of the detail row changes —
   * including mount, content updates, and any subsequent ResizeObserver
   * notifications. The grid stores the value and feeds it to the virtual
   * scroller so `expandedRowExtraHeight` matches reality.
   */
  measure: [height: number]
}>()

const rootRef = ref<HTMLElement | null>(null)
let ro: ResizeObserver | null = null

onMounted(() => {
  const el = rootRef.value
  if (!el) return
  // Emit the initial measurement synchronously on mount so the virtual
  // scroller can recalibrate as early as possible — the first paint with
  // an expanded row already gets the correct sizer height.
  emit('measure', el.offsetHeight)
  ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      // `borderBoxSize` is the spec-correct path (includes border + padding,
      // matches offsetHeight). Falls back to offsetHeight if the browser
      // doesn't populate it (Safari < 13.1).
      const box = entry.borderBoxSize?.[0]
      const h = box?.blockSize ?? (entry.target as HTMLElement).offsetHeight
      emit('measure', h)
    }
  })
  ro.observe(el)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})
</script>

<template>
  <div ref="rootRef" class="mrx-grid-detail-row" role="row">
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
