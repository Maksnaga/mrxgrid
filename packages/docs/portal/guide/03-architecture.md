# Architecture

> Comment les morceaux sont branchés. Si tu lis ce doc avant de plonger dans le code, tu gagneras quelques heures.

Ces concepts s'appliquent aux deux implémentations (Vue et Angular). La structure est volontairement identique — seuls les noms de fichiers et l'unité de composition diffèrent (composable côté Vue, classe `@Injectable` côté Angular).

## Vue d'ensemble — les 3 couches

```
┌─────────────────────────────────────────────────────────────────────────┐
│ COUCHE PUBLIQUE   <ad-grid-vue /> (Vue) / <ad-grid-angular> (Angular)   │
│  - Surface API (props/inputs, events/outputs, slots/templates)          │
│  - Orchestration uniquement, pas de logique métier                      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ COUCHE STATE + ENGINE                                                   │
│   State manager (signals)   ── source de vérité                         │
│      activeSorts, columnStates, cellEditState, filterModel,             │
│      cutSource, sourceData, visibleColumns, …                           │
│                                                                         │
│   Engines (un par concern) ── lisent / écrivent le state                │
│      sort   filter   group   formula   cellValidation                   │
│      tree   selection   clipboard   history (undo/redo)                 │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ COUCHE COMPOSANTS DE PRÉSENTATION                                       │
│   Header   Filter row   Body (sticky / virtual)   Footer / Pagination   │
│   Drawers (toolbar / groupage / filtres / settings)   Overlays (menu)   │
│   Column (déclaratif), slots/templates de cell / expand-row             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Hiérarchie des composants

```
<ad-grid-vue /> / <ad-grid-angular>
├── slot/projection "toolbar"               ← GridToolbar (optionnel)
├── <ad-grid-tag-bar />                          ← HIDDEN / GROUPED / FILTERED tags
├── <ad-grid-formula-bar />                          ← optionnelle, pour =A1*B2
├── <div class="grid-wrapper">              ← scrollable, overflow:auto
│   ├── <div class="grid-sticky-header">
│   │   ├── <ad-grid-header />                  ← columns + checkbox + expand
│   │   │   └── <ad-grid-header-cell />          ← sort indicator + kebab + resize
│   │   └── <ad-grid-filter-row />               ← filter inputs (optional)
│   └── <ad-grid-body>                          ← virtual or non-virtual
│       └── <ad-grid-row> (×N)
│           └── <ad-grid-cell> (×cols)          ← editor / renderer / slot
│       └── <ad-grid-group-row> (×groups)        ← when grouping is active
│       └── <ad-grid-detail-row> (×expanded)     ← expand-row slot/template host
└── <ad-grid-footer>
    ├── <ad-grid-pagination />                  ← when pagination is enabled
    ├── <ad-grid-selection-bar />                ← floats when rows selected
    └── <ad-grid-loading-indicator />            ← infinite scroll spinner

— Drawers vivent en dehors du wrapper (Teleport ou siblings) :
   <ad-grid-settings-drawer />     ← settings (densité / colonnes cachées / ordre)
   <ad-grid-grouping-drawer />      ← drag-n-drop des champs de groupement
   <ad-grid-filter-drawer />    ← multi-condition builder
   <ad-grid-keyboard-shortcuts-drawer />
   <ad-grid-formula-reference-drawer />
```

## Flot de données

Le pipeline est **unidirectionnel** : `rows` traverse une chaîne d'opérations pures et arrive aux cellules sous forme de slice virtualisée.

```
rows  (input — N rows arbitraires)
     │
     ▼
┌────────────────┐
│ Sort engine    │  multi-column sort stack
│                │  → stable sort, comparator par colonne
└────────┬───────┘
         ▼
┌────────────────┐
│ Filter engine  │  ColumnDef.filter (legacy) + FilterModel (builder)
│                │  AND between conditions, OR within set ops
└────────┬───────┘
         ▼
┌────────────────┐
│ Group engine   │  group fields → flat list with __adg-prefixed metadata
│                │  (group rows + data rows in one Array)
└────────┬───────┘
         ▼
┌────────────────┐
│ Pagination     │  page slicing OR infinite scroll markers
│                │
└────────┬───────┘
         ▼
┌────────────────┐
│ Virtual grid   │  visible row range + visible column range
│ (vScroll +     │  → DOM minimaliste : 80 lignes max × 30 colonnes max
│  vColumns)     │
└────────┬───────┘
         ▼
   <ad-grid-row> × visibleRange
       <ad-grid-cell> × visibleCols
```

## File structure

### Vue (`apps/grid-vue/src/components/Grid/`)

```
Grid.vue                              ← orchestrateur principal (~2200 LOC)
Column.vue                            ← API déclarative <ad-grid-column field=…/>
index.ts                              ← barrel public (export Grid + types)
types.ts                              ← ColumnDef, RowData, CellFlags, …

components/                           ← composants de présentation
  header/
    GridHeader.vue
    GridHeaderCell.vue
    GridHeaderMenu.vue                ← kebab popup (sort / pin / hide…)
    GridFilterRow.vue
    ColumnFilterOverlay.vue
  body/
    GridBody.vue
    GridRow.vue
    GridCell.vue
    GridGroupRow.vue
    GridDetailRow.vue
  footer/
    GridFooter.vue
    GridPagination.vue
    GridLoadingIndicator.vue
  overlays/
    GridToolbar.vue
    TableMenuDrawer.vue
    GroupingDrawer.vue
    GridFilterDrawer.vue
    GridFilterBuilder.vue
    FormulaBar.vue

state/                                ← state central
  useGridState.ts                     ← refs + computeds, source de vérité
  GridContext.ts                      ← provide/inject key
  ColumnRegistry.ts                   ← <ad-grid-column> register/unregister
  GridSlots.ts                        ← per-field slot resolution
  defaults.ts                         ← magic numbers (row height, densité…)

engine/
  useGridEngine.ts                    ← hub : sort / filter / group / formula / …

features/                             ← engines composables
  useSortEngine.ts
  useFilterEngine.ts
  useGroupEngine.ts
  useVariableHeightVirtualScroll.ts
  useInlineEditEngine.ts
  useCellValidationEngine.ts
  formula/
    useFormulaEngine.ts
    formula-functions.default.ts
    useRefHighlight.ts

models/                               ← types partagés Vue/Angular
  cell.model.ts
  column.model.ts
  filter.model.ts
  …

__stories__/                          ← stories Storybook + docs MDX
```

### Angular (`apps/grid-angular/projects/grid-angular/src/lib/grid/`)

```
grid.ts                               ← orchestrateur <ad-grid-angular>
grid.html / grid.scss
index.ts                              ← barrel public

state/
  grid-state.ts                       ← GridStateManager (signals)

engine/
  grid-engine.ts                      ← wire des features au state

features/                             ← engines = classes @Injectable
  sort.engine.ts
  filter.engine.ts
  group.engine.ts
  tree.engine.ts
  column-resize.engine.ts
  column-reorder.engine.ts
  column-drag.engine.ts
  cell-selection.engine.ts
  row-selection.engine.ts
  cell-validation.engine.ts
  inline-edit.engine.ts
  keyboard.engine.ts
  expandable-row.engine.ts
  export.engine.ts
  state-persistence.engine.ts
  horizontal-virtual-scroll.engine.ts

components/                           ← header, body, footer, overlays
directives/
strategies/
utils/
models/
```

## Inventaire des engines

Une vingtaine d'unités testées, indépendantes, composables. Côté Vue ce sont des composables (`useXxx`), côté Angular des classes `@Injectable()` du même nom (`XxxEngine`).

| Engine | Responsabilité |
|---|---|
| `gridData` / `GridDataEngine` | Pipeline colonnes (passthrough actuel) |
| `columns` / `ColumnsEngine` | Visibilité, pin overrides, filter toggles |
| `sort` / `SortEngine` | Multi-column sort stack |
| `group` / `GroupEngine` | Row grouping → flat list `__adg*` |
| `pinnedColumns` / `PinnedColumnsEngine` | Layout left/right pinned + offsets |
| `columnResize` / `ColumnResizeEngine` | Drag-to-resize widths |
| `columnDnD` / `ColumnDragEngine` + `ColumnReorderEngine` | Drag-n-drop reorder |
| `useVirtualScroll` / `VerticalVirtualScrollEngine` | Vertical virtualization (index-based, toujours actif) |
| `useVirtualColumns` / `HorizontalVirtualScrollEngine` | Horizontal virtualization (toujours actif) |
| `useVirtualGrid` | Combine vScroll + vCols |
| `dataSource` | Page-based lazy fetch |
| `lazyRows` | Infinite scroll markers |
| `rowSelection` / `RowSelectionEngine` | Checkbox model (none/some/all) |
| `rowExpansion` / `ExpandableRowEngine` | Expandable rows toggle |
| `activeCell` | Single active cell tracking |
| `cellSelection` / `CellSelectionEngine` | Range selection (rectangulaire) |
| `cellEditing` / `InlineEditEngine` | Inline edit lifecycle |
| `fillHandle` | Excel fill handle drag |
| `keyboard` / `KeyboardEngine` | Navigation + raccourcis |
| `mouseSelection` | Click + Shift + Ctrl multi-range |
| `pagination` | Page slicing |
| `filtering` / `FilterEngine` | Filter row state |
| `clipboard` | Copy / cut / paste (Excel-style) |
| `serverGrouping` / `ServerGroupEngine` | Async group fetch |

## Conventions de design

| Choix | Pourquoi |
|---|---|
| State central via `provide/inject` (Vue) / `@Injectable()` au niveau composant (Angular) | Évite le prop-drilling sur 5 niveaux ; chaque feature lit/écrit la même source. |
| Métadonnées `__adg` | Préfixées pour ne jamais collisionner avec les champs utilisateur (groupement, expansion). |
| Pas de `transform` pour le scroll | `translateY` crée un containing block qui casse `position: sticky` sur les colonnes pinned. On utilise un spacer top-height à la place. |
| Cap visible à 80 lignes | Au-delà, le rendu d'une frame coûte plus que le scroll lui-même. |
| `rowHeight` reactif (signal ou number) | La densité change la hauteur de ligne sans recréer le scroll machine. |
| Encapsulation systématique | Vue scoped CSS + classes BEM ; Angular `ViewEncapsulation.None` avec classes Mozaic — overrides via `:deep()` (Vue) ou cascade BEM (Angular). |
