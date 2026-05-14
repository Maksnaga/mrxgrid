<script setup lang="ts">
/**
 * GridFixtures — playground page for Playwright visual regression tests.
 *
 * Navigate to `/?fixtures=<state-id>` to render the grid in a specific
 * visual state. The Playwright suite (`e2e/visual.spec.ts`) consumes these
 * URLs to take screenshots at a stable, pixel-precise configuration.
 *
 * Each state name maps to a `data-fixture` attribute on the root so tests
 * can wait for the right page to be ready before snapshotting:
 *
 *   await page.goto('/?fixtures=cell-default')
 *   await page.locator('[data-fixture="cell-default"]').waitFor()
 *
 * To add a new state: append it to `FIXTURES` below + handle it in the
 * `setup()` block. Keep the row data tiny (≤ 5 rows) so screenshots are
 * deterministic.
 */

import { computed, onMounted, ref } from 'vue'
import { MrxGrid } from '@/components/MrxGrid'
import type { ColumnDef, RowData } from '@/components/MrxGrid'

// ---------------------------------------------------------------------------
// Fixture state — read from URL query string `?fixtures=<state>`.
// ---------------------------------------------------------------------------

function readFixtureState(): string {
  if (typeof window === 'undefined') return 'default'
  const params = new URLSearchParams(window.location.search)
  return params.get('fixtures') ?? 'default'
}

const state = ref<string>(readFixtureState())

// ---------------------------------------------------------------------------
// Static fixture data — kept tiny + deterministic for stable screenshots.
// ---------------------------------------------------------------------------

const columns: ColumnDef[] = [
  { field: 'name', headerName: 'Name', width: '160px', editable: true },
  { field: 'role', headerName: 'Role', width: '120px', editable: true },
  { field: 'status', headerName: 'Status', width: '120px', pinned: 'right' },
  {
    field: 'email',
    headerName: 'Email',
    width: '220px',
    editable: true,
    cellValidator: (v) => {
      if (typeof v !== 'string' || !v.includes('@')) return 'Invalid email'
      return true
    },
  },
]

const rows: RowData[] = [
  { id: 1, name: 'Alice', role: 'Admin', status: 'active', email: 'alice@example.com' },
  { id: 2, name: 'Bob', role: 'Editor', status: 'active', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', role: 'Viewer', status: 'inactive', email: 'invalid-email' },
  { id: 4, name: 'Dana', role: 'Editor', status: 'active', email: 'dana@example.com' },
  { id: 5, name: 'Erik', role: 'Viewer', status: 'active', email: 'erik@example.com' },
]

// ---------------------------------------------------------------------------
// Fixture catalog — one entry per visual state covered by visual.spec.ts.
// ---------------------------------------------------------------------------

const FIXTURES = {
  default: { selectable: false, expandable: false, density: 'default' as const },
  selectable: { selectable: true, expandable: false, density: 'default' as const },
  expandable: { selectable: false, expandable: true, density: 'default' as const },
  'density-compact': {
    selectable: false,
    expandable: false,
    density: 'compact' as const,
  },
  'density-comfortable': {
    selectable: false,
    expandable: false,
    density: 'comfortable' as const,
  },
  empty: {
    selectable: false,
    expandable: false,
    density: 'default' as const,
    emptyRows: true,
  },
  loading: {
    selectable: false,
    expandable: false,
    density: 'default' as const,
    loading: true,
  },
  error: {
    selectable: false,
    expandable: false,
    density: 'default' as const,
    error: new Error('Failed to load rows'),
  },
}

const fixture = computed(
  () =>
    FIXTURES[state.value as keyof typeof FIXTURES] ?? FIXTURES.default,
)

const renderRows = computed(() =>
  ('emptyRows' in fixture.value && fixture.value.emptyRows ? [] : rows) as RowData[],
)

const fixtureLoading = computed(() =>
  'loading' in fixture.value ? fixture.value.loading : false,
)

const fixtureError = computed(() =>
  'error' in fixture.value ? fixture.value.error : null,
)

// ---------------------------------------------------------------------------
// Hash listener — supports navigating between fixtures without a full reload.
// Useful in dev: `/?fixtures=cell-default` then change query manually.
// ---------------------------------------------------------------------------

onMounted(() => {
  window.addEventListener('popstate', () => {
    state.value = readFixtureState()
  })
})
</script>

<template>
  <div :data-fixture="state" class="fixtures-root">
    <header class="fixtures-header">
      <h1>MrxGrid fixtures · <code>{{ state }}</code></h1>
      <p class="fixtures-hint">Navigate via <code>?fixtures=&lt;state&gt;</code></p>
    </header>
    <MrxGrid
      :columns="columns"
      :rows="renderRows"
      :selectable="fixture.selectable"
      :expandable="fixture.expandable"
      :density="fixture.density"
      :loading="fixtureLoading"
      :error="fixtureError"
    />
  </div>
</template>

<style scoped>
.fixtures-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: system-ui, -apple-system, sans-serif;
}

.fixtures-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.fixtures-header h1 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.fixtures-header code {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  background: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #e0e0e0;
}

.fixtures-hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: #666;
}
</style>
