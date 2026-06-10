import type { Meta, StoryObj } from '@storybook/angular';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AdGridAngularComponent } from '../grid';
import { AdeoGridColumnDef } from '../directives/grid-column-def';
import { MozComboboxComponent, MozComboboxOption } from '@mozaic-ds/angular';
import { FilterEvent, FilterCondition, FilterValue, AdeoGridCustomFilter } from '../models/filter.model';
import { Product, generateProducts, PRODUCTS_100, PRODUCTS_1000, baseMeta, uniqueOptions, fakeServerFilter, ALL_CATEGORY_OPTIONS } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Data Display/Grid/Filtering',
  parameters: {
    ...baseMeta.parameters,
    docs: {
      description: {
        component: `
# Filtering

Le filtrage est piloté par un \`FilterModel\` central — une liste de conditions combinées :

\`\`\`ts
interface FilterCondition {
  id: string;                    // stable, pour trackBy / réordonnancement
  combinator: 'and' | 'or';      // ignoré pour la première condition
  field: string;
  operator: FilterOperator;      // contains, equals, gt, between, in, blank…
  value: { value?: unknown; valueTo?: unknown };
}
\`\`\`

### Trois surfaces UI, un seul modèle

| Surface | Activation | Usage |
|---------|-----------|-------|
| **Filter row inline** | template \`#filter\` sur la colonne (ou \`[showQuickFilters]\`) | filtre rapide par colonne, sous le header |
| **Builder overlay** | menu colonne → « Filter in this column » | conditions avancées ancrées sur la colonne |
| **Filter drawer** | bouton Filters de la toolbar | vue d'ensemble : ajout, réordonnancement, combinators |

Les conditions actives s'affichent dans la barre « FILTERED BY » (tags supprimables). Chaque mutation émet \`(filterChange)\` avec \`{ model, condition, reason }\`.

### Typage des opérateurs

\`filterType\` (\`text · number · date · set · boolean · custom\`) choisit les opérateurs proposés ; s'il est omis, il est dérivé du \`cellEditor\` (\`number → number\`, \`date → date\`, \`select → set\`, sinon \`text\`).

### Client vs serveur

- \`filterMode="client"\` (défaut) — évaluation en mémoire par le \`FilterEngine\`
- \`filterMode="server"\` — la grille n'évalue rien ; écoutez \`(filterChange)\` et réinjectez les lignes filtrées dans \`[data]\`
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

@Component({
  selector: 'moz-story-filter-slot',
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [AdGridAngularComponent, AdeoGridColumnDef],
  template: `
    <div style="display: flex; flex-direction: column; height: 600px; gap: 8px;">
      <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        <ad-grid-angular [data]="filteredData" [pagination]="true" [pageSize]="20" [rowSelection]="true">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true">
            <ng-template #filter>
              <input
                type="text"
                placeholder="Search name..."
                [value]="nameFilter"
                (input)="onNameFilter($event)"
                style="width: 100%; height: 28px; border: 1px solid #dee2e6; border-radius: 4px; padding: 0 8px; font-size: 12px; box-sizing: border-box;"
              />
            </ng-template>
          </ad-grid-column-def>
          <ad-grid-column-def
            field="reference"
            headerName="Référence"
            width="150"
            [sortable]="true"
          />
          <ad-grid-column-def
            field="category"
            headerName="Catégorie"
            width="180"
            [sortable]="true"
          >
            <ng-template #filter>
              <select
                (change)="onCategoryFilter($event)"
                style="width: 100%; height: 28px; border: 1px solid #dee2e6; border-radius: 4px; padding: 0 4px; font-size: 12px; box-sizing: border-box; background: #fff;"
              >
                <option value="">All</option>
                @for (cat of categories; track cat) {
                <option [value]="cat">{{ cat }}</option>
                }
              </select>
            </ng-template>
          </ad-grid-column-def>
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true">
            <ng-template #filter>
              <input
                type="number"
                placeholder="Max price"
                (input)="onPriceFilter($event)"
                style="width: 100%; height: 28px; border: 1px solid #dee2e6; border-radius: 4px; padding: 0 8px; font-size: 12px; box-sizing: border-box;"
              />
            </ng-template>
          </ad-grid-column-def>
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
    </div>
  `,
})
class FilterSlotWrapperComponent {
  private readonly allData = generateProducts(100);

  readonly categories = [
    'Peinture',
    'Outillage',
    'Plomberie',
    'Électricité',
    'Jardin',
    'Revêtement',
    'Quincaillerie',
    'Menuiserie',
  ];

  nameFilter = '';
  categoryFilter = '';
  maxPrice: number | null = null;

  get filteredData(): Product[] {
    return this.allData.filter((p) => {
      if (this.nameFilter && !p.name.toLowerCase().includes(this.nameFilter.toLowerCase()))
        return false;
      if (this.categoryFilter && p.category !== this.categoryFilter) return false;
      if (this.maxPrice !== null && p.price > this.maxPrice) return false;
      return true;
    });
  }

  onNameFilter(event: Event): void {
    this.nameFilter = (event.target as HTMLInputElement).value;
  }

  onCategoryFilter(event: Event): void {
    this.categoryFilter = (event.target as HTMLSelectElement).value;
  }

  onPriceFilter(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.maxPrice = val ? Number(val) : null;
  }
}

export const WithFilterSlot: Story = {
  parameters: {
    docs: {
      description: {
        story: `
Filter row inline : chaque colonne filtrable projette son propre input via le template \`#filter\`, rendu dans une rangée sous les headers. Le wrapper applique le filtre côté parent (la grille ne fait que projeter l'UI) :

\`\`\`html
<ad-grid-column-def field="name" [filterable]="true">
  <ng-template #filter>
    <input type="text" placeholder="Rechercher…" (input)="onNameFilter($event)" />
  </ng-template>
</ad-grid-column-def>
\`\`\`

À combiner avec le builder overlay (menu colonne) : les deux surfaces sont complémentaires — quick filter vs conditions avancées.
        `,
      },
    },
  },
  render: () => ({
    props: {},
    template: `<moz-story-filter-slot />`,
    moduleMetadata: {
      imports: [FilterSlotWrapperComponent],
    },
  }),
};

// ---------------------------------------------------------------------------
// WithComboboxCell — multiselect combobox in a grid cell
// ---------------------------------------------------------------------------

@Component({
  selector: 'moz-story-filter-client',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdGridAngularComponent, AdeoGridColumnDef],
  template: `
    <div style="display: flex; flex-direction: column; height: 620px; gap: 12px;">
      <!-- Banner -->
      <div
        style="padding: 12px 16px; background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 6px; font-size: 13px; color: #1b5e20; line-height: 1.5;"
      >
        <strong>Mode client</strong> — les filtres s'évaluent directement en mémoire sur les
        <strong>{{ data.length }} lignes chargées</strong>. Ouvrez le panneau <em>Filters</em> dans
        la barre d'outils pour combiner des conditions (AND / OR) sur plusieurs colonnes. La grid
        réagit instantanément, sans aucune requête réseau.
      </div>

      <!-- Grid -->
      <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        <ad-grid-angular
          [data]="data"
          filterMode="client"
          [pagination]="true"
          [pageSize]="20"
          noResultsTitle="Aucun résultat"
          noResultsDescription="Aucune ligne ne correspond aux filtres actifs. Modifiez ou supprimez des conditions."
          noResultsActionLabel="Effacer les filtres"
          (filterChange)="onFilterChange($event)"
        >
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
            width="150"
            [sortable]="true"
            [filterable]="true"
          />
          <ad-grid-column-def
            field="category"
            headerName="Catégorie"
            width="160"
            [sortable]="true"
            [filterable]="true"
            filterType="set"
            [filterOptions]="categoryOptions"
          />
          <ad-grid-column-def
            field="price"
            headerName="Prix (€)"
            width="130"
            [sortable]="true"
            [filterable]="true"
            filterType="number"
          />
          <ad-grid-column-def
            field="stock"
            headerName="Stock"
            width="100"
            [sortable]="true"
            [filterable]="true"
            filterType="number"
          />
          <ad-grid-column-def
            field="supplier"
            headerName="Fournisseur"
            width="160"
            [sortable]="true"
            [filterable]="true"
            filterType="set"
            [filterOptions]="supplierOptions"
          />
          <ad-grid-column-def
            field="status"
            headerName="Statut"
            width="140"
            [sortable]="true"
            [filterable]="true"
            filterType="set"
            [filterOptions]="statusOptions"
          />
          <ad-grid-column-def
            field="available"
            headerName="Disponible"
            width="120"
            [sortable]="true"
            [filterable]="true"
            filterType="boolean"
          />
          <ad-grid-column-def
            field="lastUpdated"
            headerName="Dernière MAJ"
            width="160"
            [sortable]="true"
            [filterable]="true"
            filterType="date"
          />
        </ad-grid-angular>
      </div>

      <!-- Event log -->
      <div
        style="height: 130px; border: 1px solid #dee2e6; border-radius: 4px; background: #1e1e1e; overflow-y: auto; font-family: monospace; font-size: 12px; padding: 8px; box-sizing: border-box; flex-shrink: 0;"
      >
        <div style="color: #6c757d; margin-bottom: 4px; font-weight: 600;">
          filterChange events (client)
        </div>
        @for (entry of eventLog(); track $index) {
        <div style="color: #a8d8a8; padding: 2px 0; white-space: pre-wrap; word-break: break-all;">
          {{ entry }}
        </div>
        } @if (eventLog().length === 0) {
        <div style="color: #6c757d; font-style: italic;">
          Ajoutez des filtres via le bouton « Filters » de la toolbar…
        </div>
        }
      </div>
    </div>
  `,
})
class FilterClientWrapperComponent {
  readonly data = PRODUCTS_100;
  readonly eventLog = signal<string[]>([]);

  readonly categoryOptions = uniqueOptions(PRODUCTS_100, 'category');
  readonly supplierOptions = uniqueOptions(PRODUCTS_100, 'supplier');
  readonly statusOptions = uniqueOptions(PRODUCTS_100, 'status');

  onFilterChange(event: FilterEvent): void {
    const ts = new Date().toLocaleTimeString();
    const n = event.model.conditions.length;
    const summary = n === 0 ? 'aucune condition active' : `${n} condition(s) active(s)`;
    this.eventLog.update((l) => [
      `[${ts}] reason="${event.reason}" — ${summary}`,
      ...l.slice(0, 29),
    ]);
  }
}

export const FilterClient: Story = {
  name: 'Filters / Client mode',
  render: () => ({
    props: {},
    template: `<moz-story-filter-client />`,
    moduleMetadata: { imports: [FilterClientWrapperComponent] },
  }),
  parameters: {
    docs: {
      description: {
        story:
          '`filterMode="client"` (valeur par défaut) — toute l\'évaluation se fait en mémoire. ' +
          'Aucune requête réseau, réponse instantanée. Idéal pour des jeux de données déjà chargés en front. ' +
          'Supporte : texte (contains / notContains / startsWith…), nombre (gt / between…), date, set (in / notIn), booléen.',
      },
    },
  },
};

// ------------------------------------------------------------------
// Filter / Server mode
// ------------------------------------------------------------------

@Component({
  selector: 'moz-story-filter-server',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdGridAngularComponent, AdeoGridColumnDef],
  template: `
    <div style="display: flex; flex-direction: column; height: 620px; gap: 12px;">
      <!-- Banner -->
      <div
        style="padding: 12px 16px; background: #e3f2fd; border: 1px solid #90caf9; border-radius: 6px; font-size: 13px; color: #0d47a1; line-height: 1.5; display: flex; align-items: center; gap: 12px;"
      >
        <div style="flex: 1;">
          <strong>Mode serveur</strong> — la grid n'évalue aucun filtre elle-même. Chaque changement
          émet un
          <code style="background: rgba(0,0,0,.07); padding: 1px 4px; border-radius: 3px;"
            >filterChange</code
          >
          qui déclenche ici un faux appel API (<strong>délai simulé de 800 ms</strong>). La donnée
          retournée par le « serveur » est injectée dans
          <code style="background: rgba(0,0,0,.07); padding: 1px 4px; border-radius: 3px;"
            >[data]</code
          >, la pagination se recalcule automatiquement.
        </div>
        @if (isLoading()) {
        <div
          style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: #1565c0; white-space: nowrap; flex-shrink: 0;"
        >
          <span
            style="display: inline-block; width: 14px; height: 14px; border: 2px solid #1565c0; border-top-color: transparent; border-radius: 50%; animation: spin .7s linear infinite;"
          ></span>
          Requête en cours…
        </div>
        } @else {
        <div style="font-weight: 600; white-space: nowrap; flex-shrink: 0;">
          {{ data().length }} / {{ TOTAL }} résultats
        </div>
        }
      </div>

      <!-- Grid -->
      <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        <ad-grid-angular
          [data]="data()"
          [loading]="isLoading()"
          filterMode="server"
          [pagination]="true"
          [pageSize]="20"
          noResultsTitle="Aucun résultat serveur"
          noResultsDescription="Le serveur n'a retourné aucune ligne pour ces critères de filtre."
          noResultsActionLabel="Effacer les filtres"
          (filterChange)="onFilterChange($event)"
        >
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
            width="150"
            [sortable]="true"
            [filterable]="true"
          />
          <ad-grid-column-def
            field="category"
            headerName="Catégorie"
            width="160"
            [sortable]="true"
            [filterable]="true"
            filterType="set"
            [filterOptions]="categoryOptions"
          />
          <ad-grid-column-def
            field="price"
            headerName="Prix (€)"
            width="130"
            [sortable]="true"
            [filterable]="true"
            filterType="number"
          />
          <ad-grid-column-def
            field="stock"
            headerName="Stock"
            width="100"
            [sortable]="true"
            [filterable]="true"
            filterType="number"
          />
          <ad-grid-column-def
            field="supplier"
            headerName="Fournisseur"
            width="160"
            [sortable]="true"
            [filterable]="true"
            filterType="set"
            [filterOptions]="supplierOptions"
          />
          <ad-grid-column-def
            field="status"
            headerName="Statut"
            width="140"
            [sortable]="true"
            [filterable]="true"
            filterType="set"
            [filterOptions]="statusOptions"
          />
          <ad-grid-column-def
            field="available"
            headerName="Disponible"
            width="120"
            [sortable]="true"
            [filterable]="true"
            filterType="boolean"
          />
        </ad-grid-angular>
      </div>

      <!-- Event log -->
      <div
        style="height: 130px; border: 1px solid #dee2e6; border-radius: 4px; background: #1e1e1e; overflow-y: auto; font-family: monospace; font-size: 12px; padding: 8px; box-sizing: border-box; flex-shrink: 0;"
      >
        <div style="color: #6c757d; margin-bottom: 4px; font-weight: 600;">
          Timeline requêtes / réponses
        </div>
        @for (entry of eventLog(); track $index) {
        <div
          [style.color]="entry.startsWith('[') && entry.includes('←') ? '#7ec8e3' : '#a8d8a8'"
          style="padding: 2px 0; white-space: pre-wrap; word-break: break-all;"
        >
          {{ entry }}
        </div>
        } @if (eventLog().length === 0) {
        <div style="color: #6c757d; font-style: italic;">
          Ajoutez des filtres via le bouton « Filters » de la toolbar…
        </div>
        }
      </div>
    </div>

    <style>
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    </style>
  `,
})
class FilterServerWrapperComponent {
  readonly TOTAL = PRODUCTS_1000.length;

  readonly data = signal<Product[]>(PRODUCTS_1000);
  readonly isLoading = signal(false);
  readonly eventLog = signal<string[]>([]);

  readonly categoryOptions = uniqueOptions(PRODUCTS_1000, 'category');
  readonly supplierOptions = uniqueOptions(PRODUCTS_1000, 'supplier');
  readonly statusOptions = uniqueOptions(PRODUCTS_1000, 'status');

  onFilterChange(event: FilterEvent): void {
    const ts = new Date().toLocaleTimeString();
    const n = event.model.conditions.length;
    const model = event.model;

    this.eventLog.update((l) => [
      `[${ts}] → filterChange (reason="${event.reason}", ${n} condition(s)) — appel API…`,
      ...l.slice(0, 49),
    ]);
    this.isLoading.set(true);

    // Simule un round-trip réseau de 800 ms puis applique les filtres "côté serveur".
    setTimeout(() => {
      const result = fakeServerFilter(PRODUCTS_1000, model);
      this.data.set(result);
      this.isLoading.set(false);
      const ts2 = new Date().toLocaleTimeString();
      this.eventLog.update((l) => [
        `[${ts2}] ← réponse serveur : ${result.length} résultat(s) sur ${this.TOTAL}`,
        ...l.slice(0, 49),
      ]);
    }, 800);
  }
}

export const FilterServer: Story = {
  name: 'Filters / Server mode',
  render: () => ({
    props: {},
    template: `<moz-story-filter-server />`,
    moduleMetadata: { imports: [FilterServerWrapperComponent] },
  }),
  parameters: {
    docs: {
      description: {
        story:
          '`filterMode="server"` — la grid retourne la donnée brute sans aucune évaluation côté client. ' +
          'Chaque mutation du `FilterModel` émet un `filterChange` ; le consumer effectue ici un appel API ' +
          'simule (800 ms de delai), recupere les lignes filtrees, et les reinjecte dans `[data]`. ' +
          'Le spinner `[loading]` est active pendant le round-trip. ' +
          'La pagination se recalcule automatiquement sur la nouvelle donnee.',
      },
    },
  },
};

// ------------------------------------------------------------------
// Filter / Custom component
// ------------------------------------------------------------------

@Component({
  selector: 'moz-story-custom-filter-autocomplete',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MozComboboxComponent],
  template: `
    <moz-combobox
      [items]="items()"
      [value]="selected()"
      [multiple]="true"
      [searchable]="true"
      [loading]="loading()"
      [size]="'s'"
      [compact]="true"
      [clearable]="true"
      [showActions]="true"
      placeholder="Toutes les categories"
      searchPlaceholder="Rechercher une categorie..."
      noResultsText="Aucune categorie trouvee"
      (valueChange)="onSelection($any($event))"
      (searched)="onSearch($event)"
    />
  `,
})
class AutocompleteFilterComponent extends AdeoGridCustomFilter {
  readonly condition = input.required<FilterCondition>();
  readonly conditionChange = output<FilterValue>();

  readonly items = signal<MozComboboxOption<string>[]>(ALL_CATEGORY_OPTIONS);
  readonly loading = signal(false);

  readonly selected = computed<string[]>(() => {
    const v = this.condition().value.value;
    return Array.isArray(v) ? (v as string[]) : [];
  });

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  onSearch(query: string): void {
    clearTimeout(this.searchTimer);
    if (!query.trim()) {
      this.items.set(ALL_CATEGORY_OPTIONS);
      return;
    }
    this.loading.set(true);
    this.searchTimer = setTimeout(() => {
      const q = query.toLowerCase();
      this.items.set(ALL_CATEGORY_OPTIONS.filter((o) => o.label.toLowerCase().includes(q)));
      this.loading.set(false);
    }, 400);
  }

  onSelection(values: string[] | null): void {
    this.conditionChange.emit({ value: values ?? [] });
  }
}

@Component({
  selector: 'moz-story-filter-custom',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdGridAngularComponent, AdeoGridColumnDef],
  template: `
    <div style="display: flex; flex-direction: column; height: 620px; gap: 12px;">
      <!-- Banner -->
      <div
        style="padding: 12px 16px; background: #f3e5f5; border: 1px solid #ce93d8; border-radius: 6px; font-size: 13px; color: #4a148c; line-height: 1.5;"
      >
        <strong>Filtre custom</strong> — la colonne <em>Categorie</em> utilise un composant Angular
        autonome (<code style="background: rgba(0,0,0,.07); padding: 1px 4px; border-radius: 3px;"
          >AutocompleteFilterComponent</code
        >) comme editeur de valeur dans le builder. Le composant etend
        <code style="background: rgba(0,0,0,.07); padding: 1px 4px; border-radius: 3px;"
          >AdeoGridCustomFilter</code
        >, simule un appel API autocomplete (300 ms), et emet ses valeurs via
        <code style="background: rgba(0,0,0,.07); padding: 1px 4px; border-radius: 3px;"
          >conditionChange</code
        >. Les autres colonnes conservent leurs editeurs generiques. Mode : <strong>client</strong>.
      </div>

      <!-- Grid -->
      <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        <ad-grid-angular
          [data]="data"
          filterMode="client"
          [pagination]="true"
          [pageSize]="20"
          noResultsTitle="Aucun resultat"
          noResultsDescription="Aucune ligne ne correspond aux filtres actifs."
          (filterChange)="onFilterChange($event)"
        >
          <ad-grid-column-def
            field="name"
            headerName="Nom"
            width="200"
            [sortable]="true"
            [filterable]="true"
          />
          <ad-grid-column-def
            field="reference"
            headerName="Reference"
            width="150"
            [sortable]="true"
            [filterable]="true"
          />
          <!-- Colonne avec filtre custom autocomplete -->
          <ad-grid-column-def
            field="category"
            headerName="Categorie"
            width="160"
            [sortable]="true"
            [filterable]="true"
            [filterComponent]="autocompleteFilter"
            [filterIsComplete]="categoryIsComplete"
            [filterPredicate]="categoryClientFilter"
          />
          <ad-grid-column-def
            field="price"
            headerName="Prix (euro)"
            width="130"
            [sortable]="true"
            [filterable]="true"
            filterType="number"
          />
          <ad-grid-column-def
            field="stock"
            headerName="Stock"
            width="100"
            [sortable]="true"
            [filterable]="true"
            filterType="number"
          />
          <ad-grid-column-def
            field="supplier"
            headerName="Fournisseur"
            width="160"
            [sortable]="true"
            [filterable]="true"
            filterType="set"
            [filterOptions]="supplierOptions"
          />
          <ad-grid-column-def
            field="status"
            headerName="Statut"
            width="140"
            [sortable]="true"
            [filterable]="true"
            filterType="set"
            [filterOptions]="statusOptions"
          />
        </ad-grid-angular>
      </div>

      <!-- Event log -->
      <div
        style="height: 130px; border: 1px solid #dee2e6; border-radius: 4px; background: #1e1e1e; overflow-y: auto; font-family: monospace; font-size: 12px; padding: 8px; box-sizing: border-box; flex-shrink: 0;"
      >
        <div style="color: #6c757d; margin-bottom: 4px; font-weight: 600;">
          filterChange events (custom filter)
        </div>
        @for (entry of eventLog(); track $index) {
        <div style="color: #ce93d8; padding: 2px 0; white-space: pre-wrap; word-break: break-all;">
          {{ entry }}
        </div>
        } @if (eventLog().length === 0) {
        <div style="color: #6c757d; font-style: italic;">
          Ajoutez un filtre sur la colonne "Categorie" pour voir le composant custom...
        </div>
        }
      </div>
    </div>
  `,
})
class FilterCustomWrapperComponent {
  readonly data = PRODUCTS_100;
  readonly eventLog = signal<string[]>([]);

  readonly autocompleteFilter = AutocompleteFilterComponent;

  readonly supplierOptions = uniqueOptions(PRODUCTS_100, 'supplier');
  readonly statusOptions = uniqueOptions(PRODUCTS_100, 'status');

  readonly categoryIsComplete = (v: FilterValue): boolean =>
    Array.isArray(v.value) && (v.value as string[]).length > 0;

  readonly categoryClientFilter = (row: Product, v: FilterValue): boolean => {
    const selected = v.value as string[];
    if (!selected || selected.length === 0) return true;
    return selected.includes(row.category);
  };

  onFilterChange(event: FilterEvent): void {
    const ts = new Date().toLocaleTimeString();
    const conditions = event.model.conditions;
    const custom = conditions.filter((c) => c.field === 'category');
    const rest = conditions.filter((c) => c.field !== 'category');
    const parts: string[] = [];
    if (custom.length > 0) {
      const vals = (custom[0].value.value as string[] | undefined) ?? [];
      parts.push(`category IN [${vals.join(', ')}]`);
    }
    if (rest.length > 0) parts.push(`+${rest.length} autre(s)`);
    const summary = parts.length > 0 ? parts.join(', ') : 'aucun filtre actif';
    this.eventLog.update((l) => [
      `[${ts}] reason="${event.reason}" — ${summary}`,
      ...l.slice(0, 29),
    ]);
  }
}

export const FilterCustom: Story = {
  name: 'Filters / Custom component',
  render: () => ({
    props: {},
    template: `<moz-story-filter-custom />`,
    moduleMetadata: { imports: [FilterCustomWrapperComponent] },
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Filtre custom : la colonne "Categorie" branche un composant Angular autonome ' +
          '(`AutocompleteFilterComponent`) via `[filterComponent]` sur `ad-grid-column-def`. ' +
          'Le composant etend `AdeoGridCustomFilter`, simule un autocomplete avec delai, ' +
          'et emet ses valeurs via `conditionChange`. ' +
          '`[filterIsComplete]` et `[filterPredicate]` completent le contrat pour ' +
          "la completion de condition et l'evaluation cote client.",
      },
    },
  },
};
