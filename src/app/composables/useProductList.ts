/**
 * `useProductList` — état + chargement serveur-side d'une liste paginée
 * de produits. Pattern réutilisable : pagination + tri + filtres +
 * recherche debouncée + loading / error state + refetch impératif.
 *
 * Tous les changements d'input (page, sort, filterModel, search)
 * déclenchent automatiquement un re-fetch. Le consumer câble juste les
 * refs sur le `<MrxGrid>` :
 *
 *   const list = useProductList()
 *   <MrxGrid
 *     :rows="list.rows"
 *     :total-rows="list.total"
 *     :loading="list.loading"
 *     :error="list.error"
 *     v-model:filter-model="list.filterModel"
 *     @page-change="list.onPageChange"
 *     @sort-change="list.onSortChange"
 *   />
 */

import { computed, ref, watch, type Ref } from 'vue'
import type { FilterModel } from '@/components/MrxGrid'
import { fetchProducts, type FetchProductsParams, type FetchProductsResult } from '../mock/api'
import type { LMProduct } from '../mock/seed'
import { useDebouncedRef } from './useDebouncedRef'

export interface UseProductListReturn {
  rows: Ref<LMProduct[]>
  total: Ref<number>
  /**
   * `true` pendant TOUS les fetches (initial + page change + sort + filter
   * + search). Drive le skeleton plein écran sur `<MrxGrid :loading>`.
   */
  loading: Ref<boolean>
  error: Ref<Error | null>

  // Input refs — bindable au grid via v-model ou listeners.
  page: Ref<number>
  pageSize: Ref<number>
  sort: Ref<{ field: string; direction: 'asc' | 'desc' } | null>
  filterModel: Ref<FilterModel>
  /**
   * État de la filter row inline. Alimenté par l'event `@filter-change`
   * du grid (un record par colonne). Les valeurs sont opaques — types
   * gérés dans le mock API.
   */
  quickFilters: Ref<Record<string, unknown>>
  /** À binder sur un `<MTextInput v-model>` — debounce 300 ms appliqué en interne. */
  searchInput: Ref<string>

  /** Re-fetch impératif (utilisé après création / édition / suppression). */
  refetch: () => Promise<void>

  /** Handlers à câbler sur les évents du grid. */
  onPageChange: (e: { page: number; pageSize: number }) => void
  onSortChange: (sort: { field: string; direction: 'asc' | 'desc' } | null) => void
  onFilterChange: (filters: Record<string, unknown>) => void
}

export function useProductList(): UseProductListReturn {
  const rows = ref<LMProduct[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const page = ref(0)
  const pageSize = ref(25)
  const sort = ref<UseProductListReturn['sort']['value']>(null)
  const filterModel = ref<FilterModel>({ conditions: [] })
  const quickFilters = ref<Record<string, unknown>>({})
  const { input: searchInput, debounced: searchDebounced } = useDebouncedRef('', 300)

  /**
   * Un seul fetch en vol à la fois — si une 2e requête démarre avant
   * que la 1ère résolve, on ignore le résultat de la 1ère. Évite les
   * race conditions classiques (filter change rapide → réponses qui
   * arrivent dans le désordre).
   */
  let fetchToken = 0

  async function refetch(): Promise<void> {
    const myToken = ++fetchToken
    // Toujours `loading: true` — le skeleton plein écran sort à chaque
    // fetch (initial, page change, sort, filter, search). Visuellement
    // c'est plus brut qu'un "refresh silencieux" mais plus lisible : le
    // user voit clairement que ses données changent.
    loading.value = true
    error.value = null

    const params: FetchProductsParams = {
      page: page.value,
      pageSize: pageSize.value,
      sort: sort.value,
      filterModel: filterModel.value,
      quickFilters: quickFilters.value,
      search: searchDebounced.value,
    }

    try {
      const result: FetchProductsResult = await fetchProducts(params)
      if (myToken !== fetchToken) return // une requête plus récente a déjà gagné
      rows.value = result.rows
      total.value = result.total
    } catch (e) {
      if (myToken !== fetchToken) return
      error.value = e as Error
    } finally {
      if (myToken === fetchToken) loading.value = false
    }
  }

  // Watchers — toute mutation d'un input re-fetch. `deep` sur les
  // models parce que les conditions / record sont des objets.
  watch([page, pageSize, sort, searchDebounced], () => void refetch())
  watch([filterModel, quickFilters], () => {
    // Filter change → revenir à la première page, sinon l'utilisateur
    // peut se retrouver sur une page vide (filtré → total < pages × size).
    page.value = 0
    void refetch()
  }, { deep: true })

  // Bootstrap — premier fetch au mount du consumer.
  void refetch()

  function onPageChange(e: { page: number; pageSize: number }): void {
    // `e.page` est 1-based côté grid (le footer parle en "page 1 / 200"),
    // mais l'API mock raisonne en 0-based (`start = page × pageSize`).
    // On normalise ici — sans cette conversion la page 1 démarre à
    // l'offset `pageSize` et un changement de page-size (ex. 100 000)
    // saute par-dessus tout le dataset → catalogue vide.
    page.value = Math.max(0, e.page - 1)
    pageSize.value = e.pageSize
  }

  function onSortChange(next: { field: string; direction: 'asc' | 'desc' } | null): void {
    sort.value = next
  }

  function onFilterChange(next: Record<string, unknown>): void {
    quickFilters.value = { ...next }
  }

  return {
    rows,
    total,
    loading,
    error,
    page,
    pageSize,
    sort,
    filterModel,
    quickFilters,
    searchInput,
    refetch,
    onPageChange,
    onSortChange,
    onFilterChange,
  }
}
