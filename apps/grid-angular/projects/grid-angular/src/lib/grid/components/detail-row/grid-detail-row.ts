import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet, JsonPipe } from '@angular/common';
import { ExpandableRowEngine } from '../../features/expandable-row.engine';

@Component({
  selector: 'ad-grid-detail-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, JsonPipe],
  templateUrl: './grid-detail-row.html',
  styleUrls: ['./grid-detail-row.scss'],
})
export class AdeoGridDetailRowComponent<T = unknown> implements AfterViewInit, OnDestroy {
  readonly data = input.required<T>();
  readonly rowIndex = input.required<number>();
  readonly detailTemplate = input<TemplateRef<unknown> | null>(null);
  /**
   * Key used to store the measured height in `ExpandableRowEngine`.
   * Should be the row's id field value (set by `ad-grid-body` / `ad-grid-row`).
   */
  readonly rowKey = input<string>('');

  /**
   * Emitted whenever the detail element's ResizeObserver fires with a new
   * height. The measurement zone listens to this signal — it can't rely
   * on `measureRow` alone because it also needs to know WHICH row id has
   * just been sized so it can call `promoteFromPending`.
   *
   * The detail row also keeps calling `expandableRowEngine.measureRow`
   * directly so consumers that mount a detail row outside the measurement
   * zone (visible layout) still self-measure on content change.
   */
  readonly measured = output<number>();

  private readonly expandableRowEngine = inject(ExpandableRowEngine, { optional: true });
  private readonly elRef = inject(ElementRef<HTMLElement>);
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    const el = this.elRef.nativeElement as HTMLElement;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        const key = this.rowKey();
        // Cache the height in the engine for the virtual-scroll layout
        // effect — even when this detail row is in the measurement zone
        // we want the height available BEFORE promotion so the layout
        // effect rebuilds offsets with the correct value as soon as the
        // visible row mounts.
        if (key && this.expandableRowEngine) {
          this.expandableRowEngine.measureRow(key, height);
        }
        // Notify the host (typically the measurement zone) with the
        // measured height so it can promote the row from pending.
        this.measured.emit(height);
      }
    });
    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }
}
