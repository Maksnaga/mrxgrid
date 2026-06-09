import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MozDrawerRef, MozDrawerFooterDirective, MozButtonComponent, DRAWER_DATA } from '@mozaic-ds/angular';
import {
  CdkDropList,
  CdkDrag,
  CdkDragHandle,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { Drag20, Cross20, ListAdd20 } from '@mozaic-ds/icons-angular';
import { GroupDrawerData, GroupDrawerResult } from '../../models/grid-events.model';

interface DraftGroupItem {
  field: string;
  headerName: string;
  sortDirection: 'asc' | 'desc';
}

@Component({
  selector: 'ad-grid-group-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    MozButtonComponent,
    MozDrawerFooterDirective,
    Drag20,
    Cross20,
    ListAdd20,
  ],
  templateUrl: './grid-group-drawer.html',
  styleUrls: ['./grid-group-drawer.scss'],
})
export class GridGroupDrawerComponent {
  private readonly drawerRef = inject<MozDrawerRef<GroupDrawerResult>>(MozDrawerRef);
  private readonly data = inject<GroupDrawerData>(DRAWER_DATA);

  readonly draftGrouped = signal<DraftGroupItem[]>(
    this.data.groups.map((entry) => {
      const col = this.data.availableColumns.find((c) => c.field === entry.field);
      return {
        field: entry.field,
        headerName: col?.headerName ?? entry.field,
        sortDirection: entry.sortDirection,
      };
    })
  );

  private readonly allAvailable = this.data.availableColumns;

  readonly available = computed(() => {
    const grouped = new Set(this.draftGrouped().map((g) => g.field));
    return this.allAvailable.filter((c) => !grouped.has(c.field));
  });

  onDrop(event: CdkDragDrop<DraftGroupItem[]>): void {
    this.draftGrouped.update((items) => {
      const updated = [...items];
      moveItemInArray(updated, event.previousIndex, event.currentIndex);
      return updated;
    });
  }

  onSortDirectionChange(index: number, event: Event): void {
    const value = (event.target as HTMLSelectElement).value as 'asc' | 'desc';
    this.draftGrouped.update((items) =>
      items.map((item, i) => (i === index ? { ...item, sortDirection: value } : item))
    );
  }

  addGroup(field: string): void {
    const col = this.allAvailable.find((c) => c.field === field);
    if (!col) return;
    this.draftGrouped.update((items) => [
      ...items,
      { field: col.field, headerName: col.headerName, sortDirection: 'asc' },
    ]);
  }

  removeGroup(field: string): void {
    this.draftGrouped.update((items) => items.filter((i) => i.field !== field));
  }

  apply(): void {
    const result: GroupDrawerResult = {
      groups: this.draftGrouped().map((i) => ({ field: i.field, sortDirection: i.sortDirection })),
    };
    this.drawerRef.close(result);
  }

  reset(): void {
    this.draftGrouped.set([]);
  }
}
