import { computed, type ComputedRef, type Ref } from 'vue'
import type { ColumnDef, RowData } from '@/components/MrxGrid/types'
import type { GridState } from '@/components/MrxGrid/state/useGridState'

export type FilterValues = Record<string, unknown>

/**
 * Filter row (slot / quick filter) UI adapter.
 *
 * Owns ONLY `gridState.quickFilters` — the per-column inline filter row
 * inputs. The formal multi-condition `gridState.filterModel` (filter
 * drawer + "filter in this column" overlay) lives elsewhere and is NOT
 * touched here. Both surfaces compose at evaluation time inside
 * `filterData`, but neither overwrites the other on apply.
 *
 * `filters` is a `Record<field, value>` view of the row inputs. Date-range
 * inputs use `{ from, to }`; everything else is a primitive.
 */
export function useFiltering<T extends RowData = RowData>(
  gridState: GridState<T>,
  columns: Ref<ColumnDef[]>,
) {
  void columns

  // --- Quick filters view (Record<field, value>) --------------------------

  const filters: ComputedRef<FilterValues> = computed(() => ({
    ...gridState.quickFilters.value,
  }))

  const hasActiveFilters: ComputedRef<boolean> = computed(
    () =>
      Object.values(gridState.quickFilters.value).some((v) => isNonEmpty(v)) ||
      gridState.filterModel.value.conditions.length > 0,
  )

  // --- Mutators (writes to `quickFilters` only) ---------------------------

  /** Set or clear a single quick-filter (filter row) value. Independent
   *  from the formal `filterModel` written by the drawer / "filter in
   *  this column" overlay. */
  function setFilter(field: string, value: unknown): void {
    const next = { ...gridState.quickFilters.value }
    if (isNonEmpty(value)) {
      next[field] = value
    } else {
      delete next[field]
    }
    gridState.quickFilters.value = next
    gridState.pageIndex.value = 0
  }

  /** Clear ONLY the quick-filter row inputs. Drawer conditions are kept —
   *  use `gridEngine.filter.clearAll` for the formal model. */
  function clearFilters(): void {
    if (Object.keys(gridState.quickFilters.value).length === 0) return
    gridState.quickFilters.value = {}
    gridState.pageIndex.value = 0
  }

  return {
    filters,
    hasActiveFilters,
    setFilter,
    clearFilters,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNonEmpty(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string' && v.trim() === '') return false
  if (isDateRange(v) && v.from == null && v.to == null) return false
  return true
}

function isDateRange(v: unknown): v is { from: string | null; to: string | null } {
  return typeof v === 'object' && v !== null && 'from' in v && 'to' in v
}
