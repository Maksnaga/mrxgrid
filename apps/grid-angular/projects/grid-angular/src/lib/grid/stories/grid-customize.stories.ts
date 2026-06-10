import type { Meta, StoryObj } from '@storybook/angular';
import { AdGridAngularComponent } from '../grid';
import { GridPlugin } from '../models/plugin.model';
import { Product, PRODUCTS_100, generateProducts, GRID_WRAPPER, baseMeta } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Stories/Customization/Persist, Plugins, Undo-redo',
  parameters: {
    ...baseMeta.parameters,
    docs: {
      description: {
        component: `
# Customization

Personnalisation du comportement de la grille au-delà des colonnes :

- **Persisted layout** — \`[persistKey]\` sauvegarde largeurs, ordre, visibilité, pin, tris et filtres dans \`localStorage\`, restaurés au prochain mount
- **Undo / Redo** — chaque mutation (édition, paste, fill, delete) est enregistrée par le \`HistoryEngine\` ; \`Ctrl+Z\` / \`Ctrl+Y\` naviguent dans l'historique (persisté avec \`persistKey\`, 50 ops max)
- **Plugins** — \`[plugins]\` reçoit des objets \`GridPlugin\` ; chaque plugin reçoit \`{ state, engine }\` à l'init et peut retourner un disposer
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const PersistedLayout: Story = {
  parameters: {
    docs: {
      description: {
        story: `
\`[persistKey]\` active la persistance du layout dans \`localStorage\` : largeurs de colonnes, ordre, visibilité, colonnes pinnées, tris et filtres. Redimensionnez une colonne, triez, masquez une colonne via le menu — puis **rechargez la page** : l'état est restauré.
        `,
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
          Redimensionne, réordonne, trie ou masque des colonnes, puis recharge la page :
          le layout est restauré depuis <code>localStorage</code>.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20"
                   persistKey="sb-grid-persisted-layout" [reorderable]="true">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" [filterable]="true" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" [sortable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" [filterable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" />
          <ad-grid-column-def field="supplier" headerName="Fournisseur" width="150" [sortable]="true" />
          <ad-grid-column-def field="status" headerName="Statut" width="130" [sortable]="true" />
        </ad-grid-angular>
      </div>
    `,
  }),
};

export const UndoRedo: Story = {
  parameters: {
    docs: {
      description: {
        story: `
Chaque mutation de cellule (édition inline, paste, fill, delete) est enregistrée dans l'historique. \`Ctrl+Z\` annule, \`Ctrl+Y\` / \`Ctrl+Shift+Z\` rétablit. Avec \`persistKey\`, l'historique survit au reload (50 opérations max, dans \`localStorage\`).
        `,
      },
    },
  },
  render: () => ({
    props: {
      data: generateProducts(30),
      gridWrapper: GRID_WRAPPER,
      onCellEdit: (event: unknown) => console.log('cellEdit:', event),
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Édite quelques cellules (double-click ou Enter), puis <kbd>Ctrl+Z</kbd> pour annuler
          et <kbd>Ctrl+Y</kbd> pour rétablir. Marche aussi après un paste, un fill ou un delete.
        </p>
        <ad-grid-angular [data]="data" [pagination]="false"
                   persistKey="sb-grid-undo-redo"
                   (cellEdit)="onCellEdit($event)">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" [editable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" [editable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" [editable]="true" cellEditor="number" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" [editable]="true" cellEditor="number" />
        </ad-grid-angular>
      </div>
    `,
  }),
};

// Demo plugin: logs the grid shape at init and proves the disposer contract.
const auditPlugin: GridPlugin<Product> = {
  name: 'audit-log',
  init: ({ state }) => {
    console.log(
      `[audit-log] grid initialised — ${state.sourceData().length} rows, ` +
        `${state.columnStates().length} columns`,
    );
    return () => console.log('[audit-log] grid destroyed, plugin disposed');
  },
};

// Demo plugin: pre-sorts the grid by price descending at init.
const defaultSortPlugin: GridPlugin<Product> = {
  name: 'default-sort',
  init: ({ state }) => {
    state.activeSorts.set([{ field: 'price', direction: 'desc', priority: 0 }]);
    console.log('[default-sort] applied initial sort: price desc');
  },
};

export const Plugins: Story = {
  parameters: {
    docs: {
      description: {
        story: `
\`[plugins]\` accepte un tableau de \`GridPlugin\` :

\`\`\`ts
const auditPlugin: GridPlugin<Product> = {
  name: 'audit-log',
  init: ({ state, engine }) => {
    console.log(\`\${state.sourceData().length} rows\`);
    return () => console.log('disposed'); // appelé au ngOnDestroy
  },
};
\`\`\`

Le contexte donne accès au \`GridStateManager\` (signals : data, colonnes, tris, filtres…) et au \`GridEngine\` (pipeline dérivé). Ouvrez la console : les deux plugins de la démo loggent leur init, et \`default-sort\` pré-trie la grille par prix décroissant.
        `,
      },
    },
  },
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
      plugins: [auditPlugin, defaultSortPlugin],
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Deux plugins sont branchés : <code>audit-log</code> (logge l'init et le dispose dans la console)
          et <code>default-sort</code> (pré-trie par prix décroissant).
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20" [plugins]="plugins">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" />
        </ad-grid-angular>
      </div>
    `,
  }),
};
