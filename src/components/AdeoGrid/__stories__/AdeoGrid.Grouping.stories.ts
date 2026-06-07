import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'
import { AdeoGrid, AdeoGroupingDrawer, AdeoGridToolbar } from '@/components/AdeoGrid'
import type { GroupingItem, ServerGroupingOptions, RowData } from '@/components/AdeoGrid'
import { lmColumns, lmProducts, generateLMProducts, type LMProduct } from './_fixtures'

const meta = {
  title: 'Stories/Grouping/Single · Nested · Drawer · Server-side',
  component: AdeoGrid,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Grouping

Regroupe les rows par valeur d'un (ou plusieurs) champ(s). Une "group row" s'insère avant chaque cluster avec un compteur \`__adgCount\`.

### Activation

\`\`\`vue
<AdeoGrid :group-fields="['category', 'brand']" :columns="cols" :rows="rows" />
\`\`\`

### Group row metadata

Les rows insérées par le pipeline portent des champs préfixés \`__adg\` pour ne pas collisionner avec les données :

\`\`\`ts
{
  __adgType: 'group',
  __adgKey: 'category=Outillage|brand=Bosch',
  __adgDepth: 1,            // 0 = top-level
  __adgCount: 24,
  __adgField: 'brand',
  __adgValue: 'Bosch',
}
\`\`\`

Utilisez \`isGroupRow(row)\` (depuis \`types.ts\`) pour filtrer si nécessaire.

### Modes

| Mode | Quand | Comment |
|------|-------|---------|
| Client-side | Datasets < 100k rows | \`group-fields\` seul |
| Server-side | Datasets énormes / lazy | \`server-grouping={ fetchGroups, fetchGroupRows, pageSize }\` |
        `,
      },
    },
  },
} satisfies Meta<typeof AdeoGrid>

export default meta
type Story = StoryObj<typeof meta>

export const SingleField: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Single-field grouping

\`\`\`vue
<AdeoGrid :group-fields="['category']" :columns="columns" :rows="rows" />
\`\`\`

Le pipeline insère une "group header row" par valeur distincte de \`category\`. Click sur la row → toggle expand/collapse.

### Comportement

- L'ordre des groupes suit le sort actif (si \`category\` est triée, les groupes sont triés)
- Le compteur affiché à droite (\`__adgCount\`) est sticky-right pour rester visible pendant le scroll horizontal
- Les groupes sont collapsibles indépendamment ; l'état d'expand vit dans \`gridState.expandedGroups\` (\`Set<string>\`)
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup: () => ({ lmColumns, lmProducts, groupFields: ['category'] }),
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Single-field grouping (par Rayon)</h2>
        <p>Pass <code>:group-fields="['category']"</code>. Une row "header de groupe" s'insère par valeur, click pour expand/collapse.</p>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560" :columns="lmColumns" :rows="lmProducts" :group-fields="groupFields" />
        </div>
      </div>
    `,
  }),
}

export const NestedFields: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Nested grouping

Plusieurs champs dans \`group-fields\` donnent un arbre N-aire :

\`\`\`vue
<AdeoGrid :group-fields="['category', 'brand']" ... />
\`\`\`

Affiche : Rayon 1 → Marques de Rayon 1 → produits ; Rayon 2 → … L'ordre des champs pilote l'imbrication (premier = level 0).

### \`__adgDepth\`

Chaque group row porte sa profondeur 0-indexed. Le padding-left du label est calculé en \`depth × 24px\` pour matérialiser l'arbre.

### Notes

- La perf reste OK jusqu'à ~10k rows × 4 niveaux. Au-delà, passez en server-side.
- Les filtres + sort s'appliquent **avant** le grouping (pipeline order).
- Re-évaluation : changer un \`group-fields\` recalcule l'arbre complet (computed). \`gridState.expandedGroups\` peut perdre des entrées si vous changez l'ordre.
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup: () => ({
      lmColumns,
      rows: generateLMProducts(60),
      groupFields: ['category', 'brand'],
    }),
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Nested grouping (Rayon → Marque)</h2>
        <p>Plusieurs niveaux dans <code>:group-fields</code> donnent un arbre. La méta des rows groupes (<code>__adgDepth</code>, <code>__adgCount</code>) est posée par le pipeline.</p>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560" :columns="lmColumns" :rows="rows" :group-fields="groupFields" />
        </div>
      </div>
    `,
  }),
}

export const InteractiveDrawer: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Grouping drawer

\`AdeoGroupingDrawer\` permet à l'utilisateur de drag-n-drop l'ordre des champs et toggle chacun. Idéal pour des dashboards où la dimension d'analyse change.

### Implémentation

\`\`\`vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { AdeoGroupingDrawer, AdeoGridToolbar } from '@/components/AdeoGrid'
import type { GroupingItem } from '@/components/AdeoGrid'

const drawerOpen   = ref(false)
const activeGroups = ref<GroupingItem[]>([])
const groupFields  = computed(() => activeGroups.value.map((g) => g.field))
</script>

<template>
  <AdeoGrid :columns="columns" :rows="rows" :group-fields="groupFields">
    <template #toolbar>
      <AdeoGridToolbar show-group @group="drawerOpen = !drawerOpen" />
    </template>
  </AdeoGrid>

  <AdeoGroupingDrawer
    :open="drawerOpen"
    :columns="columns"
    :active-groups="activeGroups"
    @update:open="drawerOpen = $event"
    @apply="activeGroups = $event"
    @reset="activeGroups = []"
  />
</template>
\`\`\`

### \`GroupingItem\` shape

\`\`\`ts
interface GroupingItem {
  field: string
  // (extensible — direction, aggregator, etc. en V2)
}
\`\`\`

### Smart toolbar

Pour éviter le wiring manuel, \`<AdeoGridSmartToolbar v-model:active-groups="activeGroups">\` bundle le drawer + le wiring.
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid, AdeoGroupingDrawer, AdeoGridToolbar },
    setup() {
      const drawerOpen = ref(false)
      const activeGroups = ref<GroupingItem[]>([])
      const groupFields = computed(() => activeGroups.value.map((g) => g.field))
      function onApply(items: GroupingItem[]) {
        activeGroups.value = items
      }
      function onReset() {
        activeGroups.value = []
      }
      return { lmColumns, lmProducts, drawerOpen, groupFields, activeGroups, onApply, onReset }
    },
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Grouping drawer</h2>
        <p>Le drawer permet de drag-n-drop l'ordre des champs de groupage et de toggler chacun. Idéal pour des dashboards où l'utilisateur change la dimension d'analyse.</p>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560" :columns="lmColumns" :rows="lmProducts" :group-fields="groupFields">
            <template #toolbar>
              <AdeoGridToolbar show-group @group="drawerOpen = !drawerOpen" />
            </template>
          </AdeoGrid>
        </div>
        <AdeoGroupingDrawer
          :open="drawerOpen"
          :columns="lmColumns"
          :active-groups="activeGroups"
          @update:open="drawerOpen = $event"
          @apply="onApply"
          @reset="onReset"
        />
      </div>
    `,
  }),
}

export const ServerSide: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Server-side grouping

Pour des datasets >100k rows, ne chargez ni les rows ni les agrégats — déléguez tout au serveur :

\`\`\`ts
interface ServerGroupingOptions {
  fetchGroups: (groupFields: string[]) => Promise<{ value: unknown; count: number }[]>
  fetchGroupRows: (field: string, value: unknown, start: number, end: number) => Promise<RowData[]>
  pageSize?: number  // defaults 100
}
\`\`\`

### Implémentation

\`\`\`ts
const serverGrouping: ServerGroupingOptions = {
  async fetchGroups(groupFields) {
    const res = await fetch(\`/api/groups?fields=\${groupFields.join(',')}\`)
    return res.json()
  },
  async fetchGroupRows(field, value, start, end) {
    const res = await fetch(\`/api/rows?\${field}=\${value}&start=\${start}&end=\${end}\`)
    return res.json()
  },
  pageSize: 100,
}
\`\`\`

\`\`\`vue
<AdeoGrid
  :columns="columns"
  :rows="[]"
  :group-fields="['category']"
  :server-grouping="serverGrouping"
/>
\`\`\`

### Cycle réseau

1. Activation du grouping → \`fetchGroups(['category'])\` → liste des group headers (\`{ value, count }\`)
2. User expand un groupe → \`fetchGroupRows('category', 'Outillage', 0, 100)\` (1ère page)
3. User scrolle dans le groupe → \`fetchGroupRows('category', 'Outillage', 100, 200)\`
4. User collapse un groupe → la page est libérée (LRU cache interne)

### Notes

- \`:rows="[]"\` est correct — la grille n'utilise pas \`rows\` quand \`server-grouping\` est actif
- Skeleton rows s'affichent pendant le fetch
- \`:total-count\` n'est PAS requis (la pagination du body suit \`pageSize\` du serverGrouping)
- Le multi-niveau (nested) requiert que \`fetchGroups\` accepte un \`groupFields\` à plusieurs entrées et retourne l'arbre — non documenté ici, voir la signature dans \`models/grid-options.model.ts\`
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup() {
      // Simulate server: 10k LM products, group summaries fetched async, and pages of rows
      // come back per group when expanded. The grid never sees the full dataset.
      const allRows: LMProduct[] = generateLMProducts(10_000)

      const serverGrouping: ServerGroupingOptions = {
        fetchGroups: async (groupFields) => {
          await new Promise((r) => setTimeout(r, 200))
          const field = groupFields[0]!
          const counts = new Map<unknown, number>()
          for (const r of allRows) counts.set((r as Record<string, unknown>)[field], (counts.get((r as Record<string, unknown>)[field]) ?? 0) + 1)
          return [...counts.entries()].map(([value, count]) => ({ value, count }))
        },
        fetchGroupRows: async (field, value, start, end) => {
          await new Promise((r) => setTimeout(r, 150))
          return allRows
            .filter((r) => (r as Record<string, unknown>)[field] === value)
            .slice(start, end) as RowData[]
        },
        pageSize: 100,
      }

      return { lmColumns, serverGrouping }
    },
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Server-side grouping</h2>
        <p>Le grid demande <code>fetchGroups</code> à l'activation puis <code>fetchGroupRows</code> par page quand un groupe est expandé. 10 000 produits LM côté "serveur", aucun ne traverse le réseau tant que rien n'est ouvert.</p>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560"
            :columns="lmColumns"
            :rows="[]"
            :group-fields="['category']"
            :server-grouping="serverGrouping"
          />
        </div>
      </div>
    `,
  }),
}
