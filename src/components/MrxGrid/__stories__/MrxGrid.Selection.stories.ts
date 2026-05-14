import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'
import { MrxGrid, MrxGridToolbar } from '@/components/MrxGrid'
import type { SelectionModel } from '@/components/MrxGrid'
import { lmColumns, lmProducts } from './_fixtures'

const meta = {
  title: 'Stories/Selection/Row · Cell · Bulk',
  component: MrxGrid,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
# Selection

Deux modes de sélection mutuellement exclusifs : **rows** (checkboxes) et **cells** (range Excel-style).

| Mode | Activation | Modèle |
|------|------------|--------|
| Rows | \`:selectable\` | \`SelectionModel\` (\`v-model:selection\`) |
| Cells | Toujours actif | \`cellSelection\` (drag, Shift+click, Ctrl+A) |

### \`SelectionModel\` shape

\`\`\`ts
interface SelectionModel {
  allSelected: boolean              // "tous + des exclusions" mode
  selectedIds: Set<string|number>   // when allSelected=false
  deselectedIds: Set<string|number> // when allSelected=true
}
\`\`\`

Cette représentation supporte le pattern Gmail "select all + uncheck a few" sans matérialiser les 100k rows.

### Toolbar selection banner

Pour afficher "X rows selected · Select all N rows · Clear" dans la toolbar :

\`\`\`vue
<MrxGridToolbar
  :selected-count="grid?.selectedCount ?? 0"
  :total-count="grid?.selectionTotalCount ?? 0"
  :all-selected="grid?.selectionModel?.allSelected ?? false"
  @select-all-rows="grid?.selectAll()"
  @clear-selection="grid?.clearSelection()"
/>
\`\`\`

Combinez avec \`<MrxGrid selection-bar-compact>\` pour que la barre flottante n'affiche plus que les boutons d'action (Edit / Copy / Paste / Delete) sans le compteur.

### API impérative

- \`grid.selectAll()\` — entre en mode \`allSelected: true\`
- \`grid.clearSelection()\` — reset à \`none\`
- \`grid.selectedCount\` (ref unwrap) — count courant (incl. exclusions)
- \`grid.selectionTotalCount\` — total dataset (= rows.length ou \`totalCount\` prop)
- \`grid.getSelectedRows()\` — matérialise les rows actuellement sélectionnées
        `,
      },
    },
  },
} satisfies Meta<typeof MrxGrid>

export default meta
type Story = StoryObj<typeof meta>

export const RowSelection: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Row checkbox selection

\`:selectable\` injecte une colonne checkbox sticky-left avant les data columns. Le header expose un master checkbox tri-state (\`none / some / all\`).

### Implémentation

\`\`\`vue
<script setup lang="ts">
import { ref } from 'vue'
import type { SelectionModel } from '@/components/MrxGrid'

const selection = ref<SelectionModel>({
  allSelected: false,
  selectedIds: new Set(),
  deselectedIds: new Set(),
})
</script>

<template>
  <MrxGrid
    :columns="columns"
    :rows="rows"
    selectable
    v-model:selection="selection"
  />
</template>
\`\`\`

### Comportement de la master checkbox

- Cliquer la master quand 0 row sélectionnée → sélectionne **la page courante** (pas le dataset)
- Cliquer encore → unselect tout
- Quand toutes les rows de la page sont cochées, le bandeau "Select all N rows" apparaît dans la toolbar/floating bar
- Cliquer "Select all N" → \`allSelected: true\` (mode dataset entier)

### Pourquoi \`Set<string|number>\` et pas \`row[]\`

Le modèle stocke uniquement les IDs (résolus par \`rowIdResolver\`). Trier / filtrer / lazy-loader ne change pas la sélection — les IDs restent valides à travers toutes les transformations.

### Anti-pattern: row IDs instables

\`\`\`ts
:row-id="(_, i) => String(i)"  // ⚠ index courant — sort déplace les coches !
\`\`\`

Toujours pointer vers une clé domain (\`sku\`, \`uuid\`, \`id\`).
        `,
      },
    },
  },
  render: () => ({
    components: { MrxGrid, MrxGridToolbar },
    setup() {
      const gridRef = ref<InstanceType<typeof MrxGrid> | null>(null)
      const selection = ref<SelectionModel>({
        allSelected: false,
        selectedIds: new Set<string>(),
        deselectedIds: new Set<string>(),
      })
      const selectedCount = computed(() => gridRef.value?.selectedCount ?? 0)
      const totalCount = computed(() => gridRef.value?.selectionTotalCount ?? 0)
      const allSelected = computed(() => gridRef.value?.selectionModel?.allSelected ?? false)
      function onSelectAllRows() {
        gridRef.value?.selectAll()
      }
      function onClearSelection() {
        gridRef.value?.clearSelection()
      }
      return {
        lmColumns,
        lmProducts,
        gridRef,
        selection,
        selectedCount,
        totalCount,
        allSelected,
        onSelectAllRows,
        onClearSelection,
      }
    },
    template: `
      <div class="sb-mrx-shell">
        <h2>Row checkbox selection</h2>
        <p>Active <code>:selectable</code>. La case master du header gère <code>none / some / all</code>. Le banner de sélection est géré dans la toolbar via <code>:selected-count</code> / <code>:total-count</code> / <code>:all-selected</code> + <code>@select-all-rows</code> / <code>@clear-selection</code>.</p>
        <MrxGridToolbar
          show-filters
          show-settings
          show-keyboard
          :selected-count="selectedCount"
          :total-count="totalCount"
          :all-selected="allSelected"
          @select-all-rows="onSelectAllRows"
          @clear-selection="onClearSelection"
        />
        <div class="sb-mrx-frame">
          <MrxGrid
            ref="gridRef"
            :height="560"
            :columns="lmColumns"
            :rows="lmProducts"
            selectable
            selection-bar-compact
            v-model:selection="selection"
          />
        </div>
      </div>
    `,
  }),
}

export const CellRangeSelection: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Cell range selection

Toujours active (pas besoin de prop). Mimic Excel/Google Sheets:

| Geste | Action |
|-------|--------|
| Click | Cellule active |
| Drag | Range rectangulaire |
| Shift+click | Étend depuis l'ancrage |
| Ctrl/Cmd+A | Select all visible |
| Arrow keys | Move active cell |
| Shift+Arrow | Étend la range |
| Ctrl+C / Ctrl+V | Copier / coller |
| Ctrl+X | Couper (marching ants) |
| Delete | Vide les cellules de la range (émet \`bulk-delete\`) |

### API

\`\`\`ts
grid.cellSelection.activeCell  // { row: number, col: string } | null
grid.cellSelection.allRanges   // ReadonlyArray<Range>
\`\`\`

### Désactiver

Pas de prop pour off — si vous ne voulez pas de cell selection, ne fournissez pas de \`@cell-edit\`/\`@fill\` listeners et n'utilisez pas \`<MrxGridSelectionBar>\`. Les ranges restent calculées mais sans effet visible si vous ne stylez rien.
        `,
      },
    },
  },
  render: () => ({
    components: { MrxGrid },
    setup: () => ({ lmColumns, lmProducts }),
    template: `
      <div class="sb-mrx-shell">
        <h2>Cell range selection</h2>
        <p>Comme Excel : click → cellule active, drag → range, <kbd>Shift</kbd>+click → étend, <kbd>Ctrl</kbd>+<kbd>A</kbd> → tout. Le sélecteur range est natif.</p>
        <div class="sb-mrx-frame">
          <MrxGrid :height="560" :columns="lmColumns" :rows="lmProducts" />
        </div>
      </div>
    `,
  }),
}

export const BulkDelete: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Bulk delete via floating action bar

Quand \`selectable\` est activé et qu'il y a une sélection (rows ou cells), une **floating selection bar** apparaît au bas du grid avec Edit / Copy / Paste / Delete. \`Delete\` émet \`@bulk-delete\` avec le payload des cellules à clearer.

### \`@bulk-delete\` payload

\`\`\`ts
{
  selection: SelectionModel
  fills: Array<{ rowIndex: number; field: string; oldValue: unknown }>
}
\`\`\`

\`fills\` est la liste **explicite** des cellules à vider — vous itérez et appliquez côté state. La grille n'écrit jamais directement dans \`rows\`, vous gardez le contrôle de la mutation.

### Implémentation

\`\`\`vue
<script setup lang="ts">
const rows = ref([...products])

function onBulkDelete(payload: {
  selection: SelectionModel
  fills: Array<{ rowIndex: number; field: string; oldValue: unknown }>
}) {
  for (const f of payload.fills) {
    const r = rows.value[f.rowIndex] as Record<string, unknown>
    if (r) r[f.field] = ''
  }
  // Push to your undo stack here if needed.
}
</script>

<template>
  <MrxGrid
    :columns="columns"
    :rows="rows"
    selectable
    @bulk-delete="onBulkDelete"
  />
</template>
\`\`\`

### Toolbar-managed mode

Quand vous voulez que le compteur + Select all + Clear vivent dans la toolbar (pas dans la barre flottante), ajoutez \`selection-bar-compact\` :

\`\`\`vue
<MrxGrid selectable selection-bar-compact ... />
\`\`\`

La barre flottante ne montre alors plus que les boutons d'action.

### Custom actions (#actions slot)

\`\`\`vue
<MrxGrid selectable>
  <template #selection-actions="{ selectedCount, mode, clearSelection, close }">
    <button @click="archive(); clearSelection(); close()">Archive {{ selectedCount }}</button>
  </template>
</MrxGrid>
\`\`\`
        `,
      },
    },
  },
  render: () => ({
    components: { MrxGrid, MrxGridToolbar },
    setup() {
      const gridRef = ref<InstanceType<typeof MrxGrid> | null>(null)
      const rows = ref([...lmProducts])
      const lastBulk = ref<string>('—')
      function onBulkDelete(payload: { fills: Array<{ rowIndex: number; field: string; oldValue: unknown }> }) {
        for (const f of payload.fills) {
          const r = rows.value[f.rowIndex] as Record<string, unknown> | undefined
          if (r) r[f.field] = ''
        }
        lastBulk.value = `${payload.fills.length} cellule(s) effacée(s)`
      }
      // Toolbar-managed selection: read state from the grid ref so the
      // banner ("X rows selected · Select all N rows · Clear") renders
      // inline in the toolbar instead of the floating selection bar.
      const selectedCount = computed(() => gridRef.value?.selectedCount ?? 0)
      const totalCount = computed(() => gridRef.value?.selectionTotalCount ?? 0)
      const allSelected = computed(() => gridRef.value?.selectionModel?.allSelected ?? false)
      function onSelectAllRows() {
        gridRef.value?.selectAll()
      }
      function onClearSelection() {
        gridRef.value?.clearSelection()
      }
      return {
        lmColumns,
        gridRef,
        rows,
        onBulkDelete,
        lastBulk,
        selectedCount,
        totalCount,
        allSelected,
        onSelectAllRows,
        onClearSelection,
      }
    },
    template: `
      <div class="sb-mrx-shell">
        <h2>Bulk delete via action bar</h2>
        <p>Sélectionne plusieurs cellules ou lignes puis <kbd>Delete</kbd>. L'évent <code>bulkDelete</code> remonte le payload pour appliquer le clear côté state.</p>
        <div class="sb-mrx-toolbar">Dernière action : <code>{{ lastBulk }}</code></div>
        <MrxGridToolbar
          show-fullscreen
          show-export
          show-filters
          show-settings
          show-keyboard
          :selected-count="selectedCount"
          :total-count="totalCount"
          :all-selected="allSelected"
          @select-all-rows="onSelectAllRows"
          @clear-selection="onClearSelection"
        />
        <div class="sb-mrx-frame">
          <MrxGrid
            ref="gridRef"
            :height="560"
            :columns="lmColumns"
            :rows="rows"
            selectable
            selection-bar-compact
            @bulk-delete="onBulkDelete"
          />
        </div>
      </div>
    `,
  }),
}
