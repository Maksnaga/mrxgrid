/**
 * Server-group engine — Angular parity (`ServerGroupEngine`).
 *
 * Mirrors `apps/grid-angular/projects/grid-angular/src/lib/grid/features/server-group.engine.ts`
 * as a Vue composable. Output is a `DisplayRow<T>[]` discriminated union
 * (NOT the legacy `__adg`-flat `RowData` produced by the older
 * `src/composables/useServerGrouping.ts`) — this is the shape consumed by
 * the Angular-parity pipeline in `useGridEngine`.
 *
 * Lifecycle:
 *   1. Consumer provides `ServerGroupingOptions` (fetchGroups / fetchGroupRows)
 *      and toggles `state.groupMode = 'server'`.
 *   2. The engine fetches group summaries (value + count) via `fetchGroups`
 *      whenever `state.groupColumns` changes.
 *   3. Expanding a group triggers a paged `fetchGroupRows` call; the
 *      virtualizer drives subsequent pages via `onVisibleRangeChange`.
 *
 * Coexistence: the client `useGroupEngine` keeps owning `state.groupColumns`
 * + `state.expandedGroups` so the imperative API (`addGroup`,
 * `toggleGroupExpand`, …) is identical regardless of mode. Mutual exclusion
 * happens at `useGridEngine.displayRows` based on `state.groupMode`.
 */

import { computed, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue'

import type { DisplayRow, GroupRow } from '../models/display-row.model'
import type { GridState } from '../state/useGridState'
import type { GroupEntry } from '../models/grid-events.model'
import type { RowData } from '../types'

// ---------------------------------------------------------------------------
// Public contract types — match Angular's `ServerGroupingOptions` 1-for-1.
// ---------------------------------------------------------------------------

/** Summary returned by the server for a single group. */
export interface GroupSummary {
  /** Raw group value (the distinct field value). */
  value: unknown
  /** Total number of rows in this group on the server. */
  count: number
}

export interface ServerGroupingOptions<T = RowData> {
  /**
   * Fetch the list of distinct group values + counts for the given fields.
   * Called when group fields change.
   */
  fetchGroups: (fields: string[]) => Promise<GroupSummary[]>

  /**
   * Fetch a slice of rows for a specific group value.
   * `start` and `end` are zero-based indices within the group.
   */
  fetchGroupRows: (
    field: string,
    value: unknown,
    start: number,
    end: number,
  ) => Promise<T[]>

  /** Page size for lazy-loading rows within an expanded group. Default: 100. */
  pageSize?: number
}

interface GroupCache<T> {
  rows: Array<T | null>
  total: number
  loaded: number
  /** Pages already fetched or in-flight. */
  fetchedPages: Set<number>
}

// ---------------------------------------------------------------------------
// Engine — composable shape mirroring Angular's `ServerGroupEngine`.
// ---------------------------------------------------------------------------

export interface ServerGroupEngine<T = RowData> {
  /** Whether options are configured AND at least one group field is set. */
  readonly active: ComputedRef<boolean>
  /** Server-provided group summaries (value + count). */
  readonly groupSummaries: Ref<GroupSummary[]>
  /** Set of group keys currently expanded. */
  readonly expandedKeys: Ref<Set<string>>
  /** Loaded row caches per group key. */
  readonly loadedGroups: Ref<Map<string, GroupCache<T>>>
  /** Set of group keys with a row-fetch in flight. */
  readonly loadingGroups: Ref<Set<string>>
  /** `true` when the summary-level fetch is in flight. */
  readonly isFetchingSummaries: Ref<boolean>
  /** `true` when any group-level fetch or the summary fetch is in flight. */
  readonly isLoading: ComputedRef<boolean>
  /** Flat `DisplayRow<T>[]` ready for the virtualizer. Empty when inactive. */
  readonly flatRows: ComputedRef<DisplayRow<T>[]>

  /** Replace / clear options. Pass `null` to reset internal state. */
  configure(opts: ServerGroupingOptions<T> | null): void

  // Group field management — mirrors `GroupEngine`.
  addGroup(field: string): void
  removeGroup(field: string): void
  clearGroups(): void
  applyGroups(groups: GroupEntry[]): void

  // Expand / collapse.
  toggleGroupExpand(groupKey: string): void
  isGroupExpanded(groupKey: string): boolean

  /**
   * Force-refresh of the summary stream (e.g., consumer mutated server-side
   * data). Safe to call without a configured options object.
   */
  fetchGroupSummaries(): Promise<void>

  /**
   * Called by the grid body when the virtualizer's visible window shifts.
   * Detects skeleton rows in the visible range and lazy-fetches their pages.
   */
  onVisibleRangeChange(startIdx: number, endIdx: number): void

  /**
   * Imperatively replace the entire summary list (consumer-driven mode for
   * tests / non-async sources). Resets caches + expanded state.
   */
  setGroupRoots(summaries: GroupSummary[]): void

  /**
   * Imperatively inject children for an expanded group. Useful when the
   * consumer manages async fetching outside of `ServerGroupingOptions`
   * (e.g., a Vuex/Pinia store) and just wants to push results to the grid.
   */
  upsertChildren(groupKey: string, children: T[], total?: number): void
}

export function useServerGroupEngine<T = RowData>(
  state: GridState<T>,
  initialOptions?: ServerGroupingOptions<T> | null,
): ServerGroupEngine<T> {
  /** Options provided by the consumer. When null, the engine is inactive. */
  const optionsRef = ref<ServerGroupingOptions<T> | null>(
    initialOptions ?? null,
  ) as Ref<ServerGroupingOptions<T> | null>

  // shallowRef for the per-group cache: the map identity changes whenever a
  // page lands, but mutating the inner rows array is fine — we always assign
  // a fresh entry through `loadedGroups.value = next`.
  const groupSummaries = shallowRef<GroupSummary[]>([])
  const expandedKeys = shallowRef<Set<string>>(new Set())
  const loadedGroups = shallowRef<Map<string, GroupCache<T>>>(new Map())
  const loadingGroups = shallowRef<Set<string>>(new Set())
  const isFetchingSummaries = ref(false)

  // ── Derived state ─────────────────────────────────────────────────────

  const groupFields = computed<string[]>(() =>
    state.groupColumns.value.map((g) => g.field),
  )

  const active = computed<boolean>(
    () => optionsRef.value !== null && groupFields.value.length > 0,
  )

  const isLoading = computed<boolean>(
    () => isFetchingSummaries.value || loadingGroups.value.size > 0,
  )

  const pageSize = (): number => optionsRef.value?.pageSize ?? 100

  // ── Configure ─────────────────────────────────────────────────────────

  function configure(opts: ServerGroupingOptions<T> | null): void {
    optionsRef.value = opts
    if (!opts) {
      groupSummaries.value = []
      expandedKeys.value = new Set()
      loadedGroups.value = new Map()
      loadingGroups.value = new Set()
    }
  }

  // ── Group field management (mirrors GroupEngine) ──────────────────────

  function addGroup(field: string): void {
    const current = state.groupColumns.value
    if (current.some((g) => g.field === field)) return
    state.groupColumns.value = [...current, { field, sortDirection: 'asc' }]
    fetchGroupSummaries()
  }

  function removeGroup(field: string): void {
    state.groupColumns.value = state.groupColumns.value.filter(
      (g) => g.field !== field,
    )
    // Clean expanded state for this field.
    const next = new Set(expandedKeys.value)
    for (const key of next) {
      if (key.includes(`${field}::`)) next.delete(key)
    }
    expandedKeys.value = next
    fetchGroupSummaries()
  }

  function clearGroups(): void {
    state.groupColumns.value = []
    groupSummaries.value = []
    expandedKeys.value = new Set()
    loadedGroups.value = new Map()
  }

  function applyGroups(groups: GroupEntry[]): void {
    state.groupColumns.value = [...groups]
    fetchGroupSummaries()
  }

  // ── Summary fetch ─────────────────────────────────────────────────────

  async function fetchGroupSummaries(): Promise<void> {
    const opts = optionsRef.value
    const fields = groupFields.value
    if (!opts || fields.length === 0) {
      groupSummaries.value = []
      return
    }
    isFetchingSummaries.value = true
    try {
      const summaries = await opts.fetchGroups(fields)
      groupSummaries.value = summaries
      // Reset expand / cache state on new summary fetch.
      expandedKeys.value = new Set()
      loadedGroups.value = new Map()
    } finally {
      isFetchingSummaries.value = false
    }
  }

  // Re-fetch summaries whenever `groupColumns` change while the engine is
  // active (groupMode-gated by the host).
  watch(
    () => groupFields.value.join('|'),
    () => {
      if (optionsRef.value && groupFields.value.length > 0) {
        fetchGroupSummaries()
      } else {
        groupSummaries.value = []
      }
    },
  )

  // ── Expand / collapse ─────────────────────────────────────────────────

  function toggleGroupExpand(groupKey: string): void {
    const next = new Set(expandedKeys.value)
    if (next.has(groupKey)) {
      next.delete(groupKey)
    } else {
      next.add(groupKey)
      // Trigger initial row fetch for this group if not cached.
      const field = groupFields.value[0]
      const summary = groupSummaries.value.find(
        (s) => buildKey(field ?? '', s.value) === groupKey,
      )
      if (summary && field && !loadedGroups.value.has(groupKey)) {
        void expandGroupServer(groupKey, field, summary.value, summary.count, 0)
      }
    }
    expandedKeys.value = next
  }

  function isGroupExpanded(groupKey: string): boolean {
    return expandedKeys.value.has(groupKey)
  }

  // ── Server fetch of rows within an expanded group ─────────────────────

  async function expandGroupServer(
    groupKey: string,
    field: string,
    value: unknown,
    total: number,
    page: number,
  ): Promise<void> {
    const opts = optionsRef.value
    if (!opts) return

    // Initialise the cache entry if needed.
    const existingMap = loadedGroups.value
    let cache = existingMap.get(groupKey)
    if (!cache) {
      cache = { rows: [], total, loaded: 0, fetchedPages: new Set() }
      const next = new Map(existingMap)
      next.set(groupKey, cache)
      loadedGroups.value = next
    }

    if (cache.fetchedPages.has(page)) return
    cache.fetchedPages.add(page)

    const ps = pageSize()
    const start = page * ps
    const end = Math.min(start + ps, total)

    const nextLoading = new Set(loadingGroups.value)
    nextLoading.add(groupKey)
    loadingGroups.value = nextLoading

    try {
      const fetched = await opts.fetchGroupRows(field, value, start, end)
      const updated = new Map(loadedGroups.value)
      const existing = updated.get(groupKey)
      if (!existing) return
      const rows = [...existing.rows]
      while (rows.length < end) rows.push(null)
      for (let i = 0; i < fetched.length; i++) {
        rows[start + i] = fetched[i] ?? null
      }
      updated.set(groupKey, {
        ...existing,
        rows,
        loaded: rows.filter((r) => r !== null).length,
      })
      loadedGroups.value = updated
    } finally {
      const cleared = new Set(loadingGroups.value)
      cleared.delete(groupKey)
      loadingGroups.value = cleared
    }
  }

  // ── Imperative APIs (consumer-driven mode) ────────────────────────────

  function setGroupRoots(summaries: GroupSummary[]): void {
    groupSummaries.value = [...summaries]
    expandedKeys.value = new Set()
    loadedGroups.value = new Map()
  }

  /**
   * Push children for a group regardless of how they were fetched. Resets the
   * cache for that group (treats `children` as the canonical row list).
   */
  function upsertChildren(
    groupKey: string,
    children: T[],
    total?: number,
  ): void {
    const updated = new Map(loadedGroups.value)
    const t = total ?? children.length
    const rows: Array<T | null> = []
    for (let i = 0; i < Math.max(t, children.length); i++) {
      rows.push(i < children.length ? (children[i] as T) : null)
    }
    updated.set(groupKey, {
      rows,
      total: t,
      loaded: children.length,
      fetchedPages: new Set([0]),
    })
    loadedGroups.value = updated
    // Auto-expand on first injection so the rows are visible.
    if (!expandedKeys.value.has(groupKey)) {
      const next = new Set(expandedKeys.value)
      next.add(groupKey)
      expandedKeys.value = next
    }
  }

  // ── Flat renderable rows (DisplayRow union) ───────────────────────────

  const flatRows = computed<DisplayRow<T>[]>(() => {
    if (!active.value) return []

    const field = groupFields.value[0]
    if (!field) return []

    const def = state.columnDefMap.value.get(field)
    const headerName = def?.headerName ?? field
    const result: DisplayRow<T>[] = []
    const summaries = groupSummaries.value
    const expandedSet = expandedKeys.value
    const loadedMap = loadedGroups.value
    let dataIndex = 0

    for (const summary of summaries) {
      const key = buildKey(field, summary.value)
      const isExpanded = expandedSet.has(key)

      // Build a GroupRow<T> for the group header.
      const groupRow: GroupRow<T> = {
        type: 'group',
        field,
        value: summary.value,
        displayValue: `${headerName}: ${String(summary.value ?? '')}`,
        depth: 0,
        count: summary.count,
        expanded: isExpanded,
        groupKey: key,
        children: [],
        parent: null,
      }

      result.push({ type: 'group', group: groupRow })

      if (!isExpanded) continue

      const cache = loadedMap.get(key)
      if (!cache) {
        // Cache not ready — emit all-skeleton placeholders.
        for (let i = 0; i < summary.count; i++) {
          result.push({
            type: 'data',
            data: {
              __adgSkeleton: true,
              __adgGroupKey: key,
              __adgOffsetInGroup: i,
            } as unknown as T,
            index: dataIndex++,
            depth: 1,
          })
        }
        continue
      }

      for (let i = 0; i < cache.total; i++) {
        const row = cache.rows[i]
        if (row !== null && row !== undefined) {
          result.push({ type: 'data', data: row, index: dataIndex++, depth: 1 })
        } else {
          result.push({
            type: 'data',
            data: {
              __adgSkeleton: true,
              __adgGroupKey: key,
              __adgOffsetInGroup: i,
            } as unknown as T,
            index: dataIndex++,
            depth: 1,
          })
        }
      }
    }

    return result
  })

  // ── Lazy-load trigger ─────────────────────────────────────────────────

  function onVisibleRangeChange(startIdx: number, endIdx: number): void {
    const rows = flatRows.value
    const ps = pageSize()
    const field = groupFields.value[0]
    if (!field) return

    for (let i = startIdx; i < endIdx && i < rows.length; i++) {
      const displayRow = rows[i]
      if (!displayRow || displayRow.type !== 'data') continue
      const data = displayRow.data as Record<string, unknown>
      if (!data || !data['__adgSkeleton'] || !data['__adgGroupKey']) continue
      const key = String(data['__adgGroupKey'])
      const offset = Number(data['__adgOffsetInGroup'] ?? 0)
      const page = Math.floor(offset / ps)
      const summary = groupSummaries.value.find(
        (s) => buildKey(field, s.value) === key,
      )
      if (summary) {
        void expandGroupServer(key, field, summary.value, summary.count, page)
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  function buildKey(field: string, value: unknown): string {
    return `${field}::${String(value ?? '')}`
  }

  return {
    active,
    groupSummaries,
    expandedKeys,
    loadedGroups,
    loadingGroups,
    isFetchingSummaries,
    isLoading,
    flatRows,
    configure,
    addGroup,
    removeGroup,
    clearGroups,
    applyGroups,
    toggleGroupExpand,
    isGroupExpanded,
    fetchGroupSummaries,
    onVisibleRangeChange,
    setGroupRoots,
    upsertChildren,
  }
}
