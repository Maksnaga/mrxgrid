import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { AdeoGrid } from '@/components/AdeoGrid'
import { lmColumns, lmProducts } from './_fixtures'

const meta = {
  title: 'Stories/Basics/Density · Fullscreen · Row identity',
  component: AdeoGrid,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Basics

Trois props transversales que toute intégration touche tôt ou tard : la densité d'affichage, le mode plein écran, et la stratégie d'identité de ligne (\`rowId\`).

| Prop | Rôle |
|------|------|
| \`density\` | \`'compact' | 'default' | 'comfortable'\` — change la hauteur de ligne. Pilote aussi les paddings via SCSS. |
| \`fullscreen\` | Quand \`true\`, la grille passe en \`position: fixed; inset: 0\` et couvre tout le viewport. |
| \`rowId\` | Fonction \`(row, index) => string\` qui résout l'identité stable d'une ligne — load-bearing pour selection / expansion / formula / undo-redo. |
        `,
      },
    },
  },
} satisfies Meta<typeof AdeoGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Density: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Density

Trois variantes au choix via \`:density\`. Les hauteurs de ligne sont définies dans \`AdeoGrid.vue\` (\`DENSITY_ROW_HEIGHT\` constant) :

| Variant | Row height |
|---------|-----------|
| \`compact\` | 32px |
| \`default\` | 48px |
| \`comfortable\` | 64px |

Les paddings des cellules suivent en SCSS (\`.mrx-grid-wrapper--compact\`, \`.mrx-grid-wrapper--comfortable\` modifiers).

### Implémentation

\`\`\`vue
<script setup>
import type { DataDensity } from '@/components/AdeoGrid'
const density = ref<DataDensity>('default')
</script>

<template>
  <AdeoGrid :columns="columns" :rows="rows" :density="density" />
</template>
\`\`\`

### Tip

Le \`<AdeoTableMenuDrawer>\` expose un toggle de density natif — branchez son \`@apply\` pour piloter cette prop sans roll-your-own.
        `,
      },
    },
  },
  argTypes: {
    density: {
      control: { type: 'inline-radio' },
      options: ['compact', 'default', 'comfortable'],
    },
  },
  args: { density: 'default' },
  render: (args) => ({
    components: { AdeoGrid },
    setup: () => ({ lmColumns, lmProducts, args }),
    template: `
      <div class="sb-mrx-shell">
        <h2>Density</h2>
        <p>Switch via prop <code>:density</code>. Hauteurs ligne : compact <code>25px</code>, default <code>37px</code>, comfortable <code>45px</code>.</p>
        <div class="sb-mrx-toolbar">Density actuelle : <code>{{ args.density }}</code></div>
        <div class="sb-mrx-frame">
          <AdeoGrid :height="560" :columns="lmColumns" :rows="lmProducts" :density="args.density" />
        </div>
      </div>
    `,
  }),
}

export const Fullscreen: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Fullscreen

\`\`:fullscreen="true"\`\` ⇒ la racine de la grille passe en \`position: fixed; inset: 0; z-index: ...\` et recouvre la fenêtre.

### Gotcha #1 — la toolbar disparaît

Si vous rendez votre toolbar en *sibling* de \`<AdeoGrid>\`, le mode fullscreen va la cacher derrière le grid. **Mettez-la dans le slot \`#toolbar\`** :

\`\`\`vue
<AdeoGrid :fullscreen="isFullscreen" :columns="cols" :rows="rows">
  <template #toolbar>
    <AdeoGridToolbar
      show-fullscreen
      :fullscreen="isFullscreen"
      @toggle-fullscreen="isFullscreen = !isFullscreen"
    />
  </template>
</AdeoGrid>
\`\`\`

### Gotcha #2 — la prop est unidirectionnelle

\`fullscreen\` est une *prop* lue par la grille — pas un v-model. Le toolbar émet \`@toggle-fullscreen\`, à vous de flip la \`ref\`. Si vous voulez l'auto-câbler, utilisez \`<AdeoGridSmartToolbar v-model:fullscreen="isFullscreen">\`.

### Tip

Combinez avec un \`<Teleport>\` parent si votre layout principal a un \`overflow: hidden\` qui couperait le grid en mode fullscreen.
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup() {
      const fs = ref(false)
      return { lmColumns, lmProducts, fs }
    },
    template: `
      <div class="sb-mrx-shell">
        <h2>Fullscreen</h2>
        <p>Quand <code>:fullscreen</code> est <code>true</code> le grid couvre tout le viewport. Place tes contrôles (et la toolbar) dans le slot <code>#toolbar</code> pour qu'ils restent visibles.</p>
        <div class="sb-mrx-frame">
          <AdeoGrid :height="560" :columns="lmColumns" :rows="lmProducts" :fullscreen="fs">
            <template #toolbar>
              <div class="sb-mrx-toolbar" style="border-radius: 0; border-left: 0; border-right: 0; border-top: 0">
                <button type="button" @click="fs = !fs">
                  {{ fs ? '↩ Quitter plein écran' : '⛶ Passer en plein écran' }}
                </button>
              </div>
            </template>
          </AdeoGrid>
        </div>
      </div>
    `,
  }),
}

export const RowIdentity: Story = {
  name: 'Row Identity (rowId)',
  parameters: {
    docs: {
      description: {
        story: `
## Row identity (\`:row-id\`)

Le \`rowId\` est la **clé stable** d'une ligne à travers ses transformations (sort, filter, lazy reload, page change). C'est ce qui permet à la sélection, l'expansion, les formules et l'undo/redo de survivre quand l'index d'array change.

### Forme

\`\`\`ts
type RowIdResolver = (row: Record<string, unknown>, index: number) => string | number
\`\`\`

### Implémentation

\`\`\`vue
<AdeoGrid
  :columns="columns"
  :rows="rows"
  :row-id="(row) => String(row.sku)"
/>
\`\`\`

### Comportement par défaut

Si \`rowId\` n'est pas passé, la grille utilise :
1. \`row[rowIdField]\` (\`rowIdField\` vaut \`'id'\` par défaut)
2. Sinon, l'index dans le \`sourceData\` array — **non-stable** dès qu'on trie / lazy load.

### Quand c'est obligatoire

- **Selection** — sans \`rowId\`, cocher une ligne puis trier déplace la coche
- **Expansion** — idem, le détail s'ouvre sur la mauvaise ligne
- **Formula engine** — il indexe les cellules par row id ; sans, les formules \`=A1+B1\` se cassent au sort
- **Lazy loading** — quand de nouvelles pages arrivent, l'engine doit reconnaître les rows déjà présentes
- **Undo / redo** — chaque édit cellulaire est tracé par \`(rowId, field)\`

### Anti-pattern

\`\`\`ts
:row-id="(_, i) => String(i)"  // ⚠ index renvoie l'index courant — pas stable
\`\`\`
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup: () => ({
      lmColumns,
      lmProducts,
      // SKU is more stable than the array index across re-orders / lazy loads.
      rowId: (row: Record<string, unknown>) => String(row.sku),
    }),
    template: `
      <div class="sb-mrx-shell">
        <h2>Row identity via <code>:rowId</code></h2>
        <p>Indispensable pour persister la sélection / les formules / l'expansion à travers un re-tri ou un lazy-load. Ici, on utilise la <code>sku</code> du produit.</p>
        <div class="sb-mrx-frame">
          <AdeoGrid :height="560" :columns="lmColumns" :rows="lmProducts" :row-id="rowId" />
        </div>
      </div>
    `,
  }),
}
