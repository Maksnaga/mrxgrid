# Tri, Filtrage, Groupement, Pagination

Ce chapitre spécifie les quatre étapes du pipeline qui transforment `data` en flux de lignes rendues par `<ad-grid-vue>` : tri, filtrage, groupement et pagination. Chaque section présente le contrat indépendant du framework, la surface d'entrée/sortie publique, ainsi que le mapping Vue / Angular côte à côte.

Les quatre fonctionnalités se composent en un pipeline unique et ordonné. La section Groupement schématise la cascade complète ; le tri et le filtrage contribuent aux tranches amont, la pagination contribue à la tranche aval.

---

<a id="sorting"></a>
## Tri
### Rôle

Réordonner les lignes selon un ou plusieurs champs de colonne. Le tri est la deuxième étape du pipeline (après le filtrage) et produit l'entrée du groupement et de la pagination. Le grid pilote une unique pile de tri — `SortDef[]` — que le moteur évalue de gauche à droite, la priorité au niveau de la colonne étant encodée dans la position du tableau.

### Contrat de comportement

- **Cycle de tri par colonne.** Basculer une colonne non encore triée démarre à `asc`. Un deuxième basculement passe à `desc`. Un troisième basculement retire la colonne de la pile. Le cycle est `null → asc → desc → null`.
- **Tri simple (par défaut).** `multiSort = false` : chaque basculement remplace la pile. La nouvelle colonne détient la priorité `0` ; les colonnes précédemment triées sont supprimées.
- **Multi-tri.** `multiSort = true` (ou l'utilisateur maintient `Shift` au clic lorsque la prop l'autorise) : chaque basculement non-null ajoute ou met à jour une entrée dans la pile. La priorité équivaut à l'ordre d'insertion. Le retrait d'une colonne renumérote `priority` pour rester contigu.
- **Stabilité.** Chaque appel à `Array.prototype.sort` est délégué au moteur hôte, qui effectue une passe unique sur `SortDef[]` par comparaison et retourne `0` lorsque toutes les clés de tri correspondent. Les lignes à égalité conservent leur ordre d'entrée sur V8 / Spidermonkey (TimSort) — le grid n'ajoute pas de comparateur stable de repli. Les consommateurs nécessitant un ordre strictement déterministe entre moteurs doivent ajouter leur propre clé de départage.
- **Résolution de valeur.** Pour chaque `SortDef.field`, le moteur lit `ColumnDef.sortComparator(a, b)` lorsqu'il est présent ; sinon il lit `ColumnDef.valueGetter(row)` lorsqu'il est présent ; sinon `row[field]`. Le comparateur par défaut gère `null` (trié en premier en ascendant), string (`localeCompare`), number (soustraction), et se replie sur `String(...).localeCompare`.
- **Mode client** (`mode = 'client'`) : le moteur matérialise un nouveau tableau via `sortData(data)`. **Mode serveur** (`mode = 'server'`) : les lignes transitent telles quelles ; le consommateur réagit à `sortChange` et relance la récupération.
- **Interaction avec le groupement.** La direction de tri du groupe est indépendante du tri de colonne — `GroupEntry.sortDirection` ordonne les en-têtes de groupe ; la pile de tri de colonne s'applique toujours aux lignes à l'intérieur de chaque groupe.
- **Mise en miroir de l'UI d'en-tête.** Le moteur synchronise chaque `ColumnStateEntry.sort` / `.sortIndex` après chaque mutation afin que les cellules d'en-tête affichent la flèche et le badge de priorité corrects.
- **Garde anti-resize.** Un basculement de tri déclenché par un clic d'en-tête dans les ~200 ms suivant un mouseup de redimensionnement de colonne est supprimé (`state.lastResizeEndedAt`).

### API publique

| Aspect | Surface |
|---|---|
| Inputs / props | `multiSort?: boolean` — active l'ajout via Shift-clic (Vue : par défaut à vrai ; Angular : non exposé comme prop de premier niveau — le multi-tri est toujours disponible via Shift). |
| Outputs / events | `sortChange(event: SortEvent)` — `{ sorts: SortDef[] }`, émis à chaque mutation de la pile. |
| Impératif | `toggleSort(field, isMultiSort?)`, `setSort(field, direction \| null)`, `clearSort()`, `getSortDirection(field)`, `getSortIndex(field)`. |

`SortDef = { field: string; direction: 'asc' \| 'desc'; priority: number }` est l'unique entrée normalisée de la pile.

### Contrat d'implémentation (interne)

- **Possède :** `state.activeSorts` (la pile `SortDef[]`), les champs `.sort` et `.sortIndex` sur chaque `ColumnStateEntry`.
- **Observe :** `state.columnDefMap` (résout `sortComparator` / `valueGetter`).
- **Invalidation de cache :** aucune — le moteur retourne un nouveau tableau à chaque appel ; les computeds en aval se réexécutent quand `activeSorts` change. Les éditions de ligne en place invalident le pipeline via `state.dataVersion`.
- **Dépendances :** s'exécute après `filter`, avant `group` et `pagination`.

### Mapping Vue

- Fichier : `apps/grid-vue/src/components/Grid/features/useSortEngine.ts`
- Moteur : composable `useSortEngine(state)`. Méthodes : `toggleSort`, `setSort`, `clearSort`, `sortData`, `getSortDirection`, `getSortIndex`.
- État : `gridState.activeSorts.value` (Vue `Ref<SortDef[]>`).
- Verrou multi-tri : `Grid.vue` neutralise le modificateur `Shift` quand `props.multiSort === false` avant d'appeler `toggleSort(field, allowMulti && isMultiSort)`.

### Mapping Angular

- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/sort.engine.ts`
- Moteur : classe `SortEngine` (`@Injectable()`, fournie par `<ad-grid-angular>`). Méthodes identiques à Vue.
- État : `GridStateManager.activeSorts()` (signal Angular).
- Pas d'input `multiSort` de premier niveau — l'en-tête honore toujours `Shift`.

## Filtrage
### Rôle

Réduire le flux de lignes à celles correspondant à un modèle utilisateur explicite. Le filtrage est la première étape du pipeline. Le grid prend en charge trois surfaces de filtre concurrentes — un constructeur multi-conditions formel, une ligne de filtre rapide en ligne par colonne (Vue), et des overlays par colonne — toutes écrivant dans le même état évalué.

### Contrat de comportement

- **Modèle de filtre.** `FilterModel = { conditions: FilterCondition[] }`. Chaque `FilterCondition` porte `id`, `combinator` (`and` / `or`, ignoré pour la première condition), `field`, `operator`, `value: { value?, valueTo? }`, et un emplacement `model` opaque optionnel pour les composants de filtre personnalisés.
- **Ordre d'évaluation.** Les conditions sont évaluées **à associativité gauche** sans regroupement par parenthèses. `a AND b OR c` se lit `(a AND b) OR c`. Le combinator de la première condition est ignoré.
- **Opérateurs par type de donnée.** `FilterDataType` ∈ `{text, number, date, set, boolean, custom}`. Chaque type publie une liste `DEFAULT_OPERATORS` (`contains`, `equals`, `between`, `in`, `blank`, …) et un `DEFAULT_OPERATOR_PER_TYPE`. `VALUELESS_OPERATORS = { blank, notBlank }` et `RANGE_OPERATORS = { between }` sont honorés à la fois par la table de prédicats et le formateur de libellé.
- **Verrou de complétion.** Une condition incomplète (`value` manquante pour les opérateurs non valueless, `valueTo` manquante pour les opérateurs de plage) est **écartée avant évaluation** — elle ne falsifie jamais de lignes. Les filtres personnalisés déclarent la complétion via `instance.isFilterActive()` (Vue) ou `ColumnDef.filterIsComplete` (Angular).
- **Filtres rapides (Vue uniquement).** Un sac `state.quickFilters: Record<field, value>` séparé, alimenté par la ligne de filtre en ligne dans l'en-tête. Les valeurs de filtre rapide sont synthétisées en conditions transitoires (`contains` pour text, `equals` pour set, `between`/`gte`/`lte` pour les plages de date) et composées en AND avec le modèle formel au moment de l'évaluation. Les filtres rapides ne mutent pas le `filterModel` formel.
- **Mode de filtre.** `FilterMode = 'client' | 'server'`, découplé du `mode` au niveau du grid. `'server'` : `filterData()` retourne l'entrée intacte ; le grid émet `filterChange` pour que le consommateur puisse relancer la récupération. `'client'` (par défaut) : le moteur évalue les prédicats en mémoire.
- **Réinitialisation de page.** Chaque mutation (`add`, `update`, `remove`, `reorder`, `clear`, `replace`) réinitialise `state.pageIndex = 0`.
- **Contrat de filtre personnalisé.** Une colonne déclare `ColumnDef.filter = { component, doesFilterPass?, filterParams?, getModelAsString? }` (Vue, style AG-Grid) ou `ColumnDef.filterComponent` + `filterPredicate` + `filterIsComplete` (Angular). Dans les deux cas, le moteur route l'évaluation vers `doesFilterPass` / `filterPredicate` par ligne, en passant `{ row, model, getValue, column, rowIndex }`.
- **Barre d'étiquettes.** La barre "FILTERED BY" lit `engine.toLabel(condition)`, qui formate `"Header op value"` pour les filtres intégrés ou délègue à `getModelAsString(model)` pour les filtres personnalisés.

### API publique

| Aspect | Surface |
|---|---|
| Inputs / props | `filterMode?: 'client' \| 'server'` (par défaut `'client'`) ; `filterModel?: FilterModel` (lié en deux sens côté Vue via `v-model:filter-model`). Par colonne `filterable`, `filterType`, `filterOperators`, `defaultFilterOperator`, `filterOptions`, `filter` / `filterComponent`. |
| Outputs / events | `filterChange(event: FilterEvent)` — payload typé `{ model, condition, reason }`. Vue émet en plus `update:filter-model` (v-model de modèle) et un `filterChange(Record<string,unknown>)` hérité indexé par champ pour la rétro-compatibilité des filtres rapides (`@deprecated`, remplacé par `filterEvent`). |
| Impératif | `setFilterModel(model)`, `clearFilters()`, `addFilterCondition(cond)`, `updateFilterCondition(id, patch)`, `removeFilterCondition(id)`, `reorderFilterConditions(from, to)`, `dropIncompleteConditions()` (Angular), `describeFilterableColumns()`. |

`FilterEvent = { model, condition: FilterCondition \| null, reason: 'add'|'update'|'remove'|'reorder'|'clear'|'replace' }`.

### Contrat d'implémentation (interne)

- **Possède :** `state.filterModel`, `state.filterMode`, `state.quickFilters` (Vue), `engine.lastEvent` (dernier `FilterEvent` émis).
- **Observe :** `state.columnDefMap`, `state.sourceData` (pour inférer les options `set` quand aucune n'est déclarée, plafonné à 200 valeurs distinctes).
- **Invalidation de cache :** mute `state.filterModel` (signal/ref). Les éditions de ligne en place incrémentent `state.dataVersion` (Vue) afin que le pipeline se réexécute même quand `filterModel` est vide. Réinitialise `state.pageIndex` à chaque mutation.
- **Dépendances :** s'exécute en premier ; la sortie alimente le tri.

### Mapping Vue

- Fichiers : `features/useFilterEngine.ts`, `components/overlays/GridFilterDrawer.vue`, `components/overlays/GridFilterBuilder.vue`, `components/overlays/GridFilterTagsBar.vue`, `components/header/ColumnFilterOverlay.vue`.
- Moteur : `useFilterEngine(state)`. Méthodes : `setModel`, `addCondition`, `updateCondition`, `removeCondition`, `reorderConditions`, `clearAll`, `removeByField`, `filterData`, `toLabel`, `describeFilterableColumns`, `makeCondition`. Expose un `lastEvent: Ref<FilterEvent | null>` observé par `Grid.vue` pour émettre `filterEvent`.
- État : `gridState.filterModel`, `gridState.filterMode`, `gridState.quickFilters`.
- Résolution du mode : `state.filterMode` dérive de `props.filterMode ?? (props.serverFilter ? 'server' : 'client')`.

### Mapping Angular

- Fichier : `features/filter.engine.ts`. UI du constructeur dans `components/overlays/`.
- Moteur : classe `FilterEngine`. Mêmes noms de méthodes que Vue. Expose `lastEvent: Signal<FilterEvent | null>` consommé par `grid.ts` via `effect()` pour émettre `filterChange`.
- État : `GridStateManager.filterModel()`, `.filterMode()`. Pas de signal `quickFilters` — Angular n'a pas de ligne de filtre en ligne dans le moteur (selon sync v4 ligne 219).

## Groupement
### Rôle

Regrouper les lignes par un ou plusieurs champs de colonne, afficher des en-têtes de groupe repliables entre les lignes de données, et alimenter le flux plat résultant — `DisplayRow<T>[]` — vers les étapes de pagination + de défilement virtuel. Le groupement est la troisième étape du pipeline et s'exécute sur la tranche de données déjà triée+filtrée. Un second moteur (`ServerGroupEngine`, désormais parity Vue post sync agent) gère le groupement côté serveur avec récupération paresseuse de lignes par groupe déplié.

### Cascade du pipeline

```
raw rows (state.sourceData)
    │
    ▼  filter.filterData()        ◀── state.filterModel, state.quickFilters, state.filterMode
filtered rows
    │
    ▼  sort.sortData()            ◀── state.activeSorts
sorted rows
    │
    ▼  (client) pagination slice  ◀── state.pageIndex, state.pageSize, state.paginationEnabled
        OR (server) pass-through
paged rows
    │
    ▼  group.groupData()          ◀── state.groupColumns, state.expandedGroups
DisplayRow<T>[]  ──►  virtual scroller  ──►  rendered rows
```

Vue groupe la tranche paginée (`groupData(paginatedRows)`) — les en-têtes de groupe ne reflètent que la page courante. Le `GroupEngine` d'Angular est invoqué sur l'ensemble filtré+trié avant la découpe en pages ; les deux comportements sont documentés et intentionnels. La cascade est déterministe : toute mutation de ligne en place doit incrémenter `state.dataVersion` (Vue) afin que chaque computed en aval voie le changement — `applyFills`, le collage, le vidage en masse et le commit d'édition de cellule le font tous.

### Contrat de comportement

- **Groupement côté client.** Actif quand `state.groupColumns.length > 0`. Le moteur partitionne les lignes par `def.valueGetter(row) ?? row[field]`, en recursant un niveau par `GroupEntry`. Retourne `[]` quand aucune colonne de groupe n'est configurée — les appelants (`GridEngine.displayRows`) se replient alors sur l'aplatissement simple `{ type: 'data' }`.
- **Forme de `GroupEntry` :** `{ field: string; sortDirection: 'asc' | 'desc' }`. La direction trie les en-têtes de groupe ; les valeurs numériques sont triées numériquement quand les deux clés s'analysent comme `Number`, sinon `String.localeCompare`.
- **Les clés de groupe encodent le chemin.** `parentKey|field:value` — replier un parent ferme son sous-arbre. `state.expandedGroups: Set<string>` détient les clés ouvertes ; le basculement ajoute/retire.
- **Union discriminée `DisplayRow<T>` :** `{ type: 'data', data, index, depth }` | `{ type: 'group', group: GroupRow<T> }` | `{ type: 'detail', data, index }`. Les en-têtes de groupe portent `{ field, value, displayValue, depth, count, expanded, groupKey, children, parent }`. `displayValue` est formaté `"${headerName}: ${valueFormatter(value)}"`.
- **Groupement côté serveur parity Vue post sync.** Quand `groupMode === 'server'`, `ServerGroupEngine` prend le relais. Le consommateur fournit `fetchGroups(fields)` (retourne `{ value, count }[]`) et `fetchGroupRows(field, value, start, end)`. Le moteur maintient ses propres signaux `groupSummaries`, `expandedKeys`, `loadedGroups` (cache de page par groupe) et `loadingGroups`. `flatRows` émet des lignes de données sentinelles squelettes (`__adgSkeleton: true`, `__adgGroupKey`, `__adgOffsetInGroup`) pour les lignes non encore récupérées ; `onVisibleRangeChange(start, end)` déclenche des appels paresseux `expandGroupServer(...)` page par page (taille de page par défaut 100). Un niveau de groupement est pris en charge dans l'implémentation actuelle ; la forme de la clé de groupe serveur est `field::value`.
- **Pas de groupement en mode pagination serveur (Vue).** Le groupement serveur n'est pas utilisé quand la pagination est active — `serverGroupingActive = serverGroupingActive_ && !paginationEnabled`.
- **Agrégation.** Les lignes de groupe exposent `count` (nombre de lignes feuilles dans le bucket). Les agrégations sum / avg / min / max ne sont **pas implémentées** dans aucun des deux moteurs.

### API publique

| Aspect | Surface |
|---|---|
| Inputs / props | `groupMode?: 'client' \| 'server'` (Angular, par défaut `'client'`), `serverGroupingOptions?: ServerGroupingOptions<T>` (Angular). |
| Outputs / events | `groupChange(event: GroupEvent)` — `{ columns: string[]; groups: GroupEntry[] }`. |
| Impératif | `addGroup(field)`, `removeGroup(field)`, `applyGroups(groups)`, `clearGroups()`, `toggleGroupExpand(groupKey)`, `isGroupExpanded(groupKey)`. `ServerGroupEngine` Angular : `configure(opts)`, `fetchGroupSummaries()`, `expandGroupServer(...)`, `onVisibleRangeChange(start, end)`. |
| Slots / projection | Vue expose le slot `#group-cell` (ligne d'en-tête) ; les consommateurs Angular utilisent la projection d'en-tête par défaut. |

### Contrat d'implémentation (interne)

- **Possède :** `state.groupColumns`, `state.expandedGroups`. Le `ServerGroupEngine` Angular possède en plus `groupSummaries`, `expandedKeys`, `loadedGroups`, `loadingGroups`, `isFetchingSummaries`.
- **Observe :** `state.columnDefMap` (pour `valueGetter` + `valueFormatter`), `state.groupMode` (routage Angular).
- **Invalidation de cache :** les mutations réinitialisent `state.pageIndex = 0`. Les éditions en place incrémentent `state.dataVersion` afin que la carte des buckets soit reconstruite.
- **Dépendances :** s'exécute après le tri (et, côté Vue, après la découpe de pagination).

### Mapping Vue

- Fichiers : `features/useGroupEngine.ts`, `Grid.vue` (câblage du pipeline autour de la ligne 1400+).
- Moteur : composable `useGroupEngine(state)`.
- État : `gridState.groupColumns`, `gridState.expandedGroups`. Aucun équivalent de groupement serveur n'existe encore (sync v4 ligne 137, item 11).

### Mapping Angular

- Fichiers : `features/group.engine.ts`, `features/server-group.engine.ts`.
- Moteurs : `GroupEngine` (client) et `ServerGroupEngine` (serveur). `grid.ts` route `addGroup` / `removeGroup` / `toggleGroupExpand` vers le moteur correspondant à `groupMode`. `flatRows: Signal<DisplayRow<T>[]>` est la sortie canonique du moteur serveur et est désormais typée `DisplayRow<T>[]` sans cast (post ANG-DEBT, sync v4 ligne 56).
- État : `GridStateManager.groupColumns()`, `.expandedGroups()`, `.groupMode()`.

## Pagination
### Rôle

Restreindre le flux de lignes rendues à une seule tranche de page. La pagination est la quatrième étape du pipeline ; en mode client le moteur découpe l'ensemble trié+filtré, en mode serveur il émet `pageChange` et fait confiance au consommateur pour repopuler `data`.

### Contrat de comportement

- **L'index de page est basé sur 0** dans l'état interne des deux bibliothèques (`state.pageIndex`). Le footer affiche des libellés basés sur 1.
- **La taille de page par défaut** est **25** dans les deux implémentations (`DEFAULT_PAGE_SIZE` côté Vue ; `input<number>(25)` côté Angular).
- **`pageSizeOptions`** vaut par défaut `[10, 25, 50, 100]`.
- **Bornes de page.** `totalPages = max(1, ceil(total / pageSize))` où `total = mode === 'server' ? totalItems : sourceData.length`. `goToPage(i)` est un no-op quand `i < 0` ou `i >= totalPages`. `nextPage` / `previousPage` sont des no-ops aux bornes.
- **Réinitialisation lors des mutations de filtre / groupe / tri.** Chaque mutation de filtre, chaque `add` / `remove` de groupe, et `setPageSize` réinitialisent `pageIndex` à `0`. Les changements de tri ne réinitialisent PAS la page — l'utilisateur souhaite typiquement conserver sa position lors d'une réorganisation.
- **Mode serveur.** `mode = 'server'` + `totalItems` défini par le consommateur. Le grid ne découpe jamais ; il émet `pageChange` pour que le consommateur puisse relancer la récupération. Le moteur calcule toujours `totalPages` et `isLastPage` par rapport à `totalItems`.
- **Alternative défilement infini.** `loadingStrategy = 'infinite-scroll'` bascule le footer des contrôles paginés vers des événements `loadMore` (`{ offset, limit }`) ; l'état de pagination est toujours suivi mais le compte de lignes visibles est le buffer, pas une simple tranche de page. Vue expose `state.paginationEnabled` comme bouton supplémentaire pour que le grid puisse rendre sans aucune pagination (`pagination: false`) ; Angular découpe toujours quand `loadingStrategy === 'pagination'`.
- **Événement `pageChange`.** Émis quand `currentPage`, `pageSize` ou la longueur du jeu de données change (la dépendance sur la longueur redéclenche après qu'un filtre côté serveur réduit `totalRows`). `previousPageIndex` / `previousPageSize` portent la valeur antérieure au changement pour les consommateurs de delta.

### API publique

| Aspect | Surface |
|---|---|
| Inputs / props | `pagination?: boolean \| PaginationConfig` (Vue) / `pagination?: boolean` (Angular, par défaut `true`) ; `pageSize?: number` (par défaut 25) ; `pageSizeOptions?: number[]` ; `totalItems?: number` (mode serveur) ; `loadingStrategy?: 'pagination' \| 'infinite-scroll'`. |
| Outputs / events | `pageChange(event: PageEvent)` — `{ page, pageIndex, pageSize, startIndex, endIndex, previousPageIndex, previousPageSize }`. `loadMore(event: LoadMoreEvent)` — `{ offset, limit }` (défilement infini). |
| Impératif | `goToPage(index)`, `nextPage()`, `previousPage()`, `setPageSize(size)`, plus les computeds `currentPage`, `totalPages`, `startItem` (première ligne basée sur 1), `endItem`, `isFirstPage`, `isLastPage`. |

`PageEvent` porte à la fois `page` (basé sur 1, convention Vue) et `pageIndex` (basé sur 0, convention Angular) ; les consommateurs peuvent utiliser l'un ou l'autre sans conversion. `startIndex` / `endIndex` sont basés sur 0 et `endIndex` est exclusif.

### Contrat d'implémentation (interne)

- **Possède :** `state.pageIndex`, `state.pageSize`, `state.paginationEnabled` (Vue), `state.loadingStrategy`.
- **Observe :** `state.sourceData.length` / `state.totalItems`, `state.mode`.
- **Invalidation de cache :** aucune en propre — la découpe est recalculée par `GridEngine` chaque fois qu'un signal d'entrée change. Les mutations de filtre / groupe appellent directement `state.pageIndex.set(0)` (réinitialisation inter-fonctionnalités).
- **Dépendances :** s'exécute en dernier en mode client ; contournée en mode serveur.

### Mapping Vue

- Fichiers : `features/usePaginationEngine.ts` (handle impératif), `features/usePagination.ts` (composable de découpe hérité toujours utilisé), `Grid.vue` (watcher d'émission `pageChange`).
- Moteur : composable `usePaginationEngine(state)`.
- État : `gridState.pageIndex`, `gridState.pageSize`, `gridState.paginationEnabled`, `gridState.loadingStrategy`.

### Mapping Angular

- Fichier : `features/pagination.engine.ts`.
- Moteur : classe `PaginationEngine`.
- État : `GridStateManager.pageIndex()`, `.pageSize()`, `.loadingStrategy()`, `.totalItems()`.
- Le composant de footer possède directement l'émission de `pageChange` ; `grid.ts` réémet via `(pageChange)="pageChange.emit($event)"`.
