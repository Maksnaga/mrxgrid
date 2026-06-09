import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { AdGridVue } from '@/components/Grid'
import { lmColumns, lmProducts, type LMProduct } from './_fixtures'

const meta = {
  title: 'Stories/Row Expansion/Detail row',
  component: AdGridVue,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Row expansion

Active \`:expandable\` pour ajouter une colonne chevron en début de ligne. Click sur le chevron toggle un detail panel (slot \`#expand-row\`) sous la row, full-width.

### Slot props

\`\`\`ts
{ row: RowData; index: number }
\`\`\`

### State

L'état d'expansion vit dans \`gridState.expandedRowIds\` (\`Set\`) — le \`rowId\` (cf. \`:row-id\` ou \`rowIdField\`) sert de clé. Toggle persistant à travers sort/filter (à condition d'avoir un \`rowId\` stable).

### API impérative

Pas exposée actuellement — les toggles passent par le clic chevron uniquement. Pour un toggle programmé, manipulez \`expandedRowIds\` directement via un plugin.

### Styling

Le detail row utilise \`<ad-grid-detail-row>\` qui pose un \`grid-column: 1 / -1\` (couvre toute la largeur). Le content est libre : graph, table secondaire, formulaire d'édition longue, etc.
        `,
      },
    },
  },
} satisfies Meta<typeof AdGridVue>

export default meta
type Story = StoryObj<typeof meta>

export const ExpandableRows: Story = {
  args: { columns: lmColumns, rows: lmProducts },
  parameters: {
    docs: {
      description: {
        story: `
## Expandable rows

\`\`\`vue
<ad-grid-vue :columns="columns" :rows="rows" expandable>
  <template #expand-row="{ row, index }">
    <div class="my-detail-panel">
      <strong>{{ row.name }}</strong>
      <p>SKU {{ row.sku }} · marque {{ row.brand }} · stock {{ row.stock }}</p>
    </div>
  </template>
</ad-grid-vue>
\`\`\`

### Comportement

- Chevron \`▸\` (collapsed) / \`▾\` (expanded) — utilise les icons Mozaic \`ChevronRight20\` / \`ChevronDown20\`
- Click sur le chevron uniquement, pas sur la row entière (sinon ça gênerait la sélection cell)
- L'expand row remplace pas la data row — elle s'insère **dessous**

### Hauteur variable

Le detail panel a une hauteur libre (le content drive). Le virtual scroll utilise une variante \`useVariableHeightVirtualScroll\` qui mesure dynamiquement les rows expansed pour calculer le total scroll height — pas besoin de prop \`expandRowHeight\`.

### Plusieurs rows ouvertes en même temps

OK par défaut. Si vous voulez "accordéon" (une seule ouverte à la fois), gérez ça côté plugin :

\`\`\`ts
const accordion = (state) => {
  watch(state.expandedRowIds, (next, prev) => {
    if (next.size > 1) {
      const last = [...next].pop()
      state.expandedRowIds.value = new Set(last ? [last] : [])
    }
  })
}
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
        <h2>Expandable rows</h2>
        <p>Active <code>:expandable</code>. Une chevron apparaît en début de ligne pour toggle la row de détail (slot <code>#expand-row</code>).</p>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560" :columns="lmColumns" :rows="lmProducts" expandable>
            <template #expand-row="{ row }">
              <div style="padding: 16px; background: #fafbfc; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; font-size: 13px;">
                <div>
                  <div style="color:#6c727c; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em">SKU</div>
                  <div style="font-weight: 600">{{ row.sku }}</div>
                </div>
                <div>
                  <div style="color:#6c727c; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em">Marque</div>
                  <div>{{ row.brand }}</div>
                </div>
                <div>
                  <div style="color:#6c727c; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em">Magasin</div>
                  <div>{{ row.store }}</div>
                </div>
                <div>
                  <div style="color:#6c727c; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em">Note</div>
                  <div>{{ row.rating }} ★</div>
                </div>
                <div style="grid-column: 1 / -1; padding-top: 8px; border-top: 1px solid #e3e6ea; color: #4a5364;">
                  Mis à jour le {{ row.updatedAt }} · classe énergie {{ row.energyClass }} · {{ row.promo ? 'En promotion 🔥' : 'Pas de promo' }}
                </div>
              </div>
            </template>
          </ad-grid-vue>
        </div>
      </div>
    `,
  }),
}

export const ExpandWithCustomActions: Story = {
  args: { columns: lmColumns, rows: lmProducts },
  parameters: {
    docs: {
      description: {
        story: `
## Detail row with actions

Le slot reçoit la \`row\` complète — vous y posez librement vos CTA (réappro, fiche fournisseur, lien vers édition longue, formulaire async).

### Implémentation

\`\`\`vue
<ad-grid-vue :columns="columns" :rows="rows" expandable>
  <template #expand-row="{ row }">
    <div class="detail-panel">
      <div class="info">
        <strong>{{ row.name }}</strong>
        <span class="muted">{{ row.sku }} · stock {{ row.stock }}</span>
      </div>
      <button @click="reorder(row)">Réapprovisionner</button>
      <button @click="openSupplier(row)">Fiche fournisseur</button>
    </div>
  </template>
</ad-grid-vue>
\`\`\`

### Notes UX

- Évitez de mettre une grosse table secondaire dans le detail panel — la perf vire vite. Pour ça, préférez un router push vers une page dédiée.
- Pour un panel d'édition long, considérez un \`<MDrawer>\` au lieu d'un detail row — plus d'espace + navigation clavier dédiée.
- Le \`<ad-grid-detail-row>\` ne porte aucune ombre/border par défaut — si vous voulez le distinguer, ajoutez votre propre \`background: #fafbfc; border-bottom: ...\` côté slot.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup() {
      function reorder(row: LMProduct) {
        // Storybook actions panel will display this if the consumer wires it.

        window.alert?.(`Réapprovisionnement déclenché pour ${row.sku} (${row.name})`)
      }
      return { lmColumns, lmProducts, reorder }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>Detail row with actions</h2>
        <p>Le slot reçoit la <code>row</code> complète : tu peux y poser des CTA contextuels (réappro, fiche fournisseur, etc.).</p>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560" :columns="lmColumns" :rows="lmProducts" expandable>
            <template #expand-row="{ row }">
              <div style="padding: 14px 16px; display: flex; gap: 12px; align-items: center; background: #f8fafc;">
                <div style="flex: 1">
                  <strong>{{ row.name }}</strong>
                  <div style="color:#6c727c; font-size: 12px">{{ row.sku }} · stock {{ row.stock }} unités · {{ row.store }}</div>
                </div>
                <button
                  type="button"
                  @click="reorder(row)"
                  style="all: unset; cursor: pointer; padding: 6px 14px; border-radius: 6px; background: #188803; color: white; font-size: 12px; font-weight: 600"
                >
                  Réapprovisionner
                </button>
              </div>
            </template>
          </ad-grid-vue>
        </div>
      </div>
    `,
  }),
}
