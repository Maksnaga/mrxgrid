# Bulk actions et sélection

> Sélection multi-rows via checkboxes, Ctrl+A → Delete sur des centaines de milliers de cellules, modal de confirmation pour les actions destructives, export du subset sélectionné.

## Étape 1 : Activer la sélection

### Vue

```vue
<ad-grid-vue
  …
  selectable
  selection-bar-compact
  @row-selection-change="onSelectionChange"
/>
```

### Angular

```ts
<ad-grid-angular
  …
  [selectable]="true"
  [selectionBarCompact]="true"
  (rowSelectionChange)="onSelectionChange($event)"
/>
```

- **`selectable`** — affiche la colonne checkbox à gauche
- **`selectionBarCompact`** — barre flottante en bas avec count + actions Edit/Copy/Paste/Delete (mode compact)
- **`rowSelectionChange`** — émis à chaque changement de sélection, payload `RowSelectionEvent`

```ts
export interface RowSelectionEvent<T> {
  selectedIds: Set<string>
  excludedIds: Set<string>     // utilisé seulement en mode 'all'
  selectedRows: T[]            // matérialisées dans la page courante uniquement
  mode: 'none' | 'page' | 'all'
  count: number                // count effectif (gère mode 'all' + excludedIds)
}
```

Deux modes de sélection :

- **`mode: 'page'` ou `'none'`** — sélection explicite par row id. `selectedIds` contient les rowIds cochés.
- **`mode: 'all'`** — Ctrl+A ou checkbox "tout" coché. `selectedIds` peut être vide, **`excludedIds`** liste les exclusions. Cette optimisation permet de "sélectionner tout sauf 3" sans matérialiser 500 000 ids.

> **Piège — gérer les deux modes.** Si tu lis `selectedIds` sans vérifier `mode`, tu rates les Ctrl+A. Pattern correct :
>
> ```ts
> function selectionCount(sel: RowSelectionEvent<unknown>, total: number): number {
>   return sel.mode === 'all' ? total - sel.excludedIds.size : sel.selectedIds.size
> }
> ```
>
> La propriété `count` du payload calcule déjà ça pour toi — préfère-la.

## Étape 2 : Gérer la sélection côté composant

### Vue

```ts
import { ref } from 'vue'
import type { RowSelectionEvent } from '@adeo/grid-vue'

const selectionIds = ref<number[] | 'ALL'>([])

function onSelectionChange(sel: RowSelectionEvent<AdeoProduct>): void {
  if (!sel || sel.count === 0) {
    selectionIds.value = []
    return
  }
  if (sel.mode === 'all') {
    // Ctrl+A — on a tous les ids sauf les exclus. Pour des actions bulk
    // sur "tout sauf 2", on appelle l'API avec un endpoint dédié
    // `DELETE /products?except=42,87` plutôt que de matérialiser le
    // tableau de millions d'ids.
    selectionIds.value = 'ALL'
  } else {
    selectionIds.value = Array.from(sel.selectedIds, Number).filter(
      (n): n is number => !Number.isNaN(n),
    )
  }
}
```

### Angular

```ts
import { signal } from '@angular/core'
import type { RowSelectionEvent } from '@adeo/grid-angular'

readonly selectionIds = signal<number[] | 'ALL'>([])

onSelectionChange(sel: RowSelectionEvent<AdeoProduct>): void {
  if (!sel || sel.count === 0) {
    this.selectionIds.set([])
    return
  }
  if (sel.mode === 'all') {
    this.selectionIds.set('ALL')
  } else {
    const ids = Array.from(sel.selectedIds, Number).filter(
      (n): n is number => !Number.isNaN(n),
    )
    this.selectionIds.set(ids)
  }
}
```

## Étape 3 : Bulk delete avec confirmation

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { deleteProducts } from '@/api'
import DeleteConfirmModal from '@/components/DeleteConfirmModal.vue'

const deleteModalOpen = ref(false)
const deleteIds = ref<number[]>([])
const deleting = ref(false)

function askDelete(ids: number[]): void {
  if (ids.length === 0) return
  deleteIds.value = ids
  deleteModalOpen.value = true
}

async function confirmDelete(): Promise<void> {
  deleting.value = true
  const rowIds = deleteIds.value.map(String)
  try {
    // Row-level pending : grise les lignes ciblées + spinner pendant
    // la suppression. L'utilisateur voit visuellement ce qui disparaît.
    await pending.withRowPending(rowIds, () => deleteProducts(deleteIds.value))
    toasts.success(`${deleteIds.value.length} produit(s) supprimé(s)`)
    deleteModalOpen.value = false
    selectionIds.value = []
    await list.refetch({ silent: true })
  } catch (err) {
    toasts.error((err as Error).message)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  …
  <DeleteConfirmModal
    v-model:open="deleteModalOpen"
    :count="deleteIds.length"
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
```

### Angular

```ts
import { signal } from '@angular/core'

readonly deleteModalOpen = signal(false)
readonly deleteIds = signal<number[]>([])
readonly deleting = signal(false)

askDelete(ids: number[]): void {
  if (ids.length === 0) return
  this.deleteIds.set(ids)
  this.deleteModalOpen.set(true)
}

async confirmDelete(): Promise<void> {
  this.deleting.set(true)
  const rowIds = this.deleteIds().map(String)
  try {
    await this.pending.withRowPending(rowIds, () =>
      this.api.deleteProducts(this.deleteIds()),
    )
    this.toasts.success(`${this.deleteIds().length} produit(s) supprimé(s)`)
    this.deleteModalOpen.set(false)
    this.selectionIds.set([])
    await this.list.refetch({ silent: true })
  } catch (err) {
    this.toasts.error((err as Error).message)
  } finally {
    this.deleting.set(false)
  }
}
```

```ts
// dans le template Angular
<delete-confirm-modal
  [(open)]="deleteModalOpen"
  [count]="deleteIds().length"
  [loading]="deleting()"
  (confirm)="confirmDelete()"
/>
```

## Étape 4 : La barre d'actions flottante

Quand des rows sont sélectionnées, une **action bar** apparaît en bas de la grille (ou flotte en bas du viewport en compact mode) :

```
┌──────────────────────────────────────────────────────────────────┐
│ 12 rows selected   [Edit] [Export] [Delete]              [Clear] │
└──────────────────────────────────────────────────────────────────┘
```

Tu peux remplacer entièrement cette barre par ton propre composant.

### Vue — slot `#action-bar`

```vue
<ad-grid-vue …>
  <template #action-bar="{ selection, clear }">
    <BulkActionBar
      :row-count="selectionIds.length"
      @export="onBulkExport"
      @edit-status="onBulkEditStatus"
      @delete="onBulkDelete"
      @clear="clear"
    />
  </template>
</ad-grid-vue>
```

### Angular — `[actionBarTemplate]`

```ts
<ad-grid-angular …>
  <ng-template #actionBar let-selection="selection" let-clear="clear">
    <bulk-action-bar
      [rowCount]="selectionIds().length"
      (export)="onBulkExport()"
      (editStatus)="onBulkEditStatus()"
      (delete)="onBulkDelete()"
      (clear)="clear()"
    />
  </ng-template>
</ad-grid-angular>
```

Ou laisse la barre par défaut et écoute les events :

### Vue

```vue
<ad-grid-vue …
  @bulk-delete="onBulkDelete"
  @bulk-copy="onBulkCopy"
  @selection-edit="onSelectionEdit"
/>
```

### Angular

```ts
<ad-grid-angular …
  (bulkDelete)="onBulkDelete()"
  (bulkCopy)="onBulkCopy()"
  (selectionEdit)="onSelectionEdit($event)"
/>
```

## Étape 5 : Ctrl+A → Delete sur 100k+ cellules

Quand l'utilisateur fait Ctrl+A en mode cell selection (pas row selection), il sélectionne **toutes les cellules** de toutes les rows × toutes les colonnes éditables. À ces échelles (1M+ cellules), tu **ne veux pas** que la lib émette un `cellEdit` par cellule — ce serait 1M de fan-out vers ton handler async = freeze.

La lib bascule automatiquement sur `bulkEdit` au-delà de 1000 cellules (l'alias historique `bulkCellEdit` est encore émis en parallèle pour back-compat en Vue — voir la note plus bas) :

### Vue

```vue
<ad-grid-vue …
  @cell-edit="onCellEdit"
  @bulk-edit="onBulkCellEdit"
/>
```

### Angular

```ts
<ad-grid-angular …
  (cellEdit)="onCellEdit($event)"
  (bulkEdit)="onBulkCellEdit($event)"
/>
```

### Handler (forme identique des deux côtés)

```ts
interface BulkEditEvent {
  changes: ReadonlyArray<{
    rowIndex: number
    field: string
    oldValue: unknown
    newValue: unknown
  }>
}

async function onBulkCellEdit(event: BulkEditEvent): Promise<void> {
  // Group changes par field pour minimiser les API calls.
  // 1M cellules effacées sur 7 champs → 7 PATCH au lieu d'1M.
  const byField = new Map<string, { ids: number[]; value: unknown }>()
  for (const c of event.changes) {
    const row = list.rows()[c.rowIndex]   // Angular : signal call ; Vue : list.rows.value[…]
    if (!row) continue
    let bucket = byField.get(c.field)
    if (!bucket) {
      bucket = { ids: [], value: c.newValue }
      byField.set(c.field, bucket)
    }
    bucket.ids.push(row.id)
  }

  list.refreshing.set(true)              // Vue : list.refreshing.value = true
  try {
    const promises = Array.from(byField.entries()).map(([field, b]) =>
      updateProducts(b.ids, { [field]: b.value }),
    )
    await Promise.all(promises)
    toasts.success(`${event.changes.length.toLocaleString('fr-FR')} cellules effacées`)
    await list.refetch({ silent: true })
  } catch (err) {
    toasts.error((err as Error).message)
  } finally {
    list.refreshing.set(false)           // Vue : list.refreshing.value = false
  }
}
```

> **Threshold du bulk emit.** La lib émet `bulkEdit` au-delà de **1000 changes** dans une seule opération (Ctrl+A → Delete, paste sur range). Sous ce seuil, c'est `cellEdit` per-cell pour préserver les semantics fines (validation, optimistic update, shimmer par cellule). Si tu wires `cellEdit` mais pas `bulkEdit`, le clear de Ctrl+A **ne fait rien** côté API. **Côté Vue uniquement** : un alias deprecated `bulkCellEdit` est émis en parallèle pour back-compat (sera retiré en v2.0) — wire-le si tu as du code legacy. Angular n'émet que `bulkEdit`.

## Étape 6 : Export — respect de la sélection

L'API impérative `exportCsv()` détecte automatiquement la sélection.

### Vue

```ts
const gridRef = ref<InstanceType<typeof Grid> | null>(null)

function onBulkExport(): void {
  // Si sélection → exporte juste les rows sélectionnées (default)
  // Sinon → exporte les rows visibles
  gridRef.value?.exportCsv?.({ filename: 'catalogue-selection.csv' })
}

function onExportAll(): void {
  gridRef.value?.exportCsv?.({ filename: 'catalogue-full.csv', scope: 'all' })
}
```

### Angular

```ts
readonly gridRef = viewChild<ad-grid-vue<AdeoProduct>>(Grid)

onBulkExport(): void {
  this.gridRef()?.exportCsv?.({ filename: 'catalogue-selection.csv' })
}

onExportAll(): void {
  this.gridRef()?.exportCsv?.({ filename: 'catalogue-full.csv', scope: 'all' })
}
```

Trois scopes possibles :

| Scope | Comportement |
|---|---|
| `'selection'` | Uniquement les rows sélectionnées (gère `mode: 'all'` + `excludedIds`) |
| `'visible'` | Rows actuellement rendues (post-filtre/tri, page courante) |
| `'all'` | `rows` complet, indépendamment des filtres/tri/pagination |

Par défaut, **`scope` est implicite** : `selection` s'il y a une sélection, sinon `visible`.

> **Piège — export sur 1M rows.** L'export sérialise tout en mémoire (une string géante puis un Blob). À 1M rows × 50 cols, c'est ~300 MB → Chrome crash. **Toujours scoper par sélection** sur les gros datasets. Si tu veux vraiment exporter 1M rows, génère le CSV **côté serveur** et stream le download — pas via la lib.

## Étape 7 : Pattern récap

Voici la structure finale recommandée, côte à côte.

### Vue

```ts
// vues/PimDashboard.vue
const list = useProductList()              // tuto 4 + 5
const pending = usePendingMutations()       // tuto 6
const toasts = useToaster()
const gridRef = ref<InstanceType<typeof Grid> | null>(null)

const selectionIds = ref<number[]>([])
function onSelectionChange(sel: RowSelectionEvent<AdeoProduct>) { /* … */ }

const deleteModalOpen = ref(false)
const deleteIds = ref<number[]>([])
function askDelete(ids: number[]) { /* … */ }
async function confirmDelete() { /* … */ }

async function onCellEdit(e: CellEditEvent) { /* … */ }
async function onBulkCellEdit(e: BulkEditEvent) { /* … */ }
```

```vue
<template>
  <ad-grid-vue
    ref="gridRef"
    :columns="adeoColumns"
    :rows="list.rows.value"
    :total-count="list.total.value"
    :row-id="(row) => String(row.id)"

    :loading="list.loading.value"
    :refreshing="list.refreshing.value"
    :error="list.error.value"

    :pending-cells="pending.pendingCells.value"
    :pending-row-ids="pending.pendingRowIds.value"

    selectable
    sort-mode="server"
    filter-mode="server"
    :sort="list.sort.value"
    v-model:filter-model="list.filterModel.value"

    :pagination="{ pageSize: list.pageSize.value, pageSizeOptions: [25, 50, 100, 200] }"
    :height="640"

    @page-change="(e) => { list.page.value = Math.max(0, e.page - 1); list.pageSize.value = e.pageSize }"
    @sort-change="list.onSortChange"
    @filter-change="list.onFilterChange"
    @cell-edit="onCellEdit"
    @bulk-edit="onBulkCellEdit"
    @bulk-cell-edit="onBulkCellEdit"
    @row-selection-change="onSelectionChange"
  />
</template>
```

### Angular

```ts
@Component({
  selector: 'pim-dashboard',
  imports: [Grid, DeleteConfirmModal],
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

      [pendingCells]="pending.pendingCells()"
      [pendingRowIds]="pending.pendingRowIds()"

      [selectable]="true"
      sortMode="server"
      filterMode="server"
      [sort]="list.sort()"
      [(filterModel)]="list.filterModel"

      [pagination]="{ pageSize: list.pageSize(), pageSizeOptions: [25, 50, 100, 200] }"
      [height]="640"

      (pageChange)="onPageChange($event)"
      (sortChange)="list.onSortChange($event)"
      (filterChange)="onFilterChange($event)"
      (cellEdit)="onCellEdit($event)"
      (bulkEdit)="onBulkCellEdit($event)"
      (rowSelectionChange)="onSelectionChange($event)"
    />
    <delete-confirm-modal
      [(open)]="deleteModalOpen"
      [count]="deleteIds().length"
      (confirm)="confirmDelete()"
    />
  `,
})
export class PimDashboardComponent {
  readonly list = inject(ProductListService)
  readonly pending = inject(PendingMutationsService)
  // …
}
```

## Étape 8 : Test rapide

1. **Cocher 3 rows → barre flottante "3 rows selected"** apparaît
2. **Click Export depuis la barre** → CSV téléchargé avec 3 rows
3. **Click Delete → modal de confirmation** → confirmer → rows disparaissent, refetch silencieux
4. **Ctrl+A en cell mode → Delete** → `bulkEdit` émis, regroupé par field, ~10 API calls, refresh silencieux
5. **Vérifier la stabilité** : aucune action ne doit déclencher le squelette plein écran (sauf le `refetch` explicite)

## Prochaine étape

[Tutoriel 8 — Gotchas (annexe)](?path=/docs/tutoriel-gotchas--docs) : l'index de tous les pièges Vue + Angular + Mozaic + adeo-grid documentés inline, avec les workarounds et les versions où ils sont fixés.
