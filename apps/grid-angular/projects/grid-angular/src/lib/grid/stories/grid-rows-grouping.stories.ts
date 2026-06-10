import type { Meta, StoryObj } from '@storybook/angular';
import { ChangeDetectionStrategy, Component, afterNextRender, viewChild } from '@angular/core';
import { AdGridAngularComponent } from '../grid';
import { AdeoGridColumnDef } from '../directives/grid-column-def';
import { GridStateManager } from '../state/grid-state';
import { ServerGroupingOptions, GroupSummary } from '../features/server-group.engine';
import { Product, PRODUCTS_100, generateProducts, GRID_WRAPPER, baseMeta } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Stories/Grouping/Single, Nested, Server-side',
  parameters: {
    ...baseMeta.parameters,
    docs: {
      description: {
        component: `
# Grouping

Les colonnes \`[groupable]="true"\` peuvent être groupées via le menu colonne (« Group by this column ») ou le group drawer de la toolbar. La stack \`groupColumns\` accepte plusieurs niveaux (grouping imbriqué) ; le group bar au-dessus des headers permet de réordonner / retirer les niveaux. Chaque changement émet \`(groupChange)\` avec \`{ columns, groups }\`.

Deux modes :

- \`groupMode="client"\` (défaut) — le \`GroupEngine\` matérialise les group rows en mémoire
- \`groupMode="server"\` + \`[serverGroupingOptions]\` — résumés et lignes chargés lazy depuis l'API

Le dépliage de lignes individuelles (detail rows) vit dans le chapitre **Row Expansion**.
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const WithGrouping: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Grouping piloté par l’utilisateur : menu colonne (⚙) → « Group by this column » sur une colonne `[groupable]`. Les group rows affichent valeur + count et se replient/déplient au click ; le tag du group bar retire le niveau. `(groupChange)` est émis à chaque mutation de la stack.',
      },
    },
  },
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

@Component({
  selector: 'ad-story-nested-groups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdGridAngularComponent, AdeoGridColumnDef],
  template: `
    <div style="height: 400px; display: flex; flex-direction: column;">
      <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
        Grouping imbriqué pré-configuré : <code>Fournisseur</code> puis <code>Catégorie</code>.
        Déplie un fournisseur pour voir ses sous-groupes par catégorie. Le group bar permet
        de réordonner ou retirer les niveaux.
      </p>
      <ad-grid-angular #grid [data]="data" [pagination]="false">
        <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
        <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" />
        <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" [groupable]="true" />
        <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" />
        <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" />
        <ad-grid-column-def field="supplier" headerName="Fournisseur" width="150" [sortable]="true" [groupable]="true" />
        <ad-grid-column-def field="status" headerName="Statut" width="130" [sortable]="true" [groupable]="true" />
      </ad-grid-angular>
    </div>
  `,
})
class NestedGroupsWrapperComponent {
  private readonly grid = viewChild<AdGridAngularComponent<Product>>('grid');
  readonly data = PRODUCTS_100;

  constructor() {
    // Pre-set a two-level group stack once columns are registered, same
    // mechanism as the header-menu "Group by this column" action.
    afterNextRender(() => {
      const gridRef = this.grid();
      if (!gridRef) return;
      const state = gridRef['state'] as GridStateManager<Product>;
      state.groupColumns.set([
        { field: 'supplier', sortDirection: 'asc' },
        { field: 'category', sortDirection: 'asc' },
      ]);
    });
  }
}

export const NestedGroups: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Plusieurs niveaux de grouping : la stack `groupColumns` contient un champ par niveau, dans l’ordre. L’utilisateur empile via le menu colonne (« Group by this column ») ou le group drawer ; ici la stack `Fournisseur → Catégorie` est pré-configurée.',
      },
    },
  },
  render: () => ({
    props: {},
    template: `<ad-story-nested-groups />`,
    moduleMetadata: {
      imports: [NestedGroupsWrapperComponent],
    },
  }),
};

// Simulated server: the full dataset never reaches the grid — only group
// summaries and per-group row slices, fetched with artificial latency.
const SERVER_DATA = generateProducts(5000);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Component({
  selector: 'ad-story-server-grouping',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdGridAngularComponent, AdeoGridColumnDef],
  template: `
    <div style="height: 400px; display: flex; flex-direction: column;">
      <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
        5 000 lignes côté « serveur » (simulé, latence 300–400 ms). La grille ne charge que les
        en-têtes de groupes (valeur + count), puis les lignes d'un groupe à la demande quand on
        le déplie, par pages de 50.
      </p>
      <ad-grid-angular
        #grid
        [data]="[]"
        [pagination]="false"
        groupMode="server"
        [serverGroupingOptions]="serverOptions"
        (groupChange)="logGroupChange($event)"
      >
        <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
        <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" />
        <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" [groupable]="true" />
        <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" />
        <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" />
        <ad-grid-column-def field="supplier" headerName="Fournisseur" width="150" [sortable]="true" [groupable]="true" />
      </ad-grid-angular>
    </div>
  `,
})
class ServerGroupingWrapperComponent {
  private readonly grid = viewChild<AdGridAngularComponent<Product>>('grid');

  readonly serverOptions: ServerGroupingOptions<Product> = {
    fetchGroups: async (fields: string[]): Promise<GroupSummary[]> => {
      await delay(400);
      const field = fields[0] as keyof Product;
      const counts = new Map<unknown, number>();
      for (const row of SERVER_DATA) {
        counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
        .map(([value, count]) => ({ value, count }));
    },
    fetchGroupRows: async (field: string, value: unknown, start: number, end: number) => {
      await delay(300);
      return SERVER_DATA.filter((r) => r[field as keyof Product] === value).slice(start, end);
    },
    pageSize: 50,
  };

  constructor() {
    // Open on the supplier grouping so the server fetch fires immediately.
    afterNextRender(() => {
      const gridRef = this.grid();
      if (!gridRef) return;
      const state = gridRef['state'] as GridStateManager<Product>;
      state.groupColumns.set([{ field: 'supplier', sortDirection: 'asc' }]);
    });
  }

  logGroupChange(event: unknown): void {
    console.log('groupChange:', event);
  }
}

export const ServerSideGrouping: Story = {
  parameters: {
    docs: {
      description: {
        story: `
\`groupMode="server"\` + \`[serverGroupingOptions]\` délèguent le grouping au serveur :

\`\`\`ts
serverOptions: ServerGroupingOptions<Product> = {
  fetchGroups: (fields) => api.getGroupSummaries(fields),      // valeurs distinctes + counts
  fetchGroupRows: (field, value, start, end) => api.getRows(…), // slice lazy par groupe
  pageSize: 50,
};
\`\`\`

Le dataset complet ne transite jamais : seuls les résumés de groupes puis les tranches de lignes dépliées sont chargés.
        `,
      },
    },
  },
  render: () => ({
    props: {},
    template: `<ad-story-server-grouping />`,
    moduleMetadata: {
      imports: [ServerGroupingWrapperComponent],
    },
  }),
};
