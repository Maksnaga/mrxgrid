import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ColumnStateEntry, ColumnDef, HeaderMenuActionId } from '../../models/column.model';
import { ChevronDown20, ChevronUp20, Settings20, Filter20 } from '@mozaic-ds/icons-angular';
import { MozActionListboxTriggerDirective, MozActionListItem } from '@mozaic-ds/angular';
import { GridStateManager } from '../../state/grid-state';
import { FilterEngine } from '../../features/filter.engine';
import { ColumnResizeEngine } from '../../features/column-resize.engine';
import { FormulaEngine } from '../../features/formula/formula.engine';
import { columnIndexToLetters } from '../../features/formula/formula-ast';
import { AdeoGridFilterOverlayDirective } from '../../directives/grid-filter-overlay.directive';
import { FilterModel } from '../../models/filter.model';

@Component({
  selector: 'ad-grid-header-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ChevronDown20,
    ChevronUp20,
    Settings20,
    Filter20,
    MozActionListboxTriggerDirective,
    AdeoGridFilterOverlayDirective,
  ],
  host: {
    '[style.flex]': 'isLast() ? "1 0 auto" : "0 0 auto"',
    '[style.width.px]': 'isLast() ? undefined : columnState().currentWidth',
    '[style.min-width.px]': 'isLast() ? columnState().currentWidth : resolvedMinWidth()',
    '[style.position]': 'pinnedSticky() ? "sticky" : null',
    '[style.left.px]': 'pinnedSticky() === "left" ? pinnedOffset() : null',
    '[style.right.px]': 'pinnedSticky() === "right" ? pinnedOffset() : null',
    '[style.zIndex]': 'pinnedSticky() ? 3 : null',
    '[class.grid-header-cell-host--dragging]': 'isDragging()',
    '[class.grid-header-cell-host--reorderable]': 'reorderable()',
    '[class.grid-header-cell-host--pinned]': 'pinnedSticky() !== null',
    '[class.grid-header-cell-host--pinned-left-edge]': 'pinnedEdge() === "left"',
    '[class.grid-header-cell-host--pinned-right-edge]': 'pinnedEdge() === "right"',
  },
  templateUrl: './grid-header-cell.html',
  styleUrls: ['./grid-header-cell.scss'],
})
export class AdeoGridHeaderCellComponent<T = unknown> {
  private readonly state = inject(GridStateManager);
  private readonly filterEngine = inject<FilterEngine<T>>(FilterEngine);
  private readonly resizeEngine = inject(ColumnResizeEngine);
  /** Optional — only present when the grid provides `FormulaEngine`. */
  private readonly formulaEngine = inject(FormulaEngine, { optional: true });

  readonly columnState = input.required<ColumnStateEntry>();
  readonly def = input.required<ColumnDef<T>>();
  readonly isLast = input<boolean>(false);
  readonly pinnedEnd = input<boolean>(false);
  readonly reorderable = input<boolean>(false);
  /** When set, applies `position: sticky` with the given side. */
  readonly pinnedSticky = input<'left' | 'right' | null>(null);
  /** Pixel offset for `left` (left-pinned) or `right` (right-pinned). */
  readonly pinnedOffset = input<number>(0);
  /** Visual edge of the pinned section — drives the separation shadow. */
  readonly pinnedEdge = input<'left' | 'right' | null>(null);

  protected readonly filterOverlay = viewChild(AdeoGridFilterOverlayDirective);

  /** True when at least one active condition targets this column. */
  readonly hasActiveFilter = computed(() =>
    this.filterEngine.conditions().some((c) => c.field === this.columnState().field)
  );

  /** Tooltip for the gear / filter button (count + short summary). */
  readonly filterTooltip = computed(() => {
    const field = this.columnState().field;
    const matching = this.filterEngine.conditions().filter((c) => c.field === field);
    if (matching.length === 0) return 'Column settings';
    const summary = matching.map((c) => this.filterEngine.toLabel(c)).join(', ');
    return `${matching.length} filter${matching.length > 1 ? 's' : ''}: ${summary}`;
  });

  readonly resolvedMinWidth = computed(() => {
    const def = this.def();
    return def.minWidth ? parseInt(def.minWidth, 10) || 50 : 50;
  });

  readonly isDragging = computed(() => this.state.draggingColumn() === this.columnState().field);

  /**
   * `true` when more than one column is currently sorted — in that case the
   * sort-index badge is shown to help the user understand the sort priority.
   */
  readonly isMultiSortActive = computed(() => this.state.activeSorts().length > 1);

  readonly sortClick = output<{ field: string; isMultiSort: boolean }>();
  readonly menuAction = output<{ field: string; actionId: HeaderMenuActionId }>();
  readonly resizeStart = output<MouseEvent>();

  readonly label = computed(() => {
    return this.def().headerName ?? this.columnState().field;
  });

  /**
   * Spreadsheet-style column letter (`A`, `B`, …, `AA`, `AB`, …) matching
   * this column's position in the visible column order. Shown above each
   * header while a formula is being edited so the user sees exactly what
   * letter to type to reference a cell in this column.
   */
  readonly columnLetter = computed(() => {
    const field = this.columnState().field;
    const idx = this.state.visibleColumns().findIndex((c) => c.field === field);
    if (idx < 0) return '';
    return columnIndexToLetters(idx);
  });

  /**
   * `true` when the user is editing a formula-capable cell. The header
   * uses this to show the column-letter badge — a visual cue matching the
   * A1 references the user types in the formula bar.
   */
  readonly showColumnLetter = computed(() => {
    return this.formulaEngine?.isFormulaEditActive() ?? false;
  });

  readonly menuItems = computed<MozActionListItem[]>(() => {
    const field = this.columnState().field;
    const def = this.def();
    const colState = this.state.columnStates().find((c) => c.field === field);
    if (!colState) return [];

    const items: MozActionListItem[] = [];

    if (def.sortable !== false) {
      items.push(
        { id: 'sort-asc', icon: ChevronUp20, label: 'Sort A → Z' },
        { id: 'sort-desc', icon: ChevronDown20, label: 'Sort Z → A' }
      );
    }

    if (def.filterable) {
      items.push({
        id: 'filter-column',
        label: 'Filter in this column',
        icon: Filter20,
        divider: items.length > 0,
      });
    }

    if (def.groupable) {
      items.push({
        id: 'group-column',
        label: 'Group by this column',
        divider: !def.filterable && items.length > 0,
      });
    }

    if (def.freezable !== false) {
      if (colState.pinned) {
        items.push({
          id: 'unfreeze-column',
          label: 'Unpin column',
          divider: items.length > 0,
        });
      } else {
        items.push({
          id: 'freeze-column-left',
          label: 'Pin left',
          divider: items.length > 0,
        });
        items.push({
          id: 'freeze-column-right',
          label: 'Pin right',
        });
      }
    }

    if (def.hideable !== false) {
      items.push({
        id: 'hide-column',
        label: 'Hide column',
        divider: items.length > 0,
      });
    }

    items.push(
      { id: 'autosize-this', label: 'Auto-size this column', divider: items.length > 0 },
      { id: 'autosize-all', label: 'Auto-size all columns' },
    );

    return items;
  });

  onHeaderClick(event: MouseEvent): void {
    // Guard: if the click follows a resize release by less than 200ms, ignore
    // it — the mouseup that ended the resize would otherwise register as a
    // sort click on the same header.
    if (performance.now() - this.resizeEngine.lastResizeEndedAt() < 200) {
      return;
    }
    if (this.def().sortable !== false) {
      this.sortClick.emit({
        field: this.columnState().field,
        isMultiSort: event.shiftKey,
      });
    }
  }

  onMenuItemClick(item: MozActionListItem): void {
    const field = this.columnState().field;
    const actionId = item.id as HeaderMenuActionId;

    // "Filter in this column" always opens the conditions builder overlay
    // anchored on the gear button, seeded on the current column. This stays
    // true even when the column provides a `filterTemplate`: the inline
    // header filter row (driven by the template) and the builder overlay
    // are complementary — quick filter vs. advanced conditions — and must
    // both be reachable from the column menu.
    if (actionId === 'filter-column') {
      this.openFilterOverlay(field);
      return;
    }

    this.menuAction.emit({ field, actionId });
  }

  private openFilterOverlay(seedField: string): void {
    // Defer so the action-listbox has time to tear down its overlay before
    // we attach a new one at roughly the same location. Without this, the
    // lingering mouseup from the menu-item click can land on the freshly
    // mounted filter backdrop and close it instantly.
    setTimeout(() => {
      const overlay = this.filterOverlay();
      if (!overlay) return;
      overlay.open({
        columns: this.filterEngine.describeFilterableColumns(),
        model: { conditions: this.filterEngine.conditions().slice() },
        seedField,
        onChange: (next: FilterModel) => {
          this.filterEngine.setModel(next, 'replace');
        },
      });
    }, 0);
  }
}
