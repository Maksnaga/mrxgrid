import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { AdGridVue } from '@/components/Grid'
import type { ColumnDef, RowData } from '@/components/Grid'
import { lmColumns, generateLMProducts } from './_fixtures'

const meta = {
  title: 'Stories/Virtual Scroll/Vertical · Horizontal · Both',
  component: AdGridVue,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Virtual scroll

Le virtual scroll est ce qui permet à Grid de tenir 100k+ rows × 150+ colonnes sans crash. Toujours actif sur les deux axes — aucun input à brancher.

### Architecture

- \`useVirtualScroll\` est **index-based** — expose \`visibleRange\` (entiers) + \`getRow(i)\`. Aucune allocation de \`rows[]\` au scroll.
- Plafond dur de **80 lignes rendues max** pour éviter la dégradation perf avec rowHeight petit.
- Spacer DIV haut (height-based) au lieu de \`translateY\` — \`translate\` créerait un containing block qui casserait la sticky des pinned columns.
- \`ResizeObserver\` synchronise la container height pour le mode fullscreen / density change.
- Sur l'axe horizontal, les pinned (start/end) restent toujours rendues — la slice virtualisée ne couvre que la zone unpinned.

### Props utiles

| Prop | Default | Rôle |
|------|---------|------|
| \`container-height\` | 600 | Hauteur visible (px) |
| \`overscan\` | 5 | Lignes rendues au-dessus/dessous du viewport |
| \`column-overscan\` | 2 | Colonnes rendues hors viewport horizontal |

### Variable row heights

Pour les detail rows / group rows à hauteur dynamique, utilisez \`useVariableHeightVirtualScroll\` (exporté depuis le barrel). Voir story *Row Expansion*.
        `,
      },
    },
  },
} satisfies Meta<typeof AdGridVue>

export default meta
type Story = StoryObj<typeof meta>

export const VerticalLargeDataset: Story = {
  name: 'Vertical · 100 000 lignes',
  parameters: {
    docs: {
      description: {
        story: `
## Vertical virtual scroll

La virtualisation verticale est toujours active — passe juste \`columns\`, \`rows\` et \`container-height\`.

\`\`\`vue
<ad-grid-vue
  :columns="columns"
  :rows="rows100k"
  :container-height="600"
/>
\`\`\`

### Comment ça marche

1. \`useVirtualScroll\` mesure le scrollTop sur le wrapper, calcule \`visibleRange = [start, end]\` à partir de \`rowHeight\` (réactif sur la density)
2. La grille rend uniquement \`rows.slice(start, end + overscan)\`
3. Un spacer DIV au-dessus avec \`height = start * rowHeight\` pousse les rows visibles à la bonne position
4. La total height vient de \`(totalCount ?? rows.length) * rowHeight\` — le scrollbar est correct même avec lazy load partiel

### Optimisations

- DOM \`scrollTop\` est clampé quand le content height shrink (ex. grouping qui collapse 100k rows → 4 groups)
- Container height synchronisée via \`ResizeObserver\` → fullscreen / responsive ne casse pas le calcul
- \`rowHeight\` réactif (\`Ref<number>\`) — au switch de density, la position de scroll est préservée (la 1ère row visible reste stable)

### Tip

Pour un wrapper parent \`flex\`/\`grid\` qui contraint la hauteur, mettez \`:height="'100%'"\` sur \`<ad-grid-vue>\` et laissez \`container-height\` à \`auto\`. Le \`ResizeObserver\` adaptera.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup: () => ({ lmColumns, rows: generateLMProducts(100_000) }),
    template: `
      <div class="sb-grid-shell">
        <h2>Vertical virtual scroll · 100 000 lignes</h2>
        <p>Passe une <code>:container-height</code>. Seules les lignes visibles + overscan sont rendues — la virtualisation verticale est toujours active.</p>
        <div class="sb-grid-frame" style="height: 600px">
          <ad-grid-vue :height="560" :columns="lmColumns" :rows="rows" :container-height="600" />
        </div>
      </div>
    `,
  }),
}

export const HorizontalManyColumns: Story = {
  name: 'Horizontal · 200 colonnes',
  parameters: {
    docs: {
      description: {
        story: `
## Horizontal virtual scroll

La virtualisation horizontale est toujours active — sous ~20 colonnes l'engine se contente d'un no-op.

\`\`\`vue
<ad-grid-vue
  :columns="columns200"
  :rows="rows"
  :container-height="520"
/>
\`\`\`

### Comportement

- Les colonnes data en dehors du viewport horizontal ne sont **pas rendues** — DOM count linéaire dans le \`visibleColumnRange\`, pas dans le total
- Les pinned (start/end) restent toujours rendues — elles ne sont pas virtualisées
- \`column-overscan\` (default 2) buffer pour scrolls rapides

### Limites

- Le \`columnOrder\` (drag-drop) fonctionne sur la liste *complète*, pas juste la slice — geste cohérent
- L'expander row utilise \`grid-template-columns\` côté CSS. Combiné avec \`expandable\`, l'expand row passe en \`<ad-grid-detail-row>\` full-width — pas affecté.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup() {
      // Wide columns = 200, plus a few "real" columns from the LM dataset on the left.
      const cols: ColumnDef[] = [
        { field: 'sku', headerName: 'Réf', width: '120px', pinned: 'start' },
        { field: 'name', headerName: 'Produit', width: '220px', pinned: 'start' },
        ...Array.from({ length: 200 }, (_, i) => ({
          field: `metric_${i}`,
          headerName: `M${i}`,
          width: '90px',
        })),
      ]
      const base = generateLMProducts(80)
      const rows: RowData[] = base.map((r) => {
        const augmented: RowData = { ...r }
        for (let i = 0; i < 200; i++) augmented[`metric_${i}`] = Math.round(Math.random() * 1000)
        return augmented
      })
      return { cols, rows }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>Horizontal virtual scroll · 200 colonnes</h2>
        <p>Les colonnes hors viewport ne sont pas rendues, les pinned restent collées. Virtualisation horizontale toujours active.</p>
        <div class="sb-grid-frame" style="height: 520px">
          <ad-grid-vue :height="560" :columns="cols" :rows="rows" :container-height="520" />
        </div>
      </div>
    `,
  }),
}

export const BothAxes: Story = {
  name: 'Vertical + Horizontal',
  parameters: {
    docs: {
      description: {
        story: `
## Both axes (la combo "stress test")

Les deux engines sont toujours actifs — rien à brancher.

\`\`\`vue
<ad-grid-vue
  :columns="columns100"
  :rows="rows50k"
  :container-height="560"
/>
\`\`\`

50 000 × 100 = 5 millions de cellules dans le \`rowsxcolumns\` mathématique. Le DOM en rend ~80 × ~30 = ~2400 cellules max → peu de coût même sur un MacBook Air.

### Bench typique

| Métrique | Cible |
|----------|-------|
| Initial mount | < 200ms |
| Scroll FPS | > 55 |
| Scrollbar drag → première frame | < 16ms |

### Anti-patterns qui tuent les perfs

- \`v-for\` sur les cellules dans un \`#cell-{field}\` slot complexe (ex. \`<MTooltip>\` partout) → coupez le rendu en \`v-show\` conditionnel ou un wrapper léger
- \`computed()\` lourds dans \`valueFormatter\` — préférez memoization manuelle
- Re-trier 100k rows à chaque keystroke → debouncez les triggers de \`@filter-change\`

### Test ?

Ouvrez la story, scrollez bestially. La courbe FPS dans les DevTools doit rester ~60 sans dropdowns.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup() {
      const cols: ColumnDef[] = [
        { field: 'sku', headerName: 'Réf', width: '120px', pinned: 'start' },
        ...Array.from({ length: 100 }, (_, i) => ({ field: `c${i}`, headerName: `C${i}`, width: '80px' })),
      ]
      const rows: RowData[] = Array.from({ length: 50_000 }, (_, r) => {
        const row: RowData = { sku: `LM-${String(r).padStart(6, '0')}` }
        for (let c = 0; c < 100; c++) row[`c${c}`] = (r * 31 + c * 7) % 9999
        return row
      })
      return { cols, rows }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>50 000 × 100 cellules virtualisées</h2>
        <p>Le grid combine <code>useVirtualScroll</code> + <code>useVirtualColumns</code> pour ne jamais rendre plus de ~80 lignes × ~30 colonnes en simultané.</p>
        <div class="sb-grid-frame" style="height: 560px">
          <ad-grid-vue :height="560" :columns="cols" :rows="rows" :container-height="560" />
        </div>
      </div>
    `,
  }),
}
