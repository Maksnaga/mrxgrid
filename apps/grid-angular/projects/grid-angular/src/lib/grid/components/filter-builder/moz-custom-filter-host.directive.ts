import {
  ComponentRef,
  Directive,
  OnChanges,
  OnDestroy,
  OutputRefSubscription,
  SimpleChanges,
  Type,
  ViewContainerRef,
  inject,
  input,
  output,
} from '@angular/core';
import { FilterCondition, FilterValue, AdeoGridCustomFilter } from '../../models/filter.model';

/**
 * Structural host for custom filter components inside the filter builder.
 *
 * Usage in template:
 *   <ng-container mozCustomFilterHost
 *     [componentType]="descriptor.filterComponent"
 *     [condition]="condition"
 *     (conditionChange)="onValueChange(condition.id, $event)"
 *   />
 */
@Directive({ selector: '[mozCustomFilterHost]', standalone: true })
export class MozCustomFilterHostDirective implements OnChanges, OnDestroy {
  readonly componentType = input.required<Type<AdeoGridCustomFilter>>();
  readonly condition = input.required<FilterCondition>();
  readonly conditionChange = output<FilterValue>();

  private readonly vcr = inject(ViewContainerRef);
  private ref: ComponentRef<AdeoGridCustomFilter> | undefined;
  private sub: OutputRefSubscription | undefined;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['componentType']) {
      this.teardown();
      this.ref = this.vcr.createComponent(this.componentType());
      this.sub = this.ref.instance.conditionChange.subscribe((v: FilterValue) =>
        this.conditionChange.emit(v)
      );
    }
    if (this.ref) {
      this.ref.setInput('condition', this.condition());
    }
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  private teardown(): void {
    this.sub?.unsubscribe();
    this.ref?.destroy();
    this.ref = undefined;
    this.sub = undefined;
  }
}
