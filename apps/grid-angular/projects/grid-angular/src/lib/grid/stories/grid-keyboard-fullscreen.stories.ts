import type { Meta, StoryObj } from '@storybook/angular';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AdGridAngularComponent } from '../grid';
import { AdeoGridColumnDef } from '../directives/grid-column-def';
import { Product, generateProducts, PRODUCTS_100, GRID_WRAPPER, baseMeta, EXCEL_SHORTCUTS } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Data Display/Grid/Keyboard & Fullscreen',
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const WithFullscreen: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Click the "Fullscreen" button to toggle fullscreen mode.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20" [fullscreen]="true">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" [sortable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" />
        </ad-grid-angular>
      </div>
    `,
  }),
};

@Component({
  selector: 'moz-story-excel-keyboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdGridAngularComponent, AdeoGridColumnDef],
  template: `
    <div
      style="display: flex; gap: 12px; height: 640px; font-family: var(--font-family, sans-serif);"
    >
      <!-- Legend -->
      <aside
        style="flex: 0 0 300px; overflow-y: auto; border: 1px solid var(--color-border-primary, #dee2e6); border-radius: 6px; background: #fafafa; padding: 12px;"
      >
        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #1a73e8;">
          Raccourcis clavier Excel
        </h4>
        <p style="margin: 0 0 12px 0; font-size: 11px; color: #6c757d; line-height: 1.4;">
          Cliquez dans le tableau puis testez. Les modifications sont persistées (undo/redo) via
          <code>stateKey</code>, donc rechargez la page pour vérifier.
        </p>
        @for (group of shortcuts; track group.title) {
        <div style="margin-bottom: 12px;">
          <div
            style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #495057; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e5e5e5;"
          >
            {{ group.title }}
          </div>
          @for (item of group.items; track item.keys) {
          <div
            style="display: flex; align-items: start; gap: 8px; font-size: 11px; padding: 2px 0; line-height: 1.35;"
          >
            <kbd
              style="flex: 0 0 auto; min-width: 84px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; background: #fff; border: 1px solid #dee2e6; border-bottom-width: 2px; border-radius: 3px; padding: 1px 5px; color: #333; white-space: nowrap;"
              >{{ item.keys }}</kbd
            >
            <span style="flex: 1; color: #333;">{{ item.label }}</span>
          </div>
          }
        </div>
        }
      </aside>

      <!-- Grid + event log -->
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px;">
        <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
          <ad-grid-angular
            [data]="data()"
            [pagination]="false"
            stateKey="excel-keyboard-demo"
            (cellEdit)="logEvent('cellEdit', $event)"
            (bulkCopy)="logEvent('bulkCopy', $event)"
            (bulkPaste)="logEvent('bulkPaste', $event)"
            (bulkDelete)="logEvent('bulkDelete', $event)"
            (bulkEdit)="logEvent('bulkEdit', $event)"
            (fillDown)="logEvent('fillDown', $event)"
          >
            <ad-grid-column-def field="id" headerName="ID" width="70" [sortable]="true" />
            <ad-grid-column-def
              field="name"
              headerName="Nom"
              width="200"
              [sortable]="true"
              [editable]="true"
            />
            <ad-grid-column-def
              field="reference"
              headerName="Référence"
              width="150"
              [editable]="true"
            />
            <ad-grid-column-def
              field="category"
              headerName="Catégorie"
              width="170"
              [editable]="true"
              cellEditor="select"
              [cellEditorOptions]="categoryOptions"
            />
            <ad-grid-column-def
              field="price"
              headerName="Prix (€)"
              width="120"
              [editable]="true"
              cellEditor="number"
            />
            <ad-grid-column-def
              field="stock"
              headerName="Stock"
              width="100"
              [editable]="true"
              cellEditor="number"
            />
            <ad-grid-column-def
              field="available"
              headerName="Disponible"
              width="110"
              [editable]="true"
              cellEditor="checkbox"
            />
            <ad-grid-column-def
              field="lastUpdated"
              headerName="Dernière MAJ"
              width="150"
              [editable]="true"
              cellEditor="date"
            />
          </ad-grid-angular>
        </div>

        <div
          style="height: 140px; border: 1px solid var(--color-border-primary, #dee2e6); border-radius: 4px; background: #1e1e1e; overflow-y: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; padding: 8px;"
        >
          <div style="color: #9ca3af; margin-bottom: 4px; font-weight: 600; letter-spacing: 0.3px;">
            Event log
          </div>
          @for (entry of eventLog; track $index) {
          <div
            style="color: #a8d8a8; padding: 1px 0; word-break: break-all; white-space: pre-wrap;"
          >
            {{ entry }}
          </div>
          } @if (eventLog.length === 0) {
          <div style="color: #6c757d; font-style: italic;">
            Cliquez dans une cellule et utilisez les raccourcis pour voir les events.
          </div>
          }
        </div>
      </div>
    </div>
  `,
})
class ExcelKeyboardWrapperComponent {
  readonly shortcuts = EXCEL_SHORTCUTS;
  readonly data = signal<Product[]>(generateProducts(40));
  readonly categoryOptions = [
    { text: 'Peinture', value: 'Peinture' },
    { text: 'Outillage', value: 'Outillage' },
    { text: 'Plomberie', value: 'Plomberie' },
    { text: 'Électricité', value: 'Électricité' },
    { text: 'Jardin', value: 'Jardin' },
    { text: 'Revêtement', value: 'Revêtement' },
    { text: 'Quincaillerie', value: 'Quincaillerie' },
    { text: 'Menuiserie', value: 'Menuiserie' },
  ];
  eventLog: string[] = [];

  logEvent(name: string, detail: unknown): void {
    const ts = new Date().toLocaleTimeString();
    const json = JSON.stringify(detail);
    this.eventLog = [`[${ts}] ${name}: ${json}`, ...this.eventLog.slice(0, 49)];
  }
}

export const ExcelKeyboard: Story = {
  name: 'Excel Keyboard Shortcuts',
  render: () => ({
    props: {},
    template: `<moz-story-excel-keyboard />`,
    moduleMetadata: {
      imports: [ExcelKeyboardWrapperComponent],
    },
  }),
  parameters: {
    docs: {
      description: {
        story:
          'End-to-end demo of the Excel-like keyboard layer: navigation (Ctrl+arrow jump, Home/End, PageUp/Down, Tab, Enter), selection (Shift+arrow, Ctrl+A, Shift/Ctrl+Space), editing (typing-to-edit on every editor type, Backspace/Delete to clear, Alt+Enter for a newline, Ctrl+Enter to fill the selection), clipboard (Ctrl+C/X/V with marching-ants on cut, Ctrl+D/R to fill), and history (Ctrl+Z/Y, persisted in localStorage via `stateKey`).',
      },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Empty state stories
// ─────────────────────────────────────────────────────────────────────────────
