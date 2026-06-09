# Tri et filtre serveur

> Le client n'a pas toute la donnée — il ne peut pas trier ni filtrer localement. On dit au grid "envoie-moi un événement quand l'utilisateur change le tri / filtre, je m'occupe de re-fetch".

## Le contrat

Côté client, on flip deux props :

- `sortMode = 'server'` → le grid n'évalue pas le tri, il émet juste `sortChange` avec le nouveau state.
- `filterMode = 'server'` → idem pour le filtre.

Côté API, on étend le contrat :

```http
GET /api/products?page=0&pageSize=50
                 &sort=adeoKey:asc                       ← single sort
                 &sort=productBrand:desc&sort=price:asc  ← multi-sort
                 &filter[colour]=red                      ← inline filter row
                 &filter[productBrand][in]=INSPIRE,LUMENA ← builder set
                 &filter[price][gte]=100&filter[price][lte]=500 ← range
```

C'est à l'API de parser ces query params et de renvoyer la page filtrée + triée + le nouveau `total`.

## Étape 1 : Étendre le store / composable

On part du `useProductList` / `ProductListService` du [tutoriel 4](?path=/docs/tutoriel-fetch-pagination-serveur--docs) et on lui ajoute du sort + filter state. Les watchers / `effect()` déclenchent automatiquement un refetch dès que sort ou filter change.

### Vue

```ts
// src/composables/useProductList.ts
import { ref, watch } from 'vue'
import type { FilterModel } from '@adeo/grid-vue'

export function useProductList() {
  // … état existant (rows, total, loading, page, pageSize)

  // NOUVEAU : sort + filter state
  const sort = ref<{ field: string; direction: 'asc' | 'desc' } | null>(null)
  const filterModel = ref<FilterModel>({ conditions: [] })
  const quickFilters = ref<Record<string, unknown>>({})

  async function refetch(opts?: { silent?: boolean }): Promise<void> {
    // … début du refetch (token, loading)

    const params = new URLSearchParams()
    params.set('page', String(page.value))
    params.set('pageSize', String(pageSize.value))
    if (sort.value) {
      params.set('sort', `${sort.value.field}:${sort.value.direction}`)
    }
    for (const [field, value] of Object.entries(quickFilters.value)) {
      if (value != null && value !== '') {
        params.set(`filter[${field}]`, String(value))
      }
    }
    for (const c of filterModel.value.conditions) {
      if (c.value?.value != null) {
        params.set(`filter[${c.field}][${c.operator}]`, String(c.value.value))
      }
    }

    const resp = await fetch(`/api/products?${params}`)
    // … parse + écrire dans rows / total
  }

  // Watchers — toute mutation de sort/filter re-fetch.
  watch([sort], () => void refetch())
  watch([filterModel, quickFilters], () => {
    // Filter change → revenir à la page 1, sinon la page courante
    // peut être hors borne (filtré → total < page * pageSize).
    page.value = 0
    void refetch()
  }, { deep: true })

  function onSortChange(next: { field: string; direction: 'asc' | 'desc' } | null) {
    sort.value = next
  }

  function onFilterChange(filters: Record<string, unknown>) {
    quickFilters.value = { ...filters }
  }

  return {
    // … existant
    sort, filterModel, quickFilters,
    onSortChange, onFilterChange,
  }
}
```

### Angular

```ts
// src/app/services/product-list.service.ts
import { Injectable, inject, signal, effect } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import type { FilterModel, SortEvent } from '@adeo/grid-angular'

@Injectable({ providedIn: 'root' })
export class ProductListService {
  private readonly http = inject(HttpClient)

  // … état existant (rows, total, loading, page, pageSize)

  // NOUVEAU : sort + filter state (signals)
  readonly sort = signal<{ field: string; direction: 'asc' | 'desc' } | null>(null)
  readonly filterModel = signal<FilterModel>({ conditions: [] })
  readonly quickFilters = signal<Record<string, unknown>>({})

  constructor() {
    // Effet : changement de sort → refetch sur la page courante
    effect(() => {
      this.sort()
      void this.refetch()
    })
    // Effet : changement de filter → reset page à 0 puis refetch
    effect(() => {
      this.filterModel()
      this.quickFilters()
      this.page.set(0)
      void this.refetch()
    })
  }

  async refetch(opts?: { silent?: boolean }): Promise<void> {
    // … début du refetch (token, loading)

    let params = new HttpParams()
      .set('page', String(this.page()))
      .set('pageSize', String(this.pageSize()))

    const s = this.sort()
    if (s) params = params.set('sort', `${s.field}:${s.direction}`)

    for (const [field, value] of Object.entries(this.quickFilters())) {
      if (value != null && value !== '') {
        params = params.set(`filter[${field}]`, String(value))
      }
    }
    for (const c of this.filterModel().conditions) {
      if (c.value?.value != null) {
        params = params.set(`filter[${c.field}][${c.operator}]`, String(c.value.value))
      }
    }

    // … HttpClient call + écrire dans rows / total
  }

  onSortChange(e: SortEvent): void {
    const first = e.sorts[0]
    this.sort.set(first ? { field: first.field, direction: first.direction } : null)
  }

  onFilterChange(filters: Record<string, unknown>): void {
    this.quickFilters.set({ ...filters })
  }
}
```

> **Piège — reset à la page 1.** Si l'utilisateur est en page 5 et applique un filtre qui réduit le résultat à 30 lignes, la page 5 n'existe plus. Sans le `page.set(0)` / `page.value = 0` dans l'effet de filtre, l'API renvoie une page vide et l'utilisateur croit que son filtre a tout supprimé.

## Étape 2 : Brancher dans le composant

### Vue

```vue
<script setup lang="ts">
import { AdGridVue } from '@adeo/grid-vue'
import { useProductList } from '@/composables/useProductList'
import { adeoColumns } from '@/columns'

const list = useProductList()
</script>

<template>
  <ad-grid-vue
    :columns="adeoColumns"
    :rows="list.rows.value"
    :total-count="list.total.value"
    :loading="list.loading.value"
    :pagination="{ pageSize: list.pageSize.value, pageSizeOptions: [25, 50, 100] }"

    sort-mode="server"
    :sort="list.sort.value"

    filter-mode="server"
    v-model:filter-model="list.filterModel.value"

    :height="640"
    @page-change="(e) => { list.page.value = Math.max(0, e.page - 1); list.pageSize.value = e.pageSize }"
    @sort-change="list.onSortChange"
    @filter-change="list.onFilterChange"
  />
</template>
```

### Angular

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { AdGridVue, type PageEvent, type SortEvent, type FilterEvent } from '@adeo/grid-angular'
import { ProductListService } from '../services/product-list.service'
import { adeoColumns } from '../columns'

@Component({
  selector: 'pim-list',
  imports: [Grid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ad-grid-angular
      [columns]="columns"
      [rows]="list.rows()"
      [totalItems]="list.total()"
      [loading]="list.loading()"
      [pagination]="{ pageSize: list.pageSize(), pageSizeOptions: [25, 50, 100] }"

      sortMode="server"
      [sort]="list.sort()"

      filterMode="server"
      [(filterModel)]="list.filterModel"

      [height]="640"
      (pageChange)="onPageChange($event)"
      (sortChange)="list.onSortChange($event)"
      (filterChange)="onFilterChange($event)"
    />
  `,
})
export class PimListComponent {
  readonly list = inject(ProductListService)
  readonly columns = adeoColumns

  onPageChange(e: PageEvent): void {
    this.list.page.set(Math.max(0, e.page - 1))
    this.list.pageSize.set(e.pageSize)
  }

  onFilterChange(e: FilterEvent): void {
    // FilterEvent.model = builder ; on resync les quick filters via une dérivation
    // ou en lisant `e.condition` selon ton API. Ici on simplifie en flat record.
    const flat: Record<string, unknown> = {}
    for (const c of e.model.conditions) flat[c.field] = c.value?.value
    this.list.onFilterChange(flat)
  }
}
```

Trois nouveaux bindings clés :

- **`sortMode="server"` + `sort` + `sortChange`** — le grid affiche les flèches de tri sur les headers, mais n'évalue rien. Au clic, il émet `sortChange` avec le nouveau state, et tu pousses dans `sort.value` / `sort.set()`. Le watcher / `effect()` déclenche le refetch.
- **`filterMode="server"` + `filterModel` (two-way) + `filterChange`** — pareil pour le filtre. Le two-way binding gère le builder drawer (formal conditions), `filterChange` gère la filter row inline (quick filters). Les deux co-existent.
- **`totalCount` / `totalItems`** — toujours obligatoire en server mode pour que le footer affiche le bon total.

## Étape 3 : Le footer de pagination

Le footer affiche automatiquement :

```
Rows per page: [25 ▼]   1-50 of 4231 items                Page [1 ▼] of 85  ‹  ›
```

C'est généré à partir de :

- `pagination.pageSize` → "Rows per page"
- `rows.length` et l'offset interne → "1-50"
- `totalCount` / `totalItems` → "of 4231"
- `Math.ceil(totalItems / pageSize)` → "of 85"

Tu n'as rien à faire de plus que de passer les 3 props et de wirer `pageChange`.

## Étape 4 : Reset des filtres

Au-delà de l'UI native, tu veux peut-être un bouton "Effacer les filtres" custom :

### Vue

```ts
const gridRef = ref<InstanceType<typeof Grid> | null>(null)

function clearAllFilters() {
  gridRef.value?.clearFilters?.()
  // OU explicitement :
  list.quickFilters.value = {}
  list.filterModel.value = { conditions: [] }
}
```

### Angular

```ts
import { viewChild } from '@angular/core'

readonly gridRef = viewChild<ad-grid-vue<AdeoProduct>>(Grid)

clearAllFilters(): void {
  this.gridRef()?.clearFilters?.()
  // OU explicitement :
  this.list.quickFilters.set({})
  this.list.filterModel.set({ conditions: [] })
}
```

`grid.clearFilters()` est exposé par l'API impérative — il remet à zéro **les deux** surfaces (inline filter row + builder drawer).

## Étape 5 : Cas particulier — recherche libre

La recherche libre (texte plein) n'est ni un sort ni un filter structuré. On expose un `searchInput` à part avec un debounce de 300 ms pour éviter de hammer l'API à chaque keystroke.

### Vue

```ts
import { useDebouncedRef } from '@/composables/useDebouncedRef'

const { input: searchInput, debounced: searchDebounced } = useDebouncedRef('', 300)

watch(searchDebounced, () => {
  page.value = 0
  void refetch()
})

// Dans refetch :
if (searchDebounced.value) params.set('q', searchDebounced.value)
```

```vue
<MTextInput
  v-model="list.searchInput.value"
  input-type="search"
  placeholder="ADEO key, GTIN, couleur…"
/>
```

### Angular

```ts
import { signal, effect } from '@angular/core'
import { toObservable, toSignal } from '@angular/core/rxjs-interop'
import { debounceTime } from 'rxjs'

readonly searchInput = signal('')
private readonly searchDebounced = toSignal(
  toObservable(this.searchInput).pipe(debounceTime(300)),
  { initialValue: '' },
)

constructor() {
  effect(() => {
    this.searchDebounced()
    this.page.set(0)
    void this.refetch()
  })
}

// Dans refetch :
if (this.searchDebounced()) params = params.set('q', this.searchDebounced())
```

Le composant binde le `MTextInput` sur `searchInput` (non debouncée), l'effet écoute la version debouncée.

> **Piège — race condition sur la recherche.** Si l'utilisateur tape "abc" puis efface tout de suite "abcd", l'API peut renvoyer les résultats de "abc" après ceux de "abcd". Le `fetchToken` du [tutoriel 4](?path=/docs/tutoriel-fetch-pagination-serveur--docs) gère ça — vérifie qu'il est bien en place.

## Étape 6 : Test rapide

1. **Trier une colonne** → le grid émet `sortChange`, le watcher refetch, footer revient à page 1
2. **Taper "Stanley" dans le filter row** → `filterChange` → refetch avec `filter[brand]=Stanley`
3. **Ouvrir le builder drawer** → ajouter "price > 100" → le `filterModel` two-way met à jour le state → refetch
4. **Effacer la recherche** → la liste revient au complet
5. **Combiner sort + filter** → l'API doit recevoir tous les params en même temps, pas en 2 requêtes successives

## Prochaine étape

[Tutoriel 6 — Édition + persistance optimiste](?path=/docs/tutoriel-édition-persistance-optimiste--docs) : on rend le grid mutable, avec persistance API et pending shimmer sur les cellules en cours d'écriture.
