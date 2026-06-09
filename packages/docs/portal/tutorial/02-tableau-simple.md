# Tableau simple

> 5 colonnes x 10 lignes hardcodées, tri activé, ellipsis sur les longues valeurs. C'est le minimum vital pour comprendre la forme d'un `ColumnDef`.

## L'objectif

On veut afficher un catalogue mini de produits :

| ID | Nom               | Marque   | Prix    | Stock |
|----|-------------------|----------|---------|-------|
| 1  | Niveau a bulle    | Makita   | 1148.98 | 68    |
| 2  | Poignee meuble    | Geolia   | 452.38  | 42    |
| ...| ...               | ...      | ...     | ...   |

Triable par colonne, redimensionnable. Pas d'API, pas de pagination — juste un tableau statique.

## Étape 1 : Définir le type de la donnée

```ts
// src/types.ts
export interface Product {
  id: number
  name: string
  brand: string
  price: number
  stock: number
}
```

## Étape 2 : Définir les colonnes

C'est le concept central. Un `ColumnDef<T>` (Vue) / `GridColumn<T>` (Angular) décrit **une colonne** : quel champ lire dans la row, quel label afficher, quels comportements activer.

### Vue

```ts
// src/columns.ts
import type { ColumnDef } from '@adeo/grid-vue'
import type { Product } from './types'

export const productColumns: ColumnDef<Product>[] = [
  {
    field: 'id',
    headerName: 'ID',
    width: '80px',
    sortable: true,
    editable: false,
  },
  {
    field: 'name',
    headerName: 'Produit',
    width: '240px',
    sortable: true,
    filterable: true,
  },
  {
    field: 'brand',
    headerName: 'Marque',
    width: '140px',
    sortable: true,
    groupable: true,
  },
  {
    field: 'price',
    headerName: 'Prix',
    width: '120px',
    sortable: true,
    valueFormatter: (v) => typeof v === 'number' ? `${v.toFixed(2)} €` : '',
  },
  {
    field: 'stock',
    headerName: 'Stock',
    width: '100px',
    sortable: true,
    cellClass: (row) => row.stock < 50 ? 'cell-low-stock' : '',
  },
]
```

### Angular

```ts
// src/app/columns.ts
import type { GridColumn } from '@adeo/grid-angular'
import type { Product } from './types'

export const productColumns: GridColumn<Product>[] = [
  {
    field: 'id',
    headerName: 'ID',
    width: '80px',
    sortable: true,
    editable: false,
  },
  {
    field: 'name',
    headerName: 'Produit',
    width: '240px',
    sortable: true,
    filterable: true,
  },
  {
    field: 'brand',
    headerName: 'Marque',
    width: '140px',
    sortable: true,
    groupable: true,
  },
  {
    field: 'price',
    headerName: 'Prix',
    width: '120px',
    sortable: true,
    valueFormatter: (v) => typeof v === 'number' ? `${v.toFixed(2)} €` : '',
  },
  {
    field: 'stock',
    headerName: 'Stock',
    width: '100px',
    sortable: true,
    cellClass: (row) => row.stock < 50 ? 'cell-low-stock' : '',
  },
]
```

Quelques propriétés clés :

- **`field`** — la clé dans la row. `row[field]` est lu pour afficher la cellule.
- **`headerName`** — le label affiché en haut de la colonne.
- **`width`** — largeur initiale en CSS. L'utilisateur peut redimensionner (sauf si `resizable: false`).
- **`sortable`** — active la flèche de tri au clic sur l'en-tête.
- **`filterable`** — active l'input dans la filter row inline (sous les en-têtes).
- **`groupable`** — active "Group by" dans le menu drawer de groupement.
- **`editable`** — autorise le double-clic / Enter pour entrer en édition.
- **`valueFormatter`** — transforme la valeur **uniquement pour l'affichage**. La donnée sous-jacente reste intacte.
- **`cellClass`** — applique une classe CSS conditionnelle (utile pour highlight les valeurs hors-norme).

> **Piège.** `width: '120px'` est une string CSS, pas un nombre. Réflexe JS : `width: 120` ne marche pas et tu vas chercher pendant 10 min pourquoi ta colonne fait 0 px.

## Étape 3 : La donnée

```ts
// src/data.ts (Vue) — équivalent côté Angular : src/app/data.ts
import type { Product } from './types'

export const products: Product[] = [
  { id: 1, name: 'Niveau a bulle 60cm', brand: 'Makita', price: 1148.98, stock: 68 },
  { id: 2, name: 'Poignee de meuble inox', brand: 'Geolia', price: 452.38, stock: 42 },
  { id: 3, name: 'Metre ruban 5m', brand: 'Adel', price: 215.36, stock: 157 },
  { id: 4, name: 'Tondeuse electrique 1500W', brand: 'Geolia', price: 474.80, stock: 166 },
  { id: 5, name: 'Poignee meuble laiton', brand: 'Stanley', price: 216.25, stock: 58 },
  { id: 6, name: 'Scie circulaire 1200W', brand: 'Stanley', price: 1191.95, stock: 106 },
  { id: 7, name: 'Bache de protection 3x4m', brand: 'Lexman', price: 782.78, stock: 40 },
  { id: 8, name: 'Evier inox 1 bac', brand: 'Black & Decker', price: 796.29, stock: 161 },
  { id: 9, name: 'Spot LED encastrable', brand: 'Bosch', price: 826.71, stock: 186 },
  { id: 10, name: 'Boite rangement clous', brand: 'Sensea', price: 80.93, stock: 23 },
]
```

## Étape 4 : Le composant

### Vue

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { AdGridVue } from '@adeo/grid-vue'
import { productColumns } from './columns'
import { products } from './data'
</script>

<template>
  <ad-grid-vue
    :columns="productColumns"
    :rows="products"
    :row-id="(row) => String(row.id)"
    :height="640"
  />
</template>

<style>
.cell-low-stock {
  color: var(--color-text-danger, #c62828);
  font-weight: bold;
}
</style>
```

### Angular

```ts
// src/app/app.component.ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core'
import { AdGridVue } from '@adeo/grid-angular'
import { productColumns } from './columns'
import { products } from './data'
import type { Product } from './types'

@Component({
  selector: 'app-root',
  imports: [Grid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ad-grid-angular
      [columns]="columns()"
      [rows]="rows()"
      [rowId]="rowId"
      [height]="640"
    />
  `,
  styles: [`
    .cell-low-stock {
      color: var(--color-text-danger, #c62828);
      font-weight: bold;
    }
  `],
})
export class AppComponent {
  columns = signal(productColumns)
  rows = signal<Product[]>(products)
  rowId = (row: Product): string => String(row.id)
}
```

`rowId` est important : c'est la fonction qui donne une identité stable à chaque row. Le grid s'en sert pour les `key` (perf de la virtualisation), pour la sélection, pour le tracking des pending mutations. **Sans `rowId`, le grid utilise l'index** — ça marche tant que la liste ne bouge pas, mais dès que tu trie/filtre, l'identité saute et tu perds la sélection.

> **Convention.** `rowId` doit retourner une string, et la string doit être unique dans tout le dataset. Une `id` numérique convertie en string fait très bien l'affaire (`String(row.id)`).

## Étape 5 : Le résultat

À l'écran, tu dois voir :

- 5 colonnes alignées avec le `headerName`
- 10 rows de données
- Au survol du header, une flèche apparaît + un kebab menu
- Au clic sur le header, la colonne se trie (`Produit ascending` puis re-clic pour `descending`)
- Au resize d'une colonne, la nouvelle largeur tient (min 120 px)
- La colonne "Stock" affiche en rouge gras les valeurs < 50 (40, 42, 23)
- La colonne "Prix" affiche `1148.98 €` au lieu de `1148.98`

## Étape 6 : Activer les drawers (settings, filters, group)

La toolbar par défaut affiche déjà des icônes pour fullscreen, settings, filters, group, keyboard shortcuts. Clique sur l'icône "settings" (engrenage) : un drawer s'ouvre où tu peux toggle la visibilité de chaque colonne et changer la densité.

Pas de wiring à faire — c'est inclus par défaut. Si tu veux les **désactiver**, tu remplaces le slot toolbar par ton propre contenu (vide ou custom).

### Vue

```vue
<ad-grid-vue :columns="..." :rows="...">
  <template #toolbar>
    <!-- vide : pas de toolbar du tout -->
  </template>
</ad-grid-vue>
```

### Angular

```ts
@Component({
  template: `
    <ad-grid-angular [columns]="columns()" [rows]="rows()">
      <ng-template mozGridToolbar>
        <!-- vide : pas de toolbar du tout -->
      </ng-template>
    </ad-grid-angular>
  `,
})
```

## Prochaine étape

[Tutoriel 3 — Tableau complexe](?path=/docs/tutoriel-tableau-complexe--docs) : on passe à 58 colonnes x 424 lignes (le PIM Adeo) avec renderers custom (badges Yes/No, formatters kg/cm), pinned column, virtual columns, group bar.
