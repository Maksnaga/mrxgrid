<script setup lang="ts">
/**
 * Cell renderer pour `energyClass` (A-G) — pastille colorée.
 *
 * Le code couleur reproduit l'étiquette énergie européenne :
 * A/B verts, C/D oranges, E/F/G rouges. La pastille est compacte pour
 * que la colonne tienne en 90px.
 */

import { computed } from 'vue'
import type { CellRendererProps } from '@/components/Grid'

const props = defineProps<CellRendererProps>()

const variant = computed(() => {
  const v = String(props.value ?? '')
  if (v === 'A' || v === 'B') return 'good'
  if (v === 'C' || v === 'D') return 'mid'
  return 'bad'
})
</script>

<template>
  <span class="energy-cell" :class="`energy-cell--${variant}`">
    {{ value }}
  </span>
</template>

<style scoped lang="scss">
.energy-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 12px;
  color: #fff;
}

.energy-cell--good { background: #16a34a; }
.energy-cell--mid  { background: #f59e0b; }
.energy-cell--bad  { background: #dc2626; }
</style>
