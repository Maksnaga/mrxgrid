/**
 * Ref miroir qui ne se met à jour qu'après un délai d'inactivité.
 *
 * Usage type : champ de recherche qui ne déclenche le fetch qu'après
 * 300 ms sans frappe. On lit `debounced.value` dans les watchers ; on
 * écrit dans `input.value` pour exposer l'écriture côté UI.
 *
 * ```ts
 * const { input, debounced } = useDebouncedRef('', 300)
 * // <MTextInput v-model="input" />            ← écrit "Cuis…ine"
 * // watch(debounced, refetch)                 ← se déclenche 300 ms après "Cuisine"
 * ```
 */

import { ref, watch, onScopeDispose, type Ref } from 'vue'

export interface DebouncedRef<T> {
  /** Valeur live — bindée à l'input UI. */
  input: Ref<T>
  /** Valeur retardée — à observer dans les watchers / computed. */
  debounced: Ref<T>
}

export function useDebouncedRef<T>(initial: T, delayMs = 300): DebouncedRef<T> {
  const input = ref(initial) as Ref<T>
  const debounced = ref(initial) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(input, (next) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = next
      timer = null
    }, delayMs)
  })

  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
  })

  return { input, debounced }
}
