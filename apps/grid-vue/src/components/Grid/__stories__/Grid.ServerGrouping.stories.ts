import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref, shallowRef } from 'vue'
import { AdGridVue } from '@/components/Grid'
import type { ServerGroupEngineOptions, ServerGroupSummary } from '@/components/Grid'
import { lmColumns, generateLMProducts, type LMProduct } from './_fixtures'

/**
 * Stories for the Angular-parity `useServerGroupEngine` wired through
 * `Grid.vue`'s `groupMode="server"` + `serverGrouping` props.
 *
 * Surface:
 *   - props : `groupMode`, `groupFields`, `serverGrouping`
 *   - events: `serverGroupingExpand`, `serverGroupingCollapse`
 *   - ref API: `setServerGroupRoots`, `setServerGroupChildren`,
 *              `expandServerGroup`, `serverGroupEngine`
 */
const meta = {
  title: 'Stories/Grouping/Server-side (engine)',
  component: AdGridVue,
  tags: ['autodocs'],
  args: { rows: [] },
  parameters: {
    docs: {
      description: {
        component: `
# Server-side grouping (engine)

Drop-in replacement for the legacy \`useServerGrouping\` composable. Produces a
\`DisplayRow<T>[]\` discriminated union (the Angular-parity shape) instead of
the \`__adg\`-flat \`RowData[]\`.

## Two ways to feed children

1. **Options-driven** — pass \`serverGrouping={ fetchGroups, fetchGroupRows }\` ;
   the engine fetches summaries on activation and pages on expand.
2. **Event + ref** — listen to \`@serverGroupingExpand\`, call
   \`gridRef.value.setServerGroupChildren(groupKey, rows)\` when your async
   fetch resolves.

Mutually exclusive at runtime with the client \`useGroupEngine\` via
\`groupMode\`.
        `,
      },
    },
  },
} satisfies Meta<typeof AdGridVue>

export default meta
type Story = StoryObj<typeof meta>

// Mock backend — keeps everything in memory but mimics paged async access.
const DATASET = generateLMProducts(2_000)

function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function buildSummaries(field: keyof LMProduct): ServerGroupSummary[] {
  const counts = new Map<unknown, number>()
  for (const row of DATASET) {
    const v = row[field]
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count }))
}

export const OptionsDriven: Story = {
  parameters: {
    docs: {
      description: {
        story: `
Provide a \`serverGrouping\` object exposing \`fetchGroups\` + \`fetchGroupRows\`.
The engine handles the lifecycle: summary fetch on mount, lazy per-group page
fetch on expand + scroll.
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup() {
      const groupFields = ref<string[]>(['category'])
      const serverGrouping: ServerGroupEngineOptions<LMProduct> = {
        pageSize: 50,
        async fetchGroups(fields) {
          const field = fields[0] as keyof LMProduct
          return delay(buildSummaries(field))
        },
        async fetchGroupRows(field, value, start, end) {
          const rows = DATASET.filter(
            (r) => r[field as keyof LMProduct] === value,
          ).slice(start, end)
          return delay(rows)
        },
      }
      return { lmColumns, groupFields, serverGrouping }
    },
    template: `
      <div style="height: 540px; display: flex; flex-direction: column;">
        <h3 style="margin: 0 0 8px;">Options-driven server grouping (2 000 rows)</h3>
        <p style="margin: 0 0 12px; color: #666;">
          Click a group header to expand it — the engine fetches the page
          asynchronously, skeleton rows fill the gap while in flight.
        </p>
        <ad-grid-vue
          :columns="lmColumns"
          :rows="[]"
          :group-fields="groupFields"
          :server-grouping="serverGrouping"
          group-mode="server"
        />
      </div>
    `,
  }),
}

export const EventAndRefApi: Story = {
  parameters: {
    docs: {
      description: {
        story: `
Listen to \`@serverGroupingExpand\` and push the children back via
\`gridRef.value.setServerGroupChildren(groupKey, rows)\`. The grid does not
need a \`serverGrouping\` options object in this mode — the consumer owns
the async lifecycle (Pinia store, React Query, etc.).
        `,
      },
    },
  },
  render: () => ({
    components: { AdGridVue },
    setup() {
      const gridRef = ref<{
        setServerGroupRoots: (s: ServerGroupSummary[]) => void
        setServerGroupChildren: (key: string, rows: LMProduct[]) => void
      } | null>(null)
      const groupFields = ref<string[]>(['brand'])
      const lastEvent = shallowRef<string>('')

      // Seed roots imperatively (no `serverGrouping` options).
      function seedRoots(): void {
        const summaries = buildSummaries('brand')
        gridRef.value?.setServerGroupRoots(summaries)
      }
      // When the user expands a root, fake a request → reply.
      function onExpand(payload: { groupKey: string; field: string; value: unknown }): void {
        lastEvent.value = `expand: ${payload.groupKey}`
        const rows = DATASET.filter((r) => r.brand === payload.value).slice(0, 100)
        setTimeout(() => {
          gridRef.value?.setServerGroupChildren(payload.groupKey, rows)
        }, 400)
      }
      function onCollapse(payload: { groupKey: string }): void {
        lastEvent.value = `collapse: ${payload.groupKey}`
      }

      return {
        gridRef,
        groupFields,
        lastEvent,
        onExpand,
        onCollapse,
        seedRoots,
        lmColumns,
      }
    },
    mounted() {
      ;(this as unknown as { seedRoots?: () => void }).seedRoots?.()
    },
    template: `
      <div style="height: 540px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <button @click="seedRoots">Re-seed roots</button>
          <span style="color: #666;">Last event: <code>{{ lastEvent }}</code></span>
        </div>
        <ad-grid-vue
          ref="gridRef"
          :columns="lmColumns"
          :rows="[]"
          :group-fields="groupFields"
          group-mode="server"
          @serverGroupingExpand="onExpand"
          @serverGroupingCollapse="onCollapse"
        />
      </div>
    `,
  }),
}
