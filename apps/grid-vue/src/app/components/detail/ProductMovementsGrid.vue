<script setup lang="ts">
/**
 * Mini-grid embarqué qui affiche les mouvements de stock d'un produit.
 *
 * Démontre le pattern "grid dans grid" : la même `<ad-grid-vue>` est
 * réutilisable en lecture seule, compacte, sans toolbar et avec ses
 * propres colonnes — typique d'une vue "détail" qui contient ses
 * sous-tableaux.
 */

import { markRaw, onMounted, ref, watch } from 'vue'
import { AdGridVue, type ColumnDef } from '@/components/Grid'
import { getProductMovements } from '../../mock/api'
import type { StockMovement } from '../../mock/seed'
import MovementTypeCell from './MovementTypeCell.vue'

const props = defineProps<{ productId: number }>()

const rows = ref<StockMovement[]>([])
const loading = ref(false)
const error = ref<Error | null>(null)

async function refresh(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    rows.value = await getProductMovements(props.productId)
  } catch (e) {
    error.value = e as Error
  } finally {
    loading.value = false
  }
}

watch(() => props.productId, refresh)
onMounted(refresh)

const columns: ColumnDef[] = [
  {
    field: 'date',
    headerName: 'Date',
    width: '110px',
    sortable: true,
  },
  {
    field: 'type',
    headerName: 'Type',
    width: '120px',
    sortable: true,
    renderer: markRaw(MovementTypeCell),
  },
  {
    field: 'quantity',
    headerName: 'Qté',
    width: '70px',
    sortable: true,
    cellClass: 'grid-cell-num',
  },
  {
    field: 'balance',
    headerName: 'Solde',
    width: '80px',
    sortable: true,
    cellClass: 'grid-cell-num',
  },
  {
    field: 'reason',
    headerName: 'Motif',
    width: '200px',
  },
  {
    field: 'operator',
    headerName: 'Opérateur',
    width: '140px',
  },
]
</script>

<template>
  <ad-grid-vue
    class="product-movements-grid"
    :columns="columns"
    :rows="rows"
    :row-id="(r) => String((r as unknown as StockMovement).id)"
    :height="220"
    :loading="loading"
    :error="error"
    density="compact"
  >
    <!-- Pas de toolbar — vue lecture seule purement informative. -->
    <template #toolbar><span /></template>
  </ad-grid-vue>
</template>

<style scoped lang="scss">
.product-movements-grid {
  background: var(--color-background-secondary, #f8fafc);
  border-radius: 8px;
}
</style>
