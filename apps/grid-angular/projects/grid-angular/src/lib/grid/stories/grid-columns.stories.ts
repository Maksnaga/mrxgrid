import type { Meta, StoryObj } from '@storybook/angular';
import { AdGridAngularComponent } from '../grid';
import { Product, PRODUCTS_100, GRID_WRAPPER, baseMeta } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Data Display/Grid/Columns',
  parameters: {
    ...baseMeta.parameters,
    docs: {
      description: {
        component: `
# Columns

Tout passe par \`<ad-grid-column-def>\`, projeté dans la grille. Chaque directive devient une \`ColumnDef\` :

| Input | Rôle |
|-------|------|
| \`field\` (requis) | Clé de la donnée dans la ligne |
| \`headerName\` | Libellé du header (défaut : \`field\`) |
| \`width\` / \`minWidth\` / \`maxWidth\` | Largeurs en px (strings) |
| \`[sortable]\` / \`[resizable]\` / \`[reorderable]\` | Interactions header (défaut \`true\` sauf reorder global) |
| \`[groupable]\` / \`[filterable]\` / \`[freezable]\` / \`[hideable]\` | Expose l'action dans le menu colonne |
| \`[pinned]\` | \`'start' \\| 'end'\` (alias Vue \`'left' \\| 'right'\` acceptés) |
| \`[editable]\` + \`cellEditor\` | Édition inline — voir le chapitre **Editing** |
| \`[visible]\` | Colonne masquée par défaut (réaffichable via Settings) |

### Templates par colonne

\`\`\`html
<ad-grid-column-def field="price" headerName="Prix">
  <ng-template #cell let-value let-row="row">…rendu lecture…</ng-template>
  <ng-template #edit let-value let-updateDraft="updateDraft" let-commitEdit="commitEdit">…rendu édition…</ng-template>
  <ng-template #filter>…input de filtre inline…</ng-template>
</ad-grid-column-def>
\`\`\`

### Menu colonne

L'icône ⚙ de chaque header ouvre un menu contextuel : tri A→Z / Z→A, filtre, group by, pin left/right, hide, auto-size (colonne ou toutes). Chaque entrée n'apparaît que si le flag correspondant (\`groupable\`, \`freezable\`, …) l'autorise.
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const WithColumnResize: Story = {
  parameters: {
    docs: {
      description: {
        story: `
Tirez le bord droit d'un header (bord **gauche** pour une colonne pinnée à droite) pour redimensionner. \`minWidth\` / \`maxWidth\` bornent le drag ; double-click sur le menu colonne → « Auto-size » ajuste au contenu mesuré. Chaque resize émet \`(columnResize)\` et la largeur est persistée si \`persistKey\` est posé.

\`\`\`html
<ad-grid-column-def field="id" width="80" [resizable]="true" minWidth="50" maxWidth="150" />
\`\`\`
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
  parameters: {
    docs: {
      description: {
        story: `
\`[reorderable]="true"\` (au niveau grille) active le drag & drop des headers : attrapez un header non pinné et déposez-le à sa nouvelle position. Le \`ColumnDragEngine\` affiche un indicateur d'insertion pendant le drag et émet \`(columnReorder)\` au drop. Une colonne peut s'exclure avec \`[reorderable]="false"\` sur sa def.
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
  parameters: {
    docs: {
      description: {
        story: `
Le template \`#cell\` remplace le rendu texte par défaut d'une colonne. Contexte disponible :

\`\`\`html
<ng-template #cell let-value let-row="row">
  <!-- value: valeur de la cellule · row: la ligne complète -->
  <span [class.danger]="row.stock === 0">{{ value.toFixed(2) }} €</span>
</ng-template>
\`\`\`

Le template ne s'applique qu'en **lecture** : en édition, c'est l'éditeur (\`cellEditor\` ou template \`#edit\`) qui prend le relais. Ici : badge coloré pour \`Statut\`, devise formatée pour \`Prix\`.
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
  parameters: {
    docs: {
      description: {
        story: `
Deux façons de pinner une colonne :

1. **Utilisateur** — menu colonne (⚙) → « Pin left » / « Pin right » (visible si \`[freezable]="true"\`)
2. **Déclaratif** — \`[pinned]="'start'"\` ou \`[pinned]="'end'"\` sur la def

Les colonnes pinnées restent sticky pendant le scroll horizontal (ombre portée au bord du bloc), gardent leur largeur exacte (resize 1:1) et le bloc pinné-droite reste collé au bord droit même quand les colonnes ne remplissent pas le viewport. \`(columnFreeze)\` est émis à chaque changement.
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
