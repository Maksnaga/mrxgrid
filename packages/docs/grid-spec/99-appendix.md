# Appendix

## A. Glossaire des termes

| Terme | Définition |
|---|---|
| **Engine** | Classe Angular ou composable Vue qui encapsule la logique d'une feature. Lit et mute l'état via `GridState`. Ne se connaît pas entre engines sauf via signals. |
| **GridState** | Source de vérité unique des signals du grid. Vue : objet retourné par `useGridState()`. Angular : instance `GridStateManager`. |
| **`dataVersion`** | Compteur incrémenté à chaque mutation sémantique des rows. Sert d'invalidation O(1) pour les caches de filter / sort / group / group-server. Ne pas confondre avec `version` de `<input v-model>`. |
| **`focusCell` idempotent** | Garantie qu'un re-appel de `focusCell(r, c)` sur la cellule déjà active ne déclenche pas de watcher infini. Voir VUE-DEBT-1 et `useCellSelectionEngine.focusCell`. |
| **`extendRangeTo(row, col)`** | Méthode de l'engine cell-selection qui étend la sélection range jusqu'à `(row, col)` depuis le pivot actif. Symétrique entre Vue et Angular depuis VUE-DEBT-1. |
| **`valueGetter`** | Fonction column-level qui extrait la vraie valeur d'une cellule depuis la row source. Le startEditing, clipboard copy, et fill handle DOIVENT passer par `valueGetter` — pas par `row[field]`. |
| **`pendingCells` / `pendingRows`** | Inputs qui marquent des cells/rows en état "en cours de mutation" → affichage shimmer granulaire au lieu du skeleton plein écran. |
| **`refreshing`** | Prop qui demande un refresh silencieux sans skeleton plein écran. Réservé aux refetch après commit. |
| **`loading`** | Prop qui demande le skeleton plein écran. Réservé au premier fetch et aux fetches complets. |
| **`Column` / column definition** | Vue : composant child contenu dans `<ad-grid-vue>`. Angular : objet TS dans le tableau d'input `columns`. Modèles équivalents : `GridColumn<T>`. |
| **DisplayRow** | Union discriminée des rows visibles : data row, group root, group child, tree node, detail row, skeleton. |
| **Pinned column** | Colonne figée à gauche ou à droite, hors zone de virtualisation horizontale, sticky en CSS. |
| **`primeExpanded(idx, defaultHeight)`** | Pré-réserve un offset virtuel pour une detail row d'index `idx` avec une hauteur estimée. Utile avant que le `ResizeObserver` ait mesuré la vraie taille. |
| **`lastResizeEndedAt`** | Timestamp poussé par `column-resize.engine` quand un drag de resize termine. Lu par `sort.engine` pour ignorer le click `mouseup` qui pourrait déclencher un tri parasite. |
| **Brand preset** | Theme Mozaic (LeroyMerlin / Adeo / Bricocenter / MBrand). Pose `--font-family`, `--color-*`, etc. via `@mozaic-ds/tokens/<brand>/theme`. Voir le chapitre Theming & API. |
| **A1↔storage** | Mécanisme du formula engine qui convertit les références A1 (`B12`) en clés de storage (`{rowId, field}`) et inversement, au moment du commit dans `useInlineEditEngine.ts` / `inline-edit.engine.ts`. |
| **Server mode** | Pour sort, filter, group, pagination : mode dans lequel la lib émet un event et délègue le calcul au backend. La lib n'applique alors aucune transformation locale. |
| **Streaming export** | Export d'un grand dataset en plusieurs chunks via générateur, sans bloquer le main thread. Fallback synchrone pour les petits datasets. |

## B. Versioning de la spec

Cette spec suit une version **indépendante** des versions npm `@adeo/grid-vue` et `@adeo/grid-angular`.

| Version spec | Date | Changement majeur |
|---|---|---|
| 1.0 | 2026-06-08 | Rédaction initiale après extraction monorepo, sync v4, dette technique purgée |

### Quand bumper la spec

| Type de changement | Bump |
|---|---|
| Ajout d'une feature (nouvelle section) | Minor |
| Modification d'un comportement public garanti | Major |
| Correction d'erreur de description, ajustement de wording | Patch |

La spec ne casse jamais — elle décrit ce qui DOIT être vrai. Si une lib publie un breaking, c'est la **lib** qui bump major, et la spec se met à jour avec la nouvelle attente.

## C. Comment contribuer à cette spec

1. **Quand tu ajoutes une feature** dans une des deux libs, ouvre la section correspondante de la spec dans la même PR.
2. **Quand tu changes l'API publique** d'une feature, mets à jour la section « Public API » du chapitre concerné ET la section « Public API canonique » du chapitre Theming & API.
3. **Quand tu modifies un invariant** (`dataVersion`, idempotence, etc.), mets à jour le glossaire (Section A) et le chapitre concerné.

### Style guide

- Pas de marketing fluff.
- Pas de « we », pas de « notre lib » — formulation impersonnelle : « le grid », « la lib ».
- Noms de fichiers et de méthodes en `code formatting`.
- Tables Markdown pour toute énumération de plus de 3 items.
- Diagrammes en ASCII art (pas d'images SVG dans le master — elles ne survivraient pas à un re-render MDX).
- Anchors explicites sur tous les H2 (`## Foo { #foo }`) pour permettre le linkage cross-chapter.

## D. Sources et matériel scanné

### Code source

- Vue : `apps/grid-vue/src/components/Grid/` au commit du 8 juin 2026
  - 21 composables `features/use*Engine.ts`
  - 1 fichier d'état `state/useGridState.ts`
  - 1 orchestrateur `engine/useGridEngine.ts`
  - ~40 composants UI dans `components/`
- Angular : `apps/grid-angular/projects/grid-angular/src/lib/grid/` au commit du 8 juin 2026
  - 23 classes `features/*.engine.ts`
  - 1 classe d'état `state/grid-state.ts` (`GridStateManager`)
  - 1 orchestrateur `engine/grid-engine.ts`
  - ~50 composants Angular dans `components/`

### Doc connexe

- `packages/docs/runbook.md` — runbook quotidien
- `packages/docs/portal/tutorial/*.md` — tutoriels mutualisés Vue + Angular (rendus dans le portail Storybook)
- `packages/docs/portal/guide/*.md` — guides conceptuels mutualisés

### Méthodologie

5 agents en parallèle, chacun sur un domaine fonctionnel, scan croisé Vue + Angular avec lecture des fichiers source + types TypeScript. Synthèse manuelle pour l'introduction, le glossaire, et l'index master.

---

*Fin de la spec. Pour les évolutions, ouvrir une PR qui modifie le chapitre concerné et incrémente la version dans la table de la Section C.*
