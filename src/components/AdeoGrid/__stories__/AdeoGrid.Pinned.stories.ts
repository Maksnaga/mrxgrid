import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { AdeoGrid } from '@/components/AdeoGrid'
import type { ColumnDef } from '@/components/AdeoGrid'
import { generateLMProducts, type LMProduct } from './_fixtures'

const meta = {
  title: 'Stories/Pinned Columns/Start · End · Both',
  component: AdeoGrid,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Pinned columns

Une colonne pinned reste collée à un bord pendant le scroll horizontal — comme dans Excel "Freeze panes". Implémenté via \`position: sticky\` (pas de transform, pour ne pas casser la sticky en cascade).

| Forme | Effet |
|-------|-------|
| \`pinned: 'start'\` | Sticky-left |
| \`pinned: 'end'\` | Sticky-right |
| \`freezable: true\` | Active l'option dans le menu kebab du header (pin left / pin right / unpin) |

### Sous le capot

- Les colonnes left-pinned sont rendues en premier dans la \`AdeoGridRow\` ; les right-pinned en dernier. \`useGridState\` les expose en \`pinnedLeftColumns\`, \`pinnedRightColumns\`.
- Le \`getPinnedStyle(side, index, isHeader)\` calcule les \`left:\` / \`right:\` cumulés selon l'ordre.
- Le wrapper de body utilise \`min-width: totalContentWidth\` pour garantir que les rows débordent assez pour que les pinned cells "restent collées".
        `,
      },
    },
  },
} satisfies Meta<typeof AdeoGrid>

export default meta
type Story = StoryObj<typeof meta>

const wide: ColumnDef<LMProduct>[] = [
  { field: 'sku', headerName: 'Réf', width: '120px', pinned: 'start' },
  { field: 'name', headerName: 'Produit', width: '260px' },
  { field: 'category', headerName: 'Rayon', width: '160px' },
  { field: 'brand', headerName: 'Marque', width: '140px' },
  { field: 'price', headerName: 'Prix', width: '110px' },
  { field: 'stock', headerName: 'Stock', width: '90px' },
  { field: 'rating', headerName: 'Note', width: '90px' },
  { field: 'energyClass', headerName: 'Énergie', width: '110px' },
  { field: 'updatedAt', headerName: 'MAJ', width: '110px' },
  { field: 'store', headerName: 'Magasin', width: '180px' },
  { field: 'status', headerName: 'État', width: '120px', pinned: 'end' },
]

export const StartAndEnd: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Pin start + end (déclaratif)

Définissez \`pinned: 'start'\` ou \`'end'\` dans la \`ColumnDef\` à l'init.

### Implémentation

\`\`\`ts
const columns: ColumnDef[] = [
  { field: 'sku',     headerName: 'Réf',   width: '120px', pinned: 'start' },
  { field: 'name',    headerName: 'Produit', width: '260px' },
  { field: 'price',   headerName: 'Prix',  width: '110px' },
  // …
  { field: 'status',  headerName: 'État',  width: '120px', pinned: 'end' },
]
\`\`\`

### Anti-pattern

Évitez \`width: 'auto'\` ou pourcentage sur les pinned columns : la couche \`position: sticky\` a besoin d'une largeur fixe pour calculer les offsets cumulés. Toujours en \`px\`.

### Plusieurs colonnes pinned du même côté

Empilez-les dans l'ordre voulu — les left-pinned apparaissent dans l'ordre déclaratif (1ère = la plus à gauche), idem right-pinned (1ère après les data = la plus à gauche du groupe right).

### Combinaison avec column drag

\`useColumnDnD\` respecte la zone pinned : on ne peut pas drag une data column dans la zone pinned (et inversement) sans que l'engine update son flag. Le menu kebab fait le swap proprement via \`columnMenuAction: 'pin-left' | 'pin-right' | 'unpin'\`.
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup: () => ({ wide, rows: generateLMProducts(60) }),
    template: `
      <div class="sb-mrx-shell">
        <h2>Pinned columns (start + end)</h2>
        <p>Référence à gauche, État à droite — restent visibles pendant le scroll horizontal. Use <code>pinned: 'start' | 'end'</code> dans la def colonne.</p>
        <div class="sb-mrx-frame">
          <AdeoGrid :height="560" :columns="wide" :rows="rows" />
        </div>
      </div>
    `,
  }),
}

export const ToggleViaHeaderMenu: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Toggle pin via header menu

Avec \`freezable: true\`, le menu kebab d'une colonne expose **Pin to left / Pin to right / Unpin**. L'engine flip \`columnState.pinned\` à la volée — pas besoin de prop \`pinned\` initiale.

### Implémentation

\`\`\`ts
const columns: ColumnDef[] = wide.map((c) => ({ ...c, freezable: true }))
\`\`\`

### Évent

\`\`\`vue
<AdeoGrid @column-menu-action="onMenuAction" />
\`\`\`

\`\`\`ts
function onMenuAction(action: ColumnMenuAction) {
  // action.type === 'pin-left' | 'pin-right' | 'unpin' | 'hide' | 'sort-asc' | …
}
\`\`\`

### Persister l'état utilisateur

Le \`pinned\` flag mute via \`grid.persistView()\` (manuel) ou la prop \`persistKey\` (auto en \`localStorage\`). Au reload, \`grid.restoreView()\` réapplique \`pinned\`, l'ordre, les widths.

\`\`\`vue
<AdeoGrid persist-key="my-grid-v1" :columns="cols" :rows="rows" />
\`\`\`
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup() {
      const cols: ColumnDef<LMProduct>[] = wide.map((c) => ({ ...c, freezable: true }))
      return { cols, rows: generateLMProducts(60) }
    },
    template: `
      <div class="sb-mrx-shell">
        <h2>Toggle pin via header menu</h2>
        <p>Avec <code>freezable: true</code>, le menu kebab d'une colonne expose Pin left / Pin right / Unpin. Click le menu d'une colonne pour essayer.</p>
        <div class="sb-mrx-frame">
          <AdeoGrid :height="560" :columns="cols" :rows="rows" />
        </div>
      </div>
    `,
  }),
}
