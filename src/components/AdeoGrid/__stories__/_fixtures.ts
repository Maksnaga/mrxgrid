/**
 * Shared story fixtures.
 *
 * Three brand-flavoured datasets:
 *   - leroymerlin → home-improvement products (default)
 *   - adeo       → corporate ops dashboard rows
 *   - bricocenter→ store inventory tickets
 *
 * Each dataset exposes:
 *   - columns:   ColumnDef[] tuned to the data
 *   - rows:      a small (~20 rows) deterministic sample for fast snapshots
 *   - large(n):  generator producing n synthetic rows for virtual-scroll demos
 */

import type { ColumnDef, RowData } from '../types'

// ---------------------------------------------------------------------------
// Leroy Merlin — home-improvement products (DEFAULT)
// ---------------------------------------------------------------------------

export interface LMProduct extends RowData {
  id: number
  sku: string
  name: string
  category: string
  brand: string
  price: number
  stock: number
  status: 'in-stock' | 'low' | 'out' | 'preorder'
  rating: number
  energyClass: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  promo: boolean
  store: string
  updatedAt: string
}

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
] as const

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
] as const

const LM_STORES = [
  'Lille Englos',
  'Paris Belleville',
  'Lyon Bron',
  'Marseille Plan-de-Campagne',
  'Bordeaux Pessac',
  'Strasbourg Mundolsheim',
] as const

const LM_PRODUCT_NAMES: Record<(typeof LM_CATEGORIES)[number], string[]> = {
  Plomberie: [
    'Mitigeur évier',
    'Robinet thermostatique',
    'Joint silicone',
    'Tuyau PER 16mm',
    'Siphon évier inox',
  ],
  Électricité: [
    'Disjoncteur 16A',
    'Câble HO7VU 2.5mm',
    'Interrupteur va-et-vient',
    'Tableau électrique 13 modules',
    'Spot LED encastrable',
  ],
  Outillage: [
    'Perceuse-visseuse 18V',
    'Scie circulaire 1200W',
    'Niveau à bulle 60cm',
    'Marteau 500g',
    'Mètre ruban 5m',
  ],
  Peinture: [
    'Peinture mur blanc 10L',
    'Rouleau anti-goutte',
    'Pinceau plat 50mm',
    'Bâche de protection',
    'Sous-couche universelle',
  ],
  Jardin: [
    'Tondeuse électrique',
    'Sécateur ergonomique',
    "Tuyau d'arrosage 25m",
    'Salon de jardin 6 places',
    'Barbecue à gaz',
  ],
  'Salle de bain': [
    'Cabine de douche 80x80',
    'Vasque à poser blanche',
    'Miroir LED 60cm',
    'Sèche-serviettes électrique',
    'Receveur extra-plat',
  ],
  Cuisine: [
    'Plan de travail chêne 250cm',
    'Hotte aspirante 60cm',
    'Évier inox 1 bac',
    'Crédence verre',
    'Robinet mitigeur cuisine',
  ],
  Quincaillerie: [
    'Lot vis Torx 200pcs',
    'Cadenas haute sécurité',
    'Charnière invisible',
    'Poignée de meuble inox',
    'Boîte rangement clous',
  ],
  Sols: [
    'Parquet stratifié chêne',
    'Carrelage 60x60 gris',
    'Plinthe MDF blanc',
    'Sous-couche acoustique',
    'Lame PVC clipsable',
  ],
  Chauffage: [
    'Radiateur électrique 1500W',
    'Poêle à bois 8kW',
    'Convecteur soufflant',
    'Climatiseur mobile',
    'Thermostat connecté',
  ],
}

let _seed = 0
function rand(min: number, max: number) {
  _seed = (_seed * 9301 + 49297) % 233280
  return min + (_seed / 233280) * (max - min)
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand(0, arr.length))]!
}

function makeLMProduct(i: number): LMProduct {
  const category = pick(LM_CATEGORIES)
  const name = pick(LM_PRODUCT_NAMES[category])
  const stock = Math.floor(rand(0, 200))
  const status: LMProduct['status'] =
    stock === 0 ? 'out' : stock < 10 ? 'low' : i % 17 === 0 ? 'preorder' : 'in-stock'
  return {
    id: i + 1,
    sku: `LM-${String(i + 1).padStart(6, '0')}`,
    name: `${name} #${i + 1}`,
    category,
    brand: pick(LM_BRANDS),
    price: Math.round(rand(5, 1499) * 100) / 100,
    stock,
    status,
    rating: Math.round(rand(1, 5) * 10) / 10,
    energyClass: (['A', 'A', 'B', 'B', 'C', 'D', 'E', 'F', 'G'][Math.floor(rand(0, 9))] ??
      'A') as LMProduct['energyClass'],
    promo: i % 5 === 0,
    store: pick(LM_STORES),
    updatedAt: new Date(2025, Math.floor(rand(0, 12)), Math.floor(rand(1, 28)) + 1)
      .toISOString()
      .slice(0, 10),
  }
}

export function generateLMProducts(count: number): LMProduct[] {
  _seed = 1
  return Array.from({ length: count }, (_, i) => makeLMProduct(i))
}

export const lmProducts: LMProduct[] = generateLMProducts(20)

const eur = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
})

// Exported as `ColumnDef[]` (default `RowData`) rather than `ColumnDef<LMProduct>[]`
// so the array is freely assignable to `MrxGrid`'s `columns` prop. `ColumnDef<T>`
// is contravariant in `T` (callbacks like `valueGetter`/`sortComparator` take
// `row: T`), so a narrower `ColumnDef<LMProduct>[]` is NOT assignable to
// `ColumnDef<RowData>[]`. Consumers that need the narrower type (e.g. typed
// `filterPredicate`) can re-cast locally — the contravariant direction
// (`ColumnDef<RowData>` → `ColumnDef<LMProduct>`) is allowed by TS.
export const lmColumns: ColumnDef[] = [
  {
    field: 'sku',
    headerName: 'Référence',
    width: '120px',
    pinned: 'start',
    sortable: true,
    filterable: true,
    filterType: 'text',
  },
  {
    field: 'name',
    headerName: 'Produit',
    width: '260px',
    sortable: true,
    filterable: true,
    filterType: 'text',
    editable: true,
  },
  {
    field: 'category',
    headerName: 'Rayon',
    width: '160px',
    sortable: true,
    groupable: true,
    filterable: true,
    filterType: 'set',
    filterOptions: LM_CATEGORIES.map((c) => ({ value: c, label: c })),
  },
  {
    field: 'brand',
    headerName: 'Marque',
    width: '140px',
    sortable: true,
    groupable: true,
    filterable: true,
    filterType: 'text',
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
    valueFormatter: (v) => (typeof v === 'number' ? eur.format(v) : ''),
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
    cellValidator: (v) => (typeof v === 'number' && v >= 0 ? true : 'Stock négatif interdit'),
    cellClass: 'mrx-cell-num',
  },
  {
    field: 'status',
    headerName: 'État',
    width: '120px',
    sortable: true,
    filterable: true,
    filterType: 'set',
    filterOptions: [
      { value: 'in-stock', label: 'En stock' },
      { value: 'low', label: 'Stock faible' },
      { value: 'out', label: 'Rupture' },
      { value: 'preorder', label: 'Précommande' },
    ],
    renderer: 'tag',
    rendererProps: {
      labelMap: {
        'in-stock': { label: 'En stock', appearance: 'success' },
        low: { label: 'Stock faible', appearance: 'warning' },
        out: { label: 'Rupture', appearance: 'danger' },
        preorder: { label: 'Précommande', appearance: 'info' },
      },
    },
  },
  {
    field: 'energyClass',
    headerName: 'Classe énergie',
    width: '130px',
    sortable: true,
    filterable: true,
    filterType: 'set',
    filterOptions: ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((v) => ({ value: v, label: v })),
  },
  {
    field: 'rating',
    headerName: 'Note',
    width: '90px',
    sortable: true,
    valueFormatter: (v) => (typeof v === 'number' ? `${v.toFixed(1)} ★` : ''),
  },
  {
    field: 'promo',
    headerName: 'Promo',
    width: '90px',
    sortable: true,
    filterable: true,
    filterType: 'boolean',
  },
  {
    field: 'store',
    headerName: 'Magasin',
    width: '180px',
    sortable: true,
    groupable: true,
    filterable: true,
    filterType: 'text',
    pinned: 'end',
  },
  {
    field: 'updatedAt',
    headerName: 'Maj',
    width: '110px',
    sortable: true,
    filterable: true,
    filterType: 'date',
  },
]

// ---------------------------------------------------------------------------
// Adeo — corporate ops dashboard
// ---------------------------------------------------------------------------

export interface AdeoOps extends RowData {
  id: number
  ticket: string
  team: string
  owner: string
  region: 'EMEA' | 'APAC' | 'AMER'
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  status: 'open' | 'in-progress' | 'blocked' | 'done'
  budget: number
  startDate: string
  dueDate: string
}

const ADEO_TEAMS = ['Platform', 'Data', 'Mobile', 'Web', 'Infra', 'Design System']
const ADEO_OWNERS = [
  'M. Dupont',
  'A. Martin',
  'L. Moreau',
  'S. Bernard',
  'C. Lefebvre',
  'J. Garcia',
]

export function generateAdeoOps(count: number): AdeoOps[] {
  _seed = 42
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(2025, Math.floor(rand(0, 12)), Math.floor(rand(1, 28)) + 1)
    const due = new Date(start.getTime() + rand(1, 60) * 86400000)
    return {
      id: i + 1,
      ticket: `OPS-${1000 + i}`,
      team: pick(ADEO_TEAMS),
      owner: pick(ADEO_OWNERS),
      region: pick(['EMEA', 'APAC', 'AMER'] as const),
      priority: pick(['P0', 'P1', 'P2', 'P3'] as const),
      status: pick(['open', 'in-progress', 'blocked', 'done'] as const),
      budget: Math.round(rand(2_000, 250_000)),
      startDate: start.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
    }
  })
}

export const adeoRows: AdeoOps[] = generateAdeoOps(20)

export const adeoColumns: ColumnDef[] = [
  {
    field: 'ticket',
    headerName: 'Ticket',
    width: '110px',
    pinned: 'start',
    sortable: true,
    filterable: true,
    filterType: 'text',
  },
  {
    field: 'team',
    headerName: 'Équipe',
    width: '160px',
    sortable: true,
    groupable: true,
    filterable: true,
    filterType: 'set',
    filterOptions: ADEO_TEAMS.map((v) => ({ value: v, label: v })),
  },
  {
    field: 'owner',
    headerName: 'Responsable',
    width: '160px',
    sortable: true,
    filterable: true,
    filterType: 'text',
  },
  {
    field: 'region',
    headerName: 'Région',
    width: '110px',
    sortable: true,
    groupable: true,
    filterable: true,
    filterType: 'set',
    filterOptions: ['EMEA', 'APAC', 'AMER'].map((v) => ({ value: v, label: v })),
  },
  {
    field: 'priority',
    headerName: 'Priorité',
    width: '110px',
    sortable: true,
    filterable: true,
    filterType: 'set',
    filterOptions: ['P0', 'P1', 'P2', 'P3'].map((v) => ({ value: v, label: v })),
    renderer: 'tag',
    rendererProps: {
      labelMap: {
        P0: { label: 'P0', appearance: 'danger' },
        P1: { label: 'P1', appearance: 'warning' },
        P2: { label: 'P2', appearance: 'info' },
        P3: { label: 'P3', appearance: 'neutral' },
      },
    },
  },
  {
    field: 'status',
    headerName: 'État',
    width: '130px',
    sortable: true,
    filterable: true,
    filterType: 'set',
    filterOptions: [
      { value: 'open', label: 'Ouvert' },
      { value: 'in-progress', label: 'En cours' },
      { value: 'blocked', label: 'Bloqué' },
      { value: 'done', label: 'Terminé' },
    ],
    renderer: 'tag',
    rendererProps: {
      labelMap: {
        open: { label: 'Ouvert', appearance: 'info' },
        'in-progress': { label: 'En cours', appearance: 'primary' },
        blocked: { label: 'Bloqué', appearance: 'danger' },
        done: { label: 'Terminé', appearance: 'success' },
      },
    },
  },
  {
    field: 'budget',
    headerName: 'Budget',
    width: '130px',
    sortable: true,
    filterable: true,
    filterType: 'number',
    editable: true,
    cellEditor: 'number',
    valueFormatter: (v) => (typeof v === 'number' ? eur.format(v) : ''),
    cellClass: 'mrx-cell-num',
  },
  {
    field: 'startDate',
    headerName: 'Début',
    width: '120px',
    sortable: true,
    filterable: true,
    filterType: 'date',
  },
  {
    field: 'dueDate',
    headerName: 'Échéance',
    width: '120px',
    sortable: true,
    filterable: true,
    filterType: 'date',
  },
]

// ---------------------------------------------------------------------------
// Bricocenter — store inventory snapshots
// ---------------------------------------------------------------------------

export interface BricoInventory extends RowData {
  id: number
  ean: string
  product: string
  warehouse: string
  shelf: string
  units: number
  lastInbound: string
  defective: number
  flag: 'normal' | 'reorder' | 'overstock'
}

const BRICO_WAREHOUSES = [
  'Roma Casilina',
  'Milano Sud',
  'Napoli Caivano',
  'Torino Nord',
  'Firenze Ovest',
]
const BRICO_PRODUCTS = [
  'Trapano percussione',
  'Cassetta utensili',
  'Avvitatore impulsi',
  'Mola angolare',
  'Sega circolare',
  'Pistola termica',
  'Smerigliatrice',
  'Cesoia elettrica',
  'Aspirapolvere bagnato',
  'Idropulitrice',
]

export function generateBricoInventory(count: number): BricoInventory[] {
  _seed = 99
  return Array.from({ length: count }, (_, i) => {
    const units = Math.floor(rand(0, 350))
    const flag: BricoInventory['flag'] =
      units < 25 ? 'reorder' : units > 250 ? 'overstock' : 'normal'
    return {
      id: i + 1,
      ean: `8${String(Math.floor(rand(1_000_000_000, 9_999_999_999)))}`,
      product: pick(BRICO_PRODUCTS),
      warehouse: pick(BRICO_WAREHOUSES),
      shelf: `${pick(['A', 'B', 'C', 'D', 'E'])}-${Math.floor(rand(1, 99)) + 1}`,
      units,
      lastInbound: new Date(2025, Math.floor(rand(0, 12)), Math.floor(rand(1, 28)) + 1)
        .toISOString()
        .slice(0, 10),
      defective: Math.floor(rand(0, 6)),
      flag,
    }
  })
}

export const bricoRows: BricoInventory[] = generateBricoInventory(20)

export const bricoColumns: ColumnDef[] = [
  {
    field: 'ean',
    headerName: 'EAN',
    width: '160px',
    pinned: 'start',
    sortable: true,
    filterable: true,
    filterType: 'text',
  },
  {
    field: 'product',
    headerName: 'Prodotto',
    width: '220px',
    sortable: true,
    filterable: true,
    filterType: 'text',
    editable: true,
  },
  {
    field: 'warehouse',
    headerName: 'Magazzino',
    width: '180px',
    sortable: true,
    groupable: true,
    filterable: true,
    filterType: 'set',
    filterOptions: BRICO_WAREHOUSES.map((v) => ({ value: v, label: v })),
  },
  {
    field: 'shelf',
    headerName: 'Scaffale',
    width: '110px',
    sortable: true,
    filterable: true,
    filterType: 'text',
  },
  {
    field: 'units',
    headerName: 'Unità',
    width: '100px',
    sortable: true,
    filterable: true,
    filterType: 'number',
    editable: true,
    cellEditor: 'number',
    cellClass: 'mrx-cell-num',
  },
  {
    field: 'defective',
    headerName: 'Difettosi',
    width: '110px',
    sortable: true,
    filterable: true,
    filterType: 'number',
    cellClass: 'mrx-cell-num',
  },
  {
    field: 'flag',
    headerName: 'Stato',
    width: '130px',
    sortable: true,
    filterable: true,
    filterType: 'set',
    filterOptions: [
      { value: 'normal', label: 'Normale' },
      { value: 'reorder', label: 'Riordino' },
      { value: 'overstock', label: 'Sovrastock' },
    ],
    renderer: 'tag',
    rendererProps: {
      labelMap: {
        normal: { label: 'Normale', appearance: 'success' },
        reorder: { label: 'Riordino', appearance: 'warning' },
        overstock: { label: 'Sovrastock', appearance: 'info' },
      },
    },
  },
  {
    field: 'lastInbound',
    headerName: 'Ultimo arrivo',
    width: '130px',
    sortable: true,
    filterable: true,
    filterType: 'date',
  },
]

// ---------------------------------------------------------------------------
// Tiny everyday helpers used across stories
// ---------------------------------------------------------------------------

export const datasets = {
  leroymerlin: { columns: lmColumns, rows: lmProducts, label: 'Leroy Merlin' },
  adeo: { columns: adeoColumns, rows: adeoRows, label: 'Adeo Ops' },
  bricocenter: { columns: bricoColumns, rows: bricoRows, label: 'Bricocenter' },
} as const

export type DatasetId = keyof typeof datasets
