# Édition + persistance optimiste

> L'utilisateur double-clique une cellule, change la valeur, presse Enter. La cellule se met à jour **immédiatement** (optimistic), shimmer pendant l'API call, refresh silencieux après. Rollback si l'API échoue.

## Le scénario

```
User                  Grid                     Composable           API
 │ double-click       │                         │                    │
 ├───────────────────▶│ entre en édition        │                    │
 │ change valeur      │                         │                    │
 │ Enter              │                         │                    │
 ├───────────────────▶│ applyFills mute la row  │                    │
 │                    │ emit('cellEdit')        │                    │
 │                    ├────────────────────────▶│                    │
 │                    │                         │ pending shimmer ON │
 │                    │                         │ PATCH /products/42 │
 │                    │                         ├───────────────────▶│
 │                    │                         │      …             │
 │                    │                         │ ◀──────────────────┤
 │                    │                         │ pending shimmer OFF│
 │                    │                         │ refetch silent     │
```

## Étape 1 : Marquer les colonnes éditables

`editable: true` active le double-click / Enter. `cellEditor` choisit le widget rendu en mode édition — même clé en Vue et en Angular.

```ts
{
  field: 'productBrand',
  headerName: 'Marque',
  editable: true,                     // ← active double-click / Enter
  cellEditor: 'text',                 // 'text' | 'number' | 'select' | 'date' | 'textarea' | 'checkbox' | 'toggle'
}

{
  field: 'wetRoomCompatibility',
  headerName: 'Pièce humide',
  editable: true,
  cellEditor: 'select',
  cellEditorOptions: [
    { value: true, label: 'Yes' },
    { value: false, label: 'No' },
    { value: null, label: '—' },
  ],
}
```

`'text'` (input text), `'number'` (input number), `'select'` (combobox Mozaic), `'date'` (input type=date natif), `'textarea'`, `'checkbox'`, `'toggle'`, `'custom'` (template/slot fournit l'éditeur).

## Étape 2 : Le composable / service de pending mutations

Le grid expose une prop `pendingCells` qui prend une liste `{ rowId, field }`. Chaque cellule listée reçoit un overlay shimmer pour signaler "en cours d'écriture serveur". Pattern recommandé : un mini composable / service qui gère le Set.

### Vue

```ts
// src/composables/usePendingMutations.ts
import { ref, computed } from 'vue'

interface CellRef { rowId: string; field: string }

export function usePendingMutations() {
  const _cells = ref<Set<string>>(new Set())   // "rowId|field" keys
  const _rowIds = ref<Set<string>>(new Set())

  const pendingCells = computed<CellRef[]>(() =>
    Array.from(_cells.value).map((k) => {
      const [rowId, ...rest] = k.split('|')
      return { rowId, field: rest.join('|') }
    }),
  )

  const pendingRowIds = computed<string[]>(() => Array.from(_rowIds.value))

  async function withCellsPending<T>(
    cells: CellRef[],
    fn: () => Promise<T>,
  ): Promise<T> {
    const keys = cells.map((c) => `${c.rowId}|${c.field}`)
    const next = new Set(_cells.value)
    for (const k of keys) next.add(k)
    _cells.value = next
    try {
      return await fn()
    } finally {
      const after = new Set(_cells.value)
      for (const k of keys) after.delete(k)
      _cells.value = after
    }
  }

  async function withCellPending<T>(rowId: string, field: string, fn: () => Promise<T>): Promise<T> {
    return withCellsPending([{ rowId, field }], fn)
  }

  async function withRowPending<T>(rowIds: string[], fn: () => Promise<T>): Promise<T> {
    const next = new Set(_rowIds.value)
    for (const id of rowIds) next.add(id)
    _rowIds.value = next
    try {
      return await fn()
    } finally {
      const after = new Set(_rowIds.value)
      for (const id of rowIds) after.delete(id)
      _rowIds.value = after
    }
  }

  return { pendingCells, pendingRowIds, withCellPending, withCellsPending, withRowPending }
}
```

### Angular

```ts
// src/app/services/pending-mutations.service.ts
import { Injectable, computed, signal } from '@angular/core'

interface CellRef { rowId: string; field: string }

@Injectable({ providedIn: 'root' })
export class PendingMutationsService {
  private readonly _cells = signal<Set<string>>(new Set())
  private readonly _rowIds = signal<Set<string>>(new Set())

  readonly pendingCells = computed<CellRef[]>(() =>
    Array.from(this._cells()).map((k) => {
      const [rowId, ...rest] = k.split('|')
      return { rowId, field: rest.join('|') }
    }),
  )

  readonly pendingRowIds = computed<string[]>(() => Array.from(this._rowIds()))

  async withCellsPending<T>(cells: CellRef[], fn: () => Promise<T>): Promise<T> {
    const keys = cells.map((c) => `${c.rowId}|${c.field}`)
    const next = new Set(this._cells())
    for (const k of keys) next.add(k)
    this._cells.set(next)
    try {
      return await fn()
    } finally {
      const after = new Set(this._cells())
      for (const k of keys) after.delete(k)
      this._cells.set(after)
    }
  }

  withCellPending<T>(rowId: string, field: string, fn: () => Promise<T>): Promise<T> {
    return this.withCellsPending([{ rowId, field }], fn)
  }

  async withRowPending<T>(rowIds: string[], fn: () => Promise<T>): Promise<T> {
    const next = new Set(this._rowIds())
    for (const id of rowIds) next.add(id)
    this._rowIds.set(next)
    try {
      return await fn()
    } finally {
      const after = new Set(this._rowIds())
      for (const id of rowIds) after.delete(id)
      this._rowIds.set(after)
    }
  }
}
```

## Étape 3 : Handler `cellEdit`

### Vue

```vue
<script setup lang="ts">
import { AdGridVue, type CellEditEvent } from '@adeo/grid-vue'
import { useProductList } from '@/composables/useProductList'
import { usePendingMutations } from '@/composables/usePendingMutations'
import { useToaster } from '@/composables/useToaster'
import { updateProduct } from '@/api'
import { adeoColumns } from '@/columns'

const list = useProductList()
const pending = usePendingMutations()
const toasts = useToaster()

async function onCellEdit(e: CellEditEvent): Promise<void> {
  // 1. No-op si la valeur n'a pas changé.
  if (e.oldValue === e.newValue) return

  const row = list.rows.value[e.rowIndex]
  if (!row) return

  // 2. Le grid a déjà appliqué le changement sur `row[field]` via son
  //    `applyFills` interne. La cellule affiche déjà la nouvelle valeur
  //    (optimistic). On déclenche le call API.
  try {
    await pending.withCellPending(String(row.id), e.field, () =>
      updateProduct(row.id, { [e.field]: e.newValue }),
    )
    toasts.success('Modification enregistrée')
  } catch (err) {
    toasts.error((err as Error).message, {
      label: 'Réessayer',
      onClick: () => void list.refetch(),
    })
    // resync silencieux avec le serveur (qui a la version canonique).
    await list.refetch({ silent: true })
  }
}
</script>

<template>
  <ad-grid-vue
    :columns="adeoColumns"
    :rows="list.rows.value"
    :total-count="list.total.value"
    :loading="list.loading.value"
    :refreshing="list.refreshing.value"
    :row-id="(row) => String(row.id)"

    :pending-cells="pending.pendingCells.value"
    :pending-row-ids="pending.pendingRowIds.value"

    :height="640"
    @cell-edit="onCellEdit"
  />
</template>
```

### Angular

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { AdGridVue, type CellEditEvent } from '@adeo/grid-angular'
import { ProductListService } from '../services/product-list.service'
import { PendingMutationsService } from '../services/pending-mutations.service'
import { ToasterService } from '../services/toaster.service'
import { ProductApiService } from '../services/product-api.service'
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
      [loading]="list.loading()"
      [refreshing]="list.refreshing()"
      [rowId]="rowId"

      [pendingCells]="pending.pendingCells()"
      [pendingRowIds]="pending.pendingRowIds()"

      [height]="640"
      (cellEdit)="onCellEdit($event)"
    />
  `,
})
export class PimListComponent {
  readonly list = inject(ProductListService)
  readonly pending = inject(PendingMutationsService)
  private readonly toasts = inject(ToasterService)
  private readonly api = inject(ProductApiService)
  readonly columns = adeoColumns

  rowId = (row: AdeoProduct): string => String(row.id)

  async onCellEdit(e: CellEditEvent<AdeoProduct>): Promise<void> {
    if (e.oldValue === e.newValue) return

    const row = this.list.rows()[e.rowIndex]
    if (!row) return

    try {
      await this.pending.withCellPending(String(row.id), e.field, () =>
        this.api.updateProduct(row.id, { [e.field]: e.newValue }),
      )
      this.toasts.success('Modification enregistrée')
    } catch (err) {
      this.toasts.error((err as Error).message, {
        label: 'Réessayer',
        onClick: () => void this.list.refetch(),
      })
      await this.list.refetch({ silent: true })
    }
  }
}
```

## Étape 4 : Le flow visuel

L'utilisateur voit, dans l'ordre :

1. **Pendant l'édition** — bordure bleue autour de la cellule, input visible.
2. **Après Enter** — la cellule affiche la nouvelle valeur (mais shimmer overlay = écriture en cours).
3. **Quand l'API répond** — shimmer disparaît, toast vert "Modification enregistrée".

Si l'API échoue :

3'. **Erreur** — shimmer disparaît, toast rouge avec bouton "Réessayer", refetch silencieux qui remet la valeur serveur (le `applyFills` optimiste est annulé).

## Étape 5 : Pourquoi `silent: true` après mutation

Si tu fais un refetch sans `silent`, tu déclenches le squelette plein écran à chaque cellule éditée. C'est moche et inutile — la donnée est déjà visible, on veut juste resync sans perturber.

Avec `silent: true`, le composable / service bump `refreshing` au lieu de `loading`. Le grid n'affiche pas de squelette. Le slot `#loading` (Vue) ou `[mozGridRefreshing]` (Angular) du consumer peut afficher une barre fine custom, OU rien du tout (par défaut, aucun visuel).

> **Piège — réactivité du `groupTree` après cell-edit.** Si tu groupes par un champ puis tu édites une cellule de ce champ, la row devrait migrer dans le bon bucket. La lib bump un compteur `dataVersion` interne dans `applyFills` qui invalide la cascade `filteredRows → sortedRows → groupTree`. Si ta row ne migre pas, vérifie ta version. Avant ce fix, le workaround était de remplacer le tableau entier côté consumer. Le graphe Angular invalide automatiquement, le contrat Vue est manuel — porté par la lib.

## Étape 6 : Édition d'un champ "complexe"

Pour les champs non-scalaires (objets, listes) ou les éditeurs custom (autocomplete, datepicker enrichi), utilise un slot (Vue) / un template (Angular).

### Vue — slot `#edit-{field}`

```vue
<ad-grid-vue …>
  <template #edit-brand="{ field, rowIndex, editValue, updateValue, commit, cancel }">
    <BrandComboEditor
      :model-value="editValue"
      @update:model-value="updateValue"
      @commit="commit('down')"
      @cancel="cancel"
    />
  </template>
</ad-grid-vue>
```

### Angular — `editTemplate` sur la `ColumnDef`

```ts
@Component({
  template: `
    <ad-grid-angular [columns]="columns" [rows]="rows()">
      <ng-template #brandEditor let-ctx>
        <brand-combo-editor
          [modelValue]="ctx.editValue"
          (update:modelValue)="ctx.updateValue($event)"
          (commit)="ctx.commit('down')"
          (cancel)="ctx.cancel()"
        />
      </ng-template>
    </ad-grid-angular>
  `,
})
export class PimListComponent {
  readonly brandEditor = viewChild<TemplateRef<unknown>>('brandEditor')

  readonly columns = computed(() => [
    {
      field: 'productBrand',
      editable: true,
      cellEditor: 'custom',
      editTemplate: this.brandEditor(),
    },
    // …
  ])
}
```

Le scope fourni à l'éditeur (slot Vue / contexte de template Angular) est le même des deux côtés :

- `field` / `rowIndex` — identité de la cellule en édition
- `editValue` — la valeur courante du draft (avant commit)
- `updateValue(v)` — mute le draft (réactif, change pas encore la row)
- `commit(direction)` — valide + déplace l'active cell (`'down'`, `'up'`, `'left'`, `'right'`, `null`)
- `cancel()` — annule l'édition (Escape)

> **Piège — slot `#edit-{field}` qui mange ses props (Vue).** Si tu écris `<template #edit-brand>` sans le destructuring `{ field, rowIndex, … }`, tes props arrivent en `undefined` et tu perds le wiring. **Toujours destructurer le scope.** Côté Angular, l'équivalent est de bien déclarer `let-ctx` (ou `let-field="field"` etc.) sur le `<ng-template>` — sans, le contexte n'est pas exposé dans le template.

## Étape 7 : Validation avant commit

Tu veux refuser certaines valeurs (ex : prix négatif). `cellEditorValidator` est identique des deux côtés :

```ts
{
  field: 'price',
  editable: true,
  cellEditor: 'number',
  cellEditorValidator: (value, row) => {
    if (typeof value !== 'number') return 'Doit être un nombre'
    if (value < 0) return 'Prix négatif refusé'
    return true
  },
}
```

Le validator est appelé avant le commit. S'il retourne `false` ou une string (message d'erreur), le commit est annulé et l'utilisateur reste en édition. Le message est affiché en tooltip sur la cellule.

## Étape 8 : Test rapide

1. **Édition simple** → double-click cellule → tape valeur → Enter → shimmer ~300ms → toast "Modification enregistrée"
2. **Édition + erreur réseau** → mock l'API pour throw → toast rouge avec retry → la cellule revient à l'ancienne valeur après silent refetch
3. **Édition + cancel** → double-click → Escape → la cellule reprend l'ancienne valeur, aucun call API
4. **Édition + click ailleurs** → la valeur est commitée (blur = commit) → call API part
5. **Édition d'un champ groupé** → la row doit migrer dans le nouveau bucket après commit (cf. piège ci-dessus)

## Prochaine étape

[Tutoriel 7 — Bulk actions et sélection](?path=/docs/tutoriel-bulk-actions-et-sélection--docs) : sélection multi-rows, Ctrl+A → Delete sur 100k cellules, export sélection seulement, modal de confirmation pour les actions destructives.
