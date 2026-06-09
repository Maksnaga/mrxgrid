import type { Meta, StoryObj } from '@storybook/angular';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdGridAngularComponent } from '../grid';
import { AdeoGridColumnDef } from '../directives/grid-column-def';
import { MozComboboxComponent } from '@mozaic-ds/angular';
import { Product, PRODUCTS_100, GRID_WRAPPER, baseMeta, TAG_LABELS, generateProductsWithTags } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Data Display/Grid/Editing',
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

export const WithInlineEditing: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      categoryOptions: [
        { text: 'Peinture', value: 'Peinture' },
        { text: 'Outillage', value: 'Outillage' },
        { text: 'Plomberie', value: 'Plomberie' },
        { text: 'Électricité', value: 'Électricité' },
        { text: 'Jardin', value: 'Jardin' },
        { text: 'Revêtement', value: 'Revêtement' },
        { text: 'Quincaillerie', value: 'Quincaillerie' },
        { text: 'Menuiserie', value: 'Menuiserie' },
      ],
      onCellEdit: (event: unknown) => console.log('Cell edited:', event),
      gridWrapper: GRID_WRAPPER,
    },
    template: `
      <div [style]="gridWrapper">
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20"
                   (cellEdit)="onCellEdit($event)">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" [editable]="true" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" [sortable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="180" [sortable]="true" [editable]="true" cellEditor="select" [cellEditorOptions]="categoryOptions" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" [editable]="true" cellEditor="number" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" [editable]="true" cellEditor="number" />
          <ad-grid-column-def field="supplier" headerName="Fournisseur" width="150" [sortable]="true" />
          <ad-grid-column-def field="status" headerName="Statut" width="130" [sortable]="true" />
        </ad-grid-angular>
      </div>
    `,
  }),
};

export const WithCustomCellEdit: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
      onCellEdit: (event: unknown) => console.log('cellEdit', event),
      onBulkEdit: (event: unknown) => console.log('bulkEdit', event),
      onBulkCopy: (event: unknown) => console.log('bulkCopy', event),
      onBulkPaste: (event: unknown) => console.log('bulkPaste', event),
      onBulkDelete: (event: unknown) => console.log('bulkDelete', event),
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Double-click a cell to edit. The <strong>Statut</strong> column uses a custom edit template with badge buttons.
          Select multiple cells (Shift+click or Shift+Arrow) to see the bulk action bar.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20"
                   [rowSelection]="true"
                   (cellEdit)="onCellEdit($event)"
                   (bulkEdit)="onBulkEdit($event)"
                   (bulkCopy)="onBulkCopy($event)"
                   (bulkPaste)="onBulkPaste($event)"
                   (bulkDelete)="onBulkDelete($event)">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" [editable]="true" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" [sortable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" [editable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" [editable]="true" cellEditor="number" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" [editable]="true" cellEditor="number" />
          <ad-grid-column-def field="supplier" headerName="Fournisseur" width="150" [sortable]="true" />
          <ad-grid-column-def field="status" headerName="Statut" width="200" [sortable]="true"
                                [editable]="true" cellEditor="custom" [editTemplate]="statusEditTpl" [cellTemplate]="statusCellTpl" />
        </ad-grid-angular>

        <ng-template #statusCellTpl let-value>
          <span [style.padding]="'2px 8px'" [style.border-radius]="'4px'" [style.font-size]="'12px'" [style.font-weight]="'500'"
                [style.background]="value === 'En stock' ? '#d4edda' : value === 'Rupture' ? '#f8d7da' : value === 'En commande' ? '#fff3cd' : '#e2e3e5'"
                [style.color]="value === 'En stock' ? '#155724' : value === 'Rupture' ? '#721c24' : value === 'En commande' ? '#856404' : '#383d41'">
            {{ value }}
          </span>
        </ng-template>

        <ng-template #statusEditTpl let-value let-updateDraft="updateDraft" let-commitEdit="commitEdit">
          <div style="display: flex; gap: 4px; padding: 2px 0;">
            <button type="button" (click)="updateDraft('En stock'); commitEdit()"
                    style="padding: 2px 8px; border-radius: 4px; border: 1px solid #d4edda; background: #d4edda; color: #155724; font-size: 11px; cursor: pointer; font-weight: 500;">
              En stock
            </button>
            <button type="button" (click)="updateDraft('Rupture'); commitEdit()"
                    style="padding: 2px 8px; border-radius: 4px; border: 1px solid #f8d7da; background: #f8d7da; color: #721c24; font-size: 11px; cursor: pointer; font-weight: 500;">
              Rupture
            </button>
            <button type="button" (click)="updateDraft('En commande'); commitEdit()"
                    style="padding: 2px 8px; border-radius: 4px; border: 1px solid #fff3cd; background: #fff3cd; color: #856404; font-size: 11px; cursor: pointer; font-weight: 500;">
              En commande
            </button>
            <button type="button" (click)="updateDraft('Limité'); commitEdit()"
                    style="padding: 2px 8px; border-radius: 4px; border: 1px solid #e2e3e5; background: #e2e3e5; color: #383d41; font-size: 11px; cursor: pointer; font-weight: 500;">
              Limité
            </button>
          </div>
        </ng-template>
      </div>
    `,
  }),
};

@Component({
  selector: 'moz-story-combobox-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdGridAngularComponent, AdeoGridColumnDef, MozComboboxComponent],
  template: `
    <div style="display: flex; flex-direction: column; height: 600px; gap: 8px;">
      <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
        Double-click the <strong>Tags</strong> column to edit with a multiselect combobox. Use the
        fill handle (small square on focused cell) to copy values down. Drag cells to select a
        range.
      </p>
      <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        <ad-grid-angular
          [data]="data"
          [pagination]="true"
          [pageSize]="20"
          (cellEdit)="onCellEdit($event)"
          (fillDown)="onFillDown($event)"
        >
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def
            field="name"
            headerName="Nom"
            width="200"
            [sortable]="true"
            [editable]="true"
          />
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
          <ad-grid-column-def
            field="price"
            headerName="Prix (€)"
            width="120"
            [sortable]="true"
            [editable]="true"
            cellEditor="number"
          />
          <ad-grid-column-def
            field="tags"
            headerName="Tags"
            width="260"
            [sortable]="false"
            [editable]="true"
            cellEditor="custom"
            [cellTemplate]="tagsCellTpl"
            [editTemplate]="tagsEditTpl"
          />
          <ad-grid-column-def field="status" headerName="Statut" width="130" [sortable]="true" />
        </ad-grid-angular>
      </div>

      <ng-template #tagsCellTpl let-value>
        <div style="display: flex; gap: 4px; flex-wrap: nowrap; overflow: hidden;">
          @for (tag of toArray(value); track tag) {
          <span
            style="padding: 1px 6px; border-radius: 3px; font-size: 11px; font-weight: 500;
                         background: var(--color-background-accent); color: var(--color-text-accent);"
          >
            {{ labelOf(tag) }}
          </span>
          }
        </div>
      </ng-template>

      <ng-template #tagsEditTpl let-value let-updateDraft="updateDraft" let-commitEdit="commitEdit">
        <moz-combobox
          [items]="tagOptions"
          [value]="value"
          [multiple]="true"
          [searchable]="true"
          [compact]="true"
          [size]="'s'"
          (valueChange)="updateDraft($event)"
          (closed)="commitEdit()"
        />
      </ng-template>
    </div>
  `,
})
class ComboboxCellWrapperComponent {
  data = generateProductsWithTags(100);

  readonly tagOptions = Object.entries(TAG_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  toArray(value: unknown): string[] {
    return Array.isArray(value) ? value : [];
  }

  labelOf(tag: string): string {
    return TAG_LABELS[tag] ?? tag;
  }

  onCellEdit(event: unknown): void {
    console.log('cellEdit', event);
  }

  onFillDown(event: unknown): void {
    console.log('fillDown', event);
  }
}

export const WithCellValidation: Story = {
  render: () => ({
    props: {
      data: PRODUCTS_100,
      gridWrapper: GRID_WRAPPER,
      nameValidator: (value: unknown) => {
        if (!value || String(value).trim() === '') {
          return { message: 'Le nom est obligatoire' };
        }
        if (String(value).length < 3) {
          return { message: 'Le nom doit contenir au moins 3 caractères' };
        }
        return null;
      },
      priceValidator: (value: unknown) => {
        const num = Number(value);
        if (isNaN(num) || num <= 0) {
          return { message: 'Le prix doit être un nombre positif' };
        }
        if (num > 10000) {
          return { message: 'Le prix ne peut pas dépasser 10 000 €' };
        }
        return null;
      },
      stockValidator: (value: unknown) => {
        const num = Number(value);
        if (isNaN(num) || num < 0) {
          return { message: 'Le stock ne peut pas être négatif' };
        }
        return null;
      },
    },
    template: `
      <div [style]="gridWrapper">
        <p style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 14px;">
          Cellules avec validation dynamique. Éditez une cellule pour déclencher une erreur. Survolez l'icône pour voir le message.
        </p>
        <ad-grid-angular [data]="data" [pagination]="true" [pageSize]="20">
          <ad-grid-column-def field="id" headerName="ID" width="80" [sortable]="true" />
          <ad-grid-column-def field="name" headerName="Nom" width="200" [sortable]="true" [editable]="true" [cellValidator]="nameValidator" />
          <ad-grid-column-def field="reference" headerName="Référence" width="150" [sortable]="true" />
          <ad-grid-column-def field="category" headerName="Catégorie" width="150" [sortable]="true" />
          <ad-grid-column-def field="price" headerName="Prix (€)" width="120" [sortable]="true" [editable]="true" cellEditor="number" [cellValidator]="priceValidator" />
          <ad-grid-column-def field="stock" headerName="Stock" width="100" [sortable]="true" [editable]="true" cellEditor="number" [cellValidator]="stockValidator" />
          <ad-grid-column-def field="supplier" headerName="Fournisseur" width="150" [sortable]="true" />
          <ad-grid-column-def field="status" headerName="Statut" width="130" [sortable]="true" />
        </ad-grid-angular>
      </div>
    `,
  }),
};

export const WithComboboxCell: Story = {
  render: () => ({
    props: {},
    template: `<moz-story-combobox-cell />`,
    moduleMetadata: {
      imports: [ComboboxCellWrapperComponent],
    },
  }),
};
