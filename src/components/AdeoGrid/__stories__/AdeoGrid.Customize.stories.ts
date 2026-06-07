import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref, watch } from 'vue'
import {
  AdeoColumn,
  AdeoGrid,
  AdeoGridToolbar,
  AdeoTableMenuDrawer,
  useUndoRedoPlugin,
} from '@/components/AdeoGrid'
import type { ColumnDef, DataDensity } from '@/components/AdeoGrid'
import type { AdeoGridPlugin } from '@/components/AdeoGrid/models/plugin.model'
import { lmColumns, lmProducts } from './_fixtures'

const meta = {
  title: 'Stories/Customization/Persist · Plugins · Toolbar · Declarative',
  component: AdeoGrid,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Customization

Cinq mécanismes d'extension à connaître :

| Mécanisme | Pour quoi | Effort |
|-----------|-----------|--------|
| \`persist-key\` | Auto-save layout en localStorage | 1 prop |
| \`#toolbar\` slot + drawers | Toolbar + actions custom | layout |
| \`<AdeoGridSmartToolbar>\` | Toolbar batteries-included | 1 component |
| Plugins (\`AdeoGridPlugin\`) | Behavior cross-cutting | 1 fonction |
| \`<AdeoColumn>\` declarative | Definition de colonnes en SFC | template |

### Plugins API

\`\`\`ts
interface AdeoGridPlugin {
  name: string
  init: (ctx: { state: GridState; engine: GridEngine }) => (() => void) | void
}
\`\`\`

Le retour de \`init\` est appelé en cleanup au unmount. Idéal pour :
- Auto-save trigger (debounce sur changements de \`columnStates\`)
- Logging / analytics
- Sync avec une URL query string
- Patterns "accordion" sur l'expansion
- Custom undo/redo backends
        `,
      },
    },
  },
} satisfies Meta<typeof AdeoGrid>

export default meta
type Story = StoryObj<typeof meta>

export const PersistedLayout: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## \`persist-key\`

\`\`\`vue
<AdeoGrid persist-key="my-grid-v1" :columns="columns" :rows="rows" />
\`\`\`

### Ce qui est persisté

- \`columnStates\` : largeur, ordre, visibilité, pin par colonne
- \`activeSorts\` : la sort stack
- \`filterModel\` : les conditions du drawer
- (PAS persisté : la sélection, l'expansion, les valeurs de cellule)

### Storage

\`localStorage["adeo-grid-grid-state:" + persistKey]\` — JSON sérialisé. Versionnez votre clé (\`v1\`, \`v2\`) si vous changez la shape de vos columns/données pour invalider l'ancien état.

### API impérative

\`\`\`ts
grid.persistView()    // force-save now (ignore debounce)
grid.restoreView()    // load and apply
\`\`\`

Utile pour des sauvegardes "named" (ex. "Vue commerciale", "Vue logistique") au-delà du localStorage par défaut.

### Anti-pattern

Ne réutilisez pas la même clé sur deux grilles à dataset différent — l'état d'une grille s'appliquerait sur l'autre et leak des columns inexistantes.
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup: () => ({ lmColumns, lmProducts }),
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Persisted layout · <code>:persist-key</code></h2>
        <p>Le grid sauve largeur / ordre / visibilité / pin / sort / filtres dans <code>localStorage</code> sous la clé fournie. Reload, retrouve l'état.</p>
        <div class="sb-adeo-grid-toolbar">Trie / pin / cache une colonne, recharge la page → l'état est restauré depuis <code>localStorage["lm-products-v1"]</code>.</div>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560" :columns="lmColumns" :rows="lmProducts" persist-key="lm-products-v1" />
        </div>
      </div>
    `,
  }),
}

export const ToolbarAndSettings: Story = {
  name: 'Toolbar + Table settings drawer',
  parameters: {
    docs: {
      description: {
        story: `
## Toolbar + Settings drawer (manual wiring)

Pattern "fine control" : vous wirez tout à la main pour avoir le full pilotage.

### Implémentation

\`\`\`vue
<script setup lang="ts">
import { ref } from 'vue'
import { AdeoGrid, AdeoGridToolbar, AdeoTableMenuDrawer } from '@/components/AdeoGrid'

const settingsOpen = ref(false)
const fullscreen   = ref(false)
const density      = ref<DataDensity>('default')
const hiddenFields = ref<string[]>([])
const columnOrder  = ref<string[] | undefined>(undefined)

function onApply(payload: {
  density: DataDensity
  hiddenFields: string[]
  columnOrder: string[]
}) {
  density.value      = payload.density
  hiddenFields.value = payload.hiddenFields
  columnOrder.value  = payload.columnOrder
}
</script>

<template>
  <AdeoGrid
    :columns="columns"
    :rows="rows"
    :density="density"
    :fullscreen="fullscreen"
    :hidden-fields="hiddenFields"
    :column-order="columnOrder"
  >
    <template #toolbar>
      <AdeoGridToolbar
        show-fullscreen show-settings
        :fullscreen="fullscreen"
        @toggle-fullscreen="fullscreen = !fullscreen"
        @settings="settingsOpen = !settingsOpen"
      />
    </template>
  </AdeoGrid>

  <AdeoTableMenuDrawer
    :open="settingsOpen"
    :columns="columns"
    :hidden-fields="hiddenFields"
    :density="density"
    :column-order="columnOrder"
    @update:open="settingsOpen = $event"
    @apply="onApply"
    @reset="density = 'default'; hiddenFields = []; columnOrder = undefined"
  />
</template>
\`\`\`

### Toolbar dans le slot \`#toolbar\`

Important pour fullscreen : si la toolbar est en sibling, elle disparaît derrière le grid en \`position: fixed\`. Le slot \`#toolbar\` est rendu **dans** le conteneur grid, donc partage le z-index.

### Si vous voulez moins de plomberie

Utilisez \`<AdeoGridSmartToolbar>\` qui bundle ce wiring (voir story *Devtools / Event console*).
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid, AdeoGridToolbar, AdeoTableMenuDrawer },
    setup() {
      const settingsOpen = ref(false)
      const fullscreen = ref(false)
      const density = ref<DataDensity>('default')
      const hiddenFields = ref<string[]>([])
      const columnOrder = ref<string[] | undefined>(undefined)

      function onApply(payload: {
        density: DataDensity
        hiddenFields: string[]
        columnOrder: string[]
      }) {
        density.value = payload.density
        hiddenFields.value = payload.hiddenFields
        columnOrder.value = payload.columnOrder
      }
      function onReset() {
        density.value = 'default'
        hiddenFields.value = []
        columnOrder.value = undefined
      }

      return {
        lmColumns,
        lmProducts,
        settingsOpen,
        fullscreen,
        density,
        hiddenFields,
        columnOrder,
        onApply,
        onReset,
      }
    },
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Toolbar + Settings drawer combo</h2>
        <p><code>AdeoGridToolbar</code> est rendu via le slot <code>#toolbar</code> du grid : il reste donc visible quand on passe en plein écran. Le drawer ferme via la croix ou en cliquant l'overlay.</p>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560"
            :columns="lmColumns"
            :rows="lmProducts"
            :density="density"
            :fullscreen="fullscreen"
            :hidden-fields="hiddenFields"
            :column-order="columnOrder"
            @update:hidden-fields="hiddenFields = $event"
          >
            <template #toolbar>
              <AdeoGridToolbar
                show-fullscreen
                show-settings
                :fullscreen="fullscreen"
                @toggle-fullscreen="fullscreen = !fullscreen"
                @settings="settingsOpen = !settingsOpen"
              />
            </template>
          </AdeoGrid>
        </div>
        <AdeoTableMenuDrawer
          :open="settingsOpen"
          :columns="lmColumns"
          :density="density"
          :hidden-fields="hiddenFields"
          :column-order="columnOrder ?? lmColumns.map((c) => c.field)"
          @update:open="settingsOpen = $event"
          @apply="onApply"
          @reset="onReset"
        />
      </div>
    `,
  }),
}

export const Plugins: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Plugins (\`AdeoGridPlugin\`)

Pattern d'extension cross-cutting : un plugin reçoit \`{ state, engine }\` au mount et retourne une fonction de cleanup.

### Signature

\`\`\`ts
interface AdeoGridPlugin {
  name: string
  init: (ctx: { state: GridState; engine: GridEngine }) => (() => void) | void
}
\`\`\`

### Exemple : auto-save dans une URL query string

\`\`\`ts
const urlSyncPlugin: AdeoGridPlugin = {
  name: 'url-sync',
  init({ state }) {
    const stop = watch(
      [state.activeSorts, state.filterModel, state.columnStates],
      () => {
        const params = new URLSearchParams()
        if (state.activeSorts.value.length) {
          params.set('sort', JSON.stringify(state.activeSorts.value))
        }
        history.replaceState(null, '', '?' + params.toString())
      },
      { deep: true },
    )
    return stop  // cleanup at unmount
  },
}
\`\`\`

\`\`\`vue
<AdeoGrid :plugins="[urlSyncPlugin]" :columns="cols" :rows="rows" />
\`\`\`

### Patterns courants

| Plugin | Effet |
|--------|-------|
| Auto-save debounced | Snapshot state in IndexedDB toutes les 5s |
| Analytics | Track sort/filter changes vers Mixpanel |
| Accordion expansion | Force une seule row expanded à la fois |
| Custom undo/redo | Backend autre que localStorage (server-synced) |
| Audit log | Push chaque cell-edit vers /api/audit |

### Plugin built-in : \`useUndoRedoPlugin\`

Voir story suivante.
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup() {
      const log = ref<string[]>([])

      // Tiny audit-log plugin: watches state on init, returns a cleanup
      // that logs disposal.
      const auditPlugin: AdeoGridPlugin = {
        name: 'audit',
        init({ state }) {
          log.value.push('plugin:init')
          const off = watch(state.activeSorts, (sorts) => {
            log.value.push(
              `sort · ${sorts.map((s) => `${s.field}:${s.direction}`).join(', ') || 'none'}`,
            )
            if (log.value.length > 30) log.value.shift()
          })
          return () => {
            off()
            log.value.push('plugin:dispose')
          }
        },
      }

      return { lmColumns, lmProducts, log, plugins: [auditPlugin] }
    },
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Plugins (<code>:plugins</code>)</h2>
        <p>Un plugin reçoit <code>{ state, engine }</code>. Idéal pour l'audit, l'analytics, des keybindings custom — tout sans toucher le core.</p>
        <div class="sb-adeo-grid-toolbar">Audit log :
          <code v-for="(l, i) in log.slice(-3)" :key="i" style="margin-left: 6px">{{ l }}</code>
          <code v-if="!log.length">vide</code>
        </div>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560" :columns="lmColumns" :rows="lmProducts" :plugins="plugins" />
        </div>
      </div>
    `,
  }),
}

export const UndoRedo: Story = {
  name: 'Undo / Redo plugin (localStorage)',
  parameters: {
    docs: {
      description: {
        story: `
## Undo / Redo plugin

Deux options pour activer l'undo/redo des cell edits + fills + bulk deletes :

### Option 1 — \`history-id\` (le plus simple)

\`\`\`vue
<AdeoGrid :columns="cols" :rows="rows" history-id="my-grid" />
\`\`\`

Persiste la stack en \`localStorage["adeo-grid-grid-history:my-grid"]\` automatiquement.

### Option 2 — \`useUndoRedoPlugin\` (avancé)

\`\`\`ts
import { useUndoRedoPlugin } from '@/components/AdeoGrid'
const plugins = [useUndoRedoPlugin({ storageKey: 'my-grid' })]
\`\`\`

### API impérative

\`\`\`ts
grid.undo()
grid.redo()
grid.clearHistory()
\`\`\`

### Keyboard

\`⌘Z\` / \`Ctrl+Z\` undo, \`⌘⇧Z\` / \`Ctrl+Y\` redo.

### Ce qui est tracé

Cell edits, fills, bulk deletes — pas le sort/filter/pin/hide (transitions UX, pas data).
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid },
    setup() {
      // Editable copy of the LM dataset — the undo plugin reverts cell
      // values through the same `cellEdit` pipeline the consumer wires up.
      const rows = ref(lmProducts.map((r) => ({ ...r })))

      const editableColumns: ColumnDef[] = lmColumns.map((c) =>
        c.field === 'name' || c.field === 'price' ? { ...c, editable: true } : c,
      )

      function onCellEdit(e: { rowIndex: number; field: string; newValue: unknown }) {
        const r = rows.value[e.rowIndex]
        if (r) (r as Record<string, unknown>)[e.field] = e.newValue
      }

      // History stacks persist under `adeo-grid-history:lm-undo-demo` so a
      // page reload keeps your undo trail. Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z
      // (or Cmd/Ctrl+Y) trigger undo/redo at the window level.
      const undoPlugin = useUndoRedoPlugin({ storageKey: 'lm-undo-demo' })

      return { rows, editableColumns, plugins: [undoPlugin], onCellEdit }
    },
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Undo / Redo plugin</h2>
        <p>
          Drop-in <code>useUndoRedoPlugin({ storageKey })</code>. Edits, paste, fill, cut, delete are
          recorded automatically; <kbd>⌘Z</kbd>&nbsp;/&nbsp;<kbd>⌘⇧Z</kbd> (or <kbd>⌘Y</kbd>) revert / replay
          them. Stacks survive a reload via <code>localStorage["adeo-grid-grid-history:lm-undo-demo"]</code>.
        </p>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560"
            :columns="editableColumns"
            :rows="rows"
            :plugins="plugins"
            history-id="lm-undo-demo"
            @cell-edit="onCellEdit"
          />
        </div>
      </div>
    `,
  }),
}

export const DeclarativeColumns: Story = {
  name: '<AdeoColumn> declarative API',
  parameters: {
    docs: {
      description: {
        story: `
## Declarative \`<AdeoColumn>\` children

Alternative à la prop \`:columns\` : déclarez chaque colonne en SFC enfant. Plus lisible quand vous avez beaucoup de slots inline ou de logic Vue.

### Implémentation

\`\`\`vue
<AdeoGrid :rows="rows" selectable>
  <AdeoColumn field="sku" header-name="Réf" :width="120" pinned="start" />
  <AdeoColumn field="name" header-name="Produit" :width="260" sortable filterable filter-type="text" />
  <AdeoColumn field="price" header-name="Prix" :width="110" sortable editable cell-editor="number">
    <template #cell="{ value }">{{ value.toFixed(2) }} €</template>
  </AdeoColumn>
</AdeoGrid>
\`\`\`

### vs prop \`:columns\`

| Critère | \`:columns\` | \`<AdeoColumn>\` |
|---------|------------|----------------|
| Slots par colonne | Via \`#cell-{field}\` racine | Slots enfants directs |
| Génération dynamique | Naturel | \`v-for\` (plus verbeux) |
| Type-safety sur \`field\` | Forte | Stringly typed |

### Combiner les deux

\`\`\`vue
<AdeoGrid :columns="propCols" :rows="rows">
  <AdeoColumn field="custom" header-name="Custom">
    <template #cell="{ row }">…</template>
  </AdeoColumn>
</AdeoGrid>
\`\`\`

Quand un \`field\` matche entre les deux APIs, le \`<AdeoColumn>\` enfant **override** la version prop. Pratique pour ajouter un slot sans réécrire la \`ColumnDef\`.

### Sous le capot

Chaque \`<AdeoColumn>\` s'enregistre via \`provide(MRX_COLUMN_REGISTRY_KEY)\`. \`AdeoGrid\` merge avec \`props.columns\` pour produire \`mergedColumns\` (le registry gagne en cas de collision sur \`field\`).
        `,
      },
    },
  },
  render: () => ({
    components: { AdeoGrid, AdeoColumn },
    setup: () => ({ lmProducts }),
    template: `
      <div class="sb-adeo-grid-shell">
        <h2>Declarative columns via <code>&lt;AdeoColumn&gt;</code></h2>
        <p>Alternative à la prop <code>:columns</code>. Pratique quand chaque colonne porte des slots ou des règles spécifiques au template.</p>
        <div class="sb-adeo-grid-frame">
          <AdeoGrid :height="560" :rows="lmProducts">
            <AdeoColumn field="sku" headerName="Réf" width="120px" pinned="start" />
            <AdeoColumn field="name" headerName="Produit" width="260px" :editable="true" />
            <AdeoColumn field="brand" headerName="Marque" width="140px" :sortable="true" />
            <AdeoColumn field="price" headerName="Prix" width="110px" :sortable="true" :editable="true" />
            <AdeoColumn field="store" headerName="Magasin" width="180px" pinned="end" />
          </AdeoGrid>
        </div>
      </div>
    `,
  }),
}
