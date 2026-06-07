/**
 * Génération programmatique des colonnes "stress-test" — porte le total
 * grid à 200 colonnes (10 base + 190 extras) avec mix de types réalistes :
 * ventes mensuelles, stocks par entrepôt, notes par magasin, statuts
 * techniques, dates jalons.
 *
 * Toutes les colonnes :
 *   - sont **éditables** (number / text / set) → demo "tout modifier" rapide
 *   - lisent via `valueGetter` qui résout : override utilisateur > défaut
 *     pseudo-aléatoire dérivé de `row.id` (déterministe, stable)
 *   - sortent du même hash `pseudoNumber` / `pick` que les extras existants
 *     pour rester cohérentes visuellement
 *
 * Pas de stockage mémoire pour les 190 × 100k = 19M cellules : tant que
 * l'utilisateur n'édite pas, la valeur est calculée à la volée.
 */

import type { ColumnDef } from '@/components/AdeoGrid'
import type { LMProduct } from '../mock/seed'
import { useStressOverrides } from '../composables/useStressOverrides'

// ---------------------------------------------------------------------------
// Hash + pickers déterministes (mêmes formules que celles inline dans
// DemoPage.vue pour cohérence visuelle).
// ---------------------------------------------------------------------------

function pseudoNumber(id: number, salt: number, max: number): number {
  const h = ((id * 2246822519) ^ (salt * 3266489917)) >>> 0
  return h % max
}

function pickFromPool<T>(pool: readonly T[], id: number, salt: number): T {
  const h = ((id * 2654435761) ^ (salt * 16807)) >>> 0
  return pool[h % pool.length]!
}

function isoDateFromId(id: number, salt: number, spreadDays: number): string {
  const days = pseudoNumber(id, salt, spreadDays)
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Pools métier pour des labels variés
// ---------------------------------------------------------------------------

const QUALITY_LABELS = ['Conforme', 'À vérifier', 'Non conforme', 'En audit', 'OK']
const SUPPLIER_STATUSES = ['Préféré', 'Standard', 'Surveillé', 'En probation']
const CONTRACT_TYPES = ['Annuel', 'Saisonnier', 'Spot', 'Cadre']
const CERTIFICATIONS = ['ISO 9001', 'FSC', 'CE', 'NF', 'Aucune', 'PEFC']
const SHELF_LIFE = ['<6 mois', '6-12 mois', '1-2 ans', '2-5 ans', '5+ ans']

const WAREHOUSES = [
  'Lille N1',
  'Lille N2',
  'Lyon Sud',
  'Marseille Est',
  'Bordeaux O',
  'Paris Centre',
  'Strasbourg N',
  'Toulouse',
  'Nantes',
  'Rennes',
  'Nice',
  'Lille Plat.',
]

const STORE_LABELS = [
  'Englos',
  'Belleville',
  'Bron',
  'Plan-de-Cpgne',
  'Pessac',
  'Mundolsheim',
  'Toulouse',
  'Nantes Atl.',
  'Rennes Pacé',
  'Nice O.',
]

const TECHNICIANS = [
  'S. Martin',
  'L. Bernard',
  'P. Dubois',
  'M. Robert',
  'C. Petit',
  'F. Durand',
  'A. Leroy',
  'J. Moreau',
  'N. Simon',
  'E. Laurent',
]

const MONTH_FR = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Jun',
  'Juil',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
]

// ---------------------------------------------------------------------------
// Builders — `makeNumberCol`, `makeTextCol`, `makeSetCol`, `makeDateCol`.
// Chaque builder retourne un ColumnDef éditable qui :
//   - lit via override si présent, sinon calcule depuis row.id
//   - applique le bon cellEditor / cellClass / valueFormatter
// ---------------------------------------------------------------------------

const overrides = useStressOverrides()

function makeNumberCol(
  field: string,
  headerName: string,
  salt: number,
  max: number,
  opts: { width?: string; formatter?: (v: number) => string; editable?: boolean } = {},
): ColumnDef {
  return {
    field,
    headerName,
    width: opts.width ?? '110px',
    sortable: true,
    editable: opts.editable ?? true,
    cellEditor: 'number',
    cellClass: 'mrx-cell-num',
    valueGetter: (row) => {
      const over = overrides.getOverride((row as LMProduct).id, field)
      if (over !== undefined) return over
      return pseudoNumber((row as LMProduct).id, salt, max)
    },
    valueFormatter: opts.formatter
      ? (v) => (typeof v === 'number' ? opts.formatter!(v) : '')
      : undefined,
  }
}

function makeTextCol(
  field: string,
  headerName: string,
  salt: number,
  pool: readonly string[],
  opts: { width?: string; filter?: boolean } = {},
): ColumnDef {
  return {
    field,
    headerName,
    width: opts.width ?? '140px',
    sortable: true,
    editable: true,
    filterable: opts.filter ?? false,
    filterType: opts.filter ? 'text' : undefined,
    valueGetter: (row) => {
      const over = overrides.getOverride((row as LMProduct).id, field)
      if (over !== undefined) return over
      return pickFromPool(pool, (row as LMProduct).id, salt)
    },
  }
}

function makeSetCol(
  field: string,
  headerName: string,
  salt: number,
  pool: readonly string[],
  opts: { width?: string } = {},
): ColumnDef {
  return {
    field,
    headerName,
    width: opts.width ?? '130px',
    sortable: true,
    editable: true,
    filterable: true,
    filterType: 'set',
    filterOptions: pool.map((v) => ({ value: v, label: v })),
    valueGetter: (row) => {
      const over = overrides.getOverride((row as LMProduct).id, field)
      if (over !== undefined) return over
      return pickFromPool(pool, (row as LMProduct).id, salt)
    },
  }
}

function makeDateCol(
  field: string,
  headerName: string,
  salt: number,
  spreadDays: number,
  opts: { width?: string } = {},
): ColumnDef {
  return {
    field,
    headerName,
    width: opts.width ?? '160px',
    sortable: true,
    editable: true,
    cellEditor: 'date',
    filterable: true,
    filterType: 'date',
    valueGetter: (row) => {
      const over = overrides.getOverride((row as LMProduct).id, field)
      if (over !== undefined) return over
      return isoDateFromId((row as LMProduct).id, salt, spreadDays)
    },
  }
}

const eurFmt = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)
const pctFmt = (v: number) => `${v}%`

// ---------------------------------------------------------------------------
// Batches — 190 colonnes au total (en plus des 10 base de DemoPage)
//
//   24 × ventes mensuelles 2023+2024     numeric editable (€)
//   24 × marges mensuelles 2023+2024     numeric editable (%)
//   12 × stocks par entrepôt              numeric editable (units)
//   10 × notes par magasin                numeric editable (★)
//   12 × dernière vente par store         date editable
//   10 × technicien attribué              text editable
//    8 × type contrat fournisseur         set editable
//    8 × certification produit            set editable
//    8 × durée de vie                     set editable
//    8 × qualité contrôle                 set editable
//   10 × commentaire libre                text editable
//   12 × jalons techniques               date editable
//   12 × bonus commerciaux               numeric editable (€)
//   12 × taux retour                      numeric editable (%)
//   10 × statut fournisseur              set editable
//   20 × indicateur KPI N                 numeric editable
//
// Total = 24+24+12+10+12+10+8+8+8+8+10+12+12+12+10+20 = 200
// ❗ on retire 10 pour rester à 190 (les 10 base de DemoPage complètent à 200)
// Choisis : -10 sur "indicateur KPI" → reste 10 KPI.
// ---------------------------------------------------------------------------

const cols: ColumnDef[] = []

// 24 ventes mensuelles 2023 + 2024
for (let year = 2023; year <= 2024; year++) {
  for (let m = 0; m < 12; m++) {
    cols.push(
      makeNumberCol(
        `sales_${year}_${String(m + 1).padStart(2, '0')}`,
        `Ventes ${MONTH_FR[m]} ${year}`,
        1000 + (year - 2023) * 12 + m,
        15000,
        { width: '120px', formatter: eurFmt },
      ),
    )
  }
}

// 24 marges mensuelles 2023 + 2024
for (let year = 2023; year <= 2024; year++) {
  for (let m = 0; m < 12; m++) {
    cols.push(
      makeNumberCol(
        `margin_${year}_${String(m + 1).padStart(2, '0')}`,
        `Marge ${MONTH_FR[m]} ${year}`,
        2000 + (year - 2023) * 12 + m,
        45,
        { width: '110px', formatter: pctFmt },
      ),
    )
  }
}

// 12 stocks par entrepôt
WAREHOUSES.forEach((w, i) => {
  cols.push(
    makeNumberCol(`stock_wh_${i}`, `Stock ${w}`, 3000 + i, 500, {
      width: '120px',
    }),
  )
})

// 10 notes par magasin
STORE_LABELS.forEach((s, i) => {
  cols.push(
    makeNumberCol(`rating_store_${i}`, `Note ${s}`, 4000 + i, 50, {
      width: '110px',
      formatter: (v) => `${(v / 10).toFixed(1)} ★`,
    }),
  )
})

// 12 dernière vente par store
STORE_LABELS.slice(0, 12).forEach((s, i) => {
  cols.push(
    makeDateCol(`lastsale_store_${i}`, `Dern. vente ${s}`, 5000 + i, 365),
  )
})
// Compense le slice(0, 12) avec 2 dates supplémentaires si STORE_LABELS < 12
while (cols.filter((c) => c.field.startsWith('lastsale_')).length < 12) {
  const i = cols.filter((c) => c.field.startsWith('lastsale_')).length
  cols.push(
    makeDateCol(
      `lastsale_extra_${i}`,
      `Dern. vente n°${i + 1}`,
      5100 + i,
      365,
    ),
  )
}

// 10 technicien attribué
for (let i = 0; i < 10; i++) {
  cols.push(
    makeTextCol(`technician_${i}`, `Technicien ${i + 1}`, 6000 + i, TECHNICIANS, {
      width: '150px',
      filter: false,
    }),
  )
}

// 8 type contrat fournisseur
for (let i = 0; i < 8; i++) {
  cols.push(
    makeSetCol(`contract_${i}`, `Contrat ${i + 1}`, 7000 + i, CONTRACT_TYPES, {
      width: '110px',
    }),
  )
}

// 8 certification produit
for (let i = 0; i < 8; i++) {
  cols.push(
    makeSetCol(`cert_${i}`, `Cert. ${i + 1}`, 8000 + i, CERTIFICATIONS, {
      width: '110px',
    }),
  )
}

// 8 durée de vie
for (let i = 0; i < 8; i++) {
  cols.push(
    makeSetCol(`shelflife_${i}`, `Durée vie ${i + 1}`, 9000 + i, SHELF_LIFE, {
      width: '120px',
    }),
  )
}

// 8 qualité contrôle
for (let i = 0; i < 8; i++) {
  cols.push(
    makeSetCol(`quality_${i}`, `Qualité ${i + 1}`, 10_000 + i, QUALITY_LABELS, {
      width: '120px',
    }),
  )
}

// 10 commentaire libre
const COMMENT_POOL = [
  'OK',
  'À vérifier',
  'Voir avec fournisseur',
  'En cours',
  'Validé',
  'Rejeté',
  'Stand-by',
  'Prio',
  'Doublon',
  'Archive',
]
for (let i = 0; i < 10; i++) {
  cols.push(
    makeTextCol(`note_${i}`, `Note ${i + 1}`, 11_000 + i, COMMENT_POOL, {
      width: '140px',
      filter: false,
    }),
  )
}

// 12 jalons techniques (dates)
const MILESTONE_LABELS = [
  'Concept',
  'Design',
  'Proto',
  'Pilote',
  'Lancement',
  'V2',
  'Audit',
  'Renewal',
  'Phase out',
  'EOL',
  'Inventaire',
  'Migration',
]
for (let i = 0; i < 12; i++) {
  cols.push(
    makeDateCol(
      `milestone_${i}`,
      MILESTONE_LABELS[i] ?? `Jalon ${i + 1}`,
      12_000 + i,
      730,
    ),
  )
}

// 12 bonus commerciaux (€)
for (let i = 0; i < 12; i++) {
  cols.push(
    makeNumberCol(`bonus_${i}`, `Bonus ${i + 1}`, 13_000 + i, 5000, {
      width: '110px',
      formatter: eurFmt,
    }),
  )
}

// 12 taux retour (%)
for (let i = 0; i < 12; i++) {
  cols.push(
    makeNumberCol(`returnrate_${i}`, `Retour ${i + 1}`, 14_000 + i, 20, {
      width: '110px',
      formatter: pctFmt,
    }),
  )
}

// 10 statut fournisseur
for (let i = 0; i < 10; i++) {
  cols.push(
    makeSetCol(
      `supstatus_${i}`,
      `Sup. ${i + 1}`,
      15_000 + i,
      SUPPLIER_STATUSES,
      { width: '120px' },
    ),
  )
}

// 10 KPI génériques (numeric)
for (let i = 0; i < 10; i++) {
  cols.push(
    makeNumberCol(`kpi_${i}`, `KPI ${i + 1}`, 16_000 + i, 10_000, {
      width: '100px',
    }),
  )
}

/**
 * 190 colonnes "stress" prêtes à être splatées dans le `columns` du grid.
 * Total visé : 10 (base DemoPage) + 190 = 200.
 */
export const stressColumns: ColumnDef[] = cols

