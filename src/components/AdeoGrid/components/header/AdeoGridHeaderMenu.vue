<script setup lang="ts">
/**
 * Header column menu — Sprint 5 (REFONTE-PLAN-V2 §2.4).
 *
 * Renders a Mozaic `<MActionListbox>` as the kebab menu that appears when
 * the user clicks the column-header trigger. Items are built dynamically
 * from the column's capability flags (`sortable`, `filterable`, `groupable`,
 * `freezable`, `hideable`, …) so columns that opt out don't see actions
 * that would no-op.
 *
 * The listbox is teleported to `<body>` and positioned using the trigger
 * button's `DOMRect` (passed by the parent header). We don't use Mozaic's
 * `<MPopover>` here because its activator slot relies on the native HTML
 * popover API binding (`popovertarget`), which doesn't compose with our
 * existing `AdeoGridHeader` → `AdeoGridHeaderCell` → emit-up flow. Keeping
 * the teleport gives us the Mozaic-styled item list without restructuring
 * the header virtualisation.
 */

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Component } from 'vue'
import { MActionListbox } from '@mozaic-ds/vue'
import {
  ChevronDown20,
  ChevronUp20,
  Cross20,
  EyeOff20,
  Filter20,
  Group20,
  PushPin20,
  Size20,
} from '@mozaic-ds/icons-vue'
import type { ColumnDef, ColumnMenuAction, SortDirection } from '../../types'

const props = defineProps<{
  field: string
  column: ColumnDef
  sortDirection?: SortDirection | null
  pinned?: 'left' | 'right' | null
  /** Bounding rect of the trigger button — used to position the teleported menu. */
  triggerRect: DOMRect
}>()

const emit = defineEmits<{
  action: [action: ColumnMenuAction]
  close: []
}>()

interface ActionItem {
  id: string
  label: string
  icon?: Component
  disabled?: boolean
  appearance?: 'standard' | 'danger'
  divider?: boolean
}

// MActionListbox emits the clicked item's `id` as a string|number. We map
// it back to a typed `ColumnMenuAction` so consumers stay strongly typed.
const items = computed<ActionItem[]>(() => {
  const col = props.column
  const out: ActionItem[] = []

  if (col.sortable !== false) {
    out.push(
      { id: 'sort-asc', label: 'Sort A → Z', icon: ChevronUp20 },
      { id: 'sort-desc', label: 'Sort Z → A', icon: ChevronDown20 },
    )
  }

  if (col.filterable || col.filter) {
    out.push({
      id: 'filter-column',
      label: 'Filter in this column',
      icon: Filter20,
      divider: out.length > 0,
    })
  }

  if (col.groupable) {
    out.push({
      id: 'group-by',
      label: 'Group by this column',
      icon: Group20,
      divider: out.length > 0,
    })
  }

  if (col.freezable !== false) {
    if (props.pinned) {
      out.push({
        id: 'unpin',
        label: 'Unpin column',
        icon: PushPin20,
        divider: out.length > 0,
      })
    } else {
      out.push(
        {
          id: 'pin-left',
          label: 'Pin to the left',
          icon: PushPin20,
          divider: out.length > 0,
        },
        { id: 'pin-right', label: 'Pin to the right', icon: PushPin20 },
      )
    }
  }

  if (col.hideable !== false) {
    out.push({
      id: 'hide',
      label: 'Hide column',
      icon: EyeOff20,
      appearance: 'danger',
      divider: out.length > 0,
    })
  }

  // Search toggle stays available for legacy callers that wired it.
  if (col.filter && !col.filterable) {
    out.push({
      id: 'toggle-search',
      label: 'Toggle search',
      icon: Cross20,
      divider: out.length > 0,
    })
  }

  out.push(
    {
      id: 'autosize-this',
      label: 'Autosize this column',
      icon: Size20,
      divider: out.length > 0,
    },
    { id: 'autosize-all', label: 'Autosize all columns', icon: Size20 },
  )

  return out
})

function onAction(value: string | number) {
  const id = String(value)
  const action = mapAction(id)
  if (action) emit('action', action)
  emit('close')
}

function mapAction(id: string): ColumnMenuAction | null {
  switch (id) {
    case 'sort-asc':
    case 'sort-desc':
    case 'filter-column':
    case 'group-by':
    case 'pin-left':
    case 'pin-right':
    case 'unpin':
    case 'hide':
    case 'toggle-search':
    case 'autosize-this':
    case 'autosize-all':
      return { type: id, field: props.field } as ColumnMenuAction
    default:
      return null
  }
}

const menuRef = ref<HTMLElement | null>(null)

// --- Auto positioning ---
// First render uses a "below + right-aligned" placement based on the
// trigger rect. After mount we measure the actual menu and flip side
// (above/below, left/right) if the chosen edge would overflow the
// viewport — same logic as floating-ui's `flip` middleware in 30 lines.
const VIEWPORT_PADDING = 8
const MENU_GAP = 4

const placement = ref<{ top: number; left: number }>({
  top: props.triggerRect.bottom + MENU_GAP,
  left: Math.max(
    VIEWPORT_PADDING,
    props.triggerRect.right - 240, // initial guess; corrected after measure
  ),
})

function recomputePlacement() {
  const el = menuRef.value
  if (!el) return
  const { offsetWidth: w, offsetHeight: h } = el
  const vw = window.innerWidth
  const vh = window.innerHeight
  const t = props.triggerRect

  // Vertical: prefer below; flip above when below would overflow AND
  // there is more room on top.
  const spaceBelow = vh - t.bottom
  const spaceAbove = t.top
  const openUpward = h + MENU_GAP > spaceBelow && spaceAbove > spaceBelow
  const top = openUpward
    ? Math.max(VIEWPORT_PADDING, t.top - h - MENU_GAP)
    : Math.min(vh - h - VIEWPORT_PADDING, t.bottom + MENU_GAP)

  // Horizontal: prefer right-aligned (menu's right edge sits on
  // trigger's right edge). Flip to left-aligned when right-aligned
  // would clip on the left side of the viewport.
  const rightAlignedLeft = t.right - w
  const left = rightAlignedLeft < VIEWPORT_PADDING
    ? Math.min(vw - w - VIEWPORT_PADDING, t.left)
    : Math.min(vw - w - VIEWPORT_PADDING, rightAlignedLeft)

  placement.value = { top, left }
}

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleKeyDown)
  window.addEventListener('resize', recomputePlacement)
  // Wait for MActionListbox's items to render so the menu has its real
  // height/width before we measure.
  nextTick(recomputePlacement)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('resize', recomputePlacement)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuRef"
      class="mrx-grid-header-menu"
      :style="{
        top: `${placement.top}px`,
        left: `${placement.left}px`,
      }"
      role="menu"
    >
      <MActionListbox :items="items" position="bottom" @action="onAction" @close="emit('close')" />
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.mrx-grid-header-menu {
  position: fixed;
  z-index: 9999;
  min-width: 240px;
  /* MActionListbox brings its own Mozaic surface (background, shadow,
   * radius). Keep this wrapper transparent so we don't double-render
   * a card behind it. */
}
</style>
