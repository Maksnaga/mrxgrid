import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { AdGridVue } from '@/components/Grid'
import type { ColumnDef } from '@/components/Grid'
import { lmColumns, lmProducts, type LMProduct } from './_fixtures'

const meta = {
  title: 'Stories/Sorting/Single · Multi · Custom comparator',
  component: AdGridVue,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Sorting

Le sort est piloté par \`sortable: true\` sur la \`ColumnDef\` + une *sort stack* maintenue par l'engine (\`useSortEngine\`). Trois variantes :

- **Single** — click sur header, cycle asc → desc → unsort
- **Multi-column** — \`Shift+click\` empile dans la stack ; l'ordre = priorité
- **Custom comparator** — \`sortComparator(a, b)\` sur la \`ColumnDef\` pour les ordres non-lexicaux (A→G, dates non-ISO, locales)

### API impérative

- \`grid.getSortModel()\` → \`SortDef[]\` (la stack courante)
- \`grid.clearSort()\` — reset toute la stack
        `,
      },
    },
  },
} satisfies Meta<typeof AdGridVue>

export default meta
type Story = StoryObj<typeof meta>

export const SingleColumn: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Single-column sort

Click sur un header avec \`sortable: true\` → asc → desc → unsort. La grille re-évalue \`sortedData\` réactivement (étape 2 du pipeline \`source → sorted → filtered → paginated → display\`).

### Implémentation

\`\`\`ts
const columns: ColumnDef[] = [
  { field: 'name',  headerName: 'Produit', sortable: true },
  { field: 'price', headerName: 'Prix',    sortable: true },
  { field: 'stock', headerName: 'Stock',   sortable: true },
]
\`\`\`

\`\`\`vue
<ad-grid-vue :columns="columns" :rows="rows" />
\`\`\`

### Tri par défaut au mount

\`\`\`ts
{ field: 'price', sortable: true, defaultSort: 'desc' }
\`\`\`

### Server-side sort

Combinez avec \`server-filter\` ou \`server-grouping\` ; au lieu de re-trier en client, écoutez \`@sort-change\` (via le filterChange/pageChange combiné) et re-fetchez avec \`grid.getSortModel()\`.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup: () => ({ lmColumns, lmProducts }),
    template: `
      <div class="sb-grid-shell">
        <h2>Single-column sort</h2>
        <p>Click sur le header → asc / desc / unsort. Toutes les colonnes <code>sortable: true</code> sont triables ; le sort indicator s'affiche dans le header.</p>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560" :columns="lmColumns" :rows="lmProducts" />
        </div>
      </div>
    `,
  }),
}

export const MultiColumn: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Multi-column sort (sort stack)

\`Shift+click\` sur un header **empile** la colonne dans la sort stack au lieu de remplacer. L'ordre d'empilement = priorité (premier ajouté → tri primaire, suivants → tie-breakers).

### Comportement

| Action | Résultat |
|--------|----------|
| Click sur un header | Remplace la stack par cette colonne (asc) |
| Click à nouveau | Toggle desc, puis unsort |
| Shift+click sur un autre header | Push la colonne en bas de la stack |
| Shift+click sur une colonne déjà dans la stack | Cycle asc/desc/remove sur cette entrée |

### Forme du SortModel

\`\`\`ts
type SortDef = { field: string; direction: 'asc' | 'desc' }
const stack: SortDef[] = grid.getSortModel()
// [{ field: 'category', direction: 'asc' }, { field: 'price', direction: 'desc' }]
\`\`\`

### Implémentation — c'est zero config

Toutes les colonnes \`sortable: true\` participent automatiquement à la stack. Le \`Shift\` est intercepté par l'engine au click sur le header (\`AdGridHeaderCell\`).

### Reset programmé

\`\`\`ts
grid.clearSort()  // wipes the stack
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
        <h2>Multi-column sort (sort stack)</h2>
        <p><kbd>Shift</kbd>+click sur les headers pour empiler. L'ordre du stack pilote la priorité (premier ajouté = primaire).</p>
        <div class="sb-grid-toolbar">Essaie : Shift+click sur <code>Rayon</code>, puis Shift+click sur <code>Prix</code>.</div>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560" :columns="lmColumns" :rows="lmProducts" />
        </div>
      </div>
    `,
  }),
}

export const CustomComparator: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Custom comparator

Pour les ordres non-lexicaux, surchargez \`sortComparator(a, b)\` sur la \`ColumnDef\`. Cas classiques :

- **Grades** : A > B > C > … > G (alphabétique fonctionnerait ici, mais pas pour AAA > AA > A)
- **Locales** : tri FR avec accents (\`Intl.Collator('fr')\`)
- **Dates non-ISO** : "12/04/2026" parsé en \`Date\` avant comparaison
- **Statuts custom** : \`['draft', 'review', 'approved', 'archived']\`

### Signature

\`\`\`ts
sortComparator?: (a: RowData, b: RowData) => number
\`\`\`

Retourne \`< 0\` si \`a\` doit venir avant \`b\`, \`> 0\` après, \`0\` égal. Le sens (asc/desc) est appliqué *par-dessus* par l'engine — votre comparator définit toujours l'ordre **ascendant**.

### Implémentation

\`\`\`ts
const ENERGY_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const columns: ColumnDef<Product>[] = [
  {
    field: 'energyClass',
    headerName: 'Classe énergie',
    sortable: true,
    sortComparator: (a, b) =>
      ENERGY_ORDER.indexOf(a.energyClass) - ENERGY_ORDER.indexOf(b.energyClass),
  },
]
\`\`\`

### Locale-aware text sort

\`\`\`ts
const collator = new Intl.Collator('fr', { sensitivity: 'base' })
{ field: 'name', sortable: true,
  sortComparator: (a, b) => collator.compare(a.name, b.name) }
\`\`\`
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup() {
      const ENERGY_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
      const cols: ColumnDef<LMProduct>[] = [
        { field: 'sku', headerName: 'Réf', width: '120px', pinned: 'start' },
        { field: 'name', headerName: 'Produit', width: '260px', sortable: true },
        {
          field: 'energyClass',
          headerName: 'Classe énergie',
          width: '160px',
          sortable: true,
          // Custom comparator: alphabetical comparison would put A < B, which we want, but a real
          // grade scale isn't always lexical (think "AAA > AA > A"). Show the API on a domain
          // where the order is meaningful — A is best, G is worst.
          sortComparator: (a, b) =>
            ENERGY_ORDER.indexOf(a.energyClass) - ENERGY_ORDER.indexOf(b.energyClass),
        },
        { field: 'price', headerName: 'Prix', width: '110px', sortable: true },
      ]
      return { cols, lmProducts }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>Custom sort comparator</h2>
        <p>Définis <code>sortComparator(a, b)</code> sur la colonne pour overrider le tri par défaut. Pratique pour des grades (A→G), des locales spécifiques (collation FR), des dates ISO.</p>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560" :columns="cols" :rows="lmProducts" />
        </div>
      </div>
    `,
  }),
}
