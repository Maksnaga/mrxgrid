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
import { FormsModule } from '@angular/forms';
import { GridStateManager } from '../../state/grid-state';
import { RowSelectionEngine } from '../../features/row-selection.engine';
import { ColumnDragEngine } from '../../features/column-drag.engine';
import { NgTemplateOutlet } from '@angular/common';
import { AdeoGridHeaderCellComponent } from './grid-header-cell';
import { MozCheckboxComponent } from '@mozaic-ds/angular';
import { HeaderMenuActionId } from '../../models/column.model';
import { trackByField } from '../../utils/track-by';

@Component({
  selector: 'ad-grid-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdeoGridHeaderCellComponent, MozCheckboxComponent, FormsModule, NgTemplateOutlet],
  host: {
    '[style.min-width.px]': 'rowMinWidth()',
  },
  templateUrl: './grid-header.html',
  styleUrls: ['./grid-header.scss'],
})
export class AdeoGridHeaderComponent {
  protected readonly state = inject(GridStateManager);
  protected readonly rowSelection = inject(RowSelectionEngine);
  private readonly dragEngine = inject(ColumnDragEngine);
  protected readonly trackByField = trackByField;

  readonly headerCenter = viewChild<ElementRef<HTMLElement>>('headerCenter');
  readonly showCheckbox = input<boolean>(false);
  readonly showExpand = input<boolean>(false);
  readonly reorderable = input<boolean>(false);

  readonly sortClick = output<{ field: string; isMultiSort: boolean }>();
  readonly menuAction = output<{ field: string; actionId: HeaderMenuActionId }>();
  readonly resizeStart = output<{ field: string; event: MouseEvent }>();
  readonly selectAllToggle = output<void>();
  readonly columnReorder = output<{ previousIndex: number; currentIndex: number }>();

  constructor() {
    this.dragEngine.onReorder = (prev, curr) => {
      this.columnReorder.emit({ previousIndex: prev, currentIndex: curr });
    };
  }

  protected readonly utilityLeftWidth = computed(() => {
    let w = 0;
    if (this.showExpand()) w += 36;
    if (this.showCheckbox()) w += 48;
    return w;
  });

  protected readonly rowMinWidth = computed(
    () => this.utilityLeftWidth() + this.state.totalContentWidth(),
  );

  protected readonly hasFilterRow = computed(() => {
    const defMap = this.state.columnDefMap();
    return this.state.visibleColumns().some((col) => !!defMap.get(col.field)?.filterTemplate);
  });

  getFilterTemplate(field: string): TemplateRef<unknown> | null {
    return this.state.columnDefMap().get(field)?.filterTemplate ?? null;
  }

  onSelectAllClick(event: Event): void {
    event.stopPropagation();
    this.selectAllToggle.emit();
  }

  onDragStart(event: MouseEvent, unpinnedIndex: number): void {
    if (!this.reorderable()) return;
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (
      target.closest('.grid-header-cell__resize-handle') ||
      target.closest('.grid-header-cell__menu-trigger')
    )
      return;

    const center = this.headerCenter();
    if (!center) return;

    this.dragEngine.startDrag(event, unpinnedIndex, center.nativeElement);
  }
}
