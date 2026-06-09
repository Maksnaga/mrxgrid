# AdeoGrid Engine — Document d'architecture

> Angular 21 · Signals · Zoneless · OnPush · CDK Overlay · Mozaic Design System
>
> **Ce document décrit le grid tel qu'il est réellement implémenté.** Pour une
> recette pas-à-pas d'ajout de feature, voir [`AJOUTER-UNE-FEATURE.md`](./AJOUTER-UNE-FEATURE.md).
>
> Note historique : une version antérieure de ce fichier était un *blueprint*
> prospectif. Plusieurs idées y ont été remplacées pendant l'implémentation,
> notamment :
> - **Pas de `cdk-virtual-scroll-viewport`.** La virtualisation est custom
>   (`VerticalVirtualScrollEngine` + `HorizontalVirtualScrollEngine`) parce que la
>   stratégie CDK utilise `transform: translateY`, qui piège les cellules `position:
>   sticky` épinglées. Voir §7.
> - **Pas d'abstraction `DataSource<T>`.** Le mode serveur = un signal `mode` +
>   court-circuit du pipeline + events de sortie. Voir §4.
> - L'édition inline, l'arbre (tree), la visibilité de colonnes, le freeze,
>   l'export, la persistance, les formules, le presse-papiers et l'historique sont
>   **livrés**, pas « à venir ».

---

## 1. Vue d'ensemble

```
┌───────────────────────────────────────────────────────────────┐
│                     COUCHE API PUBLIQUE                       │
│  AdGridAngularComponent<T>  ·  AdeoGridColumnDef<T>            │
│  AdeoGridToolbarDef · AdeoGridEmptyDef · AdeoGridFilterOverlay   │
│  Inputs / Outputs / Projection de contenu / API TemplateRef   │
├───────────────────────────────────────────────────────────────┤
│                  COUCHE RENDU (« bête »)                      │
│  header · header-cell · header-menu · body · row · cell       │
│  group-row · detail-row · footer · selection-bar              │
│  empty-state · skeleton-row · loading-indicator               │
│  drawers (settings · group · filter · shortcuts · formula-ref)│
│  filter-builder · formula-editor · column-visibility-panel    │
├───────────────────────────────────────────────────────────────┤
│                  COUCHE ENGINES (« headless »)                │
│  GridEngine<T> (orchestrateur du pipeline de données)         │
│  Feature engines : sort · filter · group · pagination ·       │
│   infinite-scroll · row-selection · cell-selection ·          │
│   inline-edit · clipboard · history · cell-validation ·       │
│   column-resize · column-reorder · column-drag · tree ·       │
│   expandable-row · export · state-persistence · keyboard ·    │
│   vertical/horizontal-virtual-scroll · formula/*              │
├───────────────────────────────────────────────────────────────┤
│                     COUCHE STATE                              │
│  GridStateManager<T> — le store de signaux unique             │
├───────────────────────────────────────────────────────────────┤
│                     COUCHE MODELS                             │
│  column · cell · sort · filter · pagination · display-row ·   │
│  formula · grid-events · grid-options · plugin                │
└───────────────────────────────────────────────────────────────┘
```

### Principes clés

- **L'état est centralisé.** `GridStateManager` est la seule source de vérité. Tout signal partagé y vit. Les engines ne possèdent que des signaux *privés* locaux (ex. `FilterEngine.lastChange`, `HistoryEngine.past`).
- **Les engines sont headless.** TypeScript pur + signaux Angular, aucune logique de template. Ils lisent/écrivent l'état et exposent des méthodes + des `computed()`. Testables unitairement sans DOM.
- **Le rendu est bête.** Les composants bindent des signaux `computed()` et appellent des méthodes d'engine sur les events DOM. Aucune logique métier dans un `.html` ou un `.ts` de rendu.
- **Les features sont isolées et scopées en DI.** Un `@Injectable()` (sans `providedIn`) par concern, listé dans `AdGridAngularComponent.providers` → **une instance d'engine par grid**, pas un singleton global.
- **Le pipeline est composable et mémoïsé.** `sortedData → filteredData → paginatedData → displayRows` sont des `computed()` chaînés dans `GridEngine`.
- **Mode serveur = court-circuit + events.** Chaque étape du pipeline renvoie son entrée inchangée quand `mode === 'server'` ; le grid émet un event et le consommateur réinjecte de nouvelles `[data]`.
- **Mozaic d'abord.** Toujours réutiliser les composants Mozaic et les design tokens (`--color-*`, `--spacing-*`, `--border-radius-*`, `--font-*`). Jamais de couleurs/espacements en dur.

---

## 2. Arborescence des fichiers (réelle)

```
grid/
├── index.ts                       # Barrel de l'API publique
├── grid.ts                        # AdGridAngularComponent<T> — host (template + styles inline)
├── grid.stories.ts                # Storybook (surface de dev principale)
│
├── docs/
│   ├── ARCHITECTURE.md            # ce fichier
│   ├── AJOUTER-UNE-FEATURE.md     # guide pratique d'ajout de feature
│   └── filter-improvement-plan.md
│
├── models/
│   ├── index.ts                   # ré-export barrel
│   ├── column.model.ts            # ColumnDef<T>, ColumnStateEntry, Column*Event, HeaderMenu*
│   ├── cell.model.ts              # CellCoord, CellRange, CellEditState, Cell/Bulk*Event, CellError, FillDownEvent
│   ├── sort.model.ts              # SortDef, SortEvent
│   ├── filter.model.ts            # FilterModel, FilterCondition, opérateurs, AdeoGridCustomFilter, …
│   ├── pagination.model.ts        # LoadingStrategy, PaginationState, PageEvent, LoadMoreEvent
│   ├── display-row.model.ts       # DisplayRow<T> (data | group | detail), GroupRow<T>
│   ├── formula.model.ts           # CellAddress, FormulaValue(s), FormulaError, types du registre de fonctions
│   ├── grid-events.model.ts       # GridEventMap, GridDensity, events Group/Settings/Export, ActiveFilter
│   ├── grid-options.model.ts      # GridOptions<T> + DEFAULT_GRID_OPTIONS
│   └── plugin.model.ts            # GridPlugin
│
├── directives/
│   ├── grid-column-def.ts         # AdeoGridColumnDef<T> — API déclarative de colonne (inputs + templates #cell/#edit/#filter)
│   ├── grid-toolbar-def.ts        # AdeoGridToolbarDef — projection de slot toolbar (start/end)
│   ├── grid-empty-def.ts          # AdeoGridEmptyDef — template d'état vide (no-data | no-results)
│   └── grid-filter-overlay.directive.ts  # helper de positionnement de l'overlay de filtre
│
├── engine/
│   └── grid-engine.ts             # GridEngine<T> — computeds du pipeline + displayIndexToSourceIndex()
│
├── state/
│   └── grid-state.ts              # GridStateManager<T> — le store de signaux unique
│
├── features/                      # un engine par concern (tous @Injectable, fournis dans grid.ts)
│   ├── sort.engine.ts
│   ├── filter.engine.ts
│   ├── group.engine.ts
│   ├── pagination.engine.ts
│   ├── infinite-scroll.engine.ts
│   ├── row-selection.engine.ts
│   ├── cell-selection.engine.ts
│   ├── inline-edit.engine.ts
│   ├── clipboard.engine.ts        # copier/couper/coller/supprimer/remplir → mutations de cellules
│   ├── history.engine.ts          # piles undo/redo (persistées en option)
│   ├── cell-validation.engine.ts  # validateurs par cellule → carte d'erreurs
│   ├── column-resize.engine.ts
│   ├── column-reorder.engine.ts   # réordonnancement pur d'index de columnStates
│   ├── column-drag.engine.ts      # drag au pointeur + ghost + auto-scroll
│   ├── expandable-row.engine.ts   # ensemble des lignes master/detail dépliées
│   ├── tree.engine.ts             # données hiérarchiques → TreeDisplayRow[] plat
│   ├── export.engine.ts           # CSV côté client
│   ├── state-persistence.engine.ts# colonnes/tri/filtre → localStorage
│   ├── keyboard.engine.ts         # navigation + dispatch des raccourcis
│   ├── vertical-virtual-scroll.engine.ts
│   ├── horizontal-virtual-scroll.engine.ts
│   └── formula/                   # sous-système de formules tableur
│       ├── formula.engine.ts      # possède les cellules formules + le DAG + l'évaluation
│       ├── formula-parser.ts · formula-tokenizer.ts · formula-ast.ts
│       ├── formula-evaluator.ts · formula-dag.ts
│       ├── formula-functions.default.ts (DEFAULT_FORMULA_FUNCTIONS)
│       ├── formula-ref-mapper.ts · formula-ref-highlight.service.ts · formula-ref-palette.ts
│       ├── formula-shift.ts       # rebase les refs relatives lors d'un fill/paste
│       └── formula-suggestions.ts # autocomplétion
│
├── components/
│   ├── header/                    # grid-header + grid-header-cell (tri, poignée de resize, déclencheur de menu, recherche)
│   ├── header-menu/               # listbox d'actions de colonne
│   ├── body/                      # host du virtual scroll (spacers + lignes fenêtrées)
│   ├── row/                       # ligne de données
│   ├── cell/                      # wrapper de cellule (bascule vue/édition, focus, sélection, poignée de fill)
│   ├── group-row/                 # ligne d'en-tête de groupe (déplier/replier)
│   ├── detail-row/                # contenu master/detail dépliable
│   ├── footer/                    # pagination
│   ├── selection-bar/             # barre d'actions bulk (éditer/copier/coller/exporter/supprimer)
│   ├── empty-state/               # no-data / no-results
│   ├── skeleton-row/ · loading-indicator/  # UX de chargement
│   ├── column-visibility-panel/   # restaurer les colonnes masquées
│   ├── filter-builder/            # builder multi-conditions (+ moz-custom-filter-host.directive)
│   ├── filter-drawer/             # filter builder hébergé dans un drawer
│   ├── settings-drawer/           # réglages colonnes + densité
│   ├── group-drawer/              # configuration du group-by
│   ├── keyboard-shortcuts-drawer/ # référence des raccourcis
│   ├── formula-editor/            # saisie de formule avec surlignage de refs + autocomplétion
│   └── formula-reference-drawer/  # référence des fonctions
│
└── utils/
    └── track-by.ts
```

---

## 3. Modèles TypeScript

> La source de vérité reste `models/*.model.ts`. Ci-dessous un résumé fidèle ;
> les champs sont allégés pour la lisibilité — voir les fichiers pour la JSDoc complète.

### 3.1 `ColumnDef<T>` (`column.model.ts`)

```typescript
export type SortDirection = 'asc' | 'desc' | null;
export type CellEditorType =
  | 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date' | 'toggle' | 'custom';

export interface ColumnDef<T = unknown> {
  field: string;
  headerName?: string;
  width?: string; minWidth?: string; maxWidth?: string; flex?: number;

  // Capacités
  sortable?: boolean;          sortComparator?: (a: T, b: T) => number;
  resizable?: boolean;         reorderable?: boolean;
  groupable?: boolean;
  filterable?: boolean;
  pinned?: 'start' | 'end' | null;
  visible?: boolean;           hideable?: boolean;     freezable?: boolean;
  searchVisible?: boolean;     headerMenuDisabled?: boolean;

  // Accès / affichage de la valeur
  valueGetter?: (row: T) => unknown;
  valueFormatter?: (value: unknown, row: T) => string;
  cellClass?: string | ((row: T) => string);   headerClass?: string;

  // Filtrage (builder multi-conditions)
  filterType?: FilterDataType;                  // text|number|date|set|boolean|custom (déduit de cellEditor si absent)
  filterOperators?: FilterOperator[];
  defaultFilterOperator?: FilterOperator;
  filterOptions?: { value: unknown; label: string }[];   // pour `set`
  filterComponent?: Type<AdeoGridCustomFilter>;           // composant éditeur custom
  filterPredicate?: (row: T, value: FilterValue) => boolean;  // prédicat custom côté client
  filterIsComplete?: (value: FilterValue) => boolean;

  // Édition
  editable?: boolean;
  cellEditor?: CellEditorType;
  cellEditorOptions?: MozSelectOption[];
  cellEditorValidator?: (value: unknown, row: T) => boolean | string;
  cellValidator?: (value: unknown, row: T) => CellError | null;

  // Templates
  cellTemplate?: TemplateRef<unknown>;
  editTemplate?: TemplateRef<unknown>;
  filterTemplate?: TemplateRef<unknown>;

  // Formules
  allowFormula?: boolean;       // implique editable ; `=…` routé vers FormulaEngine
}
```

État runtime par colonne (muté par resize/reorder/freeze/hide/sort) :

```typescript
export interface ColumnStateEntry {
  field: string;
  currentWidth: number;           // px résolus
  order: number;                  // ordre d'affichage
  visible: boolean;
  sort: SortDirection;            // direction de tri courante
  sortIndex: number | null;       // priorité multi-tri
  pinned: 'start' | 'end' | null;
  searchVisible: boolean;
}
```

`column.model.ts` exporte aussi `ColumnResizeEvent`, `ColumnReorderEvent`, `ColumnFreezeEvent`, `ColumnVisibilityEvent`, `ColumnSearchToggleEvent`, `HeaderMenuActionId`, `HeaderMenuConfig`.

### 3.2 Modèles de cellule, édition & bulk (`cell.model.ts`)

```typescript
export interface CellCoord { row: number; col: number; }
export interface CellRange { start: CellCoord; end: CellCoord; }

export interface CellEditState {
  editingCell: CellCoord | null;
  originalValue: unknown; draftValue: unknown;
  validationError: string | null;
}

export interface CellEditEvent<T = unknown> { row: T; rowIndex: number; field: string; oldValue: unknown; newValue: unknown; }
export interface CellEditCancelEvent { rowIndex: number; field: string; originalValue: unknown; }
export interface CellError { message: string; }

// Opérations bulk (pilotées par la selection-bar + le clipboard engine)
export interface BulkCellChange { rowIndex: number; rowId: unknown; field: string; oldValue: unknown; newValue: unknown; }
export interface BulkEditEvent   { range: CellRange | null; cellCount: number; rowIds: unknown[]; fields: string[]; … }
export interface BulkCopyEvent   { range: CellRange | null; data: string[][]; rowIds: unknown[]; fields: string[]; … }
export interface BulkPasteEvent  { range: CellRange | null; data: string[][]; changes: BulkCellChange[]; … }
export interface BulkDeleteEvent { range: CellRange | null; changes: BulkCellChange[]; … }
export interface FillDownEvent   { sourceCell: CellCoord; sourceValue: unknown; direction: 'vertical' | 'horizontal'; affectedCellCount: number; … }
```

### 3.3 Lignes (`display-row.model.ts`)

La liste plate sur laquelle itère le body. **Trois** types de lignes (noter `detail`) :

```typescript
export type DisplayRow<T = unknown> =
  | { type: 'data';   data: T; index: number; depth: number }
  | { type: 'group';  group: GroupRow<T> }
  | { type: 'detail'; data: T; index: number };   // contenu master/detail dépliable

export interface GroupRow<T = unknown> {
  type: 'group'; field: string; value: unknown; displayValue: string;
  depth: number; count: number; expanded: boolean; groupKey: string;
  children: (GroupRow<T> | T)[]; parent: GroupRow<T> | null;
}
```

`TreeEngine` produit son propre `TreeDisplayRow<T>` (ajoute `hasChildren`, `expanded`, `nodeKey`).

### 3.4 Tri & pagination

```typescript
export interface SortDef { field: string; direction: SortDirection; priority: number; }
export interface SortEvent { sorts: SortDef[]; }

export type LoadingStrategy = 'pagination' | 'infinite-scroll';
export interface PageEvent { pageIndex: number; pageSize: number; previousPageIndex: number; previousPageSize: number; }
export interface LoadMoreEvent { offset: number; limit: number; }   // infinite scroll
```

### 3.5 Modèle de filtre (`filter.model.ts`)

Un **builder multi-conditions** (pas un `FilterDef` plat). Formes clés :

- `FilterModel { conditions: FilterCondition[] }` — l'objet d'état unique.
- `FilterCondition { id; field; type: FilterDataType; operator: FilterOperator; value: FilterValue; combinator? }`.
- `FilterDataType = 'text' | 'number' | 'date' | 'set' | 'boolean' | 'custom'`, avec des unions d'opérateurs par type et `DEFAULT_OPERATORS` / `DEFAULT_OPERATOR_PER_TYPE` / `OPERATOR_LABELS` / `VALUELESS_OPERATORS` / `RANGE_OPERATORS`.
- `FilterMode = 'client' | 'server'` (indépendant du `mode` du grid), `FilterApplyMode = 'auto' | 'manual'`.
- `AdeoGridCustomFilter` — classe de base abstraite qu'un composant consommateur étend pour fournir un éditeur de valeur sur mesure.
- Helpers : `generateConditionId()`, `isConditionComplete()`.

### 3.6 Modèle de formule (`formula.model.ts`)

`CellAddress { rowId; field }`, `FormulaValue` / `FormulaValues`, `FormulaError` (`#CYCLE!`, `#REF!`, …), `FormulaEvalContext`, `FormulaFunctionRegistry`. Les formules stockées utilisent une forme longue `REF(COLUMN("price"), ROW(1))` ; l'éditeur affiche la notation A1 (`B5`) via le ref-mapper.

### 3.7 Events du grid & divers (`grid-events.model.ts`)

`GridEventMap` (catalogue de types), `RowSelectionEvent<T>`, `CellSelectionEvent<T>`, `GroupEvent` (+ `GroupEntry`), `GridExportEvent`, `ActiveFilter`, `GridDensity = 'small' | 'default' | 'large'`, `GridSettingsData/Result`, `GroupDrawerData/Result`.

### 3.8 Modèle de plugin (`plugin.model.ts`)

```typescript
export interface GridPlugin {
  name: string;
  init(state: GridStateManager<never>): void;   // reçoit le STORE d'état (pas l'engine)
  destroy(): void;
}
```

---

## 4. Flux de données

### 4.1 Le pipeline (`engine/grid-engine.ts`)

Quatre `computed()` chaînés et mémoïsés :

```
sourceData (state)
   │  SortEngine.sortData         ── sortedData      (serveur → passthrough)
   ▼
sortedData
   │  FilterEngine.filterData     ── filteredData    (serveur → passthrough)
   ▼
filteredData
   │  slice(pageIndex,pageSize)   ── paginatedData   (serveur / infinite-scroll / pagination off → passthrough)
   ▼
paginatedData
   │  GroupEngine.groupData  (si groupColumns)        ── displayRows: DisplayRow<T>[]
   │  sinon wrap chaque ligne en { type:'data', index, depth:0 }
   ▼
displayRows  →  consommé par le body (virtual scroll custom)
```

La mémoïsation est gratuite : si seul le tri change, `filteredData` renvoie sa référence en cache et le groupage ne recalcule pas. `GridEngine.displayIndexToSourceIndex()` retrouve l'index dans `sourceData` à partir d'un index de ligne rendue (nécessaire à l'édition/clipboard/formules car tri/filtre/groupe/pagination cassent la correspondance 1:1).

### 4.2 Client vs Serveur

| | Client (`mode='client'`) | Serveur (`mode='server'`) |
|---|---|---|
| tri / filtre / pagination | calculés dans le pipeline | **passthrough** — le serveur l'a déjà fait |
| total | `filteredData().length` | input `totalItems` |
| action utilisateur | mute l'état → le pipeline recalcule | mute l'état (pour l'UI) → **émet un event** → le consommateur recharge `[data]` |

`filterMode` est indépendant : on peut paginer côté serveur mais filtrer côté client.

### 4.3 Events de sortie (pattern « one-shot »)

Les outputs ne sont **jamais** émis depuis un `computed`. Un engine qui doit signaler un changement garde un signal privé `lastChange` et expose `lastEvent` ; le host l'observe via un `effect` et émet exactement une fois (cf. `FilterEngine` ↔ `grid.ts filterChange`).

---

## 5. État (`state/grid-state.ts`)

`GridStateManager<T>` est le seul store partagé. Groupes de signaux :

- **Données/mode** : `sourceData`, `totalItems`, `mode`, `filterMode`, `loadingStrategy`.
- **Colonnes** : `columnDefs`, `columnStates` (+ dérivés `visibleColumns`, `pinnedLeft/Right/unpinnedColumns`, offsets cumulés de pin, `gridTemplateColumns`, `totalContentWidth`, `columnDefMap`, `hasFormulaColumns`).
- **Tri/Groupe/Filtre** : `activeSorts`, `groupColumns`, `expandedGroups`, `filterModel`.
- **Pagination** : `paginationEnabled`, `pageIndex`, `pageSize`, `visibleRowCount`, dérivés `totalPages`, `hasMore`.
- **Scroll & virtualisation** : `scrollLeft/Top`, tailles de viewport, `visibleColumnRange` + spacers (H), `visibleRowRange` + `top/bottomSpacerHeight` + `totalRowsHeight` (V).
- **Sélection** : lignes (`selectedRowIds`, `excludedRowIds`, `selectAllMode`), cellules (`focusedCell`, `selectedCell`, `cellRange`, `isDragging`, `focusSource`), `activeSelectionMode` (rows | cells | none — mutuellement exclusif), fill (`isFilling`, `fillAnchor`, `fillTarget`), `cutSource`.
- **Édition/UI** : `cellEditState`, `expandedRowIds`, `rowIdField`, `isLoading`, `rowHeight`, `density`, drag de colonne (`draggingColumn`, `dropIndicatorIndex`), `formulaBarEditingActive`.

L'état dérivé **structurel** vit ici sous forme de `computed()`. L'état dérivé du **pipeline** vit dans `GridEngine`.

---

## 6. Catalogue des feature engines

Tous sont `@Injectable()` (sans `providedIn`), listés dans `AdGridAngularComponent.providers`, génériques `<T>`, injectant `GridStateManager` (+ leurs voisins au besoin).

| Engine | Responsabilité | État principal touché |
|---|---|---|
| `GridEngine` | Orchestrateur du pipeline (§4) + mapping d'index | lit tout |
| `SortEngine` | Cycle multi-tri, comparateurs custom, `sortData()` | `activeSorts`, `sort/sortIndex` de colonne |
| `FilterEngine` | CRUD multi-conditions, `filterData()`, label/`lastEvent` | `filterModel`, `pageIndex` |
| `GroupEngine` | Construit l'arbre de groupes + aplatit en `DisplayRow[]` | `groupColumns`, `expandedGroups` |
| `PaginationEngine` | Maths de pagination + `goToPage/next/previous` | `pageIndex`, `pageSize` |
| `InfiniteScrollEngine` | Listener de scroll proche du bas → `LoadMoreEvent` | `loadingStrategy`, `hasMore` |
| `RowSelectionEngine` | Sélection par checkbox (page/all/exclude), event de sélection | `selectedRowIds`, `excludedRowIds`, `selectAllMode` |
| `CellSelectionEngine` | Focus/clic/range/drag de cellule, clear focus | `focusedCell`, `selectedCell`, `cellRange`, `isDragging` |
| `InlineEditEngine` | Cycle d'édition, résolution du type d'éditeur, saisie de formule | `cellEditState` ; appelle history + validation + formula |
| `ClipboardEngine` | Applique copier/couper/coller/supprimer/remplir sur `sourceData` | lit le range → `sourceData`, `cutSource` |
| `HistoryEngine` | Piles undo/redo (cap 50), miroir localStorage optionnel | `past`/`future` privés |
| `CellValidationEngine` | Exécute `cellValidator` → carte d'erreurs ; `validateAll/validateCell` | `cellErrors` privé |
| `ColumnResizeEngine` | Clamp de largeur piloté au pointeur | `columnStates.currentWidth` |
| `ColumnReorderEngine` | Réordonnancement d'index pur (global + relatif aux unpinned) | `columnStates.order` |
| `ColumnDragEngine` | Drag au pointeur, élément ghost, ligne de drop, auto-scroll | `draggingColumn`, `dropIndicatorIndex` → reorder |
| `ExpandableRowEngine` | Ensemble des lignes master/detail dépliées | `expandedRowIds` |
| `TreeEngine` | Données hiérarchiques → `TreeDisplayRow[]` plat (depth) | lit `sourceData`, ensemble déplié |
| `ExportEngine` | Construction + téléchargement CSV côté client | lit `visibleColumns`, defs |
| `StatePersistenceEngine` | Sérialise colonnes/tri/filtre → localStorage ; restaure | `columnStates`, `activeSorts`, `filterModel` |
| `KeyboardEngine` | Navigation hors édition ; renvoie les raccourcis aux actions du host | `focusedCell` ; `registerActions()` |
| `VerticalVirtualScrollEngine` | Fenêtrage de lignes basé sur la hauteur (remplace CDK) | `visibleRowRange`, spacers, `totalRowsHeight` |
| `HorizontalVirtualScrollEngine` | Fenêtrage de colonnes (≥20 colonnes) | `visibleColumnRange`, spacers de colonnes |
| `formula/FormulaEngine` (+ helpers) | Parse/évalue les formules, DAG de dépendances, détection de cycles | carte de cellules privée ; signal `values` |

> Note : le **freeze** et la **visibilité** de colonne n'ont pas d'engine dédié —
> ce sont de simples mutations `state.updateColumnState(field, …)` (`pinned`,
> `visible`) gérées dans `grid.ts` (`freezeLeft/freezeRight`, actions du
> header-menu) et le panneau de visibilité de colonnes. Le positionnement sticky
> est dérivé de `pinnedLeft/RightCumulativeOffsets`.

---

## 7. Rendu & virtualisation

### 7.1 Conteneur de scroll unique

`.ad-grid__scroll` est le **seul** élément `overflow:auto`. L'en-tête est `position: sticky; top: 0` à l'intérieur ; les cellules épinglées sont `position: sticky; left/right: <offset>px`. Il n'y a **aucun transform** dans le sous-arbre — c'est ce qui permet au sticky natif de fonctionner.

### 7.2 Pourquoi un virtual scroll custom (pas CDK)

`cdk-virtual-scroll-viewport` positionne les lignes avec `transform: translateY` sur un wrapper de contenu. `transform` crée un bloc englobant qui **piège les descendants `position: sticky`**, ce qui casse les cellules de colonnes épinglées. Donc :

- **`VerticalVirtualScrollEngine`** maintient un cache d'offsets cumulés (reconstruit quand le nombre de lignes / la densité / l'ensemble déplié change) et calcule la fenêtre visible par recherche binaire sur `scrollTop`/`viewportHeight`. Les lignes hors fenêtre sont remplacées par une **hauteur de spacer haut/bas** plutôt qu'un transform. Les detail rows dépliées sont mesurées avec un `ResizeObserver` (hauteur variable supportée).
- **`HorizontalVirtualScrollEngine`** fenêtre les colonnes unpinned (seulement au-delà de `MIN_COLUMNS_FOR_VIRTUALIZATION = 20`), via des spacers de colonnes en tête/queue. Il force le rendu de toutes les colonnes pendant un drag de colonne pour que le drag engine puisse mesurer les cibles de drop.

`grid.ts` câble les deux engines aux events `scroll`/`ResizeObserver` de l'élément de scroll via `requestAnimationFrame`, hors de la zone Angular.

### 7.3 Scroll-into-view au clavier

Sur déplacement de focus au clavier (`focusSource === 'keyboard'`), `grid.ts` ramène la cellule focalisée dans la vue : `scrollIntoView({block:'nearest'})` natif quand la ligne est montée, sinon calcul manuel à partir du cache d'offsets de l'engine vertical.

---

## 8. Sous-systèmes édition, mutation & formules

```
Édition inline :  double-clic / frappe / Entrée → InlineEditEngine.startEdit
   → la cellule bascule vue→édition, éditeur choisi via cellEditor (ou auto selon le type de valeur)
   → commit : valider → écrire sourceData[field] (client) / émettre cellEdit (serveur)
   → enregistre une op HistoryEngine ; les cellules allowFormula routent '=' vers FormulaEngine

Bulk (selection-bar + raccourcis clavier) :
   copier/couper/coller/supprimer/remplir → ClipboardEngine applique les changements coercés+validés
   → renvoie BulkCellChange[] (émis comme events bulk* / fillDown)
   → enregistrés pour undo/redo

Validation : CellValidationEngine.validateAll s'exécute à chaque changement de données (effect dans grid.ts)
   → carte cellErrors → les cellules affichent un style d'erreur

Formules (quand [formulas]=true et colonne allowFormula) :
   FormulaEngine parse, construit un DAG de dépendances, détecte les cycles (#CYCLE!),
   évalue en ordre topologique, expose un signal `values` que les cellules rendent.
   L'éditeur (formula-editor) + la barre de formule du haut donnent refs A1, surlignages, autocomplétion.
```

L'historique (`HistoryEngine`) plafonne à 50 ops, supporte `undo/redo`, et se miroite dans localStorage quand il est lié à `stateKey`.

---

## 9. Sélection

Deux modes **mutuellement exclusifs** via `activeSelectionMode` :

- **Sélection de lignes** (`RowSelectionEngine`) : checkbox par ligne, toggles page/all, bandeau « tout sélectionner N » porté par `selectedRowIds` + `excludedRowIds` (donc « tout sauf quelques-uns » est peu coûteux). Émet `RowSelectionEvent`.
- **Sélection de cellules** (`CellSelectionEngine` + `KeyboardEngine`) : cellule unique, range au drag, navigation clavier, poignée de fill. Émet `CellSelectionEvent`. Pilote la `selection-bar` bulk.

Sélectionner des lignes efface le focus cellule, et inversement.

---

## 10. API publique (host `grid.ts`)

### Inputs

`data`, `mode`, `filterMode`, `totalItems`, `pagination`, `pageSize`, `pageSizeOptions`, `rowHeight`, `loading`, `rowSelection`, `expandable`, `rowIdField`, `formulas`, `detailTemplate`, `fullscreen`, `reorderable`, `stateKey`, `exportable`, `exportMode`, `showToolbar`, `multiCellSelection`, `loadingStrategy`, `scrollThreshold`, `plugins`, `filterApplyMode`, plus les textes d'état vide (`emptyDataTitle/Description`, `noResultsTitle/Description`, `noResultsActionLabel`).

### Outputs

`sortChange`, `pageChange`, `loadMore`, `cellEdit`, `cellEditCancel`, `selectionChange`, `cellSelectionChange`, `groupChange`, `filterChange`, `bulkEdit`, `bulkCopy`, `bulkPaste`, `bulkDelete`, `fillDown`, `settingsChange`, `exportRequest`.

### Projection de contenu

`AdeoGridColumnDef` (colonnes, avec templates `#cell` / `#edit` / `#filter`), `AdeoGridToolbarDef` (`slot="start|end"`), `AdeoGridEmptyDef` (`kind="no-data|no-results"`), `[mozGridFilterTags]`.

### Providers

Le host fournit tous les engines + `GridStateManager` + `GridEngine` + `FormulaRefHighlightService` + l'`Overlay` CDK → tout est scopé par instance de grid.

---

## 11. Extensibilité

- **Plugins** : passer `[plugins]` ; chaque `GridPlugin.init(state)` reçoit le `GridStateManager` et peut lire/écrire les signaux pour superposer un comportement. `destroy()` pour le teardown.
- **Rendu custom cellule / édition / filtre** : templates `#cell`, `#edit`, `#filter` sur `AdeoGridColumnDef`, ou un `filterComponent` étendant `AdeoGridCustomFilter`.
- **Fonctions de formule custom** : étendre `DEFAULT_FORMULA_FUNCTIONS`.
- **Nouvelle feature** : suivre le pattern engine — signaux d'état → engine → (pipeline) → provider → câblage host → export public. Voir [`AJOUTER-UNE-FEATURE.md`](./AJOUTER-UNE-FEATURE.md).

---

## 12. Stratégie de performance

- **OnPush + signaux partout.** Les templates lisent des `computed()`, pas des appels de méthode.
- **Pipeline mémoïsé.** Chaque étape ne se réévalue que quand sa dépendance directe change.
- **Travail pointeur/scroll hors zone.** Resize, drag de colonne, drag de fill et listeners de scroll tournent via `runOutsideAngular` / listeners passifs + `requestAnimationFrame` ; seule l'écriture finale du signal déclenche la détection de changement.
- **Fenêtrage custom.** La virtualisation verticale (cache de hauteurs + recherche binaire) et horizontale (≥20 colonnes) garde le DOM petit ; les spacers préservent la géométrie de la scrollbar sans transform.
- **Élargissement de la fenêtre d'édition.** `effectiveColumnRange` garde la colonne en cours d'édition montée pour que l'éditeur ne soit jamais détruit en plein milieu.
- **trackBy stable.** Les lignes de groupe trackent par `groupKey`, les lignes de données par `rowIdField`.

---

## 13. Intégration Mozaic

| Élément du grid | Composant Mozaic |
|---|---|
| Boutons de toolbar | `MozButtonComponent`, `MozIconButtonComponent` |
| Tags (groupe/filtre/masqué) | `MozTagComponent` |
| Badge de compteur de filtres | `MozNumberBadgeComponent` |
| Drawers | `MozDrawerService` |
| Inputs/selects dans éditeurs & filtres | `MozTextInputComponent`, `MozSelectComponent`, … |
| Icônes | `@mozaic-ds/icons-angular` |

**Règle Mozaic d'abord (obligatoire) :** ne jamais construire un élément d'UI
custom quand un composant Mozaic existe ; ne jamais coder en dur
couleurs/espacements/rayons — référencer les design tokens via des custom
properties CSS (`--color-*`, `--spacing-*`, `--border-radius-*`, `--font-*`).
