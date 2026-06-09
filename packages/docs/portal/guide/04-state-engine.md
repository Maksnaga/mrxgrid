# State & Engine

> Comment l'état est centralisé, qui peut le lire, qui peut l'écrire, et pourquoi cette séparation est essentielle.

## Le pattern central

L'idée : **un seul state manager par instance de grid**, partagé via injection. Toutes les features lisent / écrivent à travers cet état. Aucune ne possède son propre état global. Ça permet :

- L'undo/redo cohérent (un seul state à snapshotter)
- La persistance `localStorage` en un seul tour
- Les plugins lisent l'état sans drilling
- Les tests unitaires : on stub le state et on teste les engines isolément

```
             ┌────────────────────────────────────────┐
             │   Grid state manager                   │
             │   = source de vérité (signals)         │
             └─┬──────────────────────────────────────┘
               │
       ┌───────┴───────┬───────┬───────┬─────────┬──────────┐
       ▼               ▼       ▼       ▼         ▼          ▼
   Grid engine      DI         tests   plugins  drawers   features
       │
       └─→ .sort .filter .group .formula .selection
           .cellValidation .tree .clipboard .history
```

Côté **Vue**, c'est `useGridState<T>()` (un composable retournant des `Ref<…>` / `ComputedRef<…>`), partagé via `provide()`.
Côté **Angular**, c'est la classe `GridStateManager<T>` (un `@Injectable()` au scope du composant grid), avec des `WritableSignal<…>` / `Signal<…>`.

Les noms de clés et leur sémantique sont **identiques**.

## La map du state

Voici les principales clés (signals dans les deux libs) :

| Clé | Type | Quoi |
|---|---|---|
| `sourceData` | `Signal<T[]>` | Données brutes en entrée (avant tri/group/filter) |
| `columnStates` | `WritableSignal<ColumnState[]>` | Par colonne : sort, sortIndex, hidden, pinned, visible, width |
| `visibleColumns` | `Signal<ColumnDef[]>` | Colonnes filtrées par visibilité, ordonnées (computed) |
| `columnDefMap` | `Signal<Map<string, ColumnDef>>` | Lookup O(1) par `field` (computed) |
| `activeSorts` | `WritableSignal<SortDef[]>` | Multi-sort stack (premier = primaire) |
| `filterModel` | `WritableSignal<FilterModel>` | Conditions du builder (drawer) |
| `quickFilters` | `WritableSignal<Record<string, unknown>>` | Inputs de la ligne de filtres header |
| `groupFields` | `WritableSignal<string[]>` | Champs de groupement (ordre = profondeur) |
| `cellEditState` | `WritableSignal<CellEditState>` | `{ editingCell, originalValue, draftValue, validationError }` |
| `cutSource` | `WritableSignal<CellRange \| null>` | Plage Ctrl+X en attente (marching ants) |
| `density` | `WritableSignal<GridDensity>` | `'small' \| 'default' \| 'large'` |
| `rowIdField` / `rowIdResolver` | — | Identifiant stable par ligne (formules, sélection cross-sort) |
| `expandedRowIds` | `WritableSignal<Set<unknown>>` | Lignes dépliées (partagé tree + expandable rows) |

## L'engine — les opérations

L'engine **n'a pas de state** propre — il prend le state en paramètre et expose des fonctions qui le lisent/écrivent.

### Vue

```ts
import { useGridState, useGridEngine } from '@adeo/grid-vue'

const state  = useGridState<Product>()
const engine = useGridEngine<Product>(state)

engine.sort.toggleSort('price', /* multi: */ false)   // single-sort par prix
engine.sort.clearSort()
engine.filter.setModel({ conditions: [...] }, 'replace')
engine.group.addField('category')
engine.formula.set({ rowId: '42', field: 'total' }, '=[qty]*[price]')
engine.selection.selectAll()
engine.clipboard.copy()      // copie la sélection courante
engine.history.undo()
```

### Angular

```ts
import { inject } from '@angular/core'
import { GridStateManager, GridEngine } from '@adeo/grid-angular'

const state  = inject(GridStateManager<Product>)
const engine = inject(GridEngine<Product>)

engine.sort.toggleSort('price', /* multi: */ false)
engine.sort.clearSort()
engine.filter.setModel({ conditions: [...] }, 'replace')
engine.group.addField('category')
engine.formula.set({ rowId: '42', field: 'total' }, '=[qty]*[price]')
engine.selection.selectAll()
engine.clipboard.copy()
engine.history.undo()
```

## API exposée par l'engine

Les méthodes ci-dessous existent à l'identique côté Vue et Angular.

| Sous-engine | Méthodes principales |
|---|---|
| `engine.sort` | `toggleSort(field, multi)`, `setSort(field, dir \| null)`, `clearSort()`, `sortData(rows)`, `getSortDirection(field)` |
| `engine.filter` | `setQuick(field, value)`, `setModel(model, mode)`, `clear()`, `filterData(rows)`, `activeCount` |
| `engine.group` | `addField(f)`, `removeField(f)`, `toggleGroup(key)`, `buildFlatList(rows)` |
| `engine.formula` | `set(addr, formula)`, `remove(addr)`, `valueAt(addr)`, `invalidate(addr)`, `registerFunction(name, impl)` |
| `engine.cellValidation` | `validateAll()`, `getCellError(rowIndex, field)`, `hasCellError(rowIndex, field)` |
| `engine.selection` | `selectRow(id)`, `toggleRow(id)`, `selectAll()`, `clear()` |
| `engine.clipboard` | `copy()`, `cut()`, `paste(htmlOrTsv)` |
| `engine.history` | `record(label, ops)`, `undo()`, `redo()`, `clear()` |
| `engine.tree` | `toggleNode(id)`, `expandAll()`, `collapseAll()` |

## Edition de cellule — cycle de vie complet

```
                    ┌─────────────────────────────────────────┐
   user dblclick ─→ │ engine.editing.startEdit(row, col)      │
   user F2          │  state.cellEditState = {                │
   user types       │     editingCell, originalValue,         │
                    │     draftValue: originalValue           │
                    │  }                                      │
                    └────────────────────┬────────────────────┘
                                         │
                  user types in editor   │
                  ────────────────────→  ▼
                    ┌─────────────────────────────────────────┐
                    │ engine.editing.updateDraft(value)       │
                    │  state.cellEditState.draftValue = value │
                    └────────────────────┬────────────────────┘
                                         │
                user Enter/Tab/Click-out │
                  ────────────────────→  ▼
                    ┌─────────────────────────────────────────┐
                    │ engine.editing.commitEdit()             │
                    │  ▸ run cellEditorValidator si défini    │
                    │  ▸ state.sourceData[idx][field] = draft │
                    │  ▸ history.record('edit', [op])         │
                    │  ▸ return CellEditEvent                 │
                    └────────────────────┬────────────────────┘
                                         │
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │ Grid emits 'cellEdit' (CellEditEvent    │
                    │ to consumer who writes back to row data)│
                    └─────────────────────────────────────────┘
```

## Persistance

Avec une `persistKey` stable, le grid sauve **automatiquement** dans `localStorage[persistKey]` à chaque changement de :

- largeur de colonne
- ordre des colonnes
- visibilité (hidden / shown)
- pinning (left / right / null)
- multi-sort stack
- filter model du builder

Et restaure tout au prochain mount. Aucun appel impératif requis.

Si tu veux piloter à la main, le grid expose `persistView()` / `restoreView()` (via `defineExpose` côté Vue, via méthodes publiques sur le composant côté Angular).

## Plugins

Un plugin reçoit `{ state, engine }` à `init()` et peut renvoyer un cleanup. Idéal pour : audit log, telemetry, keybindings custom, intégration analytics — tout ce qui ne concerne pas le rendu.

### Vue

```ts
import type { GridPlugin } from '@adeo/grid-vue'

const auditPlugin: GridPlugin = {
  id: 'audit',
  init({ engine }) {
    const off = engine.events?.on('cellEditCommit', (e) => {
      myTelemetry.send('cell-edit', { field: e.field, row: e.rowIndex })
    })
    return () => off?.()
  },
}

// usage
<ad-grid-vue :columns="cols" :rows="rows" :plugins="[auditPlugin]" />
```

### Angular

```ts
import type { GridPlugin } from '@adeo/grid-angular'

const auditPlugin: GridPlugin = {
  id: 'audit',
  init({ engine }) {
    const off = engine.events?.on('cellEditCommit', (e) => {
      myTelemetry.send('cell-edit', { field: e.field, row: e.rowIndex })
    })
    return () => off?.()
  },
}

// template
<ad-grid-angular [columns]="columns()" [rows]="rows()" [plugins]="[auditPlugin]" />
```

## Pourquoi pas Pinia / NgRx ?

Un grid est une feature **locale** par instance (chaque grid a son propre état). Pinia / NgRx servent pour le state global de l'app, pas pour les composants composables. Le pattern `useGridState()` + `provide/inject` (Vue) ou `@Injectable()` au scope du composant (Angular) est plus naturel et n'introduit aucune dépendance forte côté consommateur.
