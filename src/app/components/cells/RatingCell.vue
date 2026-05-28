<script setup lang="ts">
/**
 * Cell renderer pour `rating` — affichage compact « ★ 4.2 ».
 *
 * On évite `MStarRating` ici parce que c'est un composant interactif
 * lourd à mounter 25× par page. La représentation textuelle reste
 * scannable et alignée sur le reste de la grid.
 */

import { computed } from 'vue'
import type { CellRendererProps } from '@/components/MrxGrid'

const props = defineProps<CellRendererProps>()

const rating = computed(() => {
  const n = Number(props.value)
  return Number.isFinite(n) ? n.toFixed(1) : '—'
})
</script>

<template>
  <span class="rating-cell">
    <span class="rating-cell__star" aria-hidden="true">★</span>
    <span>{{ rating }}</span>
  </span>
</template>

<style scoped lang="scss">
.rating-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.rating-cell__star {
  color: #f59e0b;
}
</style>
