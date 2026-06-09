import type { Meta, StoryObj } from '@storybook/angular';
import { AdGridAngularComponent } from '../grid';
import { Product, PRODUCTS_100, GRID_WRAPPER, baseMeta } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Data Display/Grid/Columns',
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const WithColumnResize: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Drag the right edge of column headers to resize columns.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" [resizable]="true" minWidth="50" maxWidth="150" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" [resizable]="true" minWidth="100" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" [sortable]="true" [resizable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" [resizable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" [resizable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" [resizable]="true" />
        </ad-grid-angular>
      </div>
    `,
  }),
};

export const WithColumnReorder: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Drag column headers to reorder them.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20" [reorderable]="true">
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

export const WithCustomCellTemplate: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          The "Statut" column uses a custom cell template with colored badges.
          The "Prix" column uses a custom cell template with formatted currency.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" [sortable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" />

          <ad-grid-column-def field="price" headerName="Prix (€)" width="140" [sortable]="true">
            <ng-template #cell let-value let-row="row">
              <span style="font-weight: 600; color: var(--color-background-accent-inverse);">
                {{ value.toFixed(2) }} €
              </span>
            </ng-template>
          </ad-grid-column-def>

          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" />
          <ad-grid-column-def field="supplier" headerName="Fournisseur" width="150" [sortable]="true" />

          <ad-grid-column-def field="status" headerName="Statut" width="150" [sortable]="true">
            <ng-template #cell let-value>
              <span [style.padding]="'2px 8px'"
                    [style.border-radius]="'4px'"
                    [style.font-size]="'12px'"
                    [style.font-weight]="'600'"
                    [style.background]="value === 'En stock' ? '#d4edda' : value === 'Rupture' ? '#f8d7da' : value === 'En commande' ? '#fff3cd' : '#e2e3e5'"
                    [style.color]="value === 'En stock' ? '#155724' : value === 'Rupture' ? '#721c24' : value === 'En commande' ? '#856404' : '#383d41'">
                {{ value }}
              </span>
            </ng-template>
          </ad-grid-column-def>
        </ad-grid-angular>
      </div>
    `,
  }),
};

export const WithColumnFreeze: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Click the settings icon on a column header, then select "Freeze left" or "Freeze right" to pin columns.
          Scroll horizontally to see pinned columns stay in place.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20">
          <ad-grid-column-def field="id" headerName="ID" width="120" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="250" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="reference" headerName="Référence" width="220" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="200" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="180" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="150" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="supplier" headerName="Fournisseur" width="220" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="status" headerName="Statut" width="180" [sortable]="true" [freezable]="true" />
        </ad-grid-angular>
      </div>
    `,
  }),
};
