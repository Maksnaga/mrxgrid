import { Directive, TemplateRef, inject, input } from '@angular/core';

/**
 * Discriminator for the empty-state context.
 * - `no-data`     : the source dataset is empty (no rows ever loaded).
 * - `no-results`  : the dataset is non-empty but the active filter / search
 *                   produced zero rows.
 *
 * A template registered without an explicit kind defaults to `no-data` and
 * is also used as the fallback when `no-results` has no dedicated template.
 */
export type GridEmptyKind = 'no-data' | 'no-results';

/**
 * Marks a `<ng-template>` projected into `<ad-grid-angular>` as the renderer for
 * the empty state. Register one or two templates:
 *
 * ```html
 * <ad-grid-angular [data]="rows">
 *   <ng-template mozGridEmptyDef>
 *     <p>Aucune donnée pour le moment</p>
 *   </ng-template>
 *
 *   <ng-template mozGridEmptyDef="no-results" let-ctx>
 *     <p>Aucun résultat pour vos filtres ({{ ctx.activeFilterCount }})</p>
 *     <button (click)="ctx.clearFilters()">Réinitialiser</button>
 *   </ng-template>
 * </ad-grid-angular>
 * ```
 *
 * The implicit context (`let-ctx`) exposes `{ activeFilterCount, clearFilters }`.
 */
@Directive({
  selector: '[mozGridEmptyDef]',
})
export class AdeoGridEmptyDef {
  readonly kind = input<GridEmptyKind>('no-data', { alias: 'mozGridEmptyDef' });
  readonly template = inject<TemplateRef<GridEmptyContext>>(TemplateRef);
}

/** Context object passed to a `mozGridEmptyDef` template. */
export interface GridEmptyContext {
  /** Number of active filter conditions; `0` when called with `no-data`. */
  activeFilterCount: number;
  /** Convenience callback to clear all filter conditions. */
  clearFilters: () => void;
}
