import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent, h, markRaw } from 'vue'
import { AdeoGrid, defineStatusRenderer } from '@/components/AdeoGrid'
import type { ColumnDef } from '@/components/AdeoGrid'
import { lmProducts, type LMProduct } from './_fixtures'

const meta = {
  title: 'Stories/Renderers/Text · Tag · Status · Custom · Slot',
  component: AdeoGrid,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Cell renderers

Quatre niveaux de personnalisation, du plus simple au plus puissant :

| Mécanisme | Quand | Effort |
|-----------|-------|--------|
| \`valueFormatter(v) => string\` | Format texte simple (€, dates, %) | 1 ligne |
| \`renderer: 'tag'\` + \`rendererProps\` | Tag built-in avec mapping label/appearance | 5 lignes |
| \`renderer: defineStatusRenderer({...})\` | Tag typé pour enum status | 1 helper |
| \`renderer: VueComponent\` | Renderer Vue arbitraire | 1 component |
| \`<template #cell-{field}>\` | Slot ad-hoc par colonne | inline |

### Renderers built-in

- \`text\` (default) — value brute, applique \`valueFormatter\` si présent
- \`tag\` — \`<MTag :label="value" :appearance="rendererProps.appearance">\`. Avec \`labelMap: { value: { label, appearance } }\` pour mapper par valeur

### Custom renderer — props reçues

\`\`\`ts
interface CellRendererProps<TRow = RowData, TValue = unknown> {
  value: TValue
  row: TRow
  rowIndex: number
  field: string
  column: ColumnDef<TRow>
}
\`\`\`
        `,
      },
    },
  },
} satisfies Meta<typeof AdeoGrid>

export default meta
type Story = StoryObj<typeof meta>

export const TextDefault: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Default text renderer

Sans \`renderer\`, la valeur brute est rendue. Pour formater (€, dates, %), passez \`valueFormatter\`.

### Implémentation

\`\`\`ts
const columns: ColumnDef[] = [
  { field: 'sku', headerName: 'Réf' },
  {
    field: 'price',
    headerName: 'Prix',
    valueFormatter: (v) => typeof v === 'number' ? \`\${v.toFixed(2)} €\` : '',
  },
  {
    field: 'updatedAt',
    valueFormatter: (v) => new Date(v as string).toLocaleDateString('fr-FR'),
  },
]
\`\`\`

### Notes

- Le \`valueFormatter\` ne **transforme pas** la donnée — c'est purement présentation. La sort/filter compare la \`value\` brute, pas la version formatée.
- Pour un format dépendant de la row complète (ex. afficher la devise selon \`row.currency\`), passez par un slot \`#cell-{field}\` plutôt qu'un formatter.
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup() {
      const cols: ColumnDef<LMProduct>[] = [
        { field: 'sku', headerName: 'Réf', width: '120px' },
        { field: 'name', headerName: 'Produit', width: '260px' },
        { field: 'price', headerName: 'Prix', width: '110px', valueFormatter: (v) => typeof v === 'number' ? `${v.toFixed(2)} €` : '' },
      ]
      return { cols, rows: lmProducts.slice(0, 10) }
    },
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Default <code>'text'</code> renderer</h2>
        <p>Aucun <code>renderer</code> spécifié = texte brut. <code>valueFormatter</code> reste appliqué.</p>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560" :columns="cols" :rows="rows" />
        </div>
      </div>
    `,
  }),
}

export const TagRendererSimple: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## \`renderer: 'tag'\`

Rend la value comme un \`<MTag>\` Mozaic. Trois formes :

### Tag uniforme (low-cardinality)

\`\`\`ts
{ field: 'category', renderer: 'tag', rendererProps: { appearance: 'info' } }
\`\`\`

Toutes les valeurs rendues en bleu \`info\`.

### Tag par valeur (\`labelMap\`)

\`\`\`ts
{
  field: 'priority',
  renderer: 'tag',
  rendererProps: {
    labelMap: {
      low:    { label: 'Faible',  appearance: 'neutral' },
      medium: { label: 'Moyen',   appearance: 'info'    },
      high:   { label: 'Haut',    appearance: 'warning' },
      urgent: { label: 'Urgent',  appearance: 'danger'  },
    },
  },
}
\`\`\`

### Avec \`valueFormatter\`

\`\`\`ts
{
  field: 'energyClass',
  renderer: 'tag',
  valueFormatter: (v) => \`Classe \${v}\`,
  rendererProps: { appearance: 'success' },
}
\`\`\`
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup() {
      const cols: ColumnDef<LMProduct>[] = [
        { field: 'name', headerName: 'Produit', width: '260px' },
        {
          field: 'category',
          headerName: 'Rayon',
          width: '160px',
          renderer: 'tag',
          rendererProps: {
            // Same tag style for every value — useful for low-cardinality classification.
            appearance: 'info',
          },
        },
      ]
      return { cols, rows: lmProducts.slice(0, 10) }
    },
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Built-in <code>'tag'</code> renderer</h2>
        <p>Pour rendre une catégorie en MTag sans typer chaque valeur. Ajoute un <code>labelMap</code> dans <code>rendererProps</code> pour des couleurs par valeur.</p>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560" :columns="cols" :rows="rows" />
        </div>
      </div>
    `,
  }),
}

export const StatusRenderer: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## \`defineStatusRenderer()\`

Helper qui retourne un component \`markRaw\` typé pour les enums status. Mêmes capacités que \`renderer: 'tag' + labelMap\`, mais en un seul appel et avec inférence TypeScript propre.

### Implémentation

\`\`\`ts
import { defineStatusRenderer } from '@/components/AdeoGrid'

type ProductStatus = 'in-stock' | 'low' | 'out' | 'preorder'

const StatusCell = defineStatusRenderer<ProductStatus>({
  'in-stock': { label: 'En stock',     appearance: 'success' },
  low:        { label: 'Stock faible', appearance: 'warning' },
  out:        { label: 'Rupture',      appearance: 'danger'  },
  preorder:   { label: 'Précommande',  appearance: 'neutral' },
})

const columns: ColumnDef[] = [
  { field: 'status', headerName: 'État', renderer: StatusCell },
]
\`\`\`

### Pourquoi \`markRaw\` ?

Vue's reactivity proxie tout objet retourné de \`setup()\` par défaut. Marquer le component comme raw évite ce coût (les renderers n'ont pas besoin d'être réactifs eux-mêmes — ce sont des "fonctions de rendu").

### Différence avec \`renderer: 'tag' + labelMap\`

Identique fonctionnellement. \`defineStatusRenderer\` ajoute :
- Type-safety : TS vérifie que les keys du map sont bien des valeurs valides de l'enum
- Une fonction réutilisable d'un fichier à l'autre
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup() {
      const StatusCell = defineStatusRenderer<LMProduct['status']>({
        'in-stock': { label: 'En stock', appearance: 'success' },
        low: { label: 'Stock faible', appearance: 'warning' },
        out: { label: 'Rupture', appearance: 'danger' },
        preorder: { label: 'Précommande', appearance: 'neutral' },
      })
      const cols: ColumnDef<LMProduct>[] = [
        { field: 'sku', headerName: 'Réf', width: '120px', pinned: 'start' },
        { field: 'name', headerName: 'Produit', width: '260px' },
        { field: 'status', headerName: 'État', width: '160px', renderer: StatusCell },
      ]
      return { cols, rows: lmProducts.slice(0, 12) }
    },
    template: `
      <div class="sb-adeo-grid-shell">
        <h2><code>defineStatusRenderer()</code></h2>
        <p>Helper qui mappe une valeur enum vers <code>{ label, appearance }</code> et rend un MTag typé. La sortie est <code>markRaw</code>'d pour ne pas être proxy-ée par Vue.</p>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560" :columns="cols" :rows="rows" />
        </div>
      </div>
    `,
  }),
}

export const CustomVueRenderer: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Custom Vue component renderer

Quand le tag built-in ne suffit pas (étoiles, sparkline, mini-graph, progress bar), passez un component Vue dans \`renderer\`.

### Implémentation

\`\`\`ts
import { defineComponent, h, markRaw } from 'vue'

const StarRating = markRaw(defineComponent({
  name: 'StarRating',
  props: { value: { type: Number, default: 0 } },
  setup(p) {
    return () => h(
      'div',
      { style: 'display: flex; gap: 2px;' },
      [1, 2, 3, 4, 5].map((n) =>
        h('span', { style: { opacity: p.value >= n ? 1 : 0.18 } }, '★'),
      ),
    )
  },
}))

const columns: ColumnDef[] = [
  { field: 'rating', headerName: 'Note', renderer: StarRating },
]
\`\`\`

### Props que le component reçoit

\`\`\`ts
interface CellRendererProps<TRow, TValue> {
  value: TValue
  row: TRow
  rowIndex: number
  field: string
  column: ColumnDef<TRow>
}
\`\`\`

Vous pouvez en déclarer juste un sous-ensemble (ex. \`{ value: { type: Number } }\`) — Vue passe \`value\` automatiquement.

### \`markRaw\` est-il obligatoire ?

Pas obligatoire mais **recommandé** : sans, Vue réactive tout le component à chaque assignation, ce qui est inutile (le component n'est qu'un constructeur). Avec virtual-scroll qui ré-instancie souvent, l'overhead se voit.

### SFC component ?

Marche aussi : \`import StarRating from './StarRating.vue'\`. Pas besoin de \`markRaw\` car les imports SFC sont déjà des composants statiques.
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup() {
      const StarRating = markRaw(
        defineComponent({
          name: 'StarRating',
          props: { value: { type: Number, default: 0 } },
          setup(p) {
            return () => h(
              'div',
              { style: 'display: flex; gap: 2px;' },
              [1, 2, 3, 4, 5].map((n) =>
                h('span', { style: { opacity: p.value >= n ? 1 : 0.18, color: '#f5a623' } }, '★'),
              ),
            )
          },
        }),
      )

      const cols: ColumnDef<LMProduct>[] = [
        { field: 'name', headerName: 'Produit', width: '260px' },
        { field: 'rating', headerName: 'Note', width: '160px', renderer: StarRating },
      ]
      return { cols, rows: lmProducts.slice(0, 10) }
    },
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Custom Vue renderer component</h2>
        <p>Pass un component Vue dans <code>renderer</code>. Il reçoit les <code>CellRendererProps</code> (<code>value, row, field, rowIndex, column</code>).</p>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560" :columns="cols" :rows="rows" />
        </div>
      </div>
    `,
  }),
}

export const ScopedCellSlot: Story = {
  name: 'Scoped #cell-{field} slot',
  parameters: {
    docs: {
      description: {
        story: `
## \`#cell-{field}\` slot

Plus rapide qu'un component custom pour des renderers ad-hoc — pas besoin d'un nouveau \`defineComponent\`.

### Slot props

\`\`\`ts
{
  value: unknown
  row: RowData
  rowIndex: number
  column: ColumnDef
}
\`\`\`

### Implémentation

\`\`\`vue
<AdeoGrid :columns="columns" :rows="rows">
  <template #cell-promo="{ value, row }">
    <span :class="{ promo: value, normal: !value }">
      {{ value ? '🔥 PROMO' : '—' }}
    </span>
  </template>

  <template #cell-price="{ value, row }">
    <strong v-if="row.promo" style="color:#e02020">
      {{ value.toFixed(2) }} €
    </strong>
    <span v-else>{{ value.toFixed(2) }} €</span>
  </template>
</AdeoGrid>
\`\`\`

### Slot vs renderer — lequel choisir ?

| Critère | Slot | Renderer component |
|---------|------|---------------------|
| Une grille | Slot ✓ | — |
| Réutilisable cross-grids | — | Component ✓ |
| Logic complexe / async | — | Component ✓ |
| Test unitaire isolé | — | Component ✓ |
| Style scoped au parent | Slot ✓ | (passe via globals/CSS vars) |

### Précédence

Si slot ET renderer sont définis pour la même colonne, le **slot l'emporte** — le renderer n'est jamais appelé.
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup() {
      const cols: ColumnDef<LMProduct>[] = [
        { field: 'name', headerName: 'Produit', width: '260px' },
        { field: 'price', headerName: 'Prix', width: '120px' },
        { field: 'promo', headerName: 'Promo', width: '120px' },
      ]
      return { cols, rows: lmProducts.slice(0, 10) }
    },
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Per-field cell slot · <code>#cell-promo</code></h2>
        <p>Plus rapide qu'un component custom pour des renderers ad-hoc. Le slot <code>#cell-{field}</code> reçoit <code>{ value, row, rowIndex }</code>.</p>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560" :columns="cols" :rows="rows">
            <template #cell-promo="{ value }">
              <span :style="{
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                background: value ? 'rgba(244, 79, 79, 0.12)' : 'rgba(0,0,0,0.05)',
                color: value ? '#e02020' : '#6c727c',
              }">{{ value ? '🔥 PROMO' : '—' }}</span>
            </template>
          </AdeoGrid>
        </div>
      </div>
    `,
  }),
}
