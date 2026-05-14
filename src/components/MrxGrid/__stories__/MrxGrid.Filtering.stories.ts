import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'
import {
  MrxGrid,
  MrxGridFilterDrawer,
  MrxGridToolbar,
} from '@/components/MrxGrid'
import type { ColumnDef } from '@/components/MrxGrid'
import {
  DEFAULT_OPERATORS,
  DEFAULT_OPERATOR_PER_TYPE,
  type FilterColumnDescriptor,
  type FilterDataType,
  type FilterModel,
} from '@/components/MrxGrid/models/filter.model'
import { lmColumns, lmProducts } from './_fixtures'

const meta = {
  title: 'Stories/Filtering/Inline · Drawer · Server-side',
  component: MrxGrid,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
# Filtering

MrxGrid expose **trois surfaces de filtrage complémentaires**, à activer indépendamment selon votre UX :

| Surface | Quand l'utiliser | Activation |
|---------|------------------|------------|
| **Inline filter row** | Filtres rapides "1 input par colonne" sous le header | \`filterable: true\` + \`filterType\` sur la \`ColumnDef\` |
| **Filter drawer** | Builder multi-conditions avec combinators AND/OR | \`<MrxGridFilterDrawer>\` + \`grid.setFilterModel()\` |
| **Server-side** | La grille n'évalue rien client-side, elle émet \`filterChange\` | prop \`server-filter\` |

Les surfaces composent : un filtre du drawer **ET** un filtre inline filtrent la même donnée (intersection). Toutes les conditions partagent le même engine ([\`useFilterEngine\`](src/components/MrxGrid/features/useFilterEngine.ts)).

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
} satisfies Meta<typeof MrxGrid>

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
<MrxGrid :columns="columns" :rows="rows" />
\`\`\`

### Comment ça marche en interne

1. La filter row ([\`MrxGridFilterRow.vue\`](src/components/MrxGrid/components/header/MrxGridFilterRow.vue)) itère les colonnes et délègue à \`MrxGridFilterCell\` qui choisit le bon input selon \`filterType\`.
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
    components: { MrxGrid },
    setup: () => ({ lmColumns, lmProducts }),
    template: `
      <div class="sb-mrx-shell">
        <h2>Inline filter row</h2>
        <p>Chaque colonne marquée <code>filterable: true</code> avec un <code>filterType</code> expose son input dans la rangée de filtres juste sous le header. Text, number, date et set sont built-in.</p>
        <div class="sb-mrx-frame">
          <MrxGrid :height="560" :columns="lmColumns" :rows="lmProducts" />
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
  <MrxGrid :columns="columns" :rows="filteredRows">
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
  </MrxGrid>
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
    components: { MrxGrid },
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
      <div class="sb-mrx-shell">
        <h2>Custom <code>#filter-{field}</code> slots</h2>
        <p>
          Le slot <code>#filter-{field}</code> reçoit <code>{ column, value, setValue, clear }</code>
          et remplace l'input par défaut dans la filter row. Chaque slot remplit la
          largeur de sa colonne. Trois exemples ci-dessous : recherche texte sur
          <code>name</code>, select avec valeur <em>All</em> sur <code>category</code>,
          input "Max price" sur <code>price</code>.
        </p>
        <div class="sb-mrx-frame">
          <MrxGrid :height="560" :columns="lmColumns" :rows="filteredRows">
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
          </MrxGrid>
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

\`MrxGridFilterDrawer\` ouvre un panneau latéral où l'utilisateur empile des conditions (\`field\` × \`operator\` × \`value\`) reliées par AND/OR. Le drawer maintient un \`FilterModel\` indépendant qui s'applique en bloc sur "Apply".

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
import { MrxGrid, MrxGridFilterDrawer, MrxGridToolbar } from '@/components/MrxGrid'
import {
  DEFAULT_OPERATORS,
  DEFAULT_OPERATOR_PER_TYPE,
  type FilterColumnDescriptor,
  type FilterDataType,
  type FilterModel,
} from '@/components/MrxGrid/models/filter.model'

const gridRef    = ref<InstanceType<typeof MrxGrid>>()
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
  <MrxGrid ref="gridRef" :columns="columns" :rows="rows">
    <template #toolbar>
      <MrxGridToolbar
        show-filters
        :active-filter-count="model.conditions.length"
        @filters="drawerOpen = !drawerOpen"
      />
    </template>
  </MrxGrid>

  <MrxGridFilterDrawer
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

Pour éviter de wirer le drawer + le model + filterColumns à la main, utilisez \`<MrxGridSmartToolbar>\` qui les bundle. Voir story *Devtools / Event console*.
        `,
      },
    },
  },
  render: () => ({
    components: { MrxGrid, MrxGridFilterDrawer, MrxGridToolbar },
    setup() {
      const drawerOpen = ref(false)
      const filterModel = ref<FilterModel>({ conditions: [] })
      const gridRef = ref<InstanceType<typeof MrxGrid>>()
      const columns = lmColumns

      const filterColumns = computed<FilterColumnDescriptor[]>(() =>
        columns.map((col: ColumnDef) => {
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

      return { lmColumns, lmProducts, gridRef, drawerOpen, filterColumns, filterModel, onApply, onClear }
    },
    template: `
      <div class="sb-mrx-shell">
        <h2>Multi-condition filter drawer</h2>
        <p>Le drawer permet d'empiler des conditions par colonne (text contains / number between / set in…) et de les appliquer en bloc. Le drawer se ferme via la croix ou l'overlay (<code>@update:open</code>).</p>
        <div class="sb-mrx-frame">
          <MrxGrid :height="560" ref="gridRef" :columns="lmColumns" :rows="lmProducts">
            <template #toolbar>
              <MrxGridToolbar
                show-filters
                :active-filter-count="filterModel.conditions.length"
                @filters="drawerOpen = !drawerOpen"
              />
            </template>
          </MrxGrid>
        </div>
        <MrxGridFilterDrawer
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
  <MrxGrid
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
    components: { MrxGrid },
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
      <div class="sb-mrx-shell">
        <h2>Server-side filtering</h2>
        <p>Avec <code>:server-filter="true"</code>, le grid n'applique pas le filtre lui-même : il émet <code>filterChange</code>, à toi de re-fetch et de repasser <code>:rows</code>.</p>
        <div class="sb-mrx-toolbar">Dernier query envoyé : <code>{{ lastQuery }}</code></div>
        <div class="sb-mrx-frame">
          <MrxGrid :height="560"
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
