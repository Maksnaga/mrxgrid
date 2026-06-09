import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { GridStateManager } from '../../state/grid-state';

@Component({
  selector: 'ad-grid-skeleton-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid-skeleton-row" [style.height.px]="state.rowHeight()">
      @if (showExpand()) {
      <div class="grid-skeleton-row__utility" [style.width.px]="36" [style.left.px]="0"></div>
      } @if (showCheckbox()) {
      <div
        class="grid-skeleton-row__utility"
        [style.width.px]="48"
        [style.left.px]="showExpand() ? 36 : 0"
      ></div>
      }

      @for (col of state.pinnedLeftColumns(); track col.field; let i = $index) {
      <div
        class="grid-skeleton-row__cell grid-skeleton-row__cell--sticky-left"
        [style.width.px]="col.currentWidth"
        [style.min-width.px]="col.currentWidth"
        [style.left.px]="utilityLeftWidth() + state.pinnedLeftCumulativeOffsets()[i]"
      >
        <div class="grid-skeleton-row__shimmer"></div>
      </div>
      } @if (state.leadingColumnSpacer() > 0) {
      <div
        class="grid-skeleton-row__spacer"
        [style.width.px]="state.leadingColumnSpacer()"
      ></div>
      } @for (col of state.renderedUnpinnedColumns(); track col.field) {
      <div
        class="grid-skeleton-row__cell"
        [style.width.px]="col.currentWidth"
        [style.min-width.px]="col.currentWidth"
      >
        <div class="grid-skeleton-row__shimmer"></div>
      </div>
      } @if (state.trailingColumnSpacer() > 0) {
      <div
        class="grid-skeleton-row__spacer"
        [style.width.px]="state.trailingColumnSpacer()"
      ></div>
      } @for (col of state.pinnedRightColumns(); track col.field; let i = $index) {
      <div
        class="grid-skeleton-row__cell grid-skeleton-row__cell--sticky-right"
        [style.width.px]="col.currentWidth"
        [style.min-width.px]="col.currentWidth"
        [style.right.px]="state.pinnedRightCumulativeOffsets()[i]"
      >
        <div class="grid-skeleton-row__shimmer"></div>
      </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        background: var(--color-background-primary);
        border-bottom: 1px solid var(--color-border-primary);
      }

      .grid-skeleton-row {
        display: flex;
        width: max-content;
        min-width: 100%;
        box-sizing: border-box;
        background: inherit;
      }

      .grid-skeleton-row__utility {
        flex: 0 0 auto;
        height: 100%;
        position: sticky;
        z-index: 2;
        background: inherit;
      }

      .grid-skeleton-row__cell {
        flex: 0 0 auto;
        height: 100%;
        display: flex;
        align-items: center;
        padding: 0 12px;
        box-sizing: border-box;
        background: inherit;
      }

      .grid-skeleton-row__cell--sticky-left {
        position: sticky;
        z-index: 1;
      }

      .grid-skeleton-row__cell--sticky-right {
        position: sticky;
        z-index: 1;
      }

      .grid-skeleton-row__spacer {
        flex: 0 0 auto;
        height: 100%;
        background: inherit;
      }

      .grid-skeleton-row__shimmer {
        width: 60%;
        height: 12px;
        border-radius: var(--border-radius-s, 4px);
        background: linear-gradient(
          90deg,
          var(--color-border-primary, #e0e6ea) 25%,
          var(--color-background-tertiary, #f0f4f6) 50%,
          var(--color-border-primary, #e0e6ea) 75%
        );
        background-size: 200% 100%;
        animation: ad-grid-shimmer 1.5s ease-in-out infinite;
      }

      @keyframes ad-grid-shimmer {
        0% {
          background-position: 200% center;
        }
        100% {
          background-position: -200% center;
        }
      }
    `,
  ],
})
export class AdeoGridSkeletonRowComponent {
  protected readonly state = inject(GridStateManager);

  readonly showCheckbox = input<boolean>(false);
  readonly showExpand = input<boolean>(false);

  protected readonly utilityLeftWidth = computed(() => {
    let w = 0;
    if (this.showExpand()) w += 36;
    if (this.showCheckbox()) w += 48;
    return w;
  });
}
