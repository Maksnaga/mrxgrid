import type { Meta, StoryObj } from '@storybook/angular';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { AdGridAngularComponent } from '../grid';
import { AdeoGridColumnDef } from '../directives/grid-column-def';
import { LoadMoreEvent } from '../models/pagination.model';
import { Product, generateProducts, GRID_WRAPPER, baseMeta, WIDE_COL_COUNT, WIDE_ROWS, WIDE_COLS } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Data Display/Grid/Pagination & Scrolling',
  parameters: {
    ...baseMeta.parameters,
    docs: {
      description: {
        component: `
# Pagination & Scrolling

Trois stratégies de consommation des données, combinables avec le virtual scroll :

| Stratégie | Inputs | Quand |
|-----------|--------|-------|
| **Pagination client** | \`[pagination]="true"\` + \`[pageSize]\` / \`[pageSizeOptions]\` | dataset complet en mémoire |
| **Pagination serveur** | \`+ mode="server"\` + \`[totalItems]\` + \`(pageChange)\` | le back-end pagine |
| **Infinite scroll** | \`loadingStrategy="infinite-scroll"\` + \`[scrollThreshold]\` + \`(loadMore)\` | flux append-only |

\`\`\`ts
interface PageEvent { pageIndex; pageSize; previousPageIndex; previousPageSize; startIndex; endIndex; }
interface LoadMoreEvent { offset: number; limit: number; }
\`\`\`

### Virtual scroll

- **Vertical** — toujours actif : seules les lignes visibles (+ buffer) sont dans le DOM, un spacer height-based préserve la scrollbar (pas de \`translateY\`, qui piégerait les colonnes sticky)
- **Horizontal** — activé automatiquement au-delà d'un seuil de colonnes : seules les colonnes du viewport sont rendues, des spacers comblent les côtés
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

@Component({
  selector: 'moz-story-server-paginated',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [AdGridAngularComponent, AdeoGridColumnDef],
  template: `
    <div style="display: flex; flex-direction: column; height: 800px; gap: 8px;">
      <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        <ad-grid-angular
          [data]="data"
          mode="server"
          [totalItems]="totalItems"
          [loading]="loading"
          [pagination]="true"
          [pageSize]="20"
          [rowSelection]="true"
          [fullscreen]="true"
          [exportable]="true"
          [reorderable]="true"
          (pageChange)="onPageChange($event)"
          (sortChange)="onSortChange($event)"
          (cellEdit)="logEvent('cellEdit', $event)"
          (cellEditCancel)="logEvent('cellEditCancel', $event)"
          (selectionChange)="logEvent('selectionChange', $event)"
          (cellSelectionChange)="logEvent('cellSelectionChange', $event)"
          (groupChange)="logEvent('groupChange', $event)"
          (filterChange)="logEvent('filterChange', $event)"
          (bulkEdit)="logEvent('bulkEdit', $event)"
          (bulkCopy)="logEvent('bulkCopy', $event)"
          (bulkPaste)="logEvent('bulkPaste', $event)"
          (bulkDelete)="logEvent('bulkDelete', $event)"
          (settingsChange)="logEvent('settingsChange', $event)"
        >
          <ad-grid-column-def
            field="id"
            headerName="ID"
            width="80"
            [sortable]="true"
            [freezable]="true"
          />
          <ad-grid-column-def
            field="name"
            headerName="Nom"
            width="200"
            [sortable]="true"
            [editable]="true"
            [freezable]="true"
          />
          <ad-grid-column-def
            field="reference"
            headerName="Référence"
            width="150"
            [sortable]="true"
            [freezable]="true"
          />
          <ad-grid-column-def
            field="category"
            headerName="Catégorie"
            width="180"
            [sortable]="true"
            [editable]="true"
            cellEditor="select"
            [cellEditorOptions]="catOpts"
            [groupable]="true"
            [freezable]="true"
          />
          <ad-grid-column-def
            field="price"
            headerName="Prix (€)"
            width="120"
            [sortable]="true"
            [editable]="true"
            cellEditor="number"
            [freezable]="true"
          />
          <ad-grid-column-def
            field="stock"
            headerName="Stock"
            width="100"
            [sortable]="true"
            [editable]="true"
            cellEditor="number"
            [freezable]="true"
          />
          <ad-grid-column-def
            field="supplier"
            headerName="Fournisseur"
            width="150"
            [sortable]="true"
            [groupable]="true"
            [freezable]="true"
          />
          <ad-grid-column-def
            field="status"
            headerName="Statut"
            width="130"
            [sortable]="true"
            [groupable]="true"
            [freezable]="true"
          />
        </ad-grid-angular>
      </div>

      <div
        style="height: 200px; border: 1px solid var(--color-border-primary, #dee2e6); border-radius: 4px; background: #1e1e1e; overflow-y: auto; font-family: monospace; font-size: 12px; padding: 8px;"
      >
        <div style="color: #6c757d; margin-bottom: 4px; font-weight: 600;">
          Event Log (server mode)
        </div>
        @for (entry of eventLog; track $index) {
        <div style="color: #a8d8a8; padding: 2px 0; word-break: break-all; white-space: pre-wrap;">
          {{ entry }}
        </div>
        } @if (eventLog.length === 0) {
        <div style="color: #6c757d; font-style: italic;">
          Interact with the grid to see events here...
        </div>
        }
      </div>
    </div>
  `,
})
class ServerPaginatedWrapperComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly allData = generateProducts(500);
  private pageIndex = 0;
  private pageSize = 20;
  private sorts: { field: string; direction: string }[] = [];

  data = this.allData.slice(0, 20);
  totalItems = this.allData.length;
  loading = false;
  eventLog: string[] = [];

  readonly catOpts = [
    { text: 'Peinture', value: 'Peinture' },
    { text: 'Outillage', value: 'Outillage' },
    { text: 'Plomberie', value: 'Plomberie' },
    { text: 'Électricité', value: 'Électricité' },
    { text: 'Jardin', value: 'Jardin' },
    { text: 'Revêtement', value: 'Revêtement' },
    { text: 'Quincaillerie', value: 'Quincaillerie' },
    { text: 'Menuiserie', value: 'Menuiserie' },
  ];

  logEvent(name: string, detail: unknown): void {
    const ts = new Date().toLocaleTimeString();
    const json = JSON.stringify(detail, null, 0);
    const entry = `[${ts}] ${name}: ${json}`;
    this.eventLog = [entry, ...this.eventLog.slice(0, 49)];
    this.cdr.detectChanges();
  }

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.logEvent('pageChange', event);
    this.fetchPage();
  }

  onSortChange(event: { sorts: { field: string; direction: string }[] }): void {
    this.sorts = event.sorts || [];
    this.pageIndex = 0;
    this.logEvent('sortChange', event);
    this.fetchPage();
  }

  private fetchPage(): void {
    this.loading = true;
    this.cdr.detectChanges();

    const sorted = [...this.allData];
    for (const sort of this.sorts) {
      sorted.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sort.field];
        const bVal = (b as unknown as Record<string, unknown>)[sort.field];
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sort.direction === 'desc' ? -cmp : cmp;
      });
    }

    const start = this.pageIndex * this.pageSize;
    const page = sorted.slice(start, start + this.pageSize);

    setTimeout(() => {
      this.data = page;
      this.totalItems = sorted.length;
      this.loading = false;
      this.cdr.detectChanges();
    }, 400);
  }
}

export const ServerPaginated: Story = {
  parameters: {
    docs: {
      description: {
        story: `
\`mode="server"\` : la grille ne pagine pas elle-même — elle affiche \`[data]\` tel quel et pilote le footer avec \`[totalItems]\`. À chaque changement de page, \`(pageChange)\` fournit \`startIndex\`/\`endIndex\` pour la requête :

\`\`\`ts
onPageChange(e: PageEvent): void {
  this.loading = true;
  this.api.fetch(e.startIndex, e.pageSize).subscribe((page) => {
    this.data = page.rows;
    this.loading = false;
  });
}
\`\`\`

Ici l'API est simulée avec 500 ms de latence — le spinner \`[loading]\` couvre le round-trip.
        `,
      },
    },
  },
  render: () => ({
    props: {},
    template: `<moz-story-server-paginated />`,
    moduleMetadata: {
      imports: [ServerPaginatedWrapperComponent],
    },
  }),
};

@Component({
  selector: 'moz-story-infinite-scroll',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdGridAngularComponent, AdeoGridColumnDef],
  template: `
    <div style="display: flex; flex-direction: column; height: 600px; gap: 8px;">
      <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
        Scroll down to load more data. The grid fetches 50 items at a time, simulating a 300ms
        server delay. Total dataset: 500 items.
      </p>
      <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        <ad-grid-angular
          [data]="data()"
          mode="server"
          loadingStrategy="infinite-scroll"
          [totalItems]="totalItems"
          [loading]="loading()"
          [pageSize]="50"
          [scrollThreshold]="200"
          (loadMore)="onLoadMore($event)"
          (sortChange)="onSortChange($event)"
        >
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" />
          <ad-grid-column-def
            field="reference"
            headerName="Référence"
            width="150"
            [sortable]="true"
          />
          <ad-grid-column-def
            field="category"
            headerName="Catégorie"
            width="150"
            [sortable]="true"
          />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" />
          <ad-grid-column-def
            field="supplier"
            headerName="Fournisseur"
            width="150"
            [sortable]="true"
          />
          <ad-grid-column-def field="status" headerName="Statut" width="130" [sortable]="true" />
        </ad-grid-angular>
      </div>
      <div style="font-size: 13px; color: var(--color-text-secondary);">
        Loaded: {{ data().length }} / {{ totalItems }}
      </div>
    </div>
  `,
})
class InfiniteScrollWrapperComponent {
  private readonly allData = generateProducts(500);
  readonly totalItems = this.allData.length;
  readonly data = signal<Product[]>([]);
  readonly loading = signal(false);
  private sorts: { field: string; direction: string }[] = [];

  constructor() {
    // Initial load
    this.data.set(this.getSortedData().slice(0, 50));
  }

  onLoadMore(event: LoadMoreEvent): void {
    this.loading.set(true);
    const sorted = this.getSortedData();

    setTimeout(() => {
      if (event.offset === 0) {
        // Reset (sort/filter changed)
        this.data.set(sorted.slice(0, event.limit));
      } else {
        // Append
        const next = sorted.slice(event.offset, event.offset + event.limit);
        this.data.update((current) => [...current, ...next]);
      }
      this.loading.set(false);
    }, 300);
  }

  onSortChange(event: { sorts: { field: string; direction: string }[] }): void {
    this.sorts = event.sorts || [];
  }

  private getSortedData(): Product[] {
    const sorted = [...this.allData];
    for (const sort of this.sorts) {
      sorted.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sort.field];
        const bVal = (b as unknown as Record<string, unknown>)[sort.field];
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sort.direction === 'desc' ? -cmp : cmp;
      });
    }
    return sorted;
  }
}

export const InfiniteScroll: Story = {
  parameters: {
    docs: {
      description: {
        story: `
\`loadingStrategy="infinite-scroll"\` remplace le footer de pagination : quand le scroll approche du bas (\`[scrollThreshold]\` px), la grille émet \`(loadMore)\` avec \`{ offset, limit }\`. Le parent fetch la tranche suivante et **append** au tableau \`[data]\`. \`[totalItems]\` borne le flux — plus d'évent une fois tout chargé.
        `,
      },
    },
  },
  render: () => ({
    props: {},
    template: `<moz-story-infinite-scroll />`,
    moduleMetadata: {
      imports: [InfiniteScrollWrapperComponent],
    },
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
