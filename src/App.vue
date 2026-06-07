<script setup lang="ts">
/**
 * App root — deux modes de rendu :
 *
 *   • `?fixtures=<state>` dans l'URL → fixtures de régression visuelle
 *     (consommées par `e2e/visual.spec.ts`).
 *   • Sinon → `AppShell` (la vraie demo app servie à `/adeo-grid-app/`).
 *
 * `StockDemo.vue` historique reste dispo (vues, e2e) mais n'est plus
 * l'entrée par défaut.
 */

import GridFixtures from '@/views/GridFixtures.vue'
import AppShell from '@/app/AppShell.vue'

const isFixtureMode =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('fixtures')
</script>

<template>
  <GridFixtures v-if="isFixtureMode" />
  <AppShell v-else />
</template>
