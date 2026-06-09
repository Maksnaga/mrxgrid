import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'
import { AdGridVue, AdGridToolbar } from '@/components/Grid'
import type { DataDensity, GroupingItem } from '@/components/Grid'
import type { FilterModel } from '@/components/Grid/models/filter.model'
import { generateLMProducts, lmColumns } from './_fixtures'

const meta = {
  title: 'Stories/Devtools/Event console',
  component: AdGridVue,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Event console

Une story "all features ON" avec une console DevTools-like qui trace en temps réel chaque évent émis par \`<ad-grid-vue>\`. Utilisée comme outil de debug ou comme référence des évents disponibles.

### Évents tracés

| Évent | Quand |
|-------|-------|
| \`update:selection\` | Coche / décoche row, ou range cell change |
| \`update:hidden-fields\` | Hide/show colonne via menu kebab ou drawer |
| \`update:filter-model\` | Filtre ajouté / modifié / supprimé via overlay ou drawer |
| \`column-menu-action\` | Action du menu kebab (sort, pin, hide, filter-in-this-column) |
| \`cell-edit\` | Commit d'une édition cellulaire |
| \`fill\` | Fin d'un drag fill |
| \`page-change\` | Page ou pageSize change |
| \`filter-change\` | Quick filter inline change |
| \`bulk-delete\` | Delete depuis la floating action bar |
| \`selection-edit\` | Edit depuis la floating action bar |
| \`retry\` | User clique Retry dans le slot \`#error\` |

### Évents synthétiques (toolbar / drawer)

Cette story logge en plus les actions toolbar/drawer pour visualiser le flow complet :

- \`toolbar:toggle-fullscreen\` / \`export\` / \`filters\` / \`settings\` / \`group\` / \`keyboard\`
- \`drawer:settings-apply\` / \`-reset\` / \`grouping-apply\` / \`-reset\` / \`filters-apply\` / \`-clear\`

### Architecture de la console

- **Severity classes** : info (default), warn (bulk-delete), error (retry), debug (toolbar/drawer)
- **Coalesce des évents identiques consécutifs** — affiche un badge \`(N)\` au lieu de spammer le log
- **Filter texte** + chips de niveau pour shortlister
- **Click sur une ligne** → expand le payload JSON pretty-printed avec coloration syntaxique
- **\`jsonReplacer\`** convertit les \`Set\` / \`Map\` en arrays/objects pour pouvoir sérialiser le \`SelectionModel\`
        `,
      },
    },
  },
} satisfies Meta<typeof AdGridVue>

export default meta
type Story = StoryObj<typeof meta>

type Severity = 'info' | 'warn' | 'error' | 'debug'

interface LoggedEvent {
  id: number
  ts: string
  name: string
  source: string
  severity: Severity
  count: number
  /** Pretty-printed (multi-line, indented) JSON. */
  pretty: string
  /** Single-line summary used in the collapsed row. */
  preview: string
  /** Lowercased name+preview for the filter input. */
  haystack: string
  expanded: boolean
}

const MAX_LOG = 250
const PREVIEW_MAX = 140

function jsonReplacer(_k: string, v: unknown): unknown {
  if (v instanceof Set) return [...v]
  if (v instanceof Map) return Object.fromEntries(v.entries())
  return v
}

function nowStamp(): string {
  const d = new Date()
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

// Map each event name to a display severity. Tweak these to taste — they
// only affect the icon + colour in the console, not behaviour.
function classify(name: string): Severity {
  if (name === 'retry') return 'error'
  if (name === 'bulk-delete') return 'warn'
  if (name.startsWith('toolbar:') || name.startsWith('drawer:')) return 'debug'
  return 'info'
}

function severityIcon(s: Severity): string {
  switch (s) {
    case 'error':
      return '✕'
    case 'warn':
      return '⚠'
    case 'debug':
      return '›'
    default:
      return 'ⓘ'
  }
}

// Most events come from <ad-grid-vue> itself; toolbar:* and drawer:* are
// surfaced from the demo wiring around it. The "source" string mimics
// DevTools' right-aligned source link (e.g. `Grid.vue:209`).
function sourceFor(name: string): string {
  if (name.startsWith('toolbar:')) return 'AdGridToolbar.vue'
  if (name.startsWith('drawer:')) return 'demo-drawer'
  return 'Grid.vue'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Tokenize a JSON string into syntax-highlighted spans. The input MUST
// already be HTML-escaped — we only wrap the JSON tokens, never user data.
function highlightJson(jsonEscaped: string): string {
  return jsonEscaped.replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g,
    (match, str: string | undefined, colon: string | undefined, bool: string | undefined, num: string | undefined) => {
      if (str && colon) return `<span class="sb-evlog__tk-key">${str}</span>${colon}`
      if (str) return `<span class="sb-evlog__tk-str">${str}</span>`
      if (bool) return `<span class="sb-evlog__tk-bool">${bool}</span>`
      if (num) return `<span class="sb-evlog__tk-num">${num}</span>`
      return match
    },
  )
}

function buildPreview(pretty: string): string {
  const oneLine = pretty.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= PREVIEW_MAX) return oneLine
  return oneLine.slice(0, PREVIEW_MAX - 1) + '…'
}

export const AllEvents: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## All events with smart toolbar

Active **toutes** les features du grid (\`selectable\`, \`expandable\`, \`pagination\`, \`history-id\`, \`selection-bar-compact\`) et utilise \`<ad-grid-toolbar>\` pour le wiring batteries-included. La virtualisation 2D est toujours active sous le capot.

### Le pattern minimal

\`\`\`vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AdGridVue,
  AdGridToolbar,
  type DataDensity,
  type GroupingItem,
} from '@/components/Grid'
import type { FilterModel } from '@/components/Grid/models/filter.model'

const gridRef = ref<InstanceType<typeof AdGridVue> | null>(null)

// State piloted by the smart toolbar
const isFullscreen = ref(false)
const hiddenFields = ref<string[]>([])
const density      = ref<DataDensity>('default')
const columnOrder  = ref<string[] | undefined>(undefined)
const activeGroups = ref<GroupingItem[]>([])
const filterModel  = ref<FilterModel>({ conditions: [] })
const groupFields  = computed(() => activeGroups.value.map((g) => g.field))
</script>

<template>
  <ad-grid-vue
    ref="gridRef"
    :columns="columns"
    :rows="rows"
    :row-id="(row) => String(row.id)"
    selectable
    selection-bar-compact
    expandable


    :pagination="true"
    history-id="my-grid"
    :fullscreen="isFullscreen"
    :hidden-fields="hiddenFields"
    :group-fields="groupFields"
    :density="density"
    :column-order="columnOrder"
    @cell-edit="onCellEdit"
    @fill="onFill"
    @bulk-delete="onBulkDelete"
  >
    <template #toolbar>
      <ad-grid-toolbar
        :grid="gridRef"
        :columns="columns"
        v-model:fullscreen="isFullscreen"
        v-model:hidden-fields="hiddenFields"
        v-model:density="density"
        v-model:column-order="columnOrder"
        v-model:active-groups="activeGroups"
        v-model:filter-model="filterModel"
        show-fullscreen show-export show-filters show-settings show-group show-keyboard
      />
    </template>

    <template #expand-row="{ row }">
      <div class="detail-panel">
        <strong>{{ row.name }}</strong>
        <p>SKU {{ row.sku }} · stock {{ row.stock }} · {{ row.price }} €</p>
      </div>
    </template>
  </ad-grid-vue>
</template>
\`\`\`

### Pourquoi mettre la toolbar dans le \`#toolbar\` slot

Le mode fullscreen passe la racine du grid en \`position: fixed; inset: 0\`. Une toolbar en sibling serait masquée — le slot \`#toolbar\` est rendu à l'intérieur du conteneur fullscreen donc reste visible.

### Pourquoi \`selection-bar-compact\` quand on a un smart toolbar

Pour éviter d'afficher deux fois "X rows selected · Select all N rows · Clear" — la version compacte de la barre flottante ne montre plus que les boutons d'action (Edit / Copy / Paste / Delete).

### Mutation des rows côté consumer

Les handlers \`onCellEdit\` / \`onFill\` / \`onBulkDelete\` mutent \`rows\` localement — la grille ne touche jamais à votre data.

\`\`\`ts
function onCellEdit(e: CellEditEvent) {
  const row = rows.value[e.rowIndex] as Record<string, unknown>
  if (row) row[e.field] = e.newValue
}
\`\`\`

### Inspecter les évents

Toute interaction avec la grille (click, drag, edit, hover sur un menu, ouverture de drawer) trace dans la console DevTools-like en bas. Click sur une ligne pour expand le payload JSON. Filtre par niveau via les puces. Le badge \`(N)\` apparaît quand un évent fire en boucle (ex. \`update:selection\` pendant un drag).
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue, AdGridToolbar },
    setup() {
      const gridRef = ref<InstanceType<typeof AdGridVue> | null>(null)
      const rows = ref([...generateLMProducts(80)])
      const events = ref<LoggedEvent[]>([])
      let nextId = 0

      // ─── Console state ────────────────────────────────────────────────
      const filterText = ref('')
      const LEVELS: Severity[] = ['info', 'warn', 'error', 'debug']
      const LEVEL_LABELS: Record<Severity, string> = {
        info: 'Info',
        warn: 'Warnings',
        error: 'Errors',
        debug: 'Verbose',
      }
      const enabledLevels = ref<Record<Severity, boolean>>({
        info: true,
        warn: true,
        error: true,
        debug: true,
      })

      function toggleLevel(level: Severity) {
        enabledLevels.value = { ...enabledLevels.value, [level]: !enabledLevels.value[level] }
      }

      function isLevelEnabled(level: Severity): boolean {
        return enabledLevels.value[level]
      }

      const visibleEvents = computed(() => {
        const q = filterText.value.trim().toLowerCase()
        return events.value.filter(
          (ev) =>
            enabledLevels.value[ev.severity] && (q === '' || ev.haystack.includes(q)),
        )
      })

      const totalCounts = computed(() => {
        const acc: Record<Severity, number> = { info: 0, warn: 0, error: 0, debug: 0 }
        for (const ev of events.value) acc[ev.severity] += ev.count
        return acc
      })

      function log(name: string, payload: unknown) {
        let pretty: string
        try {
          pretty = JSON.stringify(payload, jsonReplacer, 2) ?? 'undefined'
        } catch {
          pretty = String(payload)
        }
        const preview = buildPreview(pretty)
        const top = events.value[0]
        // DevTools-style: collapse N consecutive identical entries into a
        // single row with a count badge instead of spamming the log.
        if (top && top.name === name && top.preview === preview) {
          top.count += 1
          top.ts = nowStamp()
          return
        }
        const severity = classify(name)
        events.value = [
          {
            id: nextId++,
            ts: nowStamp(),
            name,
            source: sourceFor(name),
            severity,
            count: 1,
            pretty,
            preview,
            haystack: `${name} ${preview}`.toLowerCase(),
            expanded: false,
          },
          ...events.value,
        ].slice(0, MAX_LOG)
      }

      function clearLog() {
        events.value = []
      }

      function toggleExpand(ev: LoggedEvent) {
        ev.expanded = !ev.expanded
      }

      function highlight(s: string): string {
        return highlightJson(escapeHtml(s))
      }

      // ─── Grid state piloted by the smart toolbar via v-models ────────
      // The smart toolbar owns drawer-open state and CSV export internally;
      // the persistent state below flows back through v-models so we can
      // bind it to the grid's props in the template.
      const isFullscreen = ref(false)
      const hiddenFields = ref<string[]>([])
      const density = ref<DataDensity>('default')
      const columnOrder = ref<string[] | undefined>(undefined)
      const activeGroups = ref<GroupingItem[]>([])
      const filterModel = ref<FilterModel>({ conditions: [] })
      const groupFields = computed(() => activeGroups.value.map((g) => g.field))

      // ─── Grid event handlers ──────────────────────────────────────────
      function onCellEdit(e: { rowIndex: number; field: string; newValue: unknown }) {
        log('cell-edit', e)
        const r = rows.value[e.rowIndex] as Record<string, unknown> | undefined
        if (r) r[e.field] = e.newValue
      }
      function onFill(e: { fills: Array<{ rowIndex: number; field: string; value: unknown }> }) {
        log('fill', e)
        for (const f of e.fills) {
          const r = rows.value[f.rowIndex] as Record<string, unknown> | undefined
          if (r) r[f.field] = f.value
        }
      }
      function onBulkDelete(e: {
        selection: unknown
        fills: Array<{ rowIndex: number; field: string }>
      }) {
        log('bulk-delete', e)
        for (const f of e.fills) {
          const r = rows.value[f.rowIndex] as Record<string, unknown> | undefined
          if (r) r[f.field] = ''
        }
      }


      return {
        // Static
        lmColumns,
        // Refs / state
        gridRef,
        rows,
        events,
        visibleEvents,
        totalCounts,
        filterText,
        enabledLevels,
        isFullscreen,
        hiddenFields,
        density,
        columnOrder,
        groupFields,
        filterModel,
        activeGroups,
        // Console helpers
        clearLog,
        toggleLevel,
        isLevelEnabled,
        toggleExpand,
        highlight,
        severityIcon,
        LEVELS,
        LEVEL_LABELS,
        // Grid event handlers (with side-effects)
        onCellEdit,
        onFill,
        onBulkDelete,
        // Pure log handlers
        onUpdateSelection: (e: unknown) => log('update:selection', e),
        onUpdateHiddenFields: (e: unknown) => log('update:hidden-fields', e),
        onUpdateFilterModel: (e: unknown) => log('update:filter-model', e),
        onColumnMenuAction: (e: unknown) => log('column-menu-action', e),
        onPageChange: (e: unknown) => log('page-change', e),
        onFilterChange: (e: unknown) => log('filter-change', e),
        onSelectionEdit: (e: unknown) => log('selection-edit', e),
        onRetry: () => log('retry', null),
      }
    },
    template: `
      <div class="sb-grid-shell">
        <h2>Event console — all features</h2>
        <p>
          Toutes les features actives. La console reproduit le comportement
          de la DevTools Chrome : icônes par niveau, badge de répétition pour
          les évents consécutifs identiques, filtre texte, toggles de
          sévérité, et payload JSON expandable au click avec coloration
          syntaxique.
        </p>

        <div class="sb-grid-frame">
          <ad-grid-vue
            ref="gridRef"
            :height="500"
            :columns="lmColumns"
            :rows="rows"
            :row-id="(row) => String(row.id)"
            selectable
            selection-bar-compact
            expandable


            :container-height="440"
            :pagination="true"
            history-id="event-console-demo"
            :fullscreen="isFullscreen"
            :hidden-fields="hiddenFields"
            :group-fields="groupFields"
            :density="density"
            :column-order="columnOrder"
            @update:selection="onUpdateSelection"
            @update:hidden-fields="onUpdateHiddenFields"
            @update:filter-model="onUpdateFilterModel"
            @column-menu-action="onColumnMenuAction"
            @cell-edit="onCellEdit"
            @fill="onFill"
            @page-change="onPageChange"
            @filter-change="onFilterChange"
            @bulk-delete="onBulkDelete"
            @selection-edit="onSelectionEdit"
            @retry="onRetry"
          >
            <!-- Toolbar must live inside the grid via the #toolbar slot:
                 fullscreen flips the grid root to position:fixed; inset:0,
                 which would otherwise hide a sibling toolbar. The smart
                 toolbar bundles the four feature drawers + their wiring
                 internally — the consumer just picks the show-* features. -->
            <template #toolbar>
              <ad-grid-toolbar
                :grid="gridRef"
                :columns="lmColumns"
                v-model:fullscreen="isFullscreen"
                v-model:hidden-fields="hiddenFields"
                v-model:density="density"
                v-model:column-order="columnOrder"
                v-model:active-groups="activeGroups"
                v-model:filter-model="filterModel"
                show-fullscreen
                show-export
                show-filters
                show-settings
                show-group
                show-keyboard
                export-filename="event-console.csv"
              />
            </template>
            <template #expand-row="{ row }">
              <div class="sb-evlog__expand">
                <strong>{{ row.name }}</strong>
                <span>· {{ row.brand }}</span>
                <span>· stock {{ row.stock }}</span>
                <span>· {{ typeof row.price === 'number' ? row.price.toFixed(2) : row.price }} €</span>
                <span>· {{ row.store }}</span>
              </div>
            </template>
          </ad-grid-vue>
        </div>

        <div class="sb-evlog">
          <div class="sb-evlog__bar">
            <button
              type="button"
              class="sb-evlog__icon-btn"
              :title="'Clear console'"
              @click="clearLog"
              aria-label="Clear console"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M2 4h12M6 4V2.5h4V4M4 4l1 9.5h6L12 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="sb-evlog__sep"></div>
            <div class="sb-evlog__filter">
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
                <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              <input
                v-model="filterText"
                type="text"
                placeholder="Filter"
                class="sb-evlog__filter-input"
                spellcheck="false"
              />
            </div>
            <div class="sb-evlog__sep"></div>
            <button
              v-for="lvl in LEVELS"
              :key="lvl"
              type="button"
              class="sb-evlog__chip"
              :class="['sb-evlog__chip--' + lvl, isLevelEnabled(lvl) ? 'sb-evlog__chip--on' : '']"
              @click="toggleLevel(lvl)"
            >
              <span class="sb-evlog__chip-dot" aria-hidden="true"></span>
              {{ LEVEL_LABELS[lvl] }}
              <span class="sb-evlog__chip-count">{{ totalCounts[lvl] }}</span>
            </button>
          </div>
          <div class="sb-evlog__list" role="log" aria-live="polite">
            <div v-if="visibleEvents.length === 0" class="sb-evlog__empty">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M5 7l4 4-4 4M11 17h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span v-if="events.length === 0">Aucun évent. Sélectionne, édite, filtre, change de page…</span>
              <span v-else>Aucun évent ne correspond aux filtres actuels.</span>
            </div>
            <div
              v-for="ev in visibleEvents"
              :key="ev.id"
              class="sb-evlog__row"
              :class="['sb-evlog__row--' + ev.severity, ev.expanded ? 'sb-evlog__row--expanded' : '']"
              @click="toggleExpand(ev)"
            >
              <span class="sb-evlog__chevron" :class="ev.expanded ? 'sb-evlog__chevron--open' : ''" aria-hidden="true">▸</span>
              <span class="sb-evlog__icon" :class="'sb-evlog__icon--' + ev.severity" aria-hidden="true">{{ severityIcon(ev.severity) }}</span>
              <span class="sb-evlog__ts">{{ ev.ts }}</span>
              <span class="sb-evlog__name">{{ ev.name }}</span>
              <span v-if="ev.count > 1" class="sb-evlog__count" :title="ev.count + ' occurrences consécutives'">{{ ev.count }}</span>
              <span v-if="!ev.expanded" class="sb-evlog__preview">{{ ev.preview }}</span>
              <span class="sb-evlog__source">{{ ev.source }}</span>
              <pre v-if="ev.expanded" class="sb-evlog__payload" v-html="highlight(ev.pretty)"></pre>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}
