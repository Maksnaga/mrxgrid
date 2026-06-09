<script setup lang="ts">
/**
 * Pastille colorée pour un type de mouvement (in / out / adjustment).
 */

import { computed } from 'vue'
import { MStatusBadge } from '@mozaic-ds/vue'
import type { CellRendererProps } from '@/components/Grid'

const props = defineProps<CellRendererProps>()

const meta = computed<{ label: string; status: 'success' | 'error' | 'warning' | 'info' }>(() => {
  switch (String(props.value)) {
    case 'in':
      return { label: 'Entrée', status: 'success' }
    case 'out':
      return { label: 'Sortie', status: 'error' }
    case 'adjustment':
      return { label: 'Ajustement', status: 'warning' }
    default:
      return { label: String(props.value), status: 'info' }
  }
})
</script>

<template>
  <MStatusBadge :label="meta.label" :status="meta.status" />
</template>
