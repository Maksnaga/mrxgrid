import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import { GridStateManager } from '../../state/grid-state';
import { CellSelectionEngine } from '../../features/cell-selection.engine';
import { RowSelectionEngine } from '../../features/row-selection.engine';

@Component({
  selector: 'ad-grid-selection-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grid-selection-bar.html',
  styleUrls: ['./grid-selection-bar.scss'],
})
export class AdeoGridSelectionBarComponent {
  private readonly state = inject(GridStateManager);
  private readonly cellSelection = inject(CellSelectionEngine);
  private readonly rowSelection = inject(RowSelectionEngine);

  readonly editClick = output<void>();
  readonly copyClick = output<void>();
  readonly pasteClick = output<void>();
  readonly deleteClick = output<void>();
  readonly exportClick = output<void>();

  readonly selectedCount = computed(() => {
    const mode = this.state.activeSelectionMode();
    if (mode === 'rows') {
      return this.rowSelection.pageSelectedCount();
    }
    if (mode === 'cells') {
      const range = this.cellSelection.getNormalizedRange();
      if (!range) return 0;
      const rows = range.end.row - range.start.row + 1;
      const cols = range.end.col - range.start.col + 1;
      const total = rows * cols;
      return total > 1 ? total : 0;
    }
    return 0;
  });

  readonly selectionLabel = computed(() => {
    const mode = this.state.activeSelectionMode();
    if (mode === 'rows') return 'rows selected';
    if (mode === 'cells') return 'cells selected';
    return 'selected';
  });

  onClear(): void {
    const mode = this.state.activeSelectionMode();
    if (mode === 'cells') {
      this.cellSelection.clearFocus();
      this.state.activeSelectionMode.set('none');
    } else if (mode === 'rows') {
      this.rowSelection.deselectPage();
      // Only reset mode if no rows remain selected
      if (this.rowSelection.count() === 0) {
        this.state.activeSelectionMode.set('none');
      }
    }
  }
}
