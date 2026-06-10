import type { Meta, StoryObj } from '@storybook/angular';
import { AdGridAngularComponent } from '../grid';
import { Product, PRODUCTS_100, GRID_WRAPPER, baseMeta } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Stories/Export/CSV — client & server',
  parameters: {
    ...baseMeta.parameters,
    docs: {
      description: {
        component: `
# Export

\`[exportable]="true"\` ajoute le bouton « Export CSV » à la toolbar. Deux modes :

- **\`exportMode="client"\`** (défaut) — l'\`ExportEngine\` sérialise la vue courante (colonnes visibles, tri et filtres appliqués) en CSV et déclenche le téléchargement
- **\`exportMode="server"\`** — la grille ne produit pas de fichier : elle émet \`(exportRequest)\` avec les descripteurs de la vue active, à transmettre à votre endpoint d'export

\`\`\`ts
interface GridExportEvent {
  format: 'csv';
  sorts: SortDef[];         // tris actifs au moment de l'export
  filterModel: FilterModel; // filtres actifs
  columns: string[];        // champs visibles, dans l'ordre d'affichage
}
\`\`\`
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const WithExport: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Export client : le CSV reflète la **vue courante** — colonnes masquées exclues, lignes triées/filtrées comme à l’écran. La sélection de lignes peut aussi être exportée depuis la selection bar.',
      },
    },
  },
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
