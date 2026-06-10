import type { Meta, StoryObj } from '@storybook/angular';
import { AdGridAngularComponent } from '../grid';
import {
  Product,
  generateProducts,
  GRID_WRAPPER,
  baseMeta,
  WIDE_COL_COUNT,
  WIDE_ROWS,
  WIDE_COLS,
} from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Stories/Virtual Scroll/Vertical, Horizontal',
  parameters: {
    ...baseMeta.parameters,
    docs: {
      description: {
        component: `
# Virtual Scroll

Virtualisation bi-axiale — seules les cellules visibles dans le viewport (+ buffer) existent dans le DOM :

- **Vertical** — toujours actif : un spacer height-based préserve la hauteur de scrollbar (pas de \`translateY\`, qui créerait un containing block et piégerait les colonnes \`position: sticky\`)
- **Horizontal** — activé automatiquement au-delà d'un seuil de colonnes : des spacers dimensionnés comblent les colonnes hors-champ, les colonnes pinnées restent rendues en permanence

Les deux axes se combinent pour les très gros datasets (100k+ lignes × 150+ colonnes).
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const VerticalVirtualScroll: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Sans pagination, la grille rend uniquement les lignes visibles dans le viewport (+ buffer) via le `VerticalVirtualScrollEngine` — ici 5 000 lignes scrollent sans dégradation. Combine avec le scroll horizontal virtualisé pour les très larges datasets.',
      },
    },
  },
  render: () => ({
    props: {
      data: generateProducts(5000),
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          5 000 lignes, pas de pagination : seules les lignes visibles sont dans le DOM.
          Le scroll reste fluide et la sélection/édition fonctionnent normalement.
        </p>
        <ad-grid-angular [data]="data" [pagination]="false">
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

export const HorizontalVirtualScroll: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Au-delà d’un seuil de colonnes, le `HorizontalVirtualScrollEngine` ne rend que les colonnes visibles dans le viewport (+ buffer) ; des spacers dimensionnés comblent les colonnes hors-champ pour garder une scrollbar exacte. Les colonnes pinnées restent rendues en permanence. Resize, reorder, filtres et navigation clavier restent fonctionnels.',
      },
    },
  },
  render: () => ({
    props: {
      data: WIDE_ROWS,
      cols: WIDE_COLS,
    },
    template: `
      <div style="${GRID_WRAPPER}">
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #555;">
          ${WIDE_COL_COUNT} colonnes × ${WIDE_ROWS.length} lignes. Seules les colonnes
          visibles dans le viewport (+ buffer) sont rendues dans les lignes.
          Resize, reorder, filter et keyboard navigation restent fonctionnels.
        </p>
        <ad-grid-angular
          [data]="data"
          [pagination]="false"

          [reorderable]="true"
        >
          <ad-grid-column-def field="id" headerName="ID" width="80" [pinned]="'start'" />
          @for (field of cols; track field) {
            <ad-grid-column-def
              [field]="field"
              [headerName]="field.toUpperCase()"
              width="140"
              [resizable]="true"
            />
          }
        </ad-grid-angular>
      </div>
    `,
  }),
};
