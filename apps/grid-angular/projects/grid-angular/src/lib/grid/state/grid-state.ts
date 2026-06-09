import { Injectable, computed, signal } from '@angular/core';
import { ColumnDef, ColumnStateEntry, SortDirection } from '../models/column.model';
import { SortDef } from '../models/sort.model';
import { CellCoord, CellEditState } from '../models/cell.model';
import { GridDensity, GroupEntry } from '../models/grid-events.model';
import { FilterModel, FilterMode } from '../models/filter.model';
import { LoadingStrategy } from '../models/pagination.model';

const DEFAULT_COLUMN_WIDTH = 150;

@Injectable()
export class GridStateManager<T = unknown> {
  // --- Source Data ---
  readonly sourceData = signal<T[]>([]);
  readonly totalItems = signal<number>(0);

  // --- Mode ---
  readonly mode = signal<'client' | 'server'>('client');

  // --- Group Mode ('client' = default GroupEngine pipeline; 'server' = ServerGroupEngine) ---
  readonly groupMode = signal<'client' | 'server'>('client');

  // --- Filter Mode (independent of mode — allows server pagination + client filtering) ---
  readonly filterMode = signal<FilterMode>('client');

  // --- Loading Strategy ---
  readonly loadingStrategy = signal<LoadingStrategy>('pagination');

  // --- Columns ---
  readonly columnDefs = signal<ColumnDef<T>[]>([]);
  readonly columnStates = signal<ColumnStateEntry[]>([]);

  // --- Sort ---
  readonly activeSorts = signal<SortDef[]>([]);

  // --- Group ---
  readonly groupColumns = signal<GroupEntry[]>([]);
  readonly expandedGroups = signal<Set<string>>(new Set());

  // --- Filter ---
  /**
   * Unified filter state: single source of truth for the multi-condition
   * builder. The tag-bar displays a derived view via `FilterEngine.toLabel()`.
   */
  readonly filterModel = signal<FilterModel>({ conditions: [] });

  /**
   * Per-column inline "quick filter" values. Independent of the builder
   * model — the FilterEngine composes both at evaluation time. Shape is
   * `{ [field]: rawInput }` where the raw input is whatever the inline
   * input committed (string for the default text input). Matches the Vue
   * grid's `quickFilters` state slot.
   */
  readonly quickFilters = signal<Record<string, string>>({});

  // --- Pagination ---
  /** `false` disables paging entirely — `paginatedData` returns the full
   * filtered set instead of slicing by `pageSize`. */
  readonly paginationEnabled = signal<boolean>(true);
  readonly pageIndex = signal<number>(0);
  readonly pageSize = signal<number>(25);
  readonly visibleRowCount = signal<number>(0);

  // --- Scroll ---
  readonly scrollLeft = signal<number>(0);
  readonly scrollTop = signal<number>(0);
  readonly scrollViewportWidth = signal<number>(0);
  readonly scrollViewportHeight = signal<number>(0);
  readonly scrollContentTotalWidth = signal<number>(0);

  // --- Horizontal virtual scroll ---
  readonly horizontalVirtualScrollEnabled = signal<boolean>(false);
  readonly visibleColumnRange = signal<{ start: number; end: number }>({ start: 0, end: 0 });

  // --- Vertical virtual scroll (custom, replaces cdk-virtual-scroll-viewport) ---
  /** Range of display-row indices currently mounted in the DOM. */
  readonly visibleRowRange = signal<{ start: number; end: number }>({ start: 0, end: 0 });
  /** Pixel offset of the first rendered row from the top of the body content. */
  readonly topSpacerHeight = signal<number>(0);
  /** Pixel offset between the last rendered row and the bottom of the body content. */
  readonly bottomSpacerHeight = signal<number>(0);
  /** Total height of all display rows (data + group, includes expanded detail). */
  readonly totalRowsHeight = signal<number>(0);

  // --- UI ---
  readonly isLoading = signal<boolean>(false);
  readonly rowHeight = signal<number>(48);
  readonly density = signal<GridDensity>('default');

  // --- Pending mutations ---
  /** Fast lookup set: `"rowId::field"` keys. Set by the root grid component. */
  readonly pendingCellLookup = signal<Set<string>>(new Set());
  /** Fast lookup set of pending row IDs. Set by the root grid component. */
  readonly pendingRowLookup = signal<Set<string | number>>(new Set());

  // --- Row Selection ---
  readonly selectedRowIds = signal<Set<unknown>>(new Set());
  readonly excludedRowIds = signal<Set<unknown>>(new Set());
  readonly selectAllMode = signal<'none' | 'page' | 'all'>('none');

  // --- Cell Selection ---
  readonly focusedCell = signal<CellCoord | null>(null);
  readonly selectedCell = signal<CellCoord | null>(null);
  readonly cellRange = signal<{ start: CellCoord; end: CellCoord } | null>(null);
  readonly isDragging = signal<boolean>(false);
  readonly focusSource = signal<'click' | 'keyboard' | null>(null);

  // --- Fill Down ---
  readonly isFilling = signal<boolean>(false);
  readonly fillAnchor = signal<CellCoord | null>(null);
  readonly fillTarget = signal<CellCoord | null>(null);

  // --- Cut (Ctrl+X) source — drives the marching-ants outline in view ---
  readonly cutSource = signal<{ start: CellCoord; end: CellCoord } | null>(null);

  // --- Expandable Rows ---
  readonly expandedRowIds = signal<Set<unknown>>(new Set());
  /**
   * Two-phase expansion: when the user toggles a row to expand, the id is
   * first added to `pendingExpansion`. A hidden measurement zone renders the
   * detail row off-screen, its ResizeObserver measures the height, and the
   * engine then PROMOTES the row from `pendingExpansion` into
   * `expandedRowIds` — at which point the visible body template mounts the
   * detail row with its height already cached, so the vertical virtual-scroll
   * engine rebuilds offsets with the correct value on the very first visible
   * render. No layout shift, no scrollbar bounce.
   *
   * `isRowExpanded(id)` returns `true` ONLY once the row is in
   * `expandedRowIds` (i.e. promoted) so the visible template never renders
   * a detail row twice (once in the measurement zone, once in the layout).
   */
  readonly pendingExpansion = signal<Set<unknown>>(new Set());
  readonly rowIdField = signal<string>('id');

  // --- Cell selection toggle ---
  readonly multiCellSelectionEnabled = signal<boolean>(true);

  // --- Selection Mode (mutual exclusion between row and cell selection) ---
  readonly activeSelectionMode = signal<'rows' | 'cells' | 'none'>('none');

  // --- Column Drag ---
  readonly draggingColumn = signal<string | null>(null);
  readonly dropIndicatorIndex = signal<number | null>(null);

  // --- Cell Edit ---
  readonly cellEditState = signal<CellEditState>({
    editingCell: null,
    originalValue: undefined,
    draftValue: undefined,
    validationError: null,
  });

  /** `true` while the user is editing a formula inside the top formula bar
   *  (outside any cell). Consumed by `FormulaEngine.isFormulaEditActive`
   *  so headers show column-letter badges during bar-driven edits too. */
  readonly formulaBarEditingActive = signal<boolean>(false);

  // --- Computed: visible columns (pinned-start first, unpinned middle, pinned-end last) ---
  readonly visibleColumns = computed(() => {
    const cols = this.columnStates()
      .filter((col) => col.visible)
      .sort((a, b) => a.order - b.order);
    const pinnedLeft = cols.filter((c) => c.pinned === 'start');
    const unpinned = cols.filter((c) => !c.pinned);
    const pinnedRight = cols.filter((c) => c.pinned === 'end');
    return [...pinnedLeft, ...unpinned, ...pinnedRight];
  });

  // --- Computed: column subsets for 3-panel layout ---
  readonly pinnedLeftColumns = computed(() =>
    this.visibleColumns().filter((c) => c.pinned === 'start')
  );

  readonly unpinnedColumns = computed(() => this.visibleColumns().filter((c) => !c.pinned));

  readonly pinnedRightColumns = computed(() =>
    this.visibleColumns().filter((c) => c.pinned === 'end')
  );

  readonly pinnedLeftWidth = computed(() =>
    this.pinnedLeftColumns().reduce((sum, c) => sum + c.currentWidth, 0)
  );

  readonly pinnedRightWidth = computed(() =>
    this.pinnedRightColumns().reduce((sum, c) => sum + c.currentWidth, 0)
  );

  /**
   * Cumulative `left` offset (px) for each pinned-left column, in render
   * order. Consumers add their own utility-cell prefix (checkbox/expand) and
   * pass the result to `position: sticky; left: <offset>px`.
   * Returns an array of length `pinnedLeftColumns().length`.
   */
  readonly pinnedLeftCumulativeOffsets = computed(() => {
    const cols = this.pinnedLeftColumns();
    const out = new Array<number>(cols.length);
    let off = 0;
    for (let i = 0; i < cols.length; i++) {
      out[i] = off;
      off += cols[i].currentWidth;
    }
    return out;
  });

  /**
   * Cumulative `right` offset (px) for each pinned-right column, in render
   * order. The first column from the right (visually leftmost in the
   * pinned-right group) has the largest `right` offset.
   */
  readonly pinnedRightCumulativeOffsets = computed(() => {
    const cols = this.pinnedRightColumns();
    const out = new Array<number>(cols.length);
    let off = 0;
    for (let i = cols.length - 1; i >= 0; i--) {
      out[i] = off;
      off += cols[i].currentWidth;
    }
    return out;
  });

  readonly unpinnedWidth = computed(() =>
    this.unpinnedColumns().reduce((sum, c) => sum + c.currentWidth, 0)
  );

  /**
   * Unpinned columns actually rendered in data rows. When horizontal virtual scroll
   * is disabled, this is the full set; when enabled, it's the slice inside the
   * current visibleColumnRange. Header and filter row keep rendering the full set —
   * only row cells are virtualized.
   */
  /**
   * Effective column range with edit-mode widening: keeps the column being edited
   * inside the rendered window so the editor never gets torn down mid-edit.
   */
  readonly effectiveColumnRange = computed(() => {
    const raw = this.visibleColumnRange();
    const editing = this.cellEditState().editingCell;
    if (!editing) return raw;
    const pinnedLeftCount = this.pinnedLeftColumns().length;
    const unpinnedIdx = editing.col - pinnedLeftCount;
    const total = this.unpinnedColumns().length;
    if (unpinnedIdx < 0 || unpinnedIdx >= total) return raw;
    return {
      start: Math.min(raw.start, unpinnedIdx),
      end: Math.max(raw.end, unpinnedIdx + 1),
    };
  });

  readonly renderedUnpinnedColumns = computed(() => {
    const all = this.unpinnedColumns();
    if (!this.horizontalVirtualScrollEnabled()) return all;
    const { start, end } = this.effectiveColumnRange();
    if (end <= start || end > all.length) return all;
    return all.slice(start, end);
  });

  readonly leadingColumnSpacer = computed(() => {
    if (!this.horizontalVirtualScrollEnabled()) return 0;
    const start = this.effectiveColumnRange().start;
    const cols = this.unpinnedColumns();
    let w = 0;
    for (let i = 0; i < start && i < cols.length; i++) w += cols[i].currentWidth;
    return w;
  });

  readonly trailingColumnSpacer = computed(() => {
    if (!this.horizontalVirtualScrollEnabled()) return 0;
    const end = this.effectiveColumnRange().end;
    const cols = this.unpinnedColumns();
    let w = 0;
    for (let i = end; i < cols.length; i++) w += cols[i].currentWidth;
    return w;
  });

  // --- Computed: column defs map (for fast lookup) ---
  readonly columnDefMap = computed(() => {
    const map = new Map<string, ColumnDef<T>>();
    for (const def of this.columnDefs()) {
      map.set(def.field, def);
    }
    return map;
  });

  /** `true` when at least one column declares `allowFormula: true`. */
  readonly hasFormulaColumns = computed(() =>
    this.columnDefs().some((d) => d.allowFormula === true),
  );

  // --- Computed: grid-template-columns CSS ---
  readonly gridTemplateColumns = computed(() => {
    return this.visibleColumns()
      .map((col) => `${col.currentWidth}px`)
      .join(' ');
  });

  // --- Computed: total content width ---
  readonly totalContentWidth = computed(() => {
    return this.visibleColumns().reduce((sum, col) => sum + col.currentWidth, 0);
  });

  // --- Computed: total pages ---
  readonly totalPages = computed(() => {
    const total = this.mode() === 'server' ? this.totalItems() : this.sourceData().length;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  });

  // --- Computed: has more data to load (infinite scroll) ---
  readonly hasMore = computed(() => this.sourceData().length < this.totalItems());

  // --- Initialize columns from ColumnDefs ---
  initColumns(defs: ColumnDef<T>[]): void {
    this.columnDefs.set(defs);
    this.columnStates.set(
      defs.map((def, index) => ({
        field: def.field,
        currentWidth: this.resolveWidth(def),
        order: index,
        visible: def.visible !== false,
        sort: null as SortDirection,
        sortIndex: null,
        // Defensive normalize: `ColumnDef.pinned` accepts Vue's
        // `'left' | 'right'` aliases. The directive boundary normalizes,
        // but programmatic callers may pass defs straight through.
        pinned: normalizePinned(def.pinned),
        searchVisible: def.searchVisible ?? false,
      }))
    );
  }

  // --- Update a single column state ---
  updateColumnState(field: string, updates: Partial<ColumnStateEntry>): void {
    this.columnStates.update((states) =>
      states.map((state) => (state.field === field ? { ...state, ...updates } : state))
    );
  }

  private resolveWidth(def: ColumnDef<T>): number {
    if (def.width) {
      return parseInt(def.width, 10) || DEFAULT_COLUMN_WIDTH;
    }
    return DEFAULT_COLUMN_WIDTH;
  }
}

/**
 * Map the Vue-flavoured aliases (`'left' | 'right'`) onto Angular's
 * canonical `'start' | 'end'` pinned values. Other values pass through.
 */
function normalizePinned(
  v: 'start' | 'end' | 'left' | 'right' | null | undefined,
): 'start' | 'end' | null {
  if (v === 'left') return 'start';
  if (v === 'right') return 'end';
  return v ?? null;
}
