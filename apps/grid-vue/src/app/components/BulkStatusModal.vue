<script setup lang="ts">
/**
 * Modal "Modifier le statut" pour une sélection bulk.
 *
 * MSelect Mozaic + MModal — l'utilisateur choisit un nouveau statut,
 * submit appelle `updateProducts(ids, { status })` côté parent.
 */

import { ref, watch } from 'vue'
import { MButton, MField, MModal, MSelect } from '@mozaic-ds/vue'
import type { LMProduct } from '../mock/seed'

const props = defineProps<{
  open: boolean
  count: number
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [status: LMProduct['status']]
}>()

const STATUSES: { value: LMProduct['status']; label: string }[] = [
  { value: 'in-stock', label: 'En stock' },
  { value: 'low', label: 'Stock faible' },
  { value: 'out', label: 'Rupture' },
  { value: 'preorder', label: 'Précommande' },
]

const status = ref<LMProduct['status']>('in-stock')

// Reset au ré-ouverture pour éviter qu'une sélection précédente persiste.
watch(
  () => props.open,
  (next) => {
    if (next) status.value = 'in-stock'
  },
)
</script>

<template>
  <MModal
    :open="open"
    title="Modifier le statut"
    :description="`Appliquer un nouveau statut à ${count} produit${count > 1 ? 's' : ''}.`"
    closable
    @close="emit('update:open', false)"
  >
    <MField id="bulk-status" label="Nouveau statut" requirement-text="(requis)">
      <MSelect
        id="bulk-status"
        v-model="status"
        size="s"
        :options="STATUSES.map((s) => ({ text: s.label, value: s.value }))"
      />
    </MField>

    <template #footer>
      <MButton outlined @click="emit('update:open', false)">Annuler</MButton>
      <MButton
        appearance="accent"
        :is-loading="loading"
        :disabled="loading"
        @click="emit('confirm', status)"
      >
        Appliquer
      </MButton>
    </template>
  </MModal>
</template>
