/**
 * UI store — préférences globales de l'app de démo.
 *
 * `slowNetwork` est consommé par `mock/latency.ts` pour multiplier la
 * latence par 4. Le toggle vit dans le header de l'app. État volontairement
 * minimal (pas de theme, pas de sidebar collapsed) — la démo reste sobre.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('demo-ui', () => {
  const slowNetwork = ref(false)

  function toggleSlowNetwork(): void {
    slowNetwork.value = !slowNetwork.value
  }

  return { slowNetwork, toggleSlowNetwork }
})
