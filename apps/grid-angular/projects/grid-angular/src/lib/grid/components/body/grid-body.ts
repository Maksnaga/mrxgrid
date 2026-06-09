import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { GridStateManager } from '../../state/grid-state';
import { GridEngine } from '../../engine/grid-engine';
import { AdeoGridRowComponent } from '../row/grid-row';
import { AdeoGridGroupRowComponent } from '../group-row/grid-group-row';
import { AdeoGridDetailRowComponent } from '../detail-row/grid-detail-row';
import { AdeoGridSkeletonRowComponent } from '../skeleton-row/grid-skeleton-row';
import { ExpandableRowEngine } from '../../features/expandable-row.engine';
import { CellEditEvent, CellEditCancelEvent } from '../../models/cell.model';

@Component({
  selector: 'ad-grid-body',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdeoGridRowComponent, AdeoGridGroupRowComponent, AdeoGridDetailRowComponent, AdeoGridSkeletonRowComponent],
  templateUrl: './grid-body.html',
  styleUrls: ['./grid-body.scss'],
})
export class AdeoGridBodyComponent {
  protected readonly state = inject(GridStateManager);
  protected readonly engine = inject(GridEngine);
  private readonly expandableEngine = inject(ExpandableRowEngine);

  readonly bodyContainer = viewChild<ElementRef<HTMLElement>>('bodyContainer');

  readonly showCheckbox = input<boolean>(false);
  readonly showExpand = input<boolean>(false);
  readonly detailTemplate = input<TemplateRef<unknown> | null>(null);
  /** Overrides the default skeleton row count (`Math.min(pageSize, 20)`). */
  readonly skeletonRowCount = input<number | undefined>();

  readonly cellEdit = output<CellEditEvent>();
  readonly cellEditCancel = output<CellEditCancelEvent>();
  readonly rowSelectionToggle = output<void>();
  readonly groupToggle = output<string>();

  /** Width consumed by sticky utility cells before the first pinned-left
   * column — must match `AdeoGridRowComponent.utilityLeftWidth()` so the
   * detail/group rows align with the data row layout. */
  protected readonly utilityLeftWidth = computed(() => {
    let w = 0;
    if (this.showExpand()) w += 36;
    if (this.showCheckbox()) w += 48;
    return w;
  });

  /** Number of skeleton rows shown while loading — overrideable via `skeletonRowCount` input, defaults to `Math.min(pageSize, 20)`. */
  protected readonly skeletonRows = computed(() => {
    const count = this.skeletonRowCount() ?? Math.min(this.state.pageSize(), 20);
    return new Array<number>(count).fill(0).map((_, i) => i);
  });

  /** Concrete display-row indices to render this frame. */
  protected readonly visibleIndices = computed(() => {
    const { start, end } = this.state.visibleRowRange();
    if (end <= start) return [] as number[];
    const out = new Array<number>(end - start);
    for (let i = 0; i < out.length; i++) out[i] = start + i;
    return out;
  });

  protected isRowExpanded(data: unknown): boolean {
    const row = data as Record<string, unknown>;
    const rowId = row[this.state.rowIdField()];
    return rowId !== undefined && this.expandableEngine.isRowExpanded(rowId);
  }

  /** Returns the row key string used by `AdeoGridDetailRowComponent` for
   * height measurement. Falls back to empty string if the id field is absent. */
  protected getRowKey(data: unknown): string {
    const row = data as Record<string, unknown>;
    const val = row[this.state.rowIdField()];
    return val !== null && val !== undefined ? String(val) : '';
  }

  // No ResizeObserver here — detail-row heights are pre-measured by
  // `<ad-grid-measurement-zone>` and cached id-keyed in
  // `ExpandableRowEngine.measuredRowHeights`. The visible `<ad-grid-detail-row>`
  // also self-measures via its own RO to keep the cache fresh on content
  // change. A previous index-keyed RO on `<ad-grid-row>` wrappers here was
  // the source of the scroll-bounce: virtualization recycles DOM across
  // indices, so the RO's initial-observe entry on a remounted element fired
  // with the new `__mozRowIndex` but reflected the previous row's extra,
  // producing spurious deltas and `scrollTop` jumps.
}
