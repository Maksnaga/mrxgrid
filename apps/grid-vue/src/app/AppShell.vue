<script setup lang="ts">
/**
 * Shell racine de l'app de démo — version minimale.
 *
 * Plus de sidebar, plus de header, plus de KPIs. La page se résume au
 * grid + ses overlays (drawer / modals / bottom bar). `AppToaster` reste
 * monté en `position: fixed` pour afficher les confirmations
 * d'opérations sur le grid.
 */

import AppToaster from './components/AppToaster.vue'
import DemoPage from './DemoPage.vue'
</script>

<template>
  <div class="app-shell">
    <DemoPage />
    <AppToaster />
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  height: 100vh;
  background: var(--color-background-secondary, #f8fafc);
  color: var(--color-text-primary, #0f172a);
  font-family: var(--font-family), system-ui, -apple-system, sans-serif;
  padding: 24px;
  box-sizing: border-box;
  overflow: auto;
}
</style>
