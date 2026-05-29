/**
 * Catalogue du tutoriel "Construire une datagrid pro avec MrxGrid".
 *
 * Le tutoriel est structuré en PHASES (groupes de steps) et chaque step
 * est une feature unitaire que le dev peut copier-coller dans son app :
 *
 *   • Objectif court (1 phrase)
 *   • Explication courte avec inline HTML (code, strong, em)
 *   • Snippet minimal focalisé (10-40 lignes) avec syntax highlight Shiki
 *   • Pointeur optionnel vers le fichier complet du demo
 *
 * Le contenu vit en TS pour rester type-safe et greppable. Pas de
 * Markdown : on contrôle 100% du rendu.
 */

export interface TutorialStep {
  id: string
  /** Numéro affiché (1, 2, …). Ordre stable dans la sidebar. */
  number: number
  /** Phase / groupe (ex. "Démarrage rapide"). Drive le séparateur dans la sidebar. */
  phase: string
  /** Titre de l'étape. */
  title: string
  /** Phrase courte qui résume "ce qu'on va obtenir". */
  objective: string
  /**
   * Paragraphes d'explication. Chaque entrée = un `<p>`. HTML inline léger
   * autorisé : `<code>`, `<strong>`, `<em>`, `<kbd>`.
   */
  explanation: string[]
  /** Snippet de code minimal à copier. */
  snippet: string
  /** Lang pour Shiki. */
  snippetLang: 'vue' | 'typescript'
  /**
   * Pointeur optionnel vers le fichier complet du demo (dans le glob
   * de `ShowCodePanel`). L'utilisateur peut cliquer pour voir le contexte.
   */
  seeAlso?: {
    label: string
    /** Clé du glob `import.meta.glob` (cf. `ShowCodePanel.vue`). */
    globKey: string
    /** Path affiché. */
    path: string
  }
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ===========================================================================
  // PHASE 1 — Démarrage rapide
  // ===========================================================================
  {
    id: 'install',
    number: 1,
    phase: 'Démarrage rapide',
    title: 'Installer et importer MrxGrid',
    objective: 'Mettre en place les dépendances pour utiliser MrxGrid dans un projet Vue 3.',
    explanation: [
      'MrxGrid est packagé en ESM Vue 3 + TypeScript et a deux dépendances peer : <code>vue@^3.5</code> et <code>@mozaic-ds/vue</code> (le design system Mozaic d\'Adeo qui fournit les inputs, modals, drawers, etc.). Toutes les exports publics sont accessibles depuis le barrel <code>@/components/MrxGrid</code>.',
      'Pour ce demo, on importe le composant principal <code>MrxGrid</code> et le type <code>ColumnDef</code> qui décrit chaque colonne. Le reste (types CellRendererProps, renderers built-in, filtres, plugins, etc.) est exposé au même niveau.',
    ],
    snippet: `<script setup lang="ts">
import { MrxGrid, type ColumnDef } from '@/components/MrxGrid'
import type { LMProduct } from './mock/seed'

const rows: LMProduct[] = [/* ... vos données ... */]
const columns: ColumnDef[] = [/* ... voir étape 2 ... */]
</script>

<template>
  <MrxGrid :columns="columns" :rows="rows" />
</template>`,
    snippetLang: 'vue',
  },
  {
    id: 'columns',
    number: 2,
    phase: 'Démarrage rapide',
    title: 'Définir les colonnes',
    objective: 'Déclarer un tableau de <code>ColumnDef</code> qui pilote l\'affichage des colonnes.',
    explanation: [
      'Chaque colonne est un objet typé avec au minimum <code>field</code> (clé d\'accès dans la row) et <code>headerName</code> (libellé affiché). Tu peux ajouter <code>width</code> (px ou %), <code>pinned: \'start\' | \'end\'</code> pour épingler à gauche/droite, et plein d\'autres options optionnelles selon les features que tu actives.',
      'Le grid lit chaque cellule comme <code>col.valueGetter?.(row) ?? row[col.field]</code>. Si tu déclares un <code>valueGetter</code>, il prend la main partout (rendu, tri, filtre, copy/paste, fill handle, édition, export). Sinon le grid lit directement <code>row[col.field]</code>. Voir étape 9 pour le pattern colonne calculée.',
    ],
    snippet: `import type { ColumnDef } from '@/components/MrxGrid'

const columns: ColumnDef[] = [
  {
    field: 'sku',
    headerName: 'Référence',
    width: '130px',
    pinned: 'start',           // épinglée à gauche
    sortable: true,
  },
  {
    field: 'name',
    headerName: 'Produit',
    width: '280px',
    pinned: 'start',
    sortable: true,
  },
  {
    field: 'price',
    headerName: 'Prix',
    width: '110px',
    sortable: true,
    cellClass: 'mrx-cell-num', // classe CSS appliquée à la cellule
  },
  {
    field: 'status',
    headerName: 'État',
    width: '140px',
    pinned: 'end',             // épinglée à droite
  },
]`,
    snippetLang: 'typescript',
    seeAlso: {
      label: 'Colonnes complètes du demo (29 colonnes)',
      globKey: '../DemoPage.vue',
      path: 'src/app/DemoPage.vue',
    },
  },
  {
    id: 'visual-config',
    number: 3,
    phase: 'Démarrage rapide',
    title: 'Configurer le visuel (height, density, fullscreen)',
    objective: 'Adapter la hauteur, la densité des lignes et activer le plein écran.',
    explanation: [
      '<code>:height</code> fixe la hauteur du grid en pixels — utile quand on veut un viewport scrollable. <code>:density</code> contrôle la hauteur des lignes : <code>\'compact\'</code> (32px), <code>\'default\'</code> (48px), <code>\'comfortable\'</code> (64px). <code>:fullscreen</code> est un v-model qui passe le grid en <code>position: fixed</code> plein écran.',
      'Pour gros datasets (>1000 lignes), pense aussi à <code>:virtual-scroll="true"</code> (vertical) et <code>:virtual-columns="true"</code> (horizontal) qui slice automatiquement ce qui est rendu.',
    ],
    snippet: `<script setup lang="ts">
import { ref } from 'vue'
import type { DataDensity } from '@/components/MrxGrid'

const fullscreen = ref(false)
const density = ref<DataDensity>('default')
</script>

<template>
  <MrxGrid
    :columns="columns"
    :rows="rows"
    :height="640"
    :density="density"
    :fullscreen="fullscreen"
    :virtual-scroll="true"
    :virtual-columns="true"
  />
  <button @click="fullscreen = !fullscreen">
    {{ fullscreen ? 'Quitter' : 'Plein écran' }}
  </button>
</template>`,
    snippetLang: 'vue',
  },

  // ===========================================================================
  // PHASE 2 — Données serveur
  // ===========================================================================
  {
    id: 'server-pagination',
    number: 4,
    phase: 'Données serveur',
    title: 'Pagination server-side',
    objective: 'Charger les lignes page par page en interrogeant ton API.',
    explanation: [
      'Tu passes au grid uniquement la page courante via <code>:rows</code>, et le total réel via <code>:total-count</code>. Le grid détecte automatiquement le mode serveur (<code>totalCount > rows.length</code>) et arrête de re-slicer côté client. La sélection de taille de page + la pagination "X-Y / total" apparaissent dans le footer.',
      '<code>@page-change</code> émet à chaque changement de page ou de taille — c\'est ton hook pour refetch. Le composable <code>useProductList</code> du demo encapsule tout ça (sort + filter + pagination + search) en ~150 LOC.',
    ],
    snippet: `<script setup lang="ts">
import { ref } from 'vue'
import { MrxGrid } from '@/components/MrxGrid'

const rows = ref<Product[]>([])
const total = ref(0)
const loading = ref(false)

async function refetch(page: number, pageSize: number) {
  loading.value = true
  try {
    const result = await api.fetchProducts({ page, pageSize })
    rows.value = result.rows
    total.value = result.total
  } finally {
    loading.value = false
  }
}

const paginationConfig = {
  defaultPageSize: 25,
  pageSizeOptions: [10, 25, 50, 100, 500, 1000, 10000, 100000],
}
</script>

<template>
  <MrxGrid
    :columns="columns"
    :rows="rows"
    :total-count="total"
    :pagination="paginationConfig"
    :loading="loading"
    @page-change="(e) => refetch(e.page - 1, e.pageSize)"
  />
</template>`,
    snippetLang: 'vue',
    seeAlso: {
      label: 'Composable useProductList complet',
      globKey: '../composables/useProductList.ts',
      path: 'src/app/composables/useProductList.ts',
    },
  },
  {
    id: 'search-debounced',
    number: 5,
    phase: 'Données serveur',
    title: 'Recherche debouncée',
    objective: 'Une barre de recherche qui ne déclenche un fetch qu\'après 300ms d\'inactivité.',
    explanation: [
      'Le pattern : 2 refs (l\'<code>input</code> que l\'utilisateur tape et le <code>debounced</code> que tu utilises pour fetch). Un watcher avec <code>setTimeout</code> reset à chaque frappe — la dernière valeur "gagne" après 300ms. Évite de spammer l\'API à chaque touche.',
      'Le helper <code>useDebouncedRef</code> du demo fait ça en ~25 LOC, totalement framework-agnostique côté logique.',
    ],
    snippet: `// useDebouncedRef.ts
import { ref, watch, type Ref } from 'vue'

export function useDebouncedRef<T>(initial: T, delayMs = 300) {
  const input = ref<T>(initial) as Ref<T>
  const debounced = ref<T>(initial) as Ref<T>

  let timer = 0
  watch(input, (next) => {
    clearTimeout(timer)
    timer = window.setTimeout(() => {
      debounced.value = next
    }, delayMs)
  })

  return { input, debounced }
}

// Usage dans le composable
const { input: searchInput, debounced: searchDebounced } = useDebouncedRef('', 300)

watch(searchDebounced, () => refetch())   // re-fetch quand le user arrête de taper`,
    snippetLang: 'typescript',
    seeAlso: {
      label: 'Helper complet',
      globKey: '../composables/useDebouncedRef.ts',
      path: 'src/app/composables/useDebouncedRef.ts',
    },
  },
  {
    id: 'loading-states',
    number: 6,
    phase: 'Données serveur',
    title: 'Loading state global (skeleton plein écran)',
    objective: 'Skeleton plein écran à chaque fetch — boot, page change, sort, filter, search.',
    explanation: [
      'Le grid expose <code>:loading="true"</code> qui remplace le body par N skeleton rows (count auto-dérivé du viewport, clampé 4-20). Le header et le footer restent visibles pour conserver le contexte.',
      'Pour les <em>modifications ciblées</em> (édition d\'une cellule, bulk delete d\'une row), évite de relancer un fetch global — utilise <code>pendingCells</code> et <code>pendingRowIds</code> qui shimmer uniquement les cellules / rows ciblées (cf. étape 18). Ça évite le "tout-tableau-qui-disparaît" à chaque édition.',
    ],
    snippet: `<script setup lang="ts">
import { ref } from 'vue'

const rows = ref<Product[]>([])
const loading = ref(false)

async function refetch() {
  loading.value = true   // ← skeleton plein, à chaque fetch
  try {
    rows.value = await api.fetchProducts(...)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <MrxGrid
    :columns="columns"
    :rows="rows"
    :loading="loading"
  />
</template>`,
    snippetLang: 'vue',
  },

  // ===========================================================================
  // PHASE 3 — Rendu personnalisé
  // ===========================================================================
  {
    id: 'cell-renderer',
    number: 7,
    phase: 'Rendu personnalisé',
    title: 'Cell renderer custom',
    objective: 'Afficher une cellule via un composant Vue plutôt que du texte brut.',
    explanation: [
      'Tu déclares un composant qui reçoit <code>CellRendererProps</code> (<code>value, row, field, rowIndex, column</code>) et tu le passes via <code>column.renderer: markRaw(MonComposant)</code>. <code>markRaw()</code> est <strong>obligatoire</strong> sinon Vue wrappe le composant en proxy reactive et ça casse.',
      'Idéal pour des badges Mozaic, avatars, mini-graphiques, liens cliquables, etc. Pour des cas plus simples, un slot <code>#cell-{field}</code> est plus rapide à écrire (cf. étape 9).',
    ],
    snippet: `// StatusCell.vue
<script setup lang="ts">
import type { CellRendererProps } from '@/components/MrxGrid'
import { MStatusBadge } from '@mozaic-ds/vue'

const props = defineProps<CellRendererProps>()

const variantOf = (v: unknown) =>
  v === 'out' ? 'danger'
  : v === 'low' ? 'warning'
  : v === 'preorder' ? 'information'
  : 'success'
</script>

<template>
  <MStatusBadge :variant="variantOf(value)">
    {{ value }}
  </MStatusBadge>
</template>

// DemoPage.vue
import { markRaw } from 'vue'
import StatusCell from './components/cells/StatusCell.vue'

const columns: ColumnDef[] = [
  {
    field: 'status',
    headerName: 'État',
    renderer: markRaw(StatusCell),   // ← markRaw obligatoire
  },
]`,
    snippetLang: 'vue',
    seeAlso: {
      label: 'StatusCell complet',
      globKey: './cells/StatusCell.vue',
      path: 'src/app/components/cells/StatusCell.vue',
    },
  },
  {
    id: 'value-formatter',
    number: 8,
    phase: 'Rendu personnalisé',
    title: 'Value formatter',
    objective: 'Formater une valeur (devise, date, %) sans créer un composant.',
    explanation: [
      'Pour un formatage SIMPLE (texte uniquement, sans HTML / interactivité), <code>valueFormatter</code> est plus léger qu\'un renderer. Tu reçois la <code>value</code>, tu retournes une <code>string</code>. Le grid l\'affiche tel quel.',
      'Utilise <code>Intl.NumberFormat</code> et <code>Intl.DateTimeFormat</code> côté natif — gratuit, performant, locale-aware.',
    ],
    snippet: `const columns: ColumnDef[] = [
  {
    field: 'price',
    headerName: 'Prix',
    valueFormatter: (v) =>
      typeof v === 'number'
        ? new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
          }).format(v)
        : '',
  },
  {
    field: 'margin',
    headerName: 'Marge',
    valueFormatter: (v) =>
      typeof v === 'number' ? \`\${v.toFixed(1)} %\` : '',
  },
  {
    field: 'updatedAt',
    headerName: 'Mise à jour',
    valueFormatter: (v) =>
      v ? new Intl.DateTimeFormat('fr-FR').format(new Date(v as string)) : '',
  },
]`,
    snippetLang: 'typescript',
  },
  {
    id: 'value-getter',
    number: 9,
    phase: 'Rendu personnalisé',
    title: 'Value getter (colonne calculée)',
    objective: 'Créer une colonne dont la valeur est calculée à partir de la row, sans modifier ton modèle.',
    explanation: [
      'Quand la colonne n\'existe pas comme champ dans ta row mais doit être dérivée (somme de plusieurs champs, ratio, valeur synthétique pour un stress-test…), utilise <code>valueGetter: (row) => ...</code>. Le grid l\'appelle sur <em>tous</em> les chemins : rendu, tri client, filtrage, copy/paste, fill handle, édition, export.',
      'Coût : 1 appel par cellule par render — garde la fonction pure et rapide (pas d\'allocation lourde).',
      'Pratique pour les colonnes éditables sans backing field : combine <code>valueGetter</code> avec un cache d\'overrides côté app (Map keyée par <code>(rowId, field)</code>) que <code>@cell-edit</code> alimente — le getter renvoie l\'override si présent, sinon recalcule.',
    ],
    snippet: `const columns: ColumnDef[] = [
  {
    field: 'profit',
    headerName: 'Profit',
    valueGetter: (row) => {
      const p = (row as Product).price
      const c = (row as Product).costPrice
      return typeof p === 'number' && typeof c === 'number' ? p - c : null
    },
    valueFormatter: (v) =>
      typeof v === 'number' ? \`\${v.toFixed(2)} €\` : '—',
  },
]`,
    snippetLang: 'typescript',
  },

  // ===========================================================================
  // PHASE 4 — Édition
  // ===========================================================================
  {
    id: 'editors-builtin',
    number: 10,
    phase: 'Édition',
    title: 'Éditeurs cellule built-in',
    objective: 'Activer l\'édition inline avec text, number, select ou date.',
    explanation: [
      'Pour rendre une cellule éditable : <code>editable: true</code> + <code>cellEditor: \'text\' | \'number\' | \'select\' | \'date\'</code>. L\'utilisateur double-clique (ou appuie <kbd>Enter</kbd>) pour entrer en édition, <kbd>Enter</kbd> commit + move down, <kbd>Tab</kbd> commit + move right, <kbd>Escape</kbd> cancel.',
      '<code>cellEditorOptions</code> alimente les options du select. <code>cellValidator</code> valide la valeur avant commit (retourne <code>true</code> ou un message d\'erreur).',
      'L\'event <code>@cell-edit</code> émet <code>{ rowIndex, field, oldValue, newValue, row }</code> pour pousser la mutation au serveur.',
    ],
    snippet: `const columns: ColumnDef[] = [
  {
    field: 'name',
    headerName: 'Produit',
    editable: true,
    cellEditor: 'text',
  },
  {
    field: 'price',
    headerName: 'Prix',
    editable: true,
    cellEditor: 'number',
    cellValidator: (v) =>
      typeof v === 'number' && v >= 0 ? true : 'Prix négatif interdit',
  },
  {
    field: 'category',
    headerName: 'Rayon',
    editable: true,
    cellEditor: 'select',
    cellEditorOptions: [
      { value: 'plomberie', label: 'Plomberie' },
      { value: 'jardin',    label: 'Jardin' },
    ],
  },
]

// Côté template
<MrxGrid
  :columns="columns"
  :rows="rows"
  @cell-edit="async (e) => {
    await api.updateProduct(e.row.id, { [e.field]: e.newValue })
  }"
/>`,
    snippetLang: 'typescript',
  },
  {
    id: 'editor-custom-combobox',
    number: 11,
    phase: 'Édition',
    title: 'Éditeur custom : combobox via slot #edit-{field}',
    objective: 'Remplacer l\'éditeur par défaut par n\'importe quel composant Vue (combobox, color picker, slider, …).',
    explanation: [
      'Quand les éditeurs built-in ne suffisent pas, déclare <code>cellEditor: \'custom\'</code> sur la colonne et fournis le composant via le slot <code>#edit-{field}</code> sur <code>&lt;MrxGrid&gt;</code>. Le scope du slot expose : <code>value, editValue, updateValue, commit, cancel, setValue, row, field, rowIndex, column</code>.',
      'Appelle <code>updateValue(v)</code> pour pousser le draft, <code>commit(\'stay\')</code> pour valider sans déplacer l\'active cell (utile pour combobox), <code>commit(\'down\')</code> pour valider + bouger d\'une ligne (style Excel). <code>cancel()</code> ferme sans modification.',
    ],
    snippet: `// BrandComboEditor.vue
<script setup lang="ts">
import { MCombobox } from '@mozaic-ds/vue'
import type { ColumnDef } from '@/components/MrxGrid'

const props = defineProps<{
  field: string
  rowIndex: number
  column: ColumnDef
  editValue: unknown
  updateValue: (v: unknown) => void
  commit: (dir?: 'down' | 'right' | 'left' | 'stay') => void
}>()

function onPick(v: string | number | null | (string | number)[]) {
  const next = Array.isArray(v) ? v[0] : v
  props.updateValue(next ?? '')
  props.commit('stay')   // ← reste sur la cell, voir le pending skeleton
}
</script>

<template>
  <MCombobox
    :model-value="(editValue as string | number | null) ?? null"
    :options="(column.cellEditorOptions ?? []).map(o => ({ label: o.label, value: o.value }))"
    size="s"
    searchable
    @update:model-value="onPick"
  />
</template>

// DemoPage.vue
<MrxGrid :columns="columns" :rows="rows">
  <template #edit-brand="{ field, rowIndex, column, editValue, updateValue, commit }">
    <BrandComboEditor
      :field="field"
      :row-index="rowIndex"
      :column="column"
      :edit-value="editValue"
      :update-value="updateValue"
      :commit="commit"
    />
  </template>
</MrxGrid>

// Côté colonne
{ field: 'brand', editable: true, cellEditor: 'custom',
  cellEditorOptions: LM_BRANDS.map(b => ({ value: b, label: b })) }`,
    snippetLang: 'vue',
    seeAlso: {
      label: 'BrandComboEditor complet',
      globKey: './cells/BrandComboEditor.vue',
      path: 'src/app/components/cells/BrandComboEditor.vue',
    },
  },
  {
    id: 'fill-handle',
    number: 12,
    phase: 'Édition',
    title: 'Fill handle (drag-to-propagate)',
    objective: 'Propager une valeur sur N cellules en dessous, pattern Excel.',
    explanation: [
      'Le fill handle apparaît automatiquement quand une cellule éditable est sélectionnée — c\'est le petit carré bleu en bas-droite. Drag pour propager. L\'event <code>@fill</code> émet un batch de <code>{ rowIndex, field, value }</code> que tu peux pusher en bulk à ton API en groupant par champ.',
      'C\'est une seule operation logique du point de vue history (1 fill = 1 undo).',
    ],
    snippet: `<MrxGrid
  :columns="columns"
  :rows="rows"
  @fill="onFill"
/>

<script setup lang="ts">
async function onFill(event: {
  fills: Array<{ rowIndex: number; field: string; value: unknown }>
}) {
  // Group by field — 1 appel API par champ touché
  const byField = new Map<string, { ids: number[]; value: unknown }>()
  for (const f of event.fills) {
    const row = rows.value[f.rowIndex]
    if (!row) continue
    let bucket = byField.get(f.field)
    if (!bucket) {
      bucket = { ids: [], value: f.value }
      byField.set(f.field, bucket)
    }
    bucket.ids.push(row.id)
  }
  for (const [field, { ids, value }] of byField) {
    await api.updateProducts(ids, { [field]: value })
  }
}
</script>`,
    snippetLang: 'vue',
  },

  // ===========================================================================
  // PHASE 5 — Filtrage (3 styles)
  // ===========================================================================
  {
    id: 'filter-inline',
    number: 13,
    phase: 'Filtrage',
    title: 'Filter row inline (text / select / date)',
    objective: 'Une ligne de filtres rapides au-dessus du body, rendue automatiquement par le grid.',
    explanation: [
      'Déclare <code>filter: { type, placeholder, options? }</code> sur la colonne. Le grid rend un <code>MTextInput</code> (search icon), un <code>MSelect</code> ou un <code>MDatepicker</code> Mozaic. L\'utilisateur tape → debounce auto → application du filtre.',
      'En mode client (défaut), le grid filtre <code>props.rows</code> directement. En mode serveur (<code>:filter-mode="\'server\'"</code>), il émet <code>@filter-change</code> et tu re-fetch.',
    ],
    snippet: `const columns: ColumnDef[] = [
  {
    field: 'sku',
    headerName: 'Référence',
    filterable: true,
    filter: { type: 'text', placeholder: 'Réf…' },
  },
  {
    field: 'category',
    headerName: 'Rayon',
    filterable: true,
    filter: {
      type: 'select',
      placeholder: 'Tous',
      options: LM_CATEGORIES.map(c => ({ label: c, value: c })),
    },
  },
  {
    field: 'createdAt',
    headerName: 'Créé le',
    filterable: true,
    filter: { type: 'date', placeholder: 'Date…' },
  },
]

<MrxGrid
  :columns="columns"
  :rows="rows"
  :filter-mode="'server'"
  @filter-change="(filters) => refetch({ quickFilters: filters })"
/>`,
    snippetLang: 'typescript',
  },
  {
    id: 'filter-slot',
    number: 14,
    phase: 'Filtrage',
    title: 'Filter slot custom #filter-{field}',
    objective: 'Remplacer l\'input par défaut par n\'importe quel composant (range slider, multi-select, etc.).',
    explanation: [
      'Le slot <code>#filter-{field}</code> reçoit <code>{ column, value, setValue, clear }</code>. Tu rends ce que tu veux et appelles <code>setValue(v)</code> quand l\'utilisateur change la valeur, <code>clear()</code> quand il efface.',
      'Le grid pose le slot dans la zone de la filter row, alignée sur la colonne — pas besoin de gérer la position.',
    ],
    snippet: `<MrxGrid :columns="columns" :rows="rows">
  <template #filter-price="{ value, setValue, clear }">
    <PriceRangeSlider
      :range="value as { min: number; max: number } | null"
      :min="0"
      :max="1500"
      @update="(range) => range ? setValue(range) : clear()"
    />
  </template>
</MrxGrid>

// Côté colonne — juste filterable: true, pas besoin de filter: { type }
{ field: 'price', headerName: 'Prix', filterable: true }`,
    snippetLang: 'vue',
  },
  {
    id: 'filter-custom-aggrid',
    number: 15,
    phase: 'Filtrage',
    title: 'Filtre AG-Grid-style (overlay du menu colonne)',
    objective: 'Un filtre porté par le menu kebab de la colonne, persistant dans le filterModel formel.',
    explanation: [
      'Le contrat AG-Grid : <code>filter: { component, filterParams, doesFilterPass, getModelAsString }</code>. Le composant est monté dans l\'overlay du menu colonne, son état persiste dans <code>filterModel.value.conditions</code>.',
      '<code>doesFilterPass(params)</code> retourne <code>true</code> si la row passe — appelé pour chaque row côté client (ou ignoré en mode server). <code>getModelAsString</code> formate l\'état pour le tag-bar "FILTERED BY". Le composant expose <code>isFilterActive</code> + <code>refresh</code> via <code>defineExpose</code>.',
    ],
    snippet: `// CategoryComboFilter.vue
<script setup lang="ts">
import { ref } from 'vue'
import { MCombobox } from '@mozaic-ds/vue'

const props = defineProps<{
  filterParams: string[]              // catégories disponibles
  onModelChange: (m: unknown) => void
  model: unknown
}>()

const selected = ref<string[]>(
  Array.isArray(props.model) ? props.model : []
)

function onChange(v: string[]) {
  selected.value = v
  props.onModelChange(v.length > 0 ? v : null)
}

defineExpose({
  isFilterActive: () => selected.value.length > 0,
  refresh: () => {},
})
</script>

<template>
  <MCombobox v-model="selected" multiple :options="filterParams.map(c => ({ label: c, value: c }))" @update:model-value="onChange" />
</template>

// Côté colonne
import { markRaw } from 'vue'
import CategoryComboFilter from './filters/CategoryComboFilter.vue'

{
  field: 'category',
  filterable: true,
  filter: {
    component: markRaw(CategoryComboFilter),
    filterParams: LM_CATEGORIES,
    doesFilterPass: (p) => {
      if (!Array.isArray(p.model) || p.model.length === 0) return true
      return p.model.includes(p.getValue('category'))
    },
    getModelAsString: (m) =>
      Array.isArray(m) && m.length > 0 ? m.join(', ') : '',
  },
}`,
    snippetLang: 'vue',
    seeAlso: {
      label: 'CategoryComboFilter complet',
      globKey: './filters/CategoryComboFilter.vue',
      path: 'src/app/components/filters/CategoryComboFilter.vue',
    },
  },

  // ===========================================================================
  // PHASE 6 — Interactions
  // ===========================================================================
  {
    id: 'row-selection',
    number: 16,
    phase: 'Interactions',
    title: 'Sélection multi-rows + bulk action bar',
    objective: 'Activer les checkboxes par ligne et exposer une barre d\'actions flottante.',
    explanation: [
      '<code>selectable</code> ajoute une checkbox sticky-left par row. L\'event <code>@update:selection</code> émet un <code>SelectionModel</code> au shape Gmail : <code>{ selectedIds: Set, excludedIds: Set, selectAllMode: boolean }</code> — gère naturellement "tout sélectionner" + exclusions sans copier 100k ids dans un array.',
      'Combine avec une bottom-bar custom qui apparaît dès qu\'il y a sélection (delete, edit status, export…).',
    ],
    snippet: `<script setup lang="ts">
import { ref } from 'vue'

const selectionIds = ref<number[]>([])

function onSelectionChange(payload: unknown) {
  const sel = payload as { selectedIds?: ReadonlySet<unknown> } | undefined
  selectionIds.value = sel?.selectedIds
    ? Array.from(sel.selectedIds, Number).filter((n) => !Number.isNaN(n))
    : []
}
</script>

<template>
  <MrxGrid
    :columns="columns"
    :rows="rows"
    selectable
    selection-bar-compact
    @update:selection="onSelectionChange"
  />

  <!-- Ta bulk action bar custom -->
  <BulkActionBar
    v-if="selectionIds.length > 0"
    :count="selectionIds.length"
    @delete="askDelete(selectionIds)"
    @edit-status="openBulkStatusModal"
  />
</template>`,
    snippetLang: 'vue',
  },
  {
    id: 'row-expansion',
    number: 17,
    phase: 'Interactions',
    title: 'Row expansion (#expand-row)',
    objective: 'Drill-down inline : un panneau qui s\'ouvre sous la row avec des détails.',
    explanation: [
      '<code>expandable</code> ajoute un chevron sticky-left, le slot <code>#expand-row</code> rend le contenu déplié. Le scope expose <code>{ row, index }</code>. <code>:expanded-row-height</code> (default 320px) sert au math du virtual scroll — ajuste si ton contenu est plus grand.',
      'Le pattern courant : un mini-grid imbriqué (mouvements de stock, historique, sous-éléments). MrxGrid se réutilise lui-même en read-only.',
    ],
    snippet: `<MrxGrid
  :columns="columns"
  :rows="rows"
  expandable
  :expanded-row-height="220"
>
  <template #expand-row="{ row }">
    <ProductDetailExpand :product="row" />
  </template>
</MrxGrid>

// ProductDetailExpand.vue
<script setup lang="ts">
import { MrxGrid } from '@/components/MrxGrid'
import { getProductMovements } from '../mock/api'

const props = defineProps<{ product: Product }>()
const movements = ref([])
onMounted(async () => {
  movements.value = await getProductMovements(props.product.id)
})
</script>

<template>
  <div class="detail">
    <h3>{{ product.name }}</h3>
    <MrxGrid
      :columns="movementColumns"
      :rows="movements"
      :height="220"
      density="compact"
    >
      <template #toolbar><span /></template>   <!-- pas de toolbar -->
    </MrxGrid>
  </div>
</template>`,
    snippetLang: 'vue',
    seeAlso: {
      label: 'ProductDetailExpand complet',
      globKey: './detail/ProductDetailExpand.vue',
      path: 'src/app/components/detail/ProductDetailExpand.vue',
    },
  },
  {
    id: 'granular-skeleton',
    number: 18,
    phase: 'Interactions',
    title: 'Granular skeleton sur les mutations',
    objective: 'Shimmer uniquement sur les cellules / rows ciblées par une mutation, pas tout le tableau.',
    explanation: [
      'Le grid expose <code>:pending-cells="[{rowId, field}]"</code> et <code>:pending-row-ids="[id1, id2]"</code> qui cumulent avec <code>:loading</code> et <code>:refreshing</code>. Le composable <code>usePendingMutations</code> du demo encapsule les patterns try/finally : <code>withCellPending</code> wrap un appel API, marque la cellule shimmer pendant la promesse, démarque automatiquement au resolve ou sur erreur.',
      '<strong>Important</strong> : destructure les refs en top-level dans le setup. <code>:pending-cells="pending.pendingCells.value"</code> à travers un objet intermédiaire ne track pas correctement la dep côté Vue. Préfère <code>const pendingCells = pending.pendingCells</code> + <code>:pending-cells="pendingCells"</code>.',
    ],
    snippet: `// usePendingMutations.ts
import { ref } from 'vue'

export interface PendingCell { rowId: string; field: string }

export function usePendingMutations() {
  const pendingCells = ref<PendingCell[]>([])
  const pendingRowIds = ref<string[]>([])

  async function withCellPending<T>(rowId: string, field: string, fn: () => Promise<T>) {
    pendingCells.value = [...pendingCells.value, { rowId, field }]
    try { return await fn() }
    finally {
      pendingCells.value = pendingCells.value.filter(
        c => c.rowId !== rowId || c.field !== field,
      )
    }
  }

  return { pendingCells, pendingRowIds, withCellPending }
}

// DemoPage.vue
const pending = usePendingMutations()
const pendingCells = pending.pendingCells     // ← TOP-LEVEL ref, sinon reactivity perdue
const pendingRowIds = pending.pendingRowIds

async function onCellEdit(e) {
  await pending.withCellPending(String(e.row.id), e.field, () =>
    api.updateProduct(e.row.id, { [e.field]: e.newValue }),
  )
}

<MrxGrid
  :columns="columns"
  :rows="rows"
  :pending-cells="pendingCells"
  :pending-row-ids="pendingRowIds"
  @cell-edit="onCellEdit"
/>`,
    snippetLang: 'typescript',
    seeAlso: {
      label: 'usePendingMutations complet',
      globKey: '../composables/usePendingMutations.ts',
      path: 'src/app/composables/usePendingMutations.ts',
    },
  },
  {
    id: 'custom-toolbar',
    number: 19,
    phase: 'Interactions',
    title: 'Toolbar custom (#toolbar)',
    objective: 'Customiser la zone toolbar — search, import/export, CTA — sans réécrire les built-in features.',
    explanation: [
      'Le slot <code>#toolbar</code> remplace la toolbar par défaut. Tu peux y poser <code>&lt;MrxGridSmartToolbar&gt;</code> qui expose en one-liner les features built-in (<code>fullscreen, settings, filters, group, keyboard, export</code>) et entourer avec tes propres éléments.',
      'Le pattern courant : <code>[search input] [SmartToolbar] [tes actions custom]</code>.',
    ],
    snippet: `<MrxGrid :columns="columns" :rows="rows">
  <template #toolbar>
    <div class="my-toolbar">
      <MTextInput
        v-model="search"
        placeholder="Rechercher…"
        input-type="search"
      />

      <MrxGridSmartToolbar
        :grid="gridRef"
        :columns="columns"
        :show-fullscreen="true"
        :show-export="true"
        :show-settings="true"
        :show-filters="true"
        :show-group="true"
        :show-keyboard="true"
      />

      <MIconButton @click="onImportCsv">
        <template #icon><Upload24 /></template>
      </MIconButton>
      <MButton appearance="accent" @click="onNewProduct">
        + Nouveau produit
      </MButton>
    </div>
  </template>
</MrxGrid>`,
    snippetLang: 'vue',
    seeAlso: {
      label: 'ToolbarActions complet',
      globKey: './ToolbarActions.vue',
      path: 'src/app/components/ToolbarActions.vue',
    },
  },
]
