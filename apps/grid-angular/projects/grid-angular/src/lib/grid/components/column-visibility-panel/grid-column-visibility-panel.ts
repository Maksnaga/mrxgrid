import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { GridStateManager } from '../../state/grid-state';

@Component({
  selector: 'ad-grid-column-visibility-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grid-column-visibility-panel.html',
  styleUrls: ['./grid-column-visibility-panel.scss'],
})
export class AdeoGridColumnVisibilityPanelComponent {
  private readonly state = inject(GridStateManager);

  readonly restoreColumn = output<string>();
  readonly restoreAll = output<void>();

  readonly hiddenColumns = computed(() => {
    const allStates = this.state.columnStates();
    const defMap = this.state.columnDefMap();
    return allStates
      .filter((col) => !col.visible)
      .map((col) => ({
        field: col.field,
        label: defMap.get(col.field)?.headerName ?? col.field,
      }));
  });

  onRestore(field: string): void {
    this.restoreColumn.emit(field);
  }

  onRestoreAll(): void {
    this.restoreAll.emit();
  }
}
