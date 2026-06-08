# Vue vs Angular — Analyse de synchronisation pour la spec mutualisée

> **Date** : 2026-06-08 — **v4** (après Phase 1+2+3 + dette technique purgée)
>
> **Sources** :
> - Vue : `mrxgrid/src/components/AdeoGrid/` + `mrxgrid/src/composables/`
> - Angular : `mozaic-ng/projects/mozaic-ng/src/lib/grid/`
>
> **Méthodologie v4** : 5 agents thématiques en parallèle, après les 4 vagues de fixes (Phase 1, 2, 3 + dette).
>
> **Surprises v4** : 2 bugs critiques découverts (fixes B23 et B26 incomplets en pratique malgré les rapports d'agents).

---

## Sommaire

1. [Changelog v3 → v4](#1-changelog-v3--v4)
2. [Bugs critiques découverts en v4](#2-bugs-critiques-découverts-en-v4)
3. [État global](#3-état-global)
4. [Matrice résiduelle](#4-matrice-résiduelle)
5. [Divergences résiduelles classées](#5-divergences-résiduelles-classées)
6. [Todo Phase 4](#6-todo-phase-4)

---

## 1. Changelog v3 → v4

Phase 3 + dette ont livré **17/17 items** prévus. Bilan détaillé :

### 1.1 Phase 3 Vue livrée ✅

- ✅ B25 sort guard wire engine (`lastResizeEndedAt` ajouté à `GridState`, lu en parallèle du legacy `wasResizingRecently()`).
- ✅ Item 7 `pendingRows` input séparé (alias `pendingRowIds` deprecated).
- ✅ Item 8 `validateAll() → number`.
- ✅ Item 11 `filterEvent: FilterEvent` typé event ajouté (`filterChange` legacy `@deprecated`).
- ✅ Item 13 `SortDirection` confirmé non-nullable, `| null` explicite aux endroits utiles.
- ✅ Item 14 `DataDensity` aliased deprecated → `GridDensity`.
- ✅ Item 12 `MAX_WIDTH` autosize configurable via `UseAutosizeOptions.maxWidth`.
- ✅ Item 6 `pageChange` `startIndex/endIndex` déjà OK depuis phase précédente.

### 1.2 Phase 3 Angular livrée ✅ (sauf wires incomplets)

- ⚠️ **B23 detail row scrollbar wire** — `VerticalVirtualScrollEngine.rebuildOffsets` lit bien `expandableRowEngine.getExtraHeightForKey(rowKey)`, MAIS **le template `grid-body.html` ne passe pas `[rowKey]` à `moz-grid-detail-row`** → le ResizeObserver dans le composant a `key = ''` et la guard `if (!key) return` bloque toute écriture dans la Map → scrollbar reste déréglé en pratique. Voir B28.
- ⚠️ **B26 autosize via kebab** — items ajoutés dans `grid-header-cell.ts:menuItems()`, MAIS **le composant alternatif `grid-header-menu.ts` (utilisé pour le menu kebab dropdown) ne génère pas ces items** dans son propre computed `menuItems`. Voir B29.
- ✅ B27 TODO obsolète column-resize supprimé.
- ✅ Item 9 `primeExpanded(idx, defaultHeight = 200)` param.
- ✅ Item 10 `allSelectedCount` deprecated en alias de `count`.
- ✅ Item 12 `MAX_WIDTH` configurable via options sur `autosizeColumn/All`.
- ✅ Item 11 `filterChange` typé `FilterEvent` déjà aligné.

### 1.3 Dette technique purgée ✅

- ✅ **VUE-DEBT-1** — `composables/useCellSelection.ts` et `useFillHandle.ts` SUPPRIMÉS. Migration complète vers `cellSelectionEngine`. Méthode `extendRangeTo(row, col)` ajoutée à l'engine Vue.
- ✅ **VUE-DEBT-2 Partie A** — Formula A1↔storage portée dans `useInlineEditEngine.ts` (param `formulaEngine?`). Watcher supprimé de `AdeoGrid.vue`. Spec test créée.
- ✅ **VUE-DEBT-2 Partie B** — `dataVersion` audit, Option B retenue (documentation propre) car Option A immutable serait O(N) inadmissible sur 100k rows. TSDoc canonique écrit.
- ✅ **ANG-DEBT** — `ServerGroupEngine.flatRows()` retourne `DisplayRow<T>[]` proprement, cast `as unknown as` supprimé dans `grid-engine.ts`.

---

## 2. Bugs critiques découverts en v4

### B28 — Angular detail row scrollbar : wire incomplet (régression apparente du fix B23)

**Symptôme réel** : malgré le fix Phase 3 (B23), le scrollbar virtuel n'est pas calibré correctement sur les detail rows de hauteur variable.

**Cause profonde** :
1. `MozGridDetailRowComponent` (`grid-detail-row.ts`) :
   - Accepte un input `rowKey = input<string>('')` (Round 2 ANG-WIRE).
   - Le `ResizeObserver` callback lit `const key = this.rowKey()` et `if (!key) return` avant d'appeler `measureRow`.
2. Le template `grid-body.html` ligne 34-39 instancie `<moz-grid-detail-row>` **mais ne passe jamais `[rowKey]`**.
3. Résultat : `key === ''` → guard bloque tout → `ExpandableRowEngine.measuredRowHeights` reste vide → `VerticalVirtualScrollEngine.rebuildOffsets` lit `getExtraHeightForKey()` qui retourne `0` → scrollbar mal calibré.

**Fix** : dans `grid-body.html`, calculer `rowKey` depuis `displayRow.data[state.rowIdField()]` et le binder sur `<moz-grid-detail-row [rowKey]="...">`.

**Effort** : ~5 lignes.

### B29 — Angular autosize kebab : items manquent dans `grid-header-menu.ts`

**Symptôme** : malgré le fix Phase 3 (B26), l'utilisateur ne peut toujours pas autosizer une colonne via le kebab Angular.

**Cause profonde** :
1. B26 a ajouté les items `'autosize-this' | 'autosize-all'` dans le computed `menuItems()` de `grid-header-cell.ts`.
2. Mais il existe un **second composant** `grid-header-menu.ts` (utilisé pour le dropdown réel du kebab dans certaines configurations) qui a son propre computed `menuItems()` (lignes 44-103) — **et celui-là ne génère pas les items autosize**.
3. Selon le code path actif, c'est l'un ou l'autre qui est rendu.

**Fix** : dans `grid-header-menu.ts:menuItems`, ajouter les deux items `autosize-this` et `autosize-all` sur le modèle de `grid-header-cell.ts`.

**Effort** : ~8 lignes.

### B30 — Angular TODO stale dans `cell-selection.engine.ts:18`

**Symptôme** : commentaire trompeur disant que `grid-cell.ts` doit appeler `addRange(range)` sur Ctrl+Click, alors que c'est déjà fait à la ligne 360.

**Fix** : supprimer le TODO.

**Effort** : 1 ligne.

---

## 3. État global

**Score** : ~99% de parité atteinte. Compilation propre des deux côtés. Rendu visuel localhost:5173 OK.

**Surprises v4** : les fixes Phase 3 ANG-A/ANG-WIRE pour B23 et B26 étaient incomplets — la moitié du wire avait été faite, l'autre moitié dans un autre fichier était passée entre les mailles.

**Conséquence pratique** :
- B28 → scrollbar Angular sur expand rows reste cassé fonctionnellement (l'utilisateur le ressent).
- B29 → autosize Angular reste inaccessible via le kebab (mais l'API impérative `grid.autosizeColumn()` fonctionne).

Tout le reste est aligné ou divergence intentionnelle documentée.

---

## 4. Matrice résiduelle

> Légende : ✅ aligné · ⚠️ partiel · ❌ wire/feature manquant

### 4.1 Bugs critiques restants

| # | Feature | Statut | Effort |
|---|---|---|---|
| B28 | Angular `[rowKey]` binding sur `moz-grid-detail-row` | ❌ | ~5 lignes |
| B29 | Angular `grid-header-menu.ts:menuItems` autosize items | ❌ | ~8 lignes |
| B30 | Angular TODO stale `cell-selection.engine.ts:18` | ⚠️ cosmétique | 1 ligne |

### 4.2 Harmonisations API à finaliser

| Feature | Statut | Note |
|---|---|---|
| Vue : `autosizeColumn/All` accept `options?: { maxWidth? }` | ❌ | Angular l'accepte (Phase 3 Item 12), Vue ne propage pas jusqu'à `defineExpose` |
| Vue : sort guard double check (engine + legacy `wasResizingRecently()`) | ⚠️ | Cleanup cosmétique — retirer le legacy maintenant que `useColumnResize.ts` legacy est gone |
| Vue : `pageSize` default explicite à 25 dans la prop | ⚠️ | Angular `input<number>(25)`, Vue tombe dans `usePagination` interne |
| Vue : `PageEvent` model vs emit réel désync | ⚠️ | Model déclare 4 champs, emit en envoie 6 avec `page` au lieu de `pageIndex` |
| Vue : persistance undo/redo localStorage | ❌ | Angular lie `historyEngine.attach(persistKey)`, Vue ne le fait pas |
| Vue : `validateAll()` signature | ⚠️ | Vue accepte `data: unknown[]` en arg, Angular lit `state.sourceData()` en interne |
| Angular : `extendRangeTo(row, col)` | ❌ | Vue l'a (Phase 3), Angular utilise `extendRangeToRowStart/End/GridStart/End` + mouseenter à la place |
| Vue : server grouping | ❌ | `useServerGrouping.ts` absent côté Vue (Angular only) |
| `MAX_WIDTH` autosize default | ⚠️ | Angular 800px, Vue Infinity — décision design |

### 4.3 Parité atteinte ✅

| Catégorie | Détails |
|---|---|
| Data model | `ColumnDef`, `DisplayRow<T>`, `GroupRow<T>`, `rowIdField` aligned |
| Headers | sortIndex badge, kebab filter switch + tooltip, sort guard 200ms |
| Pinned columns | sticky strategy + offsets cumulatifs |
| Virtual scroll | vertical (`primeExpanded(idx, defaultHeight=200)`), horizontal (identique) |
| Sort | `sortChange` event, multi-sort |
| Filter — 3 surfaces | inline + builder + overlay |
| Filter — `FilterModel` shape | aligné |
| Filter — `filterEvent` typé | Vue (Phase 3) + Angular |
| Grouping | client mode, `groupChange` event |
| Server grouping pipeline | Angular OK (dette purgée) — Vue n'en a pas |
| Pagination engine | algorithme identique |
| Row selection engine | aligné, `count` partout |
| Cell selection | engine + multi-range + `extendRangeTo` Vue, addRange aligned |
| Inline editing | formula A1↔storage **dans l'engine des deux côtés** (dette purgée Vue) |
| Clipboard | TSV RFC-4180, tile, shiftIfFormula, fillDown seed |
| Fill handle | engine + DOM tracking |
| Keyboard navigation | parité parfaite raccourcis |
| Undo/redo | `adeo-grid-history:` partout, MAX_HISTORY=50 |
| Formula engine | algo + rowIdResolver + batch + cache + ref highlight exporté |
| Export | streaming TransformStream, `exportJson` public |
| Validation | `cellValidator` passthrough, `validateAll → number` |
| State persistence | `persistKey` partout (Angular garde alias `stateKey` deprecated) |
| Plugin contract | `init({state, engine}) → disposer?`, generic `<T>` |
| Renderers | `defineStatusRenderer` + builtin `'tag'` exportés |
| Imperative API | 33+ méthodes alignées |
| `refreshing` / `pendingCells` / `pendingRows` / `skeletonRowCount` | aligned |
| Density vocab + valeurs | `compact/default/comfortable` 32/48/64 partout |
| Column resize MIN | 50 partout |
| Column reorder | complet |
| Autosize wire + auto-trigger mount | aligné |
| Hide cols `hiddenFieldsChange` output | aligné |
| Row expand auto-measure | Vue OK, **Angular wire cassé (B28)** |
| Tree `expandedByDefault` | aligné |

### 4.4 Composables Vue purgés ✅

| Avant | Après |
|---|---|
| `composables/useCellSelection.ts` (legacy) | ❌ supprimé |
| `composables/useFillHandle.ts` (legacy) | ❌ supprimé |
| `dataVersion` hack | ✅ documenté proprement (Option B retenue) |

---

## 5. Divergences résiduelles classées

### 5.1 ❌ Bugs critiques (P0 Phase 4)

1. **B28** — Angular detail row scrollbar : binding `[rowKey]` manquant dans `grid-body.html`.
2. **B29** — Angular autosize kebab : items manquants dans `grid-header-menu.ts:menuItems`.

### 5.2 ⚠️ Harmonisations API (P1 Phase 4)

3. Vue : propager `options?: { maxWidth?: number }` à `autosizeColumn/All` dans `defineExpose`.
4. Vue : retirer le double check sort guard (drop `wasResizingRecently()` legacy, garder engine uniquement).
5. Vue : aligner `pageSize` default explicite à 25 dans `AdeoGrid.vue` props (TSDoc + valeur).
6. Vue : aligner `PageEvent` model TS sur l'emit réel (ajouter `startIndex/endIndex`, choisir `page` vs `pageIndex`).
7. Vue : persister l'historique undo/redo dans localStorage (`historyEngine.attach(persistKey)` au mount).
8. Vue : harmoniser signature `validateAll()` — soit faire prendre `data?` optionnel à Angular, soit retirer le `data` côté Vue. Recommandation : `validateAll()` no-arg partout (lit le state interne).
9. Angular : ajouter `extendRangeTo(row, col)` dans `CellSelectionEngine` pour parité (utile pour drag-select APIs externes).

### 5.3 ⚠️ Décisions spec / features manquantes

10. **MAX_WIDTH autosize default** : trancher entre 800 (Angular) et Infinity (Vue). Recommandation : 800 (plus défensif).
11. **Server grouping côté Vue** : porter `ServerGroupEngine` Angular → équivalent Vue. Feature manquante structurante.
12. **B30** — TODO stale dans `cell-selection.engine.ts:18` à supprimer.

### 5.4 Items intentionnels documentés

- Custom filter API : `AdeoFilterConfig` Vue vs `MozGridCustomFilter` abstract class Angular — décision actée.
- Custom cell renderer : Vue `renderer: Component` vs Angular `cellTemplate: TemplateRef | Type | 'tag'` — décision actée.
- `selectionModel` / `selectedCount` / `selectionTotalCount` (refs réactives Vue) sans équivalent Angular.
- `useRefHighlight` (Vue composable) vs `FormulaRefHighlightService` (Angular injectable) — sémantique identique.
- `AdeoGridPlugin` (Vue) vs `GridPlugin` (Angular) — nommage divergent intentionnel.
- `dataVersion` hack documenté côté Vue (Option B retenue, rationale dans TSDoc).
- Filter row inline : 3 surfaces Vue (inline + builder + overlay), Angular n'a pas de quick-filter row dans l'engine.

---

## 6. Todo Phase 4

Volume minimal : **2 bugs critiques + 7 harmonisations** = ~9 items, ~30 minutes.

### 6.1 Bugs critiques (à faire en priorité)

1. **B28** Angular : binder `[rowKey]="rowKeyFor(displayRow)"` sur `<moz-grid-detail-row>` dans `grid-body.html` + créer la méthode locale.
2. **B29** Angular : ajouter items `autosize-this/all` dans `grid-header-menu.ts:menuItems` computed.
3. **B30** Angular : supprimer TODO stale ligne 18 de `cell-selection.engine.ts`.

### 6.2 Harmonisations API

4. Vue : `autosizeColumn/All(options?: { maxWidth? })` dans `defineExpose`.
5. Vue : retirer `wasResizingRecently()` du sort guard (engine seul).
6. Vue : `pageSize` default 25 explicite + TSDoc.
7. Vue : aligner `PageEvent` model avec l'emit réel.
8. Vue : persistance historique undo/redo (`historyEngine.attach(persistKey)`).
9. Vue : `validateAll()` no-arg (lit `gridState.sourceData`).
10. Angular : `extendRangeTo(row, col)` dans `CellSelectionEngine`.

### 6.3 Décisions spec (peuvent attendre)

11. `MAX_WIDTH` autosize default : trancher.
12. Server grouping côté Vue : décider porting maintenant ou plus tard.

---

## Score global de la sync — v1 → v2 → v3 → v4

| Métrique | v1 | v2 | v3 | **v4** |
|---|---|---|---|---|
| Items P0/P1/P2 + bugs identifiés | 80 | — | — | — |
| Items résolus cumulés | 0 | 53 | 70+dette | **80+dette** |
| Items résiduels actifs | 80 | 22 | 14 | **9 (dont 2 critiques)** |
| Build Vue lib | clean | clean | clean | **clean** |
| Build Angular lib | clean | clean | clean | **clean** |
| Composables legacy Vue | 2 | 2 | 2 | **0** ✅ |
| Cast `as unknown as` Angular | — | 1 | 1 | **0** ✅ |
| Bugs critiques restants | 22 | 5 | 5 (dont 2 nouveaux v3) | **2 (nouveaux v4)** |

**Conclusion v4** : la dette technique est entièrement purgée. Restent 2 bugs critiques (B28/B29) qui sont des wires incomplets passés entre les mailles du scan v3, et 7 harmonisations API de polish. Phase 4 rapide (~30 min) finit le boulot.

Après Phase 4, la codebase sera **100% prête** pour la rédaction de la spec mutualisée et la mise en monorepo.

---

*Fin du document v4. La v1 couvrait l'audit initial ; v2 reflétait l'après-Phase-1 ; v3 reflétait l'après-Phase-2 ; v4 reflète l'après-Phase-3 + dette purgée, avec 2 bugs résiduels détectés.*
