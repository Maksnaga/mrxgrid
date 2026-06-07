# Filtres custom — alignement AG Grid

Référence : <https://www.ag-grid.com/vue-data-grid/component-filter/>

## État final (PR 1 → PR 4 — livré)

L'API des filtres custom AdeoGrid est passée d'un modèle **éclaté** (3 props sur la `ColumnDef`, méthode statique bolted-on le composant, 3 props sur le composant) à un modèle **encapsulé** :

- **Une seule prop sur la `ColumnDef`** : `filter: { component, doesFilterPass }` (parité directe avec AG Grid).
- **Une seule prop sur le composant** : `params` — bundle `{ model, column, filterParams, getValue, onModelChange }`.
- **Méthodes optionnelles via `defineExpose`** : `refresh`, `afterGuiAttached`, `isFilterActive`, `getModelAsString`.

> **Périmètre.** Seuls les filtres custom sont concernés. Les filtres built-in (`text` / `number` / `date` / `set` / `boolean`) gardent leur API déclarative (`filterType`, `filterOperators`, …).

---

## API publique

### 1. Composant filtre

```ts
import type { MrxFilterParams } from '@/components/AdeoGrid'

const PriceRangeFilter = defineComponent({
  props: { params: { type: Object, required: true } },
  setup(props: { params: MrxFilterParams<MyRow, PriceModel> }, { expose }) {
    // État local — la grille est source de vérité (`params.model`), le
    // composant ne fait que mirror via `refresh()` et annoncer via
    // `params.onModelChange()`.
    const model = ref<PriceModel | null>(props.params.model ?? null)

    function commit(next: PriceModel | null) {
      model.value = next
      props.params.onModelChange(next)
    }

    expose({
      // Optionnel — défaut "model != null". Surcharge si un model non-null
      // peut quand même vouloir dire "pas de filtre" (array vide, range total).
      isFilterActive: () => model.value !== null,

      // Optionnel — appelé quand le model change depuis l'extérieur (drawer
      // apply, persistView restore). Resync l'état local. Retour `true` =
      // "synced, garde-moi mountée".
      refresh: (newParams) => { model.value = newParams.model; return true },

      // Optionnel — label du tag bar "FILTERED BY".
      getModelAsString: (m) => `${m.min} € – ${m.max} €`,

      // Optionnel — appelé une fois au mount. Utile pour focus init.
      afterGuiAttached: (p) => { if (!p?.suppressFocus) inputRef.value?.focus() },
    })

    // … render fn / template …
  },
})
```

### 2. Prédicat (pure function)

```ts
import type { MrxDoesFilterPassParams } from '@/components/AdeoGrid'

const priceDoesFilterPass = (
  p: MrxDoesFilterPassParams<MyRow, PriceModel>,
): boolean => {
  const v = p.getValue('price') as number
  return v >= p.model.min && v <= p.model.max
}
```

`MrxDoesFilterPassParams` expose `{ row, rowIndex, getValue, model, column }`. Aucun lien avec le composant — c'est de la **donnée de colonne** que tu peux partager, tester, swapper.

### 3. Déclaration sur la `ColumnDef`

```ts
{
  field: 'price',
  filterable: true,
  filter: {
    component: markRaw(PriceRangeFilter),
    doesFilterPass: priceDoesFilterPass,
    // Optionnel — opaque bag injecté dans `params.filterParams`.
    filterParams: { /* options, async loaders, … */ },
  },
}
```

Le `filter` field accepte **deux shapes** (discriminées par TypeScript) :

- `{ type, options?, placeholder? }` — config de la **filter row inline** (existant historique, `FilterDef`).
- `{ component, doesFilterPass?, filterParams? }` — config **AG-Grid-style** pour le builder / overlay (nouvelle).

Le code engine + UI narrowe la bonne shape automatiquement.

---

## Contrats de types (récapitulatif)

```ts
// Sur la ColumnDef
interface MrxFilterConfig<T, M, P> {
  component: MrxFilterComponent
  doesFilterPass?: MrxDoesFilterPass<T, M>
  filterParams?: P
}

// Passé en props au composant
interface MrxFilterParams<T, M, P> {
  model: M | null
  column: ColumnDef<T>
  filterParams?: P
  getValue: (field: string) => unknown
  onModelChange: (model: M | null) => void
}

// Argument du prédicat
interface MrxDoesFilterPassParams<T, M> {
  row: T
  rowIndex: number
  getValue: (field: string) => unknown
  model: M
  column: ColumnDef<T>
}

// Exposé par le composant (TOUS optionnels)
interface MrxFilterInstance<M> {
  refresh?(newParams: MrxFilterParams<unknown, M>): boolean | void
  afterGuiAttached?(params?: { suppressFocus?: boolean }): void
  isFilterActive?(): boolean
  getModelAsString?(model: M): string
}
```

---

## Cycle de vie

```
mount        builder rend <component :is="filter.component" :params="paramsObject" :ref="..." />
             paramsObject = { model: condition.model, column, filterParams, getValue, onModelChange }

restore      builder appelle instance.refresh(newParams) si condition.model existe
             ET le composant expose refresh().

interaction  user tape / clique → composant met à jour son state local
             → composant appelle params.onModelChange(newModel)
             → builder pose condition.model = newModel ET emit('update', ...)

readback     builder lit l'`isFilterActive()` du composant si exposé,
             sinon utilise `condition.model != null` comme proxy d'activité.

eval         engine appelle col.filter.doesFilterPass({ row, rowIndex, getValue, model, column })
             ligne par ligne. Pas d'instance Vue impliquée.

label        tag bar appelle instance.getModelAsString?(model) ?? col.headerName
```

---

## Migration historique (PR 1 → PR 4)

| PR | Changements |
|----|-------------|
| 1 | Ajout du nouveau contrat en parallèle (non-breaking). `filterComponent` accepte les deux contrats, différentiés par la static `doesFilterPass`. |
| 2 | Migration de `CategoryComboFilter` au nouveau contrat. Console-warn pour la combinaison legacy. |
| 3 | Suppression de l'ancienne API (`filterPredicate`, `filterIsComplete`, `MrxCustomFilterProps`, `MrxCustomFilterEmits`). Le contrat AG-Grid devient le seul. |
| 4 | **Alignement final AG Grid** : `filter: { component, doesFilterPass }` au lieu de `filterComponent` + static. Un seul prop `params` côté composant au lieu de 3. `refresh()` / `afterGuiAttached()` à la place de `getModel`/`setModel`. |

---

## TL;DR

> **AdeoGrid filter custom = AG Grid filter custom.** Un seul champ `filter` sur la colonne, un seul prop `params` sur le composant, un prédicat qui est de la donnée. Pas de cast TS magique, pas de méthode bolted-on, pas de cérémonie d'introspection imposée — tout est optionnel.
