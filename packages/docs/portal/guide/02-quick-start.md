# Quick Start

> Construire ton premier grid en 5 minutes — de l'install à un grid avec tri, filtres et virtualisation.

## Pré-requis

### Vue

- **Node** >= 20.19 ou >= 22.12
- **Vue** 3.5+ (Composition API)
- **Vite** 7 ou 8 (Rolldown supporté)
- **TypeScript** 5.9+ (recommandé en strict mode)

### Angular

- **Node** >= 20.19 ou >= 22.12
- **Angular** 21+ (standalone, signals, zoneless recommandé)
- **TypeScript** 5.9+

## 1. Install

### Vue

```bash
npm install @adeo/grid-vue @mozaic-ds/vue @mozaic-ds/icons-vue @mozaic-ds/styles @mozaic-ds/tokens
```

### Angular

```bash
npm install @adeo/grid-angular @mozaic-ds/angular @mozaic-ds/icons @mozaic-ds/styles @mozaic-ds/tokens
```

## 2. Charger le thème Mozaic

Choisis ton thème : `@mozaic-ds/tokens/theme` (Leroy Merlin par défaut), `/adeo/theme`, `/bricocenter/theme` ou `/mbrand/theme`.

### Vue

Dans ton `main.ts` :

```ts
import { createApp } from 'vue'
import '@mozaic-ds/tokens/theme'
import '@mozaic-ds/vue/style.css'
import App from './App.vue'

createApp(App).mount('#app')
```

### Angular

Dans `angular.json` (block `styles`) ou ton `styles.scss` global :

```scss
@import '@mozaic-ds/tokens/theme';
@import '@mozaic-ds/styles';
```

## 3. Premier grid

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { AdGridVue, type ColumnDef } from '@adeo/grid-vue'

const columns: ColumnDef[] = [
  { field: 'sku',   headerName: 'Référence', width: '120px', pinned: 'start' },
  { field: 'name',  headerName: 'Produit',   width: '260px', sortable: true, editable: true },
  { field: 'price', headerName: 'Prix',      width: '110px', sortable: true,
    valueFormatter: (v) => typeof v === 'number' ? `${v.toFixed(2)} €` : '' },
  { field: 'stock', headerName: 'Stock',     width: '100px', sortable: true, editable: true,
    cellEditor: 'number' },
]

const rows = ref([
  { sku: 'LM-001', name: 'Perceuse 18V Lexman', price: 79.9, stock: 42 },
  { sku: 'LM-002', name: 'Tondeuse électrique 1200W', price: 199, stock: 8 },
  { sku: 'LM-003', name: 'Mitigeur évier inox', price: 49, stock: 120 },
])
</script>

<template>
  <ad-grid-vue :columns="columns" :rows="rows" />
</template>
```

### Angular

```ts
import { Component, signal } from '@angular/core'
import { AdGridAngularComponent, type ColumnDef } from '@adeo/grid-angular'

@Component({
  selector: 'app-catalogue',
  imports: [AdGridAngularComponent],
  template: `<ad-grid-angular [columns]="columns()" [rows]="rows()" />`,
})
export class CatalogueComponent {
  columns = signal<ColumnDef[]>([
    { field: 'sku',   headerName: 'Référence', width: '120px', pinned: 'start' },
    { field: 'name',  headerName: 'Produit',   width: '260px', sortable: true, editable: true },
    { field: 'price', headerName: 'Prix',      width: '110px', sortable: true,
      valueFormatter: (v) => typeof v === 'number' ? `${v.toFixed(2)} €` : '' },
    { field: 'stock', headerName: 'Stock',     width: '100px', sortable: true, editable: true,
      cellEditor: 'number' },
  ])

  rows = signal([
    { sku: 'LM-001', name: 'Perceuse 18V Lexman', price: 79.9, stock: 42 },
    { sku: 'LM-002', name: 'Tondeuse électrique 1200W', price: 199, stock: 8 },
    { sku: 'LM-003', name: 'Mitigeur évier inox', price: 49, stock: 120 },
  ])
}
```

Tu obtiens : un grid stylisé Mozaic, colonnes triables au click, cellules éditables au double-click ou F2, ligne `Référence` toujours visible (pinned start).

## 4. Tenir 100k lignes

La virtualisation (verticale + horizontale) est toujours active des deux côtés — pas d'input à brancher. Passe juste un `containerHeight` et un `rowId` stable.

### Vue

```vue
<ad-grid-vue
  :columns="columns"
  :rows="bigRows"
  :container-height="600"
  :row-id="(row) => String(row.sku)"
/>
```

### Angular

```ts
<ad-grid-angular
  [columns]="columns()"
  [rows]="bigRows()"
  [containerHeight]="600"
  [rowId]="rowIdFn" />
```

```ts
rowIdFn = (row: Product): string => String(row.sku)
```

> `rowId` est **fortement recommandé** dès qu'on dépasse quelques centaines de lignes — c'est ce qui permet à la sélection, aux formules et à l'expansion de survivre à un re-tri ou un lazy-load.

## 5. Pagination

### Vue

```vue
<ad-grid-vue
  :columns="columns"
  :rows="rows"
  :pagination="{ pageSizeOptions: [10, 25, 50, 100], defaultPageSize: 25 }"
  @page-change="onPage"
/>
```

### Angular

```ts
<ad-grid-angular
  [columns]="columns()"
  [rows]="rows()"
  [pagination]="{ pageSizeOptions: [10, 25, 50, 100], defaultPageSize: 25 }"
  (pageChange)="onPage($event)" />
```

L'événement `pageChange` remonte `{ page, pageSize, startIndex, endIndex }`.

## 6. Persistance du layout

Avec une clé stable, le grid sauve auto largeur / ordre / pin / sort / filtres en `localStorage` et les restaure au reload.

### Vue

```vue
<ad-grid-vue :columns="columns" :rows="rows" persist-key="catalogue-v1" />
```

### Angular

```ts
<ad-grid-angular [columns]="columns()" [rows]="rows()" [persistKey]="'catalogue-v1'" />
```

## 7. Brancher le toolbar et les drawers

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  AdGridVue,
  GridToolbar,
  TableMenuDrawer,
  GroupingDrawer,
  GridFilterDrawer,
} from '@adeo/grid-vue'

const settingsOpen = ref(false)
const groupingOpen = ref(false)
const filtersOpen  = ref(false)
const fullscreen   = ref(false)
</script>

<template>
  <ad-grid-vue :columns="columns" :rows="rows" :fullscreen="fullscreen">
    <template #toolbar>
      <ad-grid-toolbar
        show-fullscreen show-settings show-group show-filters
        :fullscreen="fullscreen"
        @toggle-fullscreen="fullscreen = !fullscreen"
        @settings="settingsOpen = !settingsOpen"
        @group="groupingOpen = !groupingOpen"
        @filters="filtersOpen = !filtersOpen"
      />
    </template>
  </ad-grid-vue>

  <ad-grid-settings-drawer v-model:open="settingsOpen" :columns="columns" />
  <ad-grid-grouping-drawer  v-model:open="groupingOpen"  :columns="columns" />
  <ad-grid-filter-drawer v-model:open="filtersOpen"  :columns="columns" />
</template>
```

### Angular

```ts
@Component({
  selector: 'app-catalogue',
  imports: [
    AdGridAngularComponent,
    AdeoGridToolbarComponent,
    MozTableMenuDrawerComponent,
    MozGroupingDrawerComponent,
    AdeoGridFilterDrawerComponent,
  ],
  template: `
    <ad-grid-angular [columns]="columns()" [rows]="rows()" [fullscreen]="fullscreen()">
      <ad-grid-toolbar
        slot="toolbar"
        [showFullscreen]="true" [showSettings]="true"
        [showGroup]="true" [showFilters]="true"
        [fullscreen]="fullscreen()"
        (toggleFullscreen)="fullscreen.set(!fullscreen())"
        (settings)="settingsOpen.set(!settingsOpen())"
        (group)="groupingOpen.set(!groupingOpen())"
        (filters)="filtersOpen.set(!filtersOpen())" />
    </ad-grid-angular>

    <moz-table-menu-drawer [(open)]="settingsOpen" [columns]="columns()" />
    <moz-grouping-drawer   [(open)]="groupingOpen" [columns]="columns()" />
    <ad-grid-filter-drawer [(open)]="filtersOpen" [columns]="columns()" />
  `,
})
export class CatalogueComponent {
  fullscreen = signal(false)
  settingsOpen = signal(false)
  groupingOpen = signal(false)
  filtersOpen = signal(false)
  // columns, rows…
}
```

> Quand `fullscreen` est activé, le grid devient `position: fixed; inset: 0`. Pour que la toolbar reste visible, place-la via le slot `toolbar` (Vue) ou le projection slot Angular du grid (et non en sœur du grid).

## Erreurs fréquentes

### 1. La dernière colonne ne remplit pas l'espace

La dernière colonne unpinned reçoit automatiquement `flex: 1 1 auto` dès que la somme des colonnes est inférieure à la largeur du wrapper. La virtualisation horizontale étant toujours active, ce mécanisme est désactivé dès que la slice de colonnes rendues change pendant le scroll (sinon la dernière colonne sauterait à chaque mouvement).

### 2. Le grid déborde sa carte parente

Mets le grid dans un parent `display: flex; flex-direction: column` avec une hauteur définie ; le wrapper interne prend le reste via `flex: 1; min-height: 0`.

### 3. Sort par click ne marche pas sur ma colonne

Vérifie que `sortable` n'est pas explicitement `false`. Le défaut est `true`. Tu peux opter pour Shift+click (multi-tri) ou utiliser `sortComparator` pour un ordre custom (grades énergie, locale FR, etc.).
