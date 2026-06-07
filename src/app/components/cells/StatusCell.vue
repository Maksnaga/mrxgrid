<script setup lang="ts">
/**
 * Cell renderer pour le champ `status`.
 *
 * Map les valeurs métier vers un appearance Mozaic. Le pattern (un map
 * + un `MStatusBadge`) est typique : zéro logique, juste de la
 * projection.
 */

import { computed } from 'vue'
import { MStatusBadge } from '@mozaic-ds/vue'
import type { CellRendererProps } from '@/components/AdeoGrid'

const props = defineProps<CellRendererProps>()

type StatusValue = 'in-stock' | 'low' | 'out' | 'preorder'
type StatusMeta = {
  label: string
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral'
}

const STATUS_MAP: Record<StatusValue, StatusMeta> = {
  'in-stock': { label: 'En stock', status: 'success' },
  low: { label: 'Stock faible', status: 'warning' },
  out: { label: 'Rupture', status: 'error' },
  preorder: { label: 'Précommande', status: 'info' },
}

const meta = computed<StatusMeta | null>(() => {
  const v = props.value as StatusValue
  return STATUS_MAP[v] ?? null
})
</script>

<template>
  <MStatusBadge v-if="meta" :label="meta.label" :status="meta.status" />
  <span v-else>{{ value }}</span>
</template>
