import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { GroupRow } from '../../models/display-row.model';
import { GridStateManager } from '../../state/grid-state';
import { ChevronRight20 } from '@mozaic-ds/icons-angular';

@Component({
  selector: 'ad-grid-group-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChevronRight20],
  templateUrl: './grid-group-row.html',
  styleUrls: ['./grid-group-row.scss'],
})
export class AdeoGridGroupRowComponent<T = unknown> {
  protected readonly state = inject(GridStateManager);

  readonly groupRow = input.required<GroupRow<T>>();
  readonly toggleExpand = output<string>();

  readonly fieldLabel = computed(() => {
    const field = this.groupRow().field;
    const def = this.state.columnDefMap().get(field);
    return def?.headerName ?? field;
  });

  readonly groupValue = computed(() => {
    return String(this.groupRow().value ?? '');
  });
}
