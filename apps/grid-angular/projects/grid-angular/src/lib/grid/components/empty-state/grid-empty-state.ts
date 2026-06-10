import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Folder48, Search48 } from '@mozaic-ds/icons-angular';
import { MozButtonComponent } from '@mozaic-ds/angular';
import { GridEmptyKind } from '../../directives/grid-empty-def';

/**
 * Default empty-state shown by `<ad-grid-angular>` when the body has no rows.
 * Two visual variants are dispatched on the `kind` input:
 *  - `'no-data'`    : the dataset is empty (folder icon, neutral copy).
 *  - `'no-results'` : filters/search produced zero rows (search icon, CTA).
 *
 * Consumers can fully replace this component by projecting a
 * `<ng-template adGridEmptyDef>` into the grid; see `AdeoGridEmptyDef`.
 */
@Component({
  selector: 'ad-grid-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Folder48, Search48, MozButtonComponent],
  templateUrl: './grid-empty-state.html',
  styleUrls: ['./grid-empty-state.scss'],
})
export class AdeoGridEmptyStateComponent {
  readonly kind = input.required<GridEmptyKind>();
  readonly title = input<string>('');
  readonly description = input<string>('');
  /**
   * Optional CTA label. When falsy the button is not rendered. The grid
   * shell wires this to "Clear filters" for the `no-results` variant.
   */
  readonly actionLabel = input<string>('');

  readonly action = output<void>();

  protected readonly resolvedTitle = computed(() => {
    if (this.title()) return this.title();
    return this.kind() === 'no-results' ? 'No matching results' : 'No data to display';
  });

  protected readonly resolvedDescription = computed(() => {
    if (this.description()) return this.description();
    return this.kind() === 'no-results'
      ? 'Try adjusting your filters or clearing them to see more rows.'
      : 'There is nothing to show here yet.';
  });
}
