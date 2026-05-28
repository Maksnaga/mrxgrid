import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import { MrxGrid } from '@/components/MrxGrid'
import type { RowData } from '@/components/MrxGrid'
import { generateLMProducts, lmColumns, type LMProduct } from './_fixtures'

const meta = {
  title: 'Stories/Lazy Loading/Page-based · Infinite scroll',
  component: MrxGrid,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Lazy loading

Deux patterns selon votre UX :

| Pattern | Quand | Hook |
|---------|-------|------|
| **Infinite scroll** | Le user scrolle, on fetch à la volée | \`:on-visible-range-change\` |
| **Page-based** | Footer "Page 3 / 250" classique | \`:pagination + @page-change\` |

### Clé commune : \`:total-count\`

Sans cette prop, le scrollbar se base sur \`rows.length\` — le scroll "saute" à chaque page chargée. Avec \`:total-count="50_000"\`, le scrollbar reflète la taille du **dataset complet** dès le mount, indépendamment des rows actuellement chargées.

### Sparse arrays

Pour l'infinite scroll, le \`rows\` array peut être **sparse** : remplissez aux bons offsets, le grid affichera des skeleton rows pour les indices non-encore-chargés. Ne réordonnez pas l'array sans rebuild.
        `,
      },
    },
  },
} satisfies Meta<typeof MrxGrid>

export default meta
type Story = StoryObj<typeof meta>

// Pretend the server holds a 50k LM catalogue. Pages are emitted with a fake delay.
const SERVER_TOTAL = 50_000
const allRows = generateLMProducts(SERVER_TOTAL)

async function fetchPage(start: number, end: number): Promise<LMProduct[]> {
  await new Promise((r) => setTimeout(r, 220))
  return allRows.slice(start, end)
}

export const InfiniteScroll: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Infinite scroll

Le grid expose \`:on-visible-range-change="(start, end) => void\` qui fire quand la fenêtre virtuelle se déplace. Vous fetchez la page correspondante et la sparse-fill dans \`rows\`.

### Implémentation

\`\`\`vue
<script setup lang="ts">
const PAGE = 200
const TOTAL = 50_000
const rows = ref<RowData[]>([])
const fetched = new Set<number>()

async function onVisibleRangeChange(start: number, end: number) {
  const firstPage = Math.floor(start / PAGE)
  const lastPage  = Math.floor(end   / PAGE)
  for (let p = firstPage; p <= lastPage; p++) {
    if (fetched.has(p)) continue
    fetched.add(p)
    const slice = await api.fetchPage(p * PAGE, (p + 1) * PAGE)
    // Sparse-fill at the right offset
    if (rows.value.length < p * PAGE + slice.length) {
      rows.value = rows.value.concat(new Array(p * PAGE + slice.length - rows.value.length))
    }
    for (let i = 0; i < slice.length; i++) {
      rows.value[p * PAGE + i] = slice[i]
    }
  }
}
</script>

<template>
  <MrxGrid
    :columns="columns"
    :rows="rows"
    :total-count="TOTAL"
    virtual-scroll
    :container-height="560"
    :on-visible-range-change="onVisibleRangeChange"
  />
</template>
\`\`\`

### Skeleton rows

Les indices "trous" (indéfini dans \`rows\`) sont rendus en skeleton (placeholder gris animé). Lazy = pas de saut visuel quand la page arrive — la skeleton row est remplacée *in place*.

### Tip — debounce

Si \`onVisibleRangeChange\` fire trop souvent (scroll rapide), debouncez côté consumer :

\`\`\`ts
import { debounce } from 'lodash-es'
const onVisible = debounce(handler, 60)
\`\`\`

### Notes

- \`fetched\` set évite les requêtes doublons
- \`:total-count\` doit refléter le total **actuel** côté serveur (peut changer si vous filtrez en server-side — re-set le total au filterChange)
        `,
      },
    },
  },
  render: () => ({
    components: { MrxGrid },
    setup() {
      const PAGE = 200
      const rows = ref<LMProduct[]>([])
      // Track which slices we already requested to avoid duplicate fetches.
      const fetched = new Set<number>()
      const loading = ref(false)
      const requested = ref('—')

      async function onVisibleRangeChange(start: number, end: number) {
        const firstPage = Math.floor(start / PAGE)
        const lastPage = Math.floor(end / PAGE)
        for (let p = firstPage; p <= lastPage; p++) {
          if (fetched.has(p)) continue
          fetched.add(p)
          loading.value = true
          requested.value = `pages [${firstPage}–${lastPage}]`
          const slice = await fetchPage(p * PAGE, (p + 1) * PAGE)
          // Sparse-fill the rows array at the right offset.
          if (rows.value.length < SERVER_TOTAL) {
            rows.value = rows.value.concat(
              Array.from({
                length: Math.max(0, p * PAGE + slice.length - rows.value.length),
              }) as LMProduct[],
            )
          }
          for (let i = 0; i < slice.length; i++) {
            const row = slice[i]
            if (row) (rows.value as RowData[])[p * PAGE + i] = row
          }
          loading.value = false
        }
      }

      return { lmColumns, rows, totalCount: SERVER_TOTAL, loading, requested, onVisibleRangeChange }
    },
    template: `
      <div class="sb-mrx-shell">
        <h2>Infinite scroll via <code>onVisibleRangeChange</code></h2>
        <p>Le grid signale la fenêtre visible ; on fetch la page correspondante. <code>:total-count</code> garde la scrollbar stable indépendamment des lignes déjà chargées.</p>
        <div class="sb-mrx-toolbar">
          {{ loading ? '⏳ chargement…' : '✓ idle' }} · dernière requête : <code>{{ requested }}</code>
        </div>
        <div class="sb-mrx-frame" style="height: 560px">
          <MrxGrid :height="560"
            :columns="lmColumns"
            :rows="rows"
            :total-count="totalCount"
            virtual-scroll
            :container-height="560"
            :on-visible-range-change="onVisibleRangeChange"
          />
        </div>
      </div>
    `,
  }),
}

export const PageBased: Story = {
  parameters: {
    docs: {
      description: {
        story: `
## Page-based lazy fetch

Pour l'UX "Page 3 / 250" classique : combinez \`:pagination\` + \`:total-count\` + écoute \`@page-change\`.

### Implémentation

\`\`\`vue
<script setup lang="ts">
const rows  = ref<Row[]>([])
const total = ref(50_000)

async function onPageChange(p: {
  page: number
  pageSize: number
  startIndex: number
  endIndex: number
}) {
  rows.value = await api.fetchPage(p.startIndex, p.endIndex + 1)
}
</script>

<template>
  <MrxGrid
    :columns="columns"
    :rows="rows"
    :total-count="total"
    :pagination="true"
    virtual-scroll
    :container-height="560"
    @page-change="onPageChange"
  />
</template>
\`\`\`

### Différence avec infinite scroll

- Pas de sparse array — \`rows\` est **remplacée à chaque page change**
- Le user voit le footer pagination, navigue par page, sait combien il y a de pages
- Pas de skeleton rows entre les pages

### Server-side combo (sort + filter)

Si vous filtrez ou triez côté serveur, écoutez aussi \`@filter-change\` et utilisez \`grid.getSortModel()\` au moment du fetch — la grille re-fire \`@page-change\` quand le sort/filter change donc une seule fonction \`onPageChange\` suffit, mais elle doit lire le sort/filter actuel pour construire la requête.
        `,
      },
    },
  },
  render: () => ({
    components: { MrxGrid },
    setup() {
      const rows = ref<LMProduct[]>(allRows.slice(0, 50))
      const lastChange = ref<string>('—')
      function onPageChange(p: {
        page: number
        pageSize: number
        startIndex: number
        endIndex: number
      }) {
        lastChange.value = `page ${p.page + 1} · ${p.pageSize}`
        rows.value = allRows.slice(p.startIndex, p.endIndex + 1)
      }
      return { lmColumns, rows, lastChange, onPageChange, totalCount: SERVER_TOTAL }
    },
    template: `
      <div class="sb-mrx-shell">
        <h2>Page-based lazy fetch (no infinite scroll)</h2>
        <p>Avec <code>:pagination="true"</code> + <code>:total-count</code>, on écoute <code>pageChange</code> pour fetch uniquement la page courante.</p>
        <div class="sb-mrx-toolbar">{{ lastChange }}</div>
        <div class="sb-mrx-frame" style="height: 560px">
          <MrxGrid :height="560"
            :columns="lmColumns"
            :rows="rows"
            :total-count="totalCount"
            :pagination="true"
            virtual-scroll
            :container-height="560"
            @page-change="onPageChange"
          />
        </div>
      </div>
    `,
  }),
}
