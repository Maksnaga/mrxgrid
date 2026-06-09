import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MozActionListboxComponent, MozActionListItem } from '@mozaic-ds/angular';
import { GridStateManager } from '../../state/grid-state';
import { HeaderMenuActionId } from '../../models/column.model';
import {
  ChevronDown20,
  ChevronUp20,
} from '@mozaic-ds/icons-angular';

@Component({
  selector: 'ad-grid-header-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MozActionListboxComponent],
  templateUrl: './grid-header-menu.html',
  styleUrls: ['./grid-header-menu.scss'],
})
export class AdeoGridHeaderMenuComponent {
  private readonly state = inject(GridStateManager);

  readonly field = input.required<string>();
  readonly isOpen = input<boolean>(false);

  readonly actionClick = output<{ field: string; actionId: HeaderMenuActionId }>();
  readonly close = output<void>();

  readonly menuItems = computed<MozActionListItem[]>(() => {
    const field = this.field();
    const defMap = this.state.columnDefMap();
    const def = defMap.get(field);
    const colState = this.state.columnStates().find((c) => c.field === field);
    if (!def || !colState) return [];

    const colIndex = this.state.visibleColumns().findIndex((c) => c.field === field);
    const items: MozActionListItem[] = [];

    // Group 1: Sort
    if (def.sortable !== false) {
      items.push(
        { id: 'sort-asc', icon: ChevronUp20, label: 'Sort A → Z' },
        { id: 'sort-desc', icon: ChevronDown20, label: 'Sort Z → A' },
      );
    }

    // Group 2: Filter & Group
    if (def.filterable) {
      items.push({
        id: 'filter-column',
        label: 'Filter in this column',
        divider: items.length > 0,
      });
    }
    if (def.groupable) {
      items.push({
        id: 'group-column',
        label: 'Group by this column',
        divider: !def.filterable && items.length > 0,
      });
    }

    // Group 3: Freeze
    if (def.freezable !== false) {
      if (colState.pinned) {
        items.push({
          id: 'unfreeze-column',
          label: 'Unfreeze column',
          divider: items.length > 0,
        });
      } else {
        items.push({
          id: 'freeze-column-left',
          label: `Freeze left until column ${colIndex + 1}`,
          divider: items.length > 0,
        });
        items.push({
          id: 'freeze-column-right',
          label: `Freeze right from column ${colIndex + 1}`,
        });
      }
    }

    // Group 4: Hide & Search
    if (def.hideable !== false) {
      items.push({
        id: 'hide-column',
        label: 'Hide column',
        divider: items.length > 0,
      });
    }
    items.push({
      id: 'toggle-column-search',
      label: colState.searchVisible ? 'Hide search by column' : 'Show search by column',
      divider: def.hideable === false && items.length > 0,
    });

    // Group 5: Autosize
    items.push(
      { id: 'autosize-this', label: 'Auto-size this column', divider: items.length > 0 },
      { id: 'autosize-all', label: 'Auto-size all columns' },
    );

    return items;
  });

  onItemClick(item: MozActionListItem): void {
    this.actionClick.emit({
      field: this.field(),
      actionId: item.id as HeaderMenuActionId,
    });
    this.close.emit();
  }
}
