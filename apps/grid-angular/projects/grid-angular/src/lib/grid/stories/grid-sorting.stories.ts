import type { Meta, StoryObj } from '@storybook/angular';
import { AdGridAngularComponent } from '../grid';
import { Product, PRODUCTS_100, GRID_WRAPPER, baseMeta } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Stories/Sorting/Single, Multi, Custom comparator',
  parameters: {
    ...baseMeta.parameters,
    docs: {
      description: {
        component: `
# Sorting

Le tri est piloté par \`[sortable]="true"\` sur \`ad-grid-column-def\` + une *sort stack* maintenue par le \`SortEngine\`. Trois variantes :

- **Single** — click sur le header, cycle asc → desc → unsort
- **Multi-column** — \`[multiSort]="true"\` sur la grille, puis \`Shift+click\` empile dans la stack ; l'ordre = priorité
- **Custom comparator** — \`[sortComparator]\` sur la colonne pour les ordres non-lexicaux (grades A→G, locales, statuts métier)

Chaque changement émet \`(sortChange)\` avec la stack courante.
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const SingleColumn: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Click sur un header avec `[sortable]=\"true\"` → asc → desc → unsort. L'indicateur de tri s'affiche dans le header et la grille re-trie réactivement.",
      },
    },
  },
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
      onSortChange: (event: unknown) => console.log('sortChange:', event),
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Click sur un header pour trier : asc → desc → unsort.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20"
                   (sortChange)="onSortChange($event)">
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

export const MultiColumn: Story = {
  parameters: {
    docs: {
      description: {
        story: `
Avec \`[multiSort]="true"\`, \`Shift+click\` sur un header **empile** la colonne dans la sort stack au lieu de remplacer. L'ordre d'empilement = priorité (premier ajouté → tri primaire, suivants → tie-breakers). Un badge numéroté sur chaque header trié indique sa priorité.
        `,
      },
    },
  },
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
      onSortChange: (event: unknown) => console.log('sortChange:', event),
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Essaie : <kbd>Shift</kbd>+click sur <code>Catégorie</code>, puis <kbd>Shift</kbd>+click sur <code>Prix (€)</code>.
          Le badge numéroté indique la priorité de chaque colonne dans la stack.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20" [multiSort]="true"
                   (sortChange)="onSortChange($event)">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" />
          <ad-grid-column-def field="supplier" headerName="Fournisseur" width="150" [sortable]="true" />
        </ad-grid-angular>
      </div>
    `,
  }),
};

// Domain order for the demo: best availability first — alphabetical sorting
// would interleave "En commande" between "En stock" and "Limité".
const STATUS_ORDER = ['En stock', 'Limité', 'En commande', 'Rupture'];

export const CustomComparator: Story = {
  parameters: {
    docs: {
      description: {
        story: `
Pour les ordres non-lexicaux, passez \`[sortComparator]\` à la colonne : \`(a, b) => number\` reçoit les **lignes complètes** et définit toujours l'ordre ascendant — le sens (asc/desc) est appliqué par-dessus par l'engine.

\`\`\`ts
const STATUS_ORDER = ['En stock', 'Limité', 'En commande', 'Rupture'];
statusComparator = (a: Product, b: Product) =>
  STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
\`\`\`
        `,
      },
    },
  },
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
      statusComparator: (a: Product, b: Product) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          La colonne <code>Statut</code> trie selon l'ordre métier
          <code>En stock → Limité → En commande → Rupture</code> (pas alphabétique).
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" />
          <ad-grid-column-def field="status" headerName="Statut" width="160" [sortable]="true"
                        [sortComparator]="statusComparator" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" />
        </ad-grid-angular>
      </div>
    `,
  }),
};
