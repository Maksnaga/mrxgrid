# Introduction

Grid est une bibliothèque de data grid haute performance, conçue pour gérer plusieurs centaines de milliers de lignes sans dégrader l'expérience utilisateur. Elle vise la parité fonctionnelle avec les leaders du marché (AG Grid, Handsontable) tout en s'intégrant nativement avec `@mozaic-ds`.

Deux implémentations partagent la même surface publique :

- **`@adeo/grid-vue`** — Vue 3.5, Composition API, `<script setup>`
- **`@adeo/grid-angular`** — Angular 21, standalone, signals, zoneless

Les deux libs émettent les mêmes événements, exposent les mêmes props et engines, et sont alimentées par la même spec (voir `Docs/Spec`).

## Pourquoi Grid ?

| Capacité | Détail |
|---|---|
| Virtualisation 2D | Lignes ET colonnes virtualisées indépendamment. 100k lignes × 200 colonnes restent fluides à 60 fps. |
| Architecture en engines | Une vingtaine d'engines ciblés (sort, group, edit, fill…) qui se composent à la demande. |
| Mozaic-native | 4 thèmes prêts (Leroy Merlin, Adeo, Bricocenter, MBrand). Composants Mozaic (tag / select / datepicker) built-in. |
| Excel-like UX | Sélection rectangulaire, fill handle, copy/cut/paste, formules `=A1*B2`, undo/redo. |
| Pipeline déclaratif | Tri → groupement → filtre → pagination → virtualisation. Chaque étape est observable. |
| Plugin API | Hook `plugins[]` pour écouter le moteur sans toucher au cœur (audit, telemetry…). |

## Vue d'ensemble en 30 secondes

### Vue

```vue
<script setup lang="ts">
import { AdGridVue, type ColumnDef } from '@adeo/grid-vue'

const columns: ColumnDef[] = [
  { field: 'sku',   headerName: 'Référence', width: '120px', pinned: 'start' },
  { field: 'name',  headerName: 'Produit',   width: '260px', editable: true },
  { field: 'price', headerName: 'Prix',      width: '110px', sortable: true },
]
const rows = [
  { sku: 'LM-001', name: 'Perceuse 18V', price: 79.9 },
  { sku: 'LM-002', name: 'Tondeuse électrique', price: 199 },
]
</script>

<template>
  <ad-grid-vue :columns="columns" :rows="rows" selectable />
</template>
```

### Angular

```ts
import { Component, signal } from '@angular/core'
import { AdGridAngularComponent, type ColumnDef } from '@adeo/grid-angular'

@Component({
  selector: 'app-catalogue',
  imports: [AdGridAngularComponent],
  template: `
    <ad-grid-angular
      [columns]="columns()"
      [rows]="rows()"
      [selectable]="true" />
  `,
})
export class CatalogueComponent {
  columns = signal<ColumnDef[]>([
    { field: 'sku',   headerName: 'Référence', width: '120px', pinned: 'start' },
    { field: 'name',  headerName: 'Produit',   width: '260px', editable: true },
    { field: 'price', headerName: 'Prix',      width: '110px', sortable: true },
  ])
  rows = signal([
    { sku: 'LM-001', name: 'Perceuse 18V', price: 79.9 },
    { sku: 'LM-002', name: 'Tondeuse électrique', price: 199 },
  ])
}
```

> Tour rapide : commence par **Quick Start** pour mettre en place ton premier grid, puis **Architecture** pour comprendre comment tout est branché. Les démos vivantes sont dans la section *Stories* des Storybooks Vue / Angular (boutons dans la toolbar du portail).

## Capacités principales

| Domaine | Ce qu'on peut faire |
|---|---|
| **Affichage** | Densité (compact / default / comfortable), full-screen, colonnes pinned start/end, ordre/largeur drag, custom renderers via `renderer` ou slot/template `cell-{field}` |
| **Sélection** | Cases à cocher (none/some/all), sélection rectangulaire de cellules (Excel), multi-range avec Ctrl+Click, raccourcis clavier complets |
| **Édition** | Inline F2 / dblclick / type-to-edit, éditeurs Mozaic (text/number/select/date), validators de cellule, fill handle, undo/redo |
| **Tri** | Click header (cycle asc/desc/none), Shift+click multi-sort, comparators custom par colonne |
| **Filtres** | Ligne de filtres inline, drawer multi-conditions (text/number/date/set/boolean), server-side via `serverFilter` |
| **Groupement** | 1 → N niveaux imbriqués, drawer drag-n-drop, server-side groupes via `serverGrouping` |
| **Données** | Pagination, virtual scroll vertical/horizontal, lazy infinite scroll via `onVisibleRangeChange` |
| **Avancé** | Formules `=A1*B2` + custom functions, persistance auto en `localStorage`, plugins, expandable rows, tree |

## Stack technique

```
 ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
 │                       <ad-grid-vue /> / <ad-grid-angular>                                     │
 │                                                                                               │
 │   ┌────────────────────────────────────────────────────┐   ┌─────────────┐   ┌──────────────┐ │
 │   │ Vue 3.5     │   │ Angular 21  │   │ TypeScript     │                                      │
 │   │ Comp. API   │   │ Standalone  │   │ strict         │                                      │
 │   └────────────────────────┬───────────────────────────┘   └──────┬──────┘   └──────┬───────┘ │
 │          │                 │                 │                                                │
 │          └─────────────────┼─────────────────┘                                                │
 │                            │                                                                  │
 │             ┌───────────────────────────────┐                                                 │
 │             │  @mozaic-ds/{vue|angular,     │                                                 │
 │             │   icons,styles,tokens}        │                                                 │
 │             └───────────────────────────────┘                                                 │
 │                                                                                               │
 └───────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Maturité

| Indicateur | Valeur |
|---|---|
| Tests unitaires Vue (Vitest + jsdom) | 319 / 319 |
| Tests unitaires Angular (Karma + Jasmine) | passants en CI |
| E2E (Playwright) | Visual regression sur 3 navigateurs |
| TypeScript | strict, `noUncheckedIndexedAccess` |
| Vulnérabilités (npm audit) | 0 |
| Lint (oxlint + eslint / angular-eslint) | Activé en pre-build |

## Que lire ensuite ?

| Si tu veux… | Va voir |
|---|---|
| Mettre en place un premier grid | **Quick Start** (Guide) |
| Comprendre comment c'est branché | **Architecture** (Guide) |
| Plonger dans le state central | **State & Engine** (Guide) |
| Maîtriser le scroll virtuel | **Virtualization** (Guide) |
| Voir le contrat complet par feature | Section **Spec** (chapitres A → E) |
| Voir des exemples concrets | Storybooks **Vue** / **Angular** (boutons toolbar) |
