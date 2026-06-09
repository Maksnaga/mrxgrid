import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  TemplateRef,
} from '@angular/core';
import { AdeoGridDetailRowComponent } from '../detail-row/grid-detail-row';
import { ExpandableRowEngine } from '../../features/expandable-row.engine';
import { GridStateManager } from '../../state/grid-state';
import { GridEngine } from '../../engine/grid-engine';
import { DisplayRow } from '../../models/display-row.model';

/**
 * Hidden off-screen zone that PRE-MEASURES detail rows before they are
 * mounted in the visible layout.
 *
 * Why: the variable-height virtual scroll engine needs to know the
 * exact pixel height of an expanded detail row BEFORE it appears in
 * the visible body, otherwise `totalRowsHeight` jumps when the
 * ResizeObserver lands the real height, the browser snaps the scroll
 * thumb to the new total, and the user sees a scrollbar bounce.
 *
 * How:
 *  1. The user clicks expand → `ExpandableRowEngine.toggleRow` adds the
 *     row id to `state.pendingExpansion`.
 *  2. This zone reactively renders an `<ad-grid-detail-row>` for each
 *     pending id, in a `visibility:hidden; transform:translateX(-100000px)`
 *     wrapper (off-screen, same width as the viewport so the detail row
 *     measures at its real size).
 *  3. The detail row's `ResizeObserver` fires after layout, the row
 *     emits `(measured)`, which the zone forwards to
 *     `ExpandableRowEngine.promoteFromPending` — `expandedRowIds` now
 *     includes the id, so the visible body template mounts the detail
 *     row WITH its measured height already cached in the engine.
 *  4. The hidden row is removed because the id is no longer in
 *     `pendingExpansion`. The visible row inherits the measurement, so
 *     no second ResizeObserver tick is needed to settle the layout.
 *
 * Concurrent expansions just fan out: N pending ids → N hidden detail
 * rows → N independent ResizeObserver callbacks → N independent
 * `promoteFromPending` calls.
 */
@Component({
  selector: 'ad-grid-measurement-zone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdeoGridDetailRowComponent],
  template: `
    @for (pending of pendingRows(); track pending.id) {
      <ad-grid-detail-row
        [data]="pending.data"
        [rowIndex]="pending.index"
        [rowKey]="pending.key"
        [detailTemplate]="detailTemplate()"
        (measured)="onMeasured(pending.id, $event)"
      />
    }
  `,
  styles: [
    `
      :host {
        /* Off-screen, layout-neutral measurement surface.
           - position: absolute → no flow contribution.
           - left/top 0 + width 100% → measures at the same width as
             the visible viewport so detail rows size at real width.
           - visibility: hidden → not focusable, not painted, but
             children DO contribute to layout (display:none would
             skip layout entirely and break ResizeObserver firing).
           - translateX(-100000px) → defensive: even if some browser
             ignores visibility, the zone is well outside any
             scrollable area.
           - pointer-events: none → never intercepts clicks/hover. */
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        visibility: hidden;
        pointer-events: none;
        transform: translateX(-100000px);
        z-index: -1;
      }
    `,
  ],
})
export class AdeoGridMeasurementZoneComponent<T = unknown> {
  protected readonly expandableRowEngine = inject<ExpandableRowEngine<T>>(ExpandableRowEngine);
  protected readonly state = inject<GridStateManager<T>>(GridStateManager);
  protected readonly engine = inject<GridEngine<T>>(GridEngine);

  /** Forwarded down to each hidden `<ad-grid-detail-row>`. */
  readonly detailTemplate = input<TemplateRef<unknown> | null>(null);

  /**
   * Pending rows resolved against the current `displayRows()`. Rows
   * pruned by `ExpandableRowEngine.pruneStalePending` are filtered out
   * defensively here too — race condition where the engine's prune
   * effect has not run yet would otherwise pass an undefined row to the
   * template.
   */
  protected readonly pendingRows = computed(() => {
    const ids = this.state.pendingExpansion();
    if (ids.size === 0) return [] as Array<{ id: unknown; data: T; index: number; key: string }>;
    const idField = this.state.rowIdField();
    const rows = this.engine.displayRows();
    const out: Array<{ id: unknown; data: T; index: number; key: string }> = [];
    // Single pass over display rows — handles concurrent pending ids without
    // an inner find() per id.
    for (const row of rows) {
      if (row.type !== 'data') continue;
      const id = (row.data as Record<string, unknown>)[idField];
      if (id === undefined || !ids.has(id)) continue;
      out.push({
        id,
        data: (row as DisplayRow<T> & { type: 'data' }).data,
        index: (row as DisplayRow<T> & { type: 'data' }).index,
        key: String(id),
      });
    }
    return out;
  });

  protected onMeasured(rowId: unknown, _height: number): void {
    // The detail row has already cached the height via
    // `ExpandableRowEngine.measureRow` (its `ResizeObserver` callback
    // calls both `measureRow` and `measured.emit`). We just promote.
    this.expandableRowEngine.promoteFromPending(rowId);
  }
}
