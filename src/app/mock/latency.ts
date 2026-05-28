/**
 * Helpers de simulation réseau pour le mock API.
 *
 * `delay()` — latence aléatoire 200-800 ms (× 4 si `ui.slowNetwork` ON).
 * `maybeThrow(rate)` — chance de lever une erreur réseau pour démo retry.
 *
 * Volontairement découplé de Pinia via une fonction-getter pour rester
 * testable et éviter une dépendance import-circulaire avec les stores.
 */

import { useUiStore } from '../stores/ui.store'

const MIN_LATENCY_MS = 200
const MAX_LATENCY_MS = 800
const SLOW_MULTIPLIER = 4

/** Attend une latence aléatoire. Bypass `slowNetwork` via le store UI. */
export async function delay(): Promise<void> {
  const base = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS)
  const ms = useUiStore().slowNetwork ? base * SLOW_MULTIPLIER : base
  await new Promise((r) => setTimeout(r, ms))
}

/**
 * Lance une erreur "réseau" avec probabilité `rate` (défaut 2 %). Le grid
 * affiche alors le slot `#error` avec un bouton "Réessayer".
 */
export function maybeThrow(rate = 0.02): void {
  if (Math.random() < rate) {
    throw new Error('Erreur réseau simulée — réessayez.')
  }
}
