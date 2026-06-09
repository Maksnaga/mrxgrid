import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GridStateManager } from '../../state/grid-state';
import { InlineEditEngine } from '../../features/inline-edit.engine';
import { RowSelectionEngine } from '../../features/row-selection.engine';
import { ExpandableRowEngine } from '../../features/expandable-row.engine';
import { AdeoGridCellComponent } from '../cell/grid-cell';
import { trackByField } from '../../utils/track-by';
import { ChevronRight20, ChevronDown20 } from '@mozaic-ds/icons-angular';
import { MozCheckboxComponent } from '@mozaic-ds/angular';

@Component({
  selector: 'ad-grid-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdeoGridCellComponent, ChevronRight20, ChevronDown20, MozCheckboxComponent, FormsModule],
  host: {
    '[attr.data-row-index]': 'rowIndex()',
    '[class.ad-grid-row--pending]': 'isPending()',
  },
  templateUrl: './grid-row.html',
  styleUrls: ['./grid-row.scss'],
})
export class AdeoGridRowComponent<T = unknown> {
  protected readonly state = inject(GridStateManager);
  private readonly inlineEdit = inject(InlineEditEngine);
  private readonly rowSelection = inject(RowSelectionEngine);
  private readonly expandableEngine = inject(ExpandableRowEngine);
  private readonly elRef = inject(ElementRef<HTMLElement>);
  protected readonly trackByField = trackByField;

  readonly row = input.required<T>();
  readonly rowIndex = input.required<number>();
  readonly showCheckbox = input<boolean>(false);
  readonly showExpand = input<boolean>(false);

  readonly cellEdit = output<{
    row: T;
    rowIndex: number;
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>();
  readonly cellEditCancel = output<{ rowIndex: number; field: string; originalValue: unknown }>();
  readonly rowSelectionToggle = output<void>();

  readonly isSelected = computed(() => this.rowSelection.isRowSelected(this.row()));

  /** `true` when this row's id is listed in `pendingRowLookup`. */
  readonly isPending = computed(() => {
    const row = this.row() as Record<string, unknown>;
    const rowId = row[this.state.rowIdField()] as string | number | undefined;
    if (rowId === undefined || rowId === null) return false;
    return this.state.pendingRowLookup().has(rowId);
  });

  readonly isExpanded = computed(() => {
    const row = this.row() as Record<string, unknown>;
    const idField = this.state.rowIdField();
    const rowId = row[idField];
    return rowId !== undefined && this.expandableEngine.isRowExpanded(rowId);
  });

  /** Width consumed by sticky utility cells before the first pinned-left
   * column (expand button + checkbox). */
  protected readonly utilityLeftWidth = computed(() => {
    let w = 0;
    if (this.showExpand()) w += 36;
    if (this.showCheckbox()) w += 48;
    return w;
  });

  onExpandClick(event: Event): void {
    event.stopPropagation();
    const row = this.row() as Record<string, unknown>;
    const idField = this.state.rowIdField();
    const rowId = row[idField];
    if (rowId !== undefined) {
      this.expandableEngine.toggleRow(rowId);
    }
  }

  onCheckboxClick(event: MouseEvent): void {
    event.stopPropagation();
    if (event.shiftKey && this.rowSelection.lastToggledRow() !== null) {
      this.rowSelection.selectRowRangeToRow(this.row());
    } else {
      this.rowSelection.toggleRow(this.row());
      this.rowSelection.lastToggledRow.set(this.row());
    }
    this.rowSelectionToggle.emit();
  }

  onCommitEdit(): void {
    const event = this.inlineEdit.commitEdit();
    if (event) {
      this.cellEdit.emit(
        event as { row: T; rowIndex: number; field: string; oldValue: unknown; newValue: unknown },
      );
    }
    setTimeout(() => {
      const el = this.elRef.nativeElement as HTMLElement;
      const grid = el.closest('[tabindex]') as HTMLElement | null;
      grid?.focus();
    });
  }

  onCancelEdit(): void {
    const event = this.inlineEdit.cancelEdit();
    if (event) {
      this.cellEditCancel.emit(event);
    }
  }
}
