import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { onMounted, ref } from 'vue'
import { AdeoGrid } from '@/components/AdeoGrid'
import { lmColumns, lmProducts, datasets, type DatasetId } from './_fixtures'

type IntroArgs = { dataset?: DatasetId }

const meta: Meta<IntroArgs> = {
  title: 'Stories/Introduction/Overview',
  component: AdeoGrid,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
# Introduction

AdeoGrid est une data grid Vue 3 + Mozaic pour des datasets jusqu'à 100k+ rows × 150+ colonnes. Construit sur le design system Mozaic (\`@mozaic-ds/vue\`), virtualisée sur les deux axes, avec support natif de l'édition inline, des formules, du grouping, des filtres composés et de la persistance.

### Quick start

\`\`\`vue
<script setup lang="ts">
import { AdeoGrid } from '@/components/AdeoGrid'
import type { ColumnDef, RowData } from '@/components/AdeoGrid'

const columns: ColumnDef[] = [
  { field: 'sku',   headerName: 'Référence', width: '120px', pinned: 'start', sortable: true, filterable: true, filterType: 'text' },
  { field: 'name',  headerName: 'Produit',   width: '260px', sortable: true, editable: true },
  { field: 'price', headerName: 'Prix',      width: '110px', sortable: true, editable: true, cellEditor: 'number',
    valueFormatter: (v) => typeof v === 'number' ? \`\${v.toFixed(2)} €\` : '' },
]
const rows: RowData[] = [
  { sku: 'A-001', name: 'Tondeuse', price: 199 },
  { sku: 'A-002', name: 'Perceuse', price: 99 },
]
</script>

<template>
  <AdeoGrid :columns="columns" :rows="rows" />
</template>
\`\`\`

### Features (one-liners)

- Virtualisation \`virtual-scroll\` (vertical) et \`virtual-columns\` (horizontal)
- Sort multi-colonne (Shift+click), filter inline + drawer multi-conditions, grouping multi-niveaux
- Sélection rows (checkbox) ou cells (range Excel-style) avec floating action bar
- Édition inline avec validators, fill handle drag, undo/redo
- Renderers built-in (text/tag/status) + custom Vue + slots \`#cell-{field}\` / \`#filter-{field}\` / \`#edit-{field}\`
- Formules \`=A1+B2\` style Excel avec DAG topologique
- Pinned columns, expandable rows, pagination, lazy loading
- Persistance auto en \`localStorage\` via \`persist-key\`
- Plugins (\`AdeoGridPlugin\`) pour les comportements cross-cutting

### Switch theme

Utilisez le sélecteur **Theme** dans la toolbar Storybook (en haut à droite) pour basculer entre Leroy Merlin / Adeo / Bricocenter / MBrand. Les tokens CSS Mozaic correspondants se chargent live.
        `,
      },
    },
  },
  argTypes: {
    dataset: {
      control: { type: 'inline-radio' },
      options: ['leroymerlin', 'adeo', 'bricocenter'] satisfies DatasetId[],
      description: 'Switch between brand datasets at runtime',
    },
  },
}

export default meta
type Story = StoryObj<IntroArgs>

export const Default: Story = {
  args: { dataset: 'leroymerlin' },
  parameters: {
    docs: {
      description: {
        story: `
## Default · Leroy Merlin · 20 produits

Un grid minimal avec les colonnes Mozaic Design : Référence, Produit, Rayon, Marque, Prix, Stock, État, Magasin. Toggle le \`dataset\` arg pour changer le marque (Adeo / Bricocenter).

### Ce qui est actif par défaut

- Sort sur les colonnes \`sortable: true\` (toutes ici)
- Filter inline sur les colonnes \`filterable: true\`
- Pinning \`start\` sur Référence, \`end\` sur Magasin
- Renderer \`'tag'\` sur la colonne État
- \`valueFormatter\` € sur Prix

### Ce qui n'est PAS activé

\`selectable\`, \`expandable\`, \`virtual-scroll\`, \`pagination\` — voir leurs stories dédiées.
        `,
      },
    },
  },
  render: (args) => ({
    components: { AdeoGrid },
    setup() {
      return { datasets, args }
    },
    template: `
      <div class="sb-mrx-shell">
        <h2>Default · Leroy Merlin · 20 produits</h2>
        <p>Ouvre le menu kebab d'une colonne pour Sort / Pin / Hide / Filter. Les colonnes Référence + Magasin sont épinglées.</p>
        <div class="sb-mrx-frame">
          <AdeoGrid :height="560" :columns="datasets[args.dataset || 'leroymerlin'].columns" :rows="datasets[args.dataset || 'leroymerlin'].rows" />
        </div>
      </div>
    `,
  }),
}

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Empty state (no rows)

Quand \`rows\` est vide ET aucun filtre actif, la grille affiche le slot \`#empty\` (ou le message default).

### Implémentation

\`\`\`vue
<AdeoGrid :columns="columns" :rows="[]">
  <template #empty="{ hasFilters, clearFilters }">
    <div class="my-empty-state">
      <h3>Aucun produit</h3>
      <button @click="onAdd">+ Ajouter</button>
      <button @click="onImport">Importer un CSV</button>
    </div>
  </template>
</AdeoGrid>
\`\`\`

### Slot props

- \`hasFilters: boolean\` — true si l'état vide est dû à un filtre, false si dataset vide à la base
- \`clearFilters: () => void\` — helper pour reset les filtres si \`hasFilters\`

### Default fallback

Sans slot, la grille affiche \`<AdeoGridEmptyState>\` qui distingue les deux variants (filtered vs pristine) avec un message + un bouton "Reset filters" si applicable.
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup() {
      function onAdd() {
        window.alert?.('Ajouter une ligne…')
      }
      function onImport() {
        window.alert?.('Import CSV…')
      }
      return { lmColumns, onAdd, onImport }
    },
    template: `
      <div class="sb-mrx-shell">
        <h2>Empty state — variante <code>pristine</code></h2>
        <p>Carte centrée avec icône Mozaic + zone d'actions custom via le slot <code>#empty-actions</code>.</p>
        <div class="sb-mrx-frame">
          <AdeoGrid :height="560" :columns="lmColumns" :rows="[]">
            <template #empty-actions>
              <button type="button" class="sb-empty-btn sb-empty-btn--primary" @click="onAdd">+ Ajouter une ligne</button>
              <button type="button" class="sb-empty-btn" @click="onImport">⇪ Importer CSV</button>
            </template>
          </AdeoGrid>
        </div>
      </div>
    `,
  }),
}

export const EmptyFilteredOut: Story = {
  name: 'Empty (filters active)',
  parameters: {
    docs: {
      description: {
        story: `
## Empty state (filtered out)

Quand le dataset n'est pas vide MAIS qu'aucune row ne passe les filtres, le slot \`#empty\` reçoit \`hasFilters: true\`. Le default fallback affiche "Aucun résultat" + un bouton "Reset filters" qui appelle \`clearFilters()\`.

### \`grid.clearFilters()\`

Reset à la fois la filter row inline ET le filterModel du drawer. Pour reset uniquement l'un :

- \`grid.clearQuickFilters()\` — uniquement la filter row
- \`grid.clearFilterModel()\` — uniquement les conditions du drawer
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup() {
      const gridRef = ref<InstanceType<typeof AdeoGrid>>()
      // After the grid mounts, push a quick filter that won't match any row
      // to demo the "filtered" variant. The user can clear it via the
      // built-in button on the empty card.
      onMounted(() => {
        // Allow the grid to render first
        setTimeout(() => gridRef.value?.setFilter('name', 'AUCUN_MATCH_xyz'), 50)
      })
      return { lmColumns, lmProducts, gridRef }
    },
    template: `
      <div class="sb-mrx-shell">
        <h2>Empty state — variante <code>filtered</code></h2>
        <p>Quand des filtres sont actifs mais aucune ligne ne matche : variant ambré + bouton « Effacer les filtres » natif. Le slot <code>#empty-actions</code> reste disponible pour des actions complémentaires.</p>
        <div class="sb-mrx-frame">
          <AdeoGrid :height="560" ref="gridRef" :columns="lmColumns" :rows="lmProducts">
            <template #empty-actions="{ variant }">
              <button v-if="variant === 'filtered'" type="button" class="sb-empty-btn" @click="(e) => e.preventDefault()">↗ Voir tous les rayons</button>
            </template>
          </AdeoGrid>
        </div>
      </div>
    `,
  }),
}

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Loading overlay

\`:loading="true"\` affiche un loading bar/spinner par-dessus le grid **sans cacher les rows existantes**. Pattern UX classique pour les refetches : l'utilisateur garde le contexte de ce qu'il voyait.

### Implémentation

\`\`\`vue
<AdeoGrid :columns="cols" :rows="rows" :loading="isFetching" />
\`\`\`

### Custom slot

\`\`\`vue
<AdeoGrid :loading="isFetching">
  <template #loading>
    <div class="my-spinner">Chargement…</div>
  </template>
</AdeoGrid>
\`\`\`

### Pattern stale-while-revalidate

\`\`\`ts
const rows = ref<Row[]>([])
const isFetching = ref(false)

async function refetch() {
  isFetching.value = true  // overlay starts, rows still visible
  try {
    rows.value = await api.fetch()
  } finally {
    isFetching.value = false
  }
}
\`\`\`
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup: () => ({ lmColumns, lmProducts }),
    template: `
      <div class="sb-mrx-shell">
        <h2>Loading overlay</h2>
        <p>Le grid garde les lignes existantes visibles sous l'overlay pour ne pas perdre le contexte utilisateur.</p>
        <div class="sb-mrx-frame">
          <AdeoGrid :height="560" :columns="lmColumns" :rows="lmProducts" :loading="true" />
        </div>
      </div>
    `,
  }),
}

export const ErrorState: Story = {
  name: 'Error',
  parameters: {
    docs: {
      description: {
        story: `
## Error state

\`:error="myError"\` (un \`Error\` ou \`null\`) replaces le body par le slot \`#error\`. Idéal pour les network failures.

### Implémentation

\`\`\`vue
<script setup lang="ts">
const error = ref<Error | null>(null)

async function load() {
  error.value = null
  try {
    rows.value = await api.fetch()
  } catch (e) {
    error.value = e as Error
  }
}
</script>

<template>
  <AdeoGrid :columns="cols" :rows="rows" :error="error" @retry="load">
    <template #error="{ error, retry }">
      <div class="my-error-state">
        <h3>{{ error.message }}</h3>
        <button @click="retry">Réessayer</button>
      </div>
    </template>
  </AdeoGrid>
</template>
\`\`\`

### Évent \`@retry\`

Émis quand le slot custom appelle \`retry\` (ou quand le default fallback affiche son bouton retry et l'utilisateur click).

### Default fallback

Sans slot, la grille affiche \`<div class="mrx-grid-error">\` avec \`{{ error.message }}\` + un bouton "Retry" qui émet \`@retry\`.
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup: () => ({
      lmColumns,
      err: new Error('Impossible de charger les produits — réessayer ?'),
    }),
    template: `
      <div class="sb-mrx-shell">
        <h2>Error state</h2>
        <p>Pass an Error to <code>:error</code> — le grid émet <code>retry</code> si l'utilisateur clique le bouton de relance.</p>
        <div class="sb-mrx-frame">
          <AdeoGrid :height="560" :columns="lmColumns" :rows="[]" :error="err" />
        </div>
      </div>
    `,
  }),
}
