# `styles/` — port SCSS Angular → Vue

## État

Les **19 fichiers SCSS du grid Angular** ont été portés ici (1 875 LOC) avec
les 4 traductions du plan §13.2 (`:host` → `.<bem-root>`, `::ng-deep` →
descendant, classes CDK → équivalents Vue, sélecteurs custom-element → BEM
root). Voir `index.scss` pour la liste complète, et le commentaire en tête
de chaque fichier pour la transformation appliquée.

Les keyframes globales (`moz-grid-marching-ants-x/y`, `adeo-grid-loading-bar`)
sont dans `_animations.scss` et **doivent rester non-scopés** — sinon Vue
les hashe et les noms ne résolvent plus depuis les cells qui les
référencent.

## Adoption — pas encore branchée par défaut

⚠️ **Les SFC actuels (`AdeoGridCell.vue`, `AdeoGridRow.vue`, etc.) utilisent
des classes `.adeo-grid-cell`, `.adeo-grid-row`, …** alors que les SCSS portés
utilisent les classes Angular `.grid-cell`, `.grid-row`, … . Importer
`styles/index.scss` tel quel ne **change rien au rendu** : les sélecteurs
ne matchent aucune classe émise par les SFC.

Pour réellement adopter ces SCSS, il y a deux chemins :

### Option A — ré-aliaser les classes côté SFC

Ajouter `adeo-grid-cell` ↔ `grid-cell` (etc.) dans les `:class` bindings de
chaque SFC. Le moins invasif, mais ajoute des classes redondantes au DOM.

```vue
<!-- AdeoGridCell.vue -->
<div class="adeo-grid-cell grid-cell" :class="{ ... 'grid-cell--cut': cutSource }">
```

### Option B — renommer les classes des SFC vers le shape Angular

Remplacer `.adeo-grid-cell` par `.grid-cell` dans tous les SFC + scoped
styles. Le plus aligné avec le plan, mais touche tous les SFC.

| | Option A | Option B |
|---|---|---|
| Fichiers touchés | 19 SFC (juste `:class`) | 19 SFC + tests qui font `.find('.adeo-grid-cell')` |
| Pixel parity Angular ↔ Vue | partielle (deux stylesheets coexistent) | exacte |
| Effort | ~30 min | ~3-4 h |
| Risque | aucun (additif) | tests à mettre à jour |

## Recommandation

Aller en **Option B** par PRs ciblées (1 PR par sous-dossier de
`components/`). Inclure dans la PR :

1. Renommer les classes du SFC (`adeo-grid-cell` → `grid-cell`).
2. **Restructurer le DOM** pour matcher le BEM Angular — les SFC Vue ont
   souvent une structure plus décomposée (e.g. `AdeoGridPagination` séparé
   du footer, alors qu'Angular a tout en un seul template). Le SCSS porté
   suppose la structure Angular ; sans cette restructuration, des règles
   resteront orphelines.
3. Ajouter `@use '@/components/AdeoGrid/styles/grid-cell'` au top du `<style>` du SFC, ou à `AdeoGrid.vue` pour tout charger d'un coup.
4. Lancer le suite Playwright `e2e/visual.spec.ts` (Phase 8b) pour vérifier la pixel parity.

À l'issue de Option B sur tous les sous-dossiers, on pourra supprimer les
règles `.adeo-grid-*` redondantes des `<style scoped>` et `AdeoGrid.vue`
deviendra le seul consommateur de `styles/index.scss`.

### Avertissement sur l'effort

Le port DOM est **non-trivial** parce que :

- Les SFC Vue ont **leur propre découpage** des composants. Exemple :
  `AdeoGridFooter.vue` est un wrapper qui compose `AdeoGridLoadingIndicator`
  + `AdeoGridPagination`. Le SCSS porté Angular `grid-footer.scss` contient
  des règles pour `.grid-footer__info`, `.grid-footer__page-size-label`,
  `.grid-footer__count` — ces classes sont actuellement dans
  `AdeoGridPagination.vue`, pas `AdeoGridFooter.vue`. La PR doit déplacer
  les classes au bon endroit.
- Les **tests** font `wrapper.find('.adeo-grid-cell')`. Renommer brise
  silencieusement la résolution. Compter ~30 min par fichier de test
  pour mettre à jour les sélecteurs.
- Les **consumers** qui ont des overrides CSS sur les classes `.adeo-grid-*`
  cassent. Annoncer en deprecation (laisser un alias `.adeo-grid-*`
  pendant 1-2 versions).

**Vrai estimé** : ~3-4h par sous-dossier (header / body / footer / overlays),
soit 12-16h de boulot. Vu que les SFC Vue fonctionnent déjà visuellement
sans le port, **l'option pragmatique est de skip tant que la pixel-parity
exacte avec le grid Angular n'est pas un requis business**.

Si la pixel-parity est requise, voir Phase 8b (`e2e/visual.spec.ts` +
`scripts/css-audit.mjs`) pour valider chaque PR avant merge.

## Inventory

| Fichier | LOC | Classes BEM root |
|---|---:|---|
| `_animations.scss` | 25 | `@keyframes` only |
| `_layers.scss` | 3 | `@layer` declaration |
| `grid-body.scss` | 72 | `.grid-body`, `.grid-body__*` |
| `grid-cell.scss` | 345 | `.grid-cell`, `.grid-cell--*`, `.grid-cell__*` |
| `grid-row.scss` | 76 | `.grid-row`, `.grid-row--*`, `.grid-row__*` |
| `grid-group-row.scss` | 67 | `.grid-group-row`, `.grid-group-row--*` |
| `grid-detail-row.scss` | 22 | `.grid-detail-row` |
| `grid-empty-state.scss` | 39 | `.grid-empty-state`, `.grid-empty-state__*` |
| `grid-header.scss` | 96 | `.grid-header`, `.grid-header__*` |
| `grid-header-cell.scss` | 150 | `.grid-header-cell`, `.grid-header-cell__*` |
| `grid-header-menu.scss` | 12 | `.grid-header-menu` |
| `grid-footer.scss` | 25 | `.grid-footer`, `.grid-footer__*` |
| `grid-selection-bar.scss` | 76 | `.selection-bar`, `.selection-bar__*` |
| `grid-filter-builder.scss` | 136 | `.filter-builder`, `.filter-builder__*` |
| `grid-filter-drawer.scss` | 12 | `.filter-drawer` |
| `grid-group-drawer.scss` | 133 | `.group-drawer`, `.group-drawer__*` |
| `grid-settings-drawer.scss` | 145 | `.settings-list`, `.settings-density`, `.settings-columns` |
| `grid-column-visibility-panel.scss` | 56 | `.column-visibility-panel`, `.column-visibility-panel__*` |
| `grid-formula-editor.scss` | 122 | `.moz-grid-formula-editor`, `.moz-grid-formula-editor__*` |
| `grid-formula-reference-drawer.scss` | 137 | `.formula-ref`, `.formula-ref__*` |
| `grid-keyboard-shortcuts-drawer.scss` | 79 | `.shortcuts`, `.shortcuts__*` |
| **Total** | **1 825** | |
