import { ComponentRef, Directive, ElementRef, Injector, OnDestroy, inject } from '@angular/core';
import { Overlay, OverlayConfig, OverlayRef, ConnectedPosition } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { FilterEngine } from '../features/filter.engine';
import { AdeoGridFilterBuilderComponent } from '../components/filter-builder/grid-filter-builder';
import { FilterColumnDescriptor, FilterModel } from '../models/filter.model';

/**
 * Programmatically opens a CDK overlay anchored on the host element that
 * renders the filter builder. Unlike the action-listbox directive, the
 * overlay does not toggle on click — the host is simply the anchor. Open
 * the overlay by injecting this directive via a template ref (`#filter`)
 * and calling `filter.open(options)`.
 */
@Directive({
  selector: '[adGridFilterOverlay]',
  exportAs: 'adGridFilterOverlay',
})
export class AdeoGridFilterOverlayDirective implements OnDestroy {
  private readonly overlay = inject(Overlay);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly engine = inject(FilterEngine, { optional: true }) as FilterEngine | null;

  private overlayRef: OverlayRef | null = null;
  private componentRef: ComponentRef<AdeoGridFilterBuilderComponent> | null = null;

  /** Opens the overlay anchored on the host. No-op if already open. */
  open(options: {
    columns: FilterColumnDescriptor[];
    model: FilterModel;
    /** Optional pre-selected column to seed a new condition. */
    seedField?: string;
    onChange: (model: FilterModel) => void;
  }): void {
    if (this.overlayRef) return;
    if (!this.engine) return;

    const positions: ConnectedPosition[] = [
      { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
      { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
      { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    ];

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.host)
      .withPositions(positions)
      .withPush(true)
      .withViewportMargin(8);

    const config = new OverlayConfig({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      panelClass: 'ad-grid-filter-overlay',
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });

    const overlayRef = this.overlay.create(config);
    this.overlayRef = overlayRef;

    // Seed the draft with a new condition targeting the clicked column, if any
    const seededModel =
      options.seedField && options.model.conditions.length === 0
        ? { conditions: [this.engine.makeCondition(options.seedField, true)] }
        : options.model;

    const portal = new ComponentPortal(AdeoGridFilterBuilderComponent, null, this.injector);
    const compRef = overlayRef.attach(portal);

    compRef.setInput('model', seededModel);
    compRef.setInput('availableColumns', options.columns);
    compRef.setInput('applyMode', 'auto');
    compRef.setInput('showSubtitle', true);
    compRef.setInput('defaultField', options.seedField ?? null);

    compRef.instance.modelChange.subscribe((next: FilterModel) => {
      compRef.setInput('model', next);
      options.onChange(next);
    });

    this.componentRef = compRef;

    overlayRef.backdropClick().subscribe(() => this.close());
    overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') this.close();
    });
  }

  close(): void {
    if (!this.overlayRef) return;
    this.overlayRef.dispose();
    this.overlayRef = null;
    this.componentRef = null;
    // A condition the user added but never gave a value to must not survive
    // once the builder is dismissed — drop it so it isn't a phantom filter.
    this.engine?.dropIncompleteConditions();
  }

  ngOnDestroy(): void {
    this.close();
  }
}
