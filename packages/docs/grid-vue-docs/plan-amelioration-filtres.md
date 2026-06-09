# Plan : Amélioration du système de filtres de Grid (Vue 3)

> Adaptation du plan d'origine `ad-grid` (Angular) au composant **Grid**
> (Vue 3 + TypeScript). Mêmes objectifs fonctionnels, idiomes Vue.

---

## 0. Note d'adaptation — `ad-grid` (Angular) → Grid (Vue 3)

Le plan d'origine vise le grid Angular. Voici la correspondance des idiomes,
appliquée dans tout ce document.

| Angular (`ad-grid`) | Vue 3 (Grid) |
|---|---|
| `signal<T>(v)` | `ref<T>(v)` |
| `computed(() => …)` | `computed(() => …)` (identique) |
| `input<T>()` | entrée de `defineProps<{ … }>()` |
| `output<T>()` | entrée de `defineEmits<{ … }>()` |
| `effect(() => state.x.set(this.x()))` | `watch(() => props.x, v => { state.x.value = v }, { immediate: true })` |
| `FilterEngine` (service Angular injectable) | `useFilterEngine(state)` (composable factory) |
| « méthode privée » d'un service | fonction interne (closure) du composable |
| `abstract class AdeoGridCustomFilter` à étendre | **aucune classe** — un filtre custom est un simple composant Vue qui respecte un contrat props/emits |
| `Type<AdeoGridCustomFilter>` | `Raw<Component>` (déjà le type de `renderer` / `filterRenderer`) |
| directive `[mozCustomFilterHost]` + `ViewContainerRef.createComponent` | `<component :is="…">` natif — **pas de directive, pas de nouveau fichier** |
| `InputSignal` / `OutputEmitterRef` | non applicable — props/emits Vue |

**Conséquence majeure** : la Phase 2 est plus simple en Vue. Là où Angular doit
créer une directive hôte pour instancier dynamiquement le composant, Vue le fait
nativement avec `<component :is>`. Le §3.7 du plan Angular (la directive) n'a
**pas d'équivalent** ici.

---

## Réponses aux questions ouvertes (reprises du plan Angular, validées)

1. `filterMode` est **grid-level uniquement** — pas d'override par colonne.
2. `filterComponent` cible uniquement le **builder** (drawer / overlay colonne).
   La ligne de filtre rapide (sub-header) continue d'utiliser ses propres
   mécanismes — `filter: FilterDef`, `filterRenderer`, slot `#filter-{field}`,
   et l'état `state.quickFilters` — indépendamment.
3. `isConditionComplete` reste **inchangé** dans sa signature publique — voir §3.4.
4. Les filtres custom respectent `filterMode` comme les autres : `'client'` →
   évalue via `filterPredicate`, `'server'` → `filterData()` passe la donnée
   telle quelle, l'event est émis, le consumer recharge et repasse `:rows`.

---

## 1. Contexte et état actuel

### Ce qui existe

- `useFilterEngine.filterData()` branche déjà sur `state.mode.value === 'server'`.
  Mais `state.mode` est le mode **global** de la grid. Pire qu'en Angular : dans
  `Grid.vue`, `state.mode` est piloté par
  `props.serverFilter ?? !!props.serverGrouping` — donc activer le **grouping
  serveur force le filtrage en mode serveur** et désactive l'évaluation cliente.
  Découplage nécessaire.
- `useFilterEngine.filterData()` compose deux sources : les **quick filters**
  (`state.quickFilters`, ligne de filtre rapide) et le **`filterModel`** formel
  (builder : drawer + overlay colonne). Les deux doivent passer (AND). Hors
  scope ici — seul le modèle formel est touché.
- `ColumnDef.filter?: FilterDef` (legacy) et `ColumnDef.filterRenderer` : ligne
  de filtre rapide. Restent intacts, hors scope.
- `FilterEngine.lastEvent` (`Ref<FilterEvent | null>`) émet à chaque mutation ;
  `Grid.vue` le réémet via `emit('filterChange', …)`. **Aucun changement sur
  l'émission d'événement.**

### Ce qui manque

1. Un `filterMode` découplé du `mode` global (et de `serverFilter` / `serverGrouping`).
2. Un composant Vue autonome comme éditeur de valeur dans le builder, avec sa
   propre logique de complétion et de filtrage client.

---

## 2. Phase 1 — `filterMode` découplé

### 2.1 `models/filter.model.ts`

Ajouter :

```ts
export type FilterMode = 'client' | 'server'
```

### 2.2 `state/useGridState.ts`

Ajouter un signal indépendant de `mode`, déclaré dans l'interface `GridState`
et instancié dans `useGridState()` :

```ts
// interface GridState
readonly filterMode: Ref<FilterMode>

// dans useGridState()
const filterMode = ref<FilterMode>('client')
// … et l'exposer dans l'objet retourné, à côté de `mode`, `filterModel`, etc.
```

Défaut `'client'` : comportement actuel préservé, zéro breaking change.

### 2.3 `Grid.vue`

Ajouter une prop dans le bloc `defineProps` :

```ts
/**
 * Mode du filtrage, indépendant du mode global de la grille.
 * - 'client'  : évaluation en mémoire (défaut).
 * - 'server'  : la grille n'évalue rien, émet `filterChange`, le consumer
 *               recharge et repasse les lignes via `:rows`.
 * Prend le pas sur la prop legacy `serverFilter`.
 */
filterMode?: FilterMode
```

Importer le type depuis `./models/filter.model` (l'import de ce module existe déjà).

Câblage — un `watch` à côté de celui qui existe déjà pour `serverFilter → state.mode`.
La prop explicite `filterMode` l'emporte ; sinon on retombe sur la prop legacy
`serverFilter` (rétro-compatibilité totale) :

```ts
watch(
  () => props.filterMode ?? (props.serverFilter ? 'server' : 'client'),
  (m) => { gridState.filterMode.value = m },
  { immediate: true },
)
```

> Le `watch` existant `serverFilter ?? !!serverGrouping → state.mode` **reste
> inchangé** : `state.mode` continue de piloter le grouping serveur et la
> pagination. On se contente de retirer le filtrage de sa dépendance.

### 2.4 `features/useFilterEngine.ts`

Dans `filterData()`, remplacer :

```ts
if (state.mode.value === 'server') return data
```

par :

```ts
if (state.filterMode.value === 'server') return data
```

> **Comportement Phase 1**
> - `filterMode="client"` (défaut) : évaluation en mémoire. Identique à aujourd'hui.
> - `filterMode="server"` : `filterData()` retourne la donnée brute, `filterChange`
>   est émis. Le consumer recharge ses données et repasse le tableau via `:rows`.
> - `serverGrouping` actif **+** `filterMode="client"` : grouping serveur,
>   filtrage client — **désormais possible** (impossible aujourd'hui).
> - `serverFilter` (legacy) continue de fonctionner : en l'absence de `filterMode`,
>   il pilote toujours le mode de filtrage.

---

## 3. Phase 2 — Filtres custom

### 3.1 Contrat du composant custom (`models/filter.model.ts`)

Pas de classe de base en Vue. Un filtre custom est un **composant Vue** (SFC
`<script setup>`) qui respecte un contrat props/emits. On le documente par des
interfaces TypeScript :

```ts
import type { Component, Raw } from 'vue'

/**
 * Contrat d'un composant de filtre custom rendu dans le builder.
 *
 * Le builder le monte via `<component :is>` et câble prop + emit — le
 * composant n'a pas besoin de connaître le builder ni le moteur.
 *
 *   defineProps<AdeoCustomFilterProps>()
 *   defineEmits<AdeoCustomFilterEmits>()
 */
export interface AdeoCustomFilterProps {
  /** Condition courante, injectée par le builder à chaque changement. */
  condition: FilterCondition
}

export interface AdeoCustomFilterEmits {
  /** À émettre à chaque changement de valeur produit par le composant. */
  (e: 'conditionChange', value: FilterValue): void
}

/** Type d'un composant de filtre custom (valeur de `ColumnDef.filterComponent`). */
export type AdeoCustomFilterComponent = Raw<Component>
```

> `filter.model.ts` est ré-exporté par `types.ts` (`export * from './models/filter.model'`),
> lui-même ré-exporté par le barrel `index.ts`. Ces types sont donc
> automatiquement publics — aucun ajout d'export à faire.

### 3.2 Nouveaux champs sur `FilterColumnDescriptor` (`models/filter.model.ts`)

```ts
export interface FilterColumnDescriptor {
  // … champs existants …

  /** Composant custom à rendre dans le builder à la place de l'éditeur générique. */
  filterComponent?: AdeoCustomFilterComponent

  /**
   * Détermine si la condition est « complète » (peut participer à l'évaluation).
   * Si absent, la règle par défaut s'applique : value.value != null && != ''.
   */
  filterIsComplete?: (value: FilterValue) => boolean
}
```

`FilterDataType` accueille `'custom'` :

```ts
export type FilterDataType = 'text' | 'number' | 'date' | 'set' | 'boolean' | 'custom'
```

### 3.3 Nouveaux champs sur `ColumnDef` (`types.ts`)

Ajouter, à côté des champs `filter*` existants (`filterable`, `filterType`,
`filterOperators`, …) :

```ts
/** Composant Vue custom pour l'éditeur de valeur dans le builder de filtres. */
filterComponent?: import('./models/filter.model').AdeoCustomFilterComponent

/**
 * Logique d'évaluation cliente d'un filtre custom en filterMode="client".
 * Si absent et filterMode="client", la condition custom est silencieusement ignorée.
 */
filterPredicate?: (row: T, value: import('./models/filter.model').FilterValue) => boolean

/**
 * Détermine si la condition est « complète ». Si absent, la règle par défaut :
 * value.value != null && value.value !== ''.
 */
filterIsComplete?: (value: import('./models/filter.model').FilterValue) => boolean
```

> ⚠️ Ne pas confondre avec `ColumnDef.filter?: FilterDef` (legacy, ligne de
> filtre rapide) ni avec `FilterDef.predicate` : ce sont des mécanismes
> distincts, conservés tels quels.

### 3.4 `isConditionComplete` — inchangé

La fonction publique `isConditionComplete(condition: FilterCondition): boolean`
(`models/filter.model.ts`) **n'est pas modifiée**. Signature et comportement
identiques pour les 5 types built-in.

La logique de complétion des filtres custom vit **uniquement dans
`useFilterEngine`**, via une fonction interne (closure) :

```ts
// dans useFilterEngine(), à côté des autres helpers internes
function isComplete(condition: FilterCondition, col: ColumnDef<T> | undefined): boolean {
  if (resolveFilterType(col) === 'custom') {
    const fn = col?.filterIsComplete
    return fn
      ? fn(condition.value)
      : condition.value.value != null && condition.value.value !== ''
  }
  return isConditionComplete(condition)
}
```

`filterData()` utilise ensuite `isComplete(c, defMap.get(c.field))` au lieu
d'appeler directement `isConditionComplete` sur le modèle formel. Aucun site
d'appel externe n'est impacté.

### 3.5 `features/useFilterEngine.ts` — dispatch custom dans `filterData()`

Rappel : `filterData()` compose **quick filters** + **modèle formel**. Le
dispatch custom ne concerne **que le modèle formel** (le builder). Les quick
filters continuent d'utiliser `matchOne` directement — inchangés.

Deux changements dans la partie « modèle formel » de `filterData()` :

```ts
// AVANT
const formal = state.filterModel.value.conditions.filter(isConditionComplete)
// …
let pass = matchOne(row, first.cond, first.col, first.type)
// …
const result = matchOne(row, step.cond, step.col, step.type)

// APRÈS
const formal = state.filterModel.value.conditions
  .filter((c) => isComplete(c, defMap.get(c.field)))
// …
let pass = matchFormal(row, first)
// …
const result = matchFormal(row, step)
```

Nouvelle fonction pure au niveau module, à côté de `matchOne` :

```ts
/**
 * Évaluation d'une condition du modèle formel. Pour le type `custom`, délègue
 * au `filterPredicate` de la colonne ; sinon retombe sur `matchOne` (les 5
 * types built-in). Une condition custom sans `filterPredicate` est ignorée
 * (retourne `true`) — normal en filterMode="server".
 */
function matchFormal<T>(
  row: T,
  item: { cond: FilterCondition; col: ColumnDef<T> | undefined; type: FilterDataType },
): boolean {
  if (item.type === 'custom') {
    const fn = item.col?.filterPredicate
    return fn ? fn(row, item.cond.value) : true
  }
  return matchOne(row, item.cond, item.col, item.type)
}
```

> `matchOne` reste **strictement inchangé** et continue de servir les quick
> filters. Seul le modèle formel passe par `matchFormal`.

### 3.6 `resolveFilterType()` et `describeColumn()`

Pour que `filterData()` (qui calcule `type` via `resolveFilterType`) **et** le
builder (qui lit `descriptor.filterType`) s'accordent, `resolveFilterType` doit
renvoyer `'custom'` dès qu'une colonne déclare `filterComponent`.

`resolveFilterType()` — ajouter une branche en tête :

```ts
function resolveFilterType<T>(def: ColumnDef<T> | undefined): FilterDataType {
  if (!def) return 'text'
  if (def.filterComponent) return 'custom'   // ← nouveau, prioritaire
  if (def.filterType) return def.filterType
  switch (def.cellEditor) {
    // … inchangé …
  }
}
```

`describeColumn()` — court-circuit pour le type custom :

```ts
function describeColumn(def: ColumnDef<T>): FilterColumnDescriptor {
  if (def.filterComponent) {
    return {
      field: def.field,
      headerName: def.headerName ?? def.field,
      filterType: 'custom',
      operators: [],                 // non utilisé pour le type custom
      defaultOperator: 'equals',     // valeur neutre requise par le type
      filterComponent: def.filterComponent,
      filterIsComplete: def.filterIsComplete,
    }
  }
  // … logique existante pour les 5 types built-in …
}
```

### 3.7 Pas de directive hôte

Le plan Angular crée une directive `[mozCustomFilterHost]` pour instancier le
composant via `ViewContainerRef`. **En Vue, rien de tel** : `<component :is>`
monte un composant dynamiquement de façon native. Cette étape n'existe pas —
le rendu se fait directement dans le template du builder (§3.8).

### 3.8 `GridFilterBuilder.vue` — template

Le builder reçoit déjà `columns: FilterColumnDescriptor[]` (qui portent
désormais `filterComponent`) et expose `descriptorFor(field)`.

**(a) Masquer le sélecteur d'opérateur pour le type custom** — l'opérateur n'a
pas de sens quand le composant gère sa propre sémantique :

```vue
<select
  v-if="descriptorFor(condition.field)?.filterType !== 'custom'"
  class="adeo-grid-filter-builder__field adeo-grid-filter-builder__field--operator"
  :value="condition.operator"
  @change="onOperatorChange(condition.id, ($event.target as HTMLSelectElement).value)"
>
  <option v-for="op in operatorsFor(condition.field)" :key="op" :value="op">
    {{ OPERATOR_LABELS[op] ?? op }}
  </option>
</select>
```

**(b) Brancher le composant custom comme éditeur de valeur** — avant le
`<template>` des éditeurs génériques. Le `<template v-if="!isValueless(...)">`
existant devient un `v-else-if` :

```vue
<!-- Éditeur de valeur : composant custom ou éditeurs génériques -->
<component
  v-if="
    descriptorFor(condition.field)?.filterType === 'custom' &&
    descriptorFor(condition.field)?.filterComponent
  "
  :is="descriptorFor(condition.field)!.filterComponent"
  class="adeo-grid-filter-builder__custom"
  :condition="condition"
  @condition-change="onCustomChange(condition.id, $event)"
/>
<template v-else-if="!isValueless(condition.operator)">
  <!-- éditeurs génériques existants : set / boolean / range / scalar -->
</template>
```

Handler à ajouter dans le `<script setup>` (le composant custom émet une
`FilterValue` complète ; on la pose telle quelle dans le patch) :

```ts
import type { FilterValue } from '../../models/filter.model'

function onCustomChange(id: string, value: FilterValue): void {
  emit('update', id, { value })
}
```

> `GridFilterDrawer.vue` et `ColumnFilterOverlay.vue` rendent ce builder
> et lui passent les descripteurs — **aucune modification** : le `filterComponent`
> transite via le descripteur, le builder s'occupe du rendu.

### 3.9 `Column.vue` — API déclarative (optionnel)

Si les consumers utilisent l'API déclarative `<ad-grid-column>` plutôt que la prop
`:columns`, ajouter les trois props et les inclure dans le `def` calculé :

```ts
// defineProps
filterComponent?: import('./models/filter.model').AdeoCustomFilterComponent
filterPredicate?: (row: RowData, value: FilterValue) => boolean
filterIsComplete?: (value: FilterValue) => boolean

// computed def<ColumnDef>
filterComponent: props.filterComponent,
filterPredicate: props.filterPredicate,
filterIsComplete: props.filterIsComplete,
```

Sans ce point, les filtres custom ne sont configurables que via la prop
`:columns`.

---

## 4. Exemple d'usage complet

### 4.1 Composant de filtre custom — combobox autocomplete (mode server)

```vue
<!-- AutocompleteFilter.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  FilterCondition,
  FilterValue,
} from '@/components/Grid'

const props = defineProps<{ condition: FilterCondition }>()
const emit = defineEmits<{ conditionChange: [value: FilterValue] }>()

const search = ref('')
const suggestions = ref<{ value: string; label: string }[]>([])

const selected = computed<string[]>(() => {
  const v = props.condition.value.value
  return Array.isArray(v) ? (v as string[]) : []
})

async function onSearch(e: Event): Promise<void> {
  const q = (e.target as HTMLInputElement).value
  search.value = q
  suggestions.value = await fetchAutocomplete(q) // faux appel API
}

function toggle(value: string): void {
  const next = selected.value.includes(value)
    ? selected.value.filter((v) => v !== value)
    : [...selected.value, value]
  emit('conditionChange', { value: next })
}
</script>

<template>
  <div class="autocomplete-filter">
    <input :value="search" placeholder="Rechercher…" @input="onSearch" />
    <label v-for="opt in suggestions" :key="opt.value">
      <input
        type="checkbox"
        :checked="selected.includes(opt.value)"
        @change="toggle(opt.value)"
      />
      {{ opt.label }}
    </label>
  </div>
</template>
```

Définition de la colonne :

```ts
import { markRaw } from 'vue'
import AutocompleteFilter from './AutocompleteFilter.vue'

const columns: ColumnDef[] = [
  {
    field: 'productId',
    headerName: 'Produit',
    filterable: true,
    filterComponent: markRaw(AutocompleteFilter),
    filterIsComplete: (v) => Array.isArray(v.value) && (v.value as string[]).length > 0,
    // filterPredicate absent → ignoré côté client, normal en filterMode="server"
  },
]
```

```vue
<ad-grid-vue
  :columns="columns"
  :rows="rows"
  filter-mode="server"
  @filter-change="onFilterChange"
/>
<!-- onFilterChange → appelle l'API, récupère les lignes filtrées,
     met à jour :rows (et :total-count si pagination serveur) -->
```

### 4.2 Filtre custom en mode client

```ts
{
  field: 'tags',
  headerName: 'Tags',
  filterable: true,
  filterComponent: markRaw(TagsFilter),
  filterIsComplete: (v) => Array.isArray(v.value) && (v.value as string[]).length > 0,
  filterPredicate: (row, v) =>
    (v.value as string[]).some((tag) => (row.tags as string[]).includes(tag)),
}
```

```vue
<ad-grid-vue :columns="columns" :rows="rows" filter-mode="client" />
<!-- filterPredicate appelé directement, aucun aller-retour serveur -->
```

> `markRaw(...)` évite que Vue rende le composant réactif (recommandé pour tout
> composant stocké dans des données — cohérent avec `renderer` / `filterRenderer`).

---

## 5. Fichiers impactés — récapitulatif

| Fichier | Nature du changement |
|---|---|
| `models/filter.model.ts` | + `FilterMode` ; + `'custom'` dans `FilterDataType` ; + `AdeoCustomFilterProps` / `AdeoCustomFilterEmits` / `AdeoCustomFilterComponent` ; + `filterComponent` / `filterIsComplete` sur `FilterColumnDescriptor` |
| `types.ts` | + `filterComponent`, `filterPredicate`, `filterIsComplete` sur `ColumnDef` |
| `state/useGridState.ts` | + `filterMode: Ref<FilterMode>` (interface + `ref('client')` + export) |
| `Grid.vue` | + prop `filterMode` ; + `watch` de câblage (`filterMode ?? serverFilter`) |
| `features/useFilterEngine.ts` | `filterData()` → `state.filterMode` ; helper interne `isComplete()` ; fonction pure `matchFormal()` ; `resolveFilterType()` et `describeColumn()` reconnaissent `'custom'` |
| `components/overlays/GridFilterBuilder.vue` | + branche `<component :is>` pour le type `'custom'` ; masquage du `<select>` opérateur ; handler `onCustomChange` |
| `Column.vue` *(optionnel)* | + 3 props déclaratives + inclusion dans le `def` calculé |

> **Non impacté** : `isConditionComplete()` (signature publique inchangée),
> `matchOne()` (continue de servir les quick filters), `GridFilterDrawer.vue`,
> `ColumnFilterOverlay.vue`, `GridFilterTagsBar.vue`, la ligne de filtre
> rapide (`FilterDef` / `filterRenderer` / slot `#filter-{field}` / `state.quickFilters`),
> tous les autres engines, les specs existants, le watch `serverFilter → state.mode`.
>
> **Aucun nouveau fichier** (contrairement au plan Angular : pas de directive hôte).

---

## 6. Séquence de livraison recommandée

1. **Phase 1** (`filterMode`) : merge autonome, testable immédiatement, aucun
   risque (défaut `'client'` = comportement actuel). Vérifier le cas
   `serverGrouping` + `filterMode="client"` : grouping serveur, filtrage client.
2. **Phase 2 — modèles + moteur** : `filter.model.ts`, `types.ts`,
   `useGridState.ts`, `useFilterEngine.ts` — compilable et testable (unit)
   sans toucher au template.
3. **Phase 2 — UI** : branche `<component :is>` dans `GridFilterBuilder.vue`
   (+ `Column.vue` si l'API déclarative est utilisée) — intégration finale,
   à valider avec l'exemple autocomplete dans Storybook
   (`Grid.Filtering.stories.ts`).

> Tests : `useFilterEngine.spec.ts` existe déjà — l'étendre avec un cas
> `filterMode` et un cas filtre custom (`filterPredicate` + `filterIsComplete`).
