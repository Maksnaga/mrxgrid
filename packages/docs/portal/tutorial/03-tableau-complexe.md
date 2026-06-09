# Tableau complexe (Adeo PIM)

> 58 colonnes x 424 lignes (catalogue wallpaper INSPIRE), renderers Yes/No avec badge coloré, formatters d'unités (kg, cm, %), pinned column, group bar. C'est le scénario "vraie largeur PIM".

## La donnée

On charge un export PIM réel — 58 champs par produit, structures hétérogènes (identifiants, booléens, dimensions, certifications recyclé, etc.). La forme typée :

```ts
// src/types.ts
export interface AdeoProduct {
  id: number
  adeoKey: string
  productBrand: string | null
  typeOfProduct: string | null
  collection: string | null
  colour: string | null
  netWeight: number | null
  manufactureEuropeanUnion: boolean | null
  wetRoomCompatibility: boolean | null
  fireproof: boolean | null
  containsWood: boolean | null
  // ... 50 autres champs
  [key: string]: unknown
}
```

Les `null` viennent du parsing CSV : les cellules vides du fichier source deviennent `null` côté typage. C'est ce qu'on va vouloir distinguer visuellement de `false` (= "non, explicitement").

## Étape 1 : Renderer custom — badge Yes/No

Le renderer accepte soit `'text'` ou `'tag'` (built-in), soit un **composant Vue / Angular** que tu fournis. Pour distinguer `true` / `false` / `null` on écrit notre propre composant.

### Vue

```ts
// src/renderers/YesNoRenderer.ts
import { defineComponent, h, markRaw, type PropType } from 'vue'
import { MTag } from '@mozaic-ds/vue'

function coerceYesNo(v: unknown): true | false | null {
  if (v === true || v === 'true' || v === 'Yes') return true
  if (v === false || v === 'false' || v === 'No') return false
  return null
}

export const YesNoRenderer = markRaw(
  defineComponent({
    name: 'YesNoRenderer',
    props: {
      value: { type: null as unknown as PropType<unknown>, default: null },
    },
    setup(props) {
      return () => {
        const v = coerceYesNo(props.value)
        if (v === true) return h(MTag, { type: 'success', size: 's', label: 'Yes' })
        if (v === false) return h(MTag, { type: 'danger', size: 's', label: 'No' })
        return h('span', { style: 'color: #94a3b8' }, '-')
      }
    },
  }),
)
```

### Angular

```ts
// src/app/renderers/yes-no-renderer.component.ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { MTag } from '@mozaic-ds/angular'

function coerceYesNo(v: unknown): true | false | null {
  if (v === true || v === 'true' || v === 'Yes') return true
  if (v === false || v === 'false' || v === 'No') return false
  return null
}

@Component({
  selector: 'yes-no-renderer',
  imports: [MTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('yes') { <moz-tag type="success" size="s" label="Yes" /> }
      @case ('no')  { <moz-tag type="danger"  size="s" label="No"  /> }
      @default      { <span style="color: #94a3b8">-</span> }
    }
  `,
})
export class YesNoRendererComponent {
  value = input<unknown>(null)
  state = computed(() => {
    const v = coerceYesNo(this.value())
    return v === true ? 'yes' : v === false ? 'no' : 'empty'
  })
}
```

Côté Angular, on déclare le composant en `cellComponent` plutôt qu'en `renderer` (alias canonique partagé) :

```ts
{ field: 'wetRoomCompatibility', cellComponent: YesNoRendererComponent, ... }
```

> **Piège — coercion string vs boolean.** Si tu utilises `cellEditor: 'select'` avec des options `{ value: true, label: 'Yes' }` (boolean dans la value), le select Mozaic peut sérialiser les booleans en strings dans son `<option value>`. Après une édition, la valeur commitée est `"true"` (string) au lieu de `true` (boolean). D'où le `coerceYesNo` qui accepte les deux formes. Sinon ton renderer reçoit `"true"`, fait `value === true` qui échoue, et affiche le fallback `-` au lieu de `Yes`.

> **Piège (Vue uniquement) — `markRaw` obligatoire.** Si tu oublies `markRaw(defineComponent(...))`, Vue va wrap ton composant en reactive() à chaque accès, ce qui pète l'identité (`renderer !== renderer`) et génère des warnings + re-render au moindre changement. Côté Angular pas de soucis : tu passes une classe, pas une instance.

## Étape 2 : Formatters d'unités

Le `valueFormatter` transforme la valeur **brute** en **string affichée**. Il est appelé à chaque render de cellule, donc reste **pur et rapide**. Identique côté Vue et Angular :

```ts
// src/formatters.ts
export const fmtKg = (v: unknown): string =>
  typeof v === 'number' ? `${v.toLocaleString('fr-FR')} kg` : ''

export const fmtCm = (v: unknown): string =>
  typeof v === 'number' ? `${v.toLocaleString('fr-FR')} cm` : ''

export const fmtPercent = (v: unknown): string =>
  typeof v === 'number' ? `${v} %` : ''

export const fmtYears = (v: unknown): string =>
  typeof v === 'number' ? `${v} an${v > 1 ? 's' : ''}` : ''
```

## Étape 3 : Colonnes — pattern "hints"

Avec 58 colonnes, écrire chaque colonne à la main devient impraticable. On crée un mapping `field -> type` et on génère.

### Vue

```ts
// src/columns.ts
import type { ColumnDef } from '@adeo/grid-vue'
import type { AdeoProduct } from './types'
import { YesNoRenderer } from './renderers/YesNoRenderer'
import { fmtKg, fmtCm, fmtPercent, fmtYears } from './formatters'

type Hint = 'id' | 'boolean' | 'brand' | 'enum' | 'kg' | 'cm' | 'percent' | 'years' | 'text' | 'longText'

const HINTS: Record<string, Hint> = {
  adeoKey: 'id',
  activeGtins: 'id',
  productBrand: 'brand',
  typeOfProduct: 'enum',
  collection: 'enum',
  wetRoomCompatibility: 'boolean',
  fireproof: 'boolean',
  manufactureEuropeanUnion: 'boolean',
  containsWood: 'boolean',
  netWeight: 'kg',
  packagedProductWidth: 'cm',
  packagedProductHeight: 'cm',
  minimumPercentageOfRecycledContentInTheProduct: 'percent',
  manufacturersCommercialWarranty: 'years',
  description: 'longText',
  // ... tous les autres
}

const WIDTHS: Record<Hint, string> = {
  id: '140px',
  brand: '120px',
  enum: '150px',
  longText: '280px',
  boolean: '90px',
  kg: '110px',
  cm: '110px',
  percent: '100px',
  years: '90px',
  text: '160px',
}

export function buildColumn(field: string, label: string): ColumnDef<AdeoProduct> {
  const hint = HINTS[field] ?? 'text'
  const col: ColumnDef<AdeoProduct> = {
    field,
    headerName: label,
    width: WIDTHS[hint],
    sortable: true,
    filterable: true,
    resizable: true,
    editable: hint !== 'id',
    groupable: hint === 'boolean' || hint === 'brand' || hint === 'enum',
  }

  if (field === 'adeoKey') col.pinned = 'start'

  switch (hint) {
    case 'boolean':
      col.renderer = YesNoRenderer
      col.cellEditor = 'select'
      col.cellEditorOptions = [
        { value: true, label: 'Yes' },
        { value: false, label: 'No' },
        { value: null, label: '-' },
      ]
      break
    case 'brand':
    case 'enum':
      col.renderer = 'tag'
      break
    case 'kg': col.valueFormatter = fmtKg; col.cellEditor = 'number'; break
    case 'cm': col.valueFormatter = fmtCm; col.cellEditor = 'number'; break
    case 'percent': col.valueFormatter = fmtPercent; col.cellEditor = 'number'; break
    case 'years': col.valueFormatter = fmtYears; col.cellEditor = 'number'; break
    case 'longText':
      col.maxWidth = '320px'
      break
  }

  return col
}
```

### Angular

```ts
// src/app/columns.ts
import type { GridColumn } from '@adeo/grid-angular'
import type { AdeoProduct } from './types'
import { YesNoRendererComponent } from './renderers/yes-no-renderer.component'
import { fmtKg, fmtCm, fmtPercent, fmtYears } from './formatters'

type Hint = 'id' | 'boolean' | 'brand' | 'enum' | 'kg' | 'cm' | 'percent' | 'years' | 'text' | 'longText'

const HINTS: Record<string, Hint> = {
  adeoKey: 'id',
  activeGtins: 'id',
  productBrand: 'brand',
  typeOfProduct: 'enum',
  collection: 'enum',
  wetRoomCompatibility: 'boolean',
  fireproof: 'boolean',
  manufactureEuropeanUnion: 'boolean',
  containsWood: 'boolean',
  netWeight: 'kg',
  packagedProductWidth: 'cm',
  packagedProductHeight: 'cm',
  minimumPercentageOfRecycledContentInTheProduct: 'percent',
  manufacturersCommercialWarranty: 'years',
  description: 'longText',
}

const WIDTHS: Record<Hint, string> = {
  id: '140px',
  brand: '120px',
  enum: '150px',
  longText: '280px',
  boolean: '90px',
  kg: '110px',
  cm: '110px',
  percent: '100px',
  years: '90px',
  text: '160px',
}

export function buildColumn(field: string, label: string): GridColumn<AdeoProduct> {
  const hint = HINTS[field] ?? 'text'
  const col: GridColumn<AdeoProduct> = {
    field,
    headerName: label,
    width: WIDTHS[hint],
    sortable: true,
    filterable: true,
    resizable: true,
    editable: hint !== 'id',
    groupable: hint === 'boolean' || hint === 'brand' || hint === 'enum',
  }

  if (field === 'adeoKey') col.pinned = 'start'

  switch (hint) {
    case 'boolean':
      col.cellComponent = YesNoRendererComponent
      col.cellEditor = 'select'
      col.cellEditorOptions = [
        { value: true, label: 'Yes' },
        { value: false, label: 'No' },
        { value: null, label: '-' },
      ]
      break
    case 'brand':
    case 'enum':
      col.renderer = 'tag'
      break
    case 'kg': col.valueFormatter = fmtKg; col.cellEditor = 'number'; break
    case 'cm': col.valueFormatter = fmtCm; col.cellEditor = 'number'; break
    case 'percent': col.valueFormatter = fmtPercent; col.cellEditor = 'number'; break
    case 'years': col.valueFormatter = fmtYears; col.cellEditor = 'number'; break
    case 'longText':
      col.maxWidth = '320px'
      break
  }

  return col
}
```

> **Piège — `maxWidth` sur les longs textes.** L'autosize au mount mesure le texte avec canvas `measureText`. Pour un `description` qui fait 200 caractères, ça donne ~1500 px. Sans `maxWidth`, ta colonne prend toute la viewport et tasse les autres. **Toujours `maxWidth` sur les colonnes texte long.**

> **Piège — un seul `pinned: 'start'` à la fois.** Pin plusieurs colonnes au start fait écraser 4-5 colonnes à gauche, et la zone center devient illisible. Garde **une seule colonne pinned** (en général l'identifiant) pour qu'elle serve de row header.

## Étape 4 : Le composant

### Vue

```vue
<!-- src/views/AdeoPimGrid.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { AdGridVue, type CellEditEvent } from '@adeo/grid-vue'
import { MTextInput } from '@mozaic-ds/vue'
import { Search24 } from '@mozaic-ds/icons-vue'
import productsData from './adeo-products.json'
import { buildColumn } from './columns'

interface ProductsPayload {
  meta: { fields: { key: string; label: string }[]; count: number }
  products: AdeoProduct[]
}

const payload = productsData as ProductsPayload

const columns = computed(() => payload.meta.fields.map((f) => buildColumn(f.key, f.label)))
const rows = ref<AdeoProduct[]>(payload.products.map((p) => ({ ...p })))

const searchInput = ref('')
const visibleRows = computed(() => {
  const q = searchInput.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((r) =>
    String(r.adeoKey).toLowerCase().includes(q) ||
    String(r.colour ?? '').toLowerCase().includes(q) ||
    String(r.collection ?? '').toLowerCase().includes(q),
  )
})

function onCellEdit(e: CellEditEvent): void {
  void e
}
</script>

<template>
  <section class="pim">
    <header class="pim__header">
      <div>
        <h2>PIM Adeo — INSPIRE wallpapers</h2>
        <p>{{ payload.meta.count }} produits · {{ columns.length }} colonnes</p>
      </div>
      <MTextInput v-model="searchInput" input-type="search" placeholder="ADEO key, GTIN, couleur...">
        <template #icon><Search24 /></template>
      </MTextInput>
    </header>

    <ad-grid-vue
      :columns="columns"
      :rows="visibleRows"
      :row-id="(row) => String(row.id)"
      :multi-sort="true"
      :height="640"
      selectable
      :pagination="{ pageSize: 50, pageSizeOptions: [25, 50, 100, 200] }"
      @cell-edit="onCellEdit"
    />
  </section>
</template>
```

### Angular

```ts
// src/app/views/adeo-pim-grid.component.ts
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core'
import { AdGridVue, type CellEditEvent, type GridColumn } from '@adeo/grid-angular'
import { MTextInput } from '@mozaic-ds/angular'
import productsData from './adeo-products.json'
import { buildColumn } from '../columns'
import type { AdeoProduct } from '../types'

interface ProductsPayload {
  meta: { fields: { key: string; label: string }[]; count: number }
  products: AdeoProduct[]
}

const payload = productsData as ProductsPayload

@Component({
  selector: 'adeo-pim-grid',
  imports: [Grid, MTextInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pim">
      <header class="pim__header">
        <div>
          <h2>PIM Adeo — INSPIRE wallpapers</h2>
          <p>{{ count }} produits · {{ columns().length }} colonnes</p>
        </div>
        <moz-text-input
          [(value)]="searchInput"
          inputType="search"
          placeholder="ADEO key, GTIN, couleur..."
        />
      </header>

      <ad-grid-angular
        [columns]="columns()"
        [rows]="visibleRows()"
        [rowId]="rowId"
        [multiSort]="true"
        [height]="640"
        [selectable]="true"
        [pagination]="{ pageSize: 50, pageSizeOptions: [25, 50, 100, 200] }"
        (cellEdit)="onCellEdit($event)"
      />
    </section>
  `,
  styles: [`
    .pim { display: flex; flex-direction: column; gap: 12px; }
    .pim__header { display: flex; justify-content: space-between; align-items: flex-end; }
  `],
})
export class AdeoPimGridComponent {
  readonly count = payload.meta.count

  columns = signal<GridColumn<AdeoProduct>[]>(
    payload.meta.fields.map((f) => buildColumn(f.key, f.label)),
  )
  rows = signal<AdeoProduct[]>(payload.products.map((p) => ({ ...p })))
  searchInput = signal('')

  visibleRows = computed(() => {
    const q = this.searchInput().trim().toLowerCase()
    if (!q) return this.rows()
    return this.rows().filter((r) =>
      String(r.adeoKey).toLowerCase().includes(q) ||
      String(r.colour ?? '').toLowerCase().includes(q) ||
      String(r.collection ?? '').toLowerCase().includes(q),
    )
  })

  rowId = (row: AdeoProduct): string => String(row.id)

  onCellEdit(e: CellEditEvent<AdeoProduct>): void {
    void e
  }
}
```

## Étape 5 : Notes sur les props clés

- **`multiSort`** — Shift+clic sur un header ajoute le tri au lieu de remplacer. Utile sur les PIM pour trier par brand puis par price.
- **`selectable`** — affiche la colonne checkbox à gauche. Active la sélection row-level.
- **`pagination`** — config de la pagination footer. `pageSize` et `pageSizeOptions` sont obligatoires. Si tu veux pas de pagination, ne passe pas la prop.
- **Virtualisation** — toujours active sur les deux axes, rien à brancher. Avec 58 colonnes, la slice horizontale ne rend que les colonnes du viewport (plus les pinned).

## Étape 6 : Group bar — comment ça marche

Active `groupable: true` sur quelques colonnes. Dans la toolbar par défaut, clique l'icône "Group" : un drawer s'ouvre où l'utilisateur choisit les champs à grouper. Une fois groupé :

- Une **group bar** apparaît au-dessus du header avec les chips des champs actifs (`Group by: Brand`)
- Les rows sont **bucketées** par valeur du champ
- Chaque bucket est une **group row** avec son count et son toggle expand/collapse

Sémantique côté code : le grid gère ça en interne, tu n'as rien à faire de plus que `groupable: true` sur les colonnes candidates.

> **Piège — éditer une cellule du champ groupé.** Quand tu groupes par `wetRoomCompatibility` puis tu édites une cellule vide (`null`) vers `true`, la row devrait migrer du bucket "(empty)" vers le bucket "Yes". À partir de la version `1.0.x` ça marche tout seul — la lib bump un `dataVersion` après chaque cell-edit qui invalide le groupTree. **Si tu vois la row ne pas migrer, mets ta version à jour.**

## Étape 7 : Résultat

À l'écran :

- ADEO key sticky à gauche (le checkbox de sélection aussi)
- Tags colorés Yes/No sur les booléens (vert / rouge)
- Formatters `1.5 kg`, `54.4 cm`, `30 %` sur les numériques
- Pagination 1-50 / 424 en footer
- Auto-size des colonnes au premier render (sample-based)
- Resize manuel avec floor à 120 px (pour que sort + kebab restent visibles)

## Prochaine étape

[Tutoriel 4 — Fetch + pagination serveur](?path=/docs/tutoriel-fetch-pagination-serveur--docs) : on remplace le JSON statique par un appel API paginé. On introduit Pinia (Vue) / un service Angular pour le store et `useProductList` côté composable.
