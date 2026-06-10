import type { Meta, StoryObj } from '@storybook/angular';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AdGridAngularComponent } from '../grid';
import { AdeoGridColumnDef } from '../directives/grid-column-def';
import { BulkDeleteEvent } from '../models/cell.model';
import { Product, generateProducts, PRODUCTS_100, GRID_WRAPPER, baseMeta } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Stories/Selection/Row, Cell, Bulk',
  parameters: {
    ...baseMeta.parameters,
    docs: {
      description: {
        component: `
# Selection

Deux modèles de sélection indépendants et combinables :

### Row selection — \`[rowSelection]="true"\`

Checkbox par ligne + « select all » dans le header. Le header supporte trois états (none / page / all) ; en mode « all », la sélection est représentée par exclusion (\`excludedIds\`) pour rester O(1) sur les gros datasets.

\`\`\`ts
interface RowSelectionEvent<T> {
  selectedIds: unknown[];
  excludedIds: unknown[];   // en mode select-all
  selectedRows: T[];
  mode: 'none' | 'page' | 'all';
  count: number;
}
\`\`\`

Dès qu'une ligne est sélectionnée, la **selection bar** apparaît (count + actions bulk : edit, copy, paste, delete, export) et émet les évents \`(bulkEdit)\`, \`(bulkCopy)\`, \`(bulkPaste)\`, \`(bulkDelete)\`.

### Cell selection — active par défaut

Click pour focus, \`Shift+click\` / \`Shift+flèches\` pour étendre une plage, \`Ctrl+C/X/V\` pour le presse-papier TSV (compatible Excel). \`(cellSelectionChange)\` remonte \`{ focusedCell, range, selectedData }\`. \`[multiCellSelection]="false"\` limite à une cellule unique.

La sélection est keyée par \`rowIdField\` : elle survit au tri, à la pagination et au remplacement des instances de lignes.
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const WithRowSelection: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Sélection par checkbox : ligne par ligne, ou « select all » via le header (cycle page → all → none). Chaque changement émet `(selectionChange)` avec ids, lignes et mode. La selection bar apparaît en bas dès la première ligne cochée.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Navigation et sélection Excel-style : click pour focus, flèches pour naviguer, `Shift+flèches` ou `Shift+click` pour étendre la plage, `Ctrl+A` pour tout sélectionner, `Ctrl+C/X/V` pour copier/couper/coller en TSV. Voir le chapitre **Devtools** pour la liste complète des raccourcis.',
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
  parameters: {
    docs: {
      description: {
        story:
          '`[multiCellSelection]="false"` désactive les plages : une seule cellule focusée à la fois, `Shift+click` et le drag de sélection sont inertes. Utile pour les grilles en lecture où la plage n’a pas de sens.',
      },
    },
  },
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

@Component({
  selector: 'ad-story-bulk-delete',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdGridAngularComponent, AdeoGridColumnDef],
  template: `
    <div style="height: 400px; display: flex; flex-direction: column;">
      <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
        Sélectionne des lignes (checkbox), puis supprime-les via la corbeille de la barre de
        sélection ou la touche <kbd>Delete</kbd>. Le parent écoute
        <code>(bulkDelete)</code> et retire les lignes de son dataset —
        {{ data().length }} lignes restantes.
      </p>
      <ad-grid-angular
        [data]="data()"
        [pagination]="true"
        [pageSize]="20"
        [rowSelection]="true"
        rowIdField="id"
        (bulkDelete)="onBulkDelete($event)"
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
})
class BulkDeleteWrapperComponent {
  readonly data = signal(generateProducts(50));

  onBulkDelete(event: BulkDeleteEvent): void {
    if (event.selectionMode !== 'rows') return;
    const ids = new Set(event.rowIds);
    this.data.update((rows) => rows.filter((r) => !ids.has(r.id)));
    console.log('bulkDelete:', event);
  }
}

export const BulkDelete: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'La suppression en masse passe par la barre de sélection (corbeille) ou la touche `Delete`. La grille émet `(bulkDelete)` avec `rowIds` + `changes` ; le parent décide quoi faire — ici, retirer les lignes de son dataset.',
      },
    },
  },
  render: () => ({
    props: {},
    template: `<ad-story-bulk-delete />`,
    moduleMetadata: {
      imports: [BulkDeleteWrapperComponent],
    },
  }),
};

export const NoMultiCellSelectionWithRowSelection: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Les deux modèles sont indépendants : ici la sélection de lignes (checkboxes) reste active alors que les plages de cellules sont désactivées via `[multiCellSelection]="false"`.',
      },
    },
  },
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
