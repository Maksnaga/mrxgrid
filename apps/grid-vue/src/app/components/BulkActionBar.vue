<script setup lang="ts">
/**
 * Barre flottante d'actions bulk — apparait quand la sélection > 0.
 *
 * Le grid expose deux refs sur sa sélection (row + cell). On lit les
 * deux et on additionne pour l'affichage. Le parent décide des actions
 * concrètes (export / status / delete) via des emits.
 */

import { computed } from 'vue'
import { MActionBottomBar, MButton } from '@mozaic-ds/vue'

const props = defineProps<{
  /** Nombre de lignes sélectionnées (`@update:selection` du grid). */
  rowCount: number
  /** Nombre de cellules sélectionnées (range Shift+click). */
  cellCount?: number
}>()

const emit = defineEmits<{
  export: []
  'edit-status': []
  delete: []
  clear: []
}>()

const total = computed(() => props.rowCount + (props.cellCount ?? 0))

const label = computed(() => {
  if (props.rowCount > 0 && props.cellCount && props.cellCount > 0) {
    return `${props.rowCount} ligne${props.rowCount > 1 ? 's' : ''} + ${props.cellCount} cellule${props.cellCount > 1 ? 's' : ''} sélectionnée${total.value > 1 ? 's' : ''}`
  }
  if (props.rowCount > 0) {
    return `${props.rowCount} produit${props.rowCount > 1 ? 's' : ''} sélectionné${props.rowCount > 1 ? 's' : ''}`
  }
  return `${props.cellCount} cellule${(props.cellCount ?? 0) > 1 ? 's' : ''} sélectionnée${(props.cellCount ?? 0) > 1 ? 's' : ''}`
})
</script>

<template>
  <Teleport to="body">
    <div v-if="total > 0" class="bulk-action-bar">
      <MActionBottomBar shadow>
        <template #left>
          <span class="bulk-action-bar__label">{{ label }}</span>
        </template>
        <template #right>
          <MButton outlined size="s" @click="emit('export')">Exporter</MButton>
          <MButton
            outlined
            size="s"
            :disabled="rowCount === 0"
            @click="emit('edit-status')"
          >
            Modifier le statut
          </MButton>
          <MButton
            appearance="danger"
            size="s"
            :disabled="rowCount === 0"
            @click="emit('delete')"
          >
            Supprimer
          </MButton>
          <MButton ghost size="s" @click="emit('clear')">Annuler</MButton>
        </template>
      </MActionBottomBar>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.bulk-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: var(--color-background-primary, #fff);
  border-top: 1px solid var(--color-border-primary, #e2e8f0);
}

.bulk-action-bar__label {
  font-weight: 600;
  color: var(--color-text-primary, #0f172a);
}
</style>
