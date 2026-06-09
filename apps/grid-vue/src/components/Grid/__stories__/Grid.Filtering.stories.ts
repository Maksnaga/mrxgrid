import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, defineComponent, h, markRaw, onMounted, ref } from 'vue'
import { MCombobox } from '@mozaic-ds/vue'
import { teleportListbox, type TeleportListboxController } from '@/composables/useTeleportListbox'
import { AdGridVue, AdGridFilterDrawer, AdGridToolbar } from '@/components/Grid'
import type { ColumnDef } from '@/components/Grid'
import {
  DEFAULT_OPERATORS,
  DEFAULT_OPERATOR_PER_TYPE,
  type FilterColumnDescriptor,
  type FilterDataType,
  type FilterModel,
  type DoesFilterPassParams,
  type FilterParams,
} from '@/components/Grid/models/filter.model'
import { lmColumns, lmProducts, type LMProduct } from './_fixtures'

// Custom filter component — Mozaic `<MCombobox>` in multi-select mode for
// `category`. Built-in `set` filter renders a flat list of checkboxes; the
// design-system combobox brings type-to-filter, chips, clearable, etc.
// for free.
//
// Migrated to the AG-Grid-style contract: state lives in a local ref, the
// component exposes `isFilterActive` / `getModel` / `setModel` for the
// builder, and a static `doesFilterPass` is attached to the component
// constructor for engine evaluation.
// Custom filter component — Mozaic `<MCombobox>` in multi-select mode for
// `category`. AG-Grid-style contract: a single `params` prop bundles
// everything the component needs; the predicate is column data, declared
// alongside the component on `colDef.filter.doesFilterPass`.
const CategoryComboFilter = defineComponent({
  name: 'CategoryComboFilter',
  props: {
    params: { type: Object, required: true },
  },
  setup(props: { params: FilterParams<LMProduct, string[]> }, { expose }) {
    // Options derived from the demo dataset. A real implementation would
    // accept them via `params.filterParams` or fetch them asynchronously.
    const options = Array.from(new Set(lmProducts.map((r) => r.category)))
      .sort()
      .map((c) => ({ label: c, value: c }))

    // Local mirror of the model; the grid is the source of truth (see
    // `params.model`), the component syncs via `refresh()` and announces
    // changes via `params.onModelChange()`.
    const model = ref<string[] | null>(
      Array.isArray(props.params.model) ? props.params.model : null,
    )

    function onUpdate(value: string | number | (string | number)[] | null): void {
      const next = Array.isArray(value) ? (value as string[]) : value == null ? [] : [String(value)]
      model.value = next.length === 0 ? null : next
      props.params.onModelChange(model.value)
    }

    // The drawer clips overflow, so the combobox dropdown gets cut off. Lift
    // the listbox to document.body once mounted; the parent then drives its
    // visibility via `update:open` because the lifted listbox no longer sees
    // Mozaic's own open/close CSS.
    const wrapperRef = ref<HTMLElement | null>(null)
    let controller: TeleportListboxController | undefined
    onMounted(() => {
      if (wrapperRef.value) controller = teleportListbox(wrapperRef.value)
    })
    function onOpenChange(open: boolean): void {
      controller?.setOpen(open)
    }

    expose({
      // `null` ⇔ inactive. Non-empty array ⇔ active.
      isFilterActive: () => Array.isArray(model.value) && model.value.length > 0,
      // Called when the grid's model changes from a source OTHER than this
      // component (drawer apply, persistView restore). Re-sync local state.
      refresh: (newParams: FilterParams<LMProduct, string[]>): boolean => {
        const m = newParams.model
        model.value = Array.isArray(m) && m.length > 0 ? m : null
        return true
      },
      getModelAsString: (m: string[]) => (Array.isArray(m) && m.length > 0 ? m.join(', ') : ''),
    })

    // Render function (not `template: '...'`) — avoids the runtime
    // template compiler entirely.
    return () =>
      h('div', { ref: wrapperRef, class: 'sb-combo-wrap' }, [
        h(MCombobox, {
          multiple: true,
          search: true,
          clearable: true,
          size: 's',
          placeholder: 'Choisir un rayon…',
          options,
          modelValue: model.value ?? [],
          'onUpdate:modelValue': onUpdate,
          'onUpdate:open': onOpenChange,
        }),
      ])
  },
})

// Pure predicate — declared alongside the component on the column. The
// engine calls it once per row; no Vue instance involved.
const categoryDoesFilterPass = (p: DoesFilterPassParams<LMProduct, string[]>): boolean => {
  if (!Array.isArray(p.model) || p.model.length === 0) return true
  const v = p.getValue('category')
  return typeof v === 'string' && p.model.includes(v)
}

// Custom filter component — dual-range slider for `price`, written with
// the new AG-Grid-style contract: the component owns its state via a ref,
// exposes `isFilterActive` / `getModel` / `setModel` to the builder, and
// declares a static `doesFilterPass` that the engine calls during
// evaluation. No more `filterPredicate` / `filterIsComplete` on the
// ColumnDef — everything lives on the component.
interface PriceModel {
  min: number
  max: number
}
const PRICE_MIN = 0
const PRICE_MAX = 1500

const PriceRangeFilter = defineComponent({
  name: 'PriceRangeFilter',
  props: {
    params: { type: Object, required: true },
  },
  setup(props: { params: FilterParams<LMProduct, PriceModel> }, { expose }) {
    // Local mutable state. `null` means "no filter" → the engine drops the
    // condition. The grid's source-of-truth lives on `params.model` and is
    // re-synced via `refresh()` when changed externally.
    const model = ref<PriceModel | null>(
      props.params.model && typeof props.params.model === 'object' ? props.params.model : null,
    )

    function commit(next: PriceModel | null): void {
      model.value = next
      props.params.onModelChange(next)
    }

    function onMin(e: Event): void {
      const v = Number((e.target as HTMLInputElement).value)
      const current = model.value ?? { min: PRICE_MIN, max: PRICE_MAX }
      commit({ min: v, max: current.max })
    }
    function onMax(e: Event): void {
      const v = Number((e.target as HTMLInputElement).value)
      const current = model.value ?? { min: PRICE_MIN, max: PRICE_MAX }
      commit({ min: current.min, max: v })
    }

    expose({
      isFilterActive: () => model.value !== null,
      refresh: (newParams: FilterParams<LMProduct, PriceModel>): boolean => {
        model.value = newParams.model ?? null
        return true
      },
      getModelAsString: (m: PriceModel) => (m ? `${m.min} € – ${m.max} €` : ''),
    })

    return () => {
      const min = model.value?.min ?? PRICE_MIN
      const max = model.value?.max ?? PRICE_MAX
      return h('div', { class: 'sb-price-range' }, [
        h('div', { class: 'sb-price-range__values' }, [
          h('span', null, `${min} €`),
          h('span', null, `${max} €`),
        ]),
        h('div', { class: 'sb-price-range__sliders' }, [
          h('input', { type: 'range', min: PRICE_MIN, max: PRICE_MAX, value: min, onInput: onMin }),
          h('input', { type: 'range', min: PRICE_MIN, max: PRICE_MAX, value: max, onInput: onMax }),
        ]),
      ])
    }
  },
})

// Pure predicate — declared alongside the component on the column.
const priceDoesFilterPass = (p: DoesFilterPassParams<LMProduct, PriceModel>): boolean => {
  const v = p.getValue('price')
  if (typeof v !== 'number' || !p.model) return false
  return v >= p.model.min && v <= p.model.max
}

const meta = {
  title: 'Stories/Filtering/Inline · Drawer · Server-side',
  component: AdGridVue,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Filtering

Grid expose **trois surfaces de filtrage complémentaires**, à activer indépendamment selon votre UX :

| Surface | Quand l'utiliser | Activation |
|---------|------------------|------------|
| **Inline filter row** | Filtres rapides "1 input par colonne" sous le header | \`filterable: true\` + \`filterType\` sur la \`ColumnDef\` |
| **Filter drawer** | Builder multi-conditions avec combinators AND/OR | \`<ad-grid-filter-drawer>\` + \`grid.setFilterModel()\` |
| **Server-side** | La grille n'évalue rien client-side, elle émet \`filterChange\` | prop \`server-filter\` |

Les surfaces composent : un filtre du drawer **ET** un filtre inline filtrent la même donnée (intersection). Toutes les conditions partagent le même engine ([\`useFilterEngine\`](src/components/Grid/features/useFilterEngine.ts)).

## Types de filtre supportés (\`filterType\`)

- \`text\` — match \`contains\` (par défaut)
- \`number\` — opérateurs \`=\`, \`!=\`, \`>\`, \`<\`, \`between\`
- \`date\` — \`=\`, \`>\`, \`<\`, \`between\` (parse ISO)
- \`set\` — multi-select sur \`filterOptions: { value, label }[]\`
- \`boolean\` — true/false select

## API exposée

- \`grid.setFilterModel(model)\` — remplace le modèle complet (utilisé par le drawer)
- \`grid.clearFilterModel()\` — reset complet
- \`grid.clearQuickFilters()\` — reset uniquement la filter row
- \`grid.clearFilters()\` — reset les deux
- Évent \`filterChange\` — émis sur chaque changement, payload \`Record<field, value>\`
        `,
      },
    },
  },
} satisfies Meta<typeof AdGridVue>

export default meta
type Story = StoryObj<typeof meta>

export const InlineFilters: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Inline filter row

Active automatiquement quand au moins une colonne déclare \`filterable: true\` (ou un \`filter\` legacy). Chaque type rend son input adapté:

- \`filterType: 'text'\` → \`<MTextInput>\` (debounce 250ms)
- \`filterType: 'number'\` → \`<MTextInput type="number">\`
- \`filterType: 'date'\` → date picker
- \`filterType: 'set'\` → \`<MSelect>\` peuplé depuis \`filterOptions\`
- \`filterType: 'boolean'\` → select Vrai/Faux

### Implémentation

\`\`\`ts
const columns: ColumnDef[] = [
  { field: 'sku',      headerName: 'Référence', filterable: true, filterType: 'text' },
  { field: 'category', headerName: 'Rayon',    filterable: true, filterType: 'set',
    filterOptions: CATEGORIES.map((c) => ({ value: c, label: c })) },
  { field: 'price',    headerName: 'Prix',     filterable: true, filterType: 'number' },
  { field: 'updatedAt',headerName: 'Maj',      filterable: true, filterType: 'date' },
]
\`\`\`

\`\`\`vue
<ad-grid-vue :columns="columns" :rows="rows" />
\`\`\`

### Comment ça marche en interne

1. La filter row ([\`AdGridFilterRow.vue\`](src/components/Grid/components/header/AdGridFilterRow.vue)) itère les colonnes et délègue à \`AdGridFilterCell\` qui choisit le bon input selon \`filterType\`.
2. Sur input, le filter engine maintient un \`Record<field, value>\` (\`quickFilters\` dans \`GridState\`).
3. Le pipeline \`sourceData → sortedData → **filteredData** → paginatedData → displayRows\` re-calcule \`filteredData\` réactivement.
4. Texte → debounce 250ms ; select / date → commit immédiat.

### Personnaliser un opérateur

\`\`\`ts
{ field: 'sku', filterable: true, filterType: 'text',
  filterOperators: ['equals', 'startsWith'],
  defaultFilterOperator: 'startsWith' }
\`\`\`
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup: () => ({ lmColumns, lmProducts }),
    template: `
      <div class="sb-grid-shell">
        <h2>Inline filter row</h2>
        <p>Chaque colonne marquée <code>filterable: true</code> avec un <code>filterType</code> expose son input dans la rangée de filtres juste sous le header. Text, number, date et set sont built-in.</p>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560" :columns="lmColumns" :rows="lmProducts" />
        </div>
      </div>
    `,
  }),
}

export const SlotFilters: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Custom \`#filter-{field}\` slots

Quand l'input par défaut ne suffit pas (range slider, multi-select fancy, toggle, datepicker custom), redéfinissez la cellule via \`<template #filter-{field}>\`.

### Slot props

\`\`\`ts
{ column: ColumnDef, value: unknown, setValue: (v: unknown) => void, clear: () => void }
\`\`\`

### Deux stratégies de wiring

**A. Drive le filter engine** — appelez \`setValue(v)\` depuis le slot ; la grille filtre via son pipeline interne. Utile pour rester sur l'opérateur déclaré dans la \`ColumnDef\`.

**B. Pre-filter côté consommateur** — gardez l'état dans une \`ref\` locale, calculez vos lignes filtrées dans un \`computed\`, et passez le résultat à \`:rows\`. Bypass complet de l'engine — choisi par cette story pour les prédicats custom.

### Implémentation (stratégie B)

\`\`\`vue
<script setup>
const nameQuery = ref('')
const categoryFilter = ref('')
const maxPrice = ref<number | null>(null)

const filteredRows = computed(() =>
  rawRows.filter((r) => {
    if (nameQuery.value && !r.name.includes(nameQuery.value)) return false
    if (categoryFilter.value && r.category !== categoryFilter.value) return false
    if (maxPrice.value != null && r.price > maxPrice.value) return false
    return true
  }),
)
</script>

<template>
  <ad-grid-vue :columns="columns" :rows="filteredRows">
    <template #filter-name>
      <input v-model="nameQuery" placeholder="Search name..." class="sb-filter-input" />
    </template>
    <template #filter-category>
      <select v-model="categoryFilter" class="sb-filter-input">
        <option value="">All</option>
        <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
      </select>
    </template>
    <template #filter-price>
      <input v-model.number="maxPrice" type="number" placeholder="Max price" class="sb-filter-input" />
    </template>
  </ad-grid-vue>
</template>
\`\`\`

### Notes

- Un slot redéfinit **uniquement** la cellule de cette colonne — les autres gardent leur input par défaut.
- La cellule slot mesure la même largeur que la colonne (avec border-right pour matcher les autres) — votre input doit donc prendre \`width: 100%\` (ex. classe utilitaire \`.sb-filter-input\` dans \`preview.css\`).
- Le slot ne participe pas au \`filterModel\` du drawer — si vous voulez les mixer, propagez vos drafts dans \`grid.setFilter(field, value)\`.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup() {
      // One draft ref per slot so each input commits independently — the
      // filter row applies on the next render via the computed `filteredRows`.
      const nameQuery = ref<string>('')
      const categoryFilter = ref<string>('')
      const maxPrice = ref<number | null>(null)

      // Filtered locally so the slot state drives the grid without going
      // through `setValue` — useful when you want full control over the
      // predicate (e.g. composite or fuzzy matching).
      const filteredRows = computed(() =>
        lmProducts.filter((r) => {
          if (nameQuery.value && !r.name.toLowerCase().includes(nameQuery.value.toLowerCase())) {
            return false
          }
          if (categoryFilter.value && r.category !== categoryFilter.value) return false
          if (maxPrice.value != null && r.price > maxPrice.value) return false
          return true
        }),
      )

      const categoryOptions = [
        { value: '', label: 'All' },
        ...Array.from(new Set(lmProducts.map((r) => r.category))).map((c) => ({
          value: c,
          label: c,
        })),
      ]

      return {
        lmColumns,
        filteredRows,
        nameQuery,
        categoryFilter,
        maxPrice,
        categoryOptions,
      }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>Custom <code>#filter-{field}</code> slots</h2>
        <p>
          Le slot <code>#filter-{field}</code> reçoit <code>{ column, value, setValue, clear }</code>
          et remplace l'input par défaut dans la filter row. Chaque slot remplit la
          largeur de sa colonne. Trois exemples ci-dessous : recherche texte sur
          <code>name</code>, select avec valeur <em>All</em> sur <code>category</code>,
          input "Max price" sur <code>price</code>.
        </p>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560" :columns="lmColumns" :rows="filteredRows">
            <!-- Name: text search filling the cell width. -->
            <template #filter-name>
              <input
                type="text"
                placeholder="Search name..."
                :value="nameQuery"
                class="sb-filter-input"
                @input="nameQuery = $event.target.value"
              />
            </template>

            <!-- Category: select with an "All" reset option. -->
            <template #filter-category>
              <select
                :value="categoryFilter"
                class="sb-filter-input"
                @change="categoryFilter = $event.target.value"
              >
                <option v-for="opt in categoryOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </template>

            <!-- Price: single "Max price" cap. -->
            <template #filter-price>
              <input
                type="number"
                placeholder="Max price"
                :value="maxPrice ?? ''"
                class="sb-filter-input"
                @input="maxPrice = ($event.target.value === '' ? null : Number($event.target.value))"
              />
            </template>
          </ad-grid-vue>
        </div>
      </div>
    `,
  }),
}

export const FilterDrawer: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Multi-condition filter drawer

\`AdGridFilterDrawer\` ouvre un panneau latéral où l'utilisateur empile des conditions (\`field\` × \`operator\` × \`value\`) reliées par AND/OR. Le drawer maintient un \`FilterModel\` indépendant qui s'applique en bloc sur "Apply".

### Forme du modèle

\`\`\`ts
interface FilterModel {
  conditions: FilterCondition[]
}
interface FilterCondition {
  id: string
  field: string
  operator: FilterOperator      // 'contains' | 'equals' | 'gte' | 'between' | 'in' | …
  combinator: 'and' | 'or'
  value: { value?: unknown; valueTo?: unknown }  // valueTo for range ops
}
\`\`\`

### Implémentation

\`\`\`vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { AdGridVue, AdGridFilterDrawer, AdGridToolbar } from '@/components/Grid'
import {
  DEFAULT_OPERATORS,
  DEFAULT_OPERATOR_PER_TYPE,
  type FilterColumnDescriptor,
  type FilterDataType,
  type FilterModel,
} from '@/components/Grid/models/filter.model'

const gridRef    = ref<InstanceType<typeof AdGridVue>>()
const drawerOpen = ref(false)
const model      = ref<FilterModel>({ conditions: [] })

// 1. Build the descriptor list — describes each filterable column to the
//    drawer (operators allowed, set options, default operator).
const filterColumns = computed<FilterColumnDescriptor[]>(() =>
  columns.map((col) => {
    const filterType: FilterDataType = col.filterType ?? 'text'
    return {
      field: col.field,
      headerName: col.headerName,
      filterType,
      operators: col.filterOperators ?? DEFAULT_OPERATORS[filterType],
      defaultOperator: col.defaultFilterOperator ?? DEFAULT_OPERATOR_PER_TYPE[filterType],
      options: col.filterOptions,
    }
  }),
)

// 2. Apply / clear hooks update the local model AND push to the engine via
//    the imperative ref API so the FILTERED BY tag bar + active count stay
//    in sync.
function onApply(next: FilterModel) {
  model.value = next
  gridRef.value?.setFilterModel?.(next)
}
function onClear() {
  model.value = { conditions: [] }
  gridRef.value?.clearFilterModel?.()
}
</script>

<template>
  <ad-grid-vue ref="gridRef" :columns="columns" :rows="rows">
    <template #toolbar>
      <ad-grid-toolbar
        show-filters
        :active-filter-count="model.conditions.length"
        @filters="drawerOpen = !drawerOpen"
      />
    </template>
  </ad-grid-vue>

  <ad-grid-filter-drawer
    :open="drawerOpen"
    :columns="filterColumns"
    :model="model"
    @update:open="drawerOpen = $event"
    @apply="onApply"
    @clear="onClear"
  />
</template>
\`\`\`

### Pourquoi un descriptor séparé ?

\`FilterColumnDescriptor\` est un **objet de présentation** — il décrit ce que le drawer doit montrer (list d'opérateurs, options du set, type d'input). Le \`ColumnDef\` est le contrat de la *colonne*. Garder les deux séparés permet de filtrer côté drawer sur des champs qui n'apparaissent pas dans la grille.

### Astuce: smart toolbar

Pour éviter de wirer le drawer + le model + filterColumns à la main, utilisez \`<ad-grid-toolbar>\` qui les bundle. Voir story *Devtools / Event console*.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue, AdGridFilterDrawer, AdGridToolbar },
    setup() {
      const drawerOpen = ref(false)
      const filterModel = ref<FilterModel>({ conditions: [] })
      const gridRef = ref<InstanceType<typeof AdGridVue>>()
      const columns = lmColumns

      const filterColumns = computed<FilterColumnDescriptor[]>(() =>
        columns.map((col) => {
          const filterType: FilterDataType = col.filterType ?? 'text'
          return {
            field: col.field,
            headerName: col.headerName,
            filterType,
            operators: col.filterOperators ?? DEFAULT_OPERATORS[filterType],
            defaultOperator: col.defaultFilterOperator ?? DEFAULT_OPERATOR_PER_TYPE[filterType],
            options: col.filterOptions,
          }
        }),
      )

      function onApply(model: FilterModel) {
        filterModel.value = model
        gridRef.value?.setFilterModel?.(model)
      }
      function onClear() {
        filterModel.value = { conditions: [] }
        gridRef.value?.clearFilterModel?.()
      }

      return {
        lmColumns,
        lmProducts,
        gridRef,
        drawerOpen,
        filterColumns,
        filterModel,
        onApply,
        onClear,
      }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>Multi-condition filter drawer</h2>
        <p>Le drawer permet d'empiler des conditions par colonne (text contains / number between / set in…) et de les appliquer en bloc. Le drawer se ferme via la croix ou l'overlay (<code>@update:open</code>).</p>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560" ref="gridRef" :columns="lmColumns" :rows="lmProducts">
            <template #toolbar>
              <ad-grid-toolbar
                show-filters
                :active-filter-count="filterModel.conditions.length"
                @filters="drawerOpen = !drawerOpen"
              />
            </template>
          </ad-grid-vue>
        </div>
        <ad-grid-filter-drawer
          :open="drawerOpen"
          :columns="filterColumns"
          :model="filterModel"
          @update:open="drawerOpen = $event"
          @apply="onApply"
          @clear="onClear"
        />
      </div>
    `,
  }),
}

export const ServerSideFiltering: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Server-side filtering

Avec \`server-filter\`, la grille **n'évalue plus** les prédicats côté client : elle émet \`filterChange\` à chaque édit, et c'est à votre back de re-fetch.

### Implémentation

\`\`\`vue
<script setup lang="ts">
const rows  = ref<Row[]>([])
const total = ref(0)

async function onFilterChange(filters: Record<string, unknown>) {
  const res = await api.fetchRows({ filters })
  rows.value  = res.items
  total.value = res.total  // for the scrollbar height + "Select all N rows"
}
</script>

<template>
  <ad-grid-vue
    :columns="columns"
    :rows="rows"
    :total-count="total"
    server-filter
    @filter-change="onFilterChange"
  />
</template>
\`\`\`

### Couplage avec pagination / sort

Si vous avez aussi du sort ou de la pagination server-side, écoutez \`@page-change\` et utilisez \`grid.getSortModel()\` au moment du fetch — la grille émet l'évent quand l'un des trois change, charge à vous d'envoyer la requête combinée.

### Notes importantes

- \`:total-count\` doit refléter le **total filtré** côté serveur — sinon le scrollbar "saute" et le bouton "Select all N rows" affiche un mauvais chiffre.
- Le \`filterChange\` payload est un \`Record<field, value>\` (les quick-filters) — le \`FilterModel\` du drawer n'est PAS dans cet évent. Si vous utilisez le drawer en server-side, écoutez son \`@apply\` séparément pour récupérer les conditions complètes.
- Les opérateurs (\`contains\`, \`gte\`, etc.) ne sont pas envoyés ici — c'est de la responsabilité de votre API d'interpréter les valeurs. Ajustez si vous avez besoin d'opérateurs.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup() {
      const allRows = lmProducts
      const filtered = ref([...allRows])
      const lastQuery = ref<string>('—')
      function onFilterChange(filters: Record<string, unknown>) {
        lastQuery.value = JSON.stringify(filters) || '—'
        // Pretend the server filtered for us — here we run the same predicate locally.
        filtered.value = allRows.filter((r) => {
          for (const [field, raw] of Object.entries(filters)) {
            if (!raw) continue
            const v = String((r as Record<string, unknown>)[field] ?? '').toLowerCase()
            if (!v.includes(String(raw).toLowerCase())) return false
          }
          return true
        })
      }
      return { lmColumns, filtered, lastQuery, onFilterChange }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>Server-side filtering</h2>
        <p>Avec <code>:server-filter="true"</code>, le grid n'applique pas le filtre lui-même : il émet <code>filterChange</code>, à toi de re-fetch et de repasser <code>:rows</code>.</p>
        <div class="sb-grid-toolbar">Dernier query envoyé : <code>{{ lastQuery }}</code></div>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560"
            :columns="lmColumns"
            :rows="filtered"
            server-filter
            @filter-change="onFilterChange"
          />
        </div>
      </div>
    `,
  }),
}

export const CustomFilter: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Custom filter components

Quand les 5 types built-in (\`text\`, \`number\`, \`date\`, \`set\`, \`boolean\`) ne couvrent pas le besoin — slider double, combobox autocomplete, tag picker, regex — déclarez \`filter\` sur la \`ColumnDef\` avec **un objet** qui bundle le composant et le prédicat (parité AG Grid).

### Contrat

\`\`\`ts
import type { FilterParams, DoesFilterPassParams } from '@/components/Grid'

// 1. Le composant — un seul prop \`params\` qui bundle tout le contexte.
const PriceRangeFilter = defineComponent({
  props: { params: { type: Object, required: true } },
  setup(props, { expose }) {
    const model = ref(props.params.model ?? null)
    expose({
      isFilterActive: () => model.value !== null,
      refresh: (newParams) => { model.value = newParams.model; return true },
      getModelAsString: (m) => m ? \`\${m.min} € – \${m.max} €\` : '',
    })
    function onMin(e) {
      model.value = { min: Number(e.target.value), max: model.value?.max ?? 1500 }
      props.params.onModelChange(model.value)
    }
    // …
  },
})

// 2. Le prédicat — pure function, déclarée à côté du composant.
const priceDoesFilterPass = (p) => {
  const v = p.getValue('price')
  return v >= p.model.min && v <= p.model.max
}

// 3. La colonne — config bundlée.
{
  field: 'price',
  filterable: true,
  filter: {
    component: markRaw(PriceRangeFilter),
    doesFilterPass: priceDoesFilterPass,
  },
}
\`\`\`

### Pourquoi cette forme

- **Le prédicat est de la donnée**, pas une méthode collée au composant. Tu peux le swapper, le partager, le tester en isolation.
- **Un seul prop \`params\`** côté composant — \`{ model, column, filterParams, getValue, onModelChange }\`. Pas de prolifération de props.
- **Le composant appelle \`params.onModelChange(value)\`** pour annoncer un changement. \`null\` ⇒ "pas de filtre" ⇒ la grille retire la condition.
- **\`refresh(newParams)\`** pour resync depuis l'extérieur (drawer apply, persistView restore).
- **\`isFilterActive\` optionnel** — par défaut \`model != null\`. Override-le si un model non-null peut quand même vouloir dire "inactif".

Cette story illustre deux customs : **Rayon** (combobox multi-select) et **Prix** (dual-range slider).

### \`filterMode\` découplé

La prop \`filter-mode\` est désormais **indépendante** de \`server-filter\` / \`server-grouping\` :

- \`filter-mode="client"\` (défaut) — l'engine appelle \`doesFilterPass\` sur chaque ligne.
- \`filter-mode="server"\` — la grille passe les lignes telles quelles, à toi de re-fetch sur \`update:filter-model\`.

Combinaison nouvelle (impossible avant) : **grouping serveur + filtrage client** via \`<ad-grid-vue :server-grouping :filter-mode="client" />\`.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue, AdGridFilterDrawer, AdGridToolbar },
    setup() {
      const drawerOpen = ref(false)
      const filterModel = ref<FilterModel>({ conditions: [] })
      const gridRef = ref<InstanceType<typeof AdGridVue>>()
      const mode = ref<'client' | 'server'>('client')
      const lastEvent = ref<string>('—')

      // Override two columns with custom filter components. `markRaw` keeps
      // Vue from making the components reactive when they live on a plain
      // `ColumnDef` object.
      const columns = lmColumns.map((col) => {
        if (col.field === 'price') {
          // AG-Grid-style config: a single `filter` field bundling the
          // component (UI), the doesFilterPass (predicate), and an
          // optional `getModelAsString` for the "FILTERED BY" tag bar.
          //
          // The `as any` widens our model-specific functions (PriceModel)
          // to ColumnDef's `unknown`-typed slot — TypeScript variance on
          // function-typed properties refuses the otherwise valid narrowing.
          return {
            ...col,
            filter: {
              component: markRaw(PriceRangeFilter),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              doesFilterPass: priceDoesFilterPass as any,
              getModelAsString: (m: unknown) => {
                const pm = m as PriceModel | null
                return pm ? `${pm.min} € – ${pm.max} €` : ''
              },
            },
          }
        }
        if (col.field === 'category') {
          // `category` already declared a `set` filterType on the inline
          // row (lmColumns). Setting `filter` to a custom config flips
          // the builder / overlay to the combobox; the inline row keeps
          // its native multi-select untouched.
          return {
            ...col,
            filter: {
              component: markRaw(CategoryComboFilter),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              doesFilterPass: categoryDoesFilterPass as any,
              getModelAsString: (m: unknown) =>
                Array.isArray(m) ? (m as string[]).join(', ') : '',
            },
          }
        }
        return col
      })

      const filterColumns = computed<FilterColumnDescriptor[]>(() =>
        columns.map((col) => {
          // Detect AG-Grid-style custom filter on `col.filter`. The
          // alternative shape (`{ type, options, … }`) is the inline
          // filter row config and is handled in the else branch.
          const custom = col.filter && 'component' in col.filter ? col.filter : undefined
          if (custom) {
            return {
              field: col.field,
              headerName: col.headerName ?? col.field,
              filterType: 'custom',
              operators: [],
              defaultOperator: 'equals',
              // FilterColumnDescriptor types filter as FilterConfig<unknown>;
              // our config is typed on the row's actual shape, but the engine
              // only ever needs the shape, not the row generic. Cast widens.
              filter:
                custom as unknown as import('@/components/Grid/models/filter.model').FilterConfig<
                  unknown,
                  unknown,
                  unknown
                >,
              // Forward the source ColumnDef so the builder can pass it
              // as `params.column` to the filter component.
              colDef: col as ColumnDef<unknown>,
            }
          }
          const filterType: FilterDataType = col.filterType ?? 'text'
          return {
            field: col.field,
            headerName: col.headerName ?? col.field,
            filterType,
            operators: col.filterOperators ?? DEFAULT_OPERATORS[filterType],
            defaultOperator: col.defaultFilterOperator ?? DEFAULT_OPERATOR_PER_TYPE[filterType],
            options: col.filterOptions,
          }
        }),
      )

      function onApply(model: FilterModel): void {
        filterModel.value = model
        gridRef.value?.setFilterModel?.(model)
      }
      function onClear(): void {
        filterModel.value = { conditions: [] }
        gridRef.value?.clearFilterModel?.()
      }
      function onFilterChange(payload: unknown): void {
        lastEvent.value = JSON.stringify(payload)
      }

      return {
        columns,
        lmProducts,
        gridRef,
        drawerOpen,
        filterColumns,
        filterModel,
        mode,
        lastEvent,
        onApply,
        onClear,
        onFilterChange,
      }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>Custom filter components</h2>
        <p>
          Deux colonnes ont un <code>filter: { component, doesFilterPass }</code> custom :
          <strong>Rayon</strong> (combobox autocomplete avec chips) et <strong>Prix</strong>
          (dual-range slider). Ouvre le drawer via la toolbar, ajoute une condition sur
          l'une des deux colonnes — l'éditeur de valeur est remplacé et l'opérateur est masqué.
        </p>
        <div class="sb-grid-toolbar">
          <label style="display: inline-flex; align-items: center; gap: 8px;">
            <strong>filter-mode :</strong>
            <select :value="mode" @change="mode = $event.target.value">
              <option value="client">client (default)</option>
              <option value="server">server (predicate is bypassed)</option>
            </select>
          </label>
          <span style="margin-left: 16px;">Dernier <code>filterChange</code> : <code>{{ lastEvent }}</code></span>
        </div>
        <div class="sb-grid-frame">
          <ad-grid-vue
            :height="560"
            ref="gridRef"
            :columns="columns"
            :rows="lmProducts"
            :filter-mode="mode"
            @filter-change="onFilterChange"
            @update:filter-model="filterModel = $event"
          >
            <template #toolbar>
              <ad-grid-toolbar
                show-filters
                :active-filter-count="filterModel.conditions.length"
                @filters="drawerOpen = !drawerOpen"
              />
            </template>
          </ad-grid-vue>
        </div>
        <ad-grid-filter-drawer
          :open="drawerOpen"
          :columns="filterColumns"
          :model="filterModel"
          @update:open="drawerOpen = $event"
          @apply="onApply"
          @clear="onClear"
        />
      </div>
    `,
  }),
}
