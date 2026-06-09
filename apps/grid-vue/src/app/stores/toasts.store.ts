/**
 * Toasts store — queue de notifications globales.
 *
 * Les actions de l'app (création / édition / suppression / erreur réseau)
 * pushent ici, le composant `AppToaster` lit la queue et rend les `MToaster`
 * Mozaic empilés en bas à droite.
 *
 * Auto-dismiss après 4s. Le user peut fermer manuellement avant.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Statut MToaster Mozaic — drive l'icône (✓ / ⚠ / ✕ / ⓘ) et la couleur.
 * Aligné 1-pour-1 avec le prop `status` du composant pour zéro
 * conversion au binding (cf. `AppToaster.vue`).
 */
export type ToastStatus = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  status: ToastStatus
  message: string
  /** Optional — bouton d'action affiché à droite du toast (ex. "Réessayer"). */
  action?: { label: string; onClick: () => void }
}

const AUTO_DISMISS_MS = 4_000

export const useToastsStore = defineStore('demo-toasts', () => {
  const queue = ref<Toast[]>([])
  let nextId = 0
  const timers = new Map<number, ReturnType<typeof setTimeout>>()

  function push(toast: Omit<Toast, 'id'>): number {
    const id = ++nextId
    queue.value = [...queue.value, { id, ...toast }]
    const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    timers.set(id, timer)
    return id
  }

  function dismiss(id: number): void {
    queue.value = queue.value.filter((t) => t.id !== id)
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
  }

  // Helpers — la signature courte qu'on appelle dans 90% des cas.
  const success = (message: string) => push({ status: 'success', message })
  const error = (message: string, action?: Toast['action']) =>
    push({ status: 'error', message, action })
  const info = (message: string) => push({ status: 'info', message })
  const warning = (message: string) => push({ status: 'warning', message })

  return { queue, push, dismiss, success, error, info, warning }
})
