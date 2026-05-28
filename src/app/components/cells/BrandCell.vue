<script setup lang="ts">
/**
 * Cell renderer pour `brand` — avatar + nom de la marque.
 *
 * L'initiale colorée tient lieu de logo : sur un vrai catalogue on
 * remplacerait par `<img :src="brandLogos[value]">` mais l'usage du
 * `MAvatar` Mozaic est plus représentatif (et plus rapide).
 */

import { computed } from 'vue'
import { MAvatar } from '@mozaic-ds/vue'
import type { CellRendererProps } from '@/components/MrxGrid'

const props = defineProps<CellRendererProps>()

const initial = computed(() => String(props.value ?? '?').charAt(0).toUpperCase())
</script>

<template>
  <div class="brand-cell">
    <MAvatar size="s" :aria-label="String(value)">
      <span class="brand-cell__initial">{{ initial }}</span>
    </MAvatar>
    <span class="brand-cell__name">{{ value }}</span>
  </div>
</template>

<style scoped lang="scss">
.brand-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.brand-cell__initial {
  font-weight: 600;
  font-size: 12px;
  color: var(--color-text-primary-inverse, #fff);
}

.brand-cell__name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
