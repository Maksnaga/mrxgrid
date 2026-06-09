import { Injectable, inject, computed } from '@angular/core';
import { GridStateManager } from '../state/grid-state';

@Injectable()
export class PaginationEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);

  readonly totalPages = computed(() => this.state.totalPages());

  readonly currentPage = computed(() => this.state.pageIndex());

  readonly startItem = computed(() => {
    if (this.computedTotal() === 0) return 0;
    return this.state.pageIndex() * this.state.pageSize() + 1;
  });

  readonly endItem = computed(() => {
    const total = this.computedTotal();
    return Math.min((this.state.pageIndex() + 1) * this.state.pageSize(), total);
  });

  readonly isFirstPage = computed(() => this.state.pageIndex() === 0);

  readonly isLastPage = computed(() => this.state.pageIndex() >= this.totalPages() - 1);

  private readonly computedTotal = computed(() => {
    return this.state.mode() === 'server'
      ? this.state.totalItems()
      : this.state.sourceData().length;
  });

  goToPage(pageIndex: number): void {
    if (pageIndex < 0 || pageIndex >= this.totalPages()) return;
    this.state.pageIndex.set(pageIndex);
  }

  nextPage(): void {
    if (!this.isLastPage()) {
      this.state.pageIndex.update((i) => i + 1);
    }
  }

  previousPage(): void {
    if (!this.isFirstPage()) {
      this.state.pageIndex.update((i) => i - 1);
    }
  }

  setPageSize(size: number): void {
    this.state.pageSize.set(size);
    this.state.pageIndex.set(0);
  }
}
