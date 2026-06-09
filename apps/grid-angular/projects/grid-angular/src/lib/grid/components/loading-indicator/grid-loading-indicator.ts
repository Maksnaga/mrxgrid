import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MozLoaderComponent } from '@mozaic-ds/angular';

@Component({
  selector: 'ad-grid-loading-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MozLoaderComponent],
  template: `
    <div class="grid-loading-indicator">
      <moz-loader size="s" text="Loading more data..." />
    </div>
  `,
  styles: [
    `
      .grid-loading-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-m, 16px);
        border-top: 1px solid var(--color-border-primary);
        background: var(--color-background-primary);
      }
    `,
  ],
})
export class AdeoGridLoadingIndicatorComponent {}
