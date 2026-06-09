# Gotchas (annexe)

> Index des pièges connus rencontrés sur la lib + son écosystème (Vue 3, Angular 21, Mozaic, virtualisation). Référence rapide pour quand "ça marche pas comme prévu". Quand un piège n'existe que d'un côté, la section précise lequel — et le pendant de l'autre framework s'il existe.

## Pièges partagés Vue + Angular

### `dataVersion` : invariant après mutation in-place

Muter `row[field] = x` côté grid (`applyFills`, commit d'édition, paste en masse, clear) ne propage pas aux computeds qui ne lisent que la **référence d'array** (`filteredRows` quand aucun filter actif). La lib bump un `dataVersion` interne dans `applyFills` pour invalider la cascade `filteredRows → sortedRows → groupTree`.

- **Vue** — contrat manuel : si tu mutes en dehors de la lib, bump à la main :

  ```ts
  import { useGridState } from '@adeo/grid-vue'

  const state = useGridState()
  row.field = newValue
  state.dataVersion.value++   // ← force invalidation
  ```

- **Angular** — le graphe de signaux invalide automatiquement quand tu écris dans `WritableSignal`. Si tu mutes un objet de ligne sans `signal.set(...)`, tu retombes sur le même problème : appelle `gridState.dataVersion.update(v => v + 1)` après la mutation.

### `focusCell` idempotent

`focusCell(row, col)` est idempotent côté lib : si la cellule demandée est déjà focalisée, sans état transitoire à nettoyer (pas de ranges figés, pas de range vivant, pas de drag), le moteur retourne sans muter `focusedCell`. C'est un garde-fou contre les boucles de mise à jour récursives quand un watcher / `effect` réécrit la cellule à chaque tick. Comportement identique des deux côtés.

### Bulk emit threshold à 1000

Au-delà de 1000 cellules modifiées en une opération (Ctrl+A → Delete, paste range), la lib émet `bulkEdit` au lieu de `cellEdit` per-cell. **Si tu wires seulement `cellEdit`, le clear Ctrl+A ne fait rien côté API.** Wire `bulkEdit` aussi.

- **Vue** : émet `bulkEdit` + un alias deprecated `bulkCellEdit` en parallèle pour back-compat (retrait v2.0).
- **Angular** : n'émet que `bulkEdit`.

Payload identique des deux côtés (`{ changes: ReadonlyArray<{ rowIndex, field, oldValue, newValue }> }`).

### Export sur 1M rows = crash Chrome

L'export sérialise tout en mémoire (string géante puis un Blob). ~300 MB sur 1M rows. **Toujours scoper `selection` ou `visible`** sur les gros datasets, ou stream côté serveur. La lib défaut à `selection` quand il y en a une. Pareil Vue et Angular.

### `loading` vs `refreshing`

- `loading: true` → squelette plein écran. Use cases : premier load, page change, sort change, filter change, search.
- `refreshing: true` → aucun visuel par défaut. Active le slot `#loading` (Vue) / `[mozGridRefreshing]` (Angular) que tu peux remplir. Use case : refresh silencieux post-mutation.

**Bug typique** : tu mets `loading: true` à chaque refetch (même post-mutation) → squelette plein écran clignote à chaque cell-edit.
**Règle** : `silent: true` après mutation, `silent: false` après input utilisateur.

### Reset à la page 1 sur filter change

Quand le filtre change, le `total` peut chuter sous `page * pageSize` — la page courante n'existe plus côté serveur. Sans `page = 0` dans le watcher/effect de filter, l'API renvoie une page vide et l'utilisateur croit que son filtre a tout supprimé. Voir [Tutoriel 5](?path=/docs/tutoriel-tri-et-filtre-serveur--docs).

### Race condition sur le search debouncé

Si l'utilisateur tape "abc" puis efface tout de suite "abcd", l'API peut renvoyer les résultats de "abc" après ceux de "abcd". Le `fetchToken` du [Tutoriel 4](?path=/docs/tutoriel-fetch-pagination-serveur--docs) gère ça — vérifie qu'il est bien en place dans ton composable / service.

### Scope du slot/template d'éditeur

Quand tu fournis un éditeur custom, tu dois explicitement récupérer le contexte exposé par le grid.

- **Vue** — `<template #edit-brand>` sans destructuring → `field`, `editValue`, `commit`, etc. arrivent `undefined` :

  ```vue
  <!-- ❌ Faux -->
  <template #edit-brand>
    <BrandEditor :field="…" />  <!-- field = undefined -->
  </template>

  <!-- ✅ Bon -->
  <template #edit-brand="{ field, rowIndex, editValue, updateValue, commit }">
    <BrandEditor :field="field" :model-value="editValue" @commit="commit('down')" />
  </template>
  ```

- **Angular** — sur `<ng-template>`, déclare `let-ctx` ou les `let-x="x"` individuels :

  ```html
  <!-- ❌ Faux -->
  <ng-template #brandEditor>
    <brand-editor [field]="field" />   <!-- field non résolu -->
  </ng-template>

  <!-- ✅ Bon -->
  <ng-template #brandEditor let-ctx>
    <brand-editor [field]="ctx.field" [modelValue]="ctx.editValue" (commit)="ctx.commit('down')" />
  </ng-template>
  ```

### Header label en ellipsis quand serré

À partir de la version où `min-width: 120px` est enforcé sur le resize, le label header est `white-space: nowrap; text-overflow: ellipsis`. Tu vois `PROD…` au lieu de "Produit" si la colonne fait moins de ~150 px. **C'est intentionnel** — la sort indicator + kebab restent visibles. Le label complet reste accessible via hover (tooltip à venir). Identique Vue / Angular.

### Resize ne peut pas descendre sous 120 px

Hard floor sur le drag resize. **Pour aller plus bas**, déclare `ColumnDef.minWidth: '40px'` (par exemple pour une colonne d'actions icon-only). Ton minWidth gagne contre le default.

### `maxWidth` sur les longs textes

L'autosize au mount mesure avec canvas. Une description multi-lignes peut donner 1500 px → tasse les autres colonnes. **Mets toujours `maxWidth: '320px'` (ou similaire) sur les colonnes texte long.**

### Un seul pinned 'start' à la fois

Plusieurs `pinned: 'start'` colonnes écrasent la zone center. Garde un seul (généralement l'identifiant principal) pour qu'il fasse office de "row header".

### Auto-size all → seuil à 1000 samples

Le sampling est uniforme : `stride = rows / SAMPLE_CAP`. Le cap est à 1000 (auparavant 5000). Si ta donnée a un outlier extrême en row #237 qui n'est pas dans le sample, la colonne ne le voit pas. **L'utilisateur peut toujours drag-resize manuellement.**

### Resize → trigger sort

Bug classique : drag du resize handle, mouseup → browser fire un synthetic click sur le header → tri se déclenche. La lib gère ça via un flag `wasResizingRecently()` qui ignore le click pendant 200 ms après mouseup. **Si tu vois encore le bug, mets ta version à jour.** Fix appliqué aux deux frameworks.

### `scrollCellIntoView` au click — pas de scroll si visible

Click sur une cell **déjà visible** ne déclenche **pas** de scroll. Le trigger est strict : `cellTop < scrollTop` (caché derrière le sticky header) ou `cellBottom > viewportBottom`. La marge de confort ne padde que la **position cible** du scroll, pas la condition.

---

## Pièges Vue uniquement

### Muter `props.rows` directement

```ts
// ❌ Vue va warn, et la prop reste figée côté parent
props.rows.push(newProduct)
```

À la place, le parent gère son state et passe une nouvelle référence (ou mute via une référence partagée + signal). **Pendant Angular** : ce n'est pas un piège — un `Input` signal-based ne peut pas être muté côté composant. Mais si tu utilises `model()` two-way, n'oublie pas d'appeler `.set(...)` plutôt que de mettre la prop assignée directement.

### `storeToRefs` vs destructuring direct (Pinia)

Pinia + destructuring direct → perte de réactivité :

```ts
// ❌ Perd la réactivité
const { rows, total } = useProductsStore()

// ✅ Garde la réactivité
const { rows, total } = storeToRefs(useProductsStore())
```

**Pendant Angular** : les services `providedIn: 'root'` sont singletons par défaut — tu peux les `inject()` partout sans `storeToRefs` équivalent.

### `markRaw` sur les renderers

Sans `markRaw`, Vue wrap le composant en `reactive()` → identity breakdown, re-render à chaque accès :

```ts
// ❌ Triggers warnings + re-renders
export const YesNoRenderer = defineComponent({ … })

// ✅ Inerte côté réactivité
export const YesNoRenderer = markRaw(defineComponent({ … }))
```

**Pendant Angular** : pas d'équivalent. Les `Type<unknown>` passés comme renderer ne sont pas wrapped en proxy reactive — le piège n'existe pas.

### `reactive()` sur le payload du JSON

```ts
// ❌ Inutile — `ref()` deep-wrappe déjà
const data = reactive(jsonData)

// ✅ Suffisant
const data = ref(jsonData)
```

### Recompute des columns à chaque render

```ts
// ❌ Re-build à chaque keypress dans la searchbox
const columns = payload.meta.fields.map(buildColumn)

// ✅ Computed = cache la dernière valeur
const columns = computed(() => payload.meta.fields.map(buildColumn))
```

---

## Pièges Angular uniquement

### Reconstruire un tableau passé en input à chaque CD

```ts
// ❌ Une nouvelle référence à chaque getter call → OnPush re-render permanent
get columns() {
  return this.fields.map(buildColumn)
}
```

Utilise `computed()` (qui mémoïse) ou un `signal()` que tu mets à jour explicitement :

```ts
// ✅ Cache la dernière valeur, OnPush content
readonly columns = computed(() => this.fields().map(buildColumn))
```

### `effect()` qui boucle parce qu'il écrit dans un signal qu'il lit

```ts
// ❌ Boucle infinie
effect(() => {
  const r = this.rows()
  this.rows.set([...r, sentinel])  // re-trigger l'effet
})
```

Si tu dois muter en réponse, utilise `untracked()` ou passe par `allowSignalWrites` avec discernement. Pour les changements de page après filter (cf. tuto 5), c'est OK parce que `effect()` ne lit pas `page()` — on l'écrit seulement.

### Forgetting `provideHttpClient()` / `provideRouter()` etc.

Les services injectés par la lib (export, persistence) supposent que le bootstrap a appelé `provideHttpClient()` quand tu utilises `HttpClient`. Sans, le `inject(HttpClient)` throw en runtime. Idem `provideAnimations()` si tu actives certaines transitions.

### Zoneless + setTimeout inattendus

Le repo de la lib est conçu zoneless-friendly. Si tu utilises `setTimeout` pour différer une `signal.set()` dans ton composant et que tu es en mode zoneless, la CD ne tique pas automatiquement — entoure d'un `runInInjectionContext` + `markForCheck`, ou préfère `rAF` / `effect()`.

### `viewChild(Grid)` retourne `undefined` au premier `effect()`

`viewChild` est résolu après le premier rendu. Si tu appelles `this.gridRef()?.exportCsv()` dans le constructeur, c'est `undefined`. Soit tu utilises l'option `{ read: ... }` + un délai (`afterNextRender`), soit tu utilises un binding template direct (`(click)="gridRef()?.exportCsv()"`).

---

## Pièges Mozaic UI components

### `MSelect` (Vue) / `mc-select` (Angular) retournent des strings

Les deux sélecteurs sérialisent tout en string dans leur `<option value>`. Si tes options ont des booleans (`value: true`), tu reçois `"true"` au commit. **Coerce systématiquement** :

```ts
function coerceYesNo(v: unknown): true | false | null {
  if (v === true || v === 'true') return true
  if (v === false || v === 'false') return false
  return null
}
```

### `MDrawer.closeOnOverlay` fire sur le body

Par défaut `closeOnOverlay: true` ferme aussi sur les clicks **dans le dialog body** (clics sur whitespace entre les items). Le grid passe `false` sur ses drawers internes. **Fais pareil sur tes drawers** :

```ts
// Vue
<MDrawer :open="open" :close-on-overlay="false" title="…" />

// Angular
<mc-drawer [open]="open()" [closeOnOverlay]="false" title="…" />
```

L'utilisateur ferme via le bouton × ou le bouton "Apply" du footer.

### Datepicker Mozaic inutilisable en cellule contrainte

Quand tu mets `MDatepicker` (Vue) ou `mc-datepicker` (Angular) dans une cellule étroite (~150 × 40 px), les pseudo-éléments `::-webkit-datetime-edit-*` se stackent verticalement à cause de `display: flex` sur le wrapper. **Utilise `<input type="date">` natif** dans les éditeurs de cellule. La lib le fait par défaut quand tu mets `cellEditor: 'date'`.

---

## Patterns à NE PAS faire

### ❌ Importer toute la lib Mozaic dans `<ad-grid-vue>` / `<ad-grid-angular>`

La lib importe ce dont elle a besoin (composants tag pour le renderer 'tag', drawer pour les drawers internes). **Ne ré-importe pas** Mozaic dans ton wrapper — tu doubles le bundle.

### ❌ Faire un endpoint API par cellule sur Ctrl+A → Delete

Si tu wires `bulkEdit` mais sans grouper par field, tu refais le piège du fan-out (1M de PATCH au lieu de 7). Group **toujours** par field avant de fan-out l'API.

### ❌ Ignorer `excludedIds` en mode 'all'

Ne lis `selectedIds` qu'avec `mode: 'page' | 'none'`. En mode `'all'`, c'est `excludedIds` qui porte l'info. La propriété `count` du payload résume déjà ça.

---

## Versions où chaque bug est fixé

Pas encore versionné formellement — réfère à ton `CHANGELOG.md` pour le détail. Les bugs documentés ici sont fixés sur `main` à la date de cette doc (Juin 2026), pour les deux libs (`@adeo/grid-vue` et `@adeo/grid-angular`).

## Ressources connexes

- [Guide — Performance & états de chargement](?path=/docs/guide-performance--docs) — `loading` vs `refreshing` vs `pendingCells`
- [Spec — Sélection, édition, validation](?path=/docs/interactions--docs) — contrat canonique des events `cellEdit` / `bulkEdit`
- [Spec — Tree, expand, columns, theming, perf, API](?path=/docs/theming-performance-api--docs) — surface publique complète
