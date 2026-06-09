<script setup lang="ts">
/**
 * Onglet "Adeo PIM" — datagrid alimentée par un export PIM réel
 * (424 produits INSPIRE × 58 colonnes). Use-case "vraie largeur PIM
 * Adeo" : c'est l'opposé du tab Démo qui simule un catalogue Leroy
 * Merlin. Ici les valeurs sont brutes, certaines colonnes vides, le
 * but est de montrer comment le grid encaisse un schéma wide
 * non-curé (descriptions multi-lignes, identifiants ADEO key,
 * pourcentages recyclé, dimensions kg/cm, certifs ICS, etc.).
 *
 * Volontairement autonome — aucune dépendance au mock API LM /
 * `useProductList` / drawers / pending mutations. Les éditions sont
 * locales (in-memory) avec undo/redo via l'historique built-in du
 * grid.
 */

import { computed, markRaw, ref, h, defineComponent, type PropType } from 'vue'
import { AdeoGrid, type ColumnDef, type CellEditEvent } from '@/components/AdeoGrid'
import { MTag, MTextInput } from '@mozaic-ds/vue'
import { Search24 } from '@mozaic-ds/icons-vue'
import productsData from '../mock/adeo-products.json'

// ---------------------------------------------------------------------------
// Types — dérivés du JSON parsé.
// ---------------------------------------------------------------------------

interface AdeoFieldMeta {
  key: string
  label: string
}

interface AdeoProductsPayload {
  meta: { fields: AdeoFieldMeta[]; count: number }
  products: AdeoProduct[]
}

// Le JSON contient ~58 champs au total — on type partiellement les plus
// utilisés et on laisse `[k: string]: unknown` pour la longue queue.
interface AdeoProduct {
  id: number
  adeoKey: string
  productBrand: string | null
  typeOfProduct: string | null
  collection: string | null
  colour: string | null
  netWeight: number | null
  manufactureEuropeanUnion: boolean | null
  wetRoomCompatibility: boolean | null
  fireproof: boolean | null
  containsWood: boolean | null
  [key: string]: unknown
}

const payload = productsData as AdeoProductsPayload

// ---------------------------------------------------------------------------
// Renderer custom : badge Yes / No avec couleur selon valeur.
// Utilisé sur les champs booléens (`manufactureEuropeanUnion`, `fireproof`,
// etc.). Le renderer `tag` built-in de la lib affiche `MTag` en
// `informative` quelle que soit la valeur — pas assez expressif pour un
// PIM où "is wet room compatible = no" doit visuellement contraster avec
// "yes". Trois états : true → success, false → danger, null → tiret.
// ---------------------------------------------------------------------------

// Normalise tout ce que peut nous renvoyer le pipeline d'édition (le
// select editor de Mozaic émet la valeur en string `"true"` / `"false"`,
// le seed JSON envoie un vrai boolean) vers `true` / `false` / `null`.
// Sans cette tolérance, après une édition la cellule passe sur la
// branche `—` même quand l'utilisateur vient de choisir "No".
function coerceYesNo(v: unknown): true | false | null {
  if (v === true || v === 'true' || v === 'Yes' || v === 'yes' || v === 1 || v === '1') return true
  if (v === false || v === 'false' || v === 'No' || v === 'no' || v === 0 || v === '0') return false
  return null
}

const YesNoRenderer = markRaw(
  defineComponent({
    name: 'AdeoYesNoRenderer',
    props: { value: { type: null as unknown as PropType<unknown>, default: null } },
    setup(props) {
      return () => {
        const v = coerceYesNo(props.value)
        if (v === true) return h(MTag, { type: 'success', size: 's', label: 'Yes' })
        if (v === false) return h(MTag, { type: 'danger', size: 's', label: 'No' })
        return h(
          'span',
          { style: 'color: var(--color-text-secondary, #94a3b8)' },
          '—',
        )
      }
    },
  }),
)

// ---------------------------------------------------------------------------
// Formatters — petites fonctions pures, branchées via `valueFormatter`.
// ---------------------------------------------------------------------------

const fmtKg = (v: unknown): string =>
  typeof v === 'number' ? `${v.toLocaleString('fr-FR')} kg` : v == null ? '' : String(v)

const fmtCm = (v: unknown): string =>
  typeof v === 'number' ? `${v.toLocaleString('fr-FR')} cm` : v == null ? '' : String(v)

const fmtM = (v: unknown): string =>
  typeof v === 'number' ? `${v.toLocaleString('fr-FR')} m` : v == null ? '' : String(v)

const fmtPercent = (v: unknown): string =>
  typeof v === 'number' ? `${v} %` : v == null ? '' : String(v)

const fmtYears = (v: unknown): string =>
  typeof v === 'number' ? `${v} an${v > 1 ? 's' : ''}` : v == null ? '' : String(v)

const fmtInteger = (v: unknown): string =>
  typeof v === 'number' ? v.toLocaleString('fr-FR') : v == null ? '' : String(v)

// ---------------------------------------------------------------------------
// Mapping `fieldKey` → hint type. Détermine le `cellEditor`,
// `valueFormatter`, `renderer`, alignement, largeur par défaut. Centralisé
// ici pour éviter la duplication entre les ~58 ColumnDef.
// ---------------------------------------------------------------------------

type ColumnHint =
  | 'identifier'
  | 'brand'
  | 'enum'
  | 'longText'
  | 'boolean'
  | 'kg'
  | 'cm'
  | 'meters'
  | 'percent'
  | 'years'
  | 'integer'
  | 'address'
  | 'text'

const HINTS: Record<string, ColumnHint> = {
  // Identifiers (read-only, pinned)
  adeoKey: 'identifier',
  administrativeDesignation: 'text',
  activeGtins: 'identifier',
  supplierReference: 'identifier',

  // Brand / classification
  productBrand: 'brand',
  typeOfProduct: 'enum',
  collection: 'enum',
  structure: 'enum',
  theme: 'enum',
  typeOfEffect: 'enum',
  patternMatch: 'enum',
  gluingMethode: 'enum',
  wallpaperBackMaterial: 'enum',
  wallpaperFrontMaterial: 'enum',
  maintenanceOfTheWallpaper: 'enum',
  typeOfAdhesive: 'enum',
  resistanceToSunExposure: 'enum',
  typeOfMarkedExpirationDate: 'enum',
  typeOfTraceability: 'enum',
  materialsOfThePrimaryPackagingOfTheProduct: 'enum',
  productRecycledContentEvidence: 'enum',
  mainMaterialOnTheTotalMassOfTheProduct: 'enum',
  appearance: 'enum',
  commonNameOfWoodSpecies: 'enum',
  woodCertification: 'enum',
  scientificNameOfTheWoodSpecies: 'enum',
  dispatchCountryCode: 'enum',
  originCountryCode: 'enum',
  packagingType: 'enum',
  adrPackagingGroup: 'enum',
  adrRiskClass: 'enum',
  manufacturingSiteOfTheProductIsSociallyCertifiedOrAudited: 'enum',
  manufacturingSiteOfTheProductIsEnvironmentallyCertifiedOrAudited: 'enum',
  colour: 'text',
  customsNomenclature: 'longText',

  // Booleans
  manufactureEuropeanUnion: 'boolean',
  wetRoomCompatibility: 'boolean',
  fireproof: 'boolean',
  containsWood: 'boolean',
  variableMeasureProduct: 'boolean',

  // Numeric with units
  netWeight: 'kg',
  packagedProductWeight: 'kg',
  woodWeightInTheProduct: 'kg',
  packagedProductWidth: 'cm',
  packagedProductHeight: 'cm',
  packagedProductDepth: 'cm',
  rollerLength: 'meters',
  minimumPercentageOfRecycledContentInTheProduct: 'percent',
  percentageOfRecycledContentIntoTheMainMaterialOfTheProduct: 'percent',
  manufacturersCommercialWarranty: 'years',
  numberOfManufacturingSitesMakingTheProducts: 'integer',
  customsCoefficient: 'integer',

  // Address
  nameOfTheResponsibleEconomicOperatorOfTheProductInEu: 'address',
  streetNameAndNumberOfTheResponsibleEconomicOperatorOfTheProductInEu: 'address',
  postalCodeOfTheResponsibleEconomicOperatorOfTheProductInEu: 'address',
  countryOfTheResponsibleEconomicOperatorOfTheProductInEu: 'address',
  emailAddressOrContactFormOfTheResponsibleEconomicOperatorOfTheProductInEu: 'address',

  // Long text
  description: 'longText',
}

// ---------------------------------------------------------------------------
// Construction des ColumnDef à partir des metas du JSON + hints.
// L'ordre du JSON est conservé (= ordre du CSV original).
// ---------------------------------------------------------------------------

const HINT_DEFAULT_WIDTH: Record<ColumnHint, string> = {
  identifier: '140px',
  brand: '120px',
  enum: '150px',
  longText: '280px',
  boolean: '90px',
  kg: '110px',
  cm: '110px',
  meters: '110px',
  percent: '100px',
  years: '90px',
  integer: '120px',
  address: '200px',
  text: '160px',
}

function buildColumn(meta: AdeoFieldMeta): ColumnDef<AdeoProduct> {
  const hint: ColumnHint = HINTS[meta.key] ?? 'text'
  const col: ColumnDef<AdeoProduct> = {
    field: meta.key,
    headerName: meta.label,
    width: HINT_DEFAULT_WIDTH[hint],
    sortable: true,
    filterable: true,
    groupable: hint === 'enum' || hint === 'boolean' || hint === 'brand',
    resizable: true,
    editable: hint !== 'identifier', // adeoKey / GTIN / supplierRef en read-only
  }

  // Pin de l'identifiant principal uniquement. Pinner aussi les autres
  // identifiers + le brand colonniserait 4 cols à gauche et écraserait
  // la zone center sur les premiers paints — on garde la sticky column
  // sur adeoKey seul (= row header naturel).
  if (meta.key === 'adeoKey') col.pinned = 'start'

  switch (hint) {
    case 'boolean':
      col.renderer = YesNoRenderer
      col.cellEditor = 'select'
      col.cellEditorOptions = [
        { value: true, label: 'Yes' },
        { value: false, label: 'No' },
        { value: null, label: '—' },
      ]
      col.filterType = 'boolean'
      break
    case 'brand':
      col.renderer = 'tag'
      break
    case 'enum':
      col.renderer = 'tag'
      break
    case 'kg':
      col.valueFormatter = fmtKg
      col.cellEditor = 'number'
      col.filterType = 'number'
      break
    case 'cm':
      col.valueFormatter = fmtCm
      col.cellEditor = 'number'
      col.filterType = 'number'
      break
    case 'meters':
      col.valueFormatter = fmtM
      col.cellEditor = 'number'
      col.filterType = 'number'
      break
    case 'percent':
      col.valueFormatter = fmtPercent
      col.cellEditor = 'number'
      col.filterType = 'number'
      break
    case 'years':
      col.valueFormatter = fmtYears
      col.cellEditor = 'number'
      col.filterType = 'number'
      break
    case 'integer':
      col.valueFormatter = fmtInteger
      col.cellEditor = 'number'
      col.filterType = 'number'
      break
    case 'identifier':
      col.editable = false
      break
    case 'longText':
      col.width = HINT_DEFAULT_WIDTH.longText
      // Plafonne l'autosize : sinon `description` (texte multi-ligne,
      // 200+ caractères) explose à 1500+ px sur le canvas measureText,
      // tasse toutes les autres colonnes hors viewport et casse la
      // lisibilité de la grille. `maxWidth` est lu par `useAutosize`
      // comme hard cap (cf. useAutosize.ts §90).
      col.maxWidth = '320px'
      break
    case 'address':
    case 'text':
    default:
      break
  }

  return col
}

const columns = computed<ColumnDef<AdeoProduct>[]>(() =>
  payload.meta.fields.map(buildColumn),
)

// ---------------------------------------------------------------------------
// État local — rows mutables (édition inline), search, filter model.
// ---------------------------------------------------------------------------

// `rows.value` est une copie shallow pour qu'on puisse muter en place
// (cell edit / fill / bulk clear) sans toucher le JSON importé.
const rows = ref<AdeoProduct[]>(payload.products.map((p) => ({ ...p })))

const searchInput = ref('')

const visibleRows = computed(() => {
  const q = searchInput.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((r) => {
    return (
      String(r.adeoKey).toLowerCase().includes(q) ||
      String(r.activeGtins ?? '').toLowerCase().includes(q) ||
      String(r.colour ?? '').toLowerCase().includes(q) ||
      String(r.collection ?? '').toLowerCase().includes(q) ||
      String(r.typeOfProduct ?? '').toLowerCase().includes(q)
    )
  })
})

// Set des fields rendus en YesNoRenderer + édités via le select boolean.
// On en a besoin dans `onCellEdit` pour re-coercer la valeur que MSelect
// commit en string (`"false"` au lieu de `false`) sinon la donnée
// stockée se retrouve typée hétérogène (mix `false` / `"false"` / `null`)
// et un groupBy sur ce field ferait apparaître 2 buckets distincts pour
// la même valeur logique.
const BOOLEAN_FIELDS = new Set<string>(
  Object.entries(HINTS)
    .filter(([, h]) => h === 'boolean')
    .map(([k]) => k),
)

// Handler du bulk-cell-edit (Ctrl+A → Delete, paste range) — le grid
// émet un seul event avec toutes les changes pour éviter le fan-out
// d'1 M emits `cellEdit` sur les grosses opérations.
function onBulkCellEdit(event: {
  changes: ReadonlyArray<{ rowIndex: number; field: string; oldValue: unknown; newValue: unknown }>
}): void {
  // Re-normalise les valeurs boolean côté store (le select Mozaic
  // commit en string, cf. note sur `BOOLEAN_FIELDS`).
  for (const c of event.changes) {
    if (BOOLEAN_FIELDS.has(c.field)) {
      const row = rows.value[c.rowIndex] as Record<string, unknown> | undefined
      if (row) row[c.field] = coerceYesNo(c.newValue)
    }
  }
}

function onCellEdit(e: CellEditEvent): void {
  // Édition locale uniquement — pas de mock API ici. Le grid a déjà
  // appliqué la valeur dans la row via son `applyFills` interne, et
  // bump son `dataVersion` interne pour rafraîchir `groupTree` /
  // `filteredRows` / `sortedRows`. Pour les booléens on re-normalise
  // juste la valeur écrite (cf. note sur `BOOLEAN_FIELDS`).
  if (BOOLEAN_FIELDS.has(e.field)) {
    const row = rows.value[e.rowIndex] as Record<string, unknown> | undefined
    if (!row) return
    row[e.field] = coerceYesNo(e.newValue)
  }
}
</script>

<template>
  <section class="adeo-pim">
    <!-- Header custom au-dessus de la grille : titre + compteur à
         gauche, recherche libre à droite. La toolbar built-in du grid
         (fullscreen, settings, filters, group, keyboard) reste juste
         en dessous, intacte — la search box n'a pas vraiment sa place
         dedans (cf. lib : pas de slot `#toolbar-end` exposé, seul
         `#toolbar` qui override la toolbar entière). -->
    <header class="adeo-pim__header">
      <div class="adeo-pim__title-block">
        <h2 class="adeo-pim__title">PIM Adeo — INSPIRE wallpapers</h2>
        <p class="adeo-pim__subtitle">
          {{ payload.meta.count }} produits réels · {{ columns.length }} colonnes
        </p>
      </div>
      <MTextInput
        id="adeo-pim-search"
        v-model="searchInput"
        input-type="search"
        placeholder="ADEO key, GTIN, couleur, collection…"
        class="adeo-pim__search"
      >
        <template #icon><Search24 /></template>
      </MTextInput>
    </header>

    <AdeoGrid
      class="adeo-pim__grid"
      :columns="columns"
      :rows="visibleRows"
      :row-id="(row) => String((row as AdeoProduct).id)"
      :virtual-columns="true"
      :multi-sort="true"
      :height="640"
      selectable
      :pagination="{ pageSize: 50, pageSizeOptions: [25, 50, 100, 200] }"
      @cell-edit="onCellEdit"
      @bulk-cell-edit="onBulkCellEdit"
    />
  </section>
</template>

<style scoped lang="scss">
.adeo-pim {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  /* Pas de `flex: 1` ici : ça override la `height: 640px` inline que
     `<AdeoGrid>` applique à sa racine et le grid mange toute la viewport.
     On laisse le flow vertical naturel — la section grandit selon le
     contenu, et la grille respecte son `:height="640"`. */
}

.adeo-pim__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.adeo-pim__title-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.adeo-pim__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary, #1e293b);
}

.adeo-pim__subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary, #64748b);
}

.adeo-pim__search {
  /* Slot toolbar-end : largeur fixe, le grid prend tout le reste de la
     barre. Si tu veux un search collé tout à droite, mets `min-width`
     plus large ici. */
  min-width: 280px;
  max-width: 360px;
}

/* Pas de `.adeo-pim__grid { flex: 1 }` — voir la note sur .adeo-pim. */
</style>
