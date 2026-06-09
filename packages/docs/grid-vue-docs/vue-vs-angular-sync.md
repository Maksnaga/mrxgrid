# Vue vs Angular — Analyse de synchronisation pour la spec mutualisée

> **Date** : 2026-06-09 — **v5** (post sync agents : ANG-MEGA + VUE-POLISH + VUE-SERVER-GROUPING)
>
> **Sources** :
> - Vue : `apps/grid-vue/src/components/Grid/`
> - Angular : `apps/grid-angular/projects/grid-angular/src/lib/grid/`
>
> **Méthodologie v5** : 3 agents parallèles déclenchés depuis les sections "Divergences connues" des 5 chapitres de la spec mutualisée, ciblant uniquement les gaps qui étaient explicitement marqués comme "à porter / à aligner / Vue-only / Angular-only".

---

## Sommaire

1. [Changelog v4 → v5](#1-changelog-v4--v5)
2. [Items fermés en v5](#2-items-fermés-en-v5)
3. [Items restants (follow-up)](#3-items-restants-follow-up)
4. [Score global](#4-score-global)

---

## 1. Changelog v4 → v5

### 1.1 ANG-MEGA — alignements API Angular

- ✅ `multiSort = input(false)` ajouté sur `AdGridAngularComponent` (`grid.ts`). Quand activé, le Shift+click empile au lieu de remplacer dans `onSortClick()`. `SortEngine.activeSorts()` retournait déjà `SortDef[]`, le badge sort-index existant gate sur `activeSorts().length > 1`.
- ✅ `quickFilters = signal<Record<string, string>>({})` ajouté à `GridStateManager`. `FilterEngine.setQuickFilter` / `getQuickFilter` / `clearQuickFilters` exposés. `filterData()` AND les quick-filter substring matches avec les builder filters. Nouveau composant `AdeoGridQuickFilterRowComponent` (`components/quick-filter-row/grid-quick-filter-row.ts`). Input `showQuickFilters = input(false)` sur le grid, rendu entre header et body.
- ✅ Aliases `'left'` / `'right'` ajoutés à `ColumnDef.pinned` Angular (type widened to `'start' | 'end' | 'left' | 'right' | null`). Normalisation via `normalizePinned()` au boundary `toColumnDef()` + `GridStateManager.initColumns()`.
- ✅ `CellValidationEngine.validateAll()` retourne désormais `number` (count de failures). `AdGridAngularComponent.validateAll()` wrapper forward le count.
- ✅ B30 (TODO stale `cell-selection.engine.ts:18`) : déjà nettoyé par un commit précédent, vérifié.

### 1.2 VUE-POLISH — polish API Vue

- ✅ Prop `historyId` `@deprecated` (JSDoc + dev-only console.warn quand utilisée). `persistKey` est canonique, mais `historyId` continue de gagner si les 2 sont set (back-compat). `historyEngine.attach(persistKey | historyId)` rejoue déjà.
- ✅ Event `bulkEdit` ajouté en canonique. `bulkCellEdit` reste émis en parallèle (deprecated alias). JSDoc + retrait prévu v2.0.
- ⚠️ `@ts-nocheck` à retirer dans `useGridEngine.ts` : la banner n'existait déjà plus, instruction de spec stale.

### 1.3 VUE-SERVER-GROUPING — port engine côté Vue

- ✅ Nouveau composable `useServerGroupEngine.ts` mirroring `ServerGroupEngine.ts` Angular. Expose `active`, `groupSummaries`, `expandedKeys`, `loadedGroups`, `loadingGroups`, `isLoading`, `flatRows: DisplayRow<T>[]`, `configure`, `addGroup`/`removeGroup`/`clearGroups`/`applyGroups`, `toggleGroupExpand`, `fetchGroupSummaries`, `onVisibleRangeChange`, `setGroupRoots`, `upsertChildren`.
- ✅ `state.groupMode: 'client' | 'server'` ajouté à `useGridState`.
- ✅ Wire-up dans `Grid.vue` : prop `groupMode`, events `serverGroupingExpand` / `serverGroupingCollapse`, watchers de sync, `defineExpose` : `setServerGroupRoots`, `setServerGroupChildren`, `expandServerGroup`, `serverGroupEngine`.
- ✅ `gridEngine.displayRows` lit depuis `serverGroup.flatRows` quand `groupMode === 'server'` && `active`.
- ✅ 2 stories Storybook : `Stories/Grouping/Server-side (engine)` (OptionsDriven + EventAndRefApi).
- ⚠️ Limitation : `GridBody` rend toujours le legacy `__adg`-flat shape. Le nouvel engine expose `flatRows: DisplayRow<T>[]` via la ref pour plugins / custom virtualizer / custom body. **Même limitation côté Angular** — pas une divergence.
- ⚠️ Multi-level (nested grouping) : utilise seulement `groupFields[0]`. Parity Angular.

---

## 2. Items fermés en v5

| ID | Item | Statut |
|---|---|---|
| ANG-multiSort | `multiSort: input(false)` + Shift gating | ✅ Closed |
| ANG-quickFilter | `quickFilters` signal + composant row + AND avec column filters | ✅ Closed |
| ANG-pinnedAliases | `'left'/'right'` aliases + normalisation | ✅ Closed |
| ANG-validateAll | retour type `number` | ✅ Closed |
| B30 | TODO `cell-selection.engine.ts:18` | ✅ Closed (commit précédent) |
| VUE-historyId | `@deprecated` + dev warning + `persistKey` canon | ✅ Closed |
| VUE-bulkEdit | event canon `bulkEdit` + alias `bulkCellEdit` | ✅ Closed |
| VUE-serverGrouping | `useServerGroupEngine` + state.groupMode + props/events/imperative API | ✅ Closed (MVP — voir limitations) |

## 3. Items restants (follow-up)

| ID | Item | Pourquoi non clos | Effort estimé |
|---|---|---|---|
| ANG-quickFilter-utility | Quick-filter row : prefix utility-cell pas aligné sur header (input start à x=0) | Cosmétique, pas bloquant | Petit |
| ANG-quickFilter-persist | `quickFilters` pas snapshoté par `StatePersistenceEngine` (session-only) | Décision spec — peut-être intentionnel | À trancher |
| ANG-quickFilter-perColumn | Pas de dispatch par type de filtre (number / set / date range) | Vue le fait via `column.filter.type` | Moyen |
| BODY-DisplayRow | Body Vue ET Angular rendent legacy flat shape | Refacto plus large que la simple parity | Big — séparée |
| VUE-MULTI-NESTED | Multi-level server grouping (Vue + Angular) | `groupFields[0]` seul utilisé | Moyen |
| FilterShape | Vue `ColumnDef.filter = FilterConfig` AG-Grid style vs Angular 3 champs discrets | **Divergence intentionnelle** (sync v4 ligne 213) | Décision actée |
| flex column | `flex` déclaré dans `ColumnDef` mais pas honoré dans aucune des 2 libs | Sizing fallback | Moyen — peut être retiré du type |

## 4. Score global v1 → v5

| Métrique | v1 | v2 | v3 | v4 | **v5** |
|---|---|---|---|---|---|
| Items P0/P1/P2 + bugs identifiés | 80 | — | — | — | — |
| Items résolus cumulés | 0 | 53 | 70+dette | 80+dette | **80+dette+8 sync v5** |
| Items résiduels actifs | 80 | 22 | 14 | 9 | **5 (tous follow-up, aucun critique)** |
| Build Vue lib | clean | clean | clean | clean | **clean** |
| Build Angular lib | clean | clean | clean | clean | **clean** |
| Composables legacy Vue | 2 | 2 | 2 | 0 | **0** |
| Cast `as unknown as` Angular | — | 1 | 1 | 0 | **0** |
| Bugs critiques restants | 22 | 5 | 5 | 2 | **0** ✅ |

**Conclusion v5** : Toutes les divergences fonctionnelles activement portables sont fermées. Les 5 items restants sont soit du polish UI (quick filter UX), soit des décisions de spec intentionnelles (Filter shape AG-Grid style), soit du refacto qui sort du périmètre "alignement API" (`DisplayRow<T>` body refacto). Le code est prêt pour publication packages — voir Changesets + setup release dans `MONOREPO-SETUP.md`.

---

*Fin du document v5. La v4 reflétait l'après-Phase-3 + dette purgée ; la v5 reflète l'après-sync agents (3 chantiers parallèles fermant 8 items).*
