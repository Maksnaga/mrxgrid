import { Injectable, inject, NgZone } from '@angular/core';
import { GridStateManager } from '../state/grid-state';
import { ColumnReorderEngine } from './column-reorder.engine';
import { HorizontalVirtualScrollEngine } from './horizontal-virtual-scroll.engine';

/** Minimum pixels of mouse movement before a drag is initiated */
const DRAG_THRESHOLD = 5;

/** Distance from edge in px at which auto-scroll activates */
const AUTO_SCROLL_ZONE = 60;

/** Max scroll speed in px/frame */
const AUTO_SCROLL_SPEED = 12;

@Injectable()
export class ColumnDragEngine {
  private readonly ngZone = inject(NgZone);
  private readonly state = inject(GridStateManager);
  private readonly reorderEngine = inject(ColumnReorderEngine);
  private readonly hvScrollEngine = inject(HorizontalVirtualScrollEngine);

  // --- Pending state (before threshold is met) ---
  private pending = false;
  private startX = 0;
  private startY = 0;
  private pendingSourceIndex = -1;
  private pendingHeaderRow: HTMLElement | null = null;

  // --- Active drag state (after threshold is met) ---
  private active = false;
  private originalIndex = -1;
  private headerRow: HTMLElement | null = null;
  private ghostEl: HTMLElement | null = null;
  private ghostOffsetX = 0;
  private ghostOffsetY = 0;

  // Full-height drop indicator
  private dropLineEl: HTMLElement | null = null;

  // Auto-scroll state
  private scrollEl: HTMLElement | null = null;
  private autoScrollRafId: number | null = null;
  private autoScrollDirection = 0; // -1 left, 0 none, 1 right

  private onMoveHandler = (e: MouseEvent) => this.onMouseMove(e);
  private onUpHandler = () => this.onMouseUp();

  /** Callback set by the header component to emit the reorder event */
  onReorder: ((previousIndex: number, currentIndex: number) => void) | null = null;

  /**
   * Called on mousedown on a header cell.
   * Does NOT preventDefault — this allows normal click/sort to work.
   * Only registers mousemove/mouseup listeners to detect drag.
   */
  startDrag(event: MouseEvent, sourceIndex: number, headerRow: HTMLElement): void {
    this.pending = true;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.pendingSourceIndex = sourceIndex;
    this.pendingHeaderRow = headerRow;

    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.onMoveHandler);
      document.addEventListener('mouseup', this.onUpHandler);
    });
  }

  private activateDrag(): void {
    this.pending = false;
    this.active = true;
    this.originalIndex = this.pendingSourceIndex;
    this.headerRow = this.pendingHeaderRow;

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const cols = this.state.unpinnedColumns();
    if (cols[this.originalIndex]) {
      this.ngZone.run(() => {
        this.state.draggingColumn.set(cols[this.originalIndex].field);
      });
    }

    this.createGhost();
  }

  private createGhost(): void {
    if (!this.headerRow) return;
    const headerCells = this.queryUnpinnedHeaderCells();
    // `originalIndex` is the absolute index in state.unpinnedColumns(); the
    // DOM only renders the virtualized window, so subtract its start offset.
    const localIndex = this.originalIndex - this.state.effectiveColumnRange().start;
    const sourceCell = headerCells[localIndex];
    if (!sourceCell) return;

    const rect = sourceCell.getBoundingClientRect();

    // Read the canonical width from state instead of the rect: when the
    // source cell happens to be the last rendered cell with `isLast=true`
    // (flex: 1 0 auto, no fixed width), the rect reflects flex stretching
    // and the ghost would span the entire scrollable width.
    const sourceCol = this.state.unpinnedColumns()[this.originalIndex];
    const width = sourceCol?.currentWidth ?? rect.width;

    // Clamp the click offset to the ghost's actual width so the cursor stays
    // over the ghost when the source was rendered wider than `currentWidth`.
    this.ghostOffsetX = Math.min(this.startX - rect.left, width);
    this.ghostOffsetY = this.startY - rect.top;

    const ghost = sourceCell.cloneNode(true) as HTMLElement;
    ghost.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${width}px;
      height: ${rect.height}px;
      opacity: 0.92;
      z-index: 10000;
      pointer-events: none;
      box-shadow: 0 8px 24px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12);
      border-radius: 6px;
      background: var(--color-background-primary, #fff);
      border: 2px solid var(--color-background-accent-inverse);
      transition: none;
    `;
    document.body.appendChild(ghost);
    this.ghostEl = ghost;

    sourceCell.style.opacity = '0.2';
  }

  private moveGhost(clientX: number, clientY: number): void {
    if (!this.ghostEl) return;
    this.ghostEl.style.left = `${clientX - this.ghostOffsetX}px`;
    this.ghostEl.style.top = `${clientY - this.ghostOffsetY}px`;
  }

  private removeGhost(): void {
    if (this.ghostEl) {
      this.ghostEl.remove();
      this.ghostEl = null;
    }
    if (this.headerRow) {
      const cells = this.queryUnpinnedHeaderCells();
      for (const cell of cells) {
        cell.style.opacity = '';
      }
    }
  }

  /** Returns the unpinned (i.e. reorderable) header cells in render order.
   * Filters out pinned-left/right cells which use `position: sticky` and
   * carry the `grid-header-cell-host--pinned` host class. */
  private queryUnpinnedHeaderCells(): HTMLElement[] {
    if (!this.headerRow) return [];
    return Array.from(
      this.headerRow.querySelectorAll<HTMLElement>(
        'ad-grid-header-cell:not(.grid-header-cell-host--pinned)',
      ),
    );
  }

  private onMouseMove(event: MouseEvent): void {
    if (this.pending && !this.active) {
      const dx = event.clientX - this.startX;
      const dy = event.clientY - this.startY;
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      this.activateDrag();
    }

    if (!this.active || !this.headerRow) return;

    this.moveGhost(event.clientX, event.clientY);
    this.updateAutoScroll(event.clientX);

    const headerCells = this.queryUnpinnedHeaderCells();
    const rangeStart = this.state.effectiveColumnRange().start;
    const cursorX = event.clientX;

    // Drop indices are absolute (relative to state.unpinnedColumns()), so
    // translate the local DOM index back to the absolute frame. While a
    // drag is active the virtualization engine forces `fullRange()`, so the
    // DOM holds every unpinned cell and start offset is 0 in practice — but
    // we keep the translation explicit in case the effect hasn't flushed.
    let dropIndex: number | null = null;
    for (let i = 0; i < headerCells.length; i++) {
      const rect = headerCells[i].getBoundingClientRect();
      const midX = rect.left + rect.width / 2;

      if (cursorX < midX) {
        dropIndex = rangeStart + i;
        break;
      }
    }

    // If cursor is past the last rendered cell, drop at the very end.
    if (dropIndex === null) {
      dropIndex = rangeStart + headerCells.length;
    }

    // Don't show indicator at the source column's own position or immediately after it
    if (dropIndex === this.originalIndex || dropIndex === this.originalIndex + 1) {
      dropIndex = null;
    }

    const current = this.state.dropIndicatorIndex();
    if (current !== dropIndex) {
      this.ngZone.run(() => {
        this.state.dropIndicatorIndex.set(dropIndex);
      });
    }

    // Position the full-height drop indicator line
    this.updateDropLine(dropIndex, headerCells);
  }

  private onMouseUp(): void {
    document.removeEventListener('mousemove', this.onMoveHandler);
    document.removeEventListener('mouseup', this.onUpHandler);

    if (!this.active) {
      this.cleanup();
      return;
    }

    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    this.removeGhost();

    const prevIdx = this.originalIndex;
    const dropIdx = this.state.dropIndicatorIndex();

    // Auto-scroll moved the viewport while state.scrollLeft was frozen (see
    // HorizontalVirtualScrollEngine.onScroll). Push the real DOM scroll
    // position into state in the same tick as we clear draggingColumn —
    // otherwise the virtualization effect reruns with a stale scrollLeft and
    // renders a column range that doesn't match what the user is looking at.
    const scrollEl = this.scrollEl;
    this.ngZone.run(() => {
      if (scrollEl) {
        this.state.scrollLeft.set(scrollEl.scrollLeft);
        this.state.scrollViewportWidth.set(scrollEl.clientWidth);
      }
      this.state.draggingColumn.set(null);
      this.state.dropIndicatorIndex.set(null);
    });

    this.cleanup();

    if (dropIdx !== null && dropIdx !== prevIdx && dropIdx !== prevIdx + 1) {
      // Adjust target index: if dropping after the source, subtract 1
      // because the source will be removed first
      const targetIndex = dropIdx > prevIdx ? dropIdx - 1 : dropIdx;
      this.ngZone.run(() => {
        this.reorderEngine.reorderUnpinned(prevIdx, targetIndex);
        this.onReorder?.(prevIdx, targetIndex);
      });
    }
  }

  // ── Drop line (full-height indicator) ─────────────────────

  private updateDropLine(dropIndex: number | null, headerCells: HTMLElement[]): void {
    if (dropIndex === null) {
      this.removeDropLine();
      return;
    }

    // Translate the absolute drop index back to the local DOM index.
    const rangeStart = this.state.effectiveColumnRange().start;
    const localDropIndex = dropIndex - rangeStart;

    // Get the x position of the drop boundary
    let lineX: number;
    if (localDropIndex >= 0 && localDropIndex < headerCells.length) {
      const rect = headerCells[localDropIndex].getBoundingClientRect();
      lineX = rect.left;
    } else if (headerCells.length > 0) {
      const rect = headerCells[headerCells.length - 1].getBoundingClientRect();
      lineX = rect.right;
    } else {
      this.removeDropLine();
      return;
    }

    // The grid container itself is now the scroll viewport (no more nested
    // cdk-virtual-scroll-viewport). Use it as the reference rectangle.
    const grid = this.headerRow?.closest('.ad-grid');
    if (!grid) return;
    const gridRect = grid.getBoundingClientRect();

    if (!this.dropLineEl) {
      this.dropLineEl = document.createElement('div');
      this.dropLineEl.style.cssText = `
        position: fixed;
        width: 3px;
        background: var(--color-background-accent-inverse);
        z-index: 10001;
        pointer-events: none;
        border-radius: 2px;
      `;
      document.body.appendChild(this.dropLineEl);
    }

    this.dropLineEl.style.left = `${lineX - 1}px`;
    this.dropLineEl.style.top = `${gridRect.top}px`;
    this.dropLineEl.style.height = `${gridRect.height}px`;
  }

  private removeDropLine(): void {
    if (this.dropLineEl) {
      this.dropLineEl.remove();
      this.dropLineEl = null;
    }
  }

  // ── Auto-scroll helpers ──────────────────────────────────

  private findScrollElement(): HTMLElement | null {
    if (!this.headerRow) return null;
    // The actual scroll viewport is `.ad-grid__scroll` — the outer
    // `.ad-grid` is non-scrollable layout chrome. Reading scrollLeft on
    // the wrong element would always return 0 and feed a stale value into
    // the virtualization recompute on mouseup.
    return (this.headerRow.closest('.ad-grid__scroll') as HTMLElement | null) ?? null;
  }

  private updateAutoScroll(clientX: number): void {
    if (!this.scrollEl) {
      this.scrollEl = this.findScrollElement();
    }
    if (!this.scrollEl) return;

    const rect = this.scrollEl.getBoundingClientRect();
    const distFromLeft = clientX - rect.left;
    const distFromRight = rect.right - clientX;

    if (distFromLeft < AUTO_SCROLL_ZONE) {
      this.autoScrollDirection = -1;
    } else if (distFromRight < AUTO_SCROLL_ZONE) {
      this.autoScrollDirection = 1;
    } else {
      this.autoScrollDirection = 0;
    }

    if (this.autoScrollDirection !== 0 && this.autoScrollRafId === null) {
      this.startAutoScroll();
    } else if (this.autoScrollDirection === 0) {
      this.stopAutoScroll();
    }
  }

  private startAutoScroll(): void {
    const tick = () => {
      if (!this.scrollEl || this.autoScrollDirection === 0) {
        this.stopAutoScroll();
        return;
      }
      this.scrollEl.scrollLeft += this.autoScrollDirection * AUTO_SCROLL_SPEED;
      this.autoScrollRafId = requestAnimationFrame(tick);
    };
    this.autoScrollRafId = requestAnimationFrame(tick);
  }

  private stopAutoScroll(): void {
    if (this.autoScrollRafId !== null) {
      cancelAnimationFrame(this.autoScrollRafId);
      this.autoScrollRafId = null;
    }
    this.autoScrollDirection = 0;
  }

  private cleanup(): void {
    this.stopAutoScroll();
    this.removeDropLine();
    this.pending = false;
    this.active = false;
    this.originalIndex = -1;
    this.headerRow = null;
    this.pendingHeaderRow = null;
    this.ghostEl = null;
    this.scrollEl = null;
  }
}
