import { Injectable, computed, inject, signal } from '@angular/core';
import { ClipboardEngine, HistoryCellChange } from './clipboard.engine';

export type HistoryOpType = 'edit' | 'paste' | 'cut' | 'fill' | 'delete' | 'fill-down' | 'fill-right' | 'fill-selection';

export interface HistoryOp {
  type: HistoryOpType;
  changes: HistoryCellChange[];
  timestamp: number;
}

const MAX_HISTORY = 50;
const STORAGE_PREFIX = 'adeo-grid-history:';

@Injectable()
export class HistoryEngine<T = unknown> {
  private readonly clipboard = inject<ClipboardEngine<T>>(ClipboardEngine);

  private readonly past = signal<HistoryOp[]>([]);
  private readonly future = signal<HistoryOp[]>([]);
  private storageKey: string | null = null;

  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);

  /**
   * Binds a persistence key: all record/undo/redo calls will mirror the stacks
   * to localStorage, and past state is restored on bind. Pass null to detach.
   */
  attach(gridId: string | null): void {
    this.storageKey = gridId ? `${STORAGE_PREFIX}${gridId}` : null;
    if (!this.storageKey) {
      this.past.set([]);
      this.future.set([]);
      return;
    }
    this.restore();
  }

  /** Records a new mutation. Clears the redo stack (standard undo semantics). */
  record(type: HistoryOpType, changes: HistoryCellChange[]): void {
    if (changes.length === 0) return;
    const op: HistoryOp = { type, changes, timestamp: Date.now() };
    this.past.update((stack) => {
      const next = [...stack, op];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    this.future.set([]);
    this.persist();
  }

  undo(): HistoryOp | null {
    const stack = this.past();
    if (stack.length === 0) return null;
    const op = stack[stack.length - 1];
    this.clipboard.applyChanges(op.changes, 'before');
    this.past.set(stack.slice(0, -1));
    this.future.update((f) => [...f, op]);
    this.persist();
    return op;
  }

  redo(): HistoryOp | null {
    const stack = this.future();
    if (stack.length === 0) return null;
    const op = stack[stack.length - 1];
    this.clipboard.applyChanges(op.changes, 'after');
    this.future.set(stack.slice(0, -1));
    this.past.update((p) => [...p, op]);
    this.persist();
    return op;
  }

  clear(): void {
    this.past.set([]);
    this.future.set([]);
    if (this.storageKey) {
      try {
        localStorage.removeItem(this.storageKey);
      } catch {
        // Storage unavailable (private mode, quota) — non-fatal.
      }
    }
  }

  private persist(): void {
    if (!this.storageKey) return;
    try {
      const payload = JSON.stringify({
        past: this.past(),
        future: this.future(),
      });
      localStorage.setItem(this.storageKey, payload);
    } catch {
      // Quota exceeded or storage disabled — we silently drop persistence.
    }
  }

  private restore(): void {
    if (!this.storageKey) return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        this.past.set([]);
        this.future.set([]);
        return;
      }
      const parsed = JSON.parse(raw) as { past?: HistoryOp[]; future?: HistoryOp[] };
      this.past.set(Array.isArray(parsed.past) ? parsed.past : []);
      this.future.set(Array.isArray(parsed.future) ? parsed.future : []);
    } catch {
      this.past.set([]);
      this.future.set([]);
    }
  }
}
