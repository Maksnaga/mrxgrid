import type { Meta, StoryObj } from '@storybook/angular';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { AdGridAngularComponent } from '../grid';
import { AdeoGridColumnDef } from '../directives/grid-column-def';
import { Product, generateProducts, GRID_WRAPPER, baseMeta } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Stories/Pagination/Client & Server-side',
  parameters: {
    ...baseMeta.parameters,
    docs: {
      description: {
        component: `
# Pagination

Deux modes, pilotés par le footer :

| Mode | Inputs | Quand |
|------|--------|-------|
| **Client** (défaut) | \`[pagination]="true"\` + \`[pageSize]\` / \`[pageSizeOptions]\` | dataset complet en mémoire |
| **Serveur** | \`+ mode="server"\` + \`[totalItems]\` + \`(pageChange)\` | le back-end pagine |

\`\`\`ts
interface PageEvent { pageIndex; pageSize; previousPageIndex; previousPageSize; startIndex; endIndex; }
\`\`\`

Pour les flux append-only, voir **Lazy Loading** (infinite scroll) ; pour scroller tout le dataset sans pagination, voir **Virtual Scroll**.
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

@Component({
  selector: 'ad-story-server-paginated',
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
    template: `<ad-story-server-paginated />`,
    moduleMetadata: {
      imports: [ServerPaginatedWrapperComponent],
    },
  }),
};

export const CustomPageSizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`[pageSizeOptions]` pilote les tailles proposées dans le sélecteur du footer ; `[pageSize]` fixe la taille initiale (elle doit figurer dans les options). Chaque changement émet `(pageChange)` avec `previousPageSize`.',
      },
    },
  },
  render: () => ({
    props: {
      data: generateProducts(60),
      gridWrapper: GRID_WRAPPER,
      onPageChange: (event: unknown) => console.log('pageChange:', event),
    },
    template: `
      <div [style]="gridWrapper">
        <ad-grid-angular [data]="data" [pagination]="true"
                   [pageSize]="5" [pageSizeOptions]="[5, 10, 20, 60]"
                   (pageChange)="onPageChange($event)">
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
