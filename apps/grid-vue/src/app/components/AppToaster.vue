<script setup lang="ts">
/**
 * Monte un container fixe en bas à droite et y empile les `MToaster` Mozaic
 * issus du store `toasts`. Le store gère la file et l'auto-dismiss — le
 * composant est uniquement la projection visuelle.
 */

import { MToaster } from '@mozaic-ds/vue'
import { useToastsStore } from '../stores/toasts.store'

const toasts = useToastsStore()
</script>

<template>
  <div class="app-toaster" aria-live="polite" aria-atomic="false">
    <!-- MToaster Mozaic exige `:open="true"` pour s'afficher (default
         false → invisible). Chaque entrée de notre queue EST un toast
         actif → toujours open. La fermeture vient soit du `dismiss`
         (auto-timer 4s) côté store, soit du bouton X (event
         `update:open(false)` qu'on route vers le même dismiss). -->
    <MToaster
      v-for="toast in toasts.queue"
      :key="toast.id"
      open
      :status="toast.status"
      :description="toast.message"
      closable
      @update:open="(v: boolean) => { if (!v) toasts.dismiss(toast.id) }"
    >
      <template v-if="toast.action" #action>
        <button type="button" class="app-toaster__action" @click="toast.action.onClick">
          {{ toast.action.label }}
        </button>
      </template>
    </MToaster>
  </div>
</template>

<style scoped lang="scss">
.app-toaster {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;

  // Les enfants sont interactifs même si le container ne l'est pas — évite
  // de bloquer les clics derrière la zone vide en haut de la pile.
  > * {
    pointer-events: auto;
  }
}

.app-toaster__action {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-weight: 600;
  text-decoration: underline;
  padding: 0;
}
</style>
