import { Injectable, inject, computed, signal, DestroyRef, NgZone } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { LoadMoreEvent } from '../models/pagination.model';

const DEFAULT_SCROLL_THRESHOLD = 200;

@Injectable()
export class InfiniteScrollEngine<T = unknown> {
  private readonly state = inject<GridStateManager<T>>(GridStateManager);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  private scrollListener: (() => void) | null = null;
  private scrollElement: HTMLElement | null = null;
  private loadMoreCallback: ((event: LoadMoreEvent) => void) | null = null;

  readonly scrollThreshold = signal<number>(DEFAULT_SCROLL_THRESHOLD);

  readonly hasMore = computed(() => this.state.hasMore());

  readonly isActive = computed(() => this.state.loadingStrategy() === 'infinite-scroll');

  attach(
    scrollElement: HTMLElement,
    onLoadMore: (event: LoadMoreEvent) => void
  ): void {
    this.detach();
    this.scrollElement = scrollElement;
    this.loadMoreCallback = onLoadMore;

    const listener = (): void => {
      this.checkScrollPosition();
    };

    this.ngZone.runOutsideAngular(() => {
      scrollElement.addEventListener('scroll', listener, { passive: true });
    });

    this.scrollListener = (): void => {
      scrollElement.removeEventListener('scroll', listener);
    };

    this.destroyRef.onDestroy(() => this.detach());
  }

  detach(): void {
    if (this.scrollListener) {
      this.scrollListener();
      this.scrollListener = null;
    }
    this.scrollElement = null;
    this.loadMoreCallback = null;
  }

  private checkScrollPosition(): void {
    if (!this.scrollElement || !this.loadMoreCallback) return;
    if (!this.isActive()) return;
    if (this.state.isLoading()) return;
    if (!this.hasMore()) return;

    const el = this.scrollElement;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    if (distanceFromBottom <= this.scrollThreshold()) {
      this.ngZone.run(() => {
        this.loadMoreCallback!({
          offset: this.state.sourceData().length,
          limit: this.state.pageSize(),
        });
      });
    }
  }

  /**
   * Reset scroll state — called when sort/filter changes require
   * reloading from offset 0.
   */
  reset(onLoadMore: (event: LoadMoreEvent) => void): void {
    if (this.scrollElement) {
      this.scrollElement.scrollTop = 0;
    }
    onLoadMore({ offset: 0, limit: this.state.pageSize() });
  }
}
