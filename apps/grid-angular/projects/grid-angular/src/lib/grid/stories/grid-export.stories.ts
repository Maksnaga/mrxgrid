import type { Meta, StoryObj } from '@storybook/angular';
import { AdGridAngularComponent } from '../grid';
import { Product, PRODUCTS_100, GRID_WRAPPER, baseMeta } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Data Display/Grid/Export',
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const WithExport: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Click the "Export CSV" button in the toolbar to download the grid data as a CSV file.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20" [exportable]="true">
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
