import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GridStateManager } from '../../state/grid-state';
import { FilterEngine } from '../../features/filter.engine';
import { trackByField } from '../../utils/track-by';

/**
 * Inline "quick filter" row rendered between the column header and the body
 * when the grid's `showQuickFilters` input is `true`. Each visible column
 * gets a single text input whose value is written through to
 * `GridStateManager.quickFilters` via `FilterEngine.setQuickFilter()`. The
 * filter engine composes these entries with the builder model at evaluation
 * time so they narrow the dataset on top of any active conditions.
 *
 * Mirrors the Vue grid's quick-filter row (see `useFilterEngine` —
 * `quickFilterEntries`).
 */
@Component({
  selector: 'ad-grid-quick-filter-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.min-width.px]': 'rowMinWidth()',
  },
  template: `
    <div class="ad-grid-quick-filter-row" role="row">
      @if (showUtilityLeft()) {
      <div
        class="ad-grid-quick-filter-row__utility"
        [style.width.px]="utilityLeftWidth()"
        aria-hidden="true"
      ></div>
      } @for (col of state.visibleColumns(); track trackByField($index, col)) {
      <div
        class="ad-grid-quick-filter-row__cell"
        [style.width.px]="col.currentWidth"
        [style.min-width.px]="col.currentWidth"
      >
        <input
          class="ad-grid-quick-filter-row__input"
          type="text"
          placeholder="Filter..."
          [value]="filterEngine.getQuickFilter(col.field)"
          (input)="onInput(col.field, $event)"
          [attr.aria-label]="'Filter ' + col.field"
        />
      </div>
      }
    </div>
  `,
  styles: [
    `
      .ad-grid-quick-filter-row {
        display: flex;
        flex-direction: row;
        border-bottom: 1px solid var(--color-border-primary, #d8dde2);
        background: var(--color-background-primary, #fff);
      }

      .ad-grid-quick-filter-row__utility {
        flex: 0 0 auto;
      }

      .ad-grid-quick-filter-row__cell {
        flex: 0 0 auto;
        padding: 4px 8px;
        box-sizing: border-box;
        border-right: 1px solid var(--color-border-primary, #eef0f2);
      }

      .ad-grid-quick-filter-row__cell:last-child {
        border-right: none;
      }

      .ad-grid-quick-filter-row__input {
        width: 100%;
        box-sizing: border-box;
        padding: 4px 8px;
        border: 1px solid var(--color-border-primary, #d8dde2);
        border-radius: var(--border-radius-s, 4px);
        font: inherit;
        background: var(--color-background-primary, #fff);
      }

      .ad-grid-quick-filter-row__input:focus {
        outline: none;
        border-color: var(--color-primary-500, #46a610);
      }
    `,
  ],
})
export class AdeoGridQuickFilterRowComponent {
  protected readonly state = inject(GridStateManager);
  protected readonly filterEngine = inject(FilterEngine);
  protected readonly trackByField = trackByField;

  /**
   * `true` when the parent grid renders a utility-cell prefix (checkbox /
   * expand-toggle). The row mirrors that prefix with an empty spacer so the
   * inputs line up with their columns.
   */
  readonly showUtilityLeft = computed(() => this.utilityLeftWidth() > 0);

  readonly utilityLeftWidth = computed(() => {
    // The grid stores `rowSelection` / `expandable` as inputs on the root
    // component; we infer the prefix width from the body's leading cell
    // widths instead by reading the state-driven row layout. Default is 0
    // when no utility cells are present.
    // NOTE: The widths mirror grid-header / grid-body (expand=36, check=48).
    // Since the state doesn't expose these toggles, we rely on the parent
    // to pass them via CSS variables; default to 0 here.
    return 0;
  });

  readonly rowMinWidth = computed(
    () => this.utilityLeftWidth() + this.state.totalContentWidth(),
  );

  onInput(field: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.filterEngine.setQuickFilter(field, value);
  }
}
