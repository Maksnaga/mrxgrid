# API Reference

> Référence complète des props, événements, slots / templates et méthodes exposées de `<ad-grid-vue>` (Vue) et `<ad-grid-angular>` (Angular).
>
> Pour la spec canonique exhaustive (avec types complets et contrats), voir **Docs/Tree, Lignes dépliables, Colonnes, Theming, Performance, API publique** — section *Public API canonique du grid*.

## Imports

### Vue

```ts
import {
  AdGridVue, Column,
  GridToolbar, TableMenuDrawer, GroupingDrawer,
  GridFilterDrawer, KeyboardShortcutsDrawer,
  FormulaBar, FormulaReferenceDrawer,
  defineStatusRenderer, BUILTIN_RENDERERS,
  useVariableHeightVirtualScroll, useFormulaEngine,
  DEFAULT_FORMULA_FUNCTIONS,
  useGridState, useGridEngine, useGridContext, GRID_STATE_KEY,
  DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT, DEFAULT_PAGE_SIZE,
  DENSITY_ROW_HEIGHT, MIN_COLUMN_RESIZE_WIDTH,
  type ColumnDef, type RowData, type CellEditEvent, type FillEvent,
  type SelectionModel, type SelectionRange, type CellFlags,
  type StatusAppearance, type GridDensity, type GroupingItem,
} from '@adeo/grid-vue'
```

### Angular

```ts
import {
  AdGridAngularComponent, AdeoGridColumnDefComponent,
  AdeoGridToolbarDef, AdeoGridEmptyDef,
  AdeoGridRefreshingDef, AdeoGridLoadingDef,
  defineStatusRenderer, BUILTIN_RENDERERS,
  GridStateManager, GridEngine,
  VerticalVirtualScrollEngine, HorizontalVirtualScrollEngine,
  FormulaEngine, DEFAULT_FORMULA_FUNCTIONS,
  DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT, DEFAULT_PAGE_SIZE,
  DENSITY_ROW_HEIGHT, MIN_COLUMN_RESIZE_WIDTH,
  type ColumnDef, type CellEditEvent, type FillEvent, type FillDownEvent,
  type SelectionModel, type SelectionRange, type CellFlags,
  type StatusAppearance, type GridDensity, type GroupingItem,
} from '@adeo/grid-angular'
```

Les deux librairies sont **standalone** : pas de module à importer, on importe directement le component.

## Inputs / Props

Pour chaque entrée, on montre l'API Vue puis l'équivalent Angular. **Aligned** = nom + sémantique identiques.

| Concept | Vue prop | Angular input | Type | Description |
|---|---|---|---|---|
| Lignes source | `rows` (requis) | `data` | `T[]` | Données d'entrée. |
| Colonnes | `columns` | `<ad-grid-column-def>` children OR `columns` | `ColumnDef<T>[]` | Imperative ou déclarative (Angular). Vue peut aussi déclarer via `<ad-grid-column>` enfants. |
| Mode global | dérivé de `serverFilter`/`serverGrouping` | `mode` | `'client' \| 'server'` | Mode serveur/client. |
| Mode filtre | `filterMode` | `filterMode` | `'client' \| 'server'` | Découplé du mode global. |
| Alias historique server filter | `serverFilter` | n/a (utilise `filterMode`) | `boolean` | Vue uniquement. |
| Grouping serveur | `serverGrouping` | `serverGroupingOptions`, `groupMode` | `ServerGroupingOptions<T>` | Descripteur de groupement côté serveur. |
| Total serveur | `totalItems` (alias deprecated `totalCount`) | `totalItems` | `number` | Nombre total côté serveur. |
| Pagination | `pagination` | `pagination`, `pageSize`, `pageSizeOptions` | `boolean \| PaginationConfig` | Toggle / config. |
| Stratégie de chargement | (via `pagination`) | `loadingStrategy`, `scrollThreshold` | `'pagination' \| 'infinite-scroll'` | Mode de chargement. |
| Multi-sort | `multiSort` | (toujours dispo) | `boolean` | Shift+clic multi-tri. |
| Loading full | `loading` | `loading` | `boolean` | Squelette complet. |
| Refreshing silencieux | `refreshing` | `refreshing` | `boolean` | Refetch silencieux — pas de visuel par défaut. |
| Pending cells | `pendingCells` | `pendingCells` | `ReadonlyArray<{ rowId, field }>` | Shimmer overlay par cellule. |
| Pending rows | `pendingRows` (alias `pendingRowIds`) | `pendingRowIds` | `ReadonlyArray<string \| number>` | Overlay + spinner par ligne. |
| Erreur | `error` | (via `[mozGridEmpty]`) | `Error \| null` | Expose le slot d'erreur. |
| Squelette count | `skeletonRowCount` | `skeletonRowCount` | `number` | Override nombre de lignes squelette. |
| Identifiant de ligne | `rowId` (fn) | `rowIdField` (string) | `(row, i) => string` / `string` | Résolveur d'identité. |
| Sélection ligne | `selectable` | `rowSelection` | `boolean` | Colonne checkbox. |
| Selection bar compacte | `selectionBarCompact` | n/a | `boolean` | Vue uniquement. |
| Expandable rows | `expandable` | `expandable` | `boolean` | Colonne chevron + détail. |
| Densité | `density` | `density` | `'compact' \| 'default' \| 'comfortable'` | Hauteur de ligne. |
| Hauteur de ligne | (via density) | `rowHeight` | `number` | Override explicite (Angular). |
| Fullscreen | `fullscreen` | `fullscreen` | `boolean` | Couvre le viewport. |
| Hauteur | `height` | (l'hôte enveloppe) | `string \| number` | Hauteur racine. |
| Container height | `containerHeight` | (calculé) | `number` | Hauteur du viewport (utilisée par le moteur de virtualisation verticale, toujours actif). |
| Overscan rows | `overscan` | (interne) | `number` | Lignes au-dessus/sous la fenêtre. |
| Overscan cols | `columnOverscan` | (interne) | `number` | Colonnes à gauche/droite. |
| Plage visible (callback) | `onVisibleRangeChange` | `loadMore` (output) | `(start, end) => void` | Lazy fetch. |
| Hidden fields | `hiddenFields` (v-model) | `hiddenFields` + `hiddenFieldsChange` | `string[]` | Champs masqués. |
| Group fields | `groupFields` | (via `groupChange`) | `string[]` | Groupement actif. |
| Column order | `columnOrder` | (via persistance) | `string[]` | Ordre des colonnes. |
| Persist key | `persistKey` | `persistKey` (alias `stateKey`) | `string` | Auto-persist localStorage. |
| History ID | `historyId` (deprecated, retrait v2.0) | (dérivé de `persistKey`) | `string` | Persist undo/redo. |
| Plugins | `plugins` | `plugins` | `GridPlugin[]` | Plugins transversaux. |
| Suppress move animation | `suppressColumnMoveAnimation` | n/a | `boolean` | Vue uniquement. |
| Reorderable | (toujours activé) | `reorderable` | `boolean` | Active drag de colonnes. |
| Multi cell selection | (via config d'engine) | `multiCellSelection` | `boolean` | Plages multiples. |
| Formulas | (via `allowFormula` par colonne) | `formulas` | `boolean` | Active l'engine de formules. |
| Detail template | (via slot `#expandedRow`) | `detailTemplate` | `TemplateRef` | Template de ligne de détail. |
| Exportable | (via prop de toolbar) | `exportable` | `boolean` | Affiche l'export. |
| Export mode | (via toolbar) | `exportMode` | `'client' \| 'server'` | DL client ou émission. |
| Show toolbar | (via slot `#toolbar`) | `showToolbar` | `boolean` | Render toolbar par défaut. |
| Empty / no-results texts | (via slot `#empty`) | `emptyDataTitle`, `emptyDataDescription`, `noResultsTitle`, `noResultsDescription`, `noResultsActionLabel` | `string` | Textes d'états. |
| Filter apply mode | n/a | `filterApplyMode` | `'auto' \| 'manual'` | Déclencheur d'application. |

## Outputs / Événements

| Concept | Payload | Vue emit | Angular `@Output` |
|---|---|---|---|
| Tri changé | `SortEvent` | `sortChange` | `sortChange` |
| Page changée | `PageEvent` | `pageChange` | `pageChange` |
| Load more (infinite scroll) | `LoadMoreEvent` | (via `onVisibleRangeChange`) | `loadMore` |
| Édition cellule | `CellEditEvent<T>` | `cellEdit` | `cellEdit` |
| Annulation édition | `CellEditCancelEvent` | (via slot) | `cellEditCancel` |
| Mutation batch | `{ changes: [...] }` | `bulkEdit` (+ alias deprecated `bulkCellEdit`) | `bulkEdit` |
| Copy / paste / delete bulk | `BulkCopyEvent` / `BulkPasteEvent` / `BulkDeleteEvent` | (via toolbar) | `bulkCopy`, `bulkPaste`, `bulkDelete` |
| Fill handle | `FillEvent` / `FillDownEvent` | `fill` | `fillDown` |
| Sélection lignes | `SelectionModel` / `RowSelectionEvent<T>` | `update:selection` | `selectionChange` |
| Sélection cellules | `CellSelectionEvent<T>` | (via engine) | `cellSelectionChange` |
| Selection edit | `{mode:'row'\|'cell'}` discriminé | `selectionEdit` | (via toolbar) |
| Groupes | `GroupEvent` | `groupChange` | `groupChange` |
| Filtre changé | `FilterEvent` | `filterChange` (deprecated), `filterEvent`, `update:filterModel` | `filterChange` |
| Filter model v-model | `FilterModel` | `update:filterModel` | (via `filterChange.model`) |
| Menu de colonne | `ColumnMenuAction` | `columnMenuAction` | outputs par action |
| Visibilité colonnes | `string[]` | `update:hiddenFields`, `hiddenFieldsChange` | `hiddenFieldsChange` |
| Densité (drawer) | `GridDensity` | (via v-model:density) | `densityChange` |
| Settings (drawer) | `GridSettingsResult` | (via props v-model) | `settingsChange` |
| Export server | `GridExportEvent` | (via toolbar) | `exportRequest` |
| Retry (slot erreur) | — | `retry` | (géré par l'hôte) |

## Slots / Projection

### Vue — slots nommés de `<ad-grid-vue>`

| Slot | Scope | Quand |
|---|---|---|
| `#toolbar` | `{ grid, columns, … }` | Remplace `GridToolbar` par défaut. |
| `#cell` | `CellSlotProps` | Slot générique appliqué à toutes les cellules. |
| `#cell-{field}` | `CellSlotProps` | Renderer custom pour une colonne précise. |
| `#header` | `{ column, sortDirection }` | Render générique de header. |
| `#header-{field}` | idem | Header custom par colonne. |
| `#filter` | `{ column, value, setValue }` | Cellule custom dans la ligne de filtres. |
| `#filter-{field}` | idem | Filtre custom par colonne. |
| `#edit` | `{ value, editValue, updateValue, commit, cancel }` | Éditeur custom pour toutes les cellules. |
| `#edit-{field}` | idem | Éditeur custom par colonne. |
| `#expandedRow` | `{ row, index }` | Contenu de la row de détail (avec `expandable`). |
| `#empty` | — | État vide (rows.length === 0). |
| `#noResults` | — | Aucun résultat après filtrage. |
| `#loading` | — | Overlay de chargement (avec `loading`). |
| `#refreshing` | — | Indicateur de refetch silencieux (avec `refreshing`). |
| `#error` | `{ error, retry }` | Affichage d'erreur (avec `error`). |
| `#actions` | `{ selection, count }` | Boutons custom de la barre de sélection. |

### Angular — projection de template `<ad-grid-angular>`

| Forme | Quand |
|---|---|
| `[detailTemplate]="tpl"` + `<ng-template #tpl let-row let-i="rowIndex">…</ng-template>` | Template de ligne de détail. |
| `<ad-grid-column-def field="…" [cellTemplate]="…" [headerTemplate]="…" [editorTemplate]="…" [filterTemplate]="…" />` | Projection déclarative de colonne. |
| `<ng-template mozGridToolbar let-grid>…</ng-template>` (via `AdeoGridToolbarDef`) | Toolbar custom. |
| `<ng-template mozGridEmpty>…</ng-template>` (via `AdeoGridEmptyDef`) | État vide / erreur. |
| `<ng-template mozGridRefreshing>…</ng-template>` (via `AdeoGridRefreshingDef`) | Slot de refresh silencieux. |
| `<ng-template mozGridLoading>…</ng-template>` (via `AdeoGridLoadingDef`) | Overlay de chargement. |

## Méthodes impératives

### Vue — accès via `ref` + `defineExpose`

```ts
const gridRef = ref<InstanceType<typeof Grid>>()
// gridRef.value!.exportCsv({ filename: 'export.csv' })
```

### Angular — accès via `viewChild` ou `@ViewChild`

```ts
const grid = viewChild.required(AdGridAngularComponent)
// grid().exportCsv({ filename: 'export.csv' })
```

| Méthode | Signature | Quoi |
|---|---|---|
| `exportCsv(options?)` | `{ filename?, separator?, columns?, scope? }` | Export CSV des rows visibles (ou scope custom). |
| `exportJson(options?)` | `{ filename?, columns?, scope? }` | Export JSON. |
| `setFilter(field, value)` | — | Force un quick filter. |
| `setFilterModel(model)` | `FilterModel` | Remplace le filter model du builder. |
| `clearFilters()` | — | Wipe les deux surfaces de filtres. |
| `clearQuickFilters()` | — | Wipe la ligne de filtres (Vue ; Angular = noop alias). |
| `clearFilterModel()` | — | Wipe le builder seulement. |
| `getFilterModel()` | — | Snapshot du filter model courant. |
| `selectAll()` | — | Sélectionne toutes les rows. |
| `clearSelection()` | — | Vide la sélection. |
| `getSelectedRows()` | `T[]` | Renvoie les rows sélectionnées. |
| `getSortModel()` / `clearSort()` | — | Pilote le multi-sort stack. |
| `getGroupModel()` / `clearGroups()` | — | Pilote les groupes. |
| `undo()` / `redo()` / `clearHistory()` | — | Pilote l'historique. |
| `validateAll()` | `number` | Force la revalidation de toutes les cellules. |
| `getCellError(rowIndex, field)` / `hasCellError(rowIndex, field)` | — | Erreur sur une cellule. |
| `setFormula(addr, str)` / `getFormula(addr)` / `getFormulaValue(addr)` | — | Formula engine. |
| `persistView(key?)` / `restoreView(key?)` | `key?: string` | Persist localStorage manuel. |
| `autosizeColumn(field, options?)` / `autosizeAllColumns(options?)` | `{ maxWidth?: number }` | Auto-size par mesure de contenu. |
| `tree.flatten(data, config, expandedSet, idField)` | `TreeNodeConfig` | Aplatit un dataset hiérarchique. |
| `tree.toggleNode(nodeKey)` / `expandAll(data, config, idField)` / `collapseAll()` | — | Pilote l'expansion du tree. |

## Types principaux

Communs aux deux librairies (le contrat est partagé) :

```ts
interface ColumnDef<T = RowData> {
  field: string
  headerName: string
  width?: string
  minWidth?: string
  maxWidth?: string
  flex?: number
  resizable?: boolean
  reorderable?: boolean
  sortable?: boolean
  sortComparator?: (a: T, b: T) => number
  groupable?: boolean
  filterable?: boolean
  filterType?: 'text' | 'number' | 'date' | 'set' | 'boolean'
  filterOperators?: FilterOperator[]
  defaultFilterOperator?: FilterOperator
  filterOptions?: { value: unknown; label: string }[]
  pinned?: 'start' | 'end' | 'left' | 'right' | null
  visible?: boolean
  hideable?: boolean
  freezable?: boolean
  searchVisible?: boolean
  headerMenuDisabled?: boolean
  valueGetter?: (row: T) => unknown
  valueFormatter?: (value: unknown, row: T) => string
  cellClass?: string | ((row: T) => string)
  headerClass?: string
  editable?: boolean
  cellEditor?: 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date' | 'toggle' | 'custom'
  cellEditorOptions?: { value: unknown; label: string }[]
  cellEditorValidator?: (value, row) => true | false | string
  cellValidator?: (value, row) => true | string
  renderer?: 'text' | 'tag' | Component | ComponentType
  rendererProps?: Record<string, unknown>
  filterRenderer?: Component | ComponentType
  valueValidator?: (value) => boolean
  allowFormula?: boolean
}

interface CellEditEvent<T = RowData> {
  row: T
  rowIndex: number
  field: string
  oldValue: unknown
  newValue: unknown
}

interface FillEvent {
  sourceRange: SelectionRange
  targetRange: SelectionRange
  direction: 'down' | 'up' | 'right' | 'left'
  fills: Array<{ rowIndex: number; field: string; value: unknown }>
}

interface SelectionModel {
  allSelected: boolean
  selectedIds: Set<string>
  deselectedIds: Set<string>
}

interface SelectionRange {
  r1: number; c1: number   // top-left
  r2: number; c2: number   // bottom-right (inclusive)
}

interface ColumnStateEntry {
  field: string
  currentWidth: number
  order: number
  visible: boolean
  sort?: SortDirection
  sortIndex?: number
  pinned?: 'start' | 'end' | null
  searchVisible?: boolean
}

type GridDensity = 'compact' | 'default' | 'comfortable'

interface TreeNodeConfig {
  childrenField: string
  hasChildrenField?: string
  expandedByDefault?: boolean
}

interface TreeDisplayRow<T> {
  data: T
  depth: number
  hasChildren: boolean
  expanded: boolean
  nodeKey: string
}
```

## Plugins

Les deux librairies acceptent une prop `plugins: GridPlugin[]` :

```ts
interface GridPlugin {
  id: string
  init(ctx: { state: GridState; engine: GridEngine }): void
  destroy?(): void
}
```

Le contrat est identique — un plugin Vue se câble via un `composable` qu'on appelle depuis `init`, un plugin Angular via une injection / un service. Pour des plugins prêts (`useUndoRedoPlugin` en Vue, son équivalent service en Angular), voir le chapitre **Docs/Sélection, Édition, Clipboard, Fill, Clavier, Undo/Redo**.
