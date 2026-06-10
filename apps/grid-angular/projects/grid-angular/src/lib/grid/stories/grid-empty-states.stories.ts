import type { Meta, StoryObj } from '@storybook/angular';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AdGridAngularComponent } from '../grid';
import { AdeoGridColumnDef } from '../directives/grid-column-def';
import { AdeoGridEmptyDef } from '../directives/grid-empty-def';
import { MozButtonComponent } from '@mozaic-ds/angular';
import { Product, generateProducts, PRODUCTS_100, GRID_WRAPPER, baseMeta } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Data Display/Grid/Empty States',
  parameters: {
    ...baseMeta.parameters,
    docs: {
      description: {
        component: `
# Empty & Loading States

La grille distingue quatre états « sans contenu », chacun personnalisable :

| État | Déclencheur | Personnalisation |
|------|-------------|------------------|
| **No data** | \`[data]\` vide, aucun filtre | \`[emptyDataTitle]\` / \`[emptyDataDescription]\` ou template \`mozGridEmptyDef\` |
| **No results** | filtres actifs → 0 ligne | \`[noResultsTitle]\` / \`[noResultsDescription]\` / \`[noResultsActionLabel]\` (bouton « Clear filters ») ou \`mozGridEmptyDef="no-results"\` |
| **Loading initial** | \`[loading]="true"\` sans données | skeleton rows (\`[skeletonRowCount]\`) |
| **Refreshing** | \`[refreshing]="true"\` avec données | indicateur non destructif, lignes visibles |

L'état « no results » garde le header visible (l'utilisateur doit pouvoir retirer ses filtres) ; l'action « Clear filters » vide le \`FilterModel\`.
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const EmptyStateDefault: Story = {
  name: 'Empty State / Default (no-data)',
  render: () => ({
    props: {
      data: [] as Product[],
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          When the grid receives an empty <code>data</code> array, it shows the
          built-in <strong>no-data</strong> empty state with a folder icon and a
          neutral message.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20">
          <ad-grid-column-def field="id" headerName="ID" width="80" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" />
        </ad-grid-angular>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Default `no-data` empty state: shown automatically when `data` is empty (or `totalItems === 0` in server mode) and the grid is not loading. Use the inputs `emptyDataTitle` and `emptyDataDescription` to override the copy without writing a custom template.',
      },
    },
  },
};

export const EmptyStateCustomCopy: Story = {
  name: 'Empty State / Custom copy via inputs',
  render: () => ({
    props: {
      data: [] as Product[],
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Override the default labels using the dedicated inputs — no template needed.
        </p>
        <ad-grid-angular
          [data]="data"
          [pagination]="true"
          [pageSize]="20"
          emptyDataTitle="Aucun produit"
          emptyDataDescription="Importez un catalogue pour commencer à travailler."
        >
          <ad-grid-column-def field="id" headerName="ID" width="80" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" />
        </ad-grid-angular>
      </div>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Quickest customisation path: pass `emptyDataTitle` / `emptyDataDescription` (and `noResultsTitle` / `noResultsDescription` / `noResultsActionLabel` for the filtered case) on the grid. The default visual stays the same.',
      },
    },
  },
};

@Component({
  selector: 'moz-story-empty-no-results',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdGridAngularComponent, AdeoGridColumnDef],
  template: `
    <div style="display: flex; flex-direction: column; height: 400px; gap: 8px;">
      <p style="margin: 0; color: var(--color-text-secondary); font-size: 14px;">
        Type a filter via the column gear → <em>Filter in this column</em> with a value that matches
        nothing (e.g. <code>contains "ZZZ"</code>) to trigger the
        <strong>no-results</strong> variant. The default CTA "Clear filters" calls
        <code>filterEngine.clearAll()</code> for you.
      </p>
      <div style="flex: 1; min-height: 0;">
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def
            field="name"
            headerName="Nom"
            width="200"
            [sortable]="true"
            [filterable]="true"
          />
          <ad-grid-column-def
            field="reference"
            headerName="Référence"
            width="160"
            [sortable]="true"
            [filterable]="true"
          />
          <ad-grid-column-def
            field="category"
            headerName="Catégorie"
            width="150"
            [sortable]="true"
            [filterable]="true"
          />
        </ad-grid-angular>
      </div>
    </div>
  `,
})
class EmptyNoResultsWrapperComponent {
  readonly data = PRODUCTS_100;
}

export const EmptyStateNoResults: Story = {
  name: 'Empty State / No results (filters active)',
  render: () => ({
    props: {},
    template: `<moz-story-empty-no-results />`,
    moduleMetadata: {
      imports: [EmptyNoResultsWrapperComponent],
    },
  }),
  parameters: {
    docs: {
      description: {
        story:
          'When the dataset is non-empty but the active filter conditions yield zero rows, the grid switches to the `no-results` variant: search icon, dedicated copy, and a "Clear filters" CTA wired to `FilterEngine.clearAll()`.',
      },
    },
  },
};

@Component({
  selector: 'moz-story-empty-custom-template',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdGridAngularComponent, AdeoGridColumnDef, AdeoGridEmptyDef, MozButtonComponent],
  template: `
    <div style="display: flex; flex-direction: column; height: 460px; gap: 8px;">
      <div style="display: flex; gap: 8px; align-items: center;">
        <button moz-button size="s" [outlined]="true" (click)="reset()">Vider la grille</button>
        <button moz-button size="s" [outlined]="true" (click)="load()">Charger 50 produits</button>
        <span style="color: var(--color-text-secondary); font-size: 13px;">
          Then try filtering on <em>Référence contains "ZZZ"</em> to see the second template.
        </span>
      </div>

      <div style="flex: 1; min-height: 0;">
        <ad-grid-angular [data]="data()" [pagination]="true" [pageSize]="20">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" />
          <ad-grid-column-def
            field="reference"
            headerName="Référence"
            width="160"
            [sortable]="true"
            [filterable]="true"
          />
          <ad-grid-column-def
            field="category"
            headerName="Catégorie"
            width="150"
            [sortable]="true"
          />

          <!-- 1) Fully custom 'no-data' template -->
          <ng-template mozGridEmptyDef>
            <div
              style="
              display: flex; flex-direction: column; align-items: center; gap: 12px;
              padding: 32px; text-align: center;"
            >
              <div
                style="
                width: 72px; height: 72px; border-radius: 50%;
                background: linear-gradient(135deg, #e3f2fd, #bbdefb);
                display: flex; align-items: center; justify-content: center;
                font-size: 32px;"
              >
                📦
              </div>
              <h3 style="margin: 0; font-size: 18px; color: #1a73e8;">Catalogue vide</h3>
              <p style="margin: 0; color: #5f6368; max-width: 340px;">
                Aucun produit n'est référencé. Cliquez ci-dessous pour charger un jeu de
                démonstration.
              </p>
              <button moz-button [appearance]="'accent'" size="m" (click)="load()">
                Charger 50 produits
              </button>
            </div>
          </ng-template>

          <!-- 2) Dedicated 'no-results' template using the implicit context -->
          <ng-template mozGridEmptyDef="no-results" let-ctx>
            <div
              style="
              display: flex; flex-direction: column; align-items: center; gap: 12px;
              padding: 32px; text-align: center;"
            >
              <div style="font-size: 40px;">🔎</div>
              <h3 style="margin: 0; font-size: 18px;">Aucun résultat</h3>
              <p style="margin: 0; color: #5f6368;">
                {{ ctx.activeFilterCount }} filtre(s) actif(s) ne correspondent à aucun produit.
              </p>
              <button moz-button [outlined]="true" size="s" (click)="ctx.clearFilters()">
                Réinitialiser les filtres
              </button>
            </div>
          </ng-template>
        </ad-grid-angular>
      </div>
    </div>
  `,
})
class EmptyCustomTemplateWrapperComponent {
  readonly data = signal<Product[]>([]);

  reset(): void {
    this.data.set([]);
  }

  load(): void {
    this.data.set(generateProducts(50));
  }
}

export const EmptyStateCustomTemplates: Story = {
  name: 'Empty State / Custom templates',
  render: () => ({
    props: {},
    template: `<moz-story-empty-custom-template />`,
    moduleMetadata: {
      imports: [EmptyCustomTemplateWrapperComponent],
    },
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Project up to two `<ng-template mozGridEmptyDef>` into the grid: a default one (used for `no-data` and as a fallback) and an optional `mozGridEmptyDef="no-results"` for the filtered case.',
      },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Loading states
// ─────────────────────────────────────────────────────────────────────────────

export const LoadingState: Story = {
  name: 'Loading / Initial load',
  parameters: {
    docs: {
      description: {
        story:
          'Avec `[loading]="true"` et aucune donnée, la grille affiche des skeleton rows (nombre réglable via `[skeletonRowCount]`). À utiliser pendant le premier fetch.',
      },
    },
  },
  render: () => ({
    props: {
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <ad-grid-angular [data]="[]" [loading]="true" [skeletonRowCount]="8" [pagination]="true" [pageSize]="20">
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

export const RefreshingState: Story = {
  name: 'Loading / Refreshing',
  parameters: {
    docs: {
      description: {
        story:
          'Avec `[refreshing]="true"`, les données restent visibles pendant le re-fetch (pas de skeleton destructif) — à utiliser pour un refresh en arrière-plan après le premier chargement.',
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
        <ad-grid-angular [data]="data" [refreshing]="true" [pagination]="true" [pageSize]="20">
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
