import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { AdGridVue, useUndoRedoPlugin } from '@/components/Grid'
import type { CellEditEvent, ColumnDef, FillEvent } from '@/components/Grid'
import { lmColumns, lmProducts, type LMProduct } from './_fixtures'

const meta = {
  title: 'Stories/Editing/Inline · Editors · Validation · Fill',
  component: AdGridVue,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Editing

Édition cellulaire inline avec validation, undo/redo et fill-handle Excel-style.

### Activation

Une cellule est éditable quand sa colonne déclare \`editable: true\`. Le \`cellEditor\` choisit le type d'input :

| \`cellEditor\` | Input rendu |
|---------------|-------------|
| omis ou \`'text'\` | \`<MTextInput type="text">\` |
| \`'number'\` | \`<MTextInput type="number">\` |
| \`'select'\` | \`<MSelect>\` peuplé depuis \`cellEditorOptions\` |
| \`'date'\` | \`<MDatePicker>\` |
| Slot \`#edit-{field}\` | Custom |

### Keyboard

| Touche | Action |
|--------|--------|
| \`F2\` ou typing | Entre en édition |
| \`Enter\` | Commit + descend d'une ligne |
| \`Tab\` | Commit + cellule suivante |
| \`Shift+Tab\` | Commit + cellule précédente |
| \`Esc\` | Annule |
| \`⌘Z\` / \`Ctrl+Z\` | Undo (avec \`useUndoRedoPlugin\` ou \`history-id\`) |
| \`⌘⇧Z\` / \`Ctrl+Y\` | Redo |

### Évent \`cell-edit\`

\`\`\`ts
interface CellEditEvent {
  rowIndex: number
  field: string
  oldValue: unknown
  newValue: unknown
}
\`\`\`

**La grille n'écrit jamais dans \`rows\` directement** — vous appliquez la mutation côté state (compatible Pinia / Vuex / refs). Si vous oubliez de mutate, la cellule reverte au render suivant.

### Undo / Redo

Deux options :

1. \`history-id="my-grid"\` (prop) — auto-attache un history persistant en \`localStorage\`
2. \`:plugins="[useUndoRedoPlugin({ storageKey })]"\` — usage avancé (custom storage backend, cleanup hook)
        `,
      },
    },
  },
} satisfies Meta<typeof AdGridVue>

export default meta
type Story = StoryObj<typeof meta>

export const InlineText: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Inline text + number edit

Le pattern le plus courant : marquez \`editable: true\` sur la \`ColumnDef\`, écoutez \`@cell-edit\`, mutez votre store.

### Implémentation

\`\`\`vue
<script setup lang="ts">
import { ref } from 'vue'
import type { CellEditEvent } from '@/components/Grid'

const rows = ref<Product[]>(initialRows)

function onCellEdit(e: CellEditEvent) {
  const row = rows.value[e.rowIndex] as Record<string, unknown>
  if (row) row[e.field] = e.newValue
}
</script>

<template>
  <ad-grid-vue
    :columns="columns"
    :rows="rows"
    history-id="my-grid"
    @cell-edit="onCellEdit"
  />
</template>
\`\`\`

### Pourquoi muter manuellement ?

Le grid reste agnostique : Pinia, Vuex, \`ref\`, immer, RxJS — il vous donne l'évent et c'est à vous d'appliquer. Vous gardez le contrôle total sur votre side-effects (autosave, validation async, optimistic updates).

### Number editor

\`\`\`ts
{ field: 'price', editable: true, cellEditor: 'number' }
\`\`\`

L'input force \`type="number"\`, parse en \`Number()\` au commit, rejette les non-numériques.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup() {
      const rows = ref<LMProduct[]>(JSON.parse(JSON.stringify(lmProducts)))
      const lastEdit = ref('—')
      function onCellEdit(e: CellEditEvent) {
        const row = rows.value[e.rowIndex] as Record<string, unknown> | undefined
        if (row) row[e.field] = e.newValue
        lastEdit.value = `[row ${e.rowIndex}] ${e.field}: ${String(e.oldValue)} → ${String(e.newValue)}`
      }
      const plugins = [useUndoRedoPlugin({ storageKey: 'lm-editing-inline-text' })]
      return { lmColumns, rows, onCellEdit, lastEdit, plugins }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>Inline edit (text + number editors)</h2>
        <p><kbd>F2</kbd> ou tape directement pour éditer. <kbd>Enter</kbd> commit, <kbd>Esc</kbd> annule, <kbd>Tab</kbd> commit + cellule suivante. <kbd>⌘Z</kbd> / <kbd>⌘⇧Z</kbd> undo / redo (plugin <code>useUndoRedoPlugin</code>, persisté en <code>localStorage</code>).</p>
        <div class="sb-grid-toolbar">Dernier edit : <code>{{ lastEdit }}</code></div>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560" :columns="lmColumns" :rows="rows" :plugins="plugins" history-id="lm-editing-inline-text" @cell-edit="onCellEdit" />
        </div>
      </div>
    `,
  }),
}

export const SelectEditor: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Select editor

Pour les colonnes à valeurs discrètes (statut, catégorie, état), passez \`cellEditor: 'select'\` + \`cellEditorOptions\`.

### Implémentation

\`\`\`ts
const columns: ColumnDef[] = [
  {
    field: 'status',
    headerName: 'État',
    editable: true,
    cellEditor: 'select',
    cellEditorOptions: [
      { value: 'in-stock', label: 'En stock' },
      { value: 'low',      label: 'Stock faible' },
      { value: 'out',      label: 'Rupture' },
      { value: 'preorder', label: 'Précommande' },
    ],
  },
]
\`\`\`

### Notes

- \`cellEditorOptions\` peut être un tableau \`string[]\` (label = value) ou \`{ value, label }[]\` (recommandé pour les enums).
- L'input est un \`<MSelect>\` Mozaic — ouvert au F2 ou au double-click.
- Au commit, la \`value\` (pas le label) est passée dans \`@cell-edit.newValue\`.

### Couplage avec un renderer

Le select edit-mode différe du display-mode. Combinez avec \`renderer: 'tag'\` pour rendre la valeur en \`<MTag>\` colorée en lecture, et un \`<MSelect>\` en édition :

\`\`\`ts
{
  field: 'status',
  editable: true,
  cellEditor: 'select',
  cellEditorOptions: [...],
  renderer: 'tag',
  rendererProps: {
    labelMap: {
      'in-stock': { label: 'En stock', appearance: 'success' },
      'out': { label: 'Rupture', appearance: 'danger' },
    },
  },
}
\`\`\`
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup() {
      const cols: ColumnDef[] = [
        { field: 'sku', headerName: 'Réf', width: '120px', pinned: 'start' },
        { field: 'name', headerName: 'Produit', width: '260px', editable: true },
        {
          field: 'category',
          headerName: 'Rayon',
          width: '160px',
          editable: true,
          cellEditor: 'select',
          cellEditorOptions: [
            'Plomberie',
            'Électricité',
            'Outillage',
            'Peinture',
            'Jardin',
            'Salle de bain',
            'Cuisine',
            'Quincaillerie',
            'Sols',
            'Chauffage',
          ].map((v) => ({ value: v, label: v })),
        },
        {
          field: 'status',
          headerName: 'État',
          width: '140px',
          editable: true,
          cellEditor: 'select',
          cellEditorOptions: [
            { value: 'in-stock', label: 'En stock' },
            { value: 'low', label: 'Stock faible' },
            { value: 'out', label: 'Rupture' },
            { value: 'preorder', label: 'Précommande' },
          ],
        },
      ]
      const rows = ref<LMProduct[]>(JSON.parse(JSON.stringify(lmProducts.slice(0, 12))))
      function onCellEdit(e: CellEditEvent) {
        const row = rows.value[e.rowIndex] as Record<string, unknown> | undefined
        if (row) row[e.field] = e.newValue
      }
      const plugins = [useUndoRedoPlugin({ storageKey: 'lm-editing' })]
      return { cols, rows, onCellEdit, plugins }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>Select / dropdown editor</h2>
        <p>Configure <code>cellEditor: 'select'</code> + <code>cellEditorOptions</code>. Le menu est rendu via Mozaic MSelect.</p>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560" :columns="cols" :rows="rows" :plugins="plugins" history-id="lm-editing" @cell-edit="onCellEdit" />
        </div>
      </div>
    `,
  }),
}

export const ValidationOnEdit: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Validation on edit

\`cellValidator(value, row) => true | string\` valide la valeur AVANT commit. Si retourne une string (= message d'erreur), la cellule passe en état \`invalid\` (rouge avec tooltip).

### Implémentation

\`\`\`ts
const columns: ColumnDef[] = [
  {
    field: 'stock',
    editable: true,
    cellEditor: 'number',
    cellValidator: (v) =>
      typeof v === 'number' && v >= 0 ? true : 'Stock négatif interdit',
  },
  {
    field: 'price',
    editable: true,
    cellEditor: 'number',
    cellValidator: (v, row) =>
      v < (row.cost ?? 0) ? \`Prix < coût (\${row.cost} €)\` : true,
  },
]
\`\`\`

### Comportement

- Au commit (Enter / Tab / blur), si \`cellValidator\` retourne string → la cellule est marquée \`invalid\`, le \`cell-edit\` event N'EST PAS émis, la valeur reste à l'écran (mais pas dans votre store).
- Le tooltip d'erreur apparaît au hover/focus de la cellule.
- L'utilisateur peut continuer à éditer ou Esc pour annuler.

### API impérative

\`\`\`ts
grid.validateAll()       // re-run all validators on the visible rows
grid.getCellError(rowIndex, field)  // returns the error message or null
grid.hasCellError(rowIndex, field)  // boolean
\`\`\`

### Validation async ?

Pas supporté nativement — \`cellValidator\` doit être synchrone. Pour de l'async (check unicité serveur), validez après commit dans \`@cell-edit\` et appliquez/revertez selon la réponse.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup() {
      const cols: ColumnDef[] = [
        { field: 'sku', headerName: 'Réf', width: '120px', pinned: 'start' },
        {
          field: 'name',
          headerName: 'Produit',
          width: '260px',
          editable: true,
          cellValidator: (v) =>
            typeof v === 'string' && v.trim().length >= 3 ? null : { message: 'Au moins 3 caractères' },
        },
        {
          field: 'price',
          headerName: 'Prix',
          width: '110px',
          editable: true,
          cellEditor: 'number',
          cellValidator: (v) => {
            const n = Number(v)
            return Number.isFinite(n) && n > 0 ? null : { message: 'Prix > 0 requis' }
          },
        },
        {
          field: 'stock',
          headerName: 'Stock',
          width: '100px',
          editable: true,
          cellEditor: 'number',
          cellValidator: (v) => (Number(v) >= 0 ? null : { message: 'Stock négatif interdit' }),
        },
      ]
      const rows = ref<LMProduct[]>(
        JSON.parse(JSON.stringify(lmProducts.slice(0, 8))).map((r: LMProduct, i: number) => ({
          ...r,
          // Inject 2 invalid rows so the red border shows from boot.
          name: i === 1 ? 'AB' : r.name,
          price: i === 3 ? -10 : r.price,
        })),
      )
      function onCellEdit(e: CellEditEvent) {
        const row = rows.value[e.rowIndex] as Record<string, unknown> | undefined
        if (row) row[e.field] = e.newValue
      }
      const plugins = [useUndoRedoPlugin({ storageKey: 'lm-editing' })]
      return { cols, rows, onCellEdit, plugins }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>Cell validators (display + edit)</h2>
        <p>Les cellules invalides apparaissent en rouge ; le message s'affiche au hover. Validators identiques au commit.</p>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560" :columns="cols" :rows="rows" :plugins="plugins" history-id="lm-editing" @cell-edit="onCellEdit" />
        </div>
      </div>
    `,
  }),
}

export const FillHandle: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Fill handle (Excel-style drag fill)

Quand une cellule est active dans une colonne \`editable\`, un petit carré bleu apparaît dans son coin bas-droit. Drag-le pour propager la valeur sur la colonne ou la ligne.

### Comportement

- Drag vertical → propage sur les lignes traversées (même colonne)
- Drag horizontal → propage sur les colonnes traversées (même ligne, si elles sont \`editable\`)
- Lâcher → émet \`@fill\` avec la liste exhaustive des cellules à mutate

### \`@fill\` payload

\`\`\`ts
interface FillEvent {
  source: { rowIndex: number; field: string }
  fills: Array<{
    rowIndex: number
    field: string
    value: unknown
    oldValue: unknown
  }>
}
\`\`\`

### Implémentation

\`\`\`vue
<script setup lang="ts">
function onFill(e: FillEvent) {
  for (const f of e.fills) {
    const row = rows.value[f.rowIndex] as Record<string, unknown>
    if (row) row[f.field] = f.value
  }
}
</script>

<template>
  <ad-grid-vue :columns="columns" :rows="rows" history-id="my-grid" @fill="onFill" />
</template>
\`\`\`

### Validation pendant le fill

Si une cellule cible a un \`cellValidator\` qui rejette la valeur source, elle apparaît en *fill-target-invalid* (rouge dashé). À vous de filtrer côté \`onFill\` (\`f.value\` rejeté → ne pas appliquer) si vous voulez stopper.

### Désactiver

Pas de \`fillable\` flag — le handle apparaît dès qu'une cellule est éditable et active. Pour l'enlever, retirez \`editable: true\`.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup() {
      const rows = ref<LMProduct[]>(JSON.parse(JSON.stringify(lmProducts)))
      const lastFill = ref('—')
      function onCellEdit(e: { rowIndex: number; field: string; newValue: unknown }) {
        const row = rows.value[e.rowIndex] as Record<string, unknown> | undefined
        if (row) row[e.field] = e.newValue
      }
      function onFill(e: FillEvent) {
        for (const f of e.fills) {
          const row = rows.value[f.rowIndex] as Record<string, unknown> | undefined
          if (row) row[f.field] = f.value
        }
        lastFill.value = `Direction ${e.direction} · ${e.fills.length} cellule(s) écrite(s)`
      }
      const plugins = [useUndoRedoPlugin({ storageKey: 'lm-editing-fill' })]
      return { lmColumns, rows, onCellEdit, onFill, lastFill, plugins }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>Excel-style fill handle</h2>
        <p>Sélectionne une cellule (ou un range) puis tire le carré bleu en bas-droite pour répliquer la valeur. L'évent <code>fill</code> remonte les écritures à appliquer. Le double-click sur une cellule l'édite et émet <code>cell-edit</code>.</p>
        <div class="sb-grid-toolbar">Dernier fill : <code>{{ lastFill }}</code></div>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560" :columns="lmColumns" :rows="rows" :plugins="plugins" history-id="lm-editing-fill" @cell-edit="onCellEdit" @fill="onFill" />
        </div>
      </div>
    `,
  }),
}

export const CustomCellSlot: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Custom \`#edit-{field}\` slot

Quand les editors built-in (\`text\` / \`number\` / \`select\` / \`date\`) ne couvrent pas votre cas, redéfinissez l'edit-mode via \`<template #edit-{field}>\`.

### Slot props

\`\`\`ts
{
  row: RowData
  rowIndex: number
  column: ColumnDef
  value: unknown          // current draft value
  setValue: (v: unknown) => void  // updates the draft (no commit)
  commit: () => void              // commits + closes editor
  cancel: () => void              // discards + closes editor
}
\`\`\`

### Implémentation

\`\`\`vue
<ad-grid-vue :columns="columns" :rows="rows" @cell-edit="onCellEdit">
  <template #edit-color="{ value, setValue, commit, cancel }">
    <div style="display:flex; gap:6px; align-items:center; padding:0 8px">
      <input
        type="color"
        :value="value || '#000000'"
        @input="setValue($event.target.value)"
      />
      <button @click="commit">✓</button>
      <button @click="cancel">✕</button>
    </div>
  </template>
</ad-grid-vue>
\`\`\`

### Différence avec \`#cell-{field}\`

| Slot | Quand | Rôle |
|------|-------|------|
| \`#cell-{field}\` | Display mode (toujours) | Custom rendu en lecture |
| \`#edit-{field}\` | Edit mode (cellule active + en édition) | Custom rendu en édition |

Vous pouvez avoir l'un, l'autre ou les deux. Sans \`#edit-*\`, c'est l'editor déclaré dans \`cellEditor\` qui s'affiche.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup() {
      const cols: ColumnDef[] = [
        { field: 'sku', headerName: 'Réf', width: '120px', pinned: 'start' },
        { field: 'name', headerName: 'Produit', width: '260px', editable: true },
        {
          field: 'rating',
          headerName: 'Note',
          width: '180px',
          editable: true,
          cellEditor: 'number',
        },
      ]
      const rows = ref<LMProduct[]>(JSON.parse(JSON.stringify(lmProducts.slice(0, 10))))
      function onCellEdit(e: CellEditEvent) {
        const row = rows.value[e.rowIndex] as Record<string, unknown> | undefined
        if (row) row[e.field] = Number(e.newValue) || e.newValue
      }
      const plugins = [useUndoRedoPlugin({ storageKey: 'lm-editing-custom-slot' })]
      return { cols, rows, onCellEdit, plugins }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>Custom <code>#cell</code> slot</h2>
        <p>Le slot <code>#cell</code> reçoit <code>{ value, editing, editValue, updateValue, commit, cancel, startEdit }</code> pour piloter affichage + édition à 100%.</p>
        <div class="sb-grid-frame">
          <ad-grid-vue :height="560" :columns="cols" :rows="rows" :plugins="plugins" history-id="lm-editing-custom-slot" @cell-edit="onCellEdit">
            <template #cell-rating="{ value, editing, editValue, updateValue, commit, cancel, startEdit }">
              <input
                v-if="editing"
                type="range"
                min="0"
                max="5"
                step="0.1"
                :value="editValue"
                @input="updateValue(Number($event.target.value))"
                @keydown.enter="commit()"
                @keydown.esc="cancel()"
                style="width: 110px"
              />
              <button v-else @click="startEdit()" style="all: unset; cursor: pointer">
                <span v-for="n in 5" :key="n" :style="{ opacity: Number(value) >= n ? 1 : 0.2 }">★</span>
              </button>
            </template>
          </ad-grid-vue>
        </div>
      </div>
    `,
  }),
}
