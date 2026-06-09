# Data Pipeline

> De `rows` aux pixels : chaque transformation, dans l'ordre.

## Le pipeline en une vue

```
  ┌────────────┐
  │  rows      │   ← input du consommateur
  └─────┬──────┘
        │
        ▼
   ╭────────────╮     activeSorts: [{field, direction, priority}]
   │ ① SORT     │     comparator par colonne (ColumnDef.sortComparator)
   ╰─────┬──────╯     stable, multi-key, server-side via mode: 'server'
         ▼
   ╭────────────╮     filterModel.conditions (drawer)
   │ ② FILTER   │     +  quickFilters (filter row)
   ╰─────┬──────╯     AND entre conditions, OR dans 'set' / 'in'
         ▼            short-circuit dès qu'une row est rejetée
   ╭────────────╮     groupFields[] → produit un FLAT LIST mixé :
   │ ③ GROUP    │       [groupRow_lv0, dataRow, dataRow, groupRow_lv0, …]
   ╰─────┬──────╯     metadata __adg{Type,Key,Field,Value,Depth,Count}
         ▼            collapse state via collapsedGroupKeys
   ╭────────────╮     pageSize, currentPage → slice [start..end]
   │ ④ PAGINATE │     OR : infinite scroll via loadMore / onVisibleRangeChange
   ╰─────┬──────╯
         ▼
   ╭────────────╮     visibleRange = [start..end] int
   │ ⑤ VIRTUAL  │     visibleCols  = [colStart..colEnd] int
   ╰─────┬──────╯     overscan + cap 80
         ▼
   ╭────────────╮     rendu par index (pas d'allocation d'array) :
   │ ⑥ RENDER   │       header → body → footer
   ╰────────────╯     templates / slots / renderer / formatter / String(value)
```

Vue parle de `composables` (`useSortEngine`, `useFilterEngine`…), Angular parle de classes injectables (`SortEngine`, `FilterEngine`…). Même nom, même contrat — seule la mécanique de DI change.

## ① Tri (sort)

| État | Source de vérité | API utilisateur |
|---|---|---|
| Stack actif | `state.activeSorts` (signal) | Click header (single), Shift+click (multi), kebab menu |
| Direction par champ | `engine.sort.getSortDirection(field)` | Pour le binding du chevron dans le header |

### Vue

```ts
// Tri principal par catégorie ASC, puis par prix DESC
// (stack manuel via setSort + setSort multi)
engine.sort.setSort('category', 'asc')
// Shift+click sur "price" → toggleSort('price', /*multi*/ true)
```

### Angular

```ts
// Tri principal par catégorie ASC, puis par prix DESC
const engine = inject(GridEngine)
engine.sort.setSort('category', 'asc')
// Shift+click sur "price" → toggleSort('price', /*multi*/ true)
```

Pour un comparator custom (ex : grades énergie A → G dans l'ordre logique plutôt qu'alphabétique) — la `ColumnDef` est framework-agnostique :

```ts
const cols: ColumnDef[] = [{
  field: 'energyClass',
  sortable: true,
  sortComparator: (a, b) => {
    const order = ['A','B','C','D','E','F','G']
    return order.indexOf(a.energyClass) - order.indexOf(b.energyClass)
  },
}]
```

## ② Filtres

Deux **surfaces indépendantes** :

| Surface | État | UI |
|---|---|---|
| **Quick filters** | `state.quickFilters: Record<field, value>` | Ligne de filtres sous le header |
| **Filter model** | `state.filterModel.conditions[]` | Filter drawer + tag bar « Filtered by » |

Les deux s'appliquent en série : une row doit passer **les deux** pour être visible.

### Types de filtres

| filterType | Opérateurs par défaut |
|---|---|
| `'text'` | contains, equals, starts, ends, blank, notBlank |
| `'number'` | =, ≠, >, ≥, <, ≤, between |
| `'date'` | =, ≠, before, after, between |
| `'set'` | in (multi-checkbox) |
| `'boolean'` | true / false / blank |

Tu peux limiter les opérateurs autorisés via `column.filterOperators`.

### Server-side

#### Vue

```vue
<ad-grid-vue :rows="serverRows" server-filter @filter-change="onFilters" />
```

#### Angular

```html
<ad-grid-angular
  [data]="serverRows()"
  filterMode="server"
  (filterChange)="onFilters($event)" />
```

Le grid ne filtre rien lui-même : il émet `filterChange` avec le payload, à toi de fetch les bonnes lignes et de repasser `rows` / `data`.

## ③ Groupement

`groupFields = ['category', 'brand']` produit un **flat list** que le pipeline de virtualisation peut traiter comme un array de rows classique :

```
Input rows :
  [{cat:'A', brand:'X', …}, {cat:'A', brand:'Y', …}, {cat:'B', brand:'X', …}, …]

Flat list après groupage [category, brand] :

  __adgType  __adgKey                         __adgDepth __adgCount
  ─────────  ───────                          ────────── ──────────
  group      "category::A"                       0          14
  group      "category::A|brand::X"              1           5
  row        (data row #3)                       2
  row        (data row #7)                       2
  …
  group      "category::A|brand::Y"              1           9
  …
  group      "category::B"                       0          22
  …
```

Le composant de ligne de groupe détecte les rows groupes via `isGroupRow(row)` (type guard sur `__adgType === 'group'`).

## ④ Pagination

Deux modes mutuellement exclusifs :

### Vue

```vue
<!-- Pagination : footer avec [First, Prev, Next, Last] + select page size -->
<ad-grid-vue :pagination="{ pageSizeOptions: [25,50,100], defaultPageSize: 50 }" />

<!-- Lazy infinite scroll : pas de footer, fetch au scroll -->
<ad-grid-vue :total-count="50000" :on-visible-range-change="onVisibleRange" />
```

### Angular

```html
<!-- Pagination : footer avec [First, Prev, Next, Last] + select page size -->
<ad-grid-angular
  [pagination]="true"
  [pageSize]="50"
  [pageSizeOptions]="[25, 50, 100]" />

<!-- Infinite scroll : pas de footer, fetch au scroll -->
<ad-grid-angular
  loadingStrategy="infinite-scroll"
  [totalItems]="50000"
  (loadMore)="onLoadMore($event)" />
```

## ⑤ Virtualisation

Voir le guide dédié → **Docs/Guide/Virtualization**.

## ⑥ Rendu (cellules)

Pour chaque cellule, l'ordre de résolution est (le plus spécifique gagne) :

```
1. Slot / template local de la ligne (transmis explicitement par le row)
2. Slot enfant <ad-grid-column field="x" #cell> (Vue) / <ad-grid-column-def [cellTemplate]> (Angular)
3. Slot root per-field (Vue : #cell-{field} / Angular : cellTemplate sur la column-def)
4. Slot root générique (Vue : #cell / Angular : ng-template projeté)
5. column.renderer (Component | 'tag' | 'text')
6. column.valueFormatter(value, row) → string
7. String(value) — fallback final
```

### Vue

```vue
<!-- Slot par champ (le plus utilisé) -->
<ad-grid-vue :columns="cols" :rows="rows">
  <template #cell-promo="{ value }">
    <span :class="value ? 'badge badge--hot' : ''">
      {{ value ? '🔥 PROMO' : '—' }}
    </span>
  </template>
</ad-grid-vue>
```

### Angular

```html
<ad-grid-angular [columns]="cols()" [data]="rows()">
  <ad-grid-column-def field="promo" [cellTemplate]="promoTpl" />
</ad-grid-angular>

<ng-template #promoTpl let-value="value">
  <span [class.badge]="value" [class.badge--hot]="value">
    {{ value ? '🔥 PROMO' : '—' }}
  </span>
</ng-template>
```

## Performance — court-circuits importants

| Optimisation | Où |
|---|---|
| Identité référentielle préservée si `activeSorts.length === 0` | `sortEngine.sortData()` retourne `data` tel quel (pas de spread) |
| Filter short-circuit sur la 1re condition échouée | `filterEngine.filterData()` |
| Group flat list mémoizé tant que `groupFields` + `rows` sont stables | engine de grouping |
| Virtualisation ne ré-allocate pas d'array | l'engine vertical expose `getRow(i)` (index-based) |
| Cellule ne re-render que si ses props changent | Vue diffe automatiquement / Angular `OnPush` + signals — pas de `@if` conditionnels lourds |
