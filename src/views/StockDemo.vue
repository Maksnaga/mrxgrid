<script setup lang="ts">
/**
 * Stock demo — Sprint 1 of REFONTE-PLAN-V2.md.
 *
 * Mirrors the Mozaic Angular grid storybook stock demo: products with
 * realistic data (Produit 14 / REF-00014 / Revêtement / 409.43 € / Weber /
 * status badge), validation on `name` + `price`, hidden columns (Disponible,
 * Dernière MAJ), select + date editors using Mozaic components.
 *
 * Used as the default demo so users see what the grid is capable of in a
 * recognisable e-commerce / stock context — not abstract `User N / R14C27`.
 */

import { computed, ref } from 'vue'
import {
  MrxGrid,
  MrxGridToolbar,
  MrxFormulaBar,
  MrxFormulaReferenceDrawer,
  MrxKeyboardShortcutsDrawer,
  MrxTableMenuDrawer,
  MrxGroupingDrawer,
  MrxGridFilterDrawer,
  defineStatusRenderer,
} from '@/components/MrxGrid'
import type {
  CellEditEvent,
  ColumnDef,
  RowData,
  FillEvent,
  DataDensity,
  GroupingItem,
} from '@/components/MrxGrid'
import {
  DEFAULT_OPERATORS,
  DEFAULT_OPERATOR_PER_TYPE,
  type FilterColumnDescriptor,
  type FilterDataType,
  type FilterModel,
} from '@/components/MrxGrid/models/filter.model'

// ─── Domain ───────────────────────────────────────────────────────────────

type Status = 'in-stock' | 'out-of-stock' | 'limited' | 'on-order'

interface Product extends RowData {
  id: number
  name: string
  reference: string
  category: string
  price: number
  stock: number
  supplier: string
  status: Status
  available: boolean
  lastUpdate: string
}

const CATEGORIES = [
  'Revêtement',
  'Quincaillerie',
  'Menuiserie',
  'Peinture',
  'Outillage',
  'Plomberie',
  'Électricité',
] as const

const SUPPLIERS = ['Weber', 'Sika', 'Hilti', 'Bosch', 'Makita', 'Stanley', 'Schneider'] as const

// Sprint 4 — status renderer via the shared `defineStatusRenderer` helper.
// The helper handles `markRaw`, MTag rendering and the per-appearance colour
// palette so the demo only declares the value→label/appearance mapping.

const StatusRenderer = defineStatusRenderer<Status>({
  'in-stock': { label: 'En stock', appearance: 'success' },
  'out-of-stock': { label: 'Rupture', appearance: 'danger' },
  'limited': { label: 'Limité', appearance: 'neutral' },
  'on-order': { label: 'En commande', appearance: 'warning' },
})

// ─── Columns ──────────────────────────────────────────────────────────────

const columns: ColumnDef[] = [
  {
    field: 'id',
    headerName: 'ID',
    width: '70px',
    pinned: 'left',
  },
  {
    field: 'name',
    headerName: 'Nom',
    width: '180px',
    editable: true,
    cellValidator: (v) =>
      typeof v === 'string' && v.trim().length > 0 ? true : 'Le nom est requis',
    filter: { type: 'text', placeholder: 'Rechercher...' },
  },
  {
    field: 'reference',
    headerName: 'Référence',
    width: '140px',
  },
  {
    field: 'category',
    headerName: 'Catégorie',
    width: '160px',
    editable: true,
    cellEditor: 'select',
    cellEditorOptions: CATEGORIES.map((c) => ({ label: c, value: c })),
    filter: {
      type: 'select',
      placeholder: 'Toutes',
      options: CATEGORIES.map((c) => ({ label: c, value: c })),
    },
  },
  {
    field: 'price',
    headerName: 'Prix (€)',
    width: '120px',
    editable: true,
    cellValidator: (v) => {
      const n = typeof v === 'number' ? v : Number(v)
      if (!Number.isFinite(n) || n <= 0) return 'Le prix doit être positif'
      return true
    },
    valueFormatter: (v) => {
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) ? `${n.toFixed(2)} €` : ''
    },
  },
  {
    field: 'stock',
    headerName: 'Stock',
    width: '90px',
    editable: true,
  },
  {
    field: 'supplier',
    headerName: 'Fournisseur',
    width: '140px',
    editable: true,
    cellEditor: 'select',
    cellEditorOptions: SUPPLIERS.map((s) => ({ label: s, value: s })),
  },
  {
    field: 'status',
    headerName: 'Statut',
    width: '140px',
    renderer: StatusRenderer,
  },
  // Hidden by default — appear in the HIDDEN COLUMNS tag bar.
  {
    field: 'available',
    headerName: 'Disponible',
    width: '110px',
    visible: false,
  },
  {
    field: 'lastUpdate',
    headerName: 'Dernière MAJ',
    width: '140px',
    visible: false,
    cellEditor: 'date',
  },
]

// ─── Rows ─────────────────────────────────────────────────────────────────

const STATUSES: Status[] = ['in-stock', 'out-of-stock', 'limited', 'on-order']

function makeProduct(i: number): Product {
  const id = i + 1
  // Special row: id 16 — invalid name + invalid price (matches Angular demo screenshot)
  if (id === 16) {
    return {
      id,
      name: '',
      reference: 'REF-00016',
      category: 'Menuiserie',
      price: 0,
      stock: 940,
      supplier: 'Hilti',
      status: 'limited',
      available: true,
      lastUpdate: '2026-04-15',
    }
  }
  const priceCents = (id * 1973 + 12491) % 50000 + 100   // pseudo-random 1.00 – 500.99 €
  return {
    id,
    name: `Produit ${id}`,
    reference: `REF-${String(id).padStart(5, '0')}`,
    category: CATEGORIES[i % CATEGORIES.length]!,
    price: priceCents / 100,
    stock: ((id * 7) % 1000) + 1,
    supplier: SUPPLIERS[i % SUPPLIERS.length]!,
    status: STATUSES[i % STATUSES.length]!,
    available: id % 3 !== 0,
    lastUpdate: `2026-04-${String((id % 28) + 1).padStart(2, '0')}`,
  }
}

const rows = ref<Product[]>(
  Array.from({ length: 1000 }, (_, i) => makeProduct(i)),
)

// ─── Demo wiring ──────────────────────────────────────────────────────────

const gridRef = ref<InstanceType<typeof MrxGrid>>()
const formulaBarRef = ref<InstanceType<typeof MrxFormulaBar>>()

const formulaReferenceOpen = ref(false)
const keyboardShortcutsOpen = ref(false)

// Sprint 9 — drawer state. Each drawer owns its open ref and apply
// callback. The grid stays the source of truth for hidden fields, group
// stack, filter conditions and density: drawers emit `apply`, the demo
// pipes the payload back into the grid props on the next tick.
const settingsOpen = ref(false)
const groupingOpen = ref(false)
const filtersOpen = ref(false)
const isFullscreen = ref(false)

const hiddenFields = ref<string[]>(['available', 'lastUpdate'])
const density = ref<DataDensity>('default')
const columnOrder = ref<string[] | undefined>(undefined)
const activeGroups = ref<GroupingItem[]>([])
const filterModel = ref<FilterModel>({ conditions: [] })

const groupFields = computed(() => activeGroups.value.map((g) => g.field))

// Build the filter drawer's column descriptors from the schema. Each
// column declares its filterType + operators; columns without `filterable`
// or a legacy `filter` shape are still listed so the user can build any
// condition from the drawer.
const filterColumns = computed<FilterColumnDescriptor[]>(() =>
  columns.map((col) => {
    // Narrow `col.filter` to its inline shape before reading `type` /
    // `options` — the union also covers custom MrxFilterConfig
    // (`component` / `doesFilterPass`) which doesn't carry those.
    const inline = col.filter && 'type' in col.filter ? col.filter : undefined
    const filterType: FilterDataType =
      col.filterType ??
      (inline?.type === 'select'
        ? 'set'
        : inline?.type === 'date'
          ? 'date'
          : col.field === 'price' || col.field === 'stock' || col.field === 'id'
            ? 'number'
            : 'text')
    const operators = col.filterOperators ?? DEFAULT_OPERATORS[filterType]
    const defaultOperator =
      col.defaultFilterOperator ?? DEFAULT_OPERATOR_PER_TYPE[filterType]
    return {
      field: col.field,
      headerName: col.headerName,
      filterType,
      operators,
      defaultOperator,
      options: col.filterOptions ?? inline?.options,
    }
  }),
)

const activeFilterCount = computed(() => filterModel.value.conditions.length)

function onApplySettings(payload: {
  density: DataDensity
  hiddenFields: string[]
  columnOrder: string[]
}) {
  density.value = payload.density
  hiddenFields.value = payload.hiddenFields
  columnOrder.value = payload.columnOrder
}

function onResetSettings() {
  density.value = 'default'
  hiddenFields.value = ['available', 'lastUpdate']
  columnOrder.value = undefined
}

function onApplyGrouping(groups: GroupingItem[]) {
  activeGroups.value = groups
}

function onResetGrouping() {
  activeGroups.value = []
}

function onApplyFilters(model: FilterModel) {
  filterModel.value = model
  // Mirror the drawer's filter model into the grid's internal engine so
  // the FILTERED BY tag bar + per-column overlay stay consistent.
  gridRef.value?.setFilterModel?.(model)
}

function onClearFilters() {
  // The filter drawer's "Clear" button targets the formal model only —
  // the inline filter row inputs (quick filters) are independent state
  // and aren't reset by this action.
  filterModel.value = { conditions: [] }
  gridRef.value?.clearFilterModel?.()
}

const flatColumns = computed(() => columns)

function onCellEdit(event: CellEditEvent) {
  const row = rows.value[event.rowIndex]
  if (!row) return
  if (event.field === 'price' || event.field === 'stock' || event.field === 'id') {
    const n = Number(event.newValue)
    ;(row as Record<string, unknown>)[event.field] = Number.isFinite(n) ? n : event.newValue
  } else {
    ;(row as Record<string, unknown>)[event.field] = event.newValue
  }
}

function onFill(event: FillEvent) {
  for (const fill of event.fills) {
    const row = rows.value[fill.rowIndex]
    if (row) (row as Record<string, unknown>)[fill.field] = fill.value
  }
}

function onFormulaInsert(text: string) {
  formulaBarRef.value?.insertText(text)
  formulaBarRef.value?.focusInput()
}

function onExport() {
  gridRef.value?.exportCsv({ filename: 'stock.csv' })
}

// Selection state surfaced from the grid ref so the toolbar's selection
// banner (count + "Select all N rows" + Clear) can render in the toolbar
// instead of the floating selection bar at the bottom of the grid.
const selectedRowCount = computed(() => gridRef.value?.selectedCount ?? 0)
const selectionTotal = computed(() => gridRef.value?.selectionTotalCount ?? 0)
const allRowsSelected = computed(
  () => gridRef.value?.selectionModel?.allSelected ?? false,
)

function onSelectAllRows() {
  gridRef.value?.selectAll()
}

function onClearSelection() {
  gridRef.value?.clearSelection()
}
</script>

<template>
  <div class="stock-demo">
    <header class="stock-demo__header">
      <h1>MrxGrid · Stock demo</h1>
      <p class="stock-demo__subtitle">
        1 000 produits · validations sur Nom + Prix · catégorie / fournisseur en MSelect ·
        statut rendu en MTag. Ouvre le menu kebab d'une colonne pour Sort / Pin / Hide /
        Filter in this column.
      </p>
    </header>

    <!-- Toolbar — full MrxGridToolbar with MIconButton + MButton
         "Filters" + Help link. The selection banner is built-in (inline,
         replaces the floating SelectionBar when rows are selected). -->
    <MrxGridToolbar
      show-fullscreen
      show-export
      show-filters
      show-settings
      show-group
      show-keyboard
      show-formula-reference
      :active-filter-count="activeFilterCount"
      :selected-count="selectedRowCount"
      :total-count="selectionTotal"
      :all-selected="allRowsSelected"
      @toggle-fullscreen="isFullscreen = !isFullscreen"
      @export="onExport"
      @filters="filtersOpen = !filtersOpen"
      @settings="settingsOpen = !settingsOpen"
      @group="groupingOpen = !groupingOpen"
      @keyboard="keyboardShortcutsOpen = !keyboardShortcutsOpen"
      @formula-reference="formulaReferenceOpen = !formulaReferenceOpen"
      @select-all-rows="onSelectAllRows"
      @clear-selection="onClearSelection"
    >
      <template #toolbar-end>
        <a class="stock-demo__help-link" href="#" @click.prevent>Help</a>
      </template>
    </MrxGridToolbar>

    <MrxFormulaBar ref="formulaBarRef" :all-columns="flatColumns" :rows="rows" />

    <MrxGrid
      ref="gridRef"
      :columns="columns"
      :rows="rows"
      :container-height="600"
      virtual-scroll
      selectable
      selection-bar-compact
      expandable
      :row-id="(row: RowData) => String(row.id)"
      :pagination="true"
      history-id="stock-demo"
      :density="density"
      :hidden-fields="hiddenFields"
      :group-fields="groupFields"
      :column-order="columnOrder"
      :fullscreen="isFullscreen"
      @update:hidden-fields="hiddenFields = $event"
      @cell-edit="onCellEdit"
      @fill="onFill"
    >
      <!-- Expand row content. The grid renders this slot inside a
           full-width detail panel when the user opens a row. Showing the
           hidden fields (Disponible, Dernière MAJ) + a recap is a useful
           default for the e-commerce demo. -->
      <template #expand-row="{ row }">
        <div class="stock-demo__expand">
          <div class="stock-demo__expand-header">
            <strong>{{ (row as Product).name }}</strong>
            <span class="stock-demo__expand-ref">{{ (row as Product).reference }}</span>
          </div>
          <dl class="stock-demo__expand-grid">
            <div>
              <dt>Catégorie</dt>
              <dd>{{ (row as Product).category }}</dd>
            </div>
            <div>
              <dt>Fournisseur</dt>
              <dd>{{ (row as Product).supplier }}</dd>
            </div>
            <div>
              <dt>Prix unitaire</dt>
              <dd>{{ (row as Product).price.toFixed(2) }} €</dd>
            </div>
            <div>
              <dt>Stock</dt>
              <dd>{{ (row as Product).stock }} unités</dd>
            </div>
            <div>
              <dt>Disponible</dt>
              <dd>{{ (row as Product).available ? 'Oui' : 'Non' }}</dd>
            </div>
            <div>
              <dt>Dernière mise à jour</dt>
              <dd>{{ (row as Product).lastUpdate }}</dd>
            </div>
          </dl>
        </div>
      </template>
    </MrxGrid>

    <!-- Drawers own their MDrawer wrapper — consumers only pass `:open`. -->
    <MrxTableMenuDrawer
      :open="settingsOpen"
      :columns="columns"
      :hidden-fields="hiddenFields"
      :density="density"
      :column-order="columnOrder"
      @update:open="settingsOpen = $event"
      @apply="onApplySettings"
      @reset="onResetSettings"
    />
    <MrxGroupingDrawer
      :open="groupingOpen"
      :columns="columns"
      :active-groups="activeGroups"
      @update:open="groupingOpen = $event"
      @apply="onApplyGrouping"
      @reset="onResetGrouping"
    />
    <MrxGridFilterDrawer
      :open="filtersOpen"
      :model="filterModel"
      :columns="filterColumns"
      @update:open="filtersOpen = $event"
      @apply="onApplyFilters"
      @clear="onClearFilters"
    />
    <MrxKeyboardShortcutsDrawer
      :open="keyboardShortcutsOpen"
      @update:open="keyboardShortcutsOpen = $event"
    />
    <MrxFormulaReferenceDrawer
      :open="formulaReferenceOpen"
      @update:open="formulaReferenceOpen = $event"
      @insert="onFormulaInsert"
    />
  </div>
</template>

<style scoped>
.stock-demo {
  padding: 16px 24px 80px;
  max-width: 1400px;
  margin: 0 auto;
  font-family: system-ui, -apple-system, sans-serif;
}

.stock-demo__header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #1a73e8;
}

.stock-demo__subtitle {
  margin: 4px 0 16px;
  font-size: 13px;
  color: #555;
  line-height: 1.5;
}

.stock-demo__help-link {
  color: var(--Status-Standalone-element-Primary, #0071ce);
  font-size: 13px;
  text-decoration: none;
}

.stock-demo__help-link:hover {
  text-decoration: underline;
}

.stock-demo__expand {
  padding: 16px 24px;
  background: var(--color-background-secondary, #f5f7f9);
  border-top: 1px solid var(--color-border-primary, #e2e8f0);
  border-bottom: 1px solid var(--color-border-primary, #e2e8f0);
  font-size: 13px;
}

.stock-demo__expand-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.stock-demo__expand-header strong {
  font-size: 15px;
  color: var(--color-text-primary, #1a73e8);
}

.stock-demo__expand-ref {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
  color: var(--color-text-secondary, #64748b);
}

.stock-demo__expand-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px 24px;
  margin: 0;
}

.stock-demo__expand-grid > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stock-demo__expand-grid dt {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary, #64748b);
}

.stock-demo__expand-grid dd {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-primary, #1e293b);
}

.stock-demo__drawer {
  position: fixed;
  top: 80px;
  left: 24px;
  width: 400px;
  max-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #cdd4d8;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 100;
}

.stock-demo__drawer--right {
  left: auto;
  right: 24px;
}

.stock-demo__drawer header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #e0e0e0;
}

.stock-demo__drawer h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.stock-demo__drawer header button {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  border-radius: 50%;
}
</style>

