import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { Drag20, Cross20, ListAdd20 } from '@mozaic-ds/icons-angular';
import { MozButtonComponent } from '@mozaic-ds/angular';
import {
  FilterApplyMode,
  FilterColumnDescriptor,
  FilterCombinator,
  FilterCondition,
  FilterModel,
  FilterOperator,
  OPERATOR_LABELS,
  RANGE_OPERATORS,
  VALUELESS_OPERATORS,
  generateConditionId,
} from '../../models/filter.model';
import { MozCustomFilterHostDirective } from './moz-custom-filter-host.directive';

@Component({
  selector: 'ad-grid-filter-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    MozButtonComponent,
    MozCustomFilterHostDirective,
    Drag20,
    Cross20,
    ListAdd20,
  ],
  templateUrl: './grid-filter-builder.html',
  styleUrls: ['./grid-filter-builder.scss'],
})
export class AdeoGridFilterBuilderComponent {
  readonly model = input.required<FilterModel>();
  readonly availableColumns = input.required<FilterColumnDescriptor[]>();
  readonly applyMode = input<FilterApplyMode>('auto');
  /** Hint: when true, renders a "Show rows" sub-title (used inside the overlay). */
  readonly showSubtitle = input<boolean>(true);
  /**
   * Column the builder was opened for (set by the column-menu overlay).
   * When provided, "Add condition" seeds the new row on this column
   * instead of defaulting to the first available column.
   */
  readonly defaultField = input<string | null>(null);

  readonly modelChange = output<FilterModel>();

  // Draft (what the user sees). Synced from `model` input on change.
  readonly draft = signal<FilterCondition[]>([]);

  constructor() {
    effect(() => {
      const incoming = this.model().conditions;
      // Avoid clobbering local mutations: only sync when the incoming model
      // differs by id-set or values from the current draft.
      const current = untracked(() => this.draft());
      if (!conditionsEqual(incoming, current)) {
        this.draft.set(incoming.map((c) => ({ ...c, value: { ...c.value } })));
      }
    });
  }

  readonly columnsById = computed(() => {
    const m = new Map<string, FilterColumnDescriptor>();
    for (const c of this.availableColumns()) m.set(c.field, c);
    return m;
  });

  readonly operatorLabels = OPERATOR_LABELS;

  // ------------------------------------------------------------------
  // Mutations
  // ------------------------------------------------------------------

  addCondition(): void {
    const cols = this.availableColumns();
    if (cols.length === 0) return;
    // Prefer the column the builder was opened for; fall back to the first.
    const preferred = this.defaultField();
    const target = (preferred && cols.find((c) => c.field === preferred)) || cols[0];
    const condition: FilterCondition = {
      id: generateConditionId(),
      combinator: 'and',
      field: target.field,
      operator: target.defaultOperator,
      value: {},
    };
    this.draft.update((list) => [...list, condition]);
    this.commit();
  }

  removeCondition(id: string): void {
    this.draft.update((list) => list.filter((c) => c.id !== id));
    this.commit();
  }

  onCombinatorChange(id: string, combinator: FilterCombinator): void {
    this.draft.update((list) => list.map((c) => (c.id === id ? { ...c, combinator } : c)));
    this.commit();
  }

  onFieldChange(id: string, field: string): void {
    // Selecting the column that is already targeted must not wipe the
    // condition's value — only a genuine column change resets it.
    const current = this.draft().find((c) => c.id === id);
    if (!current || current.field === field) return;
    const col = this.columnsById().get(field);
    this.draft.update((list) =>
      list.map((c) =>
        c.id === id
          ? {
              ...c,
              field,
              operator: col?.defaultOperator ?? c.operator,
              value: {},
            }
          : c,
      ),
    );
    this.commit();
  }

  onOperatorChange(id: string, operator: FilterOperator): void {
    this.draft.update((list) =>
      list.map((c) =>
        c.id === id ? { ...c, operator, value: resetValueFor(operator, c.value) } : c,
      ),
    );
    this.commit();
  }

  onValueChange(id: string, patch: { value?: unknown; valueTo?: unknown }): void {
    this.draft.update((list) =>
      list.map((c) =>
        c.id === id
          ? {
              ...c,
              value: { ...c.value, ...patch },
            }
          : c,
      ),
    );
    this.commit();
  }

  onSetValueChange(id: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const values = Array.from(select.selectedOptions).map((o) => o.value);
    this.onValueChange(id, { value: values });
  }

  onDrop(event: CdkDragDrop<FilterCondition[]>): void {
    this.draft.update((list) => {
      const next = [...list];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return next;
    });
    this.commit();
  }

  // ------------------------------------------------------------------
  // Value editor helpers (for the template)
  // ------------------------------------------------------------------

  needsValue(op: FilterOperator): boolean {
    return !VALUELESS_OPERATORS.has(op);
  }

  needsRange(op: FilterOperator): boolean {
    return RANGE_OPERATORS.has(op);
  }

  getSelectedSetValues(condition: FilterCondition): string[] {
    const v = condition.value.value;
    if (Array.isArray(v)) return v.map((x) => String(x));
    if (v == null || v === '') return [];
    return [String(v)];
  }

  isSetValueSelected(condition: FilterCondition, value: unknown): boolean {
    return this.getSelectedSetValues(condition).includes(String(value));
  }

  inputTypeFor(op: FilterOperator, type: string): string {
    if (type === 'number') return 'number';
    if (type === 'date') return 'date';
    return 'text';
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private commit(): void {
    this.modelChange.emit({
      conditions: this.draft().map((c) => ({ ...c, value: { ...c.value } })),
    });
  }
}

function resetValueFor(
  op: FilterOperator,
  previous: FilterCondition['value'],
): FilterCondition['value'] {
  if (VALUELESS_OPERATORS.has(op)) return {};
  if (RANGE_OPERATORS.has(op))
    return { value: previous.value ?? '', valueTo: previous.valueTo ?? '' };
  return { value: previous.value ?? '' };
}

function conditionsEqual(a: FilterCondition[], b: FilterCondition[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i];
    const cb = b[i];
    if (
      ca.id !== cb.id ||
      ca.combinator !== cb.combinator ||
      ca.field !== cb.field ||
      ca.operator !== cb.operator ||
      ca.value.value !== cb.value.value ||
      ca.value.valueTo !== cb.value.valueTo
    ) {
      return false;
    }
  }
  return true;
}
