import type { Meta, StoryObj } from '@storybook/angular';
import { AdGridAngularComponent } from '../grid';
import { Product, PRODUCTS_100, GRID_WRAPPER, baseMeta } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Data Display/Grid/Rows & Grouping',
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const WithGrouping: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      onGroupChange: (event: unknown) => console.log('Group changed:', event),
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Click the settings icon on a column header, then select "Group by this column" to group rows.
          Remove groups by clicking the × on the group tag.
        </p>
        <ad-grid-angular [data]="data" [pagination]="false"
                   (groupChange)="onGroupChange($event)">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" [filterable]="true" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" [sortable]="true" [filterable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" [groupable]="true" [filterable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" [filterable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" />
          <ad-grid-column-def field="supplier" headerName="Fournisseur" width="150" [sortable]="true" [groupable]="true" [filterable]="true" />
          <ad-grid-column-def field="status" headerName="Statut" width="130" [sortable]="true" [groupable]="true" [filterable]="true" />
        </ad-grid-angular>
      </div>
    `,
  }),
};

export const WithExpandableRows: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Click the chevron on the left of each row to expand it and show details.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20"
                   [expandable]="true" rowIdField="id">
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

export const FreezeAndExpand: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Freeze columns (pin left/right via column menu) then expand rows — detail rows should span full width.
          Scroll horizontally to verify pinned columns stay in place.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20"
                   [expandable]="true" rowIdField="id" [rowSelection]="true" [detailTemplate]="detailTpl2">
          <ad-grid-column-def field="id" headerName="ID" width="120" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="250" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="reference" headerName="Référence" width="220" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="200" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="180" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="150" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="supplier" headerName="Fournisseur" width="220" [sortable]="true" [freezable]="true" />
          <ad-grid-column-def field="status" headerName="Statut" width="180" [sortable]="true" [freezable]="true" />
        </ad-grid-angular>

        <ng-template #detailTpl2 let-row>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 16px; background: #f8f9fa; border-bottom: 1px solid #dee2e6;">
            <div>
              <div style="font-size: 11px; color: #6c757d; text-transform: uppercase; margin-bottom: 4px;">Produit</div>
              <div style="font-weight: 600;">{{ row.name }}</div>
              <div style="font-size: 13px; color: #6c757d;">{{ row.reference }}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #6c757d; text-transform: uppercase; margin-bottom: 4px;">Catégorie & Fournisseur</div>
              <div>{{ row.category }}</div>
              <div style="font-size: 13px; color: #6c757d;">{{ row.supplier }}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #6c757d; text-transform: uppercase; margin-bottom: 4px;">Prix & Stock</div>
              <div style="font-weight: 600; color: #1a73e8;">{{ row.price.toFixed(2) }} €</div>
              <div>{{ row.stock }} unités — {{ row.status }}</div>
            </div>
          </div>
        </ng-template>
      </div>
    `,
  }),
};

export const WithCustomExpandDetail: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Click the chevron to expand a row and see a custom detail panel with product info.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20"
                   [expandable]="true" rowIdField="id" [detailTemplate]="detailTpl">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" [sortable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" />
        </ad-grid-angular>

        <ng-template #detailTpl let-row>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 16px; background: #f8f9fa; border-bottom: 1px solid #dee2e6">
            <div>
              <div style="font-size: 11px; color: #6c757d; text-transform: uppercase; margin-bottom: 4px;">Produit</div>
              <div style="font-weight: 600;">{{ row.name }}</div>
              <div style="font-size: 13px; color: #6c757d;">{{ row.reference }}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #6c757d; text-transform: uppercase; margin-bottom: 4px;">Catégorie & Fournisseur</div>
              <div>{{ row.category }}</div>
              <div style="font-size: 13px; color: #6c757d;">{{ row.supplier }}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #6c757d; text-transform: uppercase; margin-bottom: 4px;">Prix & Stock</div>
              <div style="font-weight: 600; color: #1a73e8;">{{ row.price.toFixed(2) }} €</div>
              <div>
                <span [style.color]="row.stock > 100 ? '#155724' : row.stock > 0 ? '#856404' : '#721c24'">
                  {{ row.stock }} unités
                </span>
                —
                <span [style.padding]="'1px 6px'" [style.border-radius]="'3px'" [style.font-size]="'11px'"
                      [style.background]="row.status === 'En stock' ? '#d4edda' : row.status === 'Rupture' ? '#f8d7da' : '#fff3cd'"
                      [style.color]="row.status === 'En stock' ? '#155724' : row.status === 'Rupture' ? '#721c24' : '#856404'">
                  {{ row.status }}
                </span>
              </div>
            </div>
          </div>
        </ng-template>
      </div>
    `,
  }),
};
