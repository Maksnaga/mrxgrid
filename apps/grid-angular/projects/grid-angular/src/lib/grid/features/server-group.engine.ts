/**
 * ServerGroupEngine — server-side grouping for the Angular grid.
 *
 * Ported from Vue `useServerGrouping.ts`
 * (mrxgrid/src/composables/useServerGrouping.ts).
 * Spec: REFONTE-PLAN-V2 task B9.
 *
 * In server-grouping mode the grid does NOT call `GroupEngine.groupData()`.
 * Instead, the consumer provides:
 *  - `fetchGroups(fields)` — returns the list of group summaries (value + count).
 *  - `fetchGroupRows(field, value, start, end)` — returns rows for a page inside
 *    an expanded group.
 *
 * The engine maintains its own `loadedGroups` / `loadingGroups` state and
 * exposes a flat `displayRows` computed that replaces the normal pipeline's
 * output when active.
 *
 * `grid.ts` injects ServerGroupEngine and exposes `groupMode` + `serverGroupingOptions`
 * inputs. When `groupMode === 'server'`, `onGroupToggle` is routed to this engine.
 * `state.groupMode` signal gates the routing. The `GridEngine.displayRows` computed
 * still uses the client pipeline — consumers in server-group mode should read
 * `serverGroupEngine.flatRows()` directly via a plugin or a custom wrapper.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { GroupEntry } from '../models/grid-events.model';
import { DisplayRow, GroupRow } from '../models/display-row.model';

// ---------------------------------------------------------------------------
// Public contract types
// ---------------------------------------------------------------------------

export interface GroupSummary {
  /** Raw group value (the distinct field value). */
  value: unknown;
  /** Total number of rows in this group on the server. */
  count: number;
}

export interface ServerGroupingOptions<T = unknown> {
  /**
   * Fetch the list of distinct group values + counts for the given fields.
   * Called when group fields change.
   */
  fetchGroups: (fields: string[]) => Promise<GroupSummary[]>;

  /**
   * Fetch a slice of rows for a specific group value.
   * `start` and `end` are zero-based indices within the group.
   */
  fetchGroupRows: (
    field: string,
    value: unknown,
    start: number,
    end: number,
  ) => Promise<T[]>;

  /** Page size for lazy-loading rows within an expanded group. Default: 100. */
  pageSize?: number;
}

interface GroupCache<T> {
  rows: Array<T | null>;
  total: number;
  loaded: number;
  /** Pages already fetched or in-flight. */
  fetchedPages: Set<number>;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

@Injectable()
export class ServerGroupEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  // ── Configuration ────────────────────────────────────────────────────────

  /** Options provided by the consumer. When null, the engine is inactive. */
  private options: ServerGroupingOptions<T> | null = null;

  configure(opts: ServerGroupingOptions<T> | null): void {
    this.options = opts;
    if (!opts) {
      this.groupSummaries.set([]);
      this.expandedKeys.set(new Set());
      this.loadedGroups.set(new Map());
    }
  }

  // ── Local state ─────────────────────────────────────────────────────────

  /** Group field stack (mirrors `state.groupColumns` but owns server semantics). */
  readonly groupFields = computed<string[]>(() =>
    this.state.groupColumns().map((g) => g.field),
  );

  /** Whether the engine is active (options configured + at least one field). */
  readonly active = computed(
    () => this.options !== null && this.groupFields().length > 0,
  );

  /** Server-provided group summaries (value + count). */
  readonly groupSummaries = signal<GroupSummary[]>([]);

  /** Set of group keys that are currently expanded. */
  readonly expandedKeys = signal<Set<string>>(new Set());

  /** Loaded row caches per group key. */
  readonly loadedGroups = signal<Map<string, GroupCache<T>>>(new Map());

  /** Set of group keys where a fetch is in flight. */
  readonly loadingGroups = signal<Set<string>>(new Set());

  /** `true` when the summary-level fetch is in flight. */
  readonly isFetchingSummaries = signal(false);

  /** `true` when any group-level fetch is in flight. */
  readonly isLoading = computed(
    () =>
      this.isFetchingSummaries() ||
      this.loadingGroups().size > 0,
  );

  private _pageSize(): number {
    return this.options?.pageSize ?? 100;
  }

  // ── Group field management (mirrors GroupEngine API) ─────────────────────

  addGroup(field: string): void {
    const current = this.state.groupColumns();
    if (current.some((g) => g.field === field)) return;
    this.state.groupColumns.set([...current, { field, sortDirection: 'asc' }]);
    this.fetchGroupSummaries();
  }

  removeGroup(field: string): void {
    this.state.groupColumns.update((cols) => cols.filter((g) => g.field !== field));
    // Clean expanded state for this field.
    this.expandedKeys.update((keys) => {
      const next = new Set(keys);
      for (const key of next) {
        if (key.includes(`${field}::`)) next.delete(key);
      }
      return next;
    });
    this.fetchGroupSummaries();
  }

  clearGroups(): void {
    this.state.groupColumns.set([]);
    this.groupSummaries.set([]);
    this.expandedKeys.set(new Set());
    this.loadedGroups.set(new Map());
  }

  applyGroups(groups: GroupEntry[]): void {
    this.state.groupColumns.set(groups);
    this.fetchGroupSummaries();
  }

  // ── Summary fetch ────────────────────────────────────────────────────────

  async fetchGroupSummaries(): Promise<void> {
    const opts = this.options;
    const fields = this.groupFields();
    if (!opts || fields.length === 0) {
      this.groupSummaries.set([]);
      return;
    }

    this.isFetchingSummaries.set(true);
    try {
      const summaries = await opts.fetchGroups(fields);
      this.groupSummaries.set(summaries);
      // Reset expand / cache state on new summary fetch.
      this.expandedKeys.set(new Set());
      this.loadedGroups.set(new Map());
    } finally {
      this.isFetchingSummaries.set(false);
    }
  }

  // ── Expand / collapse ────────────────────────────────────────────────────

  toggleGroupExpand(groupKey: string): void {
    this.expandedKeys.update((keys) => {
      const next = new Set(keys);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
        // Trigger initial row fetch for this group if not cached.
        const field = this.groupFields()[0];
        const summary = this.groupSummaries().find(
          (s) => this._buildKey(field!, s.value) === groupKey,
        );
        if (summary && field && !this.loadedGroups().has(groupKey)) {
          this.expandGroupServer(groupKey, field, summary.value, summary.count, 0);
        }
      }
      return next;
    });
  }

  isGroupExpanded(groupKey: string): boolean {
    return this.expandedKeys().has(groupKey);
  }

  // ── Server fetch of rows within an expanded group ────────────────────────

  /**
   * Fetches page `page` of rows for `groupKey`. No-op if already fetched or
   * no options are configured.
   */
  async expandGroupServer(
    groupKey: string,
    field: string,
    value: unknown,
    total: number,
    page: number,
  ): Promise<void> {
    const opts = this.options;
    if (!opts) return;

    // Initialise the cache entry if needed.
    const existingMap = this.loadedGroups();
    let cache = existingMap.get(groupKey);
    if (!cache) {
      cache = { rows: [], total, loaded: 0, fetchedPages: new Set() };
      const next = new Map(existingMap);
      next.set(groupKey, cache);
      this.loadedGroups.set(next);
    }

    if (cache.fetchedPages.has(page)) return;
    cache.fetchedPages.add(page);

    const ps = this._pageSize();
    const start = page * ps;
    const end = Math.min(start + ps, total);

    this.loadingGroups.update((s) => new Set([...s, groupKey]));

    try {
      const fetched = await opts.fetchGroupRows(field, value, start, end);
      this.loadedGroups.update((map) => {
        const updated = new Map(map);
        const existing = updated.get(groupKey);
        if (!existing) return updated;
        const rows = [...existing.rows];
        // Ensure array is long enough.
        while (rows.length < end) rows.push(null);
        for (let i = 0; i < fetched.length; i++) {
          rows[start + i] = fetched[i] ?? null;
        }
        updated.set(groupKey, {
          ...existing,
          rows,
          loaded: rows.filter((r) => r !== null).length,
        });
        return updated;
      });
    } finally {
      this.loadingGroups.update((s) => {
        const next = new Set(s);
        next.delete(groupKey);
        return next;
      });
    }
  }

  // ── Flat renderable rows ─────────────────────────────────────────────────

  /**
   * Flat list of rows ready for virtual scroll, typed as `DisplayRow<T>[]` so
   * `GridEngine.displayRows` can consume it without a cast.
   *
   * - Group header rows become `{ type: 'group', group: GroupRow<T> }`.
   * - Loaded data rows become `{ type: 'data', data: T, index: number, depth: 1 }`.
   * - Skeleton/placeholder rows become `{ type: 'data', data: skeletonSentinel, ... }`
   *   where `skeletonSentinel` is a plain object that carries `__adgSkeleton: true`
   *   and the offset metadata needed by `onVisibleRangeChange`.
   */
  readonly flatRows = computed<DisplayRow<T>[]>(() => {
    if (!this.active()) return [];

    const fields = this.groupFields();
    const field = fields[0];
    if (!field) return [];

    const def = this.state.columnDefMap().get(field);
    const headerName = def?.headerName ?? field;
    const result: DisplayRow<T>[] = [];
    const summaries = this.groupSummaries();
    const expandedSet = this.expandedKeys();
    const loadedMap = this.loadedGroups();
    let dataIndex = 0;

    for (const summary of summaries) {
      const key = this._buildKey(field, summary.value);
      const isExpanded = expandedSet.has(key);

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
      };

      result.push({ type: 'group', group: groupRow });

      if (!isExpanded) continue;

      const cache = loadedMap.get(key);
      if (!cache) {
        // Cache not ready — emit all-skeleton placeholder rows.
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
          });
        }
        continue;
      }

      for (let i = 0; i < cache.total; i++) {
        const row = cache.rows[i];
        if (row !== null && row !== undefined) {
          result.push({ type: 'data', data: row, index: dataIndex++, depth: 1 });
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
          });
        }
      }
    }

    return result;
  });

  // ── Lazy-load trigger ────────────────────────────────────────────────────

  /**
   * Called by the grid body when the visible range changes. Detects skeleton
   * rows inside expanded groups and fetches their pages on demand.
   */
  onVisibleRangeChange(startIdx: number, endIdx: number): void {
    const rows = this.flatRows();
    const ps = this._pageSize();
    const field = this.groupFields()[0];
    if (!field) return;

    for (let i = startIdx; i < endIdx && i < rows.length; i++) {
      const displayRow = rows[i];
      if (!displayRow || displayRow.type !== 'data') continue;
      const data = displayRow.data as Record<string, unknown>;
      if (!data || !data['__adgSkeleton'] || !data['__adgGroupKey']) continue;
      const key = String(data['__adgGroupKey']);
      const offset = Number(data['__adgOffsetInGroup'] ?? 0);
      const page = Math.floor(offset / ps);
      const summary = this.groupSummaries().find(
        (s) => this._buildKey(field, s.value) === key,
      );
      if (summary) {
        this.expandGroupServer(key, field, summary.value, summary.count, page);
      }
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private _buildKey(field: string, value: unknown): string {
    return `${field}::${String(value ?? '')}`;
  }
}
