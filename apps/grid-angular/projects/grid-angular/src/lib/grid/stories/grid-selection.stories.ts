import type { Meta, StoryObj } from '@storybook/angular';
import { AdGridAngularComponent } from '../grid';
import { Product, generateProducts, PRODUCTS_100, GRID_WRAPPER, baseMeta } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Data Display/Grid/Selection',
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const WithRowSelection: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      onSelectionChange: (event: unknown) => console.log('Selection changed:', event),
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20"
                   [rowSelection]="true"
                   (selectionChange)="onSelectionChange($event)">
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

export const WithCellSelection: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Click a cell to focus it. Use arrow keys to navigate. Shift+arrow to extend range. Enter/F2 to edit. Escape to clear.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" [editable]="true" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" [sortable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" [editable]="true" cellEditor="number" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" [editable]="true" cellEditor="number" />
          <ad-grid-column-def field="supplier" headerName="Fournisseur" width="150" [sortable]="true" />
          <ad-grid-column-def field="status" headerName="Statut" width="130" [sortable]="true" />
        </ad-grid-angular>
      </div>
    `,
  }),
};

export const NoMultiCellSelection: Story = {
  render: () => ({
    props: {
      data: generateProducts(30),
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20" [multiCellSelection]="false">
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

export const NoMultiCellSelectionWithRowSelection: Story = {
  render: () => ({
    props: {
      data: generateProducts(30),
      gridWrapper: GRID_WRAPPER,
      onSelectionChange: (event: unknown) => console.log('Selection changed:', event),
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Row selection is enabled while multi-cell selection is disabled.
        </p>
        <ad-grid-angular
          [data]="data"
          [pagination]="true"
          [pageSize]="20"
          [rowSelection]="true"
          [multiCellSelection]="false"
          (selectionChange)="onSelectionChange($event)"
        >
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
