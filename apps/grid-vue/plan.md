# Plan — Mutualisation documentaire datagrid

> **Objectif.** Une seule source de vérité décrivant **ce que fait** la
> datagrid — séparée des implémentations Angular / Vue / (futur React,
> Svelte, vanilla, …). Quand on ajoute une feature, on l'écrit ici une
> fois ; les frameworks suivent. Quand on lit le code, on a un endroit
> où retrouver la sémantique sans plonger dans 3000 lignes de
> composant.
>
> Ce plan décrit la **forme** de la documentation, pas son contenu. Le
> contenu se remplit progressivement, chapitre par chapitre.

---

## 1. Pourquoi mutualiser

Aujourd'hui on a deux implémentations qui font la même chose :

- `mozaic-ng/projects/mozaic-ng/src/lib/grid` (Angular)
- `adeo-grid` (Vue 3 + TypeScript)

Les comportements **dérivent dans le temps** : un fix d'un bug fait dans
Vue (par exemple le `dataVersion` qui invalide le `groupTree`) n'a pas
forcément son équivalent côté Angular, et inversement. Chaque
nouveau bug réintroduit des incohérences ; chaque nouvelle feature doit
être réinventée des deux côtés.

Trois bénéfices concrets attendus :

1. **Source unique pour les décisions UX / sémantiques.** Quand un PM
   demande "comment le grid se comporte quand on Ctrl+A puis Delete sur
   1 M cellules", la réponse vit ici, pas dans deux composants. Les
   deux implémentations doivent matcher cette réponse.
2. **Onboarding plus rapide.** Un dev qui arrive lit la spec une fois
   et sait ce qu'il doit implémenter, sans rétro-engineer le code
   existant.
3. **Préparation au prochain framework.** Quand demain on voudra une
   datagrid React (ou Lit, ou rien-juste-DOM), la spec est déjà là — on
   ne fait qu'écrire l'adaptateur.

**Non-objectifs.**

- Ce n'est pas une lib de code partagé (pas de runtime commun).
- Ce n'est pas une doc utilisateur final (les README spécifiques aux
  frameworks restent).
- Ce n'est pas un cadre formel exhaustif (RFC, MDX rich,
  type-checked). C'est du Markdown lisible, avec des snippets
  TypeScript pour les contrats.

---

## 2. Localisation et structure de fichiers

Repo dédié (recommandé) ou monorepo : peu importe. Ce qui compte c'est
que les implémentations puissent *référencer* (par lien) un chapitre
de la spec depuis leur code source.

```
adeo-grid-spec/                       ← nouveau repo (ou dossier monorepo)
├── README.md                        ← landing : pour qui, pour quoi
├── CONTRIBUTING.md                  ← conventions d'écriture
├── CHANGELOG.md                     ← versions de la spec
│
├── 00-overview/
│   ├── 00-vision.md                 ← "pourquoi cette grid existe"
│   ├── 01-glossary.md               ← row, cell, header, sticky, …
│   ├── 02-architecture.md           ← state / engines / renderers
│   └── 03-quality-bar.md            ← perf budgets, a11y, breakpoints
│
├── 10-data-model/
│   ├── 10-rows.md                   ← shape RowData, identité, virtual
│   ├── 11-columns.md                ← ColumnDef complet
│   ├── 12-cells.md                  ← accessors, valueGetter / Formatter
│   └── 13-row-id.md                 ← fonction rowId + stabilité
│
├── 20-headers-and-cells/
│   ├── 20-header-cell.md            ← layout, sort indicator, kebab
│   ├── 21-filter-row.md             ← inline filter row, slots
│   ├── 22-body-cell.md              ← rendering, hover, editing entry
│   ├── 23-pinned-columns.md         ← sticky start / end, z-index
│   └── 24-virtual-columns.md        ← window, overscan, spacers
│
├── 30-interactions/
│   ├── 30-selection-row.md          ← single, range, allSelected mode
│   ├── 31-selection-cell.md         ← range, multi-range, fill handle
│   ├── 32-keyboard.md               ← arrows, Tab, Enter, Ctrl+A, …
│   ├── 33-clipboard.md              ← copy / cut / paste sémantique
│   ├── 34-editing.md                ← inline editors, commit, validate
│   ├── 35-fill-handle.md            ← drag down/right, série
│   └── 36-undo-redo.md              ← history transactions
│
├── 40-features/
│   ├── 40-sorting.md                ← single / multi, comparators
│   ├── 41-filtering.md              ← inline, builder, custom, server
│   ├── 42-grouping.md               ← multi-level, expand/collapse
│   ├── 43-pagination.md             ← config, footer, server mode
│   ├── 44-virtual-scroll.md         ← rows + cols, expanded rows
│   ├── 45-resize-columns.md         ← min/max, mouse down → up, sort guard
│   ├── 46-reorder-columns.md        ← DnD, zones (pinned start/center/end)
│   ├── 47-autosize.md               ← canvas measureText, sampling
│   ├── 48-hide-columns.md           ← visible flag, hidden tags
│   ├── 49-expand-row.md             ← detail panel, auto-measure
│   ├── 4A-tree.md                   ← parent/children, depth, toggle
│   ├── 4B-density.md                ← compact / default / comfortable
│   ├── 4C-formula.md                ← parser, DAG, evaluation
│   ├── 4D-export.md                 ← scope (selection / visible / all)
│   ├── 4E-validation.md             ← cell + row + bulk
│   └── 4F-state-persistence.md      ← columnState, restore, server
│
├── 50-overlays/
│   ├── 50-toolbar.md                ← smart toolbar + custom slot
│   ├── 51-drawers.md                ← filter / group / settings / shortcuts
│   ├── 52-action-bar.md             ← selection-bar contextuelle
│   ├── 53-menus.md                  ← header kebab, formula reference
│   └── 54-tooltips.md               ← truncation, validation errors
│
├── 60-states/
│   ├── 60-loading-vs-refreshing.md  ← squelette plein vs slot silencieux
│   ├── 61-pending-mutations.md      ← cell-level vs row-level shimmer
│   ├── 62-empty-states.md           ← no data vs filtered to none
│   ├── 63-error-states.md           ← retry slot, recovery
│   └── 64-skeleton.md               ← shimmer keyframe, contrast
│
├── 70-quality/
│   ├── 70-perf-budgets.md           ← N rows × M cols benchmarks cibles
│   ├── 71-accessibility.md          ← ARIA, focus order, sr-only
│   ├── 72-keyboard-only.md          ← parcours complet sans souris
│   ├── 73-i18n.md                   ← strings, formats, RTL
│   └── 74-themes.md                 ← CSS vars, Mozaic tokens
│
├── 80-platform/
│   ├── 80-events.md                 ← inventaire complet + payloads
│   ├── 81-imperative-api.md         ← ref / @ViewChild methods
│   ├── 82-plugins.md                ← contrat init/dispose
│   └── 83-renderers.md              ← built-in + define*Renderer
│
└── 90-implementations/
    ├── 90-angular-mapping.md        ← chaque concept → fichier Angular
    ├── 91-vue-mapping.md            ← chaque concept → fichier Vue
    └── 92-parity-matrix.md          ← tableau "fait / pas fait" par framework
```

La numérotation à 2 chiffres + double niveau garde un ordre lisible
sans avoir besoin de réindexer quand on insère. Les tranches de 10
laissent de la place (`40` = features, `41` = filtering, etc.) ;
ajouter un chapitre entre deux ne déplace rien.

---

## 3. Format type d'un chapitre

Chaque chapitre suit le même squelette pour qu'on sache toujours où
chercher l'info. Exemple sur `41-filtering.md` :

```markdown
# Filtering

> Filtrer un dataset par colonne, soit via une "filter row" inline
> sous l'en-tête, soit via un builder multi-conditions, soit en
> déléguant au serveur.

## 1. Concept

Trois surfaces UI :
- inline filter row (un input par colonne)
- builder drawer (conditions AND/OR multi-colonnes)
- per-column overlay (popup ancré à l'en-tête)

Les trois surfaces partagent un seul `FilterModel`. Modification d'une
surface se reflète dans les deux autres.

## 2. Contrat TypeScript

\`\`\`ts
export interface FilterModel {
  conditions: FilterCondition[]
}

export interface FilterCondition {
  field: string
  operator: FilterOperator  // 'contains' | 'equals' | 'gt' | …
  value: { value?: unknown; valueTo?: unknown } | null
  model?: unknown  // custom filter payload
  combinator: 'and' | 'or'
}

export type FilterDataType = 'text' | 'number' | 'date' | 'set' | 'boolean'

export type FilterOperator =
  | 'contains' | 'notContains'
  | 'equals' | 'notEquals'
  | 'startsWith' | 'endsWith'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'between'
  | 'in' | 'notIn'
  | 'blank' | 'notBlank'
\`\`\`

## 3. Comportements

- **Évaluation** : conditions gauche-droite, `combinator` du suivant
  combine avec l'accumulateur courant.
- **Server mode** : si `filterMode === 'server'`, le grid n'évalue
  jamais — il émet `filterChange(filters)` et attend que le consumer
  resync ses rows.
- **Inline + builder coexistent** : les deux sont AND-combinées
  (intersection).

## 4. Événements émis

| Événement       | Payload                              | Quand                          |
|-----------------|--------------------------------------|--------------------------------|
| `filterChange`  | `Record<string, unknown>` (inline)   | inline filter row mute         |
| `filterModelChange` | `FilterModel`                    | builder / overlay mute         |
| `update:filterModel` | `FilterModel`                   | v-model bidir                  |

## 5. Edge cases

- Condition incomplète (`value: null`) → ignorée à l'évaluation.
- Filtre custom (`model` non-null) → délégué au component custom de la
  colonne, le grid ne tente PAS d'évaluer.
- `set` filter sur valeur sérialisée différemment selon le framework :
  voir §90 mapping pour la convention de string-coercion.

## 6. Implémentations

| Concept              | Angular                                | Vue                                       |
|----------------------|----------------------------------------|-------------------------------------------|
| Inline filter row    | `grid-filter-row.component.ts`         | `AdeoGridFilterRow.vue`                    |
| Builder drawer       | `grid-filter-builder.component.ts`     | `AdeoGridFilterBuilder.vue`                |
| Filter model state   | `GridStateManager.filterModel`         | `gridState.filterModel`                   |
| Evaluation engine    | `FilterEngine.applyFilters()`          | `useFilterEngine.filterData()`            |

## 7. Tests d'acceptation

- [ ] Filtre `contains` "abc" matche "ABCD" (case-insensitive).
- [ ] Filtre `between` accepte les bornes inclusivement.
- [ ] Server mode : aucune mutation locale de `rows` quand un filtre
  change.
- [ ] Inline + builder en même temps → intersection des deux.

## 8. Références

- Source Angular : [`grid/filter/`](https://…)
- Source Vue : [`composables/useFiltering.ts`](https://…)
- Discussion ADR-007 : "Pourquoi 2 surfaces de filtre coexistent"
```

Les sections sont **fixes** (Concept → Contrat → Comportement →
Événements → Edge cases → Implémentations → Tests → Références).
Quand un chapitre n'a pas besoin d'une section (ex : pas
d'événements), on écrit explicitement `*N/A — pas d'événement*` au
lieu de la supprimer, pour que la grille de comparaison entre
chapitres reste régulière.

---

## 4. Conventions d'écriture

### 4.1 Langue

Français pour les explications / décisions. TypeScript pour les
contrats. Anglais accepté pour les noms de champs / méthodes (héritage
de l'écosystème JS) et pour les payloads d'événements.

### 4.2 Snippets TypeScript

Tous les contrats sont écrits en **TypeScript** (pas en JS, pas en
JSON-schema, pas en pseudo-code). Raison : c'est le langage commun aux
deux implémentations existantes ET au prochain framework s'il est en
React/Solid/Svelte/etc. (qui consomment tous TS).

Conventions sur les snippets :

- `readonly` quand la valeur est exposée par le grid mais pas
  mutable par le consumer.
- Pas de marqueurs framework (`Ref<T>`, `Signal<T>`, `Observable<T>`,
  `@Input()`, etc.) — les contrats parlent en types nus. Les
  mappings framework-specific vivent dans `90-*-mapping.md`.
- Pas de génériques inutiles (pas de `<T extends RowData = RowData>`
  partout). Quand le générique compte, on le note ; sinon `RowData`.

### 4.3 Diagrammes

- ASCII art ou Mermaid pour les flux / state machines.
- Pas d'image binaire (PNG, JPG) — version-controllable, diffable,
  rendable côté GitHub / GitLab.
- Si une UI doit être illustrée, link vers Figma ou Storybook plutôt
  que screenshot — sinon il faut réindexer à chaque évolution
  visuelle.

### 4.4 Versioning

`CHANGELOG.md` à la racine, suit [SemVer](https://semver.org/) :

- **PATCH** : clarifications, typos, exemples ajoutés sans changer
  la sémantique.
- **MINOR** : ajout de feature / chapitre / événement, rétro-compat.
- **MAJOR** : breaking change dans un contrat (renommer un champ,
  changer un payload d'événement). Les deux implémentations doivent
  rattraper avant qu'une MAJOR soit mergée.

Chaque chapitre porte en frontmatter sa propre version sémantique :

```yaml
---
version: 1.4.0
last-reviewed: 2026-06-05
implementations:
  angular: 2.8.1
  vue: 0.3.2
---
```

`implementations.<framework>` indique la dernière version où la
spec a été vérifiée conforme. Quand un framework passe une release qui
change un comportement, il met à jour son numéro ici.

---

## 5. Workflow d'auteur

### 5.1 Ajouter une nouvelle feature

1. Ouvrir un chapitre vide `4X-name.md` en suivant le squelette §3.
2. Remplir d'abord §1 (concept) et §2 (contrat TS) — doit être lisible
   sans avoir vu une seule ligne de code.
3. PR ouverte → review par un mainteneur de chaque framework
   (au moins 1 Angular + 1 Vue).
4. Une fois mergée, ouvrir les PR d'implémentation dans chaque framework.
   Le titre des PR référence le chapitre : `[spec/41-filtering] …`.

### 5.2 Fixer un bug

1. Identifier la divergence : la spec est-elle ambiguë ou
   l'implémentation est-elle en faute ?
2. Si spec ambiguë : PR sur le chapitre + bump PATCH/MINOR/MAJOR
   approprié.
3. Si implémentation : PR sur le framework concerné, qui référence le
   chapitre comme source de vérité.

Cette discipline évite que des bugs deviennent des features de fait.

### 5.3 Maintenir la matrice de parité

`92-parity-matrix.md` est un gros tableau (chapitre × framework) avec
un état `✅` / `🚧` / `❌`. Mis à jour à chaque release de chaque
framework. C'est l'indicateur de santé du projet : si trop de cellules
sont `❌`, on a un problème de coordination.

---

## 6. Phasage de remplissage

On NE remplit PAS tout d'un coup. Trois jalons proposés :

### Phase 1 — Fondations (4 semaines)

L'objectif est d'avoir le **squelette utilisable** rempli sur les
chapitres les plus consultés. À la fin de la phase 1, un dev qui
arrive lit ces chapitres et peut écrire un nouveau renderer / column
def sans souffrir.

- `00-overview/01-glossary.md`
- `10-data-model/10-rows.md`
- `10-data-model/11-columns.md`
- `10-data-model/12-cells.md`
- `30-interactions/30-selection-row.md`
- `30-interactions/31-selection-cell.md`
- `30-interactions/34-editing.md`
- `40-features/40-sorting.md`
- `40-features/41-filtering.md`
- `40-features/43-pagination.md`
- `60-states/60-loading-vs-refreshing.md`
- `80-platform/80-events.md` (au moins le listing brut)

### Phase 2 — Couverture des features avancées (6 semaines)

- `40-features/42-grouping.md`
- `40-features/44-virtual-scroll.md`
- `40-features/47-autosize.md`
- `40-features/4D-export.md`
- `30-interactions/33-clipboard.md`
- `30-interactions/35-fill-handle.md`
- `50-overlays/*` (tous)
- `20-headers-and-cells/*` (tous)

### Phase 3 — Qualité & implémentation (continu)

- `70-quality/*` (perf budgets mesurés, pas devinés)
- `90-implementations/*` (les mappings — naturellement remplis au fur
  et à mesure que les chapitres sont implémentés)

À la fin de chaque phase, un point sur la matrice de parité — si
elle s'est dégradée, on freeze les phases suivantes et on rattrape.

---

## 7. Glossaire minimal pour démarrer

Pour amorcer `01-glossary.md`, voici les 15 termes qui doivent être
définis sans ambiguïté avant tout le reste (extraits du code existant
des deux frameworks) :

| Terme              | Définition courte                                                                    |
|--------------------|--------------------------------------------------------------------------------------|
| Row                | Objet du dataset, identifié par `rowId(row, index)`. Pas forcément réactif.          |
| Cell               | Intersection `(row, column)`. Adresse = `(rowId, field)` OU `(rowIndex, colIndex)`.  |
| Column             | Métadonnée de colonne (`ColumnDef`). Statique côté config, mutable côté `columnStates`.|
| Header             | Zone en haut de chaque colonne contenant label + sort indicator + kebab.             |
| Filter row         | Rangée optionnelle sous les headers, un input par colonne filtrable inline.          |
| Sticky chunk       | Bloc header + filter row qui reste `position: sticky` en haut du wrapper.            |
| Sizer              | Élément invisible qui donne la hauteur totale au scroll container en mode virtual.   |
| Pinned             | Colonne `position: sticky` collée à gauche (`start`) ou à droite (`end`).            |
| Renderable rows    | Rows effectivement passées au virtual scroller — après filter, sort, group, paginate.|
| Source data        | `props.rows` brut, tel que fourni par le consumer. Jamais muté en place côté lib.    |
| Data version       | Compteur bumpé par le grid à chaque mutation in-place pour invalider les caches.     |
| Selection model    | `{ allSelected, selectedIds, deselectedIds }` — modèle "page" ou "all" + exclusions.|
| Pending cell       | `(rowId, field)` actuellement en mutation côté serveur. Shimmer overlay rendu.       |
| Cell range         | `{ start: {row, col}, end: {row, col} }` — rectangle de sélection cellule.           |
| Render slice       | Sous-ensemble `[startRow..endRow] × [startCol..endCol]` rendu par le virtual scroll. |

---

## 8. Quick-start : exemple de migration

Pour donner une idée du résultat final, voici comment **un chapitre
mature** (le filtering) éviterait les bugs de divergence vécus.

**Aujourd'hui** — un dev Angular regarde son code, voit que les
filtres "inline" et "builder" sont stockés dans deux refs séparés. Il
fixe un bug en mergeant les deux. Trois mois plus tard, un dev Vue
voit que `filteredRows` short-circuite quand "no filter", ce qui fait
bugger le `groupTree` (cf. §85). Il bump un `dataVersion`. Le côté
Angular ne sait pas qu'il devrait le faire aussi.

**Avec la spec** — le chapitre `41-filtering.md` dit explicitement :
"les deux surfaces partagent un seul `FilterModel`" (donc le dev
Angular n'aurait jamais fait deux refs au départ). Le chapitre
`44-virtual-scroll.md` ou `42-grouping.md` documente l'invariant
"toute mutation de row déclenche un bump de `dataVersion`" comme
contrat de la lib, pas comme bug fix. Les deux implémentations le
respectent dès l'écriture, pas seulement après qu'un consumer ait
saigné.

---

## 9. Risques et garde-fous

- **Risque** : la spec dérive en devenant *prescriptive* sur les
  détails d'implémentation (style, organisation du code, tooling).
  → **Garde-fou** : limiter §6 (implémentations) à un mapping fichier
  → concept. Pas de "vous devez utiliser des computeds" / "vous devez
  utiliser des effets". Le framework choisit ses outils.
- **Risque** : la spec stagne pendant qu'une implémentation évolue.
  → **Garde-fou** : checkbox dans la PR template des deux repos
  framework — "ai-je mis à jour la spec ?" / "y a-t-il un chapitre qui
  doit bump sa version ?". Bloque le merge si non coché et qu'il y a
  changement public.
- **Risque** : on documente trop tôt, le contrat change.
  → **Garde-fou** : la spec a sa propre SemVer. Une MINOR breaking
  côté implémentation force une MAJOR côté spec. Les consumers
  savent où regarder.

---

## 10. Prochaine étape concrète

1. Créer le repo `adeo-grid-spec` (ou dossier dans le monorepo).
2. Copier la structure §2 vide (chaque `.md` est un placeholder avec
   le squelette §3).
3. Remplir `01-glossary.md` à partir du tableau §7.
4. Remplir `11-columns.md` et `10-rows.md` à partir des sources
   `adeo-grid/src/components/AdeoGrid/types.ts` et `mozaic-ng/.../grid/types`
   — c'est l'union des deux qui devient la spec.
5. Soumettre en review aux deux équipes Angular / Vue avant de
   continuer. Ces 4 chapitres servent de test : si on n'arrive pas à
   se mettre d'accord dessus, on a un signal qu'il faut clarifier les
   conventions avant d'écrire le reste.
