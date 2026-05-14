import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import type { ColumnDef, GroupSummary, RowData, ServerGroupingOptions } from '@/components/MrxGrid/types'

interface GroupCache {
  rows: RowData[]
  total: number
  loaded: number
  /** Pages already fetched or in-flight (prevents duplicates). */
  fetchedPages: Set<number>
}

/**
 * Server-side grouping composable.
 *
 * When grouping is active with lazy-loaded data, the server provides:
 * 1. Group summaries (value + count) via `fetchGroups`
 * 2. Rows within an expanded group (paginated) via `fetchGroupRows`
 *
 * The composable builds a flat `RowData[]` compatible with the existing
 * virtual scroller — group headers use `__mrx` metadata, expanded groups
 * inject real rows + skeleton placeholders for unloaded portions.
 */
export function useServerGrouping(
  columns: Ref<ColumnDef[]>,
  options: Ref<ServerGroupingOptions | undefined>,
) {
  const groupFields = shallowRef<string[]>([])
  const groupSummaries = shallowRef<GroupSummary[]>([])
  const expandedKeys = shallowRef<Set<string>>(new Set())
  const groupCaches = shallowRef<Map<string, GroupCache>>(new Map())
  const isLoading = ref(false)

  /** Whether server grouping is active (options provided + fields set). */
  const active = computed(() => !!options.value && groupFields.value.length > 0)

  const pageSize = computed(() => options.value?.pageSize ?? 100)

  // --- Group field management ---

  function setGroupFields(fields: string[]) {
    groupFields.value = [...fields]
  }

  function addGroup(field: string) {
    if (groupFields.value.includes(field)) return
    groupFields.value = [...groupFields.value, field]
  }

  function removeGroup(field: string) {
    groupFields.value = groupFields.value.filter((f) => f !== field)
    // Clean expanded state
    const next = new Set(expandedKeys.value)
    for (const key of next) {
      if (key.includes(`${field}::`)) next.delete(key)
    }
    expandedKeys.value = next
  }

  function clearGroups() {
    groupFields.value = []
    expandedKeys.value = new Set()
    groupCaches.value = new Map()
    groupSummaries.value = []
  }

  // --- Fetch groups from server ---

  async function fetchGroupSummaries() {
    const opts = options.value
    if (!opts || groupFields.value.length === 0) {
      groupSummaries.value = []
      return
    }

    isLoading.value = true
    try {
      const summaries = await opts.fetchGroups(groupFields.value)
      groupSummaries.value = summaries
      // Reset caches and expanded state on new group fetch
      expandedKeys.value = new Set()
      groupCaches.value = new Map()
    } finally {
      isLoading.value = false
    }
  }

  // Re-fetch when group fields change
  watch(groupFields, () => {
    if (options.value && groupFields.value.length > 0) {
      fetchGroupSummaries()
    } else {
      groupSummaries.value = []
    }
  })

  // --- Group expand/collapse ---

  function toggleGroupExpand(key: string) {
    const next = new Set(expandedKeys.value)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
      // Trigger initial fetch for this group if not cached
      const field = groupFields.value[0]
      const summary = groupSummaries.value.find(
        (s) => buildKey(field!, s.value) === key,
      )
      if (summary && field && !groupCaches.value.has(key)) {
        fetchGroupPage(key, field, summary.value, summary.count, 0)
      }
    }
    expandedKeys.value = next
  }

  function isGroupExpanded(key: string): boolean {
    return expandedKeys.value.has(key)
  }

  // --- Fetch rows within a group ---

  function fetchGroupPage(
    key: string,
    field: string,
    value: unknown,
    total: number,
    page: number,
  ) {
    const opts = options.value
    if (!opts) return

    const caches = new Map(groupCaches.value)
    let cache = caches.get(key)
    if (!cache) {
      cache = { rows: [], total, loaded: 0, fetchedPages: new Set() }
      caches.set(key, cache)
      groupCaches.value = caches
    }

    if (cache.fetchedPages.has(page)) return
    cache.fetchedPages.add(page)

    const ps = pageSize.value
    const start = page * ps
    const end = Math.min(start + ps, total)

    isLoading.value = true
    opts.fetchGroupRows(field, value, start, end)
      .then((fetched) => {
        const caches2 = new Map(groupCaches.value)
        const existing = caches2.get(key)
        if (!existing) return

        // Merge fetched rows at correct positions
        const rows = [...existing.rows]
        // Ensure array is large enough
        while (rows.length < end) rows.push({ __mrxSkeleton: true })
        for (let i = 0; i < fetched.length; i++) {
          rows[start + i] = fetched[i]!
        }

        caches2.set(key, {
          ...existing,
          rows,
          loaded: rows.filter((r) => !r.__mrxSkeleton).length,
        })
        groupCaches.value = caches2
      })
      .finally(() => {
        isLoading.value = false
      })
  }

  /**
   * Called by the grid when visible range changes.
   * Detects skeleton rows in expanded groups and fetches their pages.
   */
  function onVisibleRangeChange(startIdx: number, endIdx: number) {
    const flat = flatRows.value
    for (let i = startIdx; i < endIdx && i < flat.length; i++) {
      const row = flat[i]
      if (!row) continue
      if (row.__mrxSkeleton && row.__mrxGroupKey) {
        const key = String(row.__mrxGroupKey)
        const offset = Number(row.__mrxOffsetInGroup ?? 0)
        const page = Math.floor(offset / pageSize.value)
        const field = groupFields.value[0]
        const summary = groupSummaries.value.find(
          (s) => buildKey(field!, s.value) === key,
        )
        if (summary && field) {
          fetchGroupPage(key, field, summary.value, summary.count, page)
        }
      }
    }
  }

  // --- Build key ---

  function buildKey(field: string, value: unknown): string {
    return `${field}::${String(value ?? '')}`
  }

  // --- Flat renderable list ---

  const groups = computed(() =>
    groupFields.value.map((field) => {
      const col = columns.value.find((c) => c.field === field)
      return { field, headerName: col?.headerName ?? field }
    }),
  )

  const hasGroups = computed(() => active.value && groupSummaries.value.length > 0)

  const flatRows = computed<RowData[]>(() => {
    if (!active.value) return []

    const field = groupFields.value[0]
    if (!field) return []

    const headerName = columns.value.find((c) => c.field === field)?.headerName ?? field
    const result: RowData[] = []

    for (const summary of groupSummaries.value) {
      const key = buildKey(field, summary.value)

      // Group header row
      result.push({
        __mrxType: 'group',
        __mrxKey: key,
        __mrxField: field,
        __mrxValue: summary.value,
        __mrxDepth: 0,
        __mrxCount: summary.count,
        __mrxHeaderName: headerName,
      })

      // If expanded: loaded rows + skeletons for unloaded
      if (expandedKeys.value.has(key)) {
        const cache = groupCaches.value.get(key)
        if (cache) {
          for (let i = 0; i < cache.total; i++) {
            const row = cache.rows[i]
            if (row && !row.__mrxSkeleton) {
              result.push({
                ...row,
                __mrxType: 'row',
                __mrxDepth: 1,
                __mrxOriginalIndex: -1,
              })
            } else {
              result.push({
                __mrxSkeleton: true,
                __mrxType: 'row',
                __mrxDepth: 1,
                __mrxGroupKey: key,
                __mrxOffsetInGroup: i,
              })
            }
          }
        } else {
          // Cache not ready yet — all skeletons
          for (let i = 0; i < summary.count; i++) {
            result.push({
              __mrxSkeleton: true,
              __mrxType: 'row',
              __mrxDepth: 1,
              __mrxGroupKey: key,
              __mrxOffsetInGroup: i,
            })
          }
        }
      }
    }

    return result
  })

  return {
    // State
    active,
    groups,
    hasGroups,
    flatRows,
    groupFields,
    isLoading,

    // Group field management
    addGroup,
    removeGroup,
    clearGroups,
    setGroupFields,

    // Group expand/collapse
    toggleGroupExpand,
    isGroupExpanded,

    // Lazy loading within expanded groups
    onVisibleRangeChange,

    // Re-fetch
    fetchGroupSummaries,
  }
}
