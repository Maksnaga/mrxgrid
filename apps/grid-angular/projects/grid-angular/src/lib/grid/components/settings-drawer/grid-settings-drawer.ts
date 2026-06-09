import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MozDrawerRef, MozDrawerFooterDirective, MozButtonComponent, MozSelectComponent, MozToggleComponent, DRAWER_DATA } from '@mozaic-ds/angular';
import { FormsModule } from '@angular/forms';
import {
  CdkDropList,
  CdkDrag,
  CdkDragHandle,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { ChevronRight20, Drag20 } from '@mozaic-ds/icons-angular';
import { GridDensity, GridSettingsData, GridSettingsResult } from '../../models/grid-events.model';

type SettingsScreen = 'main' | 'density' | 'columns';

interface DraftColumn {
  field: string;
  headerName: string;
  visible: boolean;
}

const DENSITY_OPTIONS = [
  { text: 'Compact', value: 'compact' },
  { text: 'Default', value: 'default' },
  { text: 'Comfortable', value: 'comfortable' },
];

const DENSITY_LABELS: Record<GridDensity, string> = {
  compact: 'Compact',
  default: 'Default',
  comfortable: 'Comfortable',
};

@Component({
  selector: 'ad-grid-settings-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    MozButtonComponent,
    MozDrawerFooterDirective,
    MozSelectComponent,
    MozToggleComponent,
    ChevronRight20,
    Drag20,
  ],
  templateUrl: './grid-settings-drawer.html',
  styleUrls: ['./grid-settings-drawer.scss'],
})
export class GridSettingsDrawerComponent {
  private readonly drawerRef = inject<MozDrawerRef<GridSettingsResult>>(MozDrawerRef);
  private readonly data = inject<GridSettingsData>(DRAWER_DATA);

  readonly screen = signal<SettingsScreen>('main');
  readonly draftDensity = signal<GridDensity>(this.data.density);
  readonly draftColumns = signal<DraftColumn[]>(this.data.columns.map((c) => ({ ...c })));
  readonly searchQuery = signal('');

  readonly densityOptions = DENSITY_OPTIONS;

  readonly densityLabel = computed(() => DENSITY_LABELS[this.draftDensity()]);

  readonly columnsLabel = computed(() => {
    const cols = this.draftColumns();
    const visible = cols.filter((c) => c.visible).length;
    return `${visible}/${cols.length} displayed`;
  });

  readonly filteredColumns = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.draftColumns();
    return this.draftColumns().filter((c) => c.headerName.toLowerCase().includes(q));
  });

  // Store default columns for factory reset
  private readonly defaultColumns = this.data.defaultColumns.map((c) => ({ ...c }));

  constructor() {
    this.drawerRef.onBackClick().subscribe(() => {
      this.goTo('main');
    });
  }

  goTo(screen: SettingsScreen): void {
    this.screen.set(screen);
    switch (screen) {
      case 'main':
        this.drawerRef.title.set('Settings');
        this.drawerRef.contentTitle.set('');
        this.drawerRef.back.set(false);
        break;
      case 'density':
        this.drawerRef.title.set('Data density');
        this.drawerRef.contentTitle.set('');
        this.drawerRef.back.set(true);
        break;
      case 'columns':
        this.drawerRef.title.set('Display columns');
        this.drawerRef.contentTitle.set('');
        this.drawerRef.back.set(true);
        break;
    }
  }

  onColumnToggle(field: string, checked: boolean): void {
    this.draftColumns.update((cols) =>
      cols.map((c) => (c.field === field ? { ...c, visible: checked } : c))
    );
  }

  onColumnDrop(event: CdkDragDrop<DraftColumn[]>): void {
    const filtered = this.filteredColumns();
    const fromField = filtered[event.previousIndex]?.field;
    const toField = filtered[event.currentIndex]?.field;
    if (!fromField || !toField) return;

    this.draftColumns.update((cols) => {
      const updated = [...cols];
      const fromIdx = updated.findIndex((c) => c.field === fromField);
      const toIdx = updated.findIndex((c) => c.field === toField);
      if (fromIdx >= 0 && toIdx >= 0) {
        moveItemInArray(updated, fromIdx, toIdx);
      }
      return updated;
    });
  }

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  hideAll(): void {
    this.draftColumns.update((cols) => cols.map((c) => ({ ...c, visible: false })));
  }

  showAll(): void {
    this.draftColumns.update((cols) => cols.map((c) => ({ ...c, visible: true })));
  }

  apply(): void {
    const result: GridSettingsResult = {
      density: this.draftDensity(),
      columns: this.draftColumns().map((c, i) => ({
        field: c.field,
        visible: c.visible,
        order: i,
      })),
    };
    this.drawerRef.close(result);
  }

  reset(): void {
    this.draftDensity.set('default');
    this.draftColumns.set(this.defaultColumns.map((c) => ({ ...c })));
    this.searchQuery.set('');
  }
}
