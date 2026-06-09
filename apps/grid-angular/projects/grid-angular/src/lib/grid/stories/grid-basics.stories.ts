import type { Meta, StoryObj } from '@storybook/angular';
import { ChangeDetectionStrategy, Component, computed, signal, viewChild, afterNextRender } from '@angular/core';
import { AdGridAngularComponent } from '../grid';
import { AdeoGridColumnDef } from '../directives/grid-column-def';
import { AdeoGridToolbarDef } from '../directives/grid-toolbar-def';
import { MozButtonComponent, MozComboboxComponent } from '@mozaic-ds/angular';
import { GridStateManager } from '../state/grid-state';
import { Product, generateProducts, PRODUCTS_100, PRODUCTS_1000, GRID_WRAPPER, baseMeta } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Data Display/Grid/Basics',
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const Default: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" [sortable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" />
          <ad-grid-column-def field="supplier" headerName="Fournisseur" width="150" [sortable]="true" />
          <ad-grid-column-def field="status" headerName="Statut" width="130" [sortable]="true" />
        </ad-grid-angular>
      </div>
    `,
  }),
};

export const LargeDataset: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_1000,
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="50">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" [sortable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" />
          <ad-grid-column-def field="supplier" headerName="Fournisseur" width="150" [sortable]="true" />
          <ad-grid-column-def field="status" headerName="Statut" width="130" [sortable]="true" />
        </ad-grid-angular>
      </div>
    `,
  }),
};

export const NoPagination: Story = {
  render: () => ({
    props: {
      data: generateProducts(30),
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <ad-grid-angular [data]="data" [pagination]="false">
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

export const ManyColumns: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
      onBulk: (type: string, e: unknown) => console.log(`[ManyColumns] ${type}:`, e),
    },
    template: `
      <div [style]="gridWrapper">
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20"
                   [rowSelection]="true" [reorderable]="true"
                   (bulkCopy)="onBulk('copy', $event)"
                   (bulkPaste)="onBulk('paste', $event)"
                   (bulkDelete)="onBulk('delete', $event)">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" [editable]="true" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" [sortable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" [editable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" [editable]="true" />
          <ad-grid-column-def field="supplier" headerName="Fournisseur" width="150" [sortable]="true" />
          <ad-grid-column-def field="status" headerName="Statut" width="130" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom 2" width="180" />
          <ad-grid-column-def field="reference" headerName="Réf 2" width="140" />
          <ad-grid-column-def field="category" headerName="Cat 2" width="140" />
          <ad-grid-column-def field="price" headerName="Prix 2" width="110" />
          <ad-grid-column-def field="stock" headerName="Stock 2" width="100" />
          <ad-grid-column-def field="supplier" headerName="Fourn 2" width="140" />
          <ad-grid-column-def field="status" headerName="Statut 2" width="120" />
          <ad-grid-column-def field="name" headerName="Nom 3" width="180" />
          <ad-grid-column-def field="reference" headerName="Réf 3" width="140" />
          <ad-grid-column-def field="category" headerName="Cat 3" width="140" />
          <ad-grid-column-def field="price" headerName="Prix 3" width="110" />
          <ad-grid-column-def field="stock" headerName="Stock 3" width="100" />
          <ad-grid-column-def field="supplier" headerName="Fourn 3" width="140" />
          <ad-grid-column-def field="status" headerName="Statut 3" width="120" />
          <ad-grid-column-def field="name" headerName="Nom 4" width="180" />
          <ad-grid-column-def field="reference" headerName="Réf 4" width="140" />
          <ad-grid-column-def field="category" headerName="Cat 4" width="140" />
          <ad-grid-column-def field="price" headerName="Prix 4" width="110" />
          <ad-grid-column-def field="stock" headerName="Stock 4" width="100" />
          <ad-grid-column-def field="supplier" headerName="Fourn 4" width="140" />
          <ad-grid-column-def field="status" headerName="Statut 4" width="120" />
          <ad-grid-column-def field="id" headerName="ID Final" width="80" />
          <ad-grid-column-def field="name" headerName="Nom Final" width="200" />
        </ad-grid-angular>
      </div>
    `,
  }),
};

@Component({
  selector: 'moz-story-full-featured',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdGridAngularComponent,
    AdeoGridColumnDef,
    AdeoGridToolbarDef,
    MozButtonComponent,
    MozComboboxComponent,
  ],
  template: `
    <div style="display: flex; flex-direction: column; height: 800px; gap: 8px;">
      <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        <ad-grid-angular
          #grid
          [data]="data()"
          [pagination]="true"
          [pageSize]="20"
          [pageSizeOptions]="[10, 20, 50, 100]"
          [rowSelection]="true"
          [expandable]="true"
          rowIdField="id"
          [detailTemplate]="detailTpl"
          [fullscreen]="true"
          [exportable]="true"
          [reorderable]="true"

          stateKey="full-featured-demo"
          (sortChange)="logEvent('sortChange', $event)"
          (pageChange)="logEvent('pageChange', $event)"
          (cellEdit)="logEvent('cellEdit', $event)"
          (cellEditCancel)="logEvent('cellEditCancel', $event)"
          (selectionChange)="logEvent('selectionChange', $event)"
          (cellSelectionChange)="logEvent('cellSelectionChange', $event)"
          (groupChange)="logEvent('groupChange', $event)"
          (filterChange)="logEvent('filterChange', $event)"
          (bulkEdit)="logEvent('bulkEdit', $event)"
          (bulkCopy)="logEvent('bulkCopy', $event)"
          (bulkPaste)="logEvent('bulkPaste', $event)"
          (bulkDelete)="logEvent('bulkDelete', $event)"
          (fillDown)="logEvent('fillDown', $event)"
          (settingsChange)="logEvent('settingsChange', $event)"
        >
          <!-- Custom toolbar action -->
          <ng-template mozGridToolbarDef="start">
            <button moz-button [outlined]="true" size="s">Custom action</button>
          </ng-template>
          <ng-template mozGridToolbarDef="end">
            <button moz-button [ghost]="true" size="s">Help</button>
          </ng-template>

          <!-- Frozen left: ID -->
          <ad-grid-column-def
            field="id"
            headerName="ID"
            width="80"
            [sortable]="true"
            [resizable]="true"
            [freezable]="true"
            [pinned]="'start'"
          />

          <!-- Editable text -->
          <ad-grid-column-def
            field="name"
            headerName="Nom"
            width="200"
            [sortable]="true"
            [resizable]="true"
            [editable]="true"
            [freezable]="true"
            [filterable]="true"
            [cellValidator]="nameValidator"
          >
            <ng-template #filter>
              <input
                type="text"
                placeholder="Rechercher..."
                [value]="nameFilter()"
                (input)="onNameFilter($event)"
                style="width: 100%; height: 28px; border: 1px solid #dee2e6; border-radius: 4px; padding: 0 8px; font-size: 12px; box-sizing: border-box;"
              />
            </ng-template>
          </ad-grid-column-def>

          <!-- Reference -->
          <ad-grid-column-def
            field="reference"
            headerName="Référence"
            width="150"
            [sortable]="true"
            [resizable]="true"
            [freezable]="true"
            [filterable]="true"
          />

          <!-- Select editor + groupable -->
          <ad-grid-column-def
            field="category"
            headerName="Catégorie"
            width="180"
            [sortable]="true"
            [resizable]="true"
            [editable]="true"
            cellEditor="select"
            [cellEditorOptions]="categoryOptions"
            [groupable]="true"
            [freezable]="true"
            [filterable]="true"
          >
            <ng-template #filter>
              <select
                (change)="onCategoryFilter($event)"
                style="width: 100%; height: 28px; border: 1px solid #dee2e6; border-radius: 4px; padding: 0 4px; font-size: 12px; box-sizing: border-box; background: #fff;"
              >
                <option value="">Toutes</option>
                @for (cat of categories; track cat) {
                <option [value]="cat">{{ cat }}</option>
                }
              </select>
            </ng-template>
          </ad-grid-column-def>

          <!-- Number editor + custom cell template + validator -->
          <ad-grid-column-def
            field="price"
            headerName="Prix (€)"
            width="140"
            [sortable]="true"
            [resizable]="true"
            [editable]="true"
            cellEditor="number"
            [freezable]="true"
            [cellValidator]="priceValidator"
          >
            <ng-template #cell let-value>
              <span style="font-weight: 600; color: var(--color-background-accent-inverse);">
                {{ value?.toFixed(2) }} €
              </span>
            </ng-template>
          </ad-grid-column-def>

          <!-- Number editor -->
          <ad-grid-column-def
            field="stock"
            headerName="Stock"
            width="100"
            [sortable]="true"
            [resizable]="true"
            [editable]="true"
            cellEditor="number"
            [freezable]="true"
            [cellValidator]="stockValidator"
          />

          <!-- Groupable -->
          <ad-grid-column-def
            field="supplier"
            headerName="Fournisseur"
            width="150"
            [sortable]="true"
            [resizable]="true"
            [groupable]="true"
            [freezable]="true"
            [filterable]="true"
          />

          <!-- Custom cell template + custom edit template + groupable -->
          <ad-grid-column-def
            field="status"
            headerName="Statut"
            width="160"
            [sortable]="true"
            [resizable]="true"
            [editable]="true"
            cellEditor="custom"
            [groupable]="true"
            [freezable]="true"
          >
            <ng-template #cell let-value>
              <span
                [style.padding]="'2px 8px'"
                [style.border-radius]="'4px'"
                [style.font-size]="'12px'"
                [style.font-weight]="'600'"
                [style.background]="
                  value === 'En stock'
                    ? '#d4edda'
                    : value === 'Rupture'
                    ? '#f8d7da'
                    : value === 'En commande'
                    ? '#fff3cd'
                    : '#e2e3e5'
                "
                [style.color]="
                  value === 'En stock'
                    ? '#155724'
                    : value === 'Rupture'
                    ? '#721c24'
                    : value === 'En commande'
                    ? '#856404'
                    : '#383d41'
                "
              >
                {{ value }}
              </span>
            </ng-template>
            <ng-template #edit let-value let-updateDraft="updateDraft" let-commitEdit="commitEdit">
              <div style="display: flex; gap: 4px; padding: 2px 0;">
                @for (s of statuses; track s) {
                <button
                  type="button"
                  (click)="updateDraft(s); commitEdit()"
                  [style.padding]="'2px 8px'"
                  [style.border-radius]="'4px'"
                  [style.border]="'1px solid #dee2e6'"
                  [style.background]="s === value ? '#1a73e8' : '#fff'"
                  [style.color]="s === value ? '#fff' : '#333'"
                  [style.font-size]="'11px'"
                  [style.cursor]="'pointer'"
                  [style.font-weight]="'500'"
                >
                  {{ s }}
                </button>
                }
              </div>
            </ng-template>
          </ad-grid-column-def>

          <!-- Checkbox editor — hidden by default -->
          <ad-grid-column-def
            field="available"
            headerName="Disponible"
            width="120"
            [sortable]="true"
            [resizable]="true"
            [editable]="true"
            cellEditor="checkbox"
            [freezable]="true"
            [visible]="false"
          />

          <!-- Date editor — hidden by default -->
          <ad-grid-column-def
            field="lastUpdated"
            headerName="Dernière MAJ"
            width="160"
            [sortable]="true"
            [resizable]="true"
            [editable]="true"
            cellEditor="date"
            [freezable]="true"
            [visible]="false"
          />
        </ad-grid-angular>
      </div>

      <!-- Detail template -->
      <ng-template #detailTpl let-row>
        <div
          style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 16px; background: #f8f9fa; border-bottom: 1px solid #dee2e6;"
        >
          <div>
            <div
              style="font-size: 11px; color: #6c757d; text-transform: uppercase; margin-bottom: 4px;"
            >
              Produit
            </div>
            <div style="font-weight: 600;">{{ row.name }}</div>
            <div style="font-size: 13px; color: #6c757d;">{{ row.reference }}</div>
          </div>
          <div>
            <div
              style="font-size: 11px; color: #6c757d; text-transform: uppercase; margin-bottom: 4px;"
            >
              Catégorie
            </div>
            <div>{{ row.category }}</div>
            <div style="font-size: 13px; color: #6c757d;">{{ row.supplier }}</div>
          </div>
          <div>
            <div
              style="font-size: 11px; color: #6c757d; text-transform: uppercase; margin-bottom: 4px;"
            >
              Prix & Stock
            </div>
            <div style="font-weight: 600; color: #1a73e8;">{{ row.price.toFixed(2) }} €</div>
            <div>
              <span
                [style.color]="row.stock > 100 ? '#155724' : row.stock > 0 ? '#856404' : '#721c24'"
              >
                {{ row.stock }} unités
              </span>
            </div>
          </div>
          <div>
            <div
              style="font-size: 11px; color: #6c757d; text-transform: uppercase; margin-bottom: 4px;"
            >
              Statut
            </div>
            <span
              [style.padding]="'2px 8px'"
              [style.border-radius]="'4px'"
              [style.font-size]="'12px'"
              [style.background]="
                row.status === 'En stock'
                  ? '#d4edda'
                  : row.status === 'Rupture'
                  ? '#f8d7da'
                  : '#fff3cd'
              "
              [style.color]="
                row.status === 'En stock'
                  ? '#155724'
                  : row.status === 'Rupture'
                  ? '#721c24'
                  : '#856404'
              "
            >
              {{ row.status }}
            </span>
            <div style="font-size: 13px; color: #6c757d; margin-top: 4px;">
              MAJ: {{ row.lastUpdated }}
            </div>
          </div>
        </div>
      </ng-template>

      <!-- Event log -->
      <div
        style="height: 180px; border: 1px solid var(--color-border-primary, #dee2e6); border-radius: 4px; background: #1e1e1e; overflow-y: auto; font-family: monospace; font-size: 12px; padding: 8px;"
      >
        <div style="color: #6c757d; margin-bottom: 4px; font-weight: 600;">Event Log</div>
        @for (entry of eventLog; track $index) {
        <div style="color: #a8d8a8; padding: 2px 0; word-break: break-all; white-space: pre-wrap;">
          {{ entry }}
        </div>
        } @if (eventLog.length === 0) {
        <div style="color: #6c757d; font-style: italic;">
          Interact with the grid to see events here...
        </div>
        }
      </div>
    </div>
  `,
})
class FullFeaturedWrapperComponent {
  private readonly grid = viewChild<AdGridAngularComponent<Product>>('grid');

  private readonly allData = PRODUCTS_1000;
  private readonly nameFilter = signal('');
  private readonly categoryFilter = signal('');
  eventLog: string[] = [];

  readonly data = computed(() => {
    const name = this.nameFilter().toLowerCase();
    const cat = this.categoryFilter();
    if (!name && !cat) return this.allData;
    return this.allData.filter((p) => {
      if (name && !p.name.toLowerCase().includes(name)) return false;
      if (cat && p.category !== cat) return false;
      return true;
    });
  });

  readonly categories = [
    'Peinture',
    'Outillage',
    'Plomberie',
    'Électricité',
    'Jardin',
    'Revêtement',
    'Quincaillerie',
    'Menuiserie',
  ];
  readonly statuses = ['En stock', 'Rupture', 'En commande', 'Limité'];

  readonly categoryOptions = this.categories.map((c) => ({ text: c, value: c }));

  // Validators
  readonly nameValidator = (value: unknown): { message: string } | null => {
    if (!value || String(value).trim() === '') return { message: 'Le nom est obligatoire' };
    if (String(value).length < 3) return { message: 'Min. 3 caractères' };
    return null;
  };

  readonly priceValidator = (value: unknown): { message: string } | null => {
    const num = Number(value);
    if (isNaN(num) || num <= 0) return { message: 'Prix positif requis' };
    if (num > 10000) return { message: 'Max 10 000 €' };
    return null;
  };

  readonly stockValidator = (value: unknown): { message: string } | null => {
    const num = Number(value);
    if (isNaN(num) || num < 0) return { message: 'Stock >= 0' };
    return null;
  };

  constructor() {
    // Apply default grouping by "supplier" after columns are initialized
    afterNextRender(() => {
      const gridRef = this.grid();
      if (!gridRef) return;
      // Access the component-level GridStateManager via the grid's injector
      const state = gridRef['state'] as GridStateManager<Product>;
      // Set default group
      state.groupColumns.set([{ field: 'supplier', sortDirection: 'asc' }]);
    });
  }

  onNameFilter(event: Event): void {
    this.nameFilter.set((event.target as HTMLInputElement).value);
  }

  onCategoryFilter(event: Event): void {
    this.categoryFilter.set((event.target as HTMLSelectElement).value);
  }

  logEvent(name: string, detail: unknown): void {
    const ts = new Date().toLocaleTimeString();
    const json = JSON.stringify(detail, null, 0);
    this.eventLog = [`[${ts}] ${name}: ${json}`, ...this.eventLog.slice(0, 49)];
  }
}

export const FullFeatured: Story = {
  render: () => ({
    props: {},
    template: `<moz-story-full-featured />`,
    moduleMetadata: {
      imports: [FullFeaturedWrapperComponent],
    },
  }),
};

export const NoToolbar: Story = {
  render: () => ({
    props: {
      data: generateProducts(30),
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20" [showToolbar]="false">
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
