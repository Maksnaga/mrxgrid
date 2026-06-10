import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  TemplateRef,
  viewChild,
  afterNextRender,
  NgZone,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Overlay } from '@angular/cdk/overlay';
import { GridStateManager } from './state/grid-state';
import { GridEngine } from './engine/grid-engine';
import { SortEngine } from './features/sort.engine';
import { ColumnResizeEngine } from './features/column-resize.engine';
import { InlineEditEngine } from './features/inline-edit.engine';
import { RowSelectionEngine } from './features/row-selection.engine';
import { CellSelectionEngine } from './features/cell-selection.engine';
import { CellValidationEngine } from './features/cell-validation.engine';
import { KeyboardEngine } from './features/keyboard.engine';
import { ClipboardEngine, HistoryCellChange, PASTE_SKIP } from './features/clipboard.engine';
import { HistoryEngine } from './features/history.engine';
import { GroupEngine } from './features/group.engine';
import { FilterEngine } from './features/filter.engine';
import { ColumnReorderEngine } from './features/column-reorder.engine';
import { ColumnDragEngine } from './features/column-drag.engine';
import { ExpandableRowEngine } from './features/expandable-row.engine';
import { StatePersistenceEngine } from './features/state-persistence.engine';
import { ExportEngine, ExportOptions } from './features/export.engine';
import { TreeEngine } from './features/tree.engine';
import { ServerGroupEngine, ServerGroupingOptions } from './features/server-group.engine';
import { HorizontalVirtualScrollEngine } from './features/horizontal-virtual-scroll.engine';
import { VerticalVirtualScrollEngine } from './features/vertical-virtual-scroll.engine';
import { PaginationEngine } from './features/pagination.engine';
import { InfiniteScrollEngine } from './features/infinite-scroll.engine';
import { AutosizeEngine } from './features/autosize.engine';
import { FormulaEngine } from './features/formula/formula.engine';
import { FormulaRefHighlightService } from './features/formula/formula-ref-highlight.service';
import { shiftFormulaRefs } from './features/formula/formula-shift';
import { columnIndexToLetters } from './features/formula/formula-ast';
import { a1ToLongForm } from './features/formula/formula-ref-mapper';
import type { CellAddress, FormulaValue } from './models/formula.model';
import { GridPlugin } from './models/plugin.model';
import { AdeoGridColumnDef } from './directives/grid-column-def';
import { AdeoGridToolbarDef } from './directives/grid-toolbar-def';
import { GridEmptyContext, GridEmptyKind, AdeoGridEmptyDef } from './directives/grid-empty-def';
import { AdeoGridEmptyStateComponent } from './components/empty-state/grid-empty-state';
import { AdeoGridHeaderComponent } from './components/header/grid-header';
import { AdeoGridBodyComponent } from './components/body/grid-body';
import { AdeoGridFooterComponent } from './components/footer/grid-footer';
import { AdeoGridLoadingIndicatorComponent } from './components/loading-indicator/grid-loading-indicator';
import { AdeoGridQuickFilterRowComponent } from './components/quick-filter-row/grid-quick-filter-row';
import { AdeoGridMeasurementZoneComponent } from './components/measurement-zone/grid-measurement-zone';
import { MozTagComponent } from '@mozaic-ds/angular';
import { MozIconButtonComponent } from '@mozaic-ds/angular';
import { MozNumberBadgeComponent } from '@mozaic-ds/angular';
import { HeaderMenuActionId } from './models/column.model';
import { SortDef, SortEvent } from './models/sort.model';
import { LoadingStrategy, PageEvent, LoadMoreEvent } from './models/pagination.model';
import {
  CellEditEvent,
  CellEditCancelEvent,
  BulkEditEvent,
  BulkCopyEvent,
  BulkPasteEvent,
  BulkDeleteEvent,
  BulkCellChange,
  CellError,
  FillDownEvent,
  CellRange,
} from './models/cell.model';
import { AdeoGridSelectionBarComponent } from './components/selection-bar/grid-selection-bar';
import {
  RowSelectionEvent,
  CellSelectionEvent,
  GroupEvent,
  GroupEntry,
  FilterEvent,
  GridExportEvent,
  GridSettingsData,
  GridSettingsResult,
  GridDensity,
  GroupDrawerData,
  GroupDrawerResult,
} from './models/grid-events.model';
import { MozDrawerService } from '@mozaic-ds/angular';
import { GridSettingsDrawerComponent } from './components/settings-drawer/grid-settings-drawer';
import { GridGroupDrawerComponent } from './components/group-drawer/grid-group-drawer';
import { GridKeyboardShortcutsDrawerComponent } from './components/keyboard-shortcuts-drawer/grid-keyboard-shortcuts-drawer';
import {
  GridFormulaReferenceDrawerComponent,
  FormulaReferenceData,
  FormulaReferenceEntry,
} from './components/formula-reference-drawer/grid-formula-reference-drawer';
import { AdeoGridFormulaEditorComponent } from './components/formula-editor/formula-editor';
import { AdeoGridFilterDrawerComponent } from './components/filter-drawer/grid-filter-drawer';
import { FilterApplyMode, FilterDrawerData, FilterDrawerResult, FilterMode, FilterModel } from './models/filter.model';
import { ActiveFilter } from './models/grid-events.model';
import {
  ViewGridX420,
  Filter20,
  Settings20,
  FullscreenEnter20,
  FullscreenExit20,
  Download20,
  ChevronUp20,
  ChevronDown20,
  Keyboard20,
  Calculator20,
} from '@mozaic-ds/icons-angular';
import { MozButtonComponent } from '@mozaic-ds/angular';

@Component({
  selector: 'ad-grid-angular',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    GridStateManager,
    GridEngine,
    SortEngine,
    ColumnResizeEngine,
    InlineEditEngine,
    RowSelectionEngine,
    CellSelectionEngine,
    KeyboardEngine,
    ClipboardEngine,
    HistoryEngine,
    GroupEngine,
    FilterEngine,
    ColumnReorderEngine,
    ColumnDragEngine,
    ExpandableRowEngine,
    StatePersistenceEngine,
    ExportEngine,
    TreeEngine,
    CellValidationEngine,
    HorizontalVirtualScrollEngine,
    VerticalVirtualScrollEngine,
    PaginationEngine,
    InfiniteScrollEngine,
    FormulaEngine,
    FormulaRefHighlightService,
    AutosizeEngine,
    ServerGroupEngine,
    Overlay,
  ],
  imports: [
    NgTemplateOutlet,
    AdeoGridHeaderComponent,
    AdeoGridBodyComponent,
    AdeoGridFooterComponent,
    AdeoGridLoadingIndicatorComponent,
    AdeoGridQuickFilterRowComponent,
    AdeoGridSelectionBarComponent,
    AdeoGridEmptyStateComponent,
    AdeoGridMeasurementZoneComponent,
    MozTagComponent,
    MozIconButtonComponent,
    MozNumberBadgeComponent,
    ViewGridX420,
    Filter20,
    Settings20,
    FullscreenEnter20,
    FullscreenExit20,
    Download20,
    ChevronUp20,
    ChevronDown20,
    Keyboard20,
    Calculator20,
    MozButtonComponent,
    AdeoGridFormulaEditorComponent,
  ],
  template: `
    <div class="ad-grid-wrapper" [class.ad-grid-wrapper--fullscreen]="isFullscreen()">
      <!-- Toolbar (outside .ad-grid) -->
      @if (showToolbar()) {
      <div class="ad-grid__toolbar">
        <div class="ad-grid__toolbar-left">
          @if (fullscreen()) {
          <moz-icon-button
            id="grid-fullscreen"
            [ghost]="true"
            size="s"
            [ariaLabel]="isFullscreen() ? 'Exit fullscreen' : 'Fullscreen'"
            (activated)="toggleFullscreen()"
          >
            @if (isFullscreen()) {
            <FullscreenExit20 icon />
            } @else {
            <FullscreenEnter20 icon />
            }
          </moz-icon-button>
          } @if (exportable()) {
          <moz-icon-button
            id="grid-export"
            [ghost]="true"
            size="s"
            ariaLabel="Export CSV"
            (activated)="onExportCsv()"
          >
            <Download20 icon />
          </moz-icon-button>
          }
          <div class="ad-grid__toolbar-filter">
            <moz-icon-button
              id="grid-filter"
              size="s"
              [ghost]="true"
              ariaLabel="Filters"
              (activated)="onFiltersClick()"
            >
              <Filter20 icon />
            </moz-icon-button>
            @if (activeFilterCount() > 0) {
            <moz-number-badge
              class="ad-grid__toolbar-filter-badge"
              [label]="activeFilterCount()"
              appearance="accent"
              size="s"
            />
            }
          </div>
          <moz-icon-button
            id="grid-settings"
            size="s"
            [ghost]="true"
            ariaLabel="Settings"
            (activated)="onSettingsClick()"
          >
            <Settings20 icon />
          </moz-icon-button>
          <moz-icon-button
            id="grid-group"
            size="s"
            [ghost]="true"
            ariaLabel="Group"
            (activated)="onGroupClick()"
          >
            <ViewGridX420 icon />
          </moz-icon-button>
          <moz-icon-button
            id="grid-keyboard-shortcuts"
            size="s"
            [ghost]="true"
            ariaLabel="Keyboard shortcuts"
            (activated)="onKeyboardShortcutsClick()"
          >
            <Keyboard20 icon />
          </moz-icon-button>
          @if (state.hasFormulaColumns()) {
          <moz-icon-button
            id="grid-formula-reference"
            size="s"
            [ghost]="true"
            ariaLabel="Formula reference"
            (activated)="onFormulaReferenceClick()"
          >
            <Calculator20 icon />
          </moz-icon-button>
          } @for (def of toolbarStartDefs(); track def) {
          <ng-container [ngTemplateOutlet]="def.template" />
          }
        </div>

        <!-- Selection banner -->
        @if (selectionBannerVisible()) {
        <div class="ad-grid__selection-banner">
          <span class="ad-grid__selection-text">
            {{ rowSelectionEngine.count() }} row(s) selected
          </span>
          @if (rowSelectionEngine.count() < selectionTotalCount()) {
          <button
            moz-button
            type="button"
            [size]="'s'"
            [ghost]="true"
            [appearance]="'accent'"
            (click)="onSelectAllRows()"
          >
            Select all {{ selectionTotalCount() }} rows
          </button>
          }
          <button moz-button type="button" [size]="'s'" [ghost]="true" (click)="onClearSelection()">
            Clear
          </button>
        </div>
        }

        <div class="ad-grid__toolbar-right">
          @for (def of toolbarEndDefs(); track def) {
          <ng-container [ngTemplateOutlet]="def.template" />
          }
        </div>
      </div>
      }

      <!-- Tag bars (outside .ad-grid) -->
      @if (state.groupColumns().length > 0) {
      <div class="ad-grid__tag-bar">
        <span class="ad-grid__tag-bar-label">GROUPED BY</span>
        @for (entry of state.groupColumns(); track entry.field) {
        <div>
          <moz-tag
            type="removable"
            size="s"
            [id]="'group-' + entry.field"
            (removeTag)="onRemoveGroup(entry.field)"
          >
            <button
              type="button"
              class="ad-grid__group-tag-btn"
              (click)="onToggleGroupSort(entry.field)"
            >
              {{ getColumnLabel(entry.field) }}
              @if (entry.sortDirection === 'asc') {
              <ChevronUp20 />
              } @else {
              <ChevronDown20 />
              }
            </button>
          </moz-tag>
        </div>
        }
      </div>
      } @if (hasHiddenColumns()) {
      <div class="ad-grid__tag-bar">
        <span class="ad-grid__tag-bar-label">HIDDEN COLUMNS</span>
        @for (col of hiddenColumnsList(); track col.field) {
        <moz-tag
          type="removable"
          size="s"
          [id]="'hidden-' + col.field"
          removableLabel="Restore"
          (removeTag)="onRestoreColumn(col.field)"
          >{{ col.label }}</moz-tag
        >
        } @if (hiddenColumnsList().length > 1) {
        <button type="button" class="ad-grid__tag-action-btn" (click)="onRestoreAllColumns()">
          Restore all
        </button>
        }
      </div>
      } @if (activeFilters().length > 0) {
      <div class="ad-grid__tag-bar">
        <span class="ad-grid__tag-bar-label">FILTERED BY</span>
        @for (filter of activeFilters(); track filter.id) {
        <moz-tag
          [type]="filter.removable ? 'removable' : 'informative'"
          size="s"
          [id]="'filter-' + filter.id"
          (removeTag)="onRemoveFilter(filter.id)"
          >{{ filter.label }}</moz-tag
        >
        }
        <button type="button" class="ad-grid__tag-action-btn" (click)="onRemoveAllFilters()">
          Remove all
        </button>
      </div>
      }
      <ng-content select="[adGridFilterTags]" />

      <!-- Formula bar (spreadsheet-style preview & editor of the focused cell) -->
      @if (state.hasFormulaColumns()) {
      <div class="ad-grid__formula-bar" (focusout)="onFormulaBarWrapperFocusout($event)">
        <div class="ad-grid__formula-bar-addr">{{ formulaBarAddress() }}</div>
        <div class="ad-grid__formula-bar-fx" aria-hidden="true">
          <span>fx</span>
        </div>
        <div class="ad-grid__formula-bar-content">
          @if (formulaBarEditing()) {
          <ad-grid-formula-editor
            class="ad-grid__formula-bar-editor"
            [value]="formulaBarDraft() ?? ''"
            [editingAddr]="formulaBarEditingAddr()"
            [disableCellPick]="true"
            (valueChange)="onFormulaBarEditorChange($event)"
            (commit)="onFormulaBarEditorCommit()"
            (cancel)="onFormulaBarEditorCancel()"
          />
          } @else {
          <input
            type="text"
            class="ad-grid__formula-bar-input"
            aria-label="Formule de la cellule"
            [value]="formulaBarContent()"
            [disabled]="!formulaBarEditable()"
            (focus)="onFormulaBarInputFocus()"
            readonly
            spellcheck="false"
            autocomplete="off"
          />
          }
        </div>
      </div>
      }

      <!-- Grid container: layout chrome (footer, overlays) lives here. The
           inner #gridContainer is the only scrollable element so footer &
           overlays don't move when the user scrolls the data. -->
      <div
        class="ad-grid"
        (keydown)="onKeydown($event)"
        (mouseup)="onMouseUp()"
      >
        <!-- Scrollable area: header (sticky top) + body (virtualized rows). -->
        <div class="ad-grid__scroll" tabindex="0" #gridContainer>
          <ad-grid-header
            [showCheckbox]="rowSelection()"
            [showExpand]="expandable()"
            [reorderable]="reorderable()"
            (sortClick)="onSortClick($event)"
            (menuAction)="onMenuAction($event)"
            (resizeStart)="onResizeStart($event)"
            (selectAllToggle)="onSelectAllToggle()"
          />

          @if (showQuickFilters()) {
          <ad-grid-quick-filter-row />
          }

          <ad-grid-body
            [showCheckbox]="rowSelection()"
            [showExpand]="expandable()"
            [detailTemplate]="detailTemplate()"
            [skeletonRowCount]="skeletonRowCount()"
            (cellEdit)="onCellEdit($event)"
            (cellEditCancel)="cellEditCancel.emit($event)"
            (groupToggle)="onGroupToggle($event)"
            (rowSelectionToggle)="onRowSelectionToggle()"
          />
        </div>

        <!-- Empty state overlay (consumer template wins, fallback default) -->
        @if (emptyStateKind() !== 'none') {
        <div class="ad-grid__empty-overlay">
          @if (emptyTemplate(); as tpl) {
          <ng-container *ngTemplateOutlet="tpl; context: emptyTemplateContext()" />
          } @else {
          <ad-grid-empty-state
            [kind]="$any(emptyStateKind())"
            [title]="emptyStateKind() === 'no-results' ? noResultsTitle() : emptyDataTitle()"
            [description]="
              emptyStateKind() === 'no-results' ? noResultsDescription() : emptyDataDescription()
            "
            [actionLabel]="emptyStateKind() === 'no-results' ? resolvedNoResultsActionLabel() : ''"
            (action)="onRemoveAllFilters()"
          />
          }
        </div>
        }

        <!-- Footer: pagination or infinite scroll loading indicator -->
        @if (showPagination()) {
        <ad-grid-footer
          [pageSizeOptions]="pageSizeOptions()"
          (pageChange)="pageChange.emit($event)"
        />
        } @if (showInfiniteScrollLoader()) {
        <ad-grid-loading-indicator />
        }

        <!-- Bulk selection action bar -->
        <ad-grid-selection-bar
          (editClick)="onBulkEdit()"
          (copyClick)="onBulkCopy()"
          (pasteClick)="onBulkPaste()"
          (exportClick)="onBulkExport()"
          (deleteClick)="onBulkDelete()"
        />

        <!-- Refreshing slot: rendered only when [refreshing]="true". The grid
             itself has no built-in visual for refreshing — consumers fill this
             slot with a thin progress bar or spinner of their choice. This is
             distinct from [loading] which replaces rows with skeleton cells. -->
        @if (refreshing()) {
        <ng-content select="[adGridRefreshing]" />
        }

        <!-- Hidden measurement zone: renders detail rows for ids currently
             in state.pendingExpansion so the grid can capture their height
             BEFORE they mount in the visible layout. Zero scrollbar bounce
             on expand and on scroll-through expanded rows. See
             AdeoGridMeasurementZoneComponent for the wiring. -->
        @if (expandable()) {
        <ad-grid-measurement-zone [detailTemplate]="detailTemplate()" />
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        /* Formula ref highlight palette — cyclic, stable per edit session.
           Consumers can override these CSS vars to rebrand the colors. */
        --ad-grid-ref-color-0: #1a73e8;
        --ad-grid-ref-color-1: #d93025;
        --ad-grid-ref-color-2: #188038;
        --ad-grid-ref-color-3: #e37400;
        --ad-grid-ref-color-4: #8430ce;
        --ad-grid-ref-color-5: #009e95;
        --ad-grid-ref-color-6: #c5221f;
        --ad-grid-ref-color-7: #5f6368;
      }

      .ad-grid-wrapper {
        display: flex;
        flex-direction: column;
        font-family: var(--font-family-primary);
        height: 100%;
        min-height: 0;
        gap: 16px;
      }

      .ad-grid-wrapper--fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 9999;
        background: var(--color-background-primary);
      }

      .ad-grid {
        display: flex;
        flex-direction: column;
        border-radius: var(--border-radius-l);
        overflow: hidden;
        background: var(--color-background-primary);
        flex: 1;
        min-height: 0;
        position: relative;
        box-shadow: 0px 0px 6px #cdd4d8;
      }

      /* The actual scroll viewport. Sticky header & sticky pinned column
         cells anchor to this element's containing block — there is no
         transform anywhere inside, so position:sticky behaves natively.
         overflow-anchor: auto lets the browser preserve scroll position
         when the top spacer changes height because a detail row above
         the viewport got (re)measured — this complements the engine's
         own scrollTop compensation and double-protects against the
         scrollbar bounce pattern on slow upward scroll. */
      .ad-grid__scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        overscroll-behavior: contain;
        overflow-anchor: auto;
        background: inherit;
      }

      /* Every row mounts as a scroll anchor candidate — without this,
         Chromium's heuristic may skip lightweight rows when picking the
         anchor, which lets the visible content drift during height
         corrections coming from detail-row ResizeObservers. */
      .ad-grid__scroll ad-grid-row,
      .ad-grid__scroll ad-grid-group-row,
      .ad-grid__scroll ad-grid-detail-row {
        overflow-anchor: auto;
      }

      .ad-grid__scroll:focus {
        outline: none;
      }

      /* Header is sticky to the top of the scroll viewport. */
      .ad-grid__scroll ad-grid-header {
        position: sticky;
        top: 0;
        z-index: 5;
        background: var(--color-background-primary, #fff);
      }

      /* Empty-state overlay sits above the (empty) virtual scroll viewport
         so column headers stay visible. The body keeps its layout to give
         the overlay something to be measured against. */
      .ad-grid__empty-overlay {
        position: absolute;
        inset: 0;
        top: var(--ad-grid-header-height, 48px);
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--Background-Primary, #fff);
        z-index: 1;
      }

      .ad-grid:focus {
        outline: none;
      }

.ad-grid__toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
        min-height: 48px;
        gap: var(--spacing-s, 8px);
      }

      .ad-grid__toolbar-left,
      .ad-grid__toolbar-right {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs, 4px);
      }

      .ad-grid__toolbar-filter {
        position: relative;
        display: inline-flex;
      }

      .ad-grid__formula-bar {
        display: flex;
        align-items: stretch;
        flex-shrink: 0;
        height: 32px;
        border: 1px solid var(--Border-Primary, #cdd4d8);
        border-radius: var(--border-radius-s, 4px);
        background: var(--color-background-primary, #fff);
        font-family: var(--font-family-monospace, ui-monospace, SFMono-Regular, Menlo, monospace);
        font-size: var(--font-size-s, 13px);
        overflow: hidden;
      }

      .ad-grid__formula-bar-addr {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 72px;
        padding: 0 8px;
        border-right: 1px solid var(--Border-Primary, #cdd4d8);
        color: var(--color-text-primary);
        font-weight: 600;
        user-select: text;
      }

      .ad-grid__formula-bar-fx {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        border-right: 1px solid var(--Border-Primary, #cdd4d8);
        color: var(--color-text-secondary);
        font-style: italic;
        font-weight: 500;
      }

      .ad-grid__formula-bar-content {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: stretch;
        overflow: hidden;
      }

      .ad-grid__formula-bar-input {
        flex: 1;
        min-width: 0;
        padding: 0 10px;
        color: var(--color-text-primary);
        font: inherit;
        background: transparent;
        border: none;
        outline: none;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ad-grid__formula-bar-input:focus {
        outline: 2px solid var(--color-border-accent, #1a73e8);
        outline-offset: -2px;
        border-radius: var(--border-radius-xs, 2px);
      }

      .ad-grid__formula-bar-input:disabled {
        color: var(--color-text-secondary);
        cursor: not-allowed;
      }

      .ad-grid__formula-bar-editor {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: stretch;
      }

      .ad-grid__formula-bar-editor .ad-grid-formula-editor,
      .ad-grid__formula-bar-editor .ad-grid-formula-editor__input {
        width: 100%;
        height: 100%;
      }

      .ad-grid__toolbar-filter-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        pointer-events: none;
      }

      .ad-grid__selection-banner {
        display: flex;
        align-items: center;
        gap: var(--spacing-s, 8px);
        flex: 1;
        justify-content: center;
        border-radius: var(--border-radius-s);
        border: 1px solid var(--Border-Primary, #cdd4d8);
        background: var(--Neutral-Grey-000, #fff);
      }

      .ad-grid__selection-text {
        font-size: var(--font-size-s, 14px);
        color: var(--color-text-primary);
        white-space: nowrap;
      }

      .ad-grid__selection-link {
        padding: 0;
        border: none;
        background: transparent;
        color: var(--color-background-accent-inverse);
        font-size: var(--font-size-s, 14px);
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        text-decoration: underline;
      }

      .ad-grid__selection-link:hover {
        color: var(--color-primary-dark, #1557b0);
      }

      .ad-grid__tag-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--spacing-xs, 4px);
        padding: var(--spacing-xxs, 2px) var(--spacing-s, 8px);
        flex-shrink: 0;
      }

      .ad-grid__tag-bar-label {
        width: 100%;
        font-size: var(--font-size-xs, 12px);
        text-transform: uppercase;
        white-space: nowrap;

        color: var(--text-icon-tertiary);
        font-size: var(--Typography-Font-size-Body-XS, 12px);
        font-weight: 400;
      }

      .ad-grid__tag-action-btn {
        padding: 2px 8px;
        border: none;
        background: transparent;
        color: var(--color-background-accent-inverse);
        font-size: var(--font-size-xs, 12px);
        font-weight: 600;
        cursor: pointer;
      }

      .ad-grid__tag-action-btn:hover {
        text-decoration: underline;
      }

      .ad-grid__group-tag-btn {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        font: inherit;
        color: inherit;
        line-height: 1;
      }

      .ad-grid__group-tag-btn ::ng-deep svg {
        fill: #fff !important;
        width: 16px;
        height: 16px;
      }
    `,
  ],
})
export class AdGridAngularComponent<T = unknown> implements OnDestroy {
  protected readonly state = inject<GridStateManager<T>>(GridStateManager);
  private readonly gridEngine = inject<GridEngine<T>>(GridEngine);
  private readonly sortEngine = inject<SortEngine<T>>(SortEngine);
  private readonly inlineEditEngine = inject<InlineEditEngine<T>>(InlineEditEngine);
  private readonly resizeEngine = inject<ColumnResizeEngine<T>>(ColumnResizeEngine);
  protected readonly rowSelectionEngine = inject<RowSelectionEngine<T>>(RowSelectionEngine);
  private readonly cellSelectionEngine = inject<CellSelectionEngine<T>>(CellSelectionEngine);
  private readonly keyboardEngine = inject<KeyboardEngine<T>>(KeyboardEngine);
  private readonly clipboardEngine = inject<ClipboardEngine<T>>(ClipboardEngine);
  private readonly historyEngine = inject<HistoryEngine<T>>(HistoryEngine);
  private readonly groupEngine = inject<GroupEngine<T>>(GroupEngine);
  private readonly filterEngine = inject<FilterEngine<T>>(FilterEngine);
  protected readonly formulaEngine = inject<FormulaEngine<T>>(FormulaEngine);
  private readonly refHighlight = inject(FormulaRefHighlightService);
  private readonly persistenceEngine = inject<StatePersistenceEngine<T>>(StatePersistenceEngine);
  private readonly exportEngine = inject<ExportEngine<T>>(ExportEngine);
  private readonly validationEngine = inject<CellValidationEngine<T>>(CellValidationEngine);
  private readonly verticalVirtualScrollEngine = inject(VerticalVirtualScrollEngine);
  private readonly horizontalVirtualScrollEngine = inject<HorizontalVirtualScrollEngine<T>>(
    HorizontalVirtualScrollEngine
  );
  private readonly paginationEngine = inject<PaginationEngine<T>>(PaginationEngine);
  private readonly infiniteScrollEngine = inject<InfiniteScrollEngine<T>>(InfiniteScrollEngine);
  private readonly treeEngine = inject<TreeEngine<T>>(TreeEngine);
  private readonly autosizeEngine = inject<AutosizeEngine<T>>(AutosizeEngine);
  private readonly serverGroupEngine = inject<ServerGroupEngine<T>>(ServerGroupEngine);

  private readonly gridContainer = viewChild<ElementRef<HTMLElement>>('gridContainer');
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawerService = inject(MozDrawerService);

  // --- Content children ---
  private readonly columnDefs = contentChildren(AdeoGridColumnDef);
  private readonly toolbarDefs = contentChildren(AdeoGridToolbarDef);
  private readonly emptyDefs = contentChildren(AdeoGridEmptyDef);

  // --- Inputs ---
  readonly data = input<T[]>([]);
  readonly mode = input<'client' | 'server'>('client');
  readonly filterMode = input<FilterMode>('client');
  readonly totalItems = input<number>(0);
  readonly pagination = input<boolean>(true);
  readonly pageSize = input<number>(25);
  readonly pageSizeOptions = input<number[]>([10, 25, 50, 100]);
  readonly rowHeight = input<number>(48);
  readonly loading = input<boolean>(false);
  readonly rowSelection = input<boolean>(false);
  readonly expandable = input<boolean>(false);
  readonly rowIdField = input<string>('id');
  /**
   * Enables the spreadsheet-style formula engine. When `true`, any cell
   * committed with a leading `=` in a column declaring `allowFormula: true`
   * is routed to `FormulaEngine` and its evaluated value is rendered.
   */
  readonly formulas = input<boolean>(false);
  readonly detailTemplate = input<TemplateRef<unknown> | null>(null);
  readonly fullscreen = input<boolean>(false);
  readonly reorderable = input<boolean>(false);
  /**
   * Key under which the grid's column/sort/filter view state is persisted in
   * `localStorage`. When set, state is restored automatically on init and
   * saved on every column/sort/filter change.
   *
   * Renamed from `stateKey` (deprecated alias kept below for back-compat).
   */
  readonly persistKey = input<string | null>(null);

  /**
   * @deprecated Use `persistKey` instead.
   * Kept as a pass-through alias so existing templates using `[stateKey]`
   * continue to compile without changes. Will be removed in a future major.
   */
  get stateKey(): typeof this.persistKey {
    return this.persistKey;
  }

  /**
   * Controls whether group expansion/loading is handled client-side (default)
   * or server-side via `ServerGroupEngine`.
   */
  readonly groupMode = input<'client' | 'server'>('client');

  /**
   * Server-side grouping options. When provided, `ServerGroupEngine` is
   * activated and group toggle events are routed to the server engine.
   * Only used when `groupMode === 'server'`.
   */
  readonly serverGroupingOptions = input<ServerGroupingOptions<T> | null>(null);

  // --- Empty state customization ---
  /** Title for the default "no data" empty state. */
  readonly emptyDataTitle = input<string>('');
  /** Description for the default "no data" empty state. */
  readonly emptyDataDescription = input<string>('');
  /** Title for the default "no results" empty state (active filters). */
  readonly noResultsTitle = input<string>('');
  /** Description for the default "no results" empty state. */
  readonly noResultsDescription = input<string>('');
  /** CTA label on the "no results" state. Empty disables the button. */
  readonly noResultsActionLabel = input<string>('Clear filters');
  readonly exportable = input<boolean>(false);
  /**
   * `'client'` (default): the grid builds and downloads the CSV itself.
   * `'server'`: the grid emits `(exportRequest)` instead, leaving the consumer
   * to perform the export (e.g. a back-end download).
   */
  readonly exportMode = input<'client' | 'server'>('client');
  readonly showToolbar = input<boolean>(true);
  /**
   * When `true`, render an inline quick-filter row between the header and
   * the body. Each visible column gets a single text input that writes
   * through to `GridStateManager.quickFilters` via
   * `FilterEngine.setQuickFilter()`. The engine composes those entries
   * with the builder model (AND semantics). Mirrors the Vue grid's
   * inline filter row.
   */
  readonly showQuickFilters = input<boolean>(false);
  readonly multiCellSelection = input<boolean>(true);
  /**
   * When `true`, holding Shift while clicking a sortable header appends to the
   * active sort stack instead of replacing it, and a sort-index badge is
   * surfaced beside each direction arrow. When `false` (default), only a
   * single sort can be active at a time — Shift is ignored.
   *
   * Mirrors the Vue grid's `multiSort` prop.
   */
  readonly multiSort = input<boolean>(false);
  readonly loadingStrategy = input<LoadingStrategy>('pagination');
  readonly scrollThreshold = input<number>(200);
  readonly plugins = input<GridPlugin[]>([]);

  /**
   * Controllable density input. When provided, overrides any density set via
   * the settings drawer. Fires `densityChange` when the user picks a different
   * density inside the drawer.
   */
  readonly density = input<GridDensity>('default');

  /**
   * `refreshing` signals a background data refresh in progress. Unlike
   * `loading` (which shows the full skeleton), `refreshing` keeps the current
   * rows visible and renders the `[adGridRefreshing]` slot content (e.g. a
   * thin progress bar) below the table. The grid itself shows nothing — it is
   * the consumer's responsibility to fill the slot.
   *
   * Distinction from `loading`:
   *   - `loading = true`     → full skeleton rows, no data visible.
   *   - `refreshing = true`  → data stays visible, silent slot for spinner/bar.
   */
  readonly refreshing = input<boolean>(false);

  /**
   * List of cells that are in a "pending" state (optimistic mutation in flight).
   * Each entry is `{ rowId, field }`. A computed lookup set drives the
   * `ad-grid-cell--pending` CSS class on matching cells.
   */
  readonly pendingCells = input<readonly { rowId: unknown; field: string }[]>([]);

  /**
   * List of row IDs whose rows are in a "pending" state. Drives the
   * `ad-grid-row--pending` CSS class on matching rows.
   */
  readonly pendingRowIds = input<readonly (string | number)[]>([]);

  /**
   * Override the number of skeleton rows shown during initial loading.
   * Defaults to `Math.min(pageSize, 20)` when not provided.
   */
  readonly skeletonRowCount = input<number | undefined>();

  // --- Outputs ---
  readonly sortChange = output<SortEvent>();
  readonly pageChange = output<PageEvent>();
  readonly loadMore = output<LoadMoreEvent>();
  readonly cellEdit = output<CellEditEvent<T>>();
  readonly cellEditCancel = output<CellEditCancelEvent>();
  readonly selectionChange = output<RowSelectionEvent<T>>();
  readonly cellSelectionChange = output<CellSelectionEvent<T>>();
  readonly groupChange = output<GroupEvent>();
  readonly filterChange = output<FilterEvent>();
  readonly bulkEdit = output<BulkEditEvent>();
  readonly bulkCopy = output<BulkCopyEvent>();
  readonly bulkPaste = output<BulkPasteEvent>();
  readonly bulkDelete = output<BulkDeleteEvent>();
  readonly fillDown = output<FillDownEvent>();
  readonly settingsChange = output<GridSettingsResult>();
  /** Emitted when the toolbar export is triggered while `exportMode === 'server'`. */
  readonly exportRequest = output<GridExportEvent>();
  /** Emitted when the user changes density via the settings drawer. */
  readonly densityChange = output<GridDensity>();
  /** Emitted whenever the set of hidden column fields changes. */
  readonly hiddenFieldsChange = output<string[]>();

  // --- Internal ---
  protected readonly isFullscreen = signal(false);
  protected readonly groupPanelOpen = signal(false);

  /** Fast lookup set for pending cells: `"rowId::field"` keys. */
  readonly pendingCellLookup = computed(
    () => new Set(this.pendingCells().map((c) => `${c.rowId}::${c.field}`))
  );

  /** Fast lookup set for pending row IDs. */
  readonly pendingRowLookup = computed(() => new Set(this.pendingRowIds()));
  /**
   * Mode controlling how the builder emits `filterChange`:
   *  - `auto`   : each mutation triggers an event (default in `client` mode).
   *  - `manual` : only an explicit Apply emits (default in `server` mode).
   */
  readonly filterApplyMode = input<FilterApplyMode | null>(null);

  protected readonly resolvedFilterApplyMode = computed<FilterApplyMode>(() => {
    const override = this.filterApplyMode();
    if (override) return override;
    return this.state.mode() === 'server' ? 'manual' : 'auto';
  });

  /** Display descriptors for the "FILTERED BY" tag bar. */
  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    return this.filterEngine.conditions().map((c) => ({
      id: c.id,
      field: c.field,
      label: this.filterEngine.toLabel(c),
      removable: true,
    }));
  });

  protected readonly activeFilterCount = computed(() => this.filterEngine.conditions().length);

  /**
   * Kind of empty state to show, or `'none'` when rows are present:
   *  - `'no-data'`    : no rows have been loaded (and the source is empty).
   *  - `'no-results'` : the source has rows but the active filters yield 0.
   *
   * Loading and infinite-scroll loading-more states are *not* treated as
   * empty (we let the loading indicator drive the UX instead).
   */
  protected readonly emptyStateKind = computed<GridEmptyKind | 'none'>(() => {
    if (this.gridEngine.displayRows().length > 0) return 'none';
    if (this.state.isLoading()) return 'none';

    const hasFilters = this.filterEngine.conditions().length > 0;
    const sourceCount =
      this.state.mode() === 'server' ? this.state.totalItems() : this.state.sourceData().length;

    // In server mode `totalItems` may not reflect filters, so trust active
    // filters as the discriminator. Same heuristic in client mode.
    if (hasFilters) return 'no-results';
    if (sourceCount === 0) return 'no-data';
    // Source has rows, no filters, but display is empty (e.g. group with no
    // matching rows after pagination). Fall back to `no-results` which
    // offers the "Clear filters" CTA — harmless when no filters are active
    // because we hide the button when the count is zero.
    return 'no-results';
  });

  /** Resolves the projected `<ng-template adGridEmptyDef>` for the kind. */
  protected readonly emptyTemplate = computed(() => {
    const kind = this.emptyStateKind();
    if (kind === 'none') return null;
    const defs = this.emptyDefs();
    const exact = defs.find((d) => d.kind() === kind);
    if (exact) return exact.template;
    // Fallback to a `no-data` template for the `no-results` kind.
    return defs.find((d) => d.kind() === 'no-data')?.template ?? null;
  });

  /** Context object exposed to projected empty-state templates. */
  protected readonly emptyContext = computed<GridEmptyContext>(() => ({
    activeFilterCount: this.filterEngine.conditions().length,
    clearFilters: () => this.filterEngine.clearAll(),
  }));

  /**
   * Wrap the empty context for `ngTemplateOutlet` so consumers can use
   * either `let-ctx` (positional, via `$implicit`) or named bindings
   * (`let-clearFilters="clearFilters"`) without having to choose at
   * declaration time.
   */
  protected readonly emptyTemplateContext = computed(() => {
    const ctx = this.emptyContext();
    return { $implicit: ctx, ...ctx };
  });

  /** CTA label for the default no-results state — hidden when no filters. */
  protected readonly resolvedNoResultsActionLabel = computed(() => {
    if (this.filterEngine.conditions().length === 0) return '';
    return this.noResultsActionLabel();
  });

  protected readonly hasHiddenColumns = computed(() =>
    this.state.columnStates().some((col) => !col.visible)
  );
  protected readonly hiddenColumnsList = computed(() => {
    const defMap = this.state.columnDefMap();
    return this.state
      .columnStates()
      .filter((col) => !col.visible)
      .map((col) => ({ field: col.field, label: defMap.get(col.field)?.headerName ?? col.field }));
  });
  protected readonly toolbarStartDefs = computed(() =>
    this.toolbarDefs().filter((d) => d.slot() === 'start')
  );
  protected readonly toolbarEndDefs = computed(() =>
    this.toolbarDefs().filter((d) => d.slot() === 'end')
  );
  protected readonly selectionBannerVisible = computed(() => {
    return this.rowSelectionEngine.count() > 0;
  });
  protected readonly selectionTotalCount = computed(
    () => this.state.totalItems() || this.state.sourceData().length
  );
  protected readonly showPagination = computed(
    () => this.pagination() && this.state.loadingStrategy() === 'pagination'
  );
  protected readonly showInfiniteScrollLoader = computed(
    () => this.state.loadingStrategy() === 'infinite-scroll' && this.state.isLoading()
  );

  /** Focused cell coord picked up by the formula bar — falls back to the
   *  selected cell so the bar stays populated after focus is lost (e.g.
   *  the user clicked outside to dismiss an overlay). */
  private readonly formulaBarCoord = computed(() => {
    return this.state.focusedCell() ?? this.state.selectedCell();
  });

  /** Snapshot coord captured at edit entry — kept as a signal so the
   *  bar's address reads from it reactively and stays pinned to the
   *  original cell even when the user clicks elsewhere to pick refs. */
  private readonly formulaBarActiveCoord = signal<{ row: number; col: number } | null>(null);

  /** A1 address (`A5`, `$A$5`) of the formula-bar target cell. While the
   *  bar is editing the address stays pinned to the snapshot so ref
   *  picking doesn't visually jump the label around. */
  protected readonly formulaBarAddress = computed(() => {
    const coord = this.formulaBarActiveCoord() ?? this.formulaBarCoord();
    if (!coord) return '';
    const cols = this.state.visibleColumns();
    if (!cols[coord.col]) return '';
    return `${columnIndexToLetters(coord.col)}${coord.row + 1}`;
  });

  /** Formula source if the target cell holds one, otherwise the displayed
   *  value as a string. Mirrors Excel's formula-bar behaviour. */
  protected readonly formulaBarContent = computed(() => {
    const coord = this.formulaBarCoord();
    if (!coord) return '';
    const cols = this.state.visibleColumns();
    const field = cols[coord.col]?.field;
    if (!field) return '';
    const sourceIdx = this.displayIndexToSourceIndex(coord.row);
    if (sourceIdx < 0) return '';
    const row = this.state.sourceData()[sourceIdx] as Record<string, unknown> | undefined;
    if (!row) return '';
    const rowId = row[this.state.rowIdField()] as string | number | undefined;
    if (rowId !== undefined && rowId !== null) {
      const formula = this.formulaEngine.displayFormula({ rowId, field });
      if (formula) return formula;
    }
    const raw = row[field];
    if (raw === undefined || raw === null) return '';
    return typeof raw === 'string' ? raw : String(raw);
  });

  /** `true` while the user is editing in the formula bar (mounts the
   *  full-featured formula editor with ref highlights + autocomplete). */
  protected readonly formulaBarEditing = signal(false);

  /** Live draft while the formula-bar input is focused. `null` means
   *  "not editing" and the input mirrors `formulaBarContent()`. */
  protected readonly formulaBarDraft = signal<string | null>(null);

  /** Snapshot of the cell targeted when the formula bar gained focus.
   *  Needed because blur fires *after* the click that moved the
   *  selection elsewhere — without this we'd commit into the new cell. */
  private formulaBarEditSnapshot: {
    coord: { row: number; col: number };
    initial: string;
  } | null = null;

  /** Value shown in the bar input — draft while editing, committed value otherwise. */
  protected readonly formulaBarDisplay = computed(() => {
    const draft = this.formulaBarDraft();
    return draft !== null ? draft : this.formulaBarContent();
  });

  /** Address of the cell the formula bar is editing (for `@row`
   *  highlighting inside the embedded editor). Reads from the snapshot
   *  so it stays stable while the user clicks other cells to pick refs. */
  protected readonly formulaBarEditingAddr = computed<CellAddress | null>(() => {
    const coord = this.formulaBarActiveCoord() ?? this.formulaBarCoord();
    if (!coord) return null;
    const field = this.state.visibleColumns()[coord.col]?.field;
    if (!field) return null;
    const sourceIdx = this.displayIndexToSourceIndex(coord.row);
    if (sourceIdx < 0) return null;
    const row = this.state.sourceData()[sourceIdx] as Record<string, unknown> | undefined;
    const rowId = row?.[this.state.rowIdField()] as string | number | undefined;
    if (rowId === undefined || rowId === null) return null;
    return { rowId, field };
  });

  /** `true` when the target cell sits in an editable column. */
  protected readonly formulaBarEditable = computed(() => {
    const coord = this.formulaBarCoord();
    if (!coord) return false;
    const field = this.state.visibleColumns()[coord.col]?.field;
    if (!field) return false;
    return this.state.columnDefMap().get(field)?.editable === true;
  });

  private columnsInitialized = false;
  private stateRestored = false;
  private documentMouseUpHandler: (() => void) | null = null;
  /** Disposer functions returned by plugin `init()` calls. */
  private pluginDisposers: Array<() => void> = [];

  constructor() {
    this.keyboardEngine.registerActions({
      copy: () => this.onBulkCopy(),
      paste: () => {
        void this.onBulkPaste();
      },
      cut: () => this.onCutShortcut(),
      deleteRange: () => this.onBulkDelete(),
      undo: () => this.onUndo(),
      redo: () => this.onRedo(),
      fillDown: () => this.onFillDownShortcut(),
      fillRight: () => this.onFillRightShortcut(),
      startEdit: (row, col, char) => this.onStartEditShortcut(row, col, char),
    });

    // Bind history persistence to the grid's stateKey (same key we use for
    // column/sort persistence — one localStorage namespace per grid).
    effect(() => {
      this.historyEngine.attach(this.persistKey());
    });

    // Global mouseup listener for fill handle — if the user drags the fill
    // handle outside the grid and releases, we still need to end the fill.
    afterNextRender(() => {
      this.documentMouseUpHandler = (): void => {
        if (this.state.isFilling()) {
          this.ngZone.run(() => this.onMouseUp());
        }
      };
      document.addEventListener('mouseup', this.documentMouseUpHandler);
      this.destroyRef.onDestroy(() => {
        if (this.documentMouseUpHandler) {
          document.removeEventListener('mouseup', this.documentMouseUpHandler);
        }
      });
    });

    // Single scroll container: the `.ad-grid` element is now the unique
    // overflow:auto host. Header sits inside it as `position: sticky; top: 0`,
    // and pinned column cells are `position: sticky; left/right: …px` —
    // both rely on this element being their containing block. No transforms
    // anywhere on the subtree (CDK virtual scroll has been replaced by
    // `VerticalVirtualScrollEngine` + a height-based top spacer).
    afterNextRender(() => {
      const grid = this.gridContainer();
      if (!grid) return;
      const scrollEl = grid.nativeElement as HTMLElement;

      const pushScroll = (): void => {
        this.horizontalVirtualScrollEngine.onScroll(scrollEl.scrollLeft, scrollEl.clientWidth);
        this.verticalVirtualScrollEngine.onScroll(scrollEl.scrollTop, scrollEl.clientHeight);
      };

      // Prime the engines with the initial size *after* the current render
      // cycle settles — calling tick() / writing signals here would re-enter
      // the change-detection cycle that just placed us in afterNextRender.
      queueMicrotask(pushScroll);

      let rafPending = false;
      scrollEl.addEventListener(
        'scroll',
        () => {
          if (rafPending) return;
          rafPending = true;
          requestAnimationFrame(() => {
            pushScroll();
            rafPending = false;
          });
        },
        { passive: true },
      );

      const ro = new ResizeObserver(() => pushScroll());
      ro.observe(scrollEl);

      this.infiniteScrollEngine.attach(scrollEl, (event) => {
        this.loadMore.emit(event);
      });
    });

    // Auto-size all columns once after the first non-empty data render.
    let autosizeDone = false;
    effect(() => {
      if (autosizeDone) return;
      const data = this.state.sourceData();
      if (data.length === 0) return;
      autosizeDone = true;
      // Defer to next frame so the DOM is fully rendered before measuring.
      requestAnimationFrame(() => {
        const grid = this.gridContainer();
        this.autosizeEngine.autosizeAllColumns(grid?.nativeElement ?? null);
      });
    });

    // Sync column definitions from content children (run only once).
    // Defer the read to a microtask so required signal inputs on dynamically
    // created column defs (e.g. generated via @for) are flushed before we
    // call toColumnDef() — otherwise field() throws NG0950.
    effect(
      () => {
        const defs = this.columnDefs();
        if (defs.length === 0 || this.columnsInitialized) return;
        this.columnsInitialized = true;
        queueMicrotask(() => {
          this.state.initColumns(defs.map((d) => d.toColumnDef()));
        });
      },
      { allowSignalWrites: true }
    );

    // Sync data input → state
    effect(
      () => {
        this.state.sourceData.set(this.data());
      },
      { allowSignalWrites: true }
    );

    // Revalidate all cells when data changes
    effect(
      () => {
        const data = this.state.sourceData();
        this.validationEngine.validateAll(data);
      },
      { allowSignalWrites: true }
    );

    // Sync mode input → state
    effect(
      () => {
        this.state.mode.set(this.mode());
      },
      { allowSignalWrites: true }
    );

    // Sync filterMode input → state
    effect(
      () => {
        this.state.filterMode.set(this.filterMode());
      },
      { allowSignalWrites: true }
    );

    // Horizontal virtual scroll is always enabled — no input gate. The
    // engine becomes a no-op when the rendered column count fits the
    // viewport, so always-on costs nothing on small datasets.
    this.state.horizontalVirtualScrollEnabled.set(true);

    // Sync totalItems input → state (server mode)
    effect(
      () => {
        this.state.totalItems.set(this.totalItems());
      },
      { allowSignalWrites: true }
    );

    // Sync pageSize input → state
    effect(
      () => {
        this.state.pageSize.set(this.pageSize());
      },
      { allowSignalWrites: true }
    );

    // Sync visibleRowCount from paginated data + clear focus on page change (#5 + #6)
    effect(
      () => {
        const count = this.gridEngine.paginatedData().length;
        this.state.visibleRowCount.set(count);
      },
      { allowSignalWrites: true }
    );
    let prevPageIndex = this.state.pageIndex();
    effect(
      () => {
        const current = this.state.pageIndex();
        if (current === prevPageIndex) return;
        prevPageIndex = current;
        this.cellSelectionEngine.clearFocus();
        // Reset scroll to top so the next cell click doesn't cause a jump
        queueMicrotask(() => {
          const grid = this.gridContainer();
          if (grid) grid.nativeElement.scrollTop = 0;
        });
      },
      { allowSignalWrites: true }
    );

    // Sync rowHeight input → state
    effect(
      () => {
        this.state.rowHeight.set(this.rowHeight());
      },
      { allowSignalWrites: true }
    );

    // Sync loading input → state
    effect(
      () => {
        this.state.isLoading.set(this.loading());
      },
      { allowSignalWrites: true }
    );

    // Sync loadingStrategy input → state
    effect(
      () => {
        this.state.loadingStrategy.set(this.loadingStrategy());
      },
      { allowSignalWrites: true }
    );

    // Sync pagination input → state — drives the slice in `paginatedData`.
    effect(
      () => {
        this.state.paginationEnabled.set(this.pagination());
      },
      { allowSignalWrites: true }
    );

    // Sync multiCellSelection input → state
    effect(
      () => {
        this.state.multiCellSelectionEnabled.set(this.multiCellSelection());
      },
      { allowSignalWrites: true }
    );

    // Sync scrollThreshold input → infinite scroll engine
    effect(() => {
      this.infiniteScrollEngine.scrollThreshold.set(this.scrollThreshold());
    });

    // Sync rowIdField input → state
    effect(
      () => {
        this.state.rowIdField.set(this.rowIdField());
      },
      { allowSignalWrites: true }
    );

    // Sync pendingCells input → state lookup set
    effect(
      () => {
        this.state.pendingCellLookup.set(
          new Set(this.pendingCells().map((c) => `${c.rowId}::${c.field}`))
        );
      },
      { allowSignalWrites: true }
    );

    // Sync pendingRowIds input → state lookup set
    effect(
      () => {
        this.state.pendingRowLookup.set(new Set(this.pendingRowIds()));
      },
      { allowSignalWrites: true }
    );

    // Sync density input → state (bidirectional: input wins when provided,
    // state.density can also be mutated by the settings drawer).
    effect(
      () => {
        this.state.density.set(this.density());
        this.state.rowHeight.set(AdGridAngularComponent.DENSITY_ROW_HEIGHT[this.density()]);
      },
      { allowSignalWrites: true }
    );

    // Emit densityChange whenever state.density changes (driven by settings drawer or input).
    let prevDensity = this.state.density();
    effect(() => {
      const d = this.state.density();
      if (d !== prevDensity) {
        prevDensity = d;
        this.densityChange.emit(d);
      }
    });

    // Emit hiddenFieldsChange whenever the set of hidden columns changes.
    let prevHidden: string[] = [];
    effect(() => {
      const hidden = this.state
        .columnStates()
        .filter((c) => !c.visible)
        .map((c) => c.field);
      const changed =
        hidden.length !== prevHidden.length || hidden.some((f, i) => f !== prevHidden[i]);
      if (changed) {
        prevHidden = hidden;
        this.hiddenFieldsChange.emit(hidden);
      }
    });

    // Auto-register formula cells from the initial / updated dataset.
    // Without this effect, only formulas committed via the inline editor
    // would be tracked — formulas baked into `[data]` would render as raw
    // strings (e.g. `=REF(COLUMN("price"),ROW(1))`) instead of their evaluated value.
    effect(
      () => {
        if (!this.formulas()) return;
        // Track these signals so the engine reconciles on every change.
        this.state.sourceData();
        const defs = this.state.columnDefMap();
        this.formulaEngine.syncFromSource((field) => defs.get(field)?.allowFormula === true);
      },
      { allowSignalWrites: true }
    );

    // Restore persisted state after columns are initialized (once only)
    effect(
      () => {
        const key = this.persistKey();
        const cols = this.state.columnStates();
        if (key && cols.length > 0 && !this.stateRestored) {
          this.stateRestored = true;
          this.persistenceEngine.restore(key);
        }
      },
      { allowSignalWrites: true }
    );

    // Auto-save state on column/sort/filter changes
    effect(() => {
      const key = this.persistKey();
      if (!key) return;
      // Read signals to track them
      this.state.columnStates();
      this.state.activeSorts();
      this.state.filterModel();
      this.persistenceEngine.save(key);
    });

    // Emit `filterChange` once per mutation. The engine's `lastEvent` signal
    // is set synchronously from every mutation path, guaranteeing we emit
    // exactly once per reason (add / update / remove / reorder / clear / replace).
    effect(() => {
      const event = this.filterEngine.lastEvent();
      if (!event) return;
      this.filterChange.emit(event);
      this.resetInfiniteScrollIfActive();
    });

    // Initialize plugins — each plugin receives { state, engine } and may return
    // a disposer closure. Disposers are collected and called on ngOnDestroy.
    effect(() => {
      const pluginList = this.plugins();
      // Clean up previous disposers before re-running (e.g. input changed)
      for (const dispose of this.pluginDisposers) {
        dispose();
      }
      this.pluginDisposers = [];
      for (const plugin of pluginList) {
        const disposer = plugin.init({
          state: this.state as unknown as GridStateManager<unknown>,
          engine: this.gridEngine as unknown as GridEngine<unknown>,
        });
        if (typeof disposer === 'function') {
          this.pluginDisposers.push(disposer);
        }
      }
    });

    // Sync groupMode input → state
    effect(
      () => {
        this.state.groupMode.set(this.groupMode());
      },
      { allowSignalWrites: true }
    );

    // Configure ServerGroupEngine when serverGroupingOptions input changes
    effect(() => {
      this.serverGroupEngine.configure(this.serverGroupingOptions());
    });

    // Scroll focused cell into view on keyboard navigation only
    effect(() => {
      const cell = this.state.focusedCell();
      if (!cell) return;
      if (this.state.focusSource() !== 'keyboard') return;

      const grid = this.gridContainer();
      if (!grid) return;
      const scrollEl = grid.nativeElement;

      // Vertical: when the row is in the DOM, hand off to the browser's
      // native `scrollIntoView({ block: 'nearest' })` — it accounts for
      // sticky-header occlusion AND for any outline/border that extends
      // past the cell box. When the row is outside the rendered window
      // (virtualization), we fall back to manual math so we land in the
      // right neighbourhood; the engine then refines the range and the
      // next focus update lets `scrollIntoView` polish the position.
      const rowEl = scrollEl.querySelector(`[data-row-index="${cell.row}"]`) as
        | HTMLElement
        | null;
      if (rowEl) {
        rowEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      } else {
        const viewportSize = scrollEl.clientHeight;
        const scrollOffset = scrollEl.scrollTop;
        const headerEl = scrollEl.querySelector('ad-grid-header') as HTMLElement | null;
        const stickyTopHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;

        const pageOffset = this.state.pageIndex() * this.state.pageSize();
        const localRow = cell.row - pageOffset;
        const rowTop = this.verticalVirtualScrollEngine.scrollOffsetForIndex(localRow);
        const rowBottom = rowTop + this.verticalVirtualScrollEngine.getRowHeight(localRow);

        if (rowTop < scrollOffset + stickyTopHeight) {
          scrollEl.scrollTop = rowTop - stickyTopHeight;
        } else if (rowBottom > scrollOffset + viewportSize) {
          scrollEl.scrollTop = rowBottom - viewportSize;
        }
      }

      // Horizontal: find the cell's horizontal offset and scroll if needed.
      // With sticky-inline pinned cells, the row itself is `min-width:
      // utilityLeftWidth + totalContentWidth`. Unpinned column `i` lives at
      // absolute X = utilityLeftWidth + pinnedLeftWidth + Σ(prev unpinned).
      // Visible window inside the row (after sticky reservation) is
      // [scrollLeft + leftReserve, scrollLeft + clientWidth − pinnedRightWidth].
      const cols = this.state.visibleColumns();
      if (cell.col >= 0 && cell.col < cols.length) {
        const pinnedLeftCount = this.state.pinnedLeftColumns().length;
        const utilityLeftWidth =
          (this.expandable() ? 36 : 0) + (this.rowSelection() ? 48 : 0);
        const leftReserve = utilityLeftWidth + this.state.pinnedLeftWidth();
        const rightReserve = this.state.pinnedRightWidth();

        const unpinned = this.state.unpinnedColumns();
        const unpinnedIdx = cell.col - pinnedLeftCount;

        if (unpinnedIdx >= 0 && unpinnedIdx < unpinned.length) {
          let colAbsolute = leftReserve;
          for (let i = 0; i < unpinnedIdx; i++) {
            colAbsolute += unpinned[i].currentWidth;
          }
          const colRight = colAbsolute + unpinned[unpinnedIdx].currentWidth;

          const visibleLeft = scrollEl.scrollLeft + leftReserve;
          const visibleRight = scrollEl.scrollLeft + scrollEl.clientWidth - rightReserve;

          if (colAbsolute < visibleLeft) {
            scrollEl.scrollLeft = colAbsolute - leftReserve;
          } else if (colRight > visibleRight) {
            scrollEl.scrollLeft = colRight - (scrollEl.clientWidth - rightReserve);
          }
        }
      }
    });
  }

  // --- Event handlers ---

  onSortClick(event: { field: string; isMultiSort: boolean }): void {
    // Gate the Shift-modifier through `multiSort`: when the prop is off,
    // a single sort is always active and Shift is ignored — matching Vue.
    const allowMulti = this.multiSort();
    this.sortEngine.toggleSort(event.field, allowMulti && event.isMultiSort);
    this.sortChange.emit({ sorts: this.state.activeSorts() });
    this.resetInfiniteScrollIfActive();
  }

  onMenuAction(event: { field: string; actionId: HeaderMenuActionId }): void {
    switch (event.actionId) {
      case 'sort-asc':
        this.sortEngine.setSort(event.field, 'asc');
        this.sortChange.emit({ sorts: this.state.activeSorts() });
        break;
      case 'sort-desc':
        this.sortEngine.setSort(event.field, 'desc');
        this.sortChange.emit({ sorts: this.state.activeSorts() });
        break;
      case 'group-column':
        this.groupEngine.addGroup(event.field);
        this.groupChange.emit({
          columns: this.state.groupColumns().map((g) => g.field),
          groups: [...this.state.groupColumns()],
        });
        break;
      case 'filter-column':
        // Filter is handled via the per-column search input toggle
        this.state.updateColumnState(event.field, { searchVisible: true });
        break;
      case 'hide-column':
        this.state.updateColumnState(event.field, { visible: false });
        break;
      case 'toggle-column-search': {
        const col = this.state.columnStates().find((c) => c.field === event.field);
        if (col) {
          this.state.updateColumnState(event.field, { searchVisible: !col.searchVisible });
        }
        break;
      }
      case 'freeze-column-left':
        this.freezeLeft(event.field);
        break;
      case 'freeze-column-right':
        this.freezeRight(event.field);
        break;
      case 'unfreeze-column':
        this.state.updateColumnState(event.field, { pinned: null });
        break;
      case 'autosize-this': {
        const wrapper = this.gridContainer()?.nativeElement ?? null;
        this.autosizeEngine.autosizeColumn(event.field, wrapper);
        break;
      }
      case 'autosize-all': {
        const wrapper = this.gridContainer()?.nativeElement ?? null;
        this.autosizeEngine.autosizeAllColumns(wrapper);
        break;
      }
    }
  }

  onCellEdit(event: CellEditEvent<unknown>): void {
    this.cellEdit.emit(event as CellEditEvent<T>);
  }

  onSelectAllToggle(): void {
    this.rowSelectionEngine.toggleSelectAllPage();
    this.activateRowSelectionMode();
    this.selectionChange.emit(this.rowSelectionEngine.getSelectionEvent());
  }

  onRowSelectionToggle(): void {
    this.activateRowSelectionMode();
    this.selectionChange.emit(this.rowSelectionEngine.getSelectionEvent());
  }

  private activateRowSelectionMode(): void {
    if (this.rowSelectionEngine.count() > 0) {
      this.state.activeSelectionMode.set('rows');
      this.cellSelectionEngine.clearFocus();
    } else {
      this.state.activeSelectionMode.set('none');
    }
  }

  onKeydown(event: KeyboardEvent): void {
    const editState = this.state.cellEditState();
    const isEditing = editState.editingCell !== null;

    // In edit mode, intercept Tab/Enter/Escape even from input/select elements
    if (isEditing) {
      this.handleEditModeKeydown(event);
      return;
    }

    // Don't intercept keystrokes inside interactive elements (filter slots, etc.)
    const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      return;
    }

    // Row-selection mode forwards a small set of shortcuts without touching
    // cell focus. Cell-mode (and anywhere else) goes through the keyboard engine.
    const selMode = this.state.activeSelectionMode();
    if (selMode === 'rows') {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        this.onBulkCopy();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        void this.onBulkPaste();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        this.onBulkDelete();
        return;
      }
    }

    this.keyboardEngine.handleKeydown(event);
  }

  private handleEditModeKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      const cancelEvt = this.inlineEditEngine.cancelEdit();
      if (cancelEvt) {
        this.cellEditCancel.emit(cancelEvt);
      }
      return;
    }

    if (event.key === 'Enter') {
      // Alt+Enter: insert a newline in the draft for text editors (Excel-style).
      if (event.altKey) {
        const editState = this.state.cellEditState();
        const def = this.state
          .columnDefMap()
          .get(this.state.visibleColumns()[editState.editingCell?.col ?? -1]?.field ?? '');
        const editorType = def?.cellEditor ?? 'text';
        if (editorType === 'text') {
          event.preventDefault();
          const draft = editState.draftValue;
          const next = (typeof draft === 'string' ? draft : String(draft ?? '')) + '\n';
          this.inlineEditEngine.updateDraft(next);
        }
        return;
      }

      // Ctrl+Enter: commit current draft and broadcast it to the active range.
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const editState = this.state.cellEditState();
        const value = editState.draftValue;
        const cancel = this.inlineEditEngine.cancelEdit();
        if (cancel) this.cellEditCancel.emit(cancel);
        const range = this.cellSelectionEngine.getNormalizedRange();
        if (range) {
          const changes = this.clipboardEngine.fillSelection(range, value);
          this.historyEngine.record('fill-selection', changes);
        }
        this.refocusGrid();
        return;
      }

      event.preventDefault();
      this.commitFromEditMode();
      if (event.shiftKey) this.cellSelectionEngine.moveUp();
      else this.cellSelectionEngine.moveDown();
      this.refocusGrid();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      this.commitFromEditMode();
      if (event.shiftKey) this.cellSelectionEngine.moveLeft();
      else this.cellSelectionEngine.moveRight();
      this.refocusGrid();
    }
  }

  private commitFromEditMode(): void {
    const evt = this.inlineEditEngine.commitEdit();
    if (!evt) return;
    this.cellEdit.emit(evt as CellEditEvent<T>);
    this.clipboardEngine.clearCut();
  }

  private onCutShortcut(): void {
    const range = this.cellSelectionEngine.getNormalizedRange();
    if (!range) return;
    const values = this.clipboardEngine.extractTsv(range);
    const tsv = values.map((row) => row.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv);
    this.clipboardEngine.markCut(range);
    this.bulkCopy.emit({
      range,
      data: values,
      rowIds: this.getRangeRowIds(range),
      fields: this.getRangeFields(range),
    });
  }

  private onUndo(): void {
    this.historyEngine.undo();
    this.clipboardEngine.clearCut();
  }

  private onRedo(): void {
    this.historyEngine.redo();
    this.clipboardEngine.clearCut();
  }

  private onFillDownShortcut(): void {
    const range = this.cellSelectionEngine.getNormalizedRange();
    if (!range) return;
    const changes = this.clipboardEngine.fillDown(range);
    if (changes.length === 0) return;
    this.historyEngine.record('fill-down', changes);
    this.clipboardEngine.clearCut();
  }

  private onFillRightShortcut(): void {
    const range = this.cellSelectionEngine.getNormalizedRange();
    if (!range) return;
    const changes = this.clipboardEngine.fillRight(range);
    if (changes.length === 0) return;
    this.historyEngine.record('fill-right', changes);
    this.clipboardEngine.clearCut();
  }

  private onStartEditShortcut(row: number, col: number, initialChar?: string): void {
    const colDef = this.state.visibleColumns()[col];
    if (!colDef) return;
    const def = this.state.columnDefMap().get(colDef.field);
    if (!def?.editable) return;
    if (initialChar !== undefined) {
      this.inlineEditEngine.startEditWithChar(row, colDef.field, initialChar);
    } else {
      this.inlineEditEngine.startEdit(row, colDef.field);
    }
  }

  private resetInfiniteScrollIfActive(): void {
    if (this.state.loadingStrategy() !== 'infinite-scroll') return;
    if (this.state.mode() !== 'server') return;
    this.infiniteScrollEngine.reset((event) => {
      this.loadMore.emit(event);
    });
  }

  private refocusGrid(): void {
    // Use setTimeout to ensure focus happens after CDK overlay cleanup
    // (e.g. combobox/datepicker close restoring focus asynchronously)
    setTimeout(() => {
      const container = this.gridContainer();
      if (container) {
        container.nativeElement.focus();
      }
    });
  }

  onMouseUp(): void {
    // Formula pick-range drag wins over the normal cell-range drag: when a
    // formula editor is active, any mouseup ends the pick and the cell
    // selection should stay untouched.
    if (this.refHighlight.isPickDragging()) {
      this.refHighlight.pickRangeCommit();
      return;
    }
    // Fill takes priority over range selection
    if (this.state.isFilling()) {
      const result = this.cellSelectionEngine.endFill();
      if (result) {
        this.applyFill(result.anchor, result.target);
      }
      return;
    }
    this.cellSelectionEngine.endRangeSelection();
  }

  /**
   * Shifts a formula's relative refs by the given (row, col) delta when the
   * value is a formula string dropped on a new cell during a fill. Non-formula
   * values are returned as-is so downstream code can still see the raw value.
   */
  private shiftFormulaForFill(
    value: unknown,
    allowFormula: boolean,
    rowDelta: number,
    colDelta: number
  ): unknown {
    if (!allowFormula) return value;
    if (typeof value !== 'string') return value;
    if (!value.trimStart().startsWith('=')) return value;
    if (rowDelta === 0 && colDelta === 0) return value;
    const fieldOrder = this.state.visibleColumns().map((c) => c.field);
    return shiftFormulaRefs(value, { rowDelta, colDelta, fieldOrder });
  }

  /**
   * Maps a display row index (from displayRow.index) to the actual index in
   * sourceData(). When grouping or sorting is active the display index doesn't
   * match sourceData order, so we resolve via object identity.
   */
  private displayIndexToSourceIndex(displayIndex: number): number {
    const displayRows = this.gridEngine.displayRows();
    const match = displayRows.find((r) => r.type === 'data' && r.index === displayIndex);
    if (!match || match.type !== 'data') return -1;
    return this.state.sourceData().indexOf(match.data);
  }

  /**
   * Applies a fill-handle drop. The source is the live selection range when
   * the handle was dragged from its bottom-right corner (multi-row /
   * multi-column block, Sheets-style), or the single anchor cell otherwise.
   * Vertical drags repeat the source rows below/above the block; horizontal
   * drags repeat the source columns to the right/left.
   */
  private applyFill(
    anchor: { row: number; col: number },
    target: { row: number; col: number }
  ): void {
    const src = this.cellSelectionEngine.getFillSourceRangeFor(anchor);
    const vertical = target.col === anchor.col;
    if (vertical) {
      this.applyVerticalFill(src, target, anchor);
    } else {
      this.applyHorizontalFill(src, target, anchor);
    }
  }

  /** Reads a cell value (through `valueGetter` when defined) at display coords. */
  private readCellValueAt(displayRow: number, col: number): unknown {
    const field = this.state.visibleColumns()[col]?.field;
    if (!field) return undefined;
    const idx = this.displayIndexToSourceIndex(displayRow);
    if (idx < 0) return undefined;
    const row = this.state.sourceData()[idx];
    if (!row) return undefined;
    const def = this.state.columnDefMap().get(field);
    return def?.valueGetter ? def.valueGetter(row) : (row as Record<string, unknown>)[field];
  }

  private applyVerticalFill(
    src: CellRange,
    target: { row: number; col: number },
    anchor: { row: number; col: number }
  ): void {
    const cols = this.state.visibleColumns();
    const defMap = this.state.columnDefMap();

    const down = target.row > src.end.row;
    // Released inside the source rows — nothing to fill.
    if (!down && target.row >= src.start.row) return;
    const firstTargetRow = down ? src.end.row + 1 : target.row;
    const lastTargetRow = down ? target.row : src.start.row - 1;
    const srcRowCount = src.end.row - src.start.row + 1;

    // Editable source columns — each keeps its values in its own column.
    const fields: { col: number; field: string; allowFormula: boolean }[] = [];
    for (let c = src.start.col; c <= src.end.col; c++) {
      const field = cols[c]?.field;
      if (!field) continue;
      const def = defMap.get(field);
      if (!def?.editable) continue;
      fields.push({ col: c, field, allowFormula: def.allowFormula === true });
    }
    if (fields.length === 0) return;

    const sourceValue = this.readCellValueAt(anchor.row, anchor.col);

    // Display index → sourceData index, for source and target rows.
    const srcIdxByDisplay = new Map<number, number>();
    for (let r = src.start.row; r <= src.end.row; r++) {
      const idx = this.displayIndexToSourceIndex(r);
      if (idx >= 0) srcIdxByDisplay.set(r, idx);
    }
    const targetIdxByDisplay = new Map<number, number>();
    for (let r = firstTargetRow; r <= lastTargetRow; r++) {
      const idx = this.displayIndexToSourceIndex(r);
      if (idx >= 0) targetIdxByDisplay.set(r, idx);
    }
    if (targetIdxByDisplay.size === 0) return;

    const changes: { rowIndex: number; field: string; before: unknown; after: unknown }[] = [];
    this.state.sourceData.update((d) => {
      const updated = [...d];
      for (const [displayIdx, tgtIdx] of targetIdxByDisplay) {
        // The source pattern repeats over the target rows (Sheets-style):
        // dragging a 2-row block over 6 rows writes A B A B A B.
        const offset = down
          ? (displayIdx - firstTargetRow) % srcRowCount
          : (lastTargetRow - displayIdx) % srcRowCount;
        const srcDisplayRow = down ? src.start.row + offset : src.end.row - offset;
        const srcIdx = srcIdxByDisplay.get(srcDisplayRow);
        if (srcIdx === undefined) continue;
        const sourceRow = updated[srcIdx];
        const targetRow = updated[tgtIdx];
        if (!sourceRow || !targetRow) continue;

        const rowCopy = { ...targetRow } as Record<string, unknown>;
        let mutated = false;
        for (const f of fields) {
          const def = defMap.get(f.field);
          const raw = def?.valueGetter
            ? def.valueGetter(sourceRow)
            : (sourceRow as Record<string, unknown>)[f.field];
          const after = this.shiftFormulaForFill(
            raw,
            f.allowFormula,
            displayIdx - srcDisplayRow,
            0
          );
          const before = rowCopy[f.field];
          if (before === after) continue;
          rowCopy[f.field] = after;
          mutated = true;
          changes.push({ rowIndex: tgtIdx, field: f.field, before, after });
        }
        if (mutated) updated[tgtIdx] = rowCopy as T;
      }
      return updated;
    });
    if (changes.length > 0) {
      this.historyEngine.record('fill', changes);
    }
    this.clipboardEngine.clearCut();

    this.fillDown.emit({
      sourceCell: anchor,
      sourceValue,
      direction: 'vertical',
      affectedCellCount: changes.length,
      field: fields.length === 1 ? fields[0].field : undefined,
      targetFields: fields.map((f) => f.field),
      targetRange: { startRow: firstTargetRow, endRow: lastTargetRow },
      affectedRowCount: targetIdxByDisplay.size,
    });
  }

  private applyHorizontalFill(
    src: CellRange,
    target: { row: number; col: number },
    anchor: { row: number; col: number }
  ): void {
    const cols = this.state.visibleColumns();
    const defMap = this.state.columnDefMap();

    const right = target.col > src.end.col;
    // Released inside the source columns — nothing to fill.
    if (!right && target.col >= src.start.col) return;
    const firstTargetCol = right ? src.end.col + 1 : target.col;
    const lastTargetCol = right ? target.col : src.start.col - 1;
    const srcColCount = src.end.col - src.start.col + 1;

    // Map each target column to the source column the repeating pattern
    // copies from, keeping only editable + type-compatible targets.
    const colPairs: {
      targetCol: number;
      targetField: string;
      srcCol: number;
      srcField: string;
      allowFormula: boolean;
    }[] = [];
    for (let c = firstTargetCol; c <= lastTargetCol; c++) {
      const targetField = cols[c]?.field;
      if (!targetField) continue;
      const targetDef = defMap.get(targetField);
      if (!targetDef?.editable) continue;
      const offset = right ? (c - firstTargetCol) % srcColCount : (lastTargetCol - c) % srcColCount;
      const srcCol = right ? src.start.col + offset : src.end.col - offset;
      const srcField = cols[srcCol]?.field;
      if (!srcField) continue;
      const srcDef = defMap.get(srcField);
      if ((targetDef.cellEditor ?? 'text') !== (srcDef?.cellEditor ?? 'text')) continue;
      colPairs.push({
        targetCol: c,
        targetField,
        srcCol,
        srcField,
        allowFormula: targetDef.allowFormula === true,
      });
    }
    if (colPairs.length === 0) return;

    const sourceValue = this.readCellValueAt(anchor.row, anchor.col);

    const rowIdxByDisplay = new Map<number, number>();
    for (let r = src.start.row; r <= src.end.row; r++) {
      const idx = this.displayIndexToSourceIndex(r);
      if (idx >= 0) rowIdxByDisplay.set(r, idx);
    }
    if (rowIdxByDisplay.size === 0) return;

    const changes: { rowIndex: number; field: string; before: unknown; after: unknown }[] = [];
    this.state.sourceData.update((d) => {
      const updated = [...d];
      for (const [, rowIdx] of rowIdxByDisplay) {
        const row = updated[rowIdx];
        if (!row) continue;
        const rowCopy = { ...row } as Record<string, unknown>;
        let mutated = false;
        for (const p of colPairs) {
          const srcDef = defMap.get(p.srcField);
          // Read from the unmutated row: source columns are never targets.
          const raw = srcDef?.valueGetter
            ? srcDef.valueGetter(row)
            : (row as Record<string, unknown>)[p.srcField];
          const after = this.shiftFormulaForFill(
            raw,
            p.allowFormula,
            0,
            p.targetCol - p.srcCol
          );
          const before = rowCopy[p.targetField];
          if (before === after) continue;
          rowCopy[p.targetField] = after;
          mutated = true;
          changes.push({ rowIndex: rowIdx, field: p.targetField, before, after });
        }
        if (mutated) updated[rowIdx] = rowCopy as T;
      }
      return updated;
    });
    if (changes.length > 0) {
      this.historyEngine.record('fill', changes);
    }
    this.clipboardEngine.clearCut();

    this.fillDown.emit({
      sourceCell: anchor,
      sourceValue,
      direction: 'horizontal',
      affectedCellCount: changes.length,
      targetFields: colPairs.map((p) => p.targetField),
    });
  }

  onGroupToggle(groupKey: string): void {
    if (this.state.groupMode() === 'server') {
      this.serverGroupEngine.toggleGroupExpand(groupKey);
    } else {
      this.groupEngine.toggleGroupExpand(groupKey);
    }
  }

  onRemoveGroup(field: string): void {
    this.groupEngine.removeGroup(field);
    this.groupChange.emit({
      columns: this.state.groupColumns().map((g) => g.field),
      groups: [...this.state.groupColumns()],
    });
  }

  onToggleGroupSort(field: string): void {
    const groups = this.state.groupColumns().map((g) =>
      g.field === field
        ? {
            ...g,
            sortDirection: g.sortDirection === 'asc' ? ('desc' as const) : ('asc' as const),
          }
        : g
    );
    this.groupEngine.applyGroups(groups);
    this.state.expandedGroups.set(new Set());
    this.groupChange.emit({ columns: groups.map((g) => g.field), groups: [...groups] });
  }

  onSelectAllRows(): void {
    this.rowSelectionEngine.selectAll();
    this.activateRowSelectionMode();
    this.selectionChange.emit(this.rowSelectionEngine.getSelectionEvent());
  }

  onClearSelection(): void {
    this.rowSelectionEngine.deselectAll();
    this.state.activeSelectionMode.set('none');
    this.selectionChange.emit(this.rowSelectionEngine.getSelectionEvent());
  }

  /** Removes a single condition by id (tag "×" button). */
  onRemoveFilter(id: string): void {
    this.filterEngine.removeCondition(id);
  }

  /** Clears the whole filter model ("Remove all" button). */
  onRemoveAllFilters(): void {
    this.filterEngine.clearAll();
  }

  // --- Filter drawer ---

  onFiltersClick(): void {
    const data: FilterDrawerData = {
      model: { conditions: this.filterEngine.conditions().slice() },
      availableColumns: this.filterEngine.describeFilterableColumns(),
      applyMode: this.resolvedFilterApplyMode(),
    };

    const ref = this.drawerService.open<
      AdeoGridFilterDrawerComponent,
      FilterDrawerData,
      FilterDrawerResult
    >(AdeoGridFilterDrawerComponent, { title: 'Filters', data, extended: true });

    ref.afterClosed().subscribe((result) => {
      if (result?.applied) {
        this.filterEngine.setModel(result.model, 'replace');
      }
    });
  }

  onRestoreColumn(field: string): void {
    this.state.updateColumnState(field, { visible: true });
  }

  toggleFullscreen(): void {
    this.isFullscreen.update((v) => !v);
    // After the layout flip, push a fresh measurement through the engines so
    // the visible row/column ranges are recomputed against the new size.
    requestAnimationFrame(() => {
      const grid = this.gridContainer();
      if (!grid) return;
      const el = grid.nativeElement;
      this.horizontalVirtualScrollEngine.onScroll(el.scrollLeft, el.clientWidth);
      this.verticalVirtualScrollEngine.onScroll(el.scrollTop, el.clientHeight);
    });
  }

  onRestoreAllColumns(): void {
    this.state.columnStates.update((states) =>
      states.map((s) => (s.visible ? s : { ...s, visible: true }))
    );
  }

  getColumnLabel(field: string): string {
    const def = this.state.columnDefMap().get(field);
    return def?.headerName ?? field;
  }

  onResizeStart(event: { field: string; event: MouseEvent }): void {
    this.resizeEngine.startResize(event.field, event.event);
  }

  onExportCsv(): void {
    if (this.exportMode() === 'server') {
      this.exportRequest.emit({
        format: 'csv',
        sorts: this.state.activeSorts(),
        filterModel: this.state.filterModel(),
        columns: this.state.visibleColumns().map((c) => c.field),
      });
      return;
    }
    this.exportEngine.exportCsv(this.data());
  }

  /**
   * Resolves the dataset to export based on the requested scope:
   *  - `'selection'` : the currently selected rows (row-selection mode) or
   *                    the cell range rows (cell-selection mode).
   *  - `'visible'`   : the current page's data.
   *  - `'all'`       : the full source dataset (default).
   */
  private resolveExportData(scope?: 'selection' | 'visible' | 'all'): T[] {
    if (scope === 'selection') {
      if (this.state.activeSelectionMode() === 'rows') {
        return this.rowSelectionEngine.getSelectionEvent().selectedRows as T[];
      }
      const range = this.cellSelectionEngine.getNormalizedRange();
      if (range) {
        const data = this.state.sourceData();
        const rows: T[] = [];
        for (let r = range.start.row; r <= range.end.row; r++) {
          if (data[r]) rows.push(data[r]);
        }
        return rows;
      }
    }
    if (scope === 'visible') {
      return this.gridEngine.paginatedData();
    }
    return this.state.sourceData();
  }

  /**
   * Public imperative API: export the grid data as CSV.
   * @param opts Export options including an optional `scope` to limit the dataset.
   */
  public exportCsv(
    opts?: ExportOptions & { scope?: 'selection' | 'visible' | 'all' }
  ): void {
    const data = this.resolveExportData(opts?.scope);
    const { scope: _scope, ...rest } = opts ?? {};
    this.exportEngine.exportCsv(data, rest);
  }

  /**
   * Public imperative API: export the grid data as JSON.
   * @param opts Export options including an optional `scope` to limit the dataset.
   */
  public exportJson(
    opts?: { filename?: string; columns?: string[]; scope?: 'selection' | 'visible' | 'all' }
  ): void {
    const data = this.resolveExportData(opts?.scope);
    const { scope: _scope, ...rest } = opts ?? {};
    this.exportEngine.exportJson(data, rest);
  }

  /**
   * Public imperative API: autosize a single column by field.
   * Measures cell content via canvas and updates the column's current width.
   *
   * @param field   Column field identifier.
   * @param options Optional overrides. `maxWidth` caps the resulting width
   *                (default: 800 px).
   */
  public autosizeColumn(field: string, options?: { maxWidth?: number }): void {
    const wrapper = this.gridContainer()?.nativeElement ?? null;
    this.autosizeEngine.autosizeColumn(field, wrapper, options);
  }

  /**
   * Public imperative API: autosize all visible columns in a single pass.
   *
   * @param options Optional overrides. `maxWidth` caps the resulting width
   *                (default: 800 px).
   */
  public autosizeAllColumns(options?: { maxWidth?: number }): void {
    const wrapper = this.gridContainer()?.nativeElement ?? null;
    this.autosizeEngine.autosizeAllColumns(wrapper, options);
  }

  // --- Group drawer ---

  onGroupClick(): void {
    const allGroupable = this.state
      .columnDefs()
      .map((d) => ({ field: d.field, headerName: d.headerName ?? d.field }));

    const data: GroupDrawerData = {
      groups: [...this.state.groupColumns()],
      availableColumns: allGroupable,
    };

    const ref = this.drawerService.open<
      GridGroupDrawerComponent,
      GroupDrawerData,
      GroupDrawerResult
    >(GridGroupDrawerComponent, { title: 'Group by', data });

    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.applyGroupResult(result);
      }
    });
  }

  private applyGroupResult(result: GroupDrawerResult): void {
    this.groupEngine.applyGroups(result.groups);
    this.state.expandedGroups.set(new Set());
    this.groupChange.emit({
      columns: result.groups.map((g) => g.field),
      groups: [...result.groups],
    });
  }

  // --- Keyboard shortcuts drawer ---

  onKeyboardShortcutsClick(): void {
    this.drawerService.open<GridKeyboardShortcutsDrawerComponent, void, void>(
      GridKeyboardShortcutsDrawerComponent,
      { title: 'Keyboard shortcuts' }
    );
  }

  // --- Formula bar edit handlers ---

  /** Clicking the readonly preview flips the bar into edit mode: we mount
   *  the full formula editor on the next tick (it auto-focuses) and
   *  snapshot the target cell so blur-ordering races can't mis-route
   *  the commit to a different row. */
  onFormulaBarInputFocus(): void {
    if (!this.formulaBarEditable() || this.formulaBarEditing()) return;
    const coord = this.formulaBarCoord();
    if (!coord) return;
    const initial = this.formulaBarContent();
    this.formulaBarEditSnapshot = { coord: { ...coord }, initial };
    this.formulaBarActiveCoord.set({ ...coord });
    this.formulaBarDraft.set(initial);
    this.formulaBarEditing.set(true);
    this.state.formulaBarEditingActive.set(true);
  }

  onFormulaBarEditorChange(value: string): void {
    this.formulaBarDraft.set(value);
  }

  onFormulaBarEditorCommit(): void {
    this.commitFormulaBar();
    this.exitFormulaBarEdit();
  }

  onFormulaBarEditorCancel(): void {
    this.exitFormulaBarEdit();
  }

  /** Commit-on-outside-focus: when the user tabs or clicks truly away
   *  from the bar (not onto a grid cell — cells aren't focusable so they
   *  don't steal focus), persist the draft. */
  onFormulaBarWrapperFocusout(event: FocusEvent): void {
    if (!this.formulaBarEditing()) return;
    const wrapper = event.currentTarget as HTMLElement;
    const next = event.relatedTarget as Node | null;
    // Focus moving within the bar (e.g. editor ↔ suggestion list) is fine.
    if (next && wrapper.contains(next)) return;
    // Suggestion overlay renders at <body> level — don't close the bar
    // while the user is picking a suggestion.
    if (next instanceof HTMLElement && next.closest('.cdk-overlay-container')) return;
    // Defer so a re-focus initiated by the ref-picker (cells call
    // `input.focus()` after inserting) can cancel this close.
    setTimeout(() => {
      if (!this.formulaBarEditing()) return;
      const active = document.activeElement;
      if (active && wrapper.contains(active)) return;
      if (active instanceof HTMLElement && active.closest('.cdk-overlay-container')) return;
      this.commitFormulaBar();
      this.exitFormulaBarEdit();
    });
  }

  private exitFormulaBarEdit(): void {
    this.formulaBarEditing.set(false);
    this.formulaBarDraft.set(null);
    this.formulaBarEditSnapshot = null;
    this.formulaBarActiveCoord.set(null);
    this.state.formulaBarEditingActive.set(false);
  }

  private commitFormulaBar(): void {
    const draft = this.formulaBarDraft();
    const snapshot = this.formulaBarEditSnapshot;
    if (draft === null || !snapshot) return;
    // No-op when the user opened the bar and clicked away without typing —
    // prevents accidental writes caused by the blur→click ordering.
    if (draft === snapshot.initial) return;
    const coord = snapshot.coord;
    const field = this.state.visibleColumns()[coord.col]?.field;
    if (!field) return;
    const def = this.state.columnDefMap().get(field);
    if (!def?.editable) return;

    const sourceIdx = this.displayIndexToSourceIndex(coord.row);
    if (sourceIdx < 0) return;
    const currentRow = this.state.sourceData()[sourceIdx] as Record<string, unknown> | undefined;
    if (!currentRow) return;
    const rowId = currentRow[this.state.rowIdField()] as string | number | undefined;
    if (rowId === undefined || rowId === null) return;

    const oldValue = currentRow[field];
    // `displayFormula` mirrors the A1 surface the editor uses, so the
    // no-op short-circuit actually catches unchanged formula edits.
    const oldFormulaA1 = this.formulaEngine.displayFormula({ rowId, field });
    const oldFormulaStored = this.formulaEngine.getFormula({ rowId, field });
    const oldSerialized =
      oldFormulaA1 ?? (oldValue === undefined || oldValue === null ? '' : String(oldValue));
    if (draft === oldSerialized) return;

    // Coerce the draft: plain numeric strings become numbers so downstream
    // consumers (and formulas depending on this cell) see the right type.
    // Formula drafts are authored in A1; sourceData holds REF long-form
    // storage, so we normalise before writing.
    const looksLikeFormula = draft.trimStart().startsWith('=');
    const newValue: unknown = looksLikeFormula
      ? this.a1FormulaToStorage(draft)
      : coerceDraftValue(draft, oldValue);

    if (def.cellEditorValidator) {
      const result = def.cellEditorValidator(newValue, currentRow as T);
      if (result === false || typeof result === 'string') return;
    }

    this.state.sourceData.update((data) => {
      const updated = [...data];
      updated[sourceIdx] = { ...updated[sourceIdx], [field]: newValue } as T;
      return updated;
    });
    const newRow = this.state.sourceData()[sourceIdx];

    const addr = { rowId, field };
    const allowFormula = def.allowFormula === true;
    if (allowFormula && looksLikeFormula) {
      this.formulaEngine.set(addr, draft);
    } else if (allowFormula && oldFormulaStored && !looksLikeFormula) {
      this.formulaEngine.remove(addr);
    }
    this.formulaEngine.invalidate(addr);

    this.cellEdit.emit({
      row: newRow,
      rowIndex: sourceIdx,
      field,
      oldValue,
      newValue,
    } as CellEditEvent<T>);
  }

  /**
   * Convert a formula-bar A1 draft to REF long-form storage. Kept as a
   * member so it can re-use the grid's reactive context without threading
   * `fields` / `rowIds` through every caller.
   */
  private a1FormulaToStorage(draft: string): string {
    const rowIds = this.state.sourceData().map((row) => {
      const r = row as Record<string, unknown>;
      return (r[this.state.rowIdField()] as string | number | undefined) ?? '';
    });
    const fields = this.state.visibleColumns().map((c) => c.field);
    return a1ToLongForm(draft, { fields, rowIds });
  }

  // --- Formula reference drawer ---

  onFormulaReferenceClick(): void {
    const registry = this.formulaEngine.getFunctions();
    const entries: FormulaReferenceEntry[] = Object.entries(registry)
      .filter(([, impl]) => !!impl.docs)
      .map(([name, impl]) => ({
        name,
        signature: impl.docs!.signature,
        summary: impl.docs!.summary,
      }));
    this.drawerService.open<GridFormulaReferenceDrawerComponent, FormulaReferenceData, void>(
      GridFormulaReferenceDrawerComponent,
      {
        title: 'Fonctions disponibles',
        data: { entries },
      }
    );
  }

  // --- Settings drawer ---

  private static readonly DENSITY_ROW_HEIGHT: Record<GridDensity, number> = {
    compact: 32,
    default: 48,
    comfortable: 64,
  };

  onSettingsClick(): void {
    const data: GridSettingsData = {
      columns: this.state.columnStates().map((col) => ({
        field: col.field,
        headerName: this.state.columnDefMap().get(col.field)?.headerName ?? col.field,
        visible: col.visible,
      })),
      density: this.state.density(),
      defaultColumns: this.state.columnDefs().map((def) => ({
        field: def.field,
        headerName: def.headerName ?? def.field,
        visible: def.visible !== false,
      })),
    };

    const ref = this.drawerService.open<
      GridSettingsDrawerComponent,
      GridSettingsData,
      GridSettingsResult
    >(GridSettingsDrawerComponent, { title: 'Settings', data });

    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.applySettings(result);
      }
    });
  }

  private applySettings(result: GridSettingsResult): void {
    this.state.density.set(result.density);
    this.state.rowHeight.set(AdGridAngularComponent.DENSITY_ROW_HEIGHT[result.density]);

    for (const col of result.columns) {
      this.state.updateColumnState(col.field, { visible: col.visible, order: col.order });
    }

    this.settingsChange.emit(result);
  }

  // --- Freeze helpers ---

  private freezeLeft(field: string): void {
    this.state.updateColumnState(field, { pinned: 'start' });
  }

  private freezeRight(field: string): void {
    this.state.updateColumnState(field, { pinned: 'end' });
  }

  // --- Bulk actions ---

  private getRangeRowIds(range: {
    start: { row: number; col: number };
    end: { row: number; col: number };
  }): unknown[] {
    const data = this.state.sourceData();
    const ids: unknown[] = [];
    for (let r = range.start.row; r <= range.end.row; r++) {
      if (data[r]) {
        ids.push(this.rowSelectionEngine.getRowId(data[r]));
      }
    }
    return ids;
  }

  private getRangeFields(range: {
    start: { row: number; col: number };
    end: { row: number; col: number };
  }): string[] {
    const cols = this.state.visibleColumns();
    const fields: string[] = [];
    for (let c = range.start.col; c <= range.end.col; c++) {
      if (cols[c]) fields.push(cols[c].field);
    }
    return fields;
  }

  private getRowSelectionIds(event: RowSelectionEvent<T>): unknown[] {
    return event.selectedIds as unknown[];
  }

  private getAllVisibleFields(): string[] {
    return this.state.visibleColumns().map((c) => c.field);
  }

  /**
   * Resolves a list of internal `HistoryCellChange` records into the public
   * `BulkCellChange[]` shape exposed on bulk events. Looks up each row's
   * configured id so consumers can persist changes without a second pass.
   */
  private toBulkCellChanges(changes: HistoryCellChange[]): BulkCellChange[] {
    if (changes.length === 0) return [];
    const data = this.state.sourceData();
    const idField = this.state.rowIdField?.() ?? 'id';
    return changes.map((c) => {
      const row = data[c.rowIndex] as Record<string, unknown> | undefined;
      return {
        rowIndex: c.rowIndex,
        rowId: row ? row[idField] : undefined,
        field: c.field,
        oldValue: c.before,
        newValue: c.after,
      };
    });
  }

  private clearSelectionAndCloseBar(): void {
    const mode = this.state.activeSelectionMode();
    if (mode === 'rows') {
      this.rowSelectionEngine.deselectAll();
    } else if (mode === 'cells') {
      this.cellSelectionEngine.clearFocus();
    }
    this.state.activeSelectionMode.set('none');
  }

  onBulkEdit(): void {
    if (this.state.activeSelectionMode() === 'rows') {
      const event = this.rowSelectionEngine.getSelectionEvent();
      this.bulkEdit.emit({
        range: null,
        cellCount: event.count,
        rowIds: this.getRowSelectionIds(event),
        fields: this.getAllVisibleFields(),
        selectionMode: 'rows',
        rowSelection: event,
      });
      return;
    }
    const range = this.cellSelectionEngine.getNormalizedRange();
    if (!range) return;
    const rows = range.end.row - range.start.row + 1;
    const cols = range.end.col - range.start.col + 1;
    this.bulkEdit.emit({
      range,
      cellCount: rows * cols,
      rowIds: this.getRangeRowIds(range),
      fields: this.getRangeFields(range),
    });
  }

  onBulkCopy(): void {
    // A fresh copy always cancels any pending cut (Excel parity).
    this.clipboardEngine.clearCut();

    if (this.state.activeSelectionMode() === 'rows') {
      const event = this.rowSelectionEngine.getSelectionEvent();
      const rowData = this.extractRowSelectionData(event.selectedRows as T[]);
      const tsv = rowData.map((row) => row.join('\t')).join('\n');
      navigator.clipboard.writeText(tsv);
      this.bulkCopy.emit({
        range: null,
        data: rowData,
        rowIds: this.getRowSelectionIds(event),
        fields: this.getAllVisibleFields(),
        selectionMode: 'rows',
        rowSelection: event,
      });
      return;
    }
    const data = this.extractRangeData();
    if (!data) return;
    const tsv = data.values.map((row) => row.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv);
    this.bulkCopy.emit({
      range: data.range,
      data: data.values,
      rowIds: this.getRangeRowIds(data.range),
      fields: this.getRangeFields(data.range),
    });
  }

  async onBulkPaste(): Promise<void> {
    if (this.state.activeSelectionMode() === 'rows') {
      const event = this.rowSelectionEngine.getSelectionEvent();
      try {
        const text = await navigator.clipboard.readText();
        const pasteRows = text.split('\n').map((line) => line.split('\t'));
        const changes = this.applyPasteToSelectedRows(event.selectedRows as T[], pasteRows);
        if (changes.length > 0) {
          this.historyEngine.record('paste', changes);
        }
        this.bulkPaste.emit({
          range: null,
          data: pasteRows,
          rowIds: this.getRowSelectionIds(event),
          fields: this.getAllVisibleFields(),
          changes: this.toBulkCellChanges(changes),
          selectionMode: 'rows',
          rowSelection: event,
        });
      } catch {
        // Clipboard access denied
      }
      return;
    }
    // Use focusedCell as the anchor for paste (enables cross-page paste)
    const focused = this.state.focusedCell();
    if (!focused) return;
    try {
      const text = await navigator.clipboard.readText();
      const rows = text
        .replace(/\r?\n$/, '')
        .split('\n')
        .map((line) => line.split('\t'));
      const cols = this.state.visibleColumns();

      // Excel-style: a single clipboard value pasted over a multi-cell selection
      // fills the entire selection rather than only the focused anchor.
      const isSingleValue = rows.length === 1 && rows[0].length === 1;
      const selection = this.cellSelectionEngine.getNormalizedRange();
      const isMultiCellSelection =
        !!selection &&
        (selection.start.row !== selection.end.row || selection.start.col !== selection.end.col);

      let pasteRange: CellRange;
      let pasteChanges: HistoryCellChange[];
      if (isSingleValue && isMultiCellSelection && selection) {
        pasteRange = selection;
        pasteChanges = this.clipboardEngine.fillSelection(selection, rows[0][0]);
      } else {
        pasteRange = {
          start: { row: focused.row, col: focused.col },
          end: {
            row: Math.min(focused.row + rows.length - 1, this.state.sourceData().length - 1),
            col: Math.min(focused.col + (rows[0]?.length ?? 1) - 1, cols.length - 1),
          },
        };
        pasteChanges = this.clipboardEngine.applyPaste(pasteRange, rows);
      }

      // If a cut is pending, first wipe the source cells so cut+paste == move,
      // and fold both halves into a single undoable history op.
      const cutSource = this.state.cutSource();
      const clearChanges = cutSource ? this.clipboardEngine.clearRange(cutSource) : [];
      const allChanges = [...clearChanges, ...pasteChanges];
      if (allChanges.length > 0) {
        this.historyEngine.record(cutSource ? 'cut' : 'paste', allChanges);
      }
      this.clipboardEngine.clearCut();
      this.bulkPaste.emit({
        range: pasteRange,
        data: rows,
        rowIds: this.getRangeRowIds(pasteRange),
        fields: this.getRangeFields(pasteRange),
        changes: this.toBulkCellChanges(allChanges),
      });
    } catch {
      // Clipboard access denied
    }
  }

  onBulkExport(): void {
    if (this.state.activeSelectionMode() === 'rows') {
      const event = this.rowSelectionEngine.getSelectionEvent();
      this.exportEngine.exportCsv(event.selectedRows as T[], {
        filename: 'selection-export',
      });
      return;
    }
    // Cell range selection: export the data rows covered by the range
    const range = this.cellSelectionEngine.getNormalizedRange();
    if (!range) return;
    const data = this.state.sourceData();
    const cols = this.state.visibleColumns();
    const rangeFields = cols.slice(range.start.col, range.end.col + 1).map((c) => c.field);
    const rangeRows: T[] = [];
    for (let r = range.start.row; r <= range.end.row; r++) {
      if (data[r]) rangeRows.push(data[r]);
    }
    this.exportEngine.exportCsv(rangeRows, {
      filename: 'selection-export',
      columns: rangeFields,
    });
  }

  onBulkDelete(): void {
    if (this.state.activeSelectionMode() === 'rows') {
      const event = this.rowSelectionEngine.getSelectionEvent();
      const changes = this.deleteSelectedRows(event.selectedRows as T[]);
      if (changes.length > 0) {
        this.historyEngine.record('delete', changes);
      }
      // Intentionally keep the selection active so users can chain actions
      // (undo, then paste, etc.) — the overlay only closes via the ✕ button.
      this.bulkDelete.emit({
        range: null,
        cellCount: event.count,
        rowIds: this.getRowSelectionIds(event),
        fields: this.getAllVisibleFields(),
        changes: this.toBulkCellChanges(changes),
        selectionMode: 'rows',
        rowSelection: event,
      });
      return;
    }
    const range = this.cellSelectionEngine.getNormalizedRange();
    if (!range) return;

    // Guard: ensure the range belongs to the current page
    const pageStart = this.state.pageIndex() * this.state.pageSize();
    const pageEnd = pageStart + this.gridEngine.paginatedData().length - 1;
    if (range.start.row < pageStart || range.end.row > pageEnd) return;

    const rows = range.end.row - range.start.row + 1;
    const colCount = range.end.col - range.start.col + 1;

    const changes = this.clipboardEngine.clearRange(range);
    if (changes.length > 0) {
      this.historyEngine.record('delete', changes);
    }
    this.clipboardEngine.clearCut();

    this.bulkDelete.emit({
      range,
      cellCount: rows * colCount,
      rowIds: this.getRangeRowIds(range),
      fields: this.getRangeFields(range),
      changes: this.toBulkCellChanges(changes),
    });
  }

  private extractRangeData(): {
    range: ReturnType<CellSelectionEngine<T>['getNormalizedRange']> & object;
    values: string[][];
  } | null {
    const range = this.cellSelectionEngine.getNormalizedRange();
    if (!range) return null;
    const cols = this.state.visibleColumns();
    const data = this.state.sourceData();
    const defMap = this.state.columnDefMap();
    const values: string[][] = [];

    for (let r = range.start.row; r <= range.end.row; r++) {
      const row = data[r];
      if (!row) continue;
      const rowValues: string[] = [];
      for (let c = range.start.col; c <= range.end.col; c++) {
        const field = cols[c]?.field;
        if (!field) {
          rowValues.push('');
          continue;
        }
        const def = defMap.get(field);
        const val = def?.valueGetter
          ? def.valueGetter(row)
          : (row as Record<string, unknown>)[field];
        rowValues.push(val != null ? String(val) : '');
      }
      values.push(rowValues);
    }
    return { range, values };
  }

  private extractRowSelectionData(selectedRows: T[]): string[][] {
    const cols = this.state.visibleColumns();
    const defMap = this.state.columnDefMap();
    return selectedRows.map((row) => {
      return cols.map((col) => {
        const def = defMap.get(col.field);
        const val = def?.valueGetter
          ? def.valueGetter(row)
          : (row as Record<string, unknown>)[col.field];
        return val != null ? String(val) : '';
      });
    });
  }

  private applyPasteToSelectedRows(selectedRows: T[], pasteRows: string[][]): HistoryCellChange[] {
    const cols = this.state.visibleColumns();
    const idField = this.state.rowIdField?.() ?? 'id';
    const changes: HistoryCellChange[] = [];

    this.state.sourceData.update((data) => {
      const updated = [...data];
      for (let ri = 0; ri < Math.min(selectedRows.length, pasteRows.length); ri++) {
        const selectedRow = selectedRows[ri];
        const selectedId = (selectedRow as Record<string, unknown>)[idField];
        const dataIndex = updated.findIndex(
          (r) => (r as Record<string, unknown>)[idField] === selectedId
        );
        if (dataIndex < 0) continue;

        const rowCopy = { ...updated[dataIndex] } as Record<string, unknown>;
        let changed = false;
        for (let ci = 0; ci < Math.min(pasteRows[ri].length, cols.length); ci++) {
          const field = cols[ci]?.field;
          if (!field) continue;
          const coerced = this.coerceAndValidate(field, pasteRows[ri][ci], updated[dataIndex]);
          if (coerced === PASTE_SKIP) continue;
          const before = (updated[dataIndex] as Record<string, unknown>)[field];
          if (before === coerced) continue;
          rowCopy[field] = coerced;
          changes.push({ rowIndex: dataIndex, field, before, after: coerced });
          changed = true;
        }
        if (changed) {
          updated[dataIndex] = rowCopy as T;
        }
      }
      return updated;
    });

    return changes;
  }

  private deleteSelectedRows(selectedRows: T[]): HistoryCellChange[] {
    const cols = this.state.visibleColumns();
    const idField = this.state.rowIdField?.() ?? 'id';
    const changes: HistoryCellChange[] = [];

    this.state.sourceData.update((data) => {
      const updated = [...data];
      for (const selectedRow of selectedRows) {
        const selectedId = (selectedRow as Record<string, unknown>)[idField];
        const dataIndex = updated.findIndex(
          (r) => (r as Record<string, unknown>)[idField] === selectedId
        );
        if (dataIndex < 0) continue;

        const rowCopy = { ...updated[dataIndex] } as Record<string, unknown>;
        let changed = false;
        for (const col of cols) {
          const coerced = this.coerceAndValidate(col.field, null, updated[dataIndex]);
          if (coerced === PASTE_SKIP) continue;
          const before = (updated[dataIndex] as Record<string, unknown>)[col.field];
          if (before === coerced) continue;
          rowCopy[col.field] = coerced;
          changes.push({ rowIndex: dataIndex, field: col.field, before, after: coerced });
          changed = true;
        }
        if (changed) {
          updated[dataIndex] = rowCopy as T;
        }
      }
      return updated;
    });

    return changes;
  }

  // ─── Public imperative API ────────────────────────────────────────────────
  // Mirrors the Vue AdeoGrid ref API so consumers of both frameworks have a
  // consistent surface. Methods delegate to the injected engine services.

  /** Undo the last recorded edit operation. */
  public undo(): void {
    this.historyEngine.undo();
    this.clipboardEngine.clearCut();
  }

  /** Redo the previously undone edit operation. */
  public redo(): void {
    this.historyEngine.redo();
    this.clipboardEngine.clearCut();
  }

  /** Clear the full undo / redo history stacks. */
  public clearHistory(): void {
    this.historyEngine.clear();
  }

  /**
   * Trigger full validation pass over the current source data.
   * Returns the total number of validation errors found.
   */
  public validateAll(): number {
    return this.validationEngine.validateAll(this.state.sourceData());
  }

  /** Get the validation error for a specific cell (by source row index + field), or null. */
  public getCellError(rowIndex: number, field: string): CellError | null {
    return this.validationEngine.getCellError(rowIndex, field);
  }

  /** Returns `true` when the given cell has a validation error. */
  public hasCellError(rowIndex: number, field: string): boolean {
    return this.validationEngine.hasCellError(rowIndex, field);
  }

  /**
   * Set a formula for the cell identified by the given A1 address string
   * (e.g. `"B3"`) or long-form `"rowId::field"` format. Requires `formulas`
   * input to be `true` and the column to declare `allowFormula: true`.
   */
  public setFormula(addr: string, formula: string): void {
    const resolved = this.parseFormulaAddr(addr);
    if (!resolved) return;
    this.formulaEngine.set(resolved, formula);
  }

  /** Get the raw formula string for a cell, or `null` if none. */
  public getFormula(addr: string): string | null {
    const resolved = this.parseFormulaAddr(addr);
    if (!resolved) return null;
    return this.formulaEngine.getFormula(resolved) ?? null;
  }

  /** Get the evaluated formula value for a cell, or `null` if none. */
  public getFormulaValue(addr: string): FormulaValue | null {
    const resolved = this.parseFormulaAddr(addr);
    if (!resolved) return null;
    return this.formulaEngine.valueAt(resolved) ?? null;
  }

  /**
   * Persist the current column/sort/filter view state under the given key.
   * Same mechanics as the `stateKey` input but callable programmatically.
   */
  public persistView(key: string): void {
    this.persistenceEngine.save(key);
  }

  /**
   * Restore a previously persisted view state.
   * Returns `true` if a saved state was found and applied.
   */
  public restoreView(key: string): boolean {
    return this.persistenceEngine.restore(key);
  }

  /** Get the current active sort descriptors. */
  public getSortModel(): SortDef[] {
    return this.state.activeSorts();
  }

  /** Get the current filter model. */
  public getFilterModel(): FilterModel {
    return this.state.filterModel();
  }

  /** Get the current group entries. */
  public getGroupModel(): GroupEntry[] {
    return this.state.groupColumns();
  }

  /** Programmatically set the filter model, replacing any existing conditions. */
  public setFilterModel(model: FilterModel): void {
    this.state.filterModel.set(model);
  }

  /** Clear all active filter conditions. */
  public clearFilters(): void {
    this.filterEngine.clearAll();
  }

  /**
   * Programmatically add or replace a simple "contains" filter condition
   * for the given field. If a condition for that field already exists it is
   * replaced; otherwise it is appended to the current filter model.
   */
  public setFilter(field: string, value: unknown): void {
    const model = this.state.filterModel();
    const conditions = model.conditions.filter((c) => c.field !== field);
    conditions.push({
      id: crypto.randomUUID(),
      field,
      combinator: 'and',
      operator: 'contains',
      value: { value },
    });
    this.filterEngine.setModel({ ...model, conditions }, 'replace');
  }

  /** Clear all active sort descriptors. */
  public clearSort(): void {
    this.sortEngine.clearSort();
  }

  /** Clear all active group entries. */
  public clearGroups(): void {
    this.groupEngine.clearGroups();
  }

  /**
   * Clear quick filters (column-level search inputs).
   * Angular does not have a dedicated quickFilters concept (it uses the same
   * FilterEngine pipeline) — this is a noop kept for API parity with Vue.
   */
  public clearQuickFilters(): void {
    // No separate quick-filter state in Angular — all filters are in FilterEngine.
    // Noop for cross-framework API parity.
  }

  /** Select all rows (sets select-all mode). */
  public selectAll(): void {
    this.rowSelectionEngine.selectAll();
    this.activateRowSelectionMode();
    this.selectionChange.emit(this.rowSelectionEngine.getSelectionEvent());
  }

  /** Clear all row selections. */
  public clearSelection(): void {
    this.rowSelectionEngine.deselectAll();
    this.state.activeSelectionMode.set('none');
    this.selectionChange.emit(this.rowSelectionEngine.getSelectionEvent());
  }

  /** Get the currently selected rows (page-scope, matches current `getSelectionEvent().selectedRows`). */
  public getSelectedRows(): T[] {
    return this.rowSelectionEngine.getSelectionEvent().selectedRows as T[];
  }

  /** Tree helpers — delegate to the injected `TreeEngine`. */
  public readonly tree = {
    flatten: (
      data: T[],
      config: import('./features/tree.engine').TreeNodeConfig,
      expanded: Set<string>,
      idField: string
    ) => this.treeEngine.flatten(data, config, expanded, idField),
    toggleNode: (nodeKey: string) => this.treeEngine.toggleNode(nodeKey),
    expandAll: (
      data: T[],
      config: import('./features/tree.engine').TreeNodeConfig,
      idField: string
    ) => this.treeEngine.expandAll(data, config, idField),
    collapseAll: () => this.treeEngine.collapseAll(),
  };

  /**
   * Parse an address string (`"B3"` A1 notation, or `"rowId::field"` long-form)
   * into a `CellAddress`. Returns `null` for unrecognisable inputs.
   */
  private parseFormulaAddr(addr: string): CellAddress | null {
    // Long-form: "rowId::field"
    if (addr.includes('::')) {
      const sep = addr.indexOf('::');
      return { rowId: addr.slice(0, sep), field: addr.slice(sep + 2) };
    }
    // A1: delegate to the existing a1ToLongForm util by wrapping in a dummy formula
    const longForm = a1ToLongForm(`=${addr}`, {
      fields: this.state.visibleColumns().map((c) => c.field),
      rowIds: this.state.sourceData().map((r) => {
        const rec = r as Record<string, unknown>;
        return (rec[this.state.rowIdField()] as string | number | undefined) ?? '';
      }),
    });
    // a1ToLongForm returns `=REF(COLUMN("field"),ROW(rowId))` — extract components
    const match = longForm.match(/REF\(COLUMN\("([^"]+)"\),ROW\(([^)]+)\)\)/);
    if (!match) return null;
    return { field: match[1], rowId: match[2] };
  }

  ngOnDestroy(): void {
    for (const dispose of this.pluginDisposers) {
      dispose();
    }
    this.pluginDisposers = [];
  }

  private coerceAndValidate(field: string, rawValue: unknown, row: T): unknown {
    const def = this.state.columnDefMap().get(field);
    if (!def?.editable) return PASTE_SKIP;

    const editorType = def.cellEditor;

    // Handle delete (null) — return appropriate empty value per type
    if (rawValue === null) {
      let clearValue: unknown;
      switch (editorType) {
        case 'number':
          clearValue = null;
          break;
        case 'checkbox':
          clearValue = false;
          break;
        default:
          clearValue = '';
          break;
      }
      if (def.cellEditorValidator) {
        const result = def.cellEditorValidator(clearValue, row);
        if (result === false || typeof result === 'string') return PASTE_SKIP;
      }
      return clearValue;
    }

    let value: unknown = rawValue;

    if (editorType === 'number') {
      const num = Number(rawValue);
      if (isNaN(num)) return PASTE_SKIP;
      value = num;
    } else if (editorType === 'checkbox') {
      if (rawValue === 'true' || rawValue === true) {
        value = true;
      } else if (rawValue === 'false' || rawValue === false) {
        value = false;
      } else {
        return PASTE_SKIP;
      }
    } else if (editorType === 'select' && def.cellEditorOptions?.length) {
      const allowed = def.cellEditorOptions.map((o) => String(o.value));
      if (!allowed.includes(String(rawValue))) return PASTE_SKIP;
      value = rawValue;
    }

    if (def.cellEditorValidator) {
      const result = def.cellEditorValidator(value, row);
      if (result === false || typeof result === 'string') return PASTE_SKIP;
    }

    return value;
  }
}

/**
 * Coerce a raw formula-bar draft (always a string) back to the column's
 * natural type. Empty → `''`, numeric literal → `number` (when the old
 * cell was numeric), booleans → boolean, otherwise the string is kept
 * verbatim. Matches the inline editor's commit-time coercion closely
 * enough that downstream consumers see a consistent type.
 */
function coerceDraftValue(raw: string, previous: unknown): unknown {
  if (raw === '') return '';
  if (typeof previous === 'number' || (previous === undefined && /^-?\d+(?:\.\d+)?$/.test(raw))) {
    const n = Number(raw);
    if (!Number.isNaN(n)) return n;
  }
  if (typeof previous === 'boolean') {
    if (raw === 'true' || raw === 'TRUE') return true;
    if (raw === 'false' || raw === 'FALSE') return false;
  }
  return raw;
}
