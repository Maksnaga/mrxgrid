# Fetch + pagination serveur

> On passe du JSON statique à une vraie API REST paginée. États `loading` / `error` / `empty` câblés proprement. Architecture composable (Vue) / service injectable (Angular) inspirée d'`useProductList` qu'on utilise en interne.

## Le contrat API

On suppose une API REST qui répond à ce contrat :

```http
GET /api/products?page=0&pageSize=50&sort=adeoKey:asc

200 OK
{
  "rows": [
    { "id": 1, "adeoKey": "82023619", "productBrand": "INSPIRE", ... },
    ...
  ],
  "total": 4231
}
```

Le `total` est le nombre **total** de produits côté serveur (toutes pages confondues). Le grid s'en sert pour calculer le footer de pagination (`X de Y items`, nb de pages, etc.).

## Étape 1 : Le store / composable de fetch

C'est le pattern qu'on recommande : **séparer la fetch logic du composant**. Côté Vue, un composable qui expose des refs + une fonction `refetch` impérative. Côté Angular, un service `providedIn: 'root'` avec des signals + une méthode `refetch`. Le grid n'a pas à connaître l'API, il consomme juste des valeurs réactives.

### Vue — composable

```ts
// src/composables/useProductList.ts
import { ref, watch, type Ref } from 'vue'
import type { AdeoProduct } from '@/types'

export interface UseProductListReturn {
  rows: Ref<AdeoProduct[]>
  total: Ref<number>
  loading: Ref<boolean>
  refreshing: Ref<boolean>
  error: Ref<Error | null>

  page: Ref<number>
  pageSize: Ref<number>

  refetch: (opts?: { silent?: boolean }) => Promise<void>
}

export function useProductList(): UseProductListReturn {
  const rows = ref<AdeoProduct[]>([])
  const total = ref(0)
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref<Error | null>(null)

  const page = ref(0)
  const pageSize = ref(50)

  // Token pour ignorer les réponses tardives (race condition classique).
  let fetchToken = 0

  async function refetch(opts?: { silent?: boolean }): Promise<void> {
    const myToken = ++fetchToken
    const silent = opts?.silent === true

    if (silent) refreshing.value = true
    else loading.value = true
    error.value = null

    try {
      const resp = await fetch(
        `/api/products?page=${page.value}&pageSize=${pageSize.value}`,
      )
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data: { rows: AdeoProduct[]; total: number } = await resp.json()
      if (myToken !== fetchToken) return // une requête plus récente a gagné
      rows.value = data.rows
      total.value = data.total
    } catch (e) {
      if (myToken !== fetchToken) return
      error.value = e as Error
    } finally {
      if (myToken === fetchToken) {
        if (silent) refreshing.value = false
        else loading.value = false
      }
    }
  }

  watch([page, pageSize], () => void refetch())
  void refetch()

  return { rows, total, loading, refreshing, error, page, pageSize, refetch }
}
```

### Angular — service

```ts
// src/app/services/product-list.service.ts
import { Injectable, inject, signal, effect } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'
import type { AdeoProduct } from '../types'

interface ProductListResponse {
  rows: AdeoProduct[]
  total: number
}

@Injectable({ providedIn: 'root' })
export class ProductListService {
  private readonly http = inject(HttpClient)

  readonly rows = signal<AdeoProduct[]>([])
  readonly total = signal(0)
  readonly loading = signal(false)
  readonly refreshing = signal(false)
  readonly error = signal<Error | null>(null)

  readonly page = signal(0)
  readonly pageSize = signal(50)

  private fetchToken = 0

  constructor() {
    // Re-fetch automatique sur changement de page / pageSize.
    effect(() => {
      this.page()
      this.pageSize()
      void this.refetch()
    })
  }

  async refetch(opts?: { silent?: boolean }): Promise<void> {
    const myToken = ++this.fetchToken
    const silent = opts?.silent === true

    if (silent) this.refreshing.set(true)
    else this.loading.set(true)
    this.error.set(null)

    try {
      const data = await firstValueFrom(
        this.http.get<ProductListResponse>(
          `/api/products?page=${this.page()}&pageSize=${this.pageSize()}`,
        ),
      )
      if (myToken !== this.fetchToken) return
      this.rows.set(data.rows)
      this.total.set(data.total)
    } catch (e) {
      if (myToken !== this.fetchToken) return
      this.error.set(e as Error)
    } finally {
      if (myToken === this.fetchToken) {
        if (silent) this.refreshing.set(false)
        else this.loading.set(false)
      }
    }
  }
}
```

> **Note — pourquoi le `fetchToken` ?** Sans, si l'utilisateur change vite de page (page 1 -> page 2 -> page 3), les réponses peuvent arriver dans le désordre (page 3 arrive avant page 2 si page 2 est lente). Sans token, tu écris le contenu de page 2 par-dessus page 3 et l'utilisateur voit la mauvaise donnée. Le token garantit que **seule la dernière requête en vol gagne le droit d'écrire `rows`**.

## Étape 2 : Brancher dans le composant

### Vue

```vue
<!-- src/views/PimList.vue -->
<script setup lang="ts">
import { AdGridVue } from '@adeo/grid-vue'
import { useProductList } from '@/composables/useProductList'
import { adeoColumns } from '@/columns'

const list = useProductList()

function onPageChange(e: { page: number; pageSize: number }): void {
  // L'événement page-change émet 1-based (footer parle en "page 1 / 200")
  // alors que l'API attend 0-based. Conversion ici.
  list.page.value = Math.max(0, e.page - 1)
  list.pageSize.value = e.pageSize
}

function retryFetch(): void {
  void list.refetch()
}
</script>

<template>
  <ad-grid-vue
    :columns="adeoColumns"
    :rows="list.rows.value"
    :total-count="list.total.value"
    :row-id="(row) => String(row.id)"
    :loading="list.loading.value"
    :refreshing="list.refreshing.value"
    :error="list.error.value"
    :height="640"
    :pagination="{ pageSize: list.pageSize.value, pageSizeOptions: [25, 50, 100, 200] }"
    @page-change="onPageChange"
  >
    <template #error="{ error, retry }">
      <div class="error-box">
        <p>{{ error.message }}</p>
        <button @click="retry ?? retryFetch">Reessayer</button>
      </div>
    </template>

    <template #empty>
      <div class="empty-box">
        <p>Aucun produit dans le catalogue.</p>
      </div>
    </template>
  </ad-grid-vue>
</template>
```

### Angular

```ts
// src/app/views/pim-list.component.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { AdGridVue, type PageEvent } from '@adeo/grid-angular'
import { ProductListService } from '../services/product-list.service'
import { adeoColumns } from '../columns'
import type { AdeoProduct } from '../types'

@Component({
  selector: 'pim-list',
  imports: [Grid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ad-grid-angular
      [columns]="columns"
      [rows]="list.rows()"
      [totalItems]="list.total()"
      [rowId]="rowId"
      [loading]="list.loading()"
      [refreshing]="list.refreshing()"
      [error]="list.error()"
      [height]="640"
      [pagination]="{ pageSize: list.pageSize(), pageSizeOptions: [25, 50, 100, 200] }"
      (pageChange)="onPageChange($event)"
    >
      <ng-template mozGridError let-error="error" let-retry="retry">
        <div class="error-box">
          <p>{{ error.message }}</p>
          <button (click)="retry ? retry() : retryFetch()">Reessayer</button>
        </div>
      </ng-template>

      <ng-template mozGridEmpty>
        <div class="empty-box">
          <p>Aucun produit dans le catalogue.</p>
        </div>
      </ng-template>
    </ad-grid-angular>
  `,
})
export class PimListComponent {
  readonly list = inject(ProductListService)
  readonly columns = adeoColumns

  rowId = (row: AdeoProduct): string => String(row.id)

  onPageChange(e: PageEvent): void {
    // pageChange émet 1-based, l'API attend 0-based.
    this.list.page.set(Math.max(0, e.page - 1))
    this.list.pageSize.set(e.pageSize)
  }

  retryFetch(): void {
    void this.list.refetch()
  }
}
```

## Étape 3 : Les états expliqués

- **`loading`** — `true` quand on attend la **première** réponse OU quand on change de page / pageSize (l'utilisateur s'attend à voir un feedback visible). Le grid remplace le body par un squelette plein.
- **`refreshing`** — `true` quand on resync **silencieusement** après une mutation (cell-edit, bulk action). Pas de squelette : la lib active juste le slot `loading` / `[mozGridRefreshing]` que tu peux remplir avec un spinner ou une barre fine custom. **Par défaut, aucun visuel.**
- **`error`** — un `Error` quand la dernière requête a échoué. Le grid affiche le slot `error` / `[mozGridError]` avec un retry.
- **`totalCount` / `totalItems`** — décorrèle la hauteur de la scrollbar du `rows.length` réel. Crucial en pagination serveur : avec `rows` qui a 50 items et `total: 4231`, le footer affiche "1-50 de 4231" correctement. (Vue : `totalCount` deprecated alias `totalItems`. Angular : `totalItems`.)

> **Piège — différence `loading` vs `refreshing`.** Si tu mets `loading: true` à chaque refetch (même après cell-edit), l'utilisateur voit le squelette plein écran clignoter à chaque modification. C'est brutal. **Règle :** `loading` pour les fetches user-driven (page, filter, search, premier load), `refreshing` pour les re-syncs post-mutation où les données sont déjà visibles.

## Étape 4 : Variantes pour les vrais projets

### Vue + Pinia

Sur un projet réel, tu veux pouvoir partager le store entre plusieurs vues. Pinia est l'idiom Vue 3.

```ts
// src/stores/products.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AdeoProduct } from '@/types'

export const useProductsStore = defineStore('products', () => {
  const rows = ref<AdeoProduct[]>([])
  const total = ref(0)
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref<Error | null>(null)

  const page = ref(0)
  const pageSize = ref(50)

  let fetchToken = 0

  async function refetch(opts?: { silent?: boolean }): Promise<void> {
    // ... même implémentation que `useProductList` ci-dessus
  }

  return { rows, total, loading, refreshing, error, page, pageSize, refetch }
})
```

Dans le composant :

```vue
<script setup lang="ts">
import { useProductsStore } from '@/stores/products'
import { storeToRefs } from 'pinia'

const store = useProductsStore()
const { rows, total, loading, refreshing, error, page, pageSize } = storeToRefs(store)
</script>
```

`storeToRefs` garde la réactivité quand tu destructures un store Pinia. Sans, tu perds la réactivité et le grid ne se met jamais à jour.

> **Note — `storeToRefs` vs `toRefs`.** `toRefs` marche aussi mais sur un state réactif générique. `storeToRefs` est spécifique Pinia et ignore les actions (qu'on veut pas wrapper en refs).

### Angular — service `providedIn: 'root'`

Côté Angular, le service est déjà un singleton partageable entre composants — pas besoin d'équivalent Pinia. Tu peux l'`inject()` dans n'importe quel composant pour partager `rows`, `total`, `loading`, etc.

```ts
// composant A
readonly list = inject(ProductListService)

// composant B
readonly list = inject(ProductListService) // même instance
```

Si tu veux isoler le state par feature, déclare le service sur le composant feature avec `providers: [ProductListService]` au lieu de `providedIn: 'root'`.

## Étape 5 : Test rapide

Mock l'API (côté Vue avec [MSW](https://mswjs.io/), côté Angular avec `HttpTestingController` ou MSW aussi), puis :

1. **Premier load** -> squelette plein écran ~1s -> rows visibles
2. **Changer de page** -> squelette plein écran ~1s -> rows visibles
3. **Erreur réseau** (coupe le wifi) -> slot error apparaît avec le message + bouton Retry
4. **Liste vide** (mock retourne `{rows: [], total: 0}`) -> slot empty affiche le message
5. **Race condition** : clique très vite page 1 -> 2 -> 3 -> la donnée affichée doit toujours correspondre à la dernière page demandée (jamais "page 2 affiche le contenu de page 1 car arrivé après")

## Prochaine étape

Tri et filtre serveur (à venir) : on délègue le tri et le filtrage au serveur via `sortMode='server'` / `filterMode='server'`. Le grid émet les events, le store re-fetch.
