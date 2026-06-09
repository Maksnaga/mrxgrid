# Granular skeleton loading — plan

## 1. Problème observé

Aujourd'hui le grid expose un seul flag `loading: boolean`. Quand il est `true`,
`GridBody` est entièrement remplacé par `<ad-grid-skeleton-body>` qui rend N
rows shimmer.

Côté demo, `useProductList.refetch()` setle `list.loading.value = true` pour
TOUTES les requêtes serveur (changement de page, sort, filtre, ET aussi les
refetch déclenchés par un `updateProduct` / `deleteProduct` / `updateProducts`).

Conséquence visuelle :

- Tu modifies une cellule "Stock" sur la ligne 3 → `updateProduct` → `refetch()`
  → toute la page de 25 lignes devient un skeleton pendant 200-800 ms
- Idem au moindre changement de tri ou de page
- L'utilisateur perd le contexte des lignes voisines pendant chaque
  micro-update

Ce qu'on veut :

| Action | Comportement attendu |
|---|---|
| Boot, rows vides | Skeleton plein écran (comportement actuel) ✓ |
| Refetch sort / filter / page | Rows restent visibles + barre de progression discrète en haut |
| Cell edit (1 cellule) | Skeleton uniquement sur **cette cellule** pendant l'API call |
| Fill handle (N cellules) | Skeleton sur **chaque cellule du fill** |
| Bulk update (M lignes, K fields) | Skeleton sur **les (rowId, field) ciblés** |
| Bulk delete | Lignes en `opacity: 0.4` + spinner discret pendant l'API call |
| Create | Optimistic row insérée avec skeleton sur tous ses champs jusqu'à confirmation serveur |

## 2. Architecture proposée

### 2.1 Trois niveaux d'indicateurs de loading

Le grid expose **3 props indépendants**, chacun pour un cas distinct :

```ts
interface GridProps {
  /**
   * Skeleton plein écran (body intégralement remplacé). Réservé au
   * cas "rows vides + premier fetch en vol".
   * Default: false.
   */
  loading?: boolean

  /**
   * Refetch silencieux (les rows sont visibles, mais une fetch
   * serveur est en cours pour changer le set). Affiche une barre
   * de progression fine en haut du grid, sans masquer les rows.
   * Default: false.
   */
  refreshing?: boolean

  /**
   * Identifiants des rows en cours de mutation (delete bulk, etc.).
   * Drive un overlay row-level (opacity dim + spinner).
   * Default: [].
   */
  pendingRowIds?: ReadonlyArray<string | number>

  /**
   * Cellules individuelles en attente (cell edit, fill, bulk per-field).
   * Drive un shimmer cell-level qui replace la valeur affichée.
   * Default: [].
   */
  pendingCells?: ReadonlyArray<{ rowId: string | number; field: string }>
}
```

Pourquoi 4 props et pas 1 enum ? Parce que **les 3 derniers se combinent** :
on peut avoir un bulk delete (rowIds) ET en parallèle un cell edit (pendingCells)
ET un refetch (refreshing). L'enum forcerait à prioriser, là on superpose les
indicateurs naturellement.

### 2.2 Mapping côté `GridCell` (cell-level)

Le composable d'édition expose déjà `getCellFlags(rowIndex, field): CellFlags`
qui drive les classes/edges de chaque cellule. On ajoute un flag `pending` :

```ts
interface CellFlags {
  selected?: boolean
  edgeTop?: boolean
  edgeBottom?: boolean
  // ...
  pending?: boolean // ← nouveau
}
```

Dans `Grid.vue`, on construit un `pendingLookup: Map<string, true>` indexé
par `${rowId}:${field}` à partir de `props.pendingCells`. `getCellFlags` consulte
cette Map et set le flag.

Côté `GridCell.vue`, le flag `pending` ajoute la classe `.grid-cell--pending`
qui rend un overlay shimmer **par-dessus** la valeur (et pas à la place — la
valeur reste lisible en filigrane, ce qui aide à comprendre quel champ
exactement est en train d'être pushé).

### 2.3 Mapping côté `GridRow` (row-level)

Symmétrique : `pendingRowIds` devient un `pendingRowLookup: Map<rowId, true>`
dans `Grid.vue`. `GridRow` reçoit un nouveau prop `pending: boolean` et
applique `.grid-row--pending` → `opacity: 0.55` + `pointer-events: none` + un
mini-spinner Mozaic dans la première cellule.

### 2.4 Refreshing — barre de progression

Quand `refreshing=true` et **pas** `loading=true`, on rend la barre fine
existante (`.grid-loading-bar`) au-dessus du wrapper, sans toucher au
body. C'est déjà le comportement actuel quand `loading=true` mais on déplace
ce signal sous un prop dédié pour pouvoir l'activer indépendamment du full
skeleton.

### 2.5 Hiérarchie de priorité (un seul écran à la fois)

Quand plusieurs flags se cumulent on applique l'ordre suivant :

1. `loading=true` → skeleton plein écran, on ignore le reste (rows vides
   par nature)
2. `error` set → error overlay, on ignore le reste
3. Sinon → rows visibles + cumul de `refreshing` (top bar) + `pendingRowIds`
   (row dim) + `pendingCells` (cell shimmer)

## 3. Composables côté demo

Pour piloter ces props sans cluttering `DemoPage.vue`, on extrait un petit
composable `usePendingMutations`.

### 3.1 `usePendingMutations`

```ts
// src/app/composables/usePendingMutations.ts
export function usePendingMutations() {
  const pendingCells = ref<{ rowId: string; field: string }[]>([])
  const pendingRowIds = ref<string[]>([])

  async function withCellPending<T>(
    rowId: string,
    field: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const entry = { rowId, field }
    pendingCells.value = [...pendingCells.value, entry]
    try {
      return await fn()
    } finally {
      pendingCells.value = pendingCells.value.filter(
        (c) => c.rowId !== rowId || c.field !== field,
      )
    }
  }

  async function withRowPending<T>(
    rowIds: string[],
    fn: () => Promise<T>,
  ): Promise<T> {
    pendingRowIds.value = [...pendingRowIds.value, ...rowIds]
    try {
      return await fn()
    } finally {
      const toRemove = new Set(rowIds)
      pendingRowIds.value = pendingRowIds.value.filter((id) => !toRemove.has(id))
    }
  }

  return { pendingCells, pendingRowIds, withCellPending, withRowPending }
}
```

Le composable rend l'API ergonomique : pas besoin de `try/finally` partout dans
`DemoPage`, on wrappe juste l'appel API.

### 3.2 Découplage `loading` / `refreshing` dans `useProductList`

`useProductList` aujourd'hui expose un seul `loading`. On le scinde :

```ts
const loading = ref(false)     // true SEULEMENT au premier fetch (rows vides)
const refreshing = ref(false)  // true à chaque refetch ultérieur (rows présentes)

async function refetch(): Promise<void> {
  const isInitial = rows.value.length === 0
  if (isInitial) loading.value = true
  else refreshing.value = true

  // ... fetch ...

  if (isInitial) loading.value = false
  else refreshing.value = false
}
```

Conséquence : changement de page / sort / filtre → `refreshing=true` →
juste la barre de progression, les rows précédentes restent visibles
jusqu'à arrivée des nouvelles.

Premier load (refresh navigateur) → `loading=true` → skeleton plein.

### 3.3 Câblage par action

| Action | Composable / API | Wrapper |
|---|---|---|
| `onCellEdit` | `updateProduct(id, { [field]: value })` | `withCellPending(rowId, field, ...)` |
| `onFill` | `updateProducts(ids, { [field]: value })` | `pendingCells = product(ids, [field])` (pour chaque cellule du fill) |
| `onBulkStatusUpdate` | `updateProducts(ids, { status })` | `withRowPending(ids, ...)` |
| `askDelete` confirm | `deleteProducts(ids)` | `withRowPending(ids, ...)` puis refetch |
| Drawer save (update) | `updateProduct(id, ...)` | `withRowPending([id], ...)` |
| Drawer save (create) | `createProduct(...)` | Pas de pending visuel pendant le call (on est dans le drawer modal) ; on déclenche juste `refetch()` après |

## 4. Rendering visuel détaillé

### 4.1 Cell shimmer (pending)

Overlay absolute sur `.grid-cell` qui hérite du gradient déjà défini dans
`GridSkeletonRow.vue`. CSS approximatif :

```scss
.grid-cell--pending {
  position: relative;
}

.grid-cell--pending::after {
  content: '';
  position: absolute;
  inset: 4px 8px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    rgba(var(--adeo-grid-skel-base-rgb), 0.85) 0%,
    rgba(var(--adeo-grid-skel-highlight-rgb), 0.95) 50%,
    rgba(var(--adeo-grid-skel-base-rgb), 0.85) 100%
  );
  background-size: 200% 100%;
  animation: adeo-grid-skeleton-shimmer 1.4s ease-in-out infinite;
  pointer-events: none;
}
```

`inset` (au lieu de `top: 0; left: 0; right: 0; bottom: 0`) garde la bordure de
la cellule visible et place le shimmer **dedans**, pas par-dessus la bordure.

### 4.2 Row dim (pending)

```scss
.grid-row--pending {
  opacity: 0.55;
  pointer-events: none;
}

.grid-row--pending .grid-row-spinner {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
}
```

Le spinner est rendu uniquement quand `pending=true`. Pas besoin de
shimmer cellule-par-cellule pour ce cas — la row entière étant en attente,
le dim global suffit.

### 4.3 Top progress bar (refreshing)

Déjà présente (`.grid-loading-bar`) — on la décorrèle du flag `loading`
en la rendant sous `props.refreshing` au lieu de `props.loading` :

```vue
<slot v-if="props.loading || props.refreshing" name="loading">
  <div class="adeo-grid-loading-bar" aria-hidden="true" />
</slot>
```

(L'inclusion sous `loading` reste pour le cas "skeleton plein + bar visible
au-dessus" — comportement actuel inchangé.)

## 5. Diff côté library

| Fichier | Changement |
|---|---|
| `Grid.vue` | + props `refreshing`, `pendingRowIds`, `pendingCells` ; + `pendingCellLookup` computed ; étendre `getCellFlags` ; étendre `loading` bar gating |
| `types.ts` | + champ `pending?: boolean` sur `CellFlags` |
| `GridCell.vue` | + classe `adeo-grid-cell--pending` selon `flags.pending` ; + styles overlay shimmer |
| `GridRow.vue` | + prop `pending?: boolean` + classe `adeo-grid-row--pending` + spinner |
| `GridBody.vue` | + prop `pendingRowSet` + pass-through au row |

Zéro breaking change : les 3 nouveaux props sont opt-in, default `false` /
`[]`. Les consumers qui ne touchent à rien gardent le comportement actuel.

## 6. Diff côté demo

| Fichier | Changement |
|---|---|
| `useProductList.ts` | Scinder `loading` en `loading` (initial) + `refreshing` (subséquents) |
| `usePendingMutations.ts` | Nouveau composable (cf. §3.1) |
| `DemoPage.vue` | Importer `usePendingMutations` ; wrapper chaque appel API mutateur ; binder `:refreshing`, `:pending-cells`, `:pending-row-ids` sur le grid |

## 7. Edge cases

### 7.1 Refetch après mutation

Sequence type :

1. `onCellEdit` mute `row[field]` localement (mutation directe par le grid)
2. `withCellPending('product-42', 'stock', () => updateProduct(...))` → shimmer
3. `updateProduct` résout → shimmer levé
4. Pas de refetch nécessaire (la valeur affichée matche déjà le serveur)

Optionnel : si tu veux invalider la cellule après succès (au cas où le serveur
aurait normalisé la valeur), append un `refetch()` discret (le `refreshing`
flag sera levé tout seul si on le scinde comme proposé en §3.2). Pour la
demo qui n'a pas de normalisation côté serveur, on saute ce refetch.

### 7.2 Mutation qui échoue

Le `try/finally` du wrapper lève toujours le pending — même si l'API throw.
Sur erreur :

- Toast d'erreur (déjà fait dans `DemoPage`)
- Rollback de `row[field]` à la valeur précédente — actuellement absent dans
  la demo, on garderait `e.oldValue` quelque part. Hors scope de ce plan.

### 7.3 Mutations qui se chevauchent

Tu modifies cellule A pendant que cellule B est encore en attente. Deux entrées
dans `pendingCells`. Le filter du `finally` retire **seulement** l'entrée
correspondante. ✓

### 7.4 Pagination pendant pending

Tu changes de page alors qu'une cellule est en pending. Quand les nouvelles
rows arrivent, le `rowId` du pending pointe peut-être sur une row qui n'est
plus dans la viewport. Comportement : invisible pour l'utilisateur (la row
n'est plus rendue), mais l'entrée pending reste jusqu'au resolve de l'API.
Acceptable — l'utilisateur peut revenir sur la page d'avant pour voir le
résultat.

### 7.5 Coût perf

`pendingCells: ReadonlyArray<{rowId, field}>` est lookup `O(N)` à chaque
appel de `getCellFlags`. Si N reste petit (< 50 cellules en pending
simultanément), c'est négligeable. Au-delà, on backe par une `Map<string,
true>` indexée par `${rowId}:${field}`. La conversion se fait dans le
`computed` du grid → coût payé 1 fois par changement de `pendingCells`,
pas par cellule rendue.

## 8. Roadmap d'implémentation

| Étape | Description | Estim |
|---|---|---|
| PR 1 | Library : `CellFlags.pending` + classes CSS cell-level + nouveaux props `pendingCells` + `refreshing` | 1h |
| PR 2 | Library : `pendingRowIds` + classe row-level + spinner | 30 min |
| PR 3 | Demo : composable `usePendingMutations` + scission `loading/refreshing` dans `useProductList` | 30 min |
| PR 4 | Demo : wiring sur `onCellEdit`, `onFill`, `onBulkStatusUpdate`, `askDelete`, drawer update | 1h |
| PR 5 | Tests visuels (Storybook story dédiée) + petit screenshot diff | 30 min |

Total ~3h30 si tout se passe bien.

## 9. Questions ouvertes

1. **Spinner row-level** : Mozaic `MLoader` ou icône SVG inline ? `MLoader` est
   plus cohérent mais ~10kb gzip, et déjà importé pour le footer de chargement.
   → Proposition : réutiliser `MLoader size="xs"`.

2. **Animation de transition** quand un pending est levé ? Fade-out 200ms du
   shimmer pour éviter le snap ? Probablement overkill, on commence sans.

3. **Annonce a11y** : faut-il un `aria-live="polite"` qui dit "Mise à jour de
   <field> sur ligne <n>" ? Probablement oui pour la conformité, à voir si
   c'est dans le scope du grid ou du consumer.

4. **Le composable `usePendingMutations` reste-t-il demo-only** ou on l'extrait
   dans `@/components/Grid` pour que les autres consumers en profitent ?
   → Proposition : demo-only pour PR 1-4, extraction en PR 6 si on a un autre
   consumer qui en a besoin.
