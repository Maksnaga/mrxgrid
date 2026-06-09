<script setup lang="ts">
/**
 * Modal de confirmation suppression — pattern danger Mozaic.
 *
 * Réutilisable pour un produit isolé OU une sélection bulk : le parent
 * configure `:count` pour la pluralisation. Le composant ne sait pas
 * ce qu'il y a derrière, il émet juste `confirm`.
 */

import { computed } from 'vue'
import { MButton, MModal } from '@mozaic-ds/vue'

const props = defineProps<{
  open: boolean
  /** Nombre d'éléments à supprimer. 1 = singulier, n>1 = pluriel. */
  count: number
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

const description = computed(() =>
  props.count > 1
    ? `${props.count} produits seront définitivement supprimés. L'action est irréversible.`
    : 'Ce produit sera définitivement supprimé. L\'action est irréversible.',
)

function onCancel(): void {
  emit('update:open', false)
}
</script>

<template>
  <MModal
    :open="open"
    title="Confirmer la suppression"
    :description="description"
    closable
    @close="onCancel"
  >
    <template #footer>
      <MButton outlined @click="onCancel">Annuler</MButton>
      <MButton
        appearance="danger"
        :is-loading="loading"
        :disabled="loading"
        @click="emit('confirm')"
      >
        Supprimer
      </MButton>
    </template>
  </MModal>
</template>
