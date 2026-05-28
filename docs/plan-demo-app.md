# Plan — Demo App (single-page, vitrine exhaustive du grid)

## Objectif

**Une seule page**, avec **CRUD complet en mémoire**, qui exerce **toutes** les features de MrxGrid dans un contexte applicatif réaliste. La cible est double :

1. **Vitrine commerciale** — quelqu'un qui ouvre l'URL voit immédiatement "tiens, ce grid sait faire tout ça".
2. **Code de référence** — un dev qui veut intégrer MrxGrid trouve un exemple propre, commenté, copier-collable, qui couvre les patterns courants.

---

## Cadre validé (depuis les questions)

| Décision | Choix |
|---|---|
| Base path | `/mrxgrid-app/` |
| Mutations | **CRUD complet** sur un store en mémoire (JS array). Les modifs survivent à la navigation interne mais sont **perdues au refresh** (seed initial restauré). |
| Theme switch | Skip |
| Sidebar | Un seul item actif (les autres décoratifs, non-cliquables) |
| Slow network toggle | Dans le header (utile pour démontrer les loading states) |
| Router | Aucun — une seule page |

---

## Features à exercer (checklist)

Chaque feature doit être visible et fonctionnelle.

**Server-side (mocké)**
- [ ] Pagination serveur (`@page-change` → re-fetch sur le store en mémoire)
- [ ] Tri serveur (`@sort-change` → re-fetch)
- [ ] Filtres serveur (`@update:filter-model` → re-fetch debounce 200ms)
- [ ] Recherche globale debouncée (300ms)
- [ ] Loading state (`:loading`)
- [ ] Error state + retry (`:error` + slot `#error`)
- [ ] Slow network toggle (× 4 latence)
- [ ] 2% d'erreurs aléatoires pour démo retry

**CRUD complet (mémoire)**
- [ ] **Créer** un produit via `ProductDrawer` (form Mozaic) → prepend dans le store → refetch → row apparait
- [ ] **Éditer** inline (cell editor) → patch sur le store → toast
- [ ] **Éditer** via drawer (double-click row) → patch complet → toast
- [ ] **Supprimer** une ligne via drawer (bouton danger) → modal confirmation → suppression du store → row disparait
- [ ] **Bulk delete** depuis `BulkActionBar` → modal confirmation → suppression batch
- [ ] **Bulk update statut** depuis `BulkActionBar` → modal MSelect → patch batch
- [ ] **Validation** : `cellValidator` refuse les valeurs négatives sur stock
- [ ] **Undo/redo** (Ctrl+Z / Ctrl+Y) via `historyId` — ajoute/retire/patch sont undoable

**Filtres — 3 styles différents sur 3 colonnes**
- [ ] **Inline filter row** built-in (`filter: { type: 'text' / 'select' / 'date' }`)
- [ ] **Custom filter slot** `<template #filter-price>` avec un dual-range slider maison
- [ ] **Custom filter AG-Grid** `filter: { component, doesFilterPass, getModelAsString }` sur `category`
- [ ] Drawer global de filtres (multi-conditions AND/OR)
- [ ] Tag bar FILTERED BY qui affiche les valeurs sélectionnées

**Sélection & bulk**
- [ ] `selectable` row selection avec checkbox
- [ ] Cell range selection (Shift+click)
- [ ] `BulkActionBar` (floating) — actions : Exporter, Modifier statut, Supprimer

**Édition & fill**
- [ ] Cell editor `select` sur status
- [ ] Cell editor `text` sur name
- [ ] Cell editor `number` sur stock + price
- [ ] Fill handle (drag pour copier sur range)

**Affichage des cells**
- [ ] Renderer custom : badge `MStatusBadge` sur status
- [ ] Renderer custom : `MStarRating` sur rating
- [ ] Renderer custom : avatar + nom sur brand
- [ ] Renderer custom : chips sur tags
- [ ] Formula column : `marge` = `(price - cost) / price`
- [ ] Slot `#cell` custom sur 1 colonne (override depuis l'extérieur)

**Layout & nav**
- [ ] Virtual scroll vertical + horizontal
- [ ] Pin start (ref, produit) + pin end (status, actions)
- [ ] Column drag/reorder + resize
- [ ] Density switch
- [ ] Fullscreen toggle
- [ ] Sticky header

**Group**
- [ ] Group by `category` activable depuis toolbar
- [ ] Counter dans group row
- [ ] Scroll preservation à l'expand (fix testé)

**Row expansion**
- [ ] Slot `#expand-row` avec mini grid embarqué des mouvements du produit

**Toolbar**
- [ ] Slot `#toolbar` custom : search + Importer CSV + Export menu + "Nouveau produit"

**Persistence**
- [ ] `:persist-key="'demo-products'"` (density, ordre cols, filtres restaurés au reload)
- [ ] `:history-id="'demo-products'"` pour undo/redo

**États**
- [ ] Empty state custom slot `#empty` quand filtres = 0 résultats
- [ ] Error state slot `#error` avec retry
- [ ] Keyboard shortcuts panel via bouton toolbar

---

## Arborescence

```
src/
  app/
    AppShell.vue                    ← Sidebar + Header + Toaster + DemoPage
    DemoPage.vue                    ← LA page

    components/
      AppSidebar.vue                ← MSidebar — 1 actif (Catalogue) + 5 disabled
      AppHeader.vue                 ← MPageHeader + slow network toggle + avatar
      AppToaster.vue                ← MToaster global

      KpiCard.vue                   ← MKpiItem + sparkline
      KpiRow.vue                    ← 4 KpiCard côte à côte

      ToolbarActions.vue            ← Slot #toolbar : search + import + export + new
      ProductDrawer.vue             ← Drawer création / édition (form Mozaic)
      DeleteConfirmModal.vue        ← MModal de confirmation suppression
      BulkActionBar.vue             ← Floating bar — sélection > 0
      BulkStatusModal.vue           ← Modal "Modifier statut" bulk
      ImportCsvDrawer.vue           ← Drawer upload CSV (preview avant import)

      cells/
        StatusCell.vue              ← MStatusBadge
        BrandCell.vue               ← Avatar + nom
        TagsCell.vue                ← MTag chips
        RatingCell.vue              ← MStarRating

      filters/
        PriceRangeSlider.vue        ← Slot #filter-price — dual-range slider
        CategoryComboFilter.vue     ← AG-Grid contract — combobox multi-select

      detail/
        ProductDetailExpand.vue     ← Slot #expand-row — tabs + mini grid
        ProductMovementsGrid.vue    ← Mini grid entrées/sorties pour ce produit

    mock/
      api.ts                        ← CRUD complet — fetchProducts, getProduct, createProduct, updateProduct, updateProducts, deleteProduct, deleteProducts, getProductMovements, getKpis
      seed.ts                       ← generateLMProducts(5000) + mouvements simulés
      latency.ts                    ← delay() + maybeThrow() + slowNetwork hook
      store.ts                      ← Module qui maintient l'array DB en mémoire

    stores/
      toasts.store.ts               ← Pinia: queue + showSuccess/Error/Info
      ui.store.ts                   ← Pinia: slowNetwork toggle

    composables/
      useProductList.ts             ← Pagination + filtre + sort + search serveur
      useDebouncedRef.ts            ← Helper réutilisable

    styles/
      app.scss

  main.ts                           ← createApp + Pinia + AppShell
```

---

## La page (DemoPage.vue)

```
┌─ Header ────────────────────────────────────────────────────────┐
│ [Logo] Catalogue produits     [⚡ slow network] [👤 J. Demo]    │
└─────────────────────────────────────────────────────────────────┘
┌─ Sidebar ──┬─ Page ────────────────────────────────────────────┐
│ ▣ Catalogue│ ┌─ KPI cards (calculés depuis le store) ──────────┐│
│  Stock     │ │ CA mois │ Stock │ Ruptures │ Promos              ││
│  Cmds      │ └──────────────────────────────────────────────────┘│
│  Clients   │                                                     │
│  Params    │ ┌─ MrxGrid (5000 lignes, server-side mocké) ──────┐│
│            │ │ Toolbar : search + filters + group + density…   ││
│            │ │ Filter row : text/select/date + slot prix       ││
│            │ │ Header : pinned, drag, resize, sort, kebab      ││
│            │ │ Body : virtual scroll + renderers + edits live  ││
│            │ │ Footer : pagination serveur                     ││
│            │ └──────────────────────────────────────────────────┘│
│            │                                                     │
│            │ ┌─ BulkActionBar (selection > 0) ─────────────────┐│
│            │ │ 3 prods • Exporter • Modifier statut • Suppr.   ││
│            │ └──────────────────────────────────────────────────┘│
└────────────┴─────────────────────────────────────────────────────┘
```

---

## Mutations en mémoire — comment ça marche

```ts
// src/app/mock/store.ts
import { generateLMProducts, type LMProduct } from '@/components/MrxGrid/__stories__/_fixtures'

// Le store. Volontairement non-réactif (pas de ref/reactive) — c'est de la
// donnée mockée serveur, pas du state UI. La réactivité côté UI vient des
// `refetch` après chaque mutation.
let DB: LMProduct[] = generateLMProducts(5000)

export const productStore = {
  all: () => DB,
  find: (id: string) => DB.find((p) => p.id === id) ?? null,
  insert: (p: LMProduct) => { DB = [p, ...DB] },
  patch: (id: string, patch: Partial<LMProduct>) => {
    DB = DB.map((p) => (p.id === id ? { ...p, ...patch } : p))
  },
  patchMany: (ids: string[], patch: Partial<LMProduct>) => {
    const set = new Set(ids)
    DB = DB.map((p) => (set.has(p.id) ? { ...p, ...patch } : p))
  },
  remove: (id: string) => { DB = DB.filter((p) => p.id !== id) },
  removeMany: (ids: string[]) => {
    const set = new Set(ids)
    DB = DB.filter((p) => !set.has(p.id))
  },
}
```

```ts
// src/app/mock/api.ts
import { productStore } from './store'
import { delay, maybeThrow } from './latency'

export async function fetchProducts(params): Promise<{ rows; total }> {
  await delay(); maybeThrow(0.02)
  let rows = productStore.all()
  rows = applySearch(rows, params.search)
  rows = applyFilters(rows, params.filterModel)
  rows = applySort(rows, params.sort)
  const total = rows.length
  return { rows: rows.slice(params.page * params.pageSize, (params.page + 1) * params.pageSize), total }
}

export async function createProduct(payload): Promise<LMProduct> {
  await delay(); maybeThrow()
  const p = { ...payload, id: `LM-${nextId()}` }
  productStore.insert(p)
  return p
}

export async function updateProduct(id, patch): Promise<LMProduct> {
  await delay(); maybeThrow()
  productStore.patch(id, patch)
  return productStore.find(id)!
}

export async function updateProducts(ids, patch): Promise<void> {
  await delay(); maybeThrow()
  productStore.patchMany(ids, patch)
}

export async function deleteProduct(id): Promise<void> {
  await delay(); maybeThrow()
  productStore.remove(id)
}

export async function deleteProducts(ids): Promise<void> {
  await delay(); maybeThrow()
  productStore.removeMany(ids)
}
```

Toute mutation passe par `productStore`. Au refresh, le module se ré-évalue, `DB` redevient le seed initial → état remis à zéro automatiquement. **Zéro complexité localStorage.**

---

## Workflow CRUD

| Action utilisateur | Mock API appelé | Effet UI |
|---|---|---|
| Click "Nouveau produit" | — | `ProductDrawer` ouvert vide |
| Submit drawer (création) | `createProduct(payload)` | Loading → close drawer → toast `✓ Produit créé` → refetch → row visible (prepend) |
| Double-click row | `getProduct(id)` | `ProductDrawer` ouvert pré-rempli, mode édition |
| Submit drawer (édition) | `updateProduct(id, patch)` | Toast `✓ Modifié` → close drawer → refetch → row patchée |
| Édition inline cell | `updateProduct(id, { [field]: value })` au commit | Toast subtil `✓ Sauvegardé` (3s) — pas de refetch (déjà à jour optimiste) |
| Click "Supprimer" dans drawer | — | `DeleteConfirmModal` |
| Confirm delete | `deleteProduct(id)` | Toast `✓ Supprimé` → close drawer + modal → refetch |
| Sélection multiple + "Supprimer" | — | `DeleteConfirmModal` avec count |
| Confirm bulk delete | `deleteProducts(ids)` | Toast `✓ N produits supprimés` → refetch |
| Sélection + "Modifier statut" | — | `BulkStatusModal` avec `MSelect` |
| Submit bulk status | `updateProducts(ids, { status: X })` | Toast `✓ Statut modifié pour N produits` → refetch |
| Erreur réseau (2%) | throws | Engine voit l'erreur, slot `#error` affiché avec bouton retry |
| Ctrl+Z | — | History engine annule la dernière action (rollback du store) |

---

## 3 styles de filtres — exemple pédagogique

### Style 1 — Inline built-in
```ts
{ field: 'name', filter: { type: 'text', placeholder: 'Rechercher…' } }
{ field: 'status', filter: { type: 'select', options: [...] } }
{ field: 'createdAt', filter: { type: 'date' } }
```
MTextInput / MSelect / MDatepicker sous le header. Aucun code custom.

### Style 2 — Custom slot `#filter-{field}`
```vue
<MrxGrid>
  <template #filter-price="{ value, setValue }">
    <PriceRangeSlider :value="value" @update="setValue" />
  </template>
</MrxGrid>
```
On garde la filter row inline, mais UI maison pour une colonne.

### Style 3 — Custom AG-Grid `filter: { component, doesFilterPass }`
```ts
{
  field: 'category',
  filter: {
    component: markRaw(CategoryComboFilter),
    doesFilterPass: (p) => p.model.includes(p.getValue('category')),
    getModelAsString: (m) => m.join(', '),
  },
}
```
Le **builder + column overlay** mountent le composant. Multi-select avec recherche, chips, etc.

---

## BulkActionBar — sélection cell ET row

```
1. User active la sélection : checkbox row OU Shift+click cell range
2. `BulkActionBar` (MActionBottomBar) apparait en bas
3. Actions :
   - "Exporter sélection (N)" → grid.exportCsv({ scope: 'selection' }) + toast
   - "Modifier statut" → BulkStatusModal → updateProducts(ids, { status }) → toast
   - "Supprimer" → DeleteConfirmModal → deleteProducts(ids) → toast
   - "Annuler" → grid.clearSelection()
4. Bar disparait quand selectionCount = 0
```

Le grid expose `@update:selection` ET `@cell-selection-change`. La barre se déclenche sur **les deux** événements (avec un compteur qui montre le total cellules OU rows selon le mode).

---

## Code style — règles pour le code de référence

1. **TypeScript strict** (`strictNullChecks`, `noUncheckedIndexedAccess`)
2. **Composition API uniquement** + `<script setup>` partout
3. **Pas de magie** — pas de plugin Vue custom, pas de directive maison, pas de mixin
4. **Une responsabilité par composable**
5. **Commentaires WHY, pas WHAT**
6. **Pas d'inheritance, juste composition** — pas d'`extends`, pas de classes
7. **Imports absolus avec `@/`**
8. **CSS scoped** + tokens Mozaic
9. **Pas de TODO/FIXME committés**

Le code doit être copiable tel quel dans une app réelle avec un minimum d'adaptation.

---

## Plan d'exécution — 5 PRs, ~5 jours

### PR 1 — Infra (1 jour)
- `src/app/` avec AppShell + AppSidebar + AppHeader + AppToaster
- Pinia stores (`toasts`, `ui` avec slowNetwork)
- `main.ts` modifié, `vite.config.ts` avec `base` via env
- Scripts package.json (`dev:all`, `build:app`, `build:all`, `deploy:app`)
- Page placeholder avec hello + toast button + slow network toggle qui passe à 4×

### PR 2 — Mock API + composables (0.5 jour)
- `mock/store.ts` (productStore avec insert/patch/remove)
- `mock/api.ts` (CRUD complet + getKpis + getProductMovements)
- `mock/seed.ts` + `mock/latency.ts`
- `composables/useProductList.ts` + `useDebouncedRef.ts`
- Test : page placeholder appelle l'API et logue

### PR 3 — DemoPage avec grid + KPIs + toolbar custom (1.5 jour)
- 4 `KpiCard` (CA avec sparkline, stock total, ruptures, promos) — calculés depuis le store
- `ToolbarActions` dans slot `#toolbar`
- Grid branché sur `useProductList` (pagination serveur)
- Cell renderers : `StatusCell`, `BrandCell`, `TagsCell`, `RatingCell`
- Pin start (ref, produit) + pin end (status)
- Density + filters + drag + `:persist-key` activés
- Loading + error states avec retry
- Empty state custom (slot `#empty`) si filtres → 0 résultats
- Toasts sur les actions

### PR 4 — Les 3 styles de filtres + group + edit + fill (1 jour)
- `filter: { type: 'text' / 'select' / 'date' }` sur 3 colonnes
- Slot `#filter-price` avec `PriceRangeSlider`
- `filter: { component: CategoryComboFilter, ... }` sur category
- Group by category activable
- Cell editors + `cellValidator` sur stock/name/price
- Fill handle
- `updateProduct` au commit inline + toast

### PR 5 — CRUD drawer + bulk + row expansion + deploy (1 jour)
- `ProductDrawer` création/édition (form Mozaic)
- `DeleteConfirmModal` + `BulkStatusModal` + `BulkActionBar`
- `ProductDetailExpand` avec mini grid mouvements
- Undo/redo (`historyId`)
- Build prod + déploiement Asustor

---

## Déploiement Asustor

`vite.config.ts` :
```ts
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  // …
})
```

Build :
```sh
VITE_BASE=/mrxgrid-app/ npm run build
```

Nginx :
```nginx
location /mrxgrid/ {
  alias /volume1/web/mrxgrid/storybook-static/;
  try_files $uri $uri/ /mrxgrid/index.html;
}
location /mrxgrid-app/ {
  alias /volume1/web/mrxgrid/app-dist/;
  try_files $uri $uri/ /mrxgrid-app/index.html;
}
```

Scripts :
```json
{
  "dev:all": "concurrently \"npm run dev\" \"npm run storybook\"",
  "build:app": "VITE_BASE=/mrxgrid-app/ vue-tsc --build && vite build",
  "build:all": "npm run build:app && STORYBOOK_BASE_PATH=/mrxgrid/ npm run build-storybook",
  "deploy:app": "npm run build:app && rsync -avz --delete dist/ asustor:/volume1/web/mrxgrid/app-dist/"
}
```

---

## TL;DR

> **Une page, CRUD complet en mémoire, qui exerce toutes les features de MrxGrid.** Server-side pagination/filtres/sort, 3 styles de filtres (inline natif / slot template / AG-Grid custom), cell renderers, row expansion, bulk actions (cell + row), group, drag, pin, persist, undo/redo, density, fullscreen. Mock API avec store JS local + latence + slow network toggle. Toasts partout. Au refresh, retour au seed (zéro complexité localStorage). Code écrit pour servir d'inspiration : TS strict, Composition API, `<script setup>`, composables single-responsibility, commentaires WHY.

5 PRs, ~5 jours. Go ?
