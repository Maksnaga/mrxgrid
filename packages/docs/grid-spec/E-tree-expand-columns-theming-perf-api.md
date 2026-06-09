# Tree, Lignes dépliables, Colonnes (drag/réordonnancement/resize/autosize/masquage), Theming, Performance, API publique

Ce chapitre consolide tout ce qui entoure le flux de lignes une fois que filter / sort / group / paginate ont fait leur travail : aplatissement hiérarchique (tree), lignes de détail, les quatre fonctionnalités de colonnes lourdes en DOM (drag, réordonnancement, resize, autosize, masquage), la façon dont le grid consomme les tokens Mozaic, le contrat de performance que `<ad-grid-vue>` / `<ad-grid-angular>` honore à l'échelle, et enfin la surface publique canonique du composant.

Chaque section suit la même forme — rôle, contrat de comportement, API publique, contrat d'implémentation, mappings Vue et Angular. La dernière section (`Public API canonique du grid`) est une synthèse plutôt qu'une spécification de fonctionnalité.

---

<a id="tree"></a>
## Tree (lignes hiérarchiques)
### Rôle

Aplatir un jeu de données hiérarchique (arborescence de fichiers, organigramme, nomenclature…) dans le même flux `DisplayRow[]` indexé qu'attend le virtualizer. Le grid est orienté ligne : le support de tree est une passe préalable qui parcourt les parents → enfants, émet une ligne par nœud, et expose un triplet `depth` / `hasChildren` / `expanded` par ligne que le renderer de cellule lit pour dessiner l'indentation et le chevron.

Le mode tree est opt-in. Les consommateurs alimentent une source hiérarchique et appellent `flatten()` du tree engine une fois par rendu pour produire le flux aplati qu'ils repassent à `<ad-grid-vue>` / `<ad-grid-angular>` via `rows` / `data`.

### Contrat de comportement

- **Identité du nœud.** Le `nodeKey` d'un nœud est `parentKey ? "${parentKey}/${id}" : id`, où `id` vaut `String(row[idField] ?? indexFallback)`. Les sous-arbres se replient donc atomiquement lorsque leur parent se replie (les lignes descendantes ne sont simplement pas émises par `walk`).
- **État d'expansion.** Stocké dans `state.expandedRowIds` sous forme de `Set<string>` de `nodeKey`. C'est **le même signal** que celui utilisé par l'expandable-row engine pour les lignes de détail — les deux espaces sont disjoints par construction (detail utilise `rowId`, tree utilise `nodeKey` avec le séparateur `/`), de sorte qu'un seul grid peut héberger les deux.
- **`expandedByDefault`.** Lorsqu'il vaut `true`, un nœud est traité comme déplié sauf si son `nodeKey` figure explicitement dans `expandedRowIds`. La convention (alignée 1-pour-1 entre Vue et Angular) est : absent du set ⇒ "jamais togglé" ⇒ déplié. Pour replier explicitement un nœud déplié par défaut, l'hôte doit appeler `toggleNode(nodeKey)` une fois (ce qui ajoute la clé, puis re-toggler la retire à nouveau).
- **Résolution de `hasChildren`.** Honore `config.hasChildrenField` lorsqu'il est fourni (pattern lazy-children : le parent déclare avoir des enfants même si `childrenField` est vide jusqu'au fetch) ; sinon, retombe sur `children.length > 0`.
- **Lazy loading.** L'engine ne possède pas de fetcher. Pattern : déclarer `hasChildrenField`, observer l'événement d'expansion dans l'hôte (`toggleNode` écrit dans `expandedRowIds`, l'hôte surveille le set), fetcher les enfants, puis muter le `childrenField` de la ligne et rappeler `flatten()`. Bumper `dataVersion` est requis lorsque les enfants sont mutés in-place plutôt que de remplacer la ligne parente.
- **Interaction avec sort/filter/group.** L'aplatissement du tree s'exécute **avant** le pipeline sort/filter/group. Le pipeline opère sur les lignes déjà aplaties. Le grid ne re-trie pas actuellement au sein d'un sous-arbre ; pour cela, l'hôte doit trier lui-même les tableaux `children` avant l'aplatissement.
- **`expandAll(data, config, idField)`** parcourt l'ensemble du dataset et écrit dans le set chaque clé pour laquelle `children.length > 0`. `collapseAll()` écrit un set vide.

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | `TreeNodeConfig { childrenField, hasChildrenField?, expandedByDefault? }` — passé à l'appel, pas comme prop |
| Outputs / events | Aucun directement. Les changements d'expansion transitent via `state.expandedRowIds`. |
| Slots / projection | Le rendu de cellule est de la responsabilité du consommateur — l'engine n'émet que les métadonnées (`depth`, `hasChildren`, `expanded`, `nodeKey`). |
| Imperative | `tree.flatten(data, config, expandedNodes, idField): TreeDisplayRow[]` — pure, idempotent. `tree.toggleNode(nodeKey)`, `tree.expandAll(data, config, idField)`, `tree.collapseAll()`. |

### Contrat d'implémentation (interne)

- **Signal d'état.** `expandedRowIds: Set<string>` (partagé avec l'expandable-row engine).
- **Fonction pure.** `flatten()` ne fait aucune I/O, alloue un seul tableau et un seul set. Parcourir un tree de 100k nœuds est O(N) avec un pattern d'allocation stable (push-only).
- **Pas d'effets de bord de re-rendu.** Muter le set d'expansion déclenche un recalcul réactif de `displayRows` via le pipeline de rendu de l'hôte.

### Mapping Vue

- Fichier : `apps/grid-vue/src/components/Grid/features/useTreeEngine.ts`
- Composable : `useTreeEngine(state): TreeEngine<T>`
- Chemin d'état : `state.expandedRowIds: Ref<Set<unknown>>`
- Exposé via `defineExpose({ tree: { flatten, toggleNode, expandAll, collapseAll } })` sur `<ad-grid-vue>`.

### Mapping Angular

- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/tree.engine.ts`
- Classe : `@Injectable() TreeEngine<T>`
- Chemin d'état : `GridStateManager.expandedRowIds: WritableSignal<Set<unknown>>`
- Exposé comme champ `public readonly tree = { flatten, toggleNode, expandAll, collapseAll }` de `AdGridAngularComponent`.

## Lignes dépliables
### Rôle

Rendre un panneau de détail par ligne sous une ligne normale, piloté par un slot `expandedRow` (Vue) / un input `detailTemplate` (Angular). La hauteur de la ligne de détail n'est **pas** déclarée par le consommateur — elle est mesurée en direct par un `ResizeObserver` à l'intérieur du composant de ligne de détail, puis renvoyée au virtualizer vertical pour que la hauteur de la scrollbar et les offsets utilisés pour positionner les lignes visibles restent précis lorsque le contenu du détail change.

### Contrat de comportement

- **Clé de toggle.** L'état d'expansion est clé sur `rowId` (résolu via `rowIdField` / la fonction prop `rowId` en Vue). Chaque ligne togglée est ajoutée/retirée de `state.expandedRowIds`.
- **Rendu de la ligne de détail.** Lorsque l'id d'une ligne est dans le set, `<ad-grid-detail-row>` / son équivalent Vue est inséré directement après le rendu principal de la ligne. Il s'étend sur la largeur du viewport de scroll (sticky-friendly, pas sur toute la largeur du contenu).
- **Auto-mesure de la hauteur.** Un `ResizeObserver` est installé sur l'élément de la ligne de détail. Chaque `contentRect.height` est écrit dans `ExpandableRowEngine.measuredRowHeights: Map<rowKey, number>`. Le vertical virtual scroll engine relit via `getExtraHeightForKey(rowKey)` lors de la reconstruction des offsets.
- **Pas de prop `expandedRowHeight`.** L'ancienne prop Vue-only a été retirée une fois l'auto-mesure mise en place. Les consommateurs ne passent plus de hauteur de détail en dur — le grid s'adapte à ce que le slot/template rend.
- **Interaction avec la virtualisation verticale.** Les offsets sont reconstruits chaque fois que la map des hauteurs mesurées change ; la paire topSpacer / bottomSpacer est calculée à partir de la hauteur cumulée par ligne, incluant toute hauteur supplémentaire pour les lignes dépliées dans la fenêtre rendue. C'est ce qui empêchait la scrollbar de "bondir" avant que le wire-up de rowKey ne soit terminé.
- **Libération.** Le `ResizeObserver` est déconnecté dans le hook de destruction du composant (`ngOnDestroy` / `onUnmounted`) ; aucun observer résiduel entre les toggles.

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | Vue : `expandable: boolean`, `rowId` (résout la clé), slot `#expandedRow`. Angular : `expandable: boolean`, `rowIdField: string`, `detailTemplate: TemplateRef<unknown> \| null`. |
| Outputs / events | Pas d'événement dédié — le toggle écrit directement dans `state.expandedRowIds`. Les consommateurs branchent le chevron d'expansion via le template de ligne ou via `expandRow`/`collapseRow` de manière programmatique. |
| Slots / projection | Vue : `#expandedRow="{ row, index }"`. Angular : `[detailTemplate]="myTpl"` avec `<ng-template #myTpl let-row let-i="rowIndex">…</ng-template>`. |
| Imperative | `expandRow(rowId)`, `collapseRow(rowId)`, `toggleRow(rowId)`, `collapseAll()`, `isRowExpanded(rowId): boolean`, `hasExpandedRows: Signal<boolean>` (computed). |

### Contrat d'implémentation (interne)

- **Signal d'état.** `expandedRowIds: Set<unknown>` (partagé avec le tree engine mais clé différemment).
- **Effet de bord.** `ResizeObserver` par instance de ligne de détail visible, écrivant dans `measuredRowHeights: Map<string, number>` sur l'engine. La map est simple (non réactive) — la virtualisation la lit lors de la reconstruction d'offsets différée en rAF.
- **Dépendance.** `VerticalVirtualScrollEngine` (Angular) / composable de virtual scroll à hauteur variable (Vue) — appelle `getExtraHeightForKey(rowKey)` lors du calcul des offsets par ligne.

### Mapping Vue

- Engine : `apps/grid-vue/src/components/Grid/features/useRowExpansionEngine.ts` — `useRowExpansionEngine(state)`.
- Composant de ligne de détail : rendu inline dans `Grid.vue` via le slot `#expandedRow`. L'auto-mesure est faite par le bloc de ligne du grid.
- Chemin d'état : `state.expandedRowIds: Ref<Set<unknown>>`.

### Mapping Angular

- Engine : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/expandable-row.engine.ts` — `ExpandableRowEngine<T>`.
- Composant de détail : `components/detail-row/grid-detail-row.ts` — `AdeoGridDetailRowComponent`. Détient le `ResizeObserver` et appelle `measureRow(rowKey, height)` à chaque observation.
- Wire-up : `components/body/grid-body.html` passe `[rowKey]="getRowKey(displayRow.data)"` à `<ad-grid-detail-row>` — c'est le point de correction **B28**. Sans `rowKey`, le garde `if (!key) return` de l'observer rejette chaque mesure et la scrollbar suit mal les lignes de détail à hauteur variable.
- Chemin d'état : `GridStateManager.expandedRowIds: WritableSignal<Set<unknown>>`.

## Drag de colonnes
### Rôle

Drag pour réordonner les cellules d'en-tête. Possède toute l'interaction au niveau du DOM : aperçu fantôme, ligne d'indicateur de drop pleine hauteur, auto-scroll en bord de viewport, et détection de seuil pour qu'un clic court déclenche tout de même un tri au lieu de démarrer un drag fantôme.

### Contrat de comportement

- **Seuil d'activation de 5 px.** Le `mousedown` enregistre les listeners mais ne démarre pas encore de drag. Le drag ne s'active que lorsque le curseur a bougé de ≥ 5 px. Sous le seuil, le `mouseup` est un clic → le tri se déclenche normalement.
- **Fantôme.** Un `cloneNode(true)` de la cellule d'en-tête source, positionné en fixed avec la largeur canonique de la colonne (lue depuis `state.columnStates`, pas depuis la cellule rendue, afin qu'une dernière colonne étirée en flex apparaisse en fantôme à sa vraie largeur). Opacité 0.8, drop-shadow, bordure de couleur primaire.
- **Indicateur de drop.** Une ligne de 2 px pleine hauteur, positionnée en absolute au-dessus du conteneur du grid, alignée sur le bord gauche de la cellule sous le milieu horizontal du curseur. Masquée lorsque l'index candidat est égal à l'index source ou source+1 (drops no-op).
- **Auto-scroll.** Lorsque le curseur est à moins de 60 px du bord gauche ou droit du viewport de scroll, une boucle rAF tique `scrollEl.scrollLeft += ±12 px/frame` jusqu'à ce que le curseur sorte de la zone.
- **Resync de scrollLeft.** Au `mouseup`, `state.scrollLeft` et `state.scrollViewportWidth` sont repoussés depuis l'élément de scroll DOM pour que le recalcul des colonnes virtuelles horizontales utilise la vraie position de scroll post-drag.
- **Interaction avec le pinning.** Le drag ne considère que les cellules non pinnées (`[data-field]:not([data-pinned])`). Les colonnes pinnées ne peuvent pas être réordonnées via drag — utiliser le réordonnancement programmatique.
- **Annulation.** `Escape` (binding host-handler) ou le shim historique `cancelDrag()` annule sans commit ; le fantôme + la ligne de drop sont retirés.

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | Vue : `suppressColumnMoveAnimation?: boolean`. Angular : `reorderable: boolean` (conditionne le drag handle). |
| Outputs / events | Le réordonnancement est publié via le callback du reorder engine (`onReorder(previousIndex, currentIndex)`). Le grid l'expose via `columnMenuAction` / les événements de colonne Angular à l'étape de réordonnancement suivante. |
| Slots / projection | Aucun. La cellule d'en-tête rend le drag handle nativement. |
| Imperative | `startDrag(event, sourceIndex, headerRow, scrollEl)` (signature Phase 10), `setDropIndicator(index \| null)` (shim historique), `startDragByField(field)` (shim historique), `cancelDrag()`. |

### Contrat d'implémentation (interne)

- **Signaux d'état.** `draggingColumn: string \| null`, `dropIndicatorIndex: number \| null`.
- **Possession du DOM.** L'engine crée et détruit lui-même les éléments fantôme + ligne de drop ; aucun scaffolding de template requis dans l'en-tête de l'hôte. `document.body.style.cursor = 'grabbing'` et `userSelect = 'none'` pendant le drag actif, tous deux restaurés au `mouseup` / `cancelDrag`.
- **Boucle d'auto-scroll.** Pilotée par rAF, sans interaction avec NgZone côté Angular (le chemin Vue est vanilla également).
- **Dépendance.** `ColumnReorderEngine` — le réordonnancement committé est délégué, de sorte que l'engine ne mute jamais `state.columnStates` directement.

### Mapping Vue

- Fichier : `apps/grid-vue/src/components/Grid/features/useColumnDragEngine.ts`
- Composable : `useColumnDragEngine(state, reorderEngine)`
- Chemin d'état : `state.draggingColumn`, `state.dropIndicatorIndex`.

### Mapping Angular

- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/column-drag.engine.ts`
- Classe : `@Injectable() ColumnDragEngine`
- Chemin d'état : `GridStateManager.draggingColumn`, `GridStateManager.dropIndicatorIndex`.

## Réordonnancement de colonnes
### Rôle

La moitié non-DOM de l'interaction de drag : une mutation pure sur `state.columnStates`. Sert également de point d'entrée pour le réordonnancement programmatique (par exemple, drawer de paramètres, persistance/restauration).

### Contrat de comportement

- **Sémantique du réordonnancement.** Splice de la source hors de `columnStates`, splice de retour à la cible, puis renumérotation de l'`order` de chaque entrée pour préserver la contiguïté.
- **Indices non-pinned vs globaux.** `reorderUnpinned(unpinnedPrev, unpinnedNew)` traduit les indices calculés sur la tranche non-pinnée vers l'espace d'index global de `columnStates`. Requis par le drag engine qui ne voit que les cellules non-pinnées.
- **Pinning préservé.** Le réordonnancement ne modifie jamais `pinned` — une colonne précédemment pinnée reste pinnée à sa nouvelle position.
- **Court-circuit no-op.** Lorsque `previousIndex === newIndex` (ou la même ligne dans l'espace non-pinné), la fonction retourne sans toucher à l'état.

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | Aucune directement ; les consommateurs réordonnent via mutation de `state.columnStates` ou via l'engine de persistance. |
| Outputs / events | Vue : canaux `update:hiddenFields` / `columnMenuAction`. Angular : modèle `ColumnReorderEvent { field, previousIndex, newIndex, columns }` (consommé par l'engine de persistance). |
| Slots / projection | Aucun. |
| Imperative | `reorder(previousIndex, newIndex)`, `reorderUnpinned(unpinnedPrev, unpinnedNew)`. |

### Contrat d'implémentation (interne)

- **Signal d'état.** `columnStates` — écrit en remplacement complet du tableau (mise à jour immutable) afin que les consommateurs réactifs (`visibleColumns`, `gridTemplateColumns`…) recalculent exactement une fois par réordonnancement.
- **Pas de DOM, pas de listeners.** Transformation de données pure.
- **Hook de persistance.** `StatePersistenceEngine` écrit/lit `columnStates[].order` afin que les réordonnancements survivent aux rechargements lorsque `persistKey` est défini.

### Mapping Vue

- Fichier : `apps/grid-vue/src/components/Grid/features/useColumnReorderEngine.ts`
- Composable : `useColumnReorderEngine(state)`
- Chemin d'état : `state.columnStates: Ref<ColumnStateEntry[]>`

### Mapping Angular

- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/column-reorder.engine.ts`
- Classe : `@Injectable() ColumnReorderEngine`
- Chemin d'état : `GridStateManager.columnStates: WritableSignal<ColumnStateEntry[]>`

## Resize de colonnes
### Rôle

Drag pour redimensionner une colonne depuis la poignée du bord droit de sa cellule d'en-tête, avec clamp min/max et un garde empêchant le clic synthétique post-mouseup de déclencher un tri parasite.

### Contrat de comportement

- **Position de la poignée.** Bord droit pour les colonnes non-pinnées et pinnées à gauche ; bord gauche pour les colonnes pinnées à droite (afin que le drag vers l'extérieur élargisse). L'engine suit cela via `invertDelta = colState.pinned === 'end'`.
- **Contraintes min / max.** Lues depuis `ColumnDef.minWidth` / `maxWidth` par colonne (parsés en entiers), avec un plancher global de 50 px lorsqu'aucune n'est déclarée. Pas de plafond par défaut — `Infinity` jusqu'à ce qu'un cap au niveau colonne soit fixé.
- **Chemin d'écriture.** Chaque `mousemove` écrit une nouvelle `currentWidth` dans `state.columnStates[field]` via `updateColumnState(field, { currentWidth })`. Même pipe que l'autosize — la mise en page pinned/virtuelle réagit automatiquement.
- **Timestamp de fin de resize (`lastResizeEndedAt`).** Au `mouseup`, l'engine fixe `state.lastResizeEndedAt = performance.now()`. La cellule d'en-tête lit cela dans son handler de clic et **supprime le tri si `now - lastResizeEndedAt < 200 ms`**. C'est la correction canonique du bug "le redimensionnement de la colonne la trie par accident". Le signal vit sur `GridState` lui-même (pas sur l'engine) afin que `GridHeaderCell` / `grid-header-cell` puissent le lire via l'état partagé sans injecter l'engine.
- **Curseur + sélection.** Pendant le drag : `document.body.style.cursor = 'col-resize'`, `userSelect = 'none'`. Restaurés au mouseup et sur tout chemin de nettoyage.
- **Déferrement en rAF.** Le recalcul des colonnes virtuelles déclenché par un changement de largeur est différé en rAF pendant un drag actif afin que de gros effectifs de colonnes ne provoquent pas de jitter.

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | Aucune au niveau du grid. Par colonne : `ColumnDef.minWidth?: string`, `maxWidth?: string`. |
| Outputs / events | `ColumnResizeEvent { field, previousWidth, newWidth }` — synthétisé par `getResizeEvent(field, previousWidth)` et émis par l'en-tête à la discrétion de l'hôte. |
| Slots / projection | Aucun. La poignée de resize fait partie de la cellule d'en-tête. |
| Imperative | `startResize(field, event)`, `getResizeEvent(field, previousWidth)`, signal `lastResizeEndedAt`. |

### Contrat d'implémentation (interne)

- **Signal d'état.** `state.columnStates[field].currentWidth` (cible d'écriture), `state.lastResizeEndedAt: Ref<number>` / `Signal<number>` (lu par le garde de tri de l'en-tête).
- **Effet de bord.** Listeners `document` ajoutés sous `ngZone.runOutsideAngular(…)` côté Angular ; `addEventListener` vanilla côté Vue. Tous deux se retirent eux-mêmes au `mouseup`.
- **Dépendance.** Lit `ColumnDef` via `state.columnDefMap()` pour honorer `min/maxWidth`.

### Mapping Vue

- Fichier : `apps/grid-vue/src/components/Grid/features/useColumnResizeEngine.ts`
- Composable : `useColumnResizeEngine(state)`
- Chemin d'état : `state.lastResizeEndedAt: Ref<number>` (sur `GridState`, pas sur l'engine).

### Mapping Angular

- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/column-resize.engine.ts`
- Classe : `@Injectable() ColumnResizeEngine`
- Chemin d'état : signal `ColumnResizeEngine.lastResizeEndedAt: Signal<number>` (de ce côté, le signal vit sur l'engine et l'en-tête injecte l'engine pour le lire). Les deux encodages sont exposés par nom — les consommateurs doivent traiter `lastResizeEndedAt` comme un contrat stable pour la sémantique de garde de tri.

## Autosize de colonnes
### Rôle

Mesurer le contenu des cellules via `Canvas#measureText` (sans layout) et écrire la largeur résultante dans `state.columnStates[].currentWidth`. Se déclenche une fois après le premier rendu de lignes réelles (non-squelette), et peut être déclenché programmatiquement par colonne ou pour toutes les colonnes visibles via le menu kebab ou l'API imperative.

### Contrat de comportement

- **Déclenchement auto au mount.** Une passe unique au moment du mount s'exécute après le premier rendu non-vide. L'ancienne prop `autosizeColumns` a disparu — l'autosize est **toujours activé**. Le `ColumnDef.width` déclaré par le consommateur agit comme plancher ; l'autosize ne fait jamais que grossir.
- **Stratégie de mesure.** Un singleton `<canvas>` au niveau module est réutilisé entre les appels (GC-friendly lors de l'autosize de nombreuses colonnes). La font du canvas est échantillonnée depuis une vraie `.grid-cell` via `getComputedStyle` afin que le crénage corresponde aux glyphes rendus.
- **Réserve padding / bordure.** Tirée de la même lecture `getComputedStyle` (paddingLeft + paddingRight + borderLeftWidth + borderRightWidth + 4 px de marge de sécurité). Ajoutée à chaque largeur mesurée pour que le résultat prenne en compte le chrome de la cellule.
- **Marge pour l'en-tête.** `HEADER_AFFORDANCE = 52 px` est ajouté à la largeur du texte d'en-tête pour réserver de la place à l'indicateur de tri (~14 px) et au déclencheur kebab (~28 px).
- **Plafond d'échantillonnage.** `SAMPLE_CAP = 1000` lignes par colonne avec pas uniforme. À 100k × 200 cols, le cap maintient le total d'appels `measureText` dans les quelques centaines de millisecondes. Les valeurs extrêmes hors échantillon peuvent toujours être atteintes par drag-resize manuel.
- **Sonde DOM des renderers personnalisés.** Pour les colonnes avec un template de cellule personnalisé (badge, chip, avatar…) le canvas ne verrait que la chaîne brute. L'engine interroge les cellules rendues dans le viewport via `querySelectorAll('[data-field="..."]')` et sonde `scrollWidth + borderX + 4`. Limité à la fenêtre virtuelle courante — une colonne avec des renderers personnalisés très hors-écran peut nécessiter un dimensionnement manuel.
- **Caps.** `MIN_WIDTH = 50`, `MAX_WIDTH = 800` par défaut. `ColumnDef.maxWidth` par colonne surcharge la valeur par défaut. `UseAutosizeOptions.maxWidth` (Vue, défini une fois sur le composable) et par appel `autosizeColumn(field, { maxWidth })` / `autosizeAllColumns({ maxWidth })` (les deux frameworks) permettent des surcharges par appel. Ordre de précédence : surcharge par appel > `maxWidth` au niveau composable > `ColumnDef.maxWidth` par colonne > `MAX_WIDTH` au niveau module (800 px).
- **`getComputedStyle` hoisté.** `autosizeAllColumns` échantillonne l'environnement de la cellule **une seule fois**, avant la boucle par colonne — chaque cellule partage la même font/padding, de sorte que le coût `getComputedStyle` par colonne passe de O(n) à O(1). C'est la correction critique pour le profil de stress 200 colonnes / 1 M lignes.

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | Aucune au niveau du grid (le booléen historique `autosizeColumns` a été retiré). Par colonne : `ColumnDef.minWidth`/`maxWidth`. |
| Outputs / events | Aucun. Les écritures passent par `updateColumnState`. |
| Slots / projection | Aucun. Exposé via les items de menu kebab d'en-tête `autosize-this` / `autosize-all`. **B26 / B29** : les deux sources de menu Angular (`components/header/grid-header-cell.ts:menuItems()` et `components/header-menu/grid-header-menu.ts:menuItems()`) portent les deux items. La correction initiale n'avait atterri que dans la première ; B29 a corrigé la variante dropdown. |
| Imperative | `autosizeColumn(field, options?: { maxWidth?: number }): void`, `autosizeAllColumns(options?: { maxWidth?: number }): void`. Tous deux exposés sur la ref `<ad-grid-vue>` / l'API publique `AdGridAngularComponent`. |

### Contrat d'implémentation (interne)

- **Signal d'état.** Écrit `state.columnStates[field].currentWidth` via `updateColumnState`.
- **Effet de bord.** `canvas.measureText` (pas de mutation DOM), un `getComputedStyle` par appel à `autosizeAllColumns`, et des lectures `querySelectorAll` + `scrollWidth` optionnelles pour les colonnes à template personnalisé.
- **Dépendances.** Lit `state.sourceData()`, `state.visibleColumns()`, `state.columnDefMap()`.

### Mapping Vue

- Fichier : `apps/grid-vue/src/composables/useAutosize.ts`
- Composable : `useAutosize({ gridState, wrapperRef, rows, maxWidth? })`
- Câblé dans `Grid.vue` via `watch(renderableRows, …)` pour la passe au mount ; exposé via `defineExpose({ autosizeColumn, autosizeAllColumns })`.

### Mapping Angular

- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/autosize.engine.ts`
- Classe : `@Injectable() AutosizeEngine<T>`
- Câblé dans `grid.ts` via un watcher `AfterViewInit` + `data()` ; public via `AdGridAngularComponent.autosizeColumn(field, options?)` et `AdGridAngularComponent.autosizeAllColumns(options?)`.
- Les items de menu d'en-tête vivent dans **les deux** `components/header/grid-header-cell.ts` et `components/header-menu/grid-header-menu.ts` — côté Vue, il n'y a qu'une seule source de menu.

## Masquage de colonnes
### Rôle

Basculer la visibilité d'une colonne sans la retirer du modèle. La colonne masquée conserve sa largeur / son ordre / son pin afin que le démasquage la restaure exactement à sa place.

### Contrat de comportement

- **Écriture d'état.** `updateColumnState(field, { visible: false })` (ou true). Le computed `visibleColumns` filtre sur `visible !== false`.
- **UI du drawer.** Une liste par colonne avec toggle est rendue dans le drawer de paramètres (`GridSettingsDrawer` / `AdeoGridSettingsDrawer`). Chaque toggle appelle `hideColumn(field)` / `showColumn(field)` sur le grid.
- **Menu d'en-tête.** Un item `Hide column` est proposé dans le menu kebab d'en-tête, mappant sur `headerMenuAction: 'hide-column'`.
- **Prop `hiddenFields`.** Un binding deux-sens (`v-model:hidden-fields` en Vue, `[hiddenFields]` + `(hiddenFieldsChange)` en Angular) maintient en synchro un `string[]` de champs masqués détenu par le consommateur.
- **Persistance.** La visibilité fait partie de la vue persistée (mécanisme `persistKey`). Restaurer une vue sauvegardée réapplique les anciens flags `visible`.
- **Garde sur la dernière colonne.** Masquer toutes les colonnes n'est pas bloqué — les consommateurs doivent imposer eux-mêmes un compte minimum de colonnes visibles si nécessaire.

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | Vue : `hiddenFields?: string[]`. Angular : `hiddenFields?: string[]` plus output `(hiddenFieldsChange)`. |
| Outputs / events | Vue : `update:hiddenFields` (v-model), `hiddenFieldsChange` (snapshot). Angular : snapshot `(hiddenFieldsChange)`. Plus le modèle `ColumnVisibilityEvent { field, visible, visibleColumns }`. |
| Slots / projection | Aucun. Le drawer fait partie de la toolbar. |
| Imperative | `hideColumn(field)`, `showColumn(field)`, ou écrire directement via `updateColumnState(field, { visible })`. |

### Contrat d'implémentation (interne)

- **Signal d'état.** `state.columnStates[].visible: boolean`.
- **Effet de bord.** Aucun — le pipeline de layout recalcule automatiquement `visibleColumns` et `gridTemplateColumns`.
- **Dépendance.** Le drawer lit `state.columnStates` et réécrit via le même `updateColumnState`.

### Mapping Vue

- Fichier : `apps/grid-vue/src/components/Grid/Grid.vue` (utilise les helpers historiques `useColumns` / `hideColumn` / `showColumn` qui écrivent dans `gridState`).
- Drawer : `components/overlays/TableMenuDrawer.vue` + `GridSettingsDrawer.vue`.
- Chemin d'état : `gridState.columnStates`.

### Mapping Angular

- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/grid.ts` écrit `state.columnStates.update(…)` depuis les handlers du menu d'en-tête / du drawer.
- Drawer : `components/settings-drawer/grid-settings-drawer.ts`.
- Chemin d'état : `GridStateManager.columnStates`.

## Theming
### Rôle

Permettre au grid d'hériter de l'identité visuelle Mozaic (typographie, couleur, espacement, rayons, graisses de police) sans embarquer le moindre asset de brand. La librairie est un **consommateur** pur des variables CSS Mozaic. Le changement de brand est une préoccupation de premier niveau de l'application hôte, pas une prop du grid.

### Contrat de comportement

- **Consommation des tokens.** Tout le SCSS du grid utilise des propriétés CSS custom du jeu de tokens Mozaic : `--font-family`, `--font-family-monospace`, `--color-*` (primary, secondary, accent, border, background, text…), `--spacing-*` (`s`, `m`, `l`…), `--border-radius-*`, `--font-size-*`, `--font-weight-*`. Chaque `var(--token, fallback)` déclare un fallback raisonnable afin que le grid rende toujours si l'hôte n'a pas chargé de brand.
- **Pas de chargement de font.** Le grid **n'embarque pas** de déclarations `@font-face`. Il ne consomme que `--font-family`. **Responsabilité de l'hôte :** charger les fonts de brand via le kit de font de la brand (`@import` dans `styles.scss`, blocs `@font-face`, ou `<link>` dans `index.html` / `preview-head.html` Storybook). Cela correspond à la convention documentée dans le `BrandPresets.mdx` de `mozaic-angular`.
- **Changement de brand.** Piloté par un attribut `data-theme` sur un élément wrapper (par ex. `<div class="sb-adeo-grid-root" data-theme="leroyMerlin">…</div>` dans Storybook). Le bundle SCSS de chaque brand redéfinit les mêmes variables CSS sous `[data-theme="<brand>"]`. Le grid ne sait pas quelle brand est active — il se contente de résoudre `var(--…)` au moment du rendu.
- **Brands supportées.** `leroyMerlin` (par défaut), `adeo`, `bricocenter`, `mbrand`. L'attribution de la brand est une décision de l'application hôte.
- **Dark mode.** Non exposé par le grid lui-même. Si les tokens `--color-*` de l'hôte se redéfinissent en dark mode sous une classe / un attribut, le grid suit de manière transparente (il n'a pas de palette en niveaux de gris codée en dur).
- **Double problème de theming des fonts (historique de debug).** Apparu lors de la configuration Storybook Vue : deux choses doivent être vraies pour que la font de brand s'applique — (1) le `@font-face` de la brand doit être chargé par l'hôte (`preview-head.html` + `staticDirs` dans la Storybook Vue), et (2) toute classe wrapper (`.sb-adeo-grid-root`) ne doit PAS définir sa propre `font-family` (elle masquerait la surcharge du token Mozaic). Conclusion dans `BrandPresets.mdx` : **le grid consomme les tokens, l'app hôte charge les fonts, et les wrappers doivent hériter plutôt que surcharger.**

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | Aucune. Le theming est purement piloté par CSS. |
| Outputs / events | Aucun. |
| Slots / projection | Aucun. |
| Imperative | Aucune. |

### Contrat d'implémentation (interne)

- **Pas de chemin de code JS.** Le grid ne lit jamais `data-theme` directement — c'est un mécanisme purement CSS.
- **Fichiers SCSS.** Vue : `apps/grid-vue/src/components/Grid/styles/*.scss` sous `@layer adeo-grid`. Angular : `*.scss` par composant (un par `components/<feature>/`).
- **Audité.** Les deux stacks ont été migrés vers les tokens Mozaic en v4 (tâches #135 audit Angular, #146 migrate Vue, #148 fix surcharge font-family du wrapper).

### Mapping Vue

- Point d'entrée des styles : `apps/grid-vue/src/components/Grid/styles/index.scss` (agrège tout le SCSS par composant).
- Classe wrapper utilisée dans Storybook : `.sb-adeo-grid-root[data-theme="…"]`.
- Chargement des fonts : `apps/grid-vue/.storybook/preview-head.html` + `staticDirs`.

### Mapping Angular

- Fichiers de styles : `projects/grid-angular/src/lib/grid/components/<feature>/<feature>.scss` (un par composant).
- Décorateur de brand Storybook à `apps/grid-angular/.storybook/preview.ts`.
- Chargement des fonts : géré dans la configuration `mozaic-angular` / Storybook au niveau de l'hôte.

## Performance
### Rôle

Codifier le contrat runtime que le grid maintient à l'échelle : ≤ 16 ms par frame sur 100k lignes, réactivité O(1) sur les mutations in-place, et un modèle de feedback à trois niveaux (cellule / ligne / grid complet) afin que le consommateur puisse exposer le bon type d'état de chargement pour la bonne opération.

### Contrat de comportement

- **Budget de frame.** La virtualisation verticale et horizontale maintient le DOM rendu proportionnel au viewport, pas aux données. Le grid vise ≤ 16 ms par frame pendant le scroll sur 100k lignes × 20 colonnes sur une machine de milieu de gamme. Le profil de stress 200 colonnes / 1 M lignes a validé l'optimisation `getComputedStyle` hoisté de l'autosize (sans elle, "autosize all" tournait en plusieurs secondes ; avec, sous les 100 ms).
- **`dataVersion` — Option B (retenue, VUE-DEBT-2).** Les mutations de ligne in-place (`row.field = value` dans le commit d'édition de cellule, le drag du fill handle, le clear en masse, le paste) ne remplacent pas la ligne dans `sourceData`. La réactivité de Vue a besoin d'un déclencheur externe car `computed` ne suit que les lectures réactives — `filteredRows` court-circuite en l'absence de filtre et retourne `props.rows` sans itérer sur les propriétés des lignes, de sorte que les mutations par propriété sont invisibles. **Convention :** chaque writer in-place **bumpe `dataVersion` une fois après son lot** ; chaque `computed` en aval (filter → sort → group) lit `dataVersion` une fois en haut pour enregistrer une dépendance. Cela maintient les éditions cellule unique à un coût d'écriture O(1) (le splice immutable de l'Option A sur un tableau de 100k serait O(N) par frappe — inacceptable). Documenté comme canonique dans `state/useGridState.ts`.
- **Sémantique de `refreshing`.** Une prop booléenne signalant un refetch serveur silencieux en vol. **Le grid ne rend rien pour elle par défaut** — pas de squelette, pas de barre de progression, pas d'overlay. Les lignes existantes restent visibles. On attend du consommateur qu'il remplisse un slot (`#refreshing` en Vue / `[mozGridRefreshing]` en Angular) avec le visuel qu'il souhaite (une barre de progression fine, un spinner inline, une région aria-live…). À utiliser pour sort, filter, pagination ou refresh post-mutation — tout ce où l'utilisateur a du contexte et où un squelette complet semblerait être un reset brutal.
- **`pendingCells` au niveau cellule.** `ReadonlyArray<{ rowId, field }>`. Chaque entrée ajoute un overlay shimmer à la cellule correspondante afin que l'utilisateur voie exactement quelle valeur est en cours de push. Pilote la classe `.grid-cell--pending` via un lookup `Set<"rowId::field">` dans un `computed`. À utiliser pour les mutations optimistes de cellule unique.
- **`pendingRows` au niveau ligne (alias `pendingRowIds`).** `ReadonlyArray<string | number>`. Chaque ligne reçoit un overlay assombri + spinner. À utiliser pour les suppressions en masse ou les sauvegardes drawer lorsque toute la ligne est en pleine mutation. Se cumule avec `pendingCells`.
- **Squelette du grid complet (`loading`).** Lorsque `loading = true`, le body est remplacé par `skeletonRowCount` lignes de squelette (par défaut : dérivé du viewport, entre 4 et 20). À utiliser uniquement lorsqu'il n'y a pas encore de données à afficher — premier chargement, reset brutal.
- **Règle empirique des trois niveaux.** Niveau cellule pour les éditions d'une cellule, niveau ligne pour les mutations à portée ligne, refreshing pour le refetch silencieux sous données existantes, squelette pour "pas de données à l'écran". Les mélanger est correct (par ex. `refreshing` + `pendingCells` pendant qu'un Save-then-refetch est en vol).
- **Opt-out `bulkEdit`.** Les opérations en masse (Ctrl+A → Delete, clear de plage, paste clear) émettent un unique événement `bulkEdit` avec l'ensemble complet de changements au lieu d'un fan-out par cellule de `cellEdit`. Aligned Angular — `ad-grid` émet `bulkEdit` avec la même forme de payload. Vue émet aussi l'alias `bulkCellEdit` en parallèle (`@deprecated`, retrait planifié en v2.0) pour back-compat des consommateurs existants. Le consommateur applique le batch comme un seul appel API + un seul cycle `refreshing`. Un `cellEdit` par cellule mettrait en file 1 M de Promises sur un clear de 1 M de lignes — mesuré comme gelant la page pendant plusieurs secondes. Le fallback par cellule est automatique lorsque `bulkEdit` / `bulkCellEdit` n'est pas câblé.

### API publique

| Concern | Surface |
|---|---|
| Inputs / props | `loading: boolean`, `refreshing: boolean`, `pendingCells: ReadonlyArray<{ rowId, field }>`, `pendingRows` (alias Vue `pendingRowIds`, Angular `pendingRowIds`), `skeletonRowCount?: number`, `containerHeight`, `overscan`, `columnOverscan`. La virtualisation 2D est toujours activée des deux côtés — pas d'input gate. |
| Outputs / events | `bulkEdit` (Vue + Angular) pour l'événement de mutation batché. Vue émet aussi `bulkCellEdit` en alias deprecated pour back-compat. `pageChange` / `loadMore` sont des signaux en aval utilisés pour piloter `refreshing`. |
| Slots / projection | Vue : `#loading`, `#refreshing`, `#error`. Angular : `[mozGridLoading]`, `[mozGridRefreshing]`, `[mozGridEmpty]`. |
| Imperative | Aucune directement — l'état de performance est piloté par les props. `dataVersion` est interne à `state` et n'est pas exposé (les consommateurs doivent réassigner `sourceData` pour déclencher la réactivité en cas de remplacement, ou utiliser le pattern in-place + bump). |

### Contrat d'implémentation (interne)

- **Engines de virtualisation.** Vertical : hauteur variable (prend en compte les lignes de détail dépliées). Horizontal : toujours active, no-op silencieux sous `MIN_COLUMNS_FOR_VIRTUALIZATION = 20` colonnes.
- **Sets de lookup.** `pendingCellLookup: computed(() => new Set(pendingCells.map(c => "${c.rowId}::${c.field}")))` — lookup par cellule O(1) au rendu. `pendingRowLookup` lui fait écho.
- **Chemins de mutation in-place.** `applyFills`, `applyBulkClear`, `commitCellEdit`, paste — tous bumpent `dataVersion` exactement une fois après leur lot.
- **Nombre de lignes de squelette.** `Math.min(SKELETON_MAX, max(SKELETON_MIN, Math.ceil(containerHeight / rowHeight)))` — bornes 4 / 20.

### Mapping Vue

- Fichier : contrat d'état documenté dans `state/useGridState.ts` (JSDoc `dataVersion` canonique).
- Engine : `features/usePaginationEngine.ts` & `features/useVariableHeightVirtualScroll.ts`.
- Hook : `usePendingMutations` (démo, pas dans la librairie).

### Mapping Angular

- Fichier : `state/grid-state.ts` (même forme, `dataVersion: WritableSignal<number>`).
- Engine : `features/pagination.engine.ts`, `features/vertical-virtual-scroll.engine.ts`, `features/horizontal-virtual-scroll.engine.ts`.

## Public API canonique du grid
Section de synthèse. Tout ce qui suit est le contrat exposé au consommateur — les props, événements, slots, méthodes impératives et modèles publics supportés par `<ad-grid-vue>` (Vue) et `<ad-grid-angular>` (Angular). Lorsqu'une ligne indique **Aligned**, les deux librairies correspondent en forme et en sémantique ; lorsqu'elle indique **Vue only** / **Angular only**, la surface est mono-stack.

### Props (inputs)

| Prop | Type | Default | Description | Vue prop | Angular input |
|---|---|---|---|---|---|
| `data` / `rows` | `T[]` | `[]` | Lignes source. | `rows` (requis) | `data` |
| `columns` | `ColumnDef<T>[]` | — | Liste impérative de colonnes. Vue peut aussi déclarer via des enfants `<ad-grid-column>`. | `columns?` | enfants de contenu `<ad-grid-column-def>` |
| `mode` | `'client' \| 'server'` | `'client'` | Mode global serveur/client. | (n/a — dérivé de `serverFilter`/`serverGrouping`) | `mode` |
| `filterMode` | `'client' \| 'server'` | `'client'` | Mode d'évaluation du filtre (découplé). | `filterMode` | `filterMode` |
| `serverFilter` | `boolean` | `false` | Alias historique de `filterMode: 'server'`. | `serverFilter` | (n/a) |
| `serverGrouping` | `ServerGroupingOptions<T>` | — | Descripteur de groupement côté serveur. | `serverGrouping` | `serverGroupingOptions`, `groupMode` |
| `totalItems` / `totalCount` | `number` | `0` | Nombre total de lignes côté serveur. | `totalItems` (`totalCount` deprecated alias) | `totalItems` |
| `pagination` | `boolean \| PaginationConfig` | `true` (Vue), `true` (Angular) | Toggle / configure la pagination. | `pagination` | `pagination`, `pageSize`, `pageSizeOptions` |
| `loadingStrategy` | `'pagination' \| 'infinite-scroll'` | `'pagination'` | Comment davantage de lignes sont chargées. | (via `pagination`) | `loadingStrategy`, `scrollThreshold` |
| `multiSort` | `boolean` | `true` (Vue) | Autorise Shift+clic multi-tri + badge de priorité. | `multiSort` | (multi-tri toujours disponible) |
| `loading` | `boolean` | `false` | Affiche le squelette complet. | `loading` | `loading` |
| `refreshing` | `boolean` | `false` | Refetch silencieux — pas de visuel par défaut, remplir le slot. | `refreshing` | `refreshing` |
| `pendingCells` | `ReadonlyArray<{ rowId, field }>` | `[]` | Overlay shimmer par cellule. | `pendingCells` | `pendingCells` |
| `pendingRows` / `pendingRowIds` | `ReadonlyArray<string \| number>` | `[]` | Overlay + spinner par ligne. | `pendingRows` (canonique, `pendingRowIds` alias deprecated) | `pendingRowIds` |
| `error` | `Error \| null` | `null` | Expose le slot `#error`. | `error` | (via `[mozGridEmpty]`) |
| `skeletonRowCount` | `number` | dérivé du viewport | Surcharge le nombre de lignes de squelette. | `skeletonRowCount` | `skeletonRowCount` |
| `rowId` | `(row, i) => string` | index | Résolveur d'identité de ligne. | `rowId` | `rowIdField: string` (variante nom de champ) |
| `selectable` | `boolean` | `false` | Sélection de ligne par case à cocher. | `selectable` | `rowSelection` |
| `selectionBarCompact` | `boolean` | `false` | Retire le compteur/la fermeture de la barre flottante. | `selectionBarCompact` | (n/a) |
| `expandable` | `boolean` | `false` | Active la colonne chevron de ligne de détail. | `expandable` | `expandable` |
| `density` | `'compact' \| 'default' \| 'comfortable'` | `'default'` | Preset de hauteur de ligne. | `density` | `density` |
| `rowHeight` | `number` | `48` | Hauteur de ligne explicite en px. | (via density) | `rowHeight` |
| `fullscreen` | `boolean` | `false` | Couvre le viewport. | `fullscreen` | `fullscreen` |
| `height` | `string \| number` | `'auto'` | Hauteur CSS appliquée à la racine. | `height` | (l'hôte enveloppe) |
| `containerHeight` | `number` | `600` | Hauteur du viewport pour le virtual scroll (toujours actif, aucun input gate à brancher pour la virtualisation 2D). | `containerHeight` | (calculé) |
| `overscan` | `number` | `5` | Lignes au-dessus/en-dessous de la fenêtre. | `overscan` | (interne) |
| `columnOverscan` | `number` | `2` | Colonnes à gauche/droite de la fenêtre. | `columnOverscan` | (interne) |
| `onVisibleRangeChange` | `(start, end) => void` | — | Callback de plage visible. | `onVisibleRangeChange` | `loadMore` (événement) |
| `hiddenFields` | `string[]` | `[]` | Noms de champs à masquer. | `hiddenFields` (v-model) | `hiddenFields` |
| `groupFields` | `string[]` | `[]` | Groupement actif. | `groupFields` | (via `groupChange`) |
| `columnOrder` | `string[]` | dérivé | Synchronisation d'ordre externe. | `columnOrder` | (via persistance) |
| `persistKey` | `string` | — | Auto-persiste la vue colonnes/tri/filtre dans `localStorage`. | `persistKey` | `persistKey` (alias historique `stateKey`) |
| `historyId` | `string` | — | Persiste les piles undo/redo. | `historyId` (`@deprecated` — utiliser `persistKey` ; retrait v2.0) | (via l'engine de persistance, dérive automatiquement de `persistKey`) |
| `plugins` | `GridPlugin[]` | `[]` | Plugins transversaux (§9.3). | `plugins` | `plugins` |
| `suppressColumnMoveAnimation` | `boolean` | `false` | Désactive le glissement FLIP au réordonnancement. | `suppressColumnMoveAnimation` | (n/a) |
| `reorderable` | `boolean` | `false` (Angular) | Conditionne le drag handle. | (toujours activé) | `reorderable` |
| `multiCellSelection` | `boolean` | `true` | Autorise la sélection de cellules multi-plages. | (via config d'engine) | `multiCellSelection` |
| `formulas` | `boolean` | `false` | Active l'engine de formules. | (via `allowFormula` par colonne) | `formulas` |
| `detailTemplate` | `TemplateRef` | `null` | Template de ligne de détail. | (via slot `#expandedRow`) | `detailTemplate` |
| `exportable` | `boolean` | `false` | Affiche l'export dans la toolbar. | (via prop de toolbar) | `exportable` |
| `exportMode` | `'client' \| 'server'` | `'client'` | Téléchargement client ou émission de `exportRequest`. | (via toolbar) | `exportMode` |
| `showToolbar` | `boolean` | `true` | Rend la toolbar par défaut. | (via slot `#toolbar`) | `showToolbar` |
| `emptyDataTitle/Description`, `noResultsTitle/Description/ActionLabel` | `string` | — | Textes d'état vide. | (via slot `#empty`) | inputs |
| `filterApplyMode` | `'auto' \| 'manual'` | dérivé du mode | Déclencheur d'application du builder. | (n/a) | `filterApplyMode` |

### Événements (outputs)

| Event | Payload type | Déclenché quand | Vue emit | Angular `@Output` |
|---|---|---|---|---|
| `sortChange` | `SortEvent` | La pile de tri active change (toggle, menu, programmatique) | `sortChange` | `sortChange` |
| `pageChange` | `PageEvent` | L'index de page ou la taille de page change | `pageChange` | `pageChange` |
| `loadMore` | `LoadMoreEvent` | Limite d'infinite-scroll atteinte | (via `onVisibleRangeChange`) | `loadMore` |
| `cellEdit` | `CellEditEvent<T>` | Commit d'une cellule — fan-out par cellule | `cellEdit` | `cellEdit` |
| `cellEditCancel` | `CellEditCancelEvent` | Édition abandonnée (Escape) | (via slot) | `cellEditCancel` |
| `bulkEdit` | `{ changes: […] }` | Mutation batch one-shot (Ctrl+A → Delete, paste-clear) | `bulkEdit` (+ alias deprecated `bulkCellEdit` qui fire en parallèle ; retrait v2.0) | `bulkEdit` |
| `bulkCopy` / `bulkPaste` / `bulkDelete` | `BulkCopyEvent` / `BulkPasteEvent` / `BulkDeleteEvent` | Opérations clipboard / en masse | (via toolbar) | `bulkCopy`, `bulkPaste`, `bulkDelete` |
| `fill` / `fillDown` | `FillEvent` / `FillDownEvent` | Commit du drag de fill handle | `fill` | `fillDown` |
| `selectionChange` / `update:selection` | `SelectionModel` / `RowSelectionEvent<T>` | La sélection de ligne change | `update:selection` | `selectionChange` |
| `cellSelectionChange` | `CellSelectionEvent<T>` | La sélection de plage de cellules change | (via engine) | `cellSelectionChange` |
| `selectionEdit` | `{mode:'row'…} \| {mode:'cell'…}` discriminé | Bouton Edit dans la barre flottante | `selectionEdit` | (via toolbar) |
| `groupChange` | `GroupEvent` | Les groupes actifs changent | `groupChange` | `groupChange` |
| `filterChange` (historique) / `filterEvent` | `Record<string, unknown>` / `FilterEvent` | Mutation de filtre | `filterChange` (deprecated), `filterEvent`, `update:filterModel` | `filterChange` (`FilterEvent`) |
| `update:filterModel` | `FilterModel` | v-model formel du filtre | `update:filterModel` | (via `filterChange.model`) |
| `columnMenuAction` | `ColumnMenuAction` | Item du menu d'en-tête choisi | `columnMenuAction` | (outputs par action dans l'en-tête) |
| `hiddenFieldsChange` / `update:hiddenFields` | `string[]` | Changement de visibilité | `update:hiddenFields`, `hiddenFieldsChange` | `hiddenFieldsChange` |
| `densityChange` | `GridDensity` | Densité choisie dans le drawer | (via v-model:density) | `densityChange` |
| `settingsChange` | `GridSettingsResult` | Commit du drawer de paramètres | (via props v-model) | `settingsChange` |
| `exportRequest` | `GridExportEvent` | Export depuis la toolbar sous `exportMode='server'` | (via toolbar) | `exportRequest` |
| `retry` | `[]` | L'utilisateur a cliqué Retry dans le slot `#error` | `retry` | (géré par l'hôte) |

### Slots / projection

**Vue (slots nommés de `<ad-grid-vue>`).**
- `#toolbar="{ grid, columns, … }"` — remplace l'`GridToolbar` par défaut.
- `#cell="{ row, column, value, rowIndex }"` et `#cell-{field}="…"` — renderer de cellule par colonne / global.
- `#header="{ column, sortDirection }"` et `#header-{field}`.
- `#filter="{ column, value, setValue }"` et `#filter-{field}`.
- `#edit="{ row, column, value, commit, cancel }"` et `#edit-{field}`.
- `#expandedRow="{ row, index }"` — ligne de détail.
- `#loading`, `#refreshing`, `#error`, `#empty`, `#noResults` — slots d'état.
- `#actions` — boutons supplémentaires dans la barre de sélection flottante.

**Angular (projection de template `<ad-grid-angular>`).**
- `[detailTemplate]="tpl"` avec `<ng-template #tpl let-row let-i="rowIndex">…</ng-template>`.
- `<ad-grid-column-def field="…" [cellTemplate]="…" [headerTemplate]="…" [editorTemplate]="…" />` — projection déclarative de colonne.
- `<ng-template mozGridToolbar let-grid>…</ng-template>` (via `AdeoGridToolbarDef`).
- `<ng-template mozGridEmpty>…</ng-template>` (via `AdeoGridEmptyDef`).
- `<ng-template mozGridRefreshing>…</ng-template>` — slot de refresh silencieux.
- `<ng-template mozGridLoading>…</ng-template>`.

### Méthodes impératives

| Method | Signature | Vue | Angular |
|---|---|---|---|
| Export CSV | `exportCsv(options?: { filename, separator, columns, scope })` | `defineExpose` | `public exportCsv()` |
| Export JSON | `exportJson(options?: { filename, columns, scope })` | `defineExpose` | `public exportJson()` |
| Undo | `undo(): void` | `defineExpose` | `public undo()` |
| Redo | `redo(): void` | `defineExpose` | `public redo()` |
| Clear history | `clearHistory(): void` | `defineExpose` | `public clearHistory()` |
| Validate all | `validateAll(): number` | `defineExpose` | `public validateAll()` |
| Get/has cell error | `getCellError(rowIndex, field)`, `hasCellError(rowIndex, field)` | `defineExpose` | `public getCellError`, `public hasCellError` |
| Get sort/filter/group model | `getSortModel()`, `getFilterModel()`, `getGroupModel()` | `defineExpose` | `public get*Model()` |
| Set / clear filter model | `setFilterModel(model)`, `clearFilters()`, `clearQuickFilters()`, `clearFilterModel()`, `setFilter(field, value)` | `defineExpose` | `public setFilterModel`, `public clearFilters`, `public clearQuickFilters` (noop en Angular), `public setFilter` |
| Clear sort / groups | `clearSort()`, `clearGroups()` | `defineExpose` | `public clearSort`, `public clearGroups` |
| Selection | `selectAll()`, `clearSelection()`, `getSelectedRows()` | `defineExpose` (+ getters réactifs `selectionModel`, `selectedCount`, `selectionTotalCount`) | `public selectAll`, `public clearSelection`, `public getSelectedRows` |
| Persistance | `persistView(key)`, `restoreView(key): boolean` | `defineExpose` | `public persistView`, `public restoreView` |
| Tree | `tree.flatten(data, config, set, idField)`, `tree.toggleNode(k)`, `tree.expandAll(data, config, idField)`, `tree.collapseAll()` | `defineExpose({ tree: { … } })` | `public readonly tree = { flatten, toggleNode, expandAll, collapseAll }` |
| Autosize | `autosizeColumn(field, options?: { maxWidth })`, `autosizeAllColumns(options?: { maxWidth })` | `defineExpose` | `public autosizeColumn`, `public autosizeAllColumns` |
| Formula | `setFormula(addr, formula)`, `getFormula(addr)`, `getFormulaValue(addr)` | `defineExpose` | `public setFormula`, `public getFormula`, `public getFormulaValue` |

### Modèles / types publics

Exportés depuis le point d'entrée public de chaque librairie :

- `ColumnDef<T>` / `GridColumn<T>` — field, headerName, width/minWidth/maxWidth, pinned, visible, sortable, filterable, groupable, freezable, hideable, valueGetter, valueFormatter, sortComparator, cellTemplate, headerTemplate, editorTemplate, cellEditor (`'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date' | 'toggle' | 'custom'`), cellValidator, allowFormula, searchVisible, chaînes minWidth/maxWidth.
- `ColumnStateEntry` — `{ field, currentWidth, order, visible, sort, sortIndex, pinned, searchVisible }`.
- `RowData` (Vue) / generic de ligne `T` (Angular).
- `SortDef`, `SortDirection`, `SortEvent`.
- `FilterModel`, `FilterCondition`, `FilterMode`, `FilterEvent`, `FilterApplyMode`.
- `GroupEntry`, `GroupEvent`, `ServerGroupingOptions<T>`.
- `PageEvent`, `LoadMoreEvent`, `PaginationConfig`, `LoadingStrategy`.
- `CellCoord`, `CellEditState`, `CellEditEvent<T>`, `CellEditCancelEvent`, `CellEditorType`, `CellError`.
- `SelectionModel`, `SelectionRange`, `RowSelectionEvent<T>`, `CellSelectionEvent<T>`.
- `FillEvent` / `FillDownEvent`, `BulkEditEvent`, `BulkCopyEvent`, `BulkPasteEvent`, `BulkDeleteEvent`.
- `ColumnResizeEvent`, `ColumnReorderEvent`, `ColumnFreezeEvent`, `ColumnVisibilityEvent`, `ColumnSearchToggleEvent`.
- `HeaderMenuActionId` (`'sort-asc' | 'sort-desc' | 'filter-column' | 'group-column' | 'freeze-column-left' | 'freeze-column-right' | 'unfreeze-column' | 'hide-column' | 'toggle-column-search' | 'autosize-this' | 'autosize-all'`), `HeaderMenuConfig`.
- `TreeNodeConfig`, `TreeDisplayRow<T>`.
- `GridDensity` (`'compact' | 'default' | 'comfortable'`).
- `GridExportEvent`, `GridSettingsResult`.
- `GridPlugin` / `GridPlugin` — `{ id, init({ state, engine }), … }`.
- `FormulaValue`, `CellAddress` (forme longue `rowId::field`, helpers A1).

---

### Sources

- Vue : `apps/grid-vue/src/components/Grid/{state,features,models,styles}/`, `apps/grid-vue/src/composables/useAutosize.ts`, `Grid.vue` (props/emits/defineExpose).
- Angular : `apps/grid-angular/projects/grid-angular/src/lib/grid/{state,features,components,models}/`, `grid.ts` (inputs/outputs/API publique).
- Deltas de synchro : `packages/docs/grid-vue-docs/vue-vs-angular-sync.md` v4 (B23 / B26 / B28 / B29, VUE-DEBT-2, audit de theming).
