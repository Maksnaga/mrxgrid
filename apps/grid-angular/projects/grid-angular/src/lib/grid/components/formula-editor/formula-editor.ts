/**
 * `AdeoGridFormulaEditorComponent` — specialised inline editor rendered in
 * place of the default text input whenever a cell is being edited and the
 * column has `allowFormula: true`.
 *
 * Phase A (this file): colored-ref overlay driven by the tolerant
 * tokenizer + `FormulaRefHighlightService`. The input stays fully native
 * (IME, copy/paste, selection) — we layer a transparent-text `<pre>` on
 * top that re-paints the text, colouring each reference with a palette
 * slot shared with the grid cell borders.
 *
 * Phase B will add click-to-pick (cells → editor) and Phase C the
 * autocomplete panel. The public surface stays stable across phases:
 * `(value, valueChange, commit, cancel)` — the parent `AdeoGridCellComponent`
 * already owns the draft state.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  ConnectedPosition,
} from '@angular/cdk/overlay';
import { GridStateManager } from '../../state/grid-state';
import { FormulaEngine } from '../../features/formula/formula.engine';
import {
  FormulaRefHighlightService,
  RefHighlight,
} from '../../features/formula/formula-ref-highlight.service';
import {
  extractEditorRefTokens,
  tokenizeFormulaEditor,
} from '../../features/formula/formula-tokenizer';
import {
  RefMapperContext,
  rangeToAddresses,
  structuredRefToAddress,
} from '../../features/formula/formula-ref-mapper';
import { columnIndexToLetters } from '../../features/formula/formula-ast';
import {
  FormulaSuggestion,
  computeFormulaSuggestions,
  suggestionInsertionText,
} from '../../features/formula/formula-suggestions';
import type { CellAddress } from '../../models/formula.model';

interface OverlaySegment {
  readonly text: string;
  /** CSS var or `null` when the segment uses the default text color. */
  readonly color: string | null;
}

@Component({
  selector: 'ad-grid-formula-editor',
  standalone: true,
  imports: [CdkConnectedOverlay, CdkOverlayOrigin],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './formula-editor.html',
  styleUrls: ['./formula-editor.scss'],
})
export class AdeoGridFormulaEditorComponent {
  private readonly state = inject(GridStateManager);
  private readonly highlight = inject(FormulaRefHighlightService);
  private readonly engine = inject(FormulaEngine);
  private readonly destroyRef = inject(DestroyRef);

  readonly value = input<string>('');
  readonly locale = input<'en' | 'fr'>('en');
  /**
   * Address of the cell currently being edited. Drives `@row` resolution
   * for highlighting and click-to-pick. When omitted, the editor falls
   * back to `cellEditState` to derive it from the inline edit coord.
   */
  readonly editingAddr = input<CellAddress | null>(null);
  /**
   * When `true`, the editor behaves as a plain text field: no click-to-pick
   * from grid cells, and no ref-color painting of referenced cells. Used by
   * the formula bar, where picking-by-click competes with normal cell
   * selection and confuses users.
   */
  readonly disableCellPick = input<boolean>(false);

  readonly valueChange = output<string>();
  readonly commit = output<void>();
  readonly cancel = output<void>();

  readonly inputEl = viewChild.required<ElementRef<HTMLInputElement>>('input');
  readonly origin = viewChild.required(CdkOverlayOrigin);

  private readonly caret = signal<number>(0);

  private readonly fieldOrder = computed(() =>
    this.state.visibleColumns().map((c) => c.field),
  );

  private readonly tokens = computed(() =>
    tokenizeFormulaEditor(this.value(), {
      locale: this.locale(),
      fieldOrder: this.fieldOrder(),
    }),
  );

  private readonly refTokens = computed(() => extractEditorRefTokens(this.tokens()));

  // ─── Autocomplete state ───────────────────────────────────────────────────

  /** Suggestions recomputed on every (value, caret) change. */
  readonly suggestions = computed<FormulaSuggestion[]>(() =>
    computeFormulaSuggestions(this.tokens(), this.caret(), this.engine.getFunctions()),
  );

  /** Index of the suggestion currently focused in the listbox. */
  readonly selectedIndex = signal(0);

  /** User-initiated dismissal (Esc, outside click). Resets on next input so
   *  the panel reappears naturally if they keep typing. */
  private readonly panelDismissed = signal(false);

  /** Target caret position to restore once Angular has re-synced the
   *  `[value]` binding after a click-to-pick or suggestion accept. */
  private readonly pendingCaret = signal<number | null>(null);

  /** `true` iff at least one suggestion is available and the user hasn't
   *  explicitly dismissed the panel. */
  readonly panelOpen = computed(
    () => !this.panelDismissed() && this.suggestions().length > 0,
  );

  /** CDK overlay placement — below the cell by default, flipped on top when
   *  there's no room at the bottom of the viewport. */
  readonly panelPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 2 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -2 },
  ];

  readonly overlaySegments = computed<OverlaySegment[]>(() => {
    const src = this.value();
    const refs = this.refTokens();
    const segs: OverlaySegment[] = [];
    let cursor = 0;
    for (const r of refs) {
      if (r.start > cursor) {
        segs.push({ text: src.slice(cursor, r.start), color: null });
      }
      const { cssVar } = this.highlight.colorFor(r.text);
      segs.push({ text: r.text, color: cssVar });
      cursor = r.end;
    }
    if (cursor < src.length) {
      segs.push({ text: src.slice(cursor), color: null });
    }
    return segs;
  });

  constructor() {
    // Reset highlighted row whenever the suggestion list changes. Keeping
    // the index on `0` avoids the panel appearing with an out-of-range
    // selection when the user continues typing.
    effect(() => {
      const size = this.suggestions().length;
      if (size === 0) {
        this.selectedIndex.set(0);
        return;
      }
      const idx = this.selectedIndex();
      if (idx >= size) this.selectedIndex.set(0);
    });

    // Restore the caret *after* Angular repaints the input. Setting
    // `el.value` via the `[value]` binding pushes the cursor to the end of
    // the input; this effect re-applies the intended position once the
    // render has settled.
    afterRenderEffect(() => {
      const target = this.pendingCaret();
      if (target === null) return;
      const el = this.inputEl().nativeElement;
      el.setSelectionRange(target, target);
      this.pendingCaret.set(null);
    });

    effect(() => {
      const refs = this.refTokens();
      const ctx = this.refMapperContext();
      const highlights: RefHighlight[] = [];
      for (const r of refs) {
        const cells: CellAddress[] = [];
        if (r.isRange && r.refs.length === 2) {
          for (const addr of rangeToAddresses(r.refs[0], r.refs[1], ctx)) {
            if (addr) cells.push(addr);
          }
        } else {
          const addr = structuredRefToAddress(r.refs[0], ctx);
          if (addr) cells.push(addr);
        }
        const { index, cssVar } = this.highlight.colorFor(r.text);
        highlights.push({
          key: r.text,
          cells,
          tokenStart: r.start,
          tokenEnd: r.end,
          colorIndex: index,
          cssVar,
        });
      }
      this.highlight.setHighlights(highlights);
    });

    afterNextRender(() => {
      // Activate unconditionally so referenced cells paint their ref-color
      // borders and headers show column-letter badges. `pickMode` gates the
      // click-to-pick behaviour alone — the formula bar opts out because
      // cell clicks there compete with normal cell selection.
      this.highlight.activate(
        {
          pickCell: (addr, opts) => this.handlePickCell(addr, opts),
          pickRangeStart: (addr, opts) => this.handlePickRangeStart(addr, opts),
          pickRangeExtend: (end) => this.handlePickRangeExtend(end),
          pickRangeCommit: () => this.handlePickRangeCommit(),
        },
        { pickMode: !this.disableCellPick() },
      );
      this.focus();
    });

    this.destroyRef.onDestroy(() => this.highlight.deactivate());
  }

  focus(): void {
    const el = this.inputEl().nativeElement;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
    this.caret.set(end);
  }

  onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.caret.set(el.selectionStart ?? el.value.length);
    // Typing re-arms the autocomplete: a prior `Esc` only dismisses the
    // current list, not all future ones.
    this.panelDismissed.set(false);
    this.valueChange.emit(el.value);
  }

  onCaretProbe(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.caret.set(el.selectionStart ?? 0);
  }

  onKeyDown(event: KeyboardEvent): void {
    const open = this.panelOpen();

    if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      event.stopPropagation();
      const size = this.suggestions().length;
      const idx = this.selectedIndex();
      const next = event.key === 'ArrowDown' ? (idx + 1) % size : (idx - 1 + size) % size;
      this.selectedIndex.set(next);
      return;
    }

    if (open && (event.key === 'Tab' || event.key === 'Enter')) {
      event.preventDefault();
      // Stop bubbling so the grid's edit-mode handler doesn't commit the
      // cell when the user is just accepting a suggestion.
      event.stopPropagation();
      this.acceptSuggestion(this.selectedIndex());
      return;
    }

    // `Escape` with an open panel just dismisses the panel — leaves the
    // editor alive so the user can keep typing. Second Escape cancels edit.
    if (open && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closePanel();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      this.commit.emit();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel.emit();
      return;
    }
  }

  // ─── Suggestion panel ─────────────────────────────────────────────────────

  /** Called by clicking an entry — accept + close the panel. */
  onSuggestionMouseDown(event: MouseEvent, index: number): void {
    // `mousedown` handler + preventDefault so the input keeps focus.
    event.preventDefault();
    this.acceptSuggestion(index);
  }

  onSuggestionMouseEnter(index: number): void {
    this.selectedIndex.set(index);
  }

  closePanel(): void {
    this.panelDismissed.set(true);
  }

  private acceptSuggestion(index: number): void {
    const list = this.suggestions();
    const entry = list[index];
    if (!entry) return;
    const el = this.inputEl().nativeElement;
    const insert = suggestionInsertionText(entry);
    const next =
      el.value.slice(0, entry.replaceStart) + insert + el.value.slice(entry.replaceEnd);
    el.value = next;
    const caret = entry.replaceStart + insert.length;
    el.setSelectionRange(caret, caret);
    this.caret.set(caret);
    this.valueChange.emit(next);
    el.focus();
    // Re-pin the caret after the `[value]` binding re-syncs (zoneless render).
    this.pendingCaret.set(caret);
  }

  // ─── Click-to-pick ──────────────────────────────────────────────────────

  private pickAnchor: number | null = null;
  private pickEnd: number | null = null;
  private pickStartAddr: CellAddress | null = null;
  private pickAbsolute = false;

  private handlePickCell(addr: CellAddress, opts: { absolute: boolean }): void {
    const text = this.formatRef(addr, opts.absolute);
    if (!text) return;
    this.replacePickTarget(text);
    this.resetPick();
  }

  private handlePickRangeStart(addr: CellAddress, opts: { absolute: boolean }): void {
    const text = this.formatRef(addr, opts.absolute);
    if (!text) return;
    const { from, to } = this.replacePickTarget(text);
    this.pickAnchor = from;
    this.pickEnd = to;
    this.pickStartAddr = addr;
    this.pickAbsolute = opts.absolute;
  }

  /**
   * When the caret sits on or adjacent to an existing ref token (simple or
   * range), clicking another cell should *replace* that ref instead of
   * appending next to it — mirrors Excel / Google Sheets behaviour. Falls
   * back to the current selection / caret when no ref is nearby.
   */
  private replacePickTarget(text: string): { from: number; to: number } {
    const el = this.inputEl().nativeElement;
    const selStart = el.selectionStart ?? el.value.length;
    const selEnd = el.selectionEnd ?? selStart;
    // Explicit selection always wins — the user highlighted something on purpose.
    if (selStart !== selEnd) return this.replaceRange(selStart, selEnd, text);

    const refs = this.refTokens();
    for (const r of refs) {
      if (selStart >= r.start && selStart <= r.end) {
        return this.replaceRange(r.start, r.end, text);
      }
    }
    return this.replaceRange(selStart, selEnd, text);
  }

  private handlePickRangeExtend(end: CellAddress): void {
    if (this.pickAnchor === null || this.pickEnd === null || !this.pickStartAddr) return;
    const startText = this.formatRef(this.pickStartAddr, this.pickAbsolute);
    const endText = this.formatRef(end, this.pickAbsolute);
    if (!startText || !endText) return;
    const sameCell =
      this.pickStartAddr.rowId === end.rowId && this.pickStartAddr.field === end.field;
    const text = sameCell ? startText : `${startText}:${endText}`;
    const { to } = this.replaceRange(this.pickAnchor, this.pickEnd, text);
    this.pickEnd = to;
  }

  private handlePickRangeCommit(): void {
    this.resetPick();
  }

  private resetPick(): void {
    this.pickAnchor = null;
    this.pickEnd = null;
    this.pickStartAddr = null;
    this.pickAbsolute = false;
  }

  private formatRef(addr: CellAddress, absolute: boolean): string {
    const fields = this.fieldOrder();
    const colIdx = fields.indexOf(addr.field);
    if (colIdx < 0) return '';
    const idField = this.state.rowIdField();
    const rowIndex = this.state
      .sourceData()
      .findIndex((r) => (r as Record<string, unknown>)[idField] === addr.rowId);
    if (rowIndex < 0) return '';
    const letters = columnIndexToLetters(colIdx);
    const row = rowIndex + 1;
    // Holding the modifier that sets `absolute` locks both axes (`$A$1`),
    // matching what Excel's F4 produces on a single keystroke.
    if (absolute) return `$${letters}$${row}`;
    return `${letters}${row}`;
  }

  private replaceRange(from: number, to: number, text: string): { from: number; to: number } {
    const el = this.inputEl().nativeElement;
    const next = el.value.slice(0, from) + text + el.value.slice(to);
    el.value = next;
    const caret = from + text.length;
    el.setSelectionRange(caret, caret);
    this.caret.set(caret);
    this.valueChange.emit(next);
    el.focus();
    // In zoneless mode Angular re-syncs `[value]="value()"` on the next
    // render cycle (via the scheduler, not the microtask queue). That
    // re-write of `el.value` is what pushes the caret back to the end.
    // Queue the restore after the paint so it runs once the binding has
    // re-applied.
    this.pendingCaret.set(caret);
    return { from, to: from + text.length };
  }

  private refMapperContext(): RefMapperContext {
    const rowIds = this.state.sourceData().map((r) => {
      const row = r as Record<string, unknown>;
      return (row[this.state.rowIdField()] as string | number | undefined) ?? '';
    });
    return {
      fields: this.fieldOrder(),
      rowIds,
      currentRowId: this.currentRowId(),
    };
  }

  /**
   * Resolve the row the formula is being edited on. `editingAddr` wins when
   * provided; otherwise we derive the row id from the inline edit coord.
   */
  private currentRowId(): string | number | undefined {
    const addr = this.editingAddr();
    if (addr) return addr.rowId;
    const coord = this.state.cellEditState().editingCell;
    if (!coord) return undefined;
    const idField = this.state.rowIdField();
    const row = this.state.sourceData()[coord.row] as Record<string, unknown> | undefined;
    const rowId = row?.[idField];
    return typeof rowId === 'string' || typeof rowId === 'number' ? rowId : undefined;
  }

  onScroll(event: Event): void {
    // Keep the overlay aligned with the input's horizontal scroll so long
    // formulas stay glued to the caret rather than drifting out of view.
    const el = event.target as HTMLInputElement;
    const overlay = (this.inputEl().nativeElement.parentElement?.querySelector(
      '.ad-grid-formula-editor__overlay',
    ) ?? null) as HTMLElement | null;
    if (overlay) overlay.scrollLeft = el.scrollLeft;
  }
}
