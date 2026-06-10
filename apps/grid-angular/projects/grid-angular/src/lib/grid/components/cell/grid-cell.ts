import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  TemplateRef,
  Type,
} from '@angular/core';
import { NgTemplateOutlet, NgComponentOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GridStateManager } from '../../state/grid-state';
import { InlineEditEngine } from '../../features/inline-edit.engine';
import { CellSelectionEngine } from '../../features/cell-selection.engine';
import { CellValidationEngine } from '../../features/cell-validation.engine';
import { ClipboardEngine } from '../../features/clipboard.engine';
import { FormulaEngine } from '../../features/formula/formula.engine';
import { FormulaRefHighlightService } from '../../features/formula/formula-ref-highlight.service';
import { AdeoGridFormulaEditorComponent } from '../formula-editor/formula-editor';
import type { FormulaValue } from '../../models/formula.model';
import { GridEngine } from '../../engine/grid-engine';
import { ColumnDef, ColumnStateEntry, CellEditorType } from '../../models/column.model';
import { MozSelectComponent, MozCheckboxComponent, MozDatepickerComponent, MozTooltipDirective } from '@mozaic-ds/angular';
import { ErrorFilled24 } from '@mozaic-ds/icons-angular';

@Component({
  selector: 'ad-grid-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    NgComponentOutlet,
    FormsModule,
    MozSelectComponent,
    MozCheckboxComponent,
    MozDatepickerComponent,
    MozTooltipDirective,
    ErrorFilled24,
    AdeoGridFormulaEditorComponent,
  ],
  host: {
    '[style.flex]': 'fillsRemainingSpace() ? "1 0 auto" : "0 0 auto"',
    '[style.width.px]': 'fillsRemainingSpace() ? undefined : colState().currentWidth',
    '[style.min-width.px]': 'fillsRemainingSpace() ? colState().currentWidth : resolvedMinWidth()',
    '[style.position]': 'pinnedSticky() ? "sticky" : null',
    '[style.left.px]': 'pinnedSticky() === "left" ? pinnedOffset() : null',
    '[style.right.px]': 'pinnedSticky() === "right" ? pinnedOffset() : null',
    // 3 — above elevated scrollable cells (focused / fill-reject at z-index 2)
    // so they slide UNDER the pinned column, below the sticky header (z 5).
    '[style.zIndex]': 'pinnedSticky() ? 3 : null',
    '[class.grid-cell--pinned]': 'pinnedSticky() !== null',
    '[class.grid-cell--pinned-left-edge]': 'pinnedEdge() === "left"',
    '[class.grid-cell--pinned-right-edge]': 'pinnedEdge() === "right"',
  },
  templateUrl: './grid-cell.html',
  styleUrls: ['./grid-cell.scss'],
})
export class AdeoGridCellComponent<T = unknown> {
  private readonly state = inject(GridStateManager);
  private readonly inlineEdit = inject(InlineEditEngine);
  private readonly cellSelectionEngine = inject(CellSelectionEngine);
  private readonly validationEngine = inject(CellValidationEngine);
  private readonly clipboard = inject(ClipboardEngine);
  private readonly gridEngine = inject(GridEngine);
  /** Optional: present only when the grid provides `FormulaEngine`. */
  private readonly formulaEngine = inject(FormulaEngine, { optional: true });
  private readonly refHighlight = inject(FormulaRefHighlightService, { optional: true });
  private readonly elRef = inject(ElementRef<HTMLElement>);

  constructor() {
    effect(() => {
      if (this.isEditing()) {
        this.focusEditor();
      }
    });
  }

  private focusEditor(): void {
    // Wait for the editor DOM to render, then focus it
    setTimeout(() => {
      const el = this.elRef.nativeElement;
      // Formula editor manages its own focus + caret placement (end of
      // input, no selection) so that click-to-pick replaces the ref at
      // the caret rather than a globally-selected formula. Bail early.
      if (this.isFormulaEditing()) return;
      const focusable: HTMLElement | null = el.querySelector('input, select, textarea');
      if (focusable) {
        focusable.focus();
        if (focusable instanceof HTMLInputElement) {
          focusable.select();
        }
        return;
      }
      // Custom editors (e.g. combobox): find and click the trigger button to auto-open
      const trigger: HTMLButtonElement | null = el.querySelector(
        'button[role="combobox"], .mc-combobox__control'
      );
      if (trigger) {
        trigger.focus();
        trigger.click();
      }
    });
  }

  readonly row = input.required<T>();
  readonly rowIndex = input.required<number>();
  readonly colIndex = input.required<number>();
  readonly colState = input.required<ColumnStateEntry>();
  readonly def = input.required<ColumnDef<T>>();
  readonly isLast = input<boolean>(false);
  readonly pinnedEnd = input<boolean>(false);
  /** When set, applies `position: sticky` with the given side; the offset is
   * read from `pinnedOffset()`. */
  readonly pinnedSticky = input<'left' | 'right' | null>(null);
  /** Pixel offset applied to `left` (when `pinnedSticky === 'left'`) or
   * `right` (when `'right'`). */
  readonly pinnedOffset = input<number>(0);
  /** Marks the cell at the visual edge of its pinned section so it can paint
   * the shadow that separates frozen columns from the scrollable area. */
  readonly pinnedEdge = input<'left' | 'right' | null>(null);

  readonly resolvedMinWidth = computed(() => {
    const def = this.def();
    return def.minWidth ? parseInt(def.minWidth, 10) || 50 : 50;
  });

  /**
   * Only the last *unpinned* column may stretch to fill leftover viewport
   * width. A pinned-end column must keep its exact `currentWidth`: if it
   * flex-grows, resizing it has no visible effect until the dragged width
   * exceeds the stretched width. The pinned block is pushed to the right
   * edge by an auto left margin instead (see scss).
   */
  readonly fillsRemainingSpace = computed(() => this.isLast() && !this.pinnedEnd());

  readonly commitEdit = output<void>();
  readonly cancelEdit = output<void>();

  onFormulaCancel(): void {
    this.cancelEdit.emit();
  }

  readonly cellTemplate = computed(() => {
    const t = this.def().cellTemplate;
    if (!t) return null;
    // Keep only TemplateRef for ngTemplateOutlet compatibility
    if (t instanceof TemplateRef) return t;
    return null;
  });

  /**
   * Resolved standalone component class for `ngComponentOutlet`.
   * Non-null when `cellTemplate` is a `Type<unknown>`.
   */
  readonly cellComponentType = computed<Type<{ value: unknown }> | null>(() => {
    const t = this.def().cellTemplate;
    if (!t) return null;
    if (t instanceof TemplateRef) return null;
    // Type<unknown> — cast to the expected shape; consumer is responsible for the @Input
    return t as Type<{ value: unknown }>;
  });

  readonly editTemplate = computed(() => this.def().editTemplate ?? null);
  readonly updateDraftFn = (value: unknown): void => this.inlineEdit.updateDraft(value);
  readonly commitEditFn = (): void => this.commitEdit.emit();

  /**
   * Stable cell address for the formula engine. `null` when the column
   * isn't formula-enabled or the row lacks a stable id (e.g. headers).
   */
  private readonly formulaAddr = computed(() => {
    if (!this.def().allowFormula || !this.formulaEngine) return null;
    const rowId = (this.row() as Record<string, unknown>)[this.state.rowIdField()];
    if (rowId === undefined || rowId === null) return null;
    return { rowId: rowId as string | number, field: this.def().field };
  });

  /**
   * Last-evaluated `FormulaValue` for this cell, or `null` when the cell
   * holds no formula. Reactivity is driven by `formulaEngine.values`.
   */
  readonly formulaValue = computed(() => {
    const addr = this.formulaAddr();
    if (!addr || !this.formulaEngine) return null;
    // Subscribe to the values signal; `hasFormula` alone doesn't.
    const map = this.formulaEngine.values();
    const key = `${addr.rowId}|${addr.field}`;
    return map.get(key) ?? null;
  });

  readonly value = computed(() => {
    const d = this.def();
    // When a formula is registered for this cell, its evaluated value wins
    // over the raw source field — the source still holds the formula string
    // (inline storage mode) and gets shown only while the cell is edited.
    const fv = this.formulaValue();
    if (fv && !this.isEditing()) {
      return formulaValueToJs(fv);
    }
    if (d.valueGetter) return d.valueGetter(this.row());
    return (this.row() as Record<string, unknown>)[d.field];
  });

  readonly displayValue = computed(() => {
    const d = this.def();
    const fv = this.formulaValue();
    if (fv && !this.isEditing()) {
      return formulaValueToDisplay(fv);
    }
    const val = this.value();
    if (d.valueFormatter) return d.valueFormatter(val, this.row());
    return val != null ? String(val) : '';
  });

  /** `true` when the current cell value is a formula error (e.g. `#DIV/0!`). */
  readonly hasFormulaError = computed(() => {
    const fv = this.formulaValue();
    return fv?.kind === 'error';
  });

  /**
   * Currently editing and the draft is a formula (starts with `=`).
   * Drives the switch to `AdeoGridFormulaEditorComponent` instead of the
   * default text input.
   */
  readonly isFormulaEditing = computed(() => {
    if (!this.def().allowFormula) return false;
    if (!this.isEditing()) return false;
    const draft = this.editState().draftValue;
    return typeof draft === 'string' && draft.trimStart().startsWith('=');
  });

  /**
   * Palette CSS var for the coloured border shown when this cell is
   * currently referenced by the formula being edited elsewhere. `null`
   * when no editor is active or this cell is not referenced.
   */
  readonly refHighlightColor = computed<string | null>(() => {
    if (!this.refHighlight) return null;
    if (!this.refHighlight.isActive()) return null;
    const rowId = (this.row() as Record<string, unknown>)[this.state.rowIdField()];
    if (rowId === undefined || rowId === null) return null;
    return this.refHighlight.colorByCell().get(`${rowId}|${this.def().field}`) ?? null;
  });

  readonly editState = computed(() => this.state.cellEditState());

  readonly isEditing = computed(() => {
    return this.inlineEdit.isEditing(this.rowIndex(), this.colIndex());
  });

  readonly editorType = computed<CellEditorType>(() => {
    return this.inlineEdit.resolveEditorType(this.def().field, this.value());
  });

  readonly isFocused = computed(() => {
    return this.cellSelectionEngine.isCellFocused(this.rowIndex(), this.colIndex());
  });

  readonly isInRange = computed(() => {
    return (
      !this.isFocused() &&
      (this.cellSelectionEngine.isCellInAnyRange(this.rowIndex(), this.colIndex()) ||
        this.cellSelectionEngine.isCellInRange(this.rowIndex(), this.colIndex()))
    );
  });

  /** Sides of the selection-rectangle perimeter this cell must paint. */
  readonly rangeEdges = computed(() => {
    return this.cellSelectionEngine.getRangeEdges(this.rowIndex(), this.colIndex());
  });

  /**
   * `true` when the cell belongs to a range bigger than 1×1. The focused
   * anchor then drops its own ring/background and blends into the block —
   * the range perimeter is the selection affordance (mirrors the Vue grid).
   */
  readonly isInMultiCellRange = computed(() => {
    if (!this.cellSelectionEngine.isCellInAnyRange(this.rowIndex(), this.colIndex())) return false;
    const edges = this.rangeEdges();
    return !(edges.top && edges.bottom && edges.left && edges.right);
  });

  readonly isInFillRange = computed(() => {
    return this.cellSelectionEngine.isCellInFillRange(this.rowIndex(), this.colIndex());
  });

  /**
   * The fill handle sits on the bottom-right corner of the live range when a
   * multi-cell selection exists (the whole block is the fill source), or on
   * the focused cell otherwise.
   */
  readonly showFillHandle = computed(() => {
    if (this.isEditing()) return false;
    const handle = this.cellSelectionEngine.fillHandleCell();
    return handle !== null && handle.row === this.rowIndex() && handle.col === this.colIndex();
  });

  readonly isInFillRejectRange = computed(() => {
    return this.cellSelectionEngine.isCellInFillRejectRange(this.rowIndex(), this.colIndex());
  });

  readonly cutEdges = computed(() => this.clipboard.cutEdges(this.rowIndex(), this.colIndex()));

  readonly cellError = computed(() => {
    // Validation errors are keyed by sourceData index, but `rowIndex()` is a
    // display/paginated index. Resolve to the source index so errors show on
    // the right cells when sort / filter / grouping is active.
    const sourceIndex = this.gridEngine.displayIndexToSourceIndex(this.rowIndex());
    if (sourceIndex < 0) return null;
    return this.validationEngine.getCellError(sourceIndex, this.def().field);
  });

  /** `true` when this cell matches an entry in `pendingCells`. */
  readonly isPending = computed(() => {
    const rowId = (this.row() as Record<string, unknown>)[this.state.rowIdField()];
    if (rowId === undefined || rowId === null) return false;
    return this.state.pendingCellLookup().has(`${rowId}::${this.def().field}`);
  });

  onCellClick(event: MouseEvent): void {
    // Shift+click: extend range — only when multi-cell selection is enabled
    if (event.shiftKey && !this.state.multiCellSelectionEnabled()) return;
    if (event.shiftKey) {
      this.cellSelectionEngine.extendRangeTo(this.rowIndex(), this.colIndex());
      if (this.state.activeSelectionMode() !== 'cells') {
        this.state.activeSelectionMode.set('cells');
      }
      return;
    }

    // Drag-to-select already handled focus via mousedown — skip redundant focus
    // Only need to handle the commit of other editing cells
  }

  onMouseDown(event: MouseEvent): void {
    // Formula pick mode: a formula editor is active elsewhere. Clicking a
    // cell inserts its reference into the editor instead of starting a
    // selection. The editor keeps the focus; we must not focus the grid.
    if (this.refHighlight?.isPickMode() && !this.isEditing()) {
      // Double-click wins over pick: abandon the formula edit so the
      // target cell can open its own editor on the upcoming dblclick.
      if (event.detail >= 2) {
        this.cancelEdit.emit();
      } else {
        const rowId = (this.row() as Record<string, unknown>)[this.state.rowIdField()];
        if (rowId !== undefined && rowId !== null) {
          event.preventDefault();
          event.stopPropagation();
          const addr = { rowId: rowId as string | number, field: this.def().field };
          this.refHighlight.pickRangeStart(addr, { absolute: event.shiftKey });
        }
        return;
      }
    }

    if (event.shiftKey) {
      event.preventDefault();
      return;
    }

    // Don't intercept mousedown when this cell is being edited —
    // native interactions (select dropdown, datepicker, etc.) need it.
    if (this.isEditing()) {
      return;
    }

    // Focus the cell (needed even when multi-cell selection is off for single-cell copy/paste)
    const editState = this.state.cellEditState();
    if (editState.editingCell) {
      this.commitEdit.emit();
    }

    // Ctrl/Meta+Click: freeze the current range and start a new anchor,
    // accumulating multiple disjoint ranges (Excel-style multi-range).
    if ((event.ctrlKey || event.metaKey) && this.state.multiCellSelectionEnabled()) {
      const newRange = {
        start: { row: this.rowIndex(), col: this.colIndex() },
        end: { row: this.rowIndex(), col: this.colIndex() },
      };
      this.cellSelectionEngine.addRange(newRange);
      if (this.state.activeSelectionMode() !== 'cells') {
        this.state.activeSelectionMode.set('cells');
      }
      event.preventDefault();
      const el = this.elRef.nativeElement as HTMLElement;
      const grid = el.closest('[tabindex]') as HTMLElement | null;
      grid?.focus();
      return;
    }

    this.cellSelectionEngine.focusCell(this.rowIndex(), this.colIndex());

    // Drag-to-select range: only when multi-cell selection is enabled
    if (this.state.multiCellSelectionEnabled()) {
      this.cellSelectionEngine.startRangeSelection(this.rowIndex(), this.colIndex());
      if (this.state.activeSelectionMode() !== 'cells') {
        this.state.activeSelectionMode.set('cells');
      }
    }

    event.preventDefault();
    // Re-focus the grid container so keyboard events keep working
    const el = this.elRef.nativeElement as HTMLElement;
    const grid = el.closest('[tabindex]') as HTMLElement | null;
    grid?.focus();
  }

  onMouseEnter(): void {
    if (this.refHighlight?.isPickDragging()) {
      const rowId = (this.row() as Record<string, unknown>)[this.state.rowIdField()];
      if (rowId !== undefined && rowId !== null) {
        this.refHighlight.pickRangeExtend({
          rowId: rowId as string | number,
          field: this.def().field,
        });
      }
      return;
    }
    if (this.state.isFilling()) {
      this.cellSelectionEngine.extendFill(this.rowIndex(), this.colIndex());
    } else if (this.state.isDragging() && this.state.multiCellSelectionEnabled()) {
      this.cellSelectionEngine.extendRange(this.rowIndex(), this.colIndex());
    }
  }

  onDoubleClick(): void {
    if (!this.def().editable) return;
    // Another cell is still in edit — commit or cancel it first so its draft
    // doesn't leak into this cell's editor when we startEdit below.
    const editing = this.state.cellEditState().editingCell;
    if (editing && (editing.row !== this.rowIndex() || editing.col !== this.colIndex())) {
      this.commitEdit.emit();
    }
    this.inlineEdit.startEdit(this.rowIndex(), this.def().field);
  }

  onEditorInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const editorType = this.editorType();
    const value = editorType === 'number' ? Number(target.value) : target.value;
    this.inlineEdit.updateDraft(value);
  }

  onSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.inlineEdit.updateDraft(target.value);
  }

  onCheckboxChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.inlineEdit.updateDraft(target.checked);
  }

  onDateChange(value: string | null): void {
    this.inlineEdit.updateDraft(value);
  }

  onFillHandleMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.cellSelectionEngine.startFill(this.rowIndex(), this.colIndex());
  }

  onEditorBlur(event: FocusEvent): void {
    const editorDiv = event.currentTarget as HTMLElement;
    const relatedTarget = event.relatedTarget as Node | null;
    // Only commit if focus is leaving the editor entirely (not moving within it)
    if (relatedTarget && editorDiv.contains(relatedTarget)) return;
    // CDK overlays (combobox dropdown, datepicker, etc.) render at <body> level.
    // Don't commit if focus moved to an overlay — the editor is still active.
    if (relatedTarget instanceof HTMLElement) {
      const overlay = relatedTarget.closest('.cdk-overlay-container');
      if (overlay) return;
    }
    // Defer the commit so pending interactions can settle. In particular,
    // typing `=` in the plain text input mounts the formula editor in its
    // place — the old input's removal fires `focusout` with a null
    // `relatedTarget` (focus lands on `<body>` for a tick), but the new
    // formula input grabs focus in its own `afterNextRender`. Re-check
    // `activeElement` here so we don't commit out from under it.
    setTimeout(() => {
      if (!this.isEditing()) return;
      const active = document.activeElement;
      if (active instanceof Node && editorDiv.contains(active)) return;
      this.commitEdit.emit();
    });
  }
}

// ─── Formula value helpers (module-local so they stay tree-shakable) ────────

/**
 * Convert an evaluated `FormulaValue` to a plain JS value suitable for
 * filters, sort comparators and exports. Errors map to their code string
 * (`"#DIV/0!"`) so text filters still see the cell as a legitimate value.
 */
function formulaValueToJs(v: FormulaValue): unknown {
  switch (v.kind) {
    case 'number':
    case 'string':
    case 'boolean':
      return v.value;
    case 'empty':
      return '';
    case 'error':
      return v.error;
  }
}

/** Format a `FormulaValue` for display in a cell. */
function formulaValueToDisplay(v: FormulaValue): string {
  switch (v.kind) {
    case 'number':
      return formatFormulaNumber(v.value);
    case 'string':
      return v.value;
    case 'boolean':
      return v.value ? 'TRUE' : 'FALSE';
    case 'empty':
      return '';
    case 'error':
      return v.error;
  }
}

/**
 * Trim IEEE-754 float artefacts (e.g. `89.6999999999999` → `89.7`) by
 * re-rounding to 12 significant digits — the `toPrecision` / `Number`
 * round-trip drops the noisy tail while keeping every "real" digit a
 * user might have typed. Matches spreadsheet display conventions.
 */
function formatFormulaNumber(value: number): string {
  if (!Number.isFinite(value) || Number.isInteger(value)) return String(value);
  return String(Number(value.toPrecision(12)));
}
