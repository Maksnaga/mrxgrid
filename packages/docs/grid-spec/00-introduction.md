# Introduction

> Specification mutualisée du datagrid **@adeo/grid**
>
> Version 1.0 — 2026-06-08
>
> Sources scannées :
> - `apps/grid-vue/src/components/Grid/` (implémentation Vue 3)
> - `apps/grid-angular/projects/grid-angular/src/lib/grid/` (implémentation Angular 21)

## À quoi sert ce document

Ce document est la **spec canonique** du datagrid Adeo. Il décrit *ce que le grid fait*, indépendamment du framework. Pour chaque feature, il donne :

1. Un **contrat de comportement** : ce qui est garanti côté UX, les edge cases, les invariants.
2. Une **API publique** consommateur : props/inputs, events/outputs, slots/projection, méthodes impératives.
3. Un **contrat d'implémentation interne** : les signals d'état, les effets de bord, les couplages entre features.
4. Un **mapping Vue ↔ Angular** : où vit le code dans chaque lib, quels noms de méthodes, quelles signatures de signals.

Il n'est **pas** :

- une doc utilisateur (pour ça → tutoriels MDX dans `apps/grid-vue/src/components/Grid/__stories__/docs/`)
- un changelog (pour ça → `CHANGELOG.md` à chaque release Changesets)
- un tracker d'avancement (pour ça → `packages/docs/grid-vue-docs/vue-vs-angular-sync.md`)

## Public visé

| Audience | Ce que tu cherches ici |
|---|---|
| Contributeur sur la lib Vue ou Angular | Le contrat exact d'une feature : ce qui doit marcher, où le code vit, ce qui peut casser silencieusement |
| Auteur d'un nouveau composant côté lib | Les invariants à respecter (`dataVersion`, idempotence de `focusCell`, etc.) |
| Reviewer d'une PR cross-framework | La référence pour vérifier qu'un fix appliqué côté Vue est aligné côté Angular |
| Architecte qui décide de porter une feature | Le tableau de mapping pour estimer l'effort |
| Tech lead Mozaic | La preuve écrite que Vue et Angular convergent — et où ils ne le font pas encore |

Si tu es **consommateur** du grid (tu écris une app qui utilise `<ad-grid-vue>` ou `<ad-grid-angular>`), va plutôt voir le tutoriel `01-QuickStart` et la page `08-API` dans le Storybook de la lib que tu utilises.

## Architecture en 1 page

Les deux implémentations suivent le **même découpage**, à un détail framework près :

```
┌──────────────────────────────────────────────────────────────────────┐
│  Composant racine                                                    │
│    Vue: <ad-grid-vue>  (apps/grid-vue/.../Grid.vue)                  │
│    Ang: <ad-grid-angular>  (apps/grid-angular/.../grid.ts)           │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  GridState — single source of truth (signals)                   │ │
│  │    Vue: useGridState() → signals + computeds                    │ │
│  │    Ang: GridStateManager class avec signal() partout            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                              ↓                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  GridEngine — orchestrateur                                     │ │
│  │    Vue: useGridEngine() composable                              │ │
│  │    Ang: GridEngine class                                        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                              ↓                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Features (engines) — un par concern                            │ │
│  │    Sort, Filter, Group, Pagination,                             │ │
│  │    RowSelection, CellSelection, InlineEdit,                     │ │
│  │    CellValidation, History, Clipboard, Keyboard,                │ │
│  │    ColumnResize, ColumnReorder, ColumnDrag, Autosize,           │ │
│  │    HorizontalVirtualScroll, VerticalVirtualScroll,              │ │
│  │    Tree, ExpandableRow,                                         │ │
│  │    Export, StatePersistence, Formula                            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                              ↓                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Composants UI (headers, body, overlays, drawers)              │  │
│  │  Lisent l'état, appellent les méthodes des engines             │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**Règles d'or** :

1. **Toute mutation passe par un engine**. Les composants ne mutent jamais directement l'état.
2. **`dataVersion` est l'invariant central de la cache cascade**. Chaque mutation qui change la sémantique des rows doit bumper `dataVersion++`. Sans ça, filter/sort/group/group-server gardent leurs résultats cachés et l'écran ment.
3. **Une feature = un engine**. Si on ajoute un nouveau concern, on crée un nouveau fichier `features/use<Name>Engine.ts` (Vue) ou `features/<name>.engine.ts` (Angular), pas du code dans `grid.ts`.
4. **Les engines ne se connaissent pas entre eux directement**. Ils communiquent via les signals de `GridState`.

## Comment lire la suite

Chaque chapitre couvre un domaine cohérent et suit le même template :

```
## <Feature>
  ### Purpose          (1 paragraphe, framework-agnostic)
  ### Behavior contract  (les invariants, les edge cases)
  ### Public API         (le contrat consommateur)
  ### Implementation contract (les signals, les coupling internes)
  ### Vue mapping        (où ça vit dans la lib Vue)
  ### Angular mapping    (où ça vit dans la lib Angular)
```

Les chapitres :

| # | Chapitre | Couvre |
|---|---|---|
| 0 | Introduction | Ce document |
| A | Data, Columns, Pinning, Virtualization | Modèle de données, définition des colonnes, pinning, virtualisation verticale et horizontale |
| B | Sort, Filter, Group, Pagination | Cascade de transformation des données et pagination |
| C | Selection, Editing, Validation, Undo, Clipboard, Keyboard | Interactions cellule et ligne |
| D | Renderers, Plugins, Formula, Export, State persistence | Extensibilité et persistance |
| E | Tree, Expandable rows, Columns (drag/reorder/resize/autosize/hide), Theming, Performance, Public API | Hiérarchie, manipulation des colonnes, theming et synthèse de l'API |
| 99 | Appendix | Glossaire, cross-ref sync.md, versioning |

## Conventions du document

- Les chemins de fichiers sont **relatifs à la racine du monorepo** (`apps/grid-vue/...` ou `apps/grid-angular/...`).
- Quand un signal Vue et un signal Angular jouent le même rôle, ils sont listés côte à côte dans la table de mapping.
- Les types TypeScript publics sont écrits en notation TS standard (`AdeoGridColumn<T>`, `FilterEvent`, etc.) — ils existent réellement dans les deux libs sous le même nom.

## Statut de cette v1

| Métrique | Valeur |
|---|---|
| Features couvertes | 27 |
| Engines analysés (Vue) | 21 composables |
| Engines analysés (Angular) | 23 classes |
| Lignes de spec | ~3 000 |
| Source du scan | Code source au commit `HEAD` de juin 2026 |

Les chapitres suivants reflètent la réalité du code au moment de la rédaction. Toute évolution future (porting Vue → Angular, harmonisation API, nouvelle feature) doit s'accompagner d'une mise à jour du chapitre concerné — la spec et le code évoluent ensemble.

---

*Suite : [Données, Colonnes, Pinning, Virtualisation →](?path=/docs/données-colonnes--docs)*
