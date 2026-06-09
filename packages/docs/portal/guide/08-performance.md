# Performance

> Comment garder le grid à 60 fps même sur 100k lignes — et les pièges à éviter.

## Limites observées

| Métrique | Limite confortable | Limite ressentie |
|---|---|---|
| Lignes | 200 000 | 1 000 000+ |
| Colonnes | 500 | 2 000+ |
| Cellules en édition simultanée | 1 | 1 (par design) |
| Sélection rectangulaire | Range entier | Idem (les flags sont O(1)) |

La virtualisation 2D (vertical + horizontal) est toujours active — pas d'opt-in côté consommateur. Sur les petits datasets les engines sont des no-ops (coût négligeable).

## Patterns à suivre

### Utilise un identifiant de ligne stable pour les datasets non triviaux

Sans `rowId` / `rowIdField` stable, la sélection / les formules / l'expansion sont indexées par numéro de ligne et cassent au moindre re-tri.

#### Vue

```vue
<ad-grid-vue :rows="rows" :row-id="(row) => String(row.id)" />
```

#### Angular

```html
<ad-grid-angular [data]="rows()" rowIdField="id" />
```

### Pinne les colonnes critiques aux deux extrémités

La virtualisation horizontale étant toujours active, les pinned (start/end) sont **toujours rendus** — la slice ne couvre que la zone unpinned. Utile pour ID / actions.

### Stocke `columns` en dehors du composant si possible

Une réaffectation de l'array `columns` à chaque render fait recalculer le pipeline. Définis-le en module-level si statique, ou dans un `computed()` stable.

### Lazy-load la donnée en pages

50 000 lignes ne devraient pas être fetch d'un coup. Combine `totalItems` + l'événement de plage visible (`onVisibleRangeChange` Vue / `loadMore` Angular).

### Délègue au backend quand il peut le faire

Active `serverFilter` / `filterMode: 'server'` et `serverGrouping`. Le grid filtre / groupe en mémoire par défaut, ce qui est rapide jusqu'à ~ 50 000 lignes mais bloque l'UI au-delà.

### Côté Vue : utilise `markRaw()` sur les renderers custom

Les components Vue sont proxy-és par défaut ; `markRaw()` évite l'overhead du reactive system pour des shapes statiques (la classe de component n'a rien de réactif).

```ts
import { markRaw, defineComponent } from 'vue'

const StarRating = markRaw(defineComponent({ /* ... */ }))
{ field: 'rating', renderer: StarRating }
```

Côté Angular ce n'est pas nécessaire — passer directement la classe du composant suffit.

## Patterns à éviter

### Ne mute pas `rows` en place sans signal de fraîcheur

#### Vue — réassigne le `ref`

```ts
// ❌ pas tracké
rows.value[3].name = 'New'

// ✅ tracké
rows.value = rows.value.map((r, i) => i === 3 ? { ...r, name: 'New' } : r)
```

Si tu **dois** muter en place pour des raisons de perf (cf. `dataVersion` pattern), le grid s'en charge en interne pour les chemins critiques (édition de cellule, fill, paste, bulk clear). Pour tes propres mutations consommateur, préfère immutable.

#### Angular — réassigne le signal

```ts
// ❌ pas tracké
this.rows()[3].name = 'New'

// ✅ tracké
this.rows.update(list =>
  list.map((r, i) => i === 3 ? { ...r, name: 'New' } : r)
)
```

### Ne crée pas un new `ColumnDef[]` à chaque render

La référence d'array change → tout le pipeline recalcule.

#### Vue

```ts
// ❌
<ad-grid-vue :columns="rows.map(_ => ({ field: 'x', headerName: 'X' }))" />

// ✅
const columns = computed<ColumnDef[]>(() => [
  { field: 'x', headerName: 'X' },
  // …
])
```

#### Angular

```ts
// ❌
columns = signal<ColumnDef[]>([
  ...someExpensiveCalc(), // recomputed on every read
])

// ✅
private readonly _baseCols = COLS // module-level constant
columns = computed<ColumnDef[]>(() => this._baseCols)
```

### Ne mets pas le grid dans une boucle avec re-mount fréquent

Chaque mount alloue les engines, observers, listeners. Un seul grid utilise 1-3 MB de heap. Vue : évite un `v-for` autour du grid. Angular : évite un `@for` qui ré-instancie la directive.

### Ne fais pas d'IO dans `valueFormatter` / `valueGetter`

Ils sont appelés à chaque render de cellule (potentiellement 10 fois / seconde au scroll). Pre-compute en amont.

### Slots / templates de cellule lourds

N'utilise pas de gros slot `#cell` (Vue) ou `cellTemplate` (Angular) avec des subcomponents lourds. Le slot est instancié pour chaque cellule visible (jusqu'à 80 × 30). Côté Vue, combine `shallowRef` / `markRaw`. Côté Angular, garde le template léger et `OnPush` partout.

## Diagnostic — qu'est-ce qui freine ?

### Symptôme : scroll saccadé

1. Ouvre Chrome DevTools → Performance → Record un scroll
2. Cherche les long tasks (> 16 ms)
3. Si c'est dans *Scripting* → renderer custom trop lourd
4. Si c'est dans *Layout* → trop de cellules rendues (cap dépassé ?)
5. Si c'est dans *Painting* → CSS coûteux (filters, box-shadow, blend modes)

### Symptôme : freeze au tri / filtre

Le pipeline est synchrone. Pour 100 000+ lignes, un tri full-array peut prendre 100-300 ms. Solutions :

- Active le mode server-side et délègue au backend
- Ou : pré-trie les données côté serveur, désactive le tri client
- Ou : utilise un Web Worker (non livré, mais le moteur est pure-functions)

### Symptôme : clic sur cellule met > 100 ms à répondre

Probablement un re-render global. Vérifie que :

- Le parent ne rebind pas `columns` ou `rows` à chaque event
- Pas de `watch` (Vue) / `effect()` (Angular) qui fait un effet de bord lourd dans le consommateur

## Le contrat de performance interne (`dataVersion`)

Les mutations de ligne in-place (commit d'édition, drag de fill, clear en masse, paste) ne remplacent pas la ligne dans `sourceData`. Le grid maintient un signal interne `dataVersion: number` que chaque writer in-place bumpe **une fois après son lot**, et que chaque `computed` en aval (filter → sort → group) lit en haut pour enregistrer une dépendance.

C'est ce qui maintient les éditions cellule unique à un coût d'écriture O(1) — un splice immutable sur un tableau de 100k lignes serait O(N) par frappe, inacceptable.

Tu n'as **pas** à interagir avec `dataVersion` toi-même : il est interne. Si tu réassignes `rows` / `data` à un nouveau tableau, la réactivité fait son travail normalement.

## Feedback à trois niveaux (loading vs refreshing vs pending)

Le grid expose un modèle à trois niveaux pour que tu exposes le bon état de chargement pour la bonne opération :

| Niveau | Quand | Visuel par défaut |
|---|---|---|
| `loading: true` | Premier chargement, reset brutal — il n'y a pas encore de données | Squelette complet du body |
| `refreshing: true` | Refetch silencieux sous données existantes (sort, filter, pagination, post-save) | **Rien** — le grid n'affiche rien. Rempli un slot `#refreshing` (Vue) / `[mozGridRefreshing]` (Angular) avec ton visuel |
| `pendingCells: [{ rowId, field }]` | Mutation optimiste d'une cellule | Shimmer overlay sur la cellule |
| `pendingRows: [rowId]` (`pendingRowIds`) | Mutation à portée ligne (save, delete) | Overlay assombri + spinner sur la ligne |

Règle empirique : niveau cellule pour les éditions d'une cellule, niveau ligne pour les mutations à portée ligne, `refreshing` pour le refetch silencieux, squelette pour "pas de données à l'écran". Les mélanger est correct (par ex. `refreshing` + `pendingCells` pendant qu'un Save-then-refetch est en vol).

## Opt-out `bulkEdit`

Les opérations en masse (Ctrl+A → Delete, clear de plage, paste clear) émettent un unique événement `bulkEdit` avec l'ensemble complet de changements au lieu d'un fan-out par cellule de `cellEdit`. Le consommateur applique le batch comme un seul appel API + un seul cycle `refreshing`. Un `cellEdit` par cellule mettrait en file 1 M de Promises sur un clear de 1 M de lignes — mesuré comme gelant la page pendant plusieurs secondes.

Le fallback par cellule est automatique lorsque `bulkEdit` n'est pas câblé.

> Note Vue : un alias `bulkCellEdit` est émis en parallèle pour back-compat des consumers existants (deprecated, retrait en v2.0).

## Profiling — outils utiles

| Outil | Usage |
|---|---|
| **Vue DevTools** / **Angular DevTools** → Component tree | Voir combien de cellules sont instanciées (devrait être ≤ 80×30) |
| **Chrome Performance** | Record + flame chart pour identifier les long tasks |
| `console.time()` | Wrap un sort/filter custom pour mesurer son coût |
| Stories *Virtual Scroll* / *Stress test* | Démos avec 100k / 200 cols / 50k×100 — référence visuelle |
