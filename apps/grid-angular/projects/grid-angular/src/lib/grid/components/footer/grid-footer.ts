import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GridStateManager } from '../../state/grid-state';
import { GridEngine } from '../../engine/grid-engine';
import { MozPaginationComponent, MozSelectComponent } from '@mozaic-ds/angular';
import { PageEvent } from '../../models/pagination.model';

@Component({
  selector: 'ad-grid-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MozPaginationComponent, MozSelectComponent, FormsModule],
  templateUrl: './grid-footer.html',
  styleUrls: ['./grid-footer.scss'],
})
export class AdeoGridFooterComponent {
  protected readonly state = inject(GridStateManager);
  protected readonly engine = inject(GridEngine);

  readonly pageSizeOptions = input<number[]>([10, 20, 50, 100]);

  readonly pageChange = output<PageEvent>();

  readonly currentPageSizeStr = computed(() => String(this.state.pageSize()));

  readonly pageSizeSelectOptions = computed(() => {
    return this.pageSizeOptions().map((size) => ({
      text: String(size),
      value: String(size),
    }));
  });

  readonly paginationOptions = computed(() => {
    const totalPages = this.state.totalPages();
    return Array.from({ length: totalPages }, (_, i) => ({
      text: String(i + 1),
      value: i,
    }));
  });

  readonly rangeLabel = computed(() => {
    const pageIndex = this.state.pageIndex();
    const pageSize = this.state.pageSize();
    const total = this.engine.computedTotalItems();
    const start = pageIndex * pageSize + 1;
    const end = Math.min((pageIndex + 1) * pageSize, total);
    return `${start}-${end} of ${total} items`;
  });

  onPageChange(newPageIndex: number): void {
    const previousPageIndex = this.state.pageIndex();
    const pageSize = this.state.pageSize();
    this.state.pageIndex.set(newPageIndex);
    this.state.expandedGroups.set(new Set());
    this.pageChange.emit({
      pageIndex: newPageIndex,
      pageSize,
      previousPageIndex,
      previousPageSize: pageSize,
      startIndex: newPageIndex * pageSize,
      endIndex: newPageIndex * pageSize + pageSize - 1,
    });
  }

  onPageSizeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const newSize = Number(target.value);
    const previousPageSize = this.state.pageSize();
    const previousPageIndex = this.state.pageIndex();
    this.state.pageSize.set(newSize);
    this.state.pageIndex.set(0);
    this.state.expandedGroups.set(new Set());
    this.pageChange.emit({
      pageIndex: 0,
      pageSize: newSize,
      previousPageIndex,
      previousPageSize,
      startIndex: 0,
      endIndex: newSize - 1,
    });
  }
}
