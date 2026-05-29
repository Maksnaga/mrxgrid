<script setup lang="ts">
/**
 * Page principale de la demo app — catalogue produits.
 *
 * Architecture :
 *   • `useProductList()` encapsule le fetch serveur (pagination + filtres
 *     + tri + recherche debouncée).
 *   • Le grid consomme `list.rows` / `list.total` et émet ses events de
 *     pagination / tri sur les handlers du composable.
 *   • Le slot `#toolbar` est rendu via `ToolbarActions` qui wrap la
 *     smart toolbar Mozaic + nos actions consumer.
 *   • Aucune persistance localStorage : chaque reload repart d'un état
 *     neutre (density default, colonnes dans l'ordre d'origine, etc.).
 *
 * Les renderers de cellule sont des composants Vue dédiés (StatusCell,
 * BrandCell, …) — pattern recommandé pour rester découplé du grid.
 */

import { computed, markRaw, ref } from 'vue'
import {
  MrxGrid,
  type ColumnDef,
  type DataDensity,
  type GroupingItem,
  type MrxDoesFilterPassParams,
} from '@/components/MrxGrid'

import ToolbarActions from './components/ToolbarActions.vue'
import ProductDrawer from './components/ProductDrawer.vue'
import DeleteConfirmModal from './components/DeleteConfirmModal.vue'
import BulkStatusModal from './components/BulkStatusModal.vue'
import BulkActionBar from './components/BulkActionBar.vue'
import { MTabs } from '@mozaic-ds/vue'
import ShowCodePanel from './components/ShowCodePanel.vue'
import StatusCell from './components/cells/StatusCell.vue'
import BrandCell from './components/cells/BrandCell.vue'
import BrandComboEditor from './components/cells/BrandComboEditor.vue'
import RatingCell from './components/cells/RatingCell.vue'
import EnergyCell from './components/cells/EnergyCell.vue'
import CategoryComboFilter from './components/filters/CategoryComboFilter.vue'
import ProductDetailExpand from './components/detail/ProductDetailExpand.vue'

import { useProductList } from './composables/useProductList'
import { usePendingMutations } from './composables/usePendingMutations'
import { useStressOverrides } from './composables/useStressOverrides'
import { useToastsStore } from './stores/toasts.store'
import {
  deleteProduct,
  deleteProducts,
  updateProduct,
  updateProducts,
} from './mock/api'
import type { LMProduct } from './mock/seed'
import { stressColumns } from './columns/stressColumns'

// Champs "vrais" de LMProduct côté mock store. Tout field hors de ce set est
// une colonne stress (gérée par overrides côté demo, pas par updateProduct).
const BASE_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'sku',
  'name',
  'category',
  'brand',
  'price',
  'stock',
  'status',
  'rating',
  'energyClass',
  'promo',
  'store',
  'updatedAt',
])

const stress = useStressOverrides()

const LM_CATEGORIES = [
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
]

// Source d'options pour l'éditeur combobox sur la colonne `brand`. Doit
// rester en phase avec les marques générées par les fixtures Storybook
// (`_fixtures.ts > LM_BRANDS`) ; en cas d'ajout côté seed, recopier ici.
const LM_BRANDS = [
  'Dexter',
  'Sensea',
  'Lexman',
  'Equation',
  'Geolia',
  'Adel',
  'Spaceo',
  'Diall',
  'Bosch',
  'Stanley',
  'Black & Decker',
  'Makita',
]

const toasts = useToastsStore()
const list = useProductList()
// On destructure les refs en top-level — sans ça, le binding
// `:pending-cells="pending.pendingCells.value"` n'enregistre pas la dep
// dans le render effect de DemoPage et la mutation côté composable ne
// déclenche pas le re-render parent → MrxGrid reçoit toujours `[]`.
// Top-level refs en `:pending-cells="pendingCells"` profitent de
// l'auto-unwrap Vue et de la dep correctement tracée.
const pending = usePendingMutations()
const pendingCells = pending.pendingCells
const pendingRowIds = pending.pendingRowIds
const gridRef = ref<InstanceType<typeof MrxGrid> | null>(null)

// Tabs principales — bascule entre la démo et le tutoriel pas-à-pas.
const activeTab = ref<number>(0)
const TABS = [
  { id: 'demo', label: 'Démo' },
  { id: 'tutorial', label: 'Tutoriel' },
]

// Pagination — on expose une vraie échelle (jusqu'à 100 000) pour
// démontrer que le grid encaisse de gros pages avec le virtual-scroll
// expansion-aware. Au-delà, le DOM commence à coûter cher : on plafonne
// raisonnablement, et l'utilisateur peut basculer en `:virtual-scroll`
// pur sans pagination si besoin de plus.
const paginationConfig = {
  defaultPageSize: 25,
  pageSizeOptions: [10, 25, 50, 100, 500, 1000, 10000, 100000],
}

// État UI piloté par la toolbar (v-models). Tout en RAM — aucune
// persistance localStorage, chaque reload repart sur les valeurs par
// défaut.
const fullscreen = ref(false)
const density = ref<DataDensity>('default')
const hiddenFields = ref<string[]>([])
const columnOrder = ref<string[] | undefined>(undefined)
const activeGroups = ref<GroupingItem[]>([])
const groupFields = computed(() => activeGroups.value.map((g) => g.field))


// ---------------------------------------------------------------------------
// Colonnes — feature showcase (les 3 styles de filtres viennent au PR 4).
//
// Les renderers sont passés via `renderer` + `markRaw`. Comme `markRaw`
// est requis sur tout composant qu'on stocke dans un objet réactif
// (sinon Vue le proxifie), on garde l'idiome partout pour cohérence.
// ---------------------------------------------------------------------------

const baseColumns: ColumnDef[] = [
  {
    field: 'sku',
    headerName: 'Référence',
    width: '130px',
    pinned: 'start',
    sortable: true,
    filterable: true,
    filterType: 'text',
    filter: { type: 'text', placeholder: 'Réf…' },
  },
  {
    field: 'name',
    headerName: 'Produit',
    width: '280px',
    pinned: 'start',
    sortable: true,
    filterable: true,
    filterType: 'text',
    editable: true,
    filter: { type: 'text', placeholder: 'Rechercher…' },
  },
  {
    // Style 3 — filtre custom AG-Grid sur la colonne `category`.
    // Le composant est mounté par le builder / column overlay. Le
    // prédicat est de la donnée de colonne (pas une méthode du
    // composant), partageable et testable en isolation.
    field: 'category',
    headerName: 'Rayon',
    width: '160px',
    sortable: true,
    groupable: true,
    filterable: true,
    filterType: 'set',
    // Les casts `as any` ferment la variance entre nos types stricts
    // (`MrxDoesFilterPassParams<LMProduct, string[]>`) et le slot
    // `MrxFilterConfig<unknown, unknown>` côté ColumnDef. TS refuse
    // l'élargissement automatique sur les positions contravariantes.
    filter: {
      component: markRaw(CategoryComboFilter),
      filterParams: LM_CATEGORIES,

      doesFilterPass: ((p: MrxDoesFilterPassParams<LMProduct, string[]>) => {
        if (!Array.isArray(p.model) || p.model.length === 0) return true
        const v = p.getValue('category')
        return typeof v === 'string' && p.model.includes(v)
      }),

      getModelAsString: ((m: string[]) =>
        Array.isArray(m) && m.length > 0 ? m.join(', ') : ''),
    },
  },
  {
    // Colonne éditable avec un MCombobox Mozaic — démontre le pattern
    // "custom editor via slot #edit-{field}". `cellEditor: 'custom'`
    // bascule l'engine en mode édition au double-clic / Enter, et le
    // slot `#edit-brand` côté `<MrxGrid>` rend le combobox.
    // `cellEditorOptions` est la source des options consommée par le slot.
    field: 'brand',
    headerName: 'Marque',
    width: '180px',
    sortable: true,
    filterable: true,
    filterType: 'text',
    editable: true,
    cellEditor: 'custom',
    cellEditorOptions: LM_BRANDS.map((b) => ({ value: b, label: b })),
    renderer: markRaw(BrandCell),
  },
  {
    field: 'price',
    headerName: 'Prix',
    width: '110px',
    sortable: true,
    filterable: true,
    filterType: 'number',
    editable: true,
    cellEditor: 'number',
    valueFormatter: (v) =>
      typeof v === 'number'
        ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)
        : '',
    cellClass: 'mrx-cell-num',
  },
  {
    field: 'stock',
    headerName: 'Stock',
    width: '90px',
    sortable: true,
    filterable: true,
    filterType: 'number',
    editable: true,
    cellEditor: 'number',
    cellValidator: (v) =>
      typeof v === 'number' && v >= 0 ? true : 'Stock négatif interdit',
    cellClass: 'mrx-cell-num',
  },
  {
    field: 'rating',
    headerName: 'Note',
    width: '90px',
    sortable: true,
    renderer: markRaw(RatingCell),
  },
  {
    field: 'energyClass',
    headerName: 'Classe',
    width: '90px',
    sortable: true,
    filterable: true,
    filterType: 'set',
    renderer: markRaw(EnergyCell),
  },
  {
    field: 'store',
    headerName: 'Magasin',
    width: '180px',
    sortable: true,
    filterable: true,
    filterType: 'set',
  },
  {
    field: 'status',
    headerName: 'État',
    width: '140px',
    pinned: 'end',
    sortable: true,
    filterable: true,
    filterType: 'set',
    renderer: markRaw(StatusCell),
  },
]

// ---------------------------------------------------------------------------
// Stress-test 200 colonnes — la génération des 190 extras vit dans
// `./columns/stressColumns.ts`. Chaque colonne stress :
//   • est éditable (number / text / set / date)
//   • lit via `valueGetter` qui résout overrides utilisateur d'abord,
//     fallback sur valeur pseudo-aléatoire dérivée de `row.id`
//   • n'occupe aucune mémoire tant qu'elle n'est pas éditée
//
// Total final : 10 colonnes base + 190 stress = 200 colonnes.
// Le `pinned: 'end'` sur `status` reste honoré par le grid quel que soit
// l'ordre — on push les stress au milieu sans casser le pinning.
// ---------------------------------------------------------------------------

const columns: ColumnDef[] = [
  ...baseColumns.filter((c) => c.field !== 'status'),
  ...stressColumns,
  baseColumns.find((c) => c.field === 'status')!,
]

// ---------------------------------------------------------------------------
// Édition inline — chaque commit déclenche un updateProduct + toast.
// Pas d'history app-level : la demo reste focus sur les features grid.
// ---------------------------------------------------------------------------

/**
 * Latence simulée pour les writes "stress" — sans aller-retour serveur
 * il n'y aurait pas de shimmer du tout. On garde 350 ms (cohérent avec
 * la latency mock côté `mock/latency.ts`) pour que la démo montre bien
 * le skeleton sur les 200 colonnes.
 */
function simulateLatency(): Promise<void> {
  return new Promise((r) => setTimeout(r, 350))
}

async function onCellEdit(e: {
  rowIndex: number
  field: string
  oldValue: unknown
  newValue: unknown
}): Promise<void> {
  if (e.oldValue === e.newValue) return
  const row = list.rows.value[e.rowIndex] as LMProduct | undefined
  if (!row) return

  // Champ stress (hors LMProduct) → on stocke dans les overrides locaux
  // après un délai simulé, le tout enveloppé dans `withCellPending` pour
  // que le shimmer s'affiche pendant l'écriture (sinon l'utilisateur ne
  // voit jamais le feedback visuel sur les 190 stress cols).
  if (!BASE_FIELDS.has(e.field)) {
    try {
      await pending.withCellPending(String(row.id), e.field, async () => {
        await simulateLatency()
        stress.setOverride(row.id, e.field, e.newValue)
      })
    } catch (err) {
      toasts.error((err as Error).message)
    }
    return
  }

  const field = e.field as keyof LMProduct
  const patch = { [field]: e.newValue } as Partial<LMProduct>

  try {
    // `withCellPending` marque la cellule shimmering pendant l'API call,
    // démarque automatiquement au resolve ou sur exception (try/finally
    // interne). Le toast d'erreur reste sous notre try/catch externe.
    await pending.withCellPending(String(row.id), e.field, () =>
      updateProduct(row.id, patch),
    )
    toasts.success('Modification enregistrée')
  } catch (err) {
    toasts.error((err as Error).message, {
      label: 'Réessayer',
      onClick: () => void list.refetch(),
    })
  }
}

// ---------------------------------------------------------------------------
// Recherche — la toolbar binde sur la même ref `searchInput` que le
// composable expose ; le composable applique le debounce 300ms.
// ---------------------------------------------------------------------------

function onSearch(value: string): void {
  list.searchInput.value = value
}

// ---------------------------------------------------------------------------
// Fill handle — l'utilisateur drag depuis une cell source pour propager la
// valeur. La grille calcule les `fills` ({ rowIndex, field, value }[]) ; on
// les envoie en batch au mock API.
// ---------------------------------------------------------------------------

async function onFill(event: {
  fills: Array<{ rowIndex: number; field: string; value: unknown }>
}): Promise<void> {
  // Split fills en 2 buckets : base (→ updateProducts mock api) et stress
  // (→ overrides locaux, instantané). Permet de fill 1000 cellules de
  // "Ventes Mars 2024" en un drag sans aller-retour réseau simulé.
  const baseFills: Array<{ rowId: number; field: string; value: unknown }> = []
  const stressFills: Array<{ rowId: number; field: string; value: unknown }> = []

  for (const f of event.fills) {
    const row = list.rows.value[f.rowIndex] as LMProduct | undefined
    if (!row) continue
    if (BASE_FIELDS.has(f.field)) {
      baseFills.push({ rowId: row.id, field: f.field, value: f.value })
    } else {
      stressFills.push({ rowId: row.id, field: f.field, value: f.value })
    }
  }

  // Stress cells : on shimmer toutes les cellules ciblées pendant un
  // délai simulé, puis on flush les overrides en un coup. Pareil que
  // `onCellEdit` mais en bulk — le user voit le skeleton sur toute la
  // zone fill, pas seulement sur la source.
  if (stressFills.length > 0) {
    const stressPendingCells = stressFills.map((f) => ({
      rowId: String(f.rowId),
      field: f.field,
    }))
    try {
      await pending.withCellsPending(stressPendingCells, async () => {
        await simulateLatency()
        stress.setManyOverrides(stressFills)
      })
    } catch (err) {
      toasts.error((err as Error).message)
    }
  }

  // Base cells : on garde la sémantique pending shimmer + batch API.
  if (baseFills.length > 0) {
    const byField = new Map<string, { ids: number[]; value: unknown }>()
    for (const f of baseFills) {
      let bucket = byField.get(f.field)
      if (!bucket) {
        bucket = { ids: [], value: f.value }
        byField.set(f.field, bucket)
      }
      bucket.ids.push(f.rowId)
    }

    const pendingCells = baseFills.map((f) => ({
      rowId: String(f.rowId),
      field: f.field,
    }))

    try {
      await pending.withCellsPending(pendingCells, async () => {
        for (const [field, bucket] of byField.entries()) {
          await updateProducts(bucket.ids, {
            [field]: bucket.value,
          } as Partial<LMProduct>)
        }
      })
      toasts.success(`${event.fills.length} cellules mises à jour`)
      await list.refetch()
      return
    } catch (err) {
      toasts.error((err as Error).message)
      await list.refetch()
      return
    }
  }

  // 100% stress fills — pas de fetch nécessaire, le valueGetter relira
  // direct depuis les overrides au prochain render.
  if (stressFills.length > 10) {
    toasts.success(`${stressFills.length} cellules mises à jour`)
  }
}

// ---------------------------------------------------------------------------
// Drawer création / édition — pilote `ProductDrawer`.
// ---------------------------------------------------------------------------

const drawerOpen = ref(false)
const drawerProduct = ref<LMProduct | null>(null)

function onNewProduct(): void {
  drawerProduct.value = null
  drawerOpen.value = true
}

function onEditProduct(product: LMProduct): void {
  drawerProduct.value = product
  drawerOpen.value = true
}

async function onProductCreated(p: LMProduct): Promise<void> {
  toasts.success(`Produit "${p.name}" créé`)
  await list.refetch()
}

async function onProductUpdated(p: LMProduct): Promise<void> {
  // Le `updateProduct` côté drawer est déjà résolu quand on arrive ici
  // (event `@updated` du `ProductDrawer`) — pas de pending row à marquer.
  // Si l'app était structurée avec le save côté DemoPage, on wrapperait
  // ici avec `pending.withRowPending([String(p.id)], () => updateProduct(...))`.
  toasts.success(`Produit "${p.name}" mis à jour`)
  await list.refetch()
}

// ---------------------------------------------------------------------------
// Suppression — modal de confirmation (single OU bulk), branchée sur les
// 2 sources : bouton "Supprimer" du drawer + bouton "Supprimer" de la
// bulk bar. Le `ids` stocké pendant l'ouverture détermine quoi supprimer
// au confirm.
// ---------------------------------------------------------------------------

const deleteModalOpen = ref(false)
const deleteIds = ref<number[]>([])
const deleting = ref(false)

function askDelete(ids: number[]): void {
  if (ids.length === 0) return
  deleteIds.value = ids
  deleteModalOpen.value = true
}

async function confirmDelete(): Promise<void> {
  deleting.value = true
  const rowIds = deleteIds.value.map(String)
  try {
    // Row-level pending : on grise les lignes ciblées + spinner pendant
    // que la suppression remonte, plutôt que de skeleton tout le tableau.
    // L'utilisateur voit visuellement quelles lignes vont disparaître.
    await pending.withRowPending(rowIds, async () => {
      if (deleteIds.value.length === 1) {
        await deleteProduct(deleteIds.value[0]!)
      } else {
        await deleteProducts(deleteIds.value)
      }
    })
    toasts.success(
      `${deleteIds.value.length} produit${deleteIds.value.length > 1 ? 's' : ''} supprimé${deleteIds.value.length > 1 ? 's' : ''}`,
    )
    deleteModalOpen.value = false
    drawerOpen.value = false
    selectionIds.value = []
    await list.refetch()
  } catch (err) {
    toasts.error((err as Error).message)
  } finally {
    deleting.value = false
  }
}

// ---------------------------------------------------------------------------
// Bulk action bar — sélection multiple via les checkboxes.
// ---------------------------------------------------------------------------

const selectionIds = ref<number[]>([])
const cellSelectionCount = ref(0)
const bulkStatusModalOpen = ref(false)
const bulkUpdating = ref(false)

function onSelectionChange(payload: unknown): void {
  // L'event grid envoie un SelectionModel (`{ selectedIds: Set<...>, … }`).
  // On extrait le Set en array de number pour les appels API.
  const sel = payload as { selectedIds?: ReadonlySet<unknown> } | undefined
  if (sel?.selectedIds) {
    selectionIds.value = Array.from(sel.selectedIds, Number).filter(
      (n): n is number => !Number.isNaN(n),
    )
  } else {
    selectionIds.value = []
  }
}

function onCellSelectionChange(payload: unknown): void {
  const ranges = (payload as { ranges?: unknown[] } | undefined)?.ranges
  cellSelectionCount.value = Array.isArray(ranges) ? ranges.length : 0
}

function onBulkExport(): void {
  // L'API publique `exportCsv` du grid n'a pas (encore) de filtre par
  // sélection — elle exporte les `filteredRows` courantes. On délègue
  // donc avec le nom de fichier qui rappelle la sélection ; un raffinement
  // futur ajouterait un opt `scope: 'selection'` côté grid.
  gridRef.value?.exportCsv?.({ filename: 'catalogue-selection.csv' })
  toasts.success(
    `Export généré (${selectionIds.value.length} ligne${selectionIds.value.length > 1 ? 's' : ''} sélectionnée${selectionIds.value.length > 1 ? 's' : ''})`,
  )
}

function onBulkEditStatus(): void {
  if (selectionIds.value.length === 0) return
  bulkStatusModalOpen.value = true
}

async function confirmBulkStatus(status: LMProduct['status']): Promise<void> {
  bulkUpdating.value = true
  // Cell-level pending sur la colonne `status` pour chaque row sélectionnée
  // — pas row-level, parce qu'un seul champ change. L'utilisateur voit
  // un shimmer aligné dans la colonne État pendant la mise à jour.
  const cells = selectionIds.value.map((id) => ({
    rowId: String(id),
    field: 'status',
  }))
  try {
    await pending.withCellsPending(cells, () =>
      updateProducts(selectionIds.value, { status }),
    )
    toasts.success(
      `Statut modifié pour ${selectionIds.value.length} produit${selectionIds.value.length > 1 ? 's' : ''}`,
    )
    bulkStatusModalOpen.value = false
    await list.refetch()
  } catch (err) {
    toasts.error((err as Error).message)
  } finally {
    bulkUpdating.value = false
  }
}

function onBulkDelete(): void {
  askDelete([...selectionIds.value])
}

function onBulkClear(): void {
  gridRef.value?.clearSelection?.()
  selectionIds.value = []
}

// ---------------------------------------------------------------------------
// Actions toolbar — import CSV reste un placeholder (out of scope demo).
// ---------------------------------------------------------------------------

function onImportCsv(): void {
  toasts.info('Drawer import CSV — out of scope pour la demo (placeholder)')
}

function retryFetch(): void {
  void list.refetch()
}
</script>

<template>
  <section class="demo-page">
    <!-- Onglets principaux — Démo / Source code. Sticky en haut pour
         rester accessible quand on scrolle dans la vue code. -->
    <MTabs v-model="activeTab" :tabs="TABS" class="demo-page__tabs" />

    <!-- Vue 1 — la démo complète (grid + drawers + bulk action bar). -->
    <template v-if="activeTab === 0">
      <MrxGrid ref="gridRef" class="demo-page__grid" :columns="columns" :rows="list.rows.value"
        :row-id="(row) => String((row as LMProduct).id)" :total-count="list.total.value" :pagination="paginationConfig"
        :virtual-columns="true" :multi-sort="false" :height="640" :loading="list.loading.value"
        :pending-cells="pendingCells" :pending-row-ids="pendingRowIds" :error="list.error.value" selectable
        selection-bar-compact expandable :filter-mode="'server'" v-model:filter-model="list.filterModel.value"
        :density="density" :hidden-fields="hiddenFields" :column-order="columnOrder" :group-fields="groupFields"
        :fullscreen="fullscreen" @page-change="list.onPageChange" @cell-edit="onCellEdit"
        @filter-change="list.onFilterChange" @fill="onFill" @update:selection="onSelectionChange"
        @cell-selection-change="onCellSelectionChange">
        <template #toolbar>
          <ToolbarActions :grid="gridRef" :columns="columns" :search="list.searchInput.value" :fullscreen="fullscreen"
            :density="density" :hidden-fields="hiddenFields" :column-order="columnOrder" :active-groups="activeGroups"
            :filter-model="list.filterModel.value" @update:search="onSearch" @update:fullscreen="fullscreen = $event"
            @update:density="density = $event" @update:hidden-fields="hiddenFields = $event"
            @update:column-order="columnOrder = $event" @update:active-groups="activeGroups = $event"
            @update:filter-model="list.filterModel.value = $event" @new-product="onNewProduct"
            @import-csv="onImportCsv" />
        </template>

        <!-- Slot #edit-brand — éditeur custom MCombobox Mozaic. Le grid
           bascule en mode édition au double-clic / Enter ; ce slot
           remplace l'editor par défaut. Le scope expose `updateValue`
           pour pusher le draft, `commit('down')` pour valider, et
           `cancel()` pour Escape. `cellEditorOptions` côté ColumnDef
           fournit la liste des marques au composant. -->
        <template #edit-brand="editProps">
          <BrandComboEditor :field="editProps.field" :row-index="editProps.rowIndex" :column="editProps.column"
            :edit-value="editProps.editValue" :update-value="editProps.updateValue" :commit="editProps.commit" />
        </template>


        <!-- Empty state custom — affiché quand les filtres écrasent tout. -->
        <template #empty="{ hasFilters, clearFilters }">
          <div class="demo-page__empty">
            <p v-if="hasFilters">
              Aucun produit ne correspond à tes filtres.
            </p>
            <p v-else>Le catalogue est vide.</p>
            <button v-if="hasFilters" type="button" class="demo-page__empty-btn" @click="clearFilters">
              Effacer les filtres
            </button>
          </div>
        </template>

        <!-- Slot #error — affiché en cas d'erreur de fetch (2 % aléatoire). -->
        <template #error="{ error, retry }">
          <div class="demo-page__error">
            <p>{{ error.message }}</p>
            <button type="button" class="demo-page__error-btn" @click="retry ?? retryFetch">
              Réessayer
            </button>
          </div>
        </template>

        <!-- Slot #expand-row — drill-down inline. Click chevron pour
           déplier, voir la fiche du produit + mini grid des mouvements
           de stock. Le bouton "Éditer" ouvre `ProductDrawer` en mode
           édition. -->
        <template #expand-row="{ row }">
          <ProductDetailExpand :product="row as LMProduct" @edit="onEditProduct(row as LMProduct)" />
        </template>
      </MrxGrid>

      <!-- Drawer création / édition produit. -->
      <ProductDrawer v-model:open="drawerOpen" :product="drawerProduct" @created="onProductCreated"
        @updated="onProductUpdated" @delete="(id) => askDelete([id])" />

      <!-- Modal de confirmation suppression (single ou bulk). -->
      <DeleteConfirmModal v-model:open="deleteModalOpen" :count="deleteIds.length" :loading="deleting"
        @confirm="confirmDelete" />

      <!-- Modal modification statut bulk. -->
      <BulkStatusModal v-model:open="bulkStatusModalOpen" :count="selectionIds.length" :loading="bulkUpdating"
        @confirm="confirmBulkStatus" />

      <!-- Barre flottante d'actions bulk — apparait dès qu'il y a sélection. -->
      <BulkActionBar :row-count="selectionIds.length" :cell-count="cellSelectionCount" @export="onBulkExport"
        @edit-status="onBulkEditStatus" @delete="onBulkDelete" @clear="onBulkClear" />
    </template>

    <!-- Vue 2 — Tutoriel pas-à-pas. -->
    <ShowCodePanel v-else />
  </section>
</template>

<style scoped lang="scss">
.demo-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  flex: 1;
}

// Onglets principaux — un peu plus larges que par défaut pour bien
// séparer les deux vues. La couleur accent vient du token Mozaic.
.demo-page__tabs {
  flex-shrink: 0;
}


.demo-page__empty,
.demo-page__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  color: var(--color-text-secondary, #64748b);
}

.demo-page__empty-btn,
.demo-page__error-btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border-primary, #e2e8f0);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
}
</style>
