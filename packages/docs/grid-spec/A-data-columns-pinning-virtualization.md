# Données, Colonnes, Pinning, Virtualisation

Ce chapitre couvre le contrat de plus bas niveau de `@adeo/grid` : comment les
lignes de donnée sont typées et identifiées, comment les colonnes sont
déclarées et stockées, comment les colonnes épinglées sont disposées, et
comment le grid maintient un dataset volumineux / un grand nombre de colonnes
à un coût abordable grâce à la virtualisation. Chaque comportement listé ici
s'applique aux deux implémentations (`@adeo/grid-vue` et `@adeo/grid-angular`).

---

<a id="data-model"></a>
## Modèle de données
### Rôle

Le grid est un renderer mince au-dessus d'un dataset détenu par le consommateur.
Le dataset est la source de vérité ; le grid ne copie jamais les lignes de
donnée dans ses propres structures, il ne fait qu'y indexer. Toutes les autres
fonctionnalités (tri, filtre, groupe, virtualisation, sélection, formules)
consomment une vue dérivée du même tableau `sourceData`.

### Contrat de comportement

- Les lignes de donnée sont des objets simples agnostiques du framework : `RowData = Record<string, unknown>`.
  Les valeurs de colonne sont adressées par `field` (ou par `valueGetter(row)` pour des
  données imbriquées).
- Le grid ne mute jamais la référence du tableau source en elle-même sauf demande
  explicite (p. ex. API impérative de suppression de ligne). Il mute les valeurs des
  propriétés des lignes de donnée sur place lors des édits, du paste, du fill et du bulk-clear.
- L'**identité de ligne** est résolue par `rowIdField` (par défaut `'id'`). Un paramètre
  de colonne `allowFormula: true` ainsi que les couches de sélection de ligne / persistance
  requièrent tous que cet id soit stable ; les lignes dont la valeur `rowIdField` est manquante
  retombent sur l'index positionnel de la ligne dans `sourceData`.
- Le grid Vue expose en plus un hook `rowIdResolver(row, index)` afin que le
  consommateur puisse surcharger l'extraction d'id sans s'engager sur un nom de `field` —
  utilisé par le grid de démo où les lignes ont la forme `{ col_0, col_1, … }`.
- Le flux affichable est un pipeline à trois couches :
  `sourceData → filteredData → sortedData → paginatedData → displayRows`.
  `displayRows` est le seul que le body itère ; il contient un mélange d'entrées
  `data`, `group` et `detail` lorsque le grouping / l'expansion est actif
  (voir `DisplayRow`).
- Les **lignes virtuelles** sont un sous-ensemble de `displayRows` : la tranche contiguë
  actuellement matérialisée dans le DOM, définie par `visibleRowRange` (Angular)
  ou `visibleRange` (Vue). La tranche est une projection pure — il n'existe pas
  de « modèle virtuel » séparé.
- **Mutations externes** : le consommateur remplace `:rows` / l'input `data`
  par une nouvelle référence de tableau. La réactivité détecte le changement et le pipeline
  est ré-exécuté.
- **Mutations internes** (commit d'édition de cellule, fill, paste, bulk clear) mutent
  les propriétés des lignes de donnée sur place. Pour préserver des écritures en `O(1)` sur des
  datasets de plusieurs milliers de lignes, le grid ne clone *pas* la ligne ; à la place il incrémente un
  compteur `dataVersion` (Vue) / signale un dirty (Angular) afin que les
  computeds dépendants s'invalident. Les caches de groupe / filtre / tri lisent `dataVersion`
  explicitement de sorte qu'un changement de valeur sur place rejoue tout de même le pipeline.

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | `rows: RowData[]` — dataset source (Vue) / input `data: T[]` (Angular). `rowId: (row, index) => string \| number` (Vue) / input `rowIdField: string` (Angular). `totalItems?: number` pour le mode serveur. |
| Outputs / events | Aucun directement. Les mutations se propagent via `cellEdit`, `bulkEdit`, `bulkPaste`, `bulkDelete`, `fillDown` (voir chapitres C / E). |
| Slots / projection | n/a à cette couche. |
| Imperative | `getDisplayRows()`, `getSourceRowAt(displayIndex)`, `bumpDataVersion()` (Vue uniquement — gardé interne en Angular). |

### Contrat d'implémentation (interne)

- **Détient** : `sourceData`, `totalItems`, `dataVersion` (Vue), `rowIdField`,
  `rowIdResolver` (Vue).
- **Lit** : chaque feature engine lit `sourceData` et `dataVersion`
  (Vue) en tête de son computed afin que les mutations sur place invalident les caches.
- **Effets de bord** : aucun directement. Le grid n'écrit pas dans `sourceData`
  sauf si le consommateur a routé une écriture via l'une des APIs impératives.
- **Couplages** : chaque feature en aval (tri, filtre, groupe, formule,
  validation) dépend de cette couche. Les formules dépendent de `rowIdResolver`
  pour enregistrer les cellules `=…` ; tree/grouping lit `rowIdField` pour dériver
  les clés de groupe.

### Mapping Vue

- `apps/grid-vue/src/components/Grid/state/useGridState.ts`
  - `sourceData: Ref<T[]>` (ligne ~230)
  - `dataVersion: Ref<number>` (ligne ~234) — trigger de réactivité manuel
    incrémenté à chaque mutation sur place. La JSDoc verbeuse sur l'interface
    `GridState.dataVersion` (ligne ~45) est l'explication canonique
    de la raison d'être de ce mécanisme.
  - `rowIdField: Ref<string>` (ligne ~299)
  - `rowIdResolver: Ref<(row, index) => string | number | undefined>`
    (ligne ~301)
- `apps/grid-vue/src/components/Grid/types.ts` — `RowData`, `CellPosition`,
  `GroupRowMeta`, `DataRowMeta`.
- `apps/grid-vue/src/components/Grid/Grid.vue`
  - sync `rows → sourceData` (ligne ~869).
  - installation de `rowIdResolver` (ligne ~392).
- `apps/grid-vue/src/components/Grid/engine/useGridEngine.ts`
  - computed `displayRows` (ligne ~191).

### Mapping Angular

- `apps/grid-angular/projects/grid-angular/src/lib/grid/state/grid-state.ts`
  - `sourceData = signal<T[]>([])` (ligne 14)
  - `totalItems = signal<number>(0)` (ligne 15)
  - `rowIdField = signal<string>('id')` (ligne 109)
- `apps/grid-angular/projects/grid-angular/src/lib/grid/models/display-row.model.ts`
  — union discriminée `DisplayRow<T>` (`data | group | detail`).
- `apps/grid-angular/projects/grid-angular/src/lib/grid/engine/grid-engine.ts`
  — computed `displayRows`.

## Définition des colonnes
### Rôle

Une colonne déclare **ce qui** est affiché et **comment** : accesseur de données,
libellé d'en-tête, stratégie de rendu, stratégie d'édition, participation au
filtre / tri / groupe, indications de layout (width / min / max / flex / pinning).
`ColumnDef` est la définition ; `ColumnStateEntry` est l'état runtime
(largeur courante, tri courant, pin courant, etc.). Ils sont gardés séparés
afin que le consommateur puisse muter l'état piloté par l'utilisateur (resize, reorder, hide,
sort, pin) sans perdre le contrat définitionnel.

### Contrat de comportement

- Deux styles de déclaration coexistent :
  1. **Impératif** : passer `:columns="cols"` (Vue) / `[columns]="cols"`
     (Angular) en tant que tableau `ColumnDef[]`.
  2. **Déclaratif** : projeter `<ad-grid-column field="…">` (Vue) /
     `<ad-grid-column-def field="…">` (Angular) en tant qu'enfants. Chaque enfant
     s'enregistre lui-même ; le grid combine les enregistrements avec la
     prop impérative, les enfants déclaratifs ayant la priorité sur les
     `field` correspondants.
- Clé requise : `field: string`. C'est l'id unique de la colonne, utilisé
  partout (plages de sélection, refs de formule, ordre de tri, clé de
  persistance, mapping de lettres A1).
- Layout optionnel : `width` (initiale), `minWidth` / `maxWidth` (clamps
  de resize), `flex` (déclaré mais non honoré par aucune des deux implémentations —
  la largeur par défaut s'applique). La largeur par défaut est de `150 px`. La hauteur de ligne
  par défaut est de `48 px` (densité `default`).
- `visible: boolean` — visibilité initiale. `hideable: boolean` — indique si
  le menu de l'en-tête expose une action « Hide ».
- `pinned: 'start' | 'end' | null` — forme canonique Angular. Vue accepte
  les alias hérités `'left'` / `'right'` et les normalise via
  `normalizePinned()` (voir `useGridState.ts:530`).
- `valueGetter(row)` surcharge l'accesseur basé sur `field` pour des données
  imbriquées. `valueFormatter(value, row)` s'exécute au moment de l'affichage mais ne
  change pas la valeur stockée (`filter`, `sort`, `clipboard`, `formula` voient
  tous la valeur brute).
- Stratégie de rendu : `renderer` (Vue : `'text' | Raw<Component>`) /
  `cellTemplate` (Angular : `TemplateRef | Type`). Stratégie d'édition :
  `cellEditor` (l'un de `'text' | 'number' | 'textarea' | 'select' |
  'checkbox' | 'date' | 'toggle' | 'custom'`) plus
  `cellEditorOptions` / `cellEditorValidator`.
- Validation : `cellValidator(value, row) → CellError | null` marque la
  cellule au moment de l'affichage. La validation au moment de l'édition est `cellEditorValidator`,
  fill / paste utilisent `valueValidator`.
- **Initialisation de l'état de colonne** : `initColumns(defs)` (méthode du state
  manager) prend le `ColumnDef[]` et construit `ColumnStateEntry[]` avec
  `currentWidth = resolveWidth(def)`, `order = i`, `visible = def.visible
  !== false`, `pinned = normalize(def.pinned)`. C'est le point d'entrée
  unique — toutes les mutations de colonne après cela passent par
  `updateColumnState(field, partial)` pour que la réactivité soit à grain fin.
- **Changements dynamiques de colonnes** : remplacer la référence `columns` ré-exécute
  `initColumns` ; tout état utilisateur (resize, reorder, sort, pin) est
  jeté. Le moteur de state-persistence peut rejouer une vue sauvegardée après
  `initColumns` pour restaurer cet état utilisateur (voir `persistKey`).

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | Vue : `columns?: ColumnDef[]`, enfants déclaratifs `<ad-grid-column>`. Angular : input `[columns]`, enfants déclaratifs `<ad-grid-column-def>`. |
| Outputs / events | `columnResize(ColumnResizeEvent)`, `columnReorder(ColumnReorderEvent)`, `columnFreeze(ColumnFreezeEvent)`, `columnVisibility(ColumnVisibilityEvent)`, `columnSearchToggle(ColumnSearchToggleEvent)`. |
| Slots / projection | Slots par colonne en Vue : `#cell-{field}` / `#header-{field}` / `#filter-{field}` / `#edit-{field}`, et slots scopés `<ad-grid-column>` `#cell`, `#header`, `#filter`, `#edit`. Angular : inputs `[cellTemplate]`, `[editTemplate]`, `[filterTemplate]` sur `<ad-grid-column-def>`, ou template refs `#cell` / `#edit` / `#filter` à l'intérieur. |
| Imperative | `setColumnVisibility(field, visible)`, `pinColumn(field, side)`, `unpinColumn(field)`, `setColumnWidth(field, px)`, `reorderColumn(from, to)`, `getColumnState(field)`. |

### Contrat d'implémentation (interne)

- **Détient** : `columnDefs`, `columnStates`. La méthode `initColumns()` écrit
  les deux atomiquement. La méthode `updateColumnState(field, partial)` est le
  chemin unique de mutation.
- **Lit** : chaque feature lit `columnStates`. Le lookup
  `columnDefMap` (computed `Map<field, def>`) est exposé pour que les appelants
  puissent résoudre une def en `O(1)`.
- **Effets de bord** : aucun. État pur.
- **Couplages** : `state-persistence` écrit l'état de colonne par field lors de la
  restauration ; `column-reorder`, `column-resize`, `header-menu` passent tous
  par `updateColumnState`. L'en-tête / la filter row / les cellules du body itèrent toutes
  `visibleColumns` (pinned-start ▸ unpinned ▸ pinned-end) afin que le
  layout à 3 zones soit calculé une seule fois et réutilisé.

### Mapping Vue

- `apps/grid-vue/src/components/Grid/types.ts` — `ColumnDef` (ligne 102),
  `FilterDef`, `CellRendererProps`, `CellSlotProps`.
- `apps/grid-vue/src/components/Grid/Column.vue` — wrapper déclaratif
  de colonne, snapshot poussé dans le registre.
- `apps/grid-vue/src/components/Grid/state/ColumnRegistry.ts` —
  registre basé sur injection (`GRID_COLUMN_REGISTRY_KEY`).
- `apps/grid-vue/src/components/Grid/state/useGridState.ts`
  - `columnDefs`, `columnStates`
  - `visibleColumns` (ligne ~327), `columnDefMap` (ligne ~401),
    `gridTemplateColumns` (ligne ~409)
  - `initColumns()` (ligne ~430), `updateColumnState()` (ligne ~444),
    `resolveWidth()` (ligne ~521).
- `apps/grid-vue/src/components/Grid/Grid.vue` — watcher `mergedColumns →
  initColumns` (ligne ~903).

### Mapping Angular

- `apps/grid-angular/projects/grid-angular/src/lib/grid/models/column.model.ts`
  — `ColumnDef`, `ColumnStateEntry`, `SortDirection`, `CellEditorType`,
  événements.
- `apps/grid-angular/projects/grid-angular/src/lib/grid/directives/grid-column-def.ts`
  — directive `AdeoGridColumnDef`, projection `toColumnDef()` (ligne 64).
- `apps/grid-angular/projects/grid-angular/src/lib/grid/state/grid-state.ts`
  - `columnDefs`, `columnStates`
  - `visibleColumns` (ligne 135), `columnDefMap` (ligne 252),
    `gridTemplateColumns` (ligne 266)
  - `initColumns()` (ligne 287), `updateColumnState()` (ligne 304).
- `apps/grid-angular/projects/grid-angular/src/lib/grid/grid.ts` —
  projection `contentChildren(AdeoGridColumnDef)` (ligne 6, utilisée dans
  l'effet d'init).

## Colonnes épinglées
### Rôle

Verrouille une colonne sur le bord gauche ou droit du viewport pour qu'elle reste
visible pendant le scroll horizontal. Le pinning est le fondement pour les colonnes
ID / nom / actions et pour la colonne checkbox de sélection de ligne. Les
régions épinglées sont également l'ancre naturelle pour l'overlay de la cellule
en édition et pour les drawers de droite — le stacking z-index doit honorer les deux.

### Contrat de comportement

- Trois zones de layout, dans l'ordre du DOM : **pinned-start | unpinned | pinned-end**.
  `visibleColumns` est toujours trié dans cet ordre ; chaque ligne d'en-tête /
  filtre / body l'itère une fois.
- Chaque cellule épinglée utilise `position: sticky` avec un offset cumulé `left`
  (pinned-start) ou `right` (pinned-end). Les offsets cumulés
  sont des signaux pré-calculés (`pinnedLeftCumulativeOffsets`,
  `pinnedRightCumulativeOffsets`) afin que le composant body ne
  recalcule pas par cellule.
- Épingler une colonne ne change pas sa participation au sort / filter / edit,
  seulement sa position de rendu.
- `pinnedLeftWidth` / `pinnedRightWidth` / `unpinnedWidth` sont exposés
  comme signaux computed ; les marges de confort du scroll horizontal, les calculs
  de largeur de drawer et l'autoscroll les lisent tous.
- **Comportement de border-right sur la dernière épinglée** : la colonne pinned-start
  la plus à droite porte un séparateur border-right afin que l'utilisateur voie la frontière
  avec la zone unpinned. La première colonne pinned-end porte un
  équivalent border-left. La filter row s'aligne sur le header / body afin
  que le séparateur soit continu du haut au bas.
- Le **stacking z-index** est une échelle en couches :
  - Cellule de body : `1`
  - Cellule de body épinglée : `2`
  - Cellule d'en-tête : `3`
  - Cellule d'en-tête épinglée : `4`
  - Overlay d'édition (portail d'éditeur de cellule) : plus haut que les cellules épinglées afin que
    l'éditeur flotte au-dessus de la zone épinglée au lieu d'être clippé en dessous.
    Des régressions passées où l'éditeur disparaissait sous la cellule épinglée
    ont été corrigées dans les tâches #59 et #66.
  - Overlay de drawer droit : plus haut que toute cellule épinglée afin qu'un drawer
    couvre visuellement le grid même sur la zone pinned-end.
- Le pinning est mutable au runtime via le menu de l'en-tête
  (actions `pin-left` / `pin-right` / `unpin`) et l'API impérative
  `pinColumn(field, side)`. Les deux routes appellent `updateColumnState`
  avec la nouvelle valeur `pinned` ; le layout se met à jour de manière synchrone car
  `visibleColumns` est un signal dérivé.
- Vue accepte les alias hérités `'left'` / `'right'` et les réécrit
  en `'start'` / `'end'` à l'init. Une fois normalisé, le reste de la
  codebase n'utilise plus que `'start' | 'end' | null`.

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | `ColumnDef.pinned: 'start' \| 'end' \| null` (Vue accepte aussi `'left' \| 'right'`). |
| Outputs / events | `columnFreeze(ColumnFreezeEvent)` — `{ field, side, frozenLeftColumns, frozenRightColumns }`. |
| Slots / projection | n/a — le pinning est purement layout. |
| Imperative | `pinColumn(field, 'start' \| 'end')`, `unpinColumn(field)`. |

### Contrat d'implémentation (interne)

- **Détient** : champ `columnStates[i].pinned`. Muté via
  `updateColumnState(field, { pinned })`.
- **Dérive** : `pinnedLeftColumns`, `pinnedRightColumns`, `unpinnedColumns`,
  `pinnedLeftWidth`, `pinnedRightWidth`, `pinnedLeftCumulativeOffsets`
  (Angular uniquement), `pinnedRightCumulativeOffsets` (Angular uniquement),
  `visibleColumns`.
- **Couplages** :
  - La virtualisation horizontale ne fonctionne que sur la zone unpinned. Les colonnes
    épinglées sont toujours rendues.
  - La sélection de cellule / fill / clipboard convertit entre l'index de colonne
    d'affichage et l'index relatif à la zone unpinned en utilisant `pinnedLeftColumns().length`
    comme offset.
  - L'édition inline élargit `visibleColumnRange` lorsque la colonne en édition est
    unpinned afin que l'éditeur reste monté pendant qu'il sort du
    viewport physique (voir `effectiveColumnRange`).
- **Effets de bord** : aucun dans les engines ; le positionnement sticky CSS est
  appliqué par les composants de cellule en se basant sur les offsets cumulés.

### Mapping Vue

- `apps/grid-vue/src/components/Grid/state/useGridState.ts`
  - `pinnedLeftColumns` (ligne ~337), `pinnedRightColumns` (~343),
    `unpinnedColumns` (~340)
  - `pinnedLeftWidth`, `pinnedRightWidth`, `unpinnedWidth` (~347–355)
  - `normalizePinned()` (~530).
- `apps/grid-vue/src/components/Grid/components/header/GridHeader.vue`
  et `…/body/GridBody.vue` — appliquent `position: sticky` avec des offsets
  `left` / `right` computed par cellule épinglée.

### Mapping Angular

- `apps/grid-angular/projects/grid-angular/src/lib/grid/state/grid-state.ts`
  - `pinnedLeftColumns` (ligne 146), `pinnedRightColumns` (ligne 152),
    `unpinnedColumns` (ligne 150)
  - `pinnedLeftWidth` (ligne 156), `pinnedRightWidth` (ligne 160)
  - `pinnedLeftCumulativeOffsets` (ligne 170), `pinnedRightCumulativeOffsets`
    (ligne 186).
- `apps/grid-angular/projects/grid-angular/src/lib/grid/components/header/grid-header.ts`
  et `…/body/grid-body.ts` consomment les signaux d'offset cumulés.

## Virtualisation verticale
### Rôle

Ne rendre que les lignes de donnée actuellement dans (ou proches de) le viewport, indépendamment
de la taille de `displayRows`. Le grid est attendu pour rester interactif sur
des datasets de 100 k+ lignes sans perdre la capacité à mélanger des lignes de donnée
à hauteur fixe et des lignes de detail expanded à hauteur variable.

### Contrat de comportement

- Deux régimes de hauteur partagent un seul engine :
  - **Hauteur fixe** : chaque ligne `data` et `group` fait `rowHeight` pixels
    de haut. `rowHeight` vaut 48 par défaut (densité `'default'`) et bascule
    à 32 (`'compact'`) / 64 (`'comfortable'`) via le mapping de densité.
  - **Hauteur variable** : toute ligne dont la hauteur réelle diffère de
    `rowHeight` (ligne de detail expanded, ligne de groupe avec contenu riche,
    cellule wrappée) est mesurée par un `ResizeObserver`. L'engine stocke
    la hauteur supplémentaire par index de ligne absolu et reconstruit la
    table d'offsets cumulés à partir du premier index modifié.
- L'engine écrit quatre signaux à chaque recompute : `visibleRowRange`,
  `topSpacerHeight`, `bottomSpacerHeight`, `totalRowsHeight`. Le body
  ne rend que la tranche `[start, end)` ; les spacers sont de simples
  divs `height: Npx` afin que la scrollbar représente toujours le contenu complet.
- Un buffer d'overscan (`V_BUFFER_PX = 200`) est rendu au-dessus et en dessous
  du viewport. Un `FALLBACK_VIEWPORT_PX = 600` est utilisé jusqu'à ce que la
  hauteur réelle du viewport soit mesurée, afin que le premier rendu soit raisonnable même
  avant tout événement de scroll.
- **Pourquoi une stratégie custom (Angular)** : le
  `cdk-virtual-scroll-viewport` du CDK translate la fenêtre visible avec
  `transform: translateY`. `transform` crée un containing block qui
  piège les descendants `position: sticky`, ce qui casse les cellules épinglées à l'intérieur des
  lignes de donnée. L'engine custom rend dans un top-spacer statique
  à la place, afin que le conteneur de scroll reste le containing block sticky.
- **Stabilité de scroll lors de la mesure** : quand une ligne au-dessus du scroll top
  courant change de hauteur, l'engine compense en ajoutant le delta
  au `scrollTop`. L'utilisateur ne voit pas les lignes visibles sauter. Même logique
  dans les deux implémentations.
- **Contrat avec les lignes expandables** (voir le chapitre Theming & API) :
  - Expand → `ExpandableRowEngine` appelle `primeExpanded(absoluteIndex,
    defaultHeight = 200)` *avant* que la ligne de detail ne soit rendue, afin que le
    layout virtuel réserve la place immédiatement. Sans cette graine, la
    ligne de detail apparaîtrait à une hauteur de 0 puis sauterait à sa vraie
    hauteur au premier tick de `ResizeObserver`.
  - Collapse → l'engine supprime l'entrée d'extra-height de la ligne et
    reconstruit les offsets à partir de cet index.
  - L'engine Angular traite `ExpandableRowEngine.getExtraHeightForKey`
    comme la source faisant autorité quand une mesure a été prise indexée par
    id de ligne (couvre le cas où l'index de display-row n'a pas encore
    été écrit sur le nœud DOM).

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | La virtualisation verticale est **toujours activée** des deux côtés — aucun input à brancher. `containerHeight?: number` (Vue) — hauteur du viewport. `overscan?: number` (Vue) — exposé mais l'engine utilise un buffer pixel interne (`V_BUFFER_PX`). `rowHeight: number` — piloté par `density`. |
| Outputs / events | `visibleRangeChange(start: number, end: number)` — émis quand la tranche rendue bouge. Utilisé par les consommateurs pour déclencher des lazy fetches. |
| Slots / projection | n/a. |
| Imperative | `scrollToIndex(index)`, `scrollOffsetForIndex(index)` (Angular), `scrollToRow(rowId)` (helper Vue), `primeExpanded(index, defaultHeight?)`. |

### Contrat d'implémentation (interne)

- **Détient** : `visibleRowRange`, `topSpacerHeight`, `bottomSpacerHeight`,
  `totalRowsHeight` (signaux du state-manager), plus le cache privé `offsets:
  number[]` et `extraHeight: Map<index, px>`.
- **Lit** : `displayRows` (engine), `rowHeight`, `scrollTop`,
  `scrollViewportHeight`, `expandedRowIds`. L'engine Angular injecte en plus
  `ExpandableRowEngine` (optionnel) pour les lookups d'extra-height par clé.
- **Effets de bord** : écrit `scrollTop` lors de la compensation pour des deltas
  de mesure au-dessus du fold. Lit le DOM (`element.offsetHeight` /
  `entry.borderBoxSize`) pendant la mesure.
- **Couplages** : l'engine `expandable-row` appelle `primeExpanded()` et
  publie les extra heights par clé ; `keyboard` appelle
  `scrollOffsetForIndex` (ou l'équivalent Vue) pour amener la cellule focused
  dans la vue ; le composant body observe chaque élément de ligne via
  `observeRow(absoluteIndex, el, ro)` (Angular) /
  `observe(el, index)` (Vue) afin que le `ResizeObserver` sache quelles entrées
  re-mesurer.

### Mapping Vue

- `apps/grid-vue/src/components/Grid/features/useVariableHeightVirtualScroll.ts`
  - `visibleRange`, `totalHeight`, `topSpacer`, `bottomSpacer`
    (computed)
  - `attach()`, `observe()`, `unobserve()`, `scrollToIndex()`,
    `primeExpanded()` (lignes 209–264)
  - `measure()` s'exécute dans `requestAnimationFrame`, remplace la
    ref `heightMap` par une Map clonée pour déclencher la réactivité en une seule
    allocation (ligne ~200).
- `apps/grid-vue/src/components/Grid/components/body/GridBody.vue`
  branche l'engine au viewport de scroll.

### Mapping Angular

- `apps/grid-angular/projects/grid-angular/src/lib/grid/features/vertical-virtual-scroll.engine.ts`
  - `onScroll(scrollTop, viewportHeight)` (ligne 67)
  - `getRowHeight(index)` (ligne 75)
  - `observeRow(absoluteIndex, el, ro)` (ligne 79)
  - `onRowsResized(entries)` (ligne 84) — callback `ResizeObserver`
  - `primeExpanded(absoluteIndex, defaultHeight = 200)` (ligne 113)
  - `rebuildOffsets()` (ligne 118) — consulte également
    `ExpandableRowEngine.getExtraHeightForKey`
  - `scrollOffsetForIndex(index)` (ligne 190).
- `apps/grid-angular/projects/grid-angular/src/lib/grid/state/grid-state.ts`
  — `visibleRowRange`, `topSpacerHeight`, `bottomSpacerHeight`,
  `totalRowsHeight` (lignes 68–74).

## Virtualisation horizontale
### Rôle

Ne rendre que les colonnes unpinned actuellement dans (ou proches de) le viewport
horizontal. Utilisé quand un grid expose 50+ colonnes (le grid PIM Adeo en a
58, le stress grid en a 200) — sans cela, chaque événement scrollLeft
parcourrait chaque cellule de chaque ligne visible.

### Contrat de comportement

- La virtualisation horizontale n'opère que sur la zone **unpinned**.
  Les colonnes pinned-start et pinned-end sont toujours rendues dans chaque
  ligne header / filter / body. C'est par conception : les cellules épinglées doivent être
  stables en layout pour que `position: sticky` fonctionne et elles ne représentent qu'une infime
  fraction du nombre de colonnes.
- L'engine maintient un tableau d'offsets gauche cumulés
  (`offsets[i] = somme des largeurs des colonnes unpinned 0..i-1`). Une recherche
  binaire résout `scrollLeft` en un index de colonne en `O(log n)`.
- Buffer = 300 px de chaque côté (`H_BUFFER_PX`). En dessous de
  `MIN_COLUMNS_FOR_VIRTUALIZATION = 20` colonnes, la virtualisation est
  silencieusement contournée (l'ensemble unpinned complet est rendu).
- `visibleColumnRange = { start, end }` est la plage d'index de tranche.
  `renderedUnpinnedColumns = unpinnedColumns.slice(start, end)`.
  Les spacers de début / fin (`leadingColumnSpacer`,
  `trailingColumnSpacer`) correspondent à la largeur des colonnes ignorées afin que
  la tranche rendue s'aligne avec `scrollLeft`.
- L'engine s'abonne à :
  - changements de largeur de colonne (resize) → reconstruction des offsets
  - reorder / visibilité de colonne → reconstruction des offsets
  - toggle `horizontalVirtualScrollEnabled`
  - `draggingColumn !== null` — voir interaction de drag ci-dessous
- **Contrat avec le drag de colonne** : pendant qu'une colonne est en cours de drag, l'
  engine repasse en mode « range complète » et refuse d'écrire
  `scrollLeft` / `scrollViewportWidth`. Raison : l'auto-scroll du drag de colonne
  émet un événement de scroll par frame ; si ces événements alimentaient l'effet
  de virtualisation, les cellules monteraient / démonteraient à 60 fps et figeraient le navigateur.
  L'engine de drag a de toute façon besoin que chaque cellule unpinned soit montée pour pouvoir
  mesurer les cibles de drop.
- **Contrat avec l'édition inline** : `effectiveColumnRange` élargit la
  tranche pour toujours inclure la cellule en cours d'édition. Quand l'utilisateur scrolle
  loin d'un éditeur ouvert, l'éditeur reste monté car sa colonne
  est forcée à rester dans la tranche rendue (voir
  `state/grid-state.ts:211` / `useGridState.ts:361`).
- **Contrat avec les colonnes épinglées** : l'index relatif à la zone unpinned utilisé par
  l'engine est converti en index d'affichage en ajoutant
  `pinnedLeftColumns.length` pour la math de selection / clipboard / keyboard.
- Comportement de resize : l'`onScroll` de l'engine horizontal est aussi le
  chemin de « viewport resize » — le composant grid reporte
  `(scrollLeft, viewportWidth)` à chaque fois que l'un ou l'autre change, et l'engine
  recalcule la range. Un resize qui élargit le viewport au point d'
  exposer toutes les colonnes produit une range complète.

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | La virtualisation horizontale est **toujours activée** des deux côtés — aucun input à brancher. Le signal interne `horizontalVirtualScrollEnabled` (Angular) reste pour pouvoir le couper en interne pendant le drag de colonne (voir ci-dessus). |
| Outputs / events | Aucun directement. Le changement de range se propage à travers `renderedUnpinnedColumns` aux composants header / filter / body. |
| Slots / projection | n/a. |
| Imperative | `onScroll(scrollLeft, viewportWidth)`, `rebuildOffsets()`. |

### Contrat d'implémentation (interne)

- **Détient** : `visibleColumnRange`, `scrollContentTotalWidth`, plus le
  `offsets: number[]` privé.
- **Lit** : `unpinnedColumns`, `horizontalVirtualScrollEnabled`,
  `draggingColumn`, `scrollLeft`, `scrollViewportWidth`, et (pour
  l'élargissement édition) `cellEditState.editingCell`,
  `pinnedLeftColumns.length`.
- **Effets de bord** : écrit `scrollLeft` et `scrollViewportWidth` sur le
  state manager (sauté pendant le dragging). Ne touche pas au DOM.
- **Couplages** :
  - **column-drag** : garde nécessaire afin que le drag-autoscroll ne thrashe
    pas le DOM.
  - **inline-edit** : l'élargissement de range garde l'éditeur monté.
  - **column-resize** : reconstruit le tableau d'offsets chaque fois que
    `currentWidth` change ; l'engine ne mémoïse pas entre rendus
    car le coût est en O(n) avec une constante minuscule.
  - **autosize** : même chemin que le resize.

### Mapping Vue

- `apps/grid-vue/src/components/Grid/features/useHorizontalVirtualScrollEngine.ts`
  - `onScroll(scrollLeft, viewportWidth)` (ligne 96)
  - `rebuildOffsets()` (ligne 43)
  - `recompute(scrollLeft, viewportWidth)` (ligne 77)
  - `watchEffect` se ré-exécute sur `unpinnedColumns`, `enabled`,
    `draggingColumn`, `scrollLeft`, `scrollViewportWidth` (ligne 108).
- `apps/grid-vue/src/components/Grid/state/useGridState.ts`
  - `effectiveColumnRange` (ligne 361)
  - `renderedUnpinnedColumns` (ligne 375)
  - `leadingColumnSpacer` (ligne 383), `trailingColumnSpacer` (ligne 392).

### Mapping Angular

- `apps/grid-angular/projects/grid-angular/src/lib/grid/features/horizontal-virtual-scroll.engine.ts`
  - `onScroll(scrollLeft, viewportWidth)` (ligne 44)
  - `rebuildOffsets()` (ligne 57)
  - `recompute()` (ligne 68)
  - `effect(() => …, { allowSignalWrites: true })` reflète le
    `watchEffect` Vue (ligne 15).
- `apps/grid-angular/projects/grid-angular/src/lib/grid/state/grid-state.ts`
  - `effectiveColumnRange` (ligne 211)
  - `renderedUnpinnedColumns` (ligne 225)
  - `leadingColumnSpacer` (ligne 233), `trailingColumnSpacer` (ligne 242).
