# AdeoGrid — Guide : ajouter une nouvelle feature

> Document **pratique**, aligné sur le code réel (`src/lib/grid/`).
> Pour le blueprint de conception d'origine, voir [`ARCHITECTURE.md`](./ARCHITECTURE.md) — certaines
> parties y sont datées (ex. `cdk-virtual-scroll`, `data-source.ts`) ; **ce document fait foi**
> sur la structure actuelle et la marche à suivre.

---

## 1. Le modèle mental en 30 secondes

Le grid est découpé en **4 couches**, du plus « bête » au plus « intelligent » :

```
┌─────────────────────────────────────────────────────────────┐
│  COMPOSANTS (rendu)                                         │
│  grid.ts (host) · header · body · row · cell · footer …     │
│  → reçoivent des signaux, émettent des events, ZÉRO logique │
├─────────────────────────────────────────────────────────────┤
│  ENGINES (logique métier, "headless")                       │
│  GridEngine (pipeline) · SortEngine · FilterEngine …        │
│  → lisent/écrivent l'état, exposent méthodes + computed     │
├─────────────────────────────────────────────────────────────┤
│  STATE                                                      │
│  GridStateManager → la SEULE source de vérité (signaux)     │
├─────────────────────────────────────────────────────────────┤
│  MODELS                                                     │
│  types/interfaces (ColumnDef, SortDef, FilterModel …)       │
└─────────────────────────────────────────────────────────────┘
```

Quatre règles qui ne se négocient pas :

1. **L'état est centralisé.** Tout signal partagé vit dans `GridStateManager` (`state/grid-state.ts`). Un engine ne possède _jamais_ l'état partagé ; il ne possède que de l'état local privé (ex. `lastChange` dans `FilterEngine`).
2. **Les engines sont headless.** Du TypeScript pur (signaux Angular autorisés), pas de manipulation de template. Ils sont testables sans DOM.
3. **Les composants sont bêtes.** Ils bindent des `computed()` et appellent des méthodes d'engine sur les events. Aucune logique métier dans un `.html` ou un `.ts` de composant de rendu.
4. **Un engine = une responsabilité.** Un fichier `features/<nom>.engine.ts` par concern.

---

## 2. Les briques, en détail

### 2.1 `GridStateManager<T>` — l'état (`state/grid-state.ts`)

Un `@Injectable()` (sans `providedIn`) qui n'est **que** des signaux :

- `signal()` writables pour l'état brut (`sourceData`, `activeSorts`, `filterModel`, `pageIndex`, `selectedRowIds`…) ;
- `computed()` pour l'état dérivé _structurel_ (`visibleColumns`, `pinnedLeftColumns`, `gridTemplateColumns`, `totalPages`…).

> Règle : un `computed` qui dépend **uniquement** de l'état va ici. Un `computed` qui orchestre
> plusieurs engines (le pipeline de données) va dans `GridEngine`.

### 2.2 `GridEngine<T>` — le pipeline (`engine/grid-engine.ts`)

C'est l'orchestrateur. Il enchaîne des `computed()` **mémoïsés** qui transforment la donnée :

```
sourceData
  → sortedData      (SortEngine)
  → filteredData    (FilterEngine)
  → paginatedData   (slice pageIndex/pageSize)
  → displayRows     (GroupEngine si groupé, sinon wrap en DisplayRow[])
```

Chaque étape **court-circuite en mode serveur** (`if (this.state.mode() === 'server') return data;`) parce qu'alors c'est le back-end qui trie/filtre/pagine.

La mémoïsation est gratuite : si seul le tri change, `filteredData` renvoie sa référence en cache et le groupage ne recalcule pas.

### 2.3 Les feature engines (`features/*.engine.ts`)

Le pattern canonique (cf. `SortEngine`, `FilterEngine`) :

```typescript
@Injectable() // PAS de providedIn — fourni au niveau du composant grid
export class SortEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  // 1. Des méthodes qui MUTENT l'état
  toggleSort(field: string, isMultiSort: boolean): void {
    /* … */ this.state.activeSorts.set(newSorts);
  }

  // 2. Des transformations PURES appelées par le pipeline
  sortData(data: T[]): T[] {
    const sorts = this.state.activeSorts();
    if (sorts.length === 0) return data;
    return [...data].sort(/* … */);
  }
}
```

Un engine peut injecter d'autres engines (le `GridEngine` injecte `SortEngine`, `FilterEngine`, `GroupEngine`).

### 2.4 Le composant host (`grid.ts`)

`AdGridAngularComponent<T>` est le point de couture. Il :

- **déclare tous les engines dans `providers: [...]`** → une instance d'engine _par grid_ (scope DI), pas des singletons globaux ;
- **synchronise `input()` → state** via des `effect(..., { allowSignalWrites: true })` (ex. `data()` → `state.sourceData.set(...)`) ;
- **binde les `computed()`** dans le template ;
- **route les events du template** vers les méthodes d'engine (`onSortClick` → `sortEngine.toggleSort`) ;
- **émet les `output()`** vers le consommateur.

### 2.5 Directives & Models

- `AdeoGridColumnDef` (`directives/grid-column-def.ts`) : l'API déclarative consommateur. Chaque option de colonne est un `input()` signal, et `toColumnDef()` les mappe vers `ColumnDef<T>`. **Toute nouvelle option de colonne se déclare ici ET dans le model `ColumnDef`.**
- `models/*.model.ts` : un fichier par domaine, ré-exporté depuis `models/index.ts`.

---

## 3. Patterns clés à respecter

### Pattern « événement one-shot » (émettre un `output` exactement une fois)

On n'émet jamais un `output` depuis un `computed`. À la place, l'engine garde un signal privé `lastChange` mis à jour à chaque mutation, et le composant l'observe avec un `effect` :

```typescript
// Dans l'engine
private readonly lastChange = signal<FilterEvent | null>(null);
readonly lastEvent = this.lastChange.asReadonly();

addCondition(/* … */): void {
  /* mutation… */
  this.notify('add', condition); // → lastChange.set(event)
}
```

```typescript
// Dans grid.ts (constructeur)
effect(() => {
  const event = this.filterEngine.lastEvent();
  if (!event) return;
  this.filterChange.emit(event); // émis une fois par mutation
});
```

### Pattern « input → state »

```typescript
effect(
  () => {
    this.state.sourceData.set(this.data());
  },
  { allowSignalWrites: true }
);
```

### Conventions non négociables (cf. `CLAUDE.md` / guidelines)

- **Standalone, OnPush, signaux** partout. Jamais `@Input`/`@Output`, jamais `NgModule`.
- **Types de retour explicites** sur toute méthode (`: void`, `: T[]`…). `no-explicit-any` est une erreur de lint.
- **Control flow natif** (`@if`/`@for`/`@switch`), bindings `[class.x]` (pas de `ngClass`/`ngStyle`).
- **Mozaic-first** : réutiliser les composants Mozaic (`MozButtonComponent`, `MozIconButtonComponent`, `MozTagComponent`…) et les tokens CSS (`--color-*`, `--spacing-*`) — aucune valeur en dur.
- **Mode serveur** : toute feature qui transforme la donnée doit court-circuiter en `server` et émettre un event à la place.

---

## 4. La recette : ajouter une feature (checklist)

| #   | Étape                                                      | Fichier                                     |
| --- | ---------------------------------------------------------- | ------------------------------------------- |
| 1   | Ajouter les **types** (model + payload d'event)            | `models/<x>.model.ts` (+ `models/index.ts`) |
| 2   | Ajouter les **signaux d'état** nécessaires                 | `state/grid-state.ts`                       |
| 3   | Créer le **feature engine** (méthodes + transform pur)     | `features/<x>.engine.ts`                    |
| 4   | (Si ça transforme la donnée) **brancher dans le pipeline** | `engine/grid-engine.ts`                     |
| 5   | **Provider + injection** dans le host                      | `grid.ts` (`providers`, `inject`)           |
| 6   | **Câbler** input/effect, template, `output`                | `grid.ts` (+ composants de rendu si UI)     |
| 7   | **Exposer** dans l'API publique                            | `grid/index.ts`                             |
| 8   | **Story + spec**                                           | `*.stories.ts`, `*.spec.ts`                 |

> Toutes les étapes ne sont pas toujours requises. Une feature purement visuelle peut sauter 2/4 ;
> une feature purement logique peut sauter 6 (côté composant de rendu).

---

## 5. Exemple complet de bout en bout : « Quick search » (recherche globale)

But : une barre de recherche dans la toolbar qui filtre **toutes les colonnes visibles** sur un seul terme,
en s'insérant comme une nouvelle étape du pipeline, juste après le filtre structuré.
C'est le miroir simplifié de `FilterEngine` — parfait pour illustrer les 8 étapes.

### Étape 1 — Le model (`models/quick-search.model.ts`)

```typescript
export interface QuickSearchEvent {
  /** Terme courant (vide = recherche désactivée). */
  term: string;
  /** Nombre de lignes correspondantes après filtrage. */
  matchCount: number;
}
```

Puis ré-exporter dans `models/index.ts` :

```typescript
export * from './quick-search.model';
```

### Étape 2 — L'état (`state/grid-state.ts`)

```typescript
// --- Quick search (recherche globale toutes colonnes) ---
readonly quickSearchTerm = signal<string>('');
```

### Étape 3 — L'engine (`features/quick-search.engine.ts`)

```typescript
import { Injectable, computed, inject, signal } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { QuickSearchEvent } from '../models/quick-search.model';

@Injectable()
export class QuickSearchEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  // Événement one-shot, émis par le host (cf. pattern §3).
  private readonly lastChange = signal<QuickSearchEvent | null>(null);
  readonly lastEvent = this.lastChange.asReadonly();

  readonly isActive = computed(() => this.state.quickSearchTerm().trim().length > 0);

  /** Mutation : pose le terme et remet la pagination en page 1. */
  setTerm(term: string): void {
    this.state.quickSearchTerm.set(term);
    this.state.pageIndex.set(0);
    // matchCount sera recalculé par le pipeline ; on l'omet ici et le host
    // l'enrichit, ou on le laisse à 0 si non critique.
    this.lastChange.set({ term, matchCount: 0 });
  }

  clear(): void {
    this.setTerm('');
  }

  /** Transformation PURE appelée par le pipeline (jamais d'effet de bord). */
  filterData(data: T[]): T[] {
    const term = this.state.quickSearchTerm().trim().toLowerCase();
    if (!term) return data;

    const fields = this.state.visibleColumns().map((c) => c.field);
    const defMap = this.state.columnDefMap();

    return data.filter((row) =>
      fields.some((field) => {
        const def = defMap.get(field);
        const value = def?.valueGetter
          ? def.valueGetter(row)
          : (row as Record<string, unknown>)[field];
        return value != null && String(value).toLowerCase().includes(term);
      })
    );
  }
}
```

### Étape 4 — Brancher dans le pipeline (`engine/grid-engine.ts`)

On injecte l'engine et on insère une étape `searchedData` entre `filteredData` et `paginatedData` :

```typescript
private readonly quickSearchEngine = inject<QuickSearchEngine<T>>(QuickSearchEngine);

/** Pipeline step 2.5 : recherche globale. Court-circuite en mode serveur. */
readonly searchedData = computed<T[]>(() => {
  const data = this.filteredData();
  if (this.state.mode() === 'server') return data;
  return this.quickSearchEngine.filterData(data);
});

readonly paginatedData = computed<T[]>(() => {
  const data = this.searchedData(); // ← on lit l'étape recherche, plus filteredData
  /* … reste inchangé … */
});
```

> Et c'est tout pour la perf : grâce à la mémoïsation, taper dans la recherche ne re-trie ni ne re-filtre.

### Étape 5 — Provider + injection (`grid.ts`)

```typescript
providers: [
  /* … engines existants … */
  QuickSearchEngine,
],
```

```typescript
private readonly quickSearchEngine = inject<QuickSearchEngine<T>>(QuickSearchEngine);
```

### Étape 6 — Câblage host : input, output, template

```typescript
// Output vers le consommateur
readonly quickSearchChange = output<QuickSearchEvent>();

// Handler appelé par la toolbar
onQuickSearch(term: string): void {
  this.quickSearchEngine.setTerm(term);
}

// Émission one-shot (constructeur)
effect(() => {
  const event = this.quickSearchEngine.lastEvent();
  if (!event) return;
  this.quickSearchChange.emit(event);
  this.resetInfiniteScrollIfActive();
});
```

Dans le template de la toolbar (composant Mozaic, pas d'input maison) :

```html
<moz-text-input
  size="s"
  placeholder="Rechercher…"
  [value]="quickSearchEngine.term()"
  (valueChange)="onQuickSearch($event)"
/>
```

### Étape 7 — API publique (`grid/index.ts`)

```typescript
export * from './features/quick-search.engine';
```

(`models/index.ts` est déjà ré-exporté via `export * from './models'`.)

### Étape 8 — Story + spec

- **Spec** (`features/quick-search.engine.spec.ts`) : instancier un `GridStateManager`, poser `sourceData` + `columnStates`, appeler `setTerm('abc')`, vérifier `filterData(...)`. Pas de DOM nécessaire — c'est tout l'intérêt du headless.
- **Story** : ajouter un exemple dans `grid.stories.ts` montrant la barre de recherche.

---

## 6. Où regarder selon ce que tu touches

| Tu veux…                            | Va voir                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| Modifier le tri / filtre / groupage | l'engine concerné dans `features/`, **pas** `grid.ts`      |
| Transformer la donnée affichée      | `engine/grid-engine.ts` (la chaîne de `computed`)          |
| Ajouter un signal partagé           | `state/grid-state.ts`                                      |
| Ajouter une option de colonne       | `directives/grid-column-def.ts` + `models/column.model.ts` |
| Ajouter un bouton / drawer toolbar  | template de `grid.ts` + un composant dans `components/`    |
| Exposer une nouvelle API publique   | `grid/index.ts`                                            |

---

## 7. Pièges fréquents

- **Émettre un `output` depuis un `computed`** → interdit. Utilise le pattern `lastEvent` + `effect`.
- **Oublier le court-circuit `server`** dans une étape de pipeline → le grid double-traite des données déjà traitées par le back-end.
- **Mettre un `computed` métier dans `GridStateManager`** alors qu'il dépend d'un engine → crée un cycle/couplage. Le pipeline vit dans `GridEngine`.
- **`providedIn: 'root'` sur un engine** → casse le scoping. Les engines doivent être instanciés _par grid_ via `providers` dans `grid.ts`.
- **Oublier `{ allowSignalWrites: true }`** sur un `effect` qui écrit dans l'état → erreur runtime.
- **Oublier le type de retour** d'une méthode → erreur de lint (bloque le build).
