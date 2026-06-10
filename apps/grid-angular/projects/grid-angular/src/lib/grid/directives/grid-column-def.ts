import { Directive, TemplateRef, Type, contentChild, input } from '@angular/core';
import { CellEditorType, ColumnDef } from '../models/column.model';
import { MozSelectOption } from '@mozaic-ds/angular';
import { CellError } from '../models/cell.model';
import {
  FilterDataType,
  FilterOperator,
  FilterValue,
  AdeoGridCustomFilter,
} from '../models/filter.model';

@Directive({
  selector: 'ad-grid-column-def',
})
export class AdeoGridColumnDef<T = unknown> {
  readonly field = input.required<string>();
  readonly headerName = input<string>();
  readonly width = input<string>();
  readonly minWidth = input<string>();
  readonly maxWidth = input<string>();
  readonly flex = input<number>();

  readonly sortable = input<boolean>(true);
  readonly sortComparator = input<((a: T, b: T) => number) | undefined>(undefined);
  readonly resizable = input<boolean>(true);
  readonly reorderable = input<boolean>(true);
  readonly groupable = input<boolean>(false);
  readonly filterable = input<boolean>(false);
  readonly filterType = input<FilterDataType | undefined>(undefined);
  readonly filterOperators = input<FilterOperator[] | undefined>(undefined);
  readonly defaultFilterOperator = input<FilterOperator | undefined>(undefined);
  readonly filterOptions = input<{ value: unknown; label: string }[] | undefined>(undefined);
  readonly filterComponent = input<Type<AdeoGridCustomFilter> | undefined>(undefined);
  readonly filterIsComplete = input<((value: FilterValue) => boolean) | undefined>(undefined);
  readonly filterPredicate = input<((row: unknown, value: FilterValue) => boolean) | undefined>(undefined);
  readonly editable = input<boolean>(false);
  readonly visible = input<boolean>(true);
  readonly hideable = input<boolean>(true);
  readonly freezable = input<boolean>(true);
  readonly headerMenuDisabled = input<boolean>(false);
  /**
   * Mirrors `ColumnDef.allowFormula`. Required so the template binding
   * `[allowFormula]="true"` is forwarded into the generated column def —
   * without it, `FormulaEngine.syncFromSource` cannot detect this column
   * and any baked-in `=…` value is rendered as a raw string.
   */
  readonly allowFormula = input<boolean>(false);

  /**
   * Accepts both canonical Angular values (`'start' | 'end'`) and the Vue
   * aliases (`'left' | 'right'`). The latter are normalized at the
   * `toColumnDef()` boundary so downstream engines (state, layout, drawer)
   * only ever see `'start' | 'end' | null`.
   */
  readonly pinned = input<'start' | 'end' | 'left' | 'right' | null>(null);
  readonly cellEditor = input<CellEditorType>();
  readonly cellEditorOptions = input<MozSelectOption[]>();
  readonly cellValidator = input<
    ((value: unknown, row: unknown) => CellError | null) | undefined
  >();

  readonly cellTemplateInput = input<TemplateRef<unknown> | null>(null, { alias: 'cellTemplate' });
  readonly editTemplateInput = input<TemplateRef<unknown> | null>(null, { alias: 'editTemplate' });
  readonly filterTemplateInput = input<TemplateRef<unknown> | null>(null, {
    alias: 'filterTemplate',
  });
  readonly cellTemplateContent = contentChild<TemplateRef<unknown>>('cell');
  readonly editTemplateContent = contentChild<TemplateRef<unknown>>('edit');
  readonly filterTemplateContent = contentChild<TemplateRef<unknown>>('filter');

  toColumnDef(): ColumnDef<T> {
    return {
      field: this.field(),
      headerName: this.headerName(),
      width: this.width(),
      minWidth: this.minWidth(),
      maxWidth: this.maxWidth(),
      flex: this.flex(),
      sortable: this.sortable(),
      sortComparator: this.sortComparator(),
      resizable: this.resizable(),
      reorderable: this.reorderable(),
      groupable: this.groupable(),
      filterable: this.filterable(),
      editable: this.editable(),
      visible: this.visible(),
      hideable: this.hideable(),
      freezable: this.freezable(),
      headerMenuDisabled: this.headerMenuDisabled(),
      pinned: normalizePinned(this.pinned()),
      cellEditor: this.cellEditor(),
      cellEditorOptions: this.cellEditorOptions(),
      cellTemplate: this.cellTemplateInput() ?? this.cellTemplateContent(),
      editTemplate: this.editTemplateInput() ?? this.editTemplateContent(),
      filterTemplate: this.filterTemplateInput() ?? this.filterTemplateContent(),
      filterType: this.filterType(),
      filterOperators: this.filterOperators(),
      defaultFilterOperator: this.defaultFilterOperator(),
      filterOptions: this.filterOptions(),
      filterComponent: this.filterComponent(),
      filterIsComplete: this.filterIsComplete(),
      filterPredicate: this.filterPredicate() as ColumnDef<T>['filterPredicate'],
      cellValidator: this.cellValidator(),
      allowFormula: this.allowFormula(),
    };
  }
}

/**
 * Map the Vue-flavoured aliases onto Angular's canonical pinned values:
 *  - `'left'`  → `'start'`
 *  - `'right'` → `'end'`
 *  - everything else passes through unchanged.
 *
 * Done at the directive boundary so the state manager, layout engines, and
 * column-resize/drag features keep their `'start' | 'end' | null` type
 * narrowing intact.
 */
function normalizePinned(
  v: 'start' | 'end' | 'left' | 'right' | null,
): 'start' | 'end' | null {
  if (v === 'left') return 'start';
  if (v === 'right') return 'end';
  return v;
}
