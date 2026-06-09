import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MozDrawerRef, MozDrawerFooterDirective, MozButtonComponent, DRAWER_DATA } from '@mozaic-ds/angular';
import {
  FilterDrawerData,
  FilterDrawerResult,
  FilterModel,
} from '../../models/filter.model';
import { AdeoGridFilterBuilderComponent } from '../filter-builder/grid-filter-builder';

@Component({
  selector: 'ad-grid-filter-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdeoGridFilterBuilderComponent, MozButtonComponent, MozDrawerFooterDirective],
  templateUrl: './grid-filter-drawer.html',
  styleUrls: ['./grid-filter-drawer.scss'],
})
export class AdeoGridFilterDrawerComponent {
  private readonly drawerRef = inject<MozDrawerRef<FilterDrawerResult>>(MozDrawerRef);
  private readonly data = inject<FilterDrawerData>(DRAWER_DATA);

  readonly availableColumns = this.data.availableColumns;

  readonly draft = signal<FilterModel>({
    conditions: this.data.model.conditions.map((c) => ({ ...c, value: { ...c.value } })),
  });

  readonly activeCount = computed(() => this.draft().conditions.length);

  onDraftChange(model: FilterModel): void {
    this.draft.set(model);
  }

  apply(): void {
    this.drawerRef.close({ model: this.draft(), applied: true });
  }

  clearAll(): void {
    this.draft.set({ conditions: [] });
  }

  cancel(): void {
    this.drawerRef.close({ model: this.data.model, applied: false });
  }
}
