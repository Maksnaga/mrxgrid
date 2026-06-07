import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { AdeoGrid } from '@/components/AdeoGrid'
import { generateLMProducts, lmColumns } from './_fixtures'

const meta = {
  title: 'Stories/Pagination/Default · Custom page sizes',
  component: AdeoGrid,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Pagination

Activez le footer pagination via la prop \`pagination\`. Compose proprement avec virtual-scroll : la grille ne rend que la page courante (donc \`pageSize × rowHeight\` lignes en DOM).

| Forme | Comportement |
|-------|--------------|
| \`:pagination="true"\` | Defaults : pageSizeOptions \`[10, 25, 50, 100]\`, defaultPageSize \`25\` |
| \`:pagination="{ pageSizeOptions, defaultPageSize }"\` | Custom |
| Omis ou \`false\` | Pas de footer, scrolle tout |

### Évent émis

\`\`\`ts
@page-change="(e: { page: number; pageSize: number; startIndex: number; endIndex: number })"
\`\`\`

\`page\` est 0-indexed dans le payload. \`startIndex\` / \`endIndex\` sont les bornes dans le \`sortedFilteredData\` (utile pour le server-side fetch).
        `,
      },
    },
  },
} satisfies Meta<typeof AdeoGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Pagination par défaut

\`\`\`vue
<AdeoGrid
  :columns="columns"
  :rows="rows"
  :pagination="true"
  virtual-scroll
  :container-height="500"
  @page-change="onPageChange"
/>
\`\`\`

### Pourquoi pagination + virtual-scroll ensemble

La pagination réduit le set à \`pageSize\` lignes (~25–100). Le virtual-scroll est juste là pour le rendu fluide des grandes pages — sans coût quand la page est petite. Pas d'antinomie.

### \`@page-change\` payload

\`\`\`ts
function onPageChange(e: {
  page: number       // 0-indexed
  pageSize: number
  startIndex: number // dans sortedFilteredData
  endIndex: number
}) {
  // server-side: refetch slice [startIndex, endIndex)
}
\`\`\`

### Reset programmé

Pas d'API \`grid.goToPage()\` exposée actuellement — utilisez le footer ou la pagination state via \`grid.persistView()\` / \`restoreView()\` si vous voulez un état figé.
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup() {
      const lastPage = ref<string>('—')
      function onPageChange(p: { page: number; pageSize: number; startIndex: number; endIndex: number }) {
        lastPage.value = `page ${p.page + 1} · taille ${p.pageSize} · indices ${p.startIndex}–${p.endIndex}`
      }
      return { lmColumns, rows: generateLMProducts(523), lastPage, onPageChange }
    },
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Pagination par défaut</h2>
        <p>Pass <code>:pagination="true"</code> pour activer le footer pagination avec les tailles standard. L'évent <code>pageChange</code> remonte page courante + indices.</p>
        <div class="sb-adeo-grid-toolbar">Dernier <code>pageChange</code> : <code>{{ lastPage }}</code></div>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560" :columns="lmColumns" :rows="rows" :pagination="true" virtual-scroll :container-height="500" @page-change="onPageChange" />
        </div>
      </div>
    `,
  }),
}

export const CustomPageSizes: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Custom page sizes

Passez un objet \`PaginationConfig\` au lieu du booléen pour configurer le footer.

### Type

\`\`\`ts
interface PaginationConfig {
  pageSizeOptions?: number[]   // defaults [10, 25, 50, 100]
  defaultPageSize?: number     // defaults 25
}
\`\`\`

### Implémentation

\`\`\`ts
const pagination = { pageSizeOptions: [10, 25, 50, 100, 250], defaultPageSize: 25 }
\`\`\`

\`\`\`vue
<AdeoGrid
  :columns="columns"
  :rows="rows"
  :pagination="pagination"
  virtual-scroll
  :container-height="500"
/>
\`\`\`

### Tip — pagination + lazy load

Si vous avez 1M de rows et faites du server-side, combinez avec \`:total-count="1_000_000"\`. Le footer affiche la pagination correcte et le scrollbar reflète le total, même si \`rows\` ne contient que la page courante.
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup: () => ({
      lmColumns,
      rows: generateLMProducts(523),
      pagination: { pageSizeOptions: [10, 25, 50, 100, 250], defaultPageSize: 25 },
    }),
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Custom page sizes</h2>
        <p>Pass <code>:pagination="{ pageSizeOptions, defaultPageSize }"</code> pour customiser le dropdown "Rows per page".</p>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560" :columns="lmColumns" :rows="rows" :pagination="pagination" virtual-scroll :container-height="500" />
        </div>
      </div>
    `,
  }),
}
