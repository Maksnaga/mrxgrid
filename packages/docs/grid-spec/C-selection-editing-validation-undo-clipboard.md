# Sélection, édition, validation, undo, presse-papier, clavier

Ce chapitre spécifie la surface d'interaction de `@adeo/grid` : sélection de
lignes et de cellules, sélection de range avec la poignée de remplissage,
édition inline, validation par cellule, historique undo/redo, presse-papier
et gestion clavier. Il est agnostique du framework ; chaque section est
mappée sur le composable Vue (`use*Engine`) et sur la classe engine Angular
(`*.engine.ts`).

Deux contrats transverses reviennent régulièrement et sont signalés là où
ils s'appliquent :

- **Symétrie de `extendRangeTo(row, col)`** — unifiée dans VUE-DEBT-1. Le
  moteur Vue expose désormais la même méthode d'extension ancrée que
  possédait déjà Angular, en remplacement des call-sites historiques de
  `useCellSelection.extendTo()`.
- **Invalidation via `dataVersion`** — en Vue, toute mutation in-place
  d'une ligne (poignée de remplissage, commit d'édition inline, paste en
  masse, clear) DOIT incrémenter `state.dataVersion` afin que la cascade
  filter / sort / group / cache soit ré-exécutée. Le graphe de signaux
  Angular invalide automatiquement ; en Vue, c'est un contrat manuel
  porté par `applyFills` et le commit d'édition inline.

---

<a id="row-selection"></a>
## Sélection de lignes
### Rôle
Suivre quelles lignes de données ont été marquées par l'utilisateur,
exposer le compteur pour les actions de masse, et alimenter l'UI de la
barre de sélection. La sélection peut être mono-ligne, à l'échelle de la
page, ou à l'échelle du dataset (« select all » avec exclusions
explicites).

### Contrat de comportement
- Trois modes sont maintenus dans `selectAllMode` : `'none'`, `'page'`, `'all'`.
  - `'none' | 'page'` — `selectedRowIds` est l'ensemble des IDs de lignes
    explicitement sélectionnées.
  - `'all'` — toutes les lignes sont conceptuellement sélectionnées ;
    `excludedRowIds` est l'ensemble des lignes que l'utilisateur a
    explicitement désélectionnées (façon Gmail).
- L'identité de ligne est résolue via `state.rowIdField` (défaut `'id'`),
  avec repli sur `id`, puis `_id`, puis l'identité d'objet.
- L'ancre du shift-click est stockée comme l'**objet ligne**
  (`lastToggledRow`), pas comme son index, de sorte que l'ancre survit
  aux changements de tri/filtre/groupement qui déplacent la ligne vers un
  autre index d'affichage. Si l'ancre quitte la page visible, le moteur
  retombe sur un simple toggle.
- `count` retourne :
  - En mode `'all'` → `totalItems − excludedRowIds.size` (à l'échelle du
    dataset).
  - En mode `'page' | 'none'` → `selectedRowIds.size`.
- `pageSelectedCount` / `isAllSelected` / `isIndeterminate` sont à la
  portée de la page — ils parcourent les lignes paginées courantes.
- `selectAll()` bascule en mode `'all'` et vide les deux ensembles ;
  `selectAllPage()` étend uniquement la page courante et reste en mode
  `'page'` (ou, en mode `'all'`, retire ces IDs des exclusions).
- `getSelectionEvent()` ne retourne que les lignes présentes sur la page
  courante — le moteur ne tente jamais de matérialiser des lignes non
  chargées.

### API publique
| Préoccupation | Surface |
|---|---|
| Inputs / props | `selectable: boolean`, `rowIdField?: string` |
| Outputs / events | `rowSelectionChange(payload: RowSelectionEvent<T>)` — `{ selectedIds, excludedIds, selectedRows, mode, count }` |
| Slots | Slot `#actions` de la barre de sélection (boutons d'action de masse supplémentaires) |
| Impératif | `toggleRow(row)`, `selectRowRangeToRow(row)`, `selectAllPage()`, `selectAll()`, `deselectAll()`, `deselectPage()`, `toggleSelectAllPage()`, `isRowSelected(row)`, `getSelectionEvent()`, `getRowId(row)` |

### Contrat d'implémentation (interne)
- Signaux d'état détenus : `selectedRowIds`, `excludedRowIds`, `selectAllMode`.
- Signaux d'état observés : `sourceData`, `totalItems`, `rowIdField` (pour
  la résolution d'identité), `paginatedData` (pour les dérivations à la
  portée de la page).
- État local : `lastToggledRow` (ancre pour le range en shift-click).
- L'état de sélection NE participe PAS à la cascade de cache
  filter/sort/group — il est en lecture seule du point de vue de ce
  pipeline.

### Mapping Vue
- Fichier : `apps/grid-vue/src/components/Grid/features/useRowSelectionEngine.ts`
- Composable : `useRowSelectionEngine(state, paginatedData)`
- Méthodes clés : `toggleRow`, `selectRowRangeToRow`, `selectAllPage`, `selectAll`,
  `deselectAll`, `deselectPage`, `toggleSelectAllPage`, `isRowSelected`,
  `getSelectionEvent`, `getRowId`
- Chemin d'état : `state.selectedRowIds`, `state.excludedRowIds`, `state.selectAllMode`

### Mapping Angular
- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/row-selection.engine.ts`
- Engine : `RowSelectionEngine` (`@Injectable()`, injecté via DI)
- Méthodes clés : même surface qu'en Vue. Expose un alias déprécié
  `allSelectedCount` pointant vers `count` pour compatibilité ascendante.
- Chemin des signaux d'état : `GridStateManager.selectedRowIds`, `excludedRowIds`,
  `selectAllMode`

### Contrat UI de la barre de sélection
- Une toolbar flottante apparaît lorsque la sélection active est non vide.
- Se déclenche SOIT sur ≥ 1 ligne sélectionnée (requiert `selectable`)
  SOIT sur ≥ 2 cellules dans le range de cellules actif.
- Affiche : un compteur (`"N rows selected"` / `"N cells selected"`), un
  bouton de fermeture (efface la sélection), une invite « Select all N
  rows » réservée au mode ligne lorsque la page est entièrement
  sélectionnée mais que `mode !== 'all'`, le label `"(all N)"` lorsque
  `mode === 'all'`, les boutons intégrés Edit / Copy / Paste / Delete
  activés par les props, et un popup kebab hébergeant le slot consommateur
  `#actions` (masqué lorsque le slot est vide).
- Composant : Vue `GridSelectionBar.vue`, Angular `<adeo-grid-selection-bar>`.

## Sélection de cellules (range)
### Rôle
Suivre la cellule focalisée, un range de sélection actif (rectangle
unique), et optionnellement un tableau de ranges « extra » figés ajoutés
via Ctrl+Click. Le moteur détient toute mutation de `focusedCell` /
`selectedCell` / `cellRange` / `isDragging`, plus les primitives de
navigation clavier.

### Contrat de comportement
- Coordonnées : `row` est un **index d'affichage global** (offset de page
  inclus) ; `col` est un index dans `state.visibleColumns`.
- `focusCell(row, col, source?)` est **idempotent**. Lorsque la cellule
  demandée est déjà focalisée et qu'il n'y a aucun état transitoire à
  nettoyer (pas de ranges figés, pas de range vivant, pas de drag), le
  moteur rafraîchit `focusSource` et retourne sans muter `focusedCell`.
  Ce garde-fou existe pour casser une boucle de mise à jour récursive en
  Vue : sans lui, un `focusCell` synchrone suivi d'un `watch(activeCell)`
  redéclenche `focusCell` avec un nouvel objet `{row, col}` à chaque tick.
- Un `focusCell` simple efface toujours `frozenRanges`, `cellRange` et
  `isDragging`. Le gel de range via Ctrl+Click DOIT passer par
  `addRange(...)` qui écrit directement les champs d'état et contourne
  `focusCell`.
- `extendRangeTo(row, col)` étend le range vivant depuis l'ancre
  (`cellRange.start ?? focusedCell`) jusqu'à `(row, col)` **sans exiger
  `isDragging`**. C'est l'API utilisée par Shift+Click et Shift+Arrow.
  Les deux implémentations l'exposent.
- `extendRange(row, col)` est la variante drag-only : elle court-circuite
  lorsque `!isDragging`. Mouse-down → `startRangeSelection` → mousemove →
  `extendRange` → mouseup → `endRangeSelection`.
- `extendRangeBy(dRow, dCol)` clamp la nouvelle extrémité aux bornes de
  lignes de la page et aux bornes des colonnes visibles.
- Ctrl+A invoque `selectAll()`, qui fixe le range à `[pageStart, 0]
  → [pageEnd, lastCol]`. Sur une vue filtrée+groupée, les bornes sont
  celles de la page actuellement affichée — les lignes de groupe SONT
  sélectionnées comme membres du range mais la mutation cellule par
  cellule (delete, fill, paste) les ignore ; voir Bulk / fill pour le
  garde-fou skeleton / ligne de groupe.
- `getNormalizedRange()` retourne un `{start, end}` frais avec
  `start.row ≤ end.row` et `start.col ≤ end.col`, en retombant sur
  `{focused, focused}` lorsqu'aucun range n'existe.
- Multi-range (Ctrl+Click) : `frozenRanges` contient les ranges vivants
  précédents ; `allRanges` = `frozenRanges + currentLiveRange`. Un simple
  clic ou `Escape` efface tous les ranges figés.

### API publique
| Préoccupation | Surface |
|---|---|
| Inputs / props | (aucun — la sélection de cellule est toujours active) |
| Outputs / events | `cellSelectionChange({ range, focused })` (niveau hôte), `cellActivate({ row, col })` |
| Impératif | `focusCell`, `clearFocus`, `isCellFocused`, `isCellInRange`, `selectRange`, `startRangeSelection`, `extendRange`, `extendRangeTo`, `endRangeSelection`, `selectRow(row)`, `selectColumn(col)`, `selectAll()`, `moveToNextEditableCell()`, `getNormalizedRange()`, `addRange(range)`, `clearFrozenRanges()` |

### Contrat d'implémentation (interne)
- Signaux d'état détenus : `focusedCell`, `selectedCell`, `cellRange`,
  `isDragging`, `focusSource`, `fillAnchor`, `fillTarget`, `isFilling`.
- État local : `frozenRanges` (multi-range, sans pendant Angular au-delà
  du stockage local au moteur).
- Lectures auxiliaires : `visibleColumns`, `columnDefMap`, `sourceData`,
  `pageIndex`, `pageSize`, `visibleRowCount`, `rowHeight`,
  `scrollViewportHeight` (pour `pageRowStep`).
- Aucune invalidation du cache filter/sort/group — la sélection de
  cellule est une pure dérivation à partir de la vue courante.

### Mapping Vue
- Fichier : `apps/grid-vue/src/components/Grid/features/useCellSelectionEngine.ts`
- Composable : `useCellSelectionEngine(state)`
- Retourne le Cell SelectionEngine complet + `frozenRanges`, `allRanges`,
  `addRange`, `clearFrozenRanges`.

### Mapping Angular
- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/cell-selection.engine.ts`
- Engine : `CellSelectionEngine`
- Expose la même surface plus `isCellInAnyRange(row, col)` (utilisé par
  `<adeo-grid-cell>` pour le rendu multi-range).

## Bulk / fill (poignée Excel)
### Rôle
Poignée de remplissage à la Excel : faire glisser le coin bas-droit de
la cellule focalisée (ou du range) pour étendre une valeur ou une série
arithmétique sur un seul axe. Plus les primitives d'écriture bas niveau
utilisées par le presse-papier et l'undo.

### Contrat de comportement
- Le fill est **1-D sur axe dominant** : si `|dRow| ≥ |dCol|` pendant
  le drag, le fill se verrouille sur une seule colonne (vertical) ;
  sinon il se verrouille sur une seule ligne (horizontal). L'autre axe
  est forcé à revenir à l'ancre.
- La cellule d'ancrage est exclue du range de fill (pas de self-overwrite).
- Les fills horizontaux ignorent les colonnes non éditables et les
  colonnes de type incompatible (mismatch sur `def.cellEditor`). Les
  cellules ignorées sont peintes d'un contour pointillé rouge via
  `isCellInFillRejectRange(row, col)`.
- Détection de série (B21) : lorsque le range source contient ≥ 2 valeurs
  qui forment une progression arithmétique (nombres ou dates),
  `detectSeries` extrapole les valeurs suivantes. Sinon la valeur source
  est copiée (et les références de formules sont décalées — voir plus
  bas).
- Formules : lorsque la valeur source est une formule (`'=...'`) et que
  `def.allowFormula === true`, les références relatives de la formule
  sont décalées de `(rowDelta, colDelta)` via `shiftFormulaRefs`.
- Les lignes de groupe et les lignes skeleton sont ignorées par
  `applyFills` (garde-fou contre `__adgSkeleton` et `isGroupRow(row)`).

### `applyFills()` et le bump de `dataVersion` (load-bearing)
Après chaque mutation qui écrit in-place dans des objets ligne existants,
`applyFills` DOIT incrémenter `state.dataVersion` pour invalider le
pipeline filter / sort / group. Le code exact côté hôte Vue :

```ts
// Grid.vue
function applyFills(fills: Array<{ rowIndex: number; field: string; value: unknown }>): void {
  let mutated = 0
  for (const f of fills) {
    const row = renderableRows.value[f.rowIndex]
    if (row && !isGroupRow(row) && !(row as Record<string, unknown>).__adgSkeleton) {
      ;(row as Record<string, unknown>)[f.field] = f.value
      mutated++
    }
  }
  if (mutated > 0) gridState.dataVersion.value++
}
```

Sans ce bump, muter `row[field]` met à jour le renderer de cellule (qui
suit directement `row[field]`) mais `filteredRows` court-circuite sur
« no active filter » et retourne `props.rows` inchangé. Vue ne voit
aucun changement de dépendance et `buildGroupTree` ne re-bucketise
jamais la ligne mutée. Symptôme visible : grouper par un champ, éditer
une cellule vide vers une valeur, la ligne reste figée dans le bucket
d'origine (vide).

Le graphe de signaux Angular invalide automatiquement lorsque
`sourceData` est écrit (le moteur d'édition inline utilise un
`sourceData.update` immutable), il n'existe donc pas de compteur
équivalent. Le contrat côté Vue est : **toute mutation in-place doit
incrémenter `dataVersion`**.

### API publique
| Préoccupation | Surface |
|---|---|
| Inputs / props | `editable` sur chaque `ColumnDef`, `allowFormula` (par colonne, pour le décalage de référence) |
| Outputs / events | `fill({ anchor, target, range, source })` (niveau hôte), événements `cellEdit` pour chaque changement de cellule |
| Impératif | `startFill(row, col)`, `extendFill(row, col)`, `endFill(): {anchor, target}|null`, `cancelFill()`, `isCellInFillRange(row, col)`, `isCellInFillRejectRange(row, col)` |

### Contrat d'implémentation (interne)
- Signaux d'état détenus : `isFilling`, `fillAnchor`, `fillTarget`.
- Mutation : écrit via `applyFills` (hôte Vue) ou directement dans
  `sourceData` via le chemin de mise à jour immutable (moteur clipboard
  Angular).
- **Invalidation du cache Vue : `state.dataVersion++` est requis.**
- Dépendances : `visibleColumns`, `columnDefMap`, `sourceData`, les
  helpers de détection de série dans le moteur clipboard.

### Mapping Vue
- Fichier : `apps/grid-vue/src/components/Grid/features/useCellSelectionEngine.ts`
  (état fill + extend) et `useClipboardEngine.ts` (`fillDown`,
  `fillRight`, `fillSelection`, `clearRange` — série + décalage de
  formule).
- Hôte : `Grid.vue` `applyFills(fills)` effectue l'écriture réelle
  et incrémente `dataVersion`.

### Mapping Angular
- Fichier : `cell-selection.engine.ts` (état fill + extend) et
  `clipboard.engine.ts` (`fillDown`, `fillRight`, `fillSelection`,
  `clearRange`, `applyPaste`, `applyChanges`).
- Mutation : `state.sourceData.update(data => …)` — immutable ; le graphe
  de signaux invalide automatiquement les computeds en aval.

## Édition inline
### Rôle
Ouvrir un éditeur de cellule, capturer une valeur brouillon, la valider
au commit, la réécrire dans `sourceData` et émettre `cellEdit`. Supporte
les éditeurs text, number, date, select, combobox, checkbox et les
éditeurs personnalisés via un slot `#edit` (Vue) / projection de
template (Angular).

### Contrat de comportement
- `startEdit(rowIndex, field)` est gardé par `def.editable === true`.
  - Lit la valeur de la cellule via `def.valueGetter` si présent, sinon
    `row[field]` directement.
  - Pour les colonnes de formule (`def.allowFormula === true`) lorsque
    `formulaEngine` est branché, la forme de stockage (`=REF(COLUMN("price"),
    ROW(1))…`) est convertie en surface A1 (`=A1*B1`) avant de peupler
    le brouillon.
- `startEditWithChar(rowIndex, field, char)` — Excel « typing-to-edit ».
  Remplace la valeur de la cellule par le caractère saisi (coercé par
  type d'éditeur : `number` → `Number(char)`, `checkbox` → `true`,
  `select` / `date` → chaîne vide pour ouvrir le picker).
- `updateDraft(value)` patche `cellEditState.draftValue`.
- `commitEdit()` exécute `def.cellEditorValidator(draft, row)` s'il est
  défini.
  - Vue : le validateur retourne `true | false | string` — `false` ou
    une string fixe `cellEditState.validationError` et retourne `null`
    (ne PAS écrire).
  - Angular : même contrat ; la conversion vers la forme de stockage
    pour les brouillons de formule A1 a lieu avant l'écriture
    (`a1ToLongForm`).
  - En cas de succès, écrit la nouvelle valeur, enregistre un changement
    cellule unique sur le moteur d'historique (pour que Ctrl+Z
    fonctionne), efface `cellEditState`, et retourne un `CellEditEvent`.
- `cancelEdit()` efface `cellEditState` et retourne un
  `CellEditCancelEvent`.
- Fallback générique sur le slot `#edit` : lorsqu'une colonne ne déclare
  pas de `cellEditor` spécifique et que le consommateur a fourni un slot
  `#edit` global, le slot est utilisé pour TOUTES les cellules éditables
  non-date — la scope du slot reçoit
  `{ row, field, value, commit, cancel }`. (Les cellules date affichent
  le `<input type="date">` natif quel que soit le cas.)
- Interaction avec les formules : au commit, lorsque `allowFormula` vaut
  true et que le brouillon commence par `=`, le moteur écrit la valeur
  de stockage long-form dans `sourceData` (Angular) / laisse la formule
  brute dans `sourceData` et appelle `formulaEngine.set(addr, value)` +
  `invalidate(addr)` pour recalculer les dépendants.

### API publique
| Préoccupation | Surface |
|---|---|
| Inputs / props | par colonne : `editable`, `cellEditor`, `cellEditorOptions`, `cellEditorValidator`, `allowFormula` |
| Outputs / events | `cellEdit(payload: CellEditEvent<T>)` — `{ row, rowIndex, field, oldValue, newValue }`, `cellEditCancel(payload: CellEditCancelEvent)` |
| Slots / projection | `#edit-{field}` (override par colonne) et `#edit` (fallback générique). Scope du slot : `{ row, field, value, commit, cancel }`. |
| Impératif | `startEdit(rowIndex, field)`, `startEditWithChar(rowIndex, field, char)`, `updateDraft(value)`, `commitEdit()`, `cancelEdit()`, `isEditing(rowIndex, colIndex)`, `resolveEditorType(field, value)` |

### Contrat d'implémentation (interne)
- Signal d'état détenu : `cellEditState: { editingCell, originalValue, draftValue, validationError }`.
- Lectures : `columnDefMap`, `visibleColumns`, `sourceData`, `rowIdField`
  (pour la résolution d'adresse de formule),
  `displayIndexToSourceIndex` du moteur de grille (ligne d'affichage →
  index du tableau source).
- Écritures : `sourceData[sourceIndex][field] = draftValue` immutablement
  en Angular ; en Vue, le moteur d'édition inline remplace lui-même la
  ligne via `sourceData.value = [...updated]` (donc aucun bump
  `dataVersion` n'est requis pour le chemin de commit — seul le chemin
  in-place `applyFills` en a besoin).
- Enregistre une opération d'historique `'edit'` lorsque
  `oldValue !== newValue`.

### Mapping Vue
- Fichier : `apps/grid-vue/src/components/Grid/features/useInlineEditEngine.ts`
- Composable : `useInlineEditEngine(state, history, displayIndexToSourceIndex, formulaEngine?)`

### Mapping Angular
- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/inline-edit.engine.ts`
- Engine : `InlineEditEngine` — injecte `GridStateManager`, `HistoryEngine`,
  `GridEngine`, et `FormulaEngine` (optionnel).

## Validation de cellule
### Rôle
Exécuter le `cellValidator` de chaque colonne contre les données
courantes, accumuler les résultats dans une
`Map<"rowIndex:field", CellError>`, et exposer un compteur ainsi qu'une
recherche par cellule pour que la couche de rendu puisse peindre les
états d'erreur et que l'hôte puisse conditionner les actions de
sauvegarde.

### Contrat de comportement
- `validateAll(data?)` parcourt chaque ligne × chaque colonne dotée d'un
  validateur.
  - Vue : `data` est optionnel ; lorsqu'omis, lit `state.sourceData`.
    Retourne le compte d'erreurs résultant (`number`) — parité Angular.
  - Angular : `validateAll(data)` exige la slice (retourne `void`, le
    compte d'erreurs se lit sur le signal).
- `validateCell(rowIndex, field, value, row)` revalide une seule cellule
  et met à jour la map. Lorsque la colonne n'a plus de validateur, toute
  erreur préexistante pour cette cellule est supprimée.
- Format de clé de la map d'erreurs : `` `${rowIndex}:${field}` `` (string).
- Le moteur est **passif** : il ne recalcule que sur appels explicites à
  `validateAll` / `validateCell`. Le câblage sur changement de
  `sourceData` ou après `cellEdit` est laissé au choix de l'hôte (les
  consommateurs opt-in sur le coût).
- Signature de validateur : `(value, row) => CellError | null` (ou
  `true | false | string` dans le chemin d'édition inline de Vue —
  coercé par le moteur d'édition inline pour peupler `validationError`
  et rejeter le commit).

### API publique
| Préoccupation | Surface |
|---|---|
| Inputs / props | par colonne : `cellValidator: (value, row) => CellError \| null` |
| Outputs / events | (aucun — état purement dérivé) |
| Impératif | `validateAll(data?): number` (Vue) / `validateAll(data): void` (Angular), `validateCell(rowIndex, field, value, row)`, `getCellError(rowIndex, field)`, `hasCellError(rowIndex, field)`, `clearAll()` |
| État dérivé | `cellErrors: Map<string, CellError>`, `errorCount: number` |

### Contrat d'implémentation (interne)
- État détenu : `cellErrors`, `errorCount` (computed).
- Lectures : `columnDefMap`, optionnellement `sourceData`.
- Aucun contrat d'invalidation de cache au-delà de la réactivité propre
  à la map.

### Mapping Vue
- Fichier : `apps/grid-vue/src/components/Grid/features/useCellValidationEngine.ts`
- Composable : `useCellValidationEngine(state)`
- `validateAll` retourne un `number` (parité Angular sur le retour).

### Mapping Angular
- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/cell-validation.engine.ts`
- Engine : `CellValidationEngine`
- `validateAll(data: T[]): void` — l'appelant lit ensuite `errorCount()`.

## Undo / redo (historique)
### Rôle
Maintenir des piles past/future de groupes de changements de cellules
pour que l'utilisateur puisse faire Ctrl+Z / Ctrl+Y sur ses éditions.
Les entrées d'historique sont à granularité grossière : une opération
par action utilisateur (un paste de N cellules est une seule opération
`'paste'` à N changements).

### Contrat de comportement
- Forme d'une opération :
  `{ type: HistoryOpType, changes: HistoryCellChange[], timestamp }`
  avec `HistoryCellChange = { rowIndex, field, before, after }`.
- `HistoryOpType` couvre : `'edit'`, `'paste'`, `'cut'`, `'fill'`,
  `'delete'`, `'fill-down'`, `'fill-right'`, `'fill-selection'`.
- Taille de pile plafonnée à `MAX_HISTORY = 50` opérations pour borner
  les payloads localStorage. Les opérations les plus anciennes sont
  silencieusement abandonnées lorsque le plafond est atteint.
- `record(type, changes)` empile sur `past`, vide `future`.
- `undo()` dépile `past`, appelle
  `clipboard.applyChanges(op.changes, 'before')`, empile sur `future`.
  `redo()` est l'inverse avec `'after'`.
- `attach(gridId: string | null)` active la persistance localStorage
  sous la clé `adeo-grid-history:<gridId>`. Le détachement (`null`)
  vide les piles. À l'attachement, les piles précédentes sont
  restaurées. Les échecs de quota / storage désactivé sont
  silencieusement avalés.
- `clear()` vide les deux piles et l'entrée localStorage.

### Périmètre de ce qui est enregistré
- ✅ Commits d'édition inline mono-cellule (`'edit'`).
- ✅ Opérations de fill en masse (`'fill-down'`, `'fill-right'`,
  `'fill-selection'`).
- ✅ Paste (`'paste'`).
- ✅ Cut (`'cut'`).
- ✅ Delete / clear-range (`'delete'`).
- ❌ Suppression de ligne / insertion de ligne — HORS du périmètre
  actuel de l'historique.
- ❌ Mutations d'état de colonne (sort, filter, group, resize, reorder)
  — hors périmètre ; cela appartient au moteur de state-persistence,
  pas à l'historique.
- ❌ Changements de sélection / focus — jamais enregistrés.

### API publique
| Préoccupation | Surface |
|---|---|
| Inputs / props | `historyEngine.attach(persistKey)` — opt-in localStorage |
| Outputs / events | (aucun — l'hôte câble undo/redo sur Ctrl+Z/Y via le moteur clavier) |
| Impératif | `attach(gridId)`, `record(type, changes)`, `undo()`, `redo()`, `clear()`, `canUndo`, `canRedo` |

### Contrat d'implémentation (interne)
- État détenu : `past: HistoryOp[]`, `future: HistoryOp[]`.
- Dépend de `ClipboardEngine.applyChanges(changes, direction)` pour
  appliquer / désappliquer les changements — le moteur d'historique ne
  touche jamais `sourceData` directement.
- Clé de persistance : `adeo-grid-history:<gridId>`.

### Mapping Vue
- Fichier : `apps/grid-vue/src/components/Grid/features/useHistoryEngine.ts`
- Composable : `useHistoryEngine(clipboard)`

### Mapping Angular
- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/history.engine.ts`
- Engine : `HistoryEngine` — injecte `ClipboardEngine`.

## Presse-papier
### Rôle
Copier le range courant en TSV, couper avec un contour marching-ants,
coller des TSV / des valeurs brutes (avec tuilage à la Excel lorsque
les dimensions de la source divisent la sélection), vider un range, et
appliquer les groupes de changements stockés par le moteur
d'historique en undo/redo.

### Contrat de comportement
- **Copy** (`extractTsv(range)`) — parcourt le range ligne par ligne,
  lit chaque cellule via `def.valueGetter ?? row[field]`, échappe
  chaque valeur RFC-4180 (wrappe en `"…"` et double les guillemets
  internes lorsqu'elle contient tab / newline / quote). Retourne
  `string[][]`.
- **Cut** — émet le même TSV qu'un copy ; en plus, `markCut(range)`
  fixe `state.cutSource` afin que le body peigne un contour
  marching-ants via `cutEdges(row, col)`. Le cut est effacé au prochain
  paste ou via `clearCut()` explicite.
- **Paste** (`applyPaste(range, pasteRows)`) —
  - **Règle de tuilage (B20)** : lorsque le bloc source est exactement
    1×1, OU lorsque les dimensions de la sélection sont des multiples
    entiers des dimensions du bloc source, la source est tuilée pour
    remplir la sélection. Sinon la source est collée telle quelle à
    partir de `range.start`.
  - Chaque cellule passe par `coerceAndValidate(field, raw, row)` :
    - Retourne `PASTE_SKIP` (un symbole unique) lorsque la colonne est
      non éditable, que la valeur ne peut pas être coercée
      (par ex. `"abc"` pour `'number'`), ou que le validateur la rejette.
    - Coerce `'number'`, `'checkbox'`, `'select'` (whitelist via
      `cellEditorOptions`), `'custom'` (whitelist si `cellEditorOptions`
      fourni, sinon passthrough).
    - Sur input `null`, coerce vers une valeur de clear adaptée au type
      (`null` pour number, `false` pour checkbox, `''` sinon).
- **Parsing TSV** (`parseTsvRow(line)`) — champs quotés RFC-4180, tabs
  intégrés, newlines, échappements de doubles guillemets.
- **`applyChanges(changes, 'before' | 'after')`** — le hook
  d'historique. Groupe les changements par ligne, les applique en une
  seule mise à jour immutable de `sourceData`. N'incrémente jamais
  `dataVersion` lui-même en Vue (le graphe de signaux Angular gère
  l'invalidation ; en Vue, les appelants qui utilisent `applyChanges`
  passent par l'hôte qui n'a pas besoin du bump car
  `sourceData.value = updated` est déjà un changement d'identité de
  tableau).
- **Clear range** (`clearRange`) — exécute
  `coerceAndValidate(field, null, row)` par cellule. Retourne les
  changements d'historique pour que l'appelant les enregistre.

### API publique
| Préoccupation | Surface |
|---|---|
| Inputs / props | par colonne : `editable`, `cellEditor`, `cellEditorOptions`, `cellEditorValidator`, `allowFormula` |
| Outputs / events | l'hôte émet `cellEdit` pour chaque changement de l'ensemble résultant ; aucun événement spécifique au presse-papier |
| Impératif | `markCut(range)`, `clearCut()`, `fillDown(range)`, `fillRight(range)`, `fillSelection(range, value)`, `clearRange(range)`, `applyPaste(range, pasteRows)`, `applyChanges(changes, direction)`, `coerceAndValidate(field, raw, row)`, `extractTsv(range)`, `parseTsvRow(line)`, `cutEdges(row, col)` |
| État dérivé | `cutRange: CellRange \| null` |

### Contrat d'implémentation (interne)
- Signal d'état détenu : `cutSource`.
- Lectures : `visibleColumns`, `columnDefMap`, `sourceData`,
  `displayIndexToSourceIndex` (ligne d'affichage → index du tableau
  source).
- Toutes les écritures passent par `sourceData.value = [...updated]`
  (Vue) ou `state.sourceData.update(...)` (Angular). Les deux formes
  produisent un remplacement immutable que le graphe signal/computed
  capte.

### Mapping Vue
- Fichier : `apps/grid-vue/src/components/Grid/features/useClipboardEngine.ts`
- Composable : `useClipboardEngine(state, displayIndexToSourceIndex)`

### Mapping Angular
- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/clipboard.engine.ts`
- Engine : `ClipboardEngine`

## Clavier
### Rôle
Dispatcher chaque événement clavier hors édition vers le moteur de
sélection de cellule, vers les actions clipboard / historique
enregistrées par l'hôte, ou vers le moteur d'édition inline (pour
typing-to-edit / Enter / F2). Lorsque la grille est en mode édition
(`cellEditState.editingCell !== null`), le moteur clavier
**ne s'exécute pas** — l'éditeur s'approprie les touches.

### Contrat de comportement

| Touche | Plain | Shift | Ctrl/Cmd | Ctrl+Shift |
|---|---|---|---|---|
| `Arrow*` | `moveUp/Down/Left/Right` | `extendRangeBy(±1, 0/0, ±1)` | `jumpToEdge(dir)` | `extendRangeJumpToEdge(dir)` |
| `Home` | `moveToRowStart` | `extendRangeToRowStart` | `moveToGridStart` | `extendRangeToGridStart` |
| `End` | `moveToRowEnd` | `extendRangeToRowEnd` | `moveToGridEnd` | `extendRangeToGridEnd` |
| `PageUp` / `PageDown` | `movePage(dir)` | `extendRangeByPage(dir)` | — | — |
| `Tab` | `moveRight` | `moveLeft` | — | — |
| `Enter` | démarre l'édition (si éditable) sinon `moveDown` | démarre l'édition / `moveUp` | — | — |
| `F2` | démarre l'édition | — | — | — |
| `Escape` | `clearFocus` | — | — | — |
| `Space` | — | `selectRow(focused.row)` | `selectColumn(focused.col)` | `selectAll()` |
| `Delete` / `Backspace` | `deleteRange` | — | — | — |
| `C` | — | — | `copy` | — |
| `V` | — | — | `paste` | — |
| `X` | — | — | `cut` | — |
| `Z` | — | — | `undo` | `redo` |
| `Y` | — | — | `redo` | — |
| `A` | — | — | `selectAll` | — |
| `D` | — | — | `fillDown` | — |
| `R` | — | — | `fillRight` | — |
| imprimable | typing-to-edit → `startEdit(row, col, char)` | — | — | — |

- Test d'imprimable : `event.key.length === 1`, code de caractère
  `≥ 32`, pas `127`, pas en `isComposing` (sécurisé pour IME).
- Tab se déplace à travers *toutes* les colonnes visibles, pas
  uniquement les éditables — pour un Tab-through-editables utiliser
  `moveToNextEditableCell()` du moteur de sélection de cellule.
- Enter sur une colonne éditable démarre l'édition ; sur une colonne
  non éditable il descend (ou monte avec Shift). Le commit / cancel
  Enter côté éditeur est détenu par `<adeo-grid-cell>` / le composant
  body, pas par le moteur clavier.

### Marge de confort (auto-scroll pendant la navigation clavier)
- Lorsque la navigation clavier déplace la cellule focalisée vers une
  ligne située dans le viewport mais proche de son bord supérieur ou
  inférieur, l'hôte auto-scrolle pour que la cellule focalisée se
  retrouve avec une marge de confort verticale de N lignes sous le
  chunk sticky du haut et au-dessus du bord inférieur.
- Confort horizontal : lorsque des colonnes pinned left existent,
  l'auto-scroll prend en compte leur largeur cumulée afin que la
  cellule focalisée ne se retrouve pas visuellement sous le chunk
  pinned. Même logique pour les colonnes pinned right.
- C'est une préoccupation de scroll au niveau de l'hôte (elle vit dans
  `scrollCellIntoView` de `Grid.vue` et son équivalent Angular),
  pas dans le moteur clavier lui-même.

### API publique
| Préoccupation | Surface |
|---|---|
| Impératif | `registerActions(actions: KeyboardActions)`, `setCellSelection(actions: CellSelectionActions)` (Vue uniquement — Angular injecte `CellSelectionEngine` directement), `handleKeydown(event)` |
| `KeyboardActions` requises (fournies par l'hôte) | `copy`, `paste`, `cut`, `deleteRange`, `undo`, `redo`, `fillDown`, `fillRight`, `startEdit(row, col, initialChar?)` |

### Contrat d'implémentation (interne)
- État observé : `cellEditState` (pour sortir en mode édition),
  `focusedCell`, `visibleColumns`, `columnDefMap` (pour vérifier
  l'éditabilité sur Enter).
- Ne détient aucun état ; pur dispatcher.
- L'interface `CellSelectionActions` est la couche d'abstraction côté
  Vue (elle laisse le moteur clavier fonctionner aussi bien contre le
  moteur que contre un adaptateur legacy) ; Angular injecte le
  `CellSelectionEngine` concret.

### Mapping Vue
- Fichier : `apps/grid-vue/src/components/Grid/features/useKeyboardEngine.ts`
- Composable : `useKeyboardEngine(state, inlineEdit, initialCellSelection?)`

### Mapping Angular
- Fichier : `apps/grid-angular/projects/grid-angular/src/lib/grid/features/keyboard.engine.ts`
- Engine : `KeyboardEngine` — injecte `CellSelectionEngine`,
  `InlineEditEngine`, `GridStateManager`.

## Invariants inter-features

- **Bump de `dataVersion`** : toute mutation in-place DOIT incrémenter
  `state.dataVersion` côté Vue. Chemins concernés : `applyFills` (hôte),
  commit de la poignée de remplissage, clear en masse, paste via
  l'hôte. Le commit d'édition inline utilise un remplacement immutable
  de `sourceData` et n'a pas besoin du bump. Angular n'a pas de
  compteur équivalent.
- **L'historique enregistre des changements, pas un état** : l'undo
  rejoue le `HistoryCellChange[]` contre `sourceData` via
  `ClipboardEngine.applyChanges`. Sélection, focus, sort, filter,
  group, et état de colonne ne font JAMAIS partie de l'historique.
- **Idempotence de `focusCell`** : requise pour casser la récursion de
  watcher Vue (`onActivateCell` sync + `watch(activeCell)` async). Le
  garde-fou vérifie même `row`/`col` ET état transitoire propre
  (`frozenRanges` vide, `cellRange === null`, `!isDragging`) avant de
  court-circuiter.
- **`extendRangeTo(row, col)` est l'unique API d'extension ancrée**.
  Shift+Click (souris, sans drag) et Shift+Arrow (clavier) l'appellent
  tous deux. Les chemins drag-only utilisent `extendRange(row, col)`
  qui court-circuite sur `!isDragging`.
