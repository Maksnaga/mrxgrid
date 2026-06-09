import type { Meta, StoryObj } from '@storybook/angular';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AdGridAngularComponent } from '../grid';
import { AdeoGridColumnDef } from '../directives/grid-column-def';
import { Product, baseMeta, InvoiceLine, INVOICE_LINES } from './grid-stories.shared';

const meta: Meta<AdGridAngularComponent<Product>> = {
  ...baseMeta,
  title: 'Data Display/Grid/Formulas',
};

export default meta;
type Story = StoryObj<AdGridAngularComponent<Product>>;

@Component({
  selector: 'moz-story-formulas-basics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdGridAngularComponent, AdeoGridColumnDef],
  template: `
    <div style="display: flex; flex-direction: column; height: 520px; gap: 12px;">
      <div
        style="padding: 12px; background: #f7f9fb; border-radius: 6px; font-size: 13px; line-height: 1.5;"
      >
        <strong>Try it:</strong> double-click a yellow cell and enter a formula. Columns are
        lettered <code>A B C…</code> (shown above each header while editing), rows are numbered.
        Examples:
        <ul style="margin: 6px 0 0 18px;">
          <li>
            <code>=C1*D1</code> — relative A1 refs. On row 1 these target that row's price/qty;
            because neither axis is <code>$</code>-locked, the grid stores them as same-row refs, so
            reopening the editor on row 2 shows <code>=C2*D2</code> — the same formula "follows"
            each row (the <code>Subtotal</code>, <code>Tax</code>, <code>Total</code> columns are
            seeded this way).
          </li>
          <li>
            <code>=[price]*[qty]</code> — explicit same-row shorthand. Same effect as the line
            above, useful when you don't want to think about which row you're on.
          </li>
          <li>
            <code>=$C$1*$D$1</code> — <code>$</code>-locked: always targets row 1 no matter which
            row hosts the formula.
          </li>
          <li><code>=SUM(E1:E4)</code> — sum subtotals across all four rows</li>
          <li><code>=IF(G1&gt;100, "big", "small")</code> — conditional display</li>
          <li><code>=IFERROR(1/0, "N/A")</code> — error recovery</li>
        </ul>
        Changing a source cell (Price, Qty) automatically re-evaluates every dependent formula.
        Internally, formulas are stored in a stable field-keyed form —
        <code>REF(COLUMN("price"),ROW(1))</code> for pinned refs, or
        <code>REF(COLUMN("price"))</code> for same-row refs — so the letters survive column reorder.
      </div>

      <div style="flex: 1; min-height: 0;">
        <ad-grid-angular [data]="rows()" [formulas]="true" rowIdField="id" [pagination]="false">
          <ad-grid-column-def field="id" headerName="Row" width="60" />
          <ad-grid-column-def field="product" headerName="Product" width="160" [editable]="true" />
          <ad-grid-column-def
            field="price"
            headerName="Price"
            width="110"
            [editable]="true"
            cellEditor="number"
          />
          <ad-grid-column-def
            field="qty"
            headerName="Qty"
            width="80"
            [editable]="true"
            cellEditor="number"
          />
          <ad-grid-column-def
            field="subtotal"
            headerName="Subtotal"
            width="130"
            [editable]="true"
            [allowFormula]="true"
            cellClass="formula-cell"
          />
          <ad-grid-column-def
            field="tax"
            headerName="Tax (20%)"
            width="130"
            [editable]="true"
            [allowFormula]="true"
            cellClass="formula-cell"
          />
          <ad-grid-column-def
            field="total"
            headerName="Total"
            width="130"
            [editable]="true"
            [allowFormula]="true"
            cellClass="formula-cell"
          />
        </ad-grid-angular>
      </div>
    </div>
  `,
  styles: [
    `
      /* Soft yellow tint for formula-enabled columns to mirror spreadsheet UX. */
      :host ::ng-deep .formula-cell {
        background: #fffbea;
      }
    `,
  ],
})
class FormulasBasicsWrapperComponent {
  readonly rows = signal<InvoiceLine[]>(structuredClone(INVOICE_LINES));
}

export const FormulasBasics: Story = {
  name: 'Formulas / Basics',
  render: () => ({
    props: {},
    template: `<moz-story-formulas-basics />`,
    moduleMetadata: {
      imports: [FormulasBasicsWrapperComponent],
    },
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Phase 1 wiring of the formula engine. Columns declaring `allowFormula: true` accept `=…` expressions; cell values are kept in the source rows (inline storage mode) and the rendering layer reads the evaluated result via `FormulaEngine.values()`. Refs come in two flavours — classic A1 (`=C1*D1`, pinned to a row) and same-row shorthand (`=[price]*[qty]`, resolves against the host row). Same-row refs let one formula string cover every row, so the `Subtotal`, `Tax` and `Total` columns in this demo are literally identical strings duplicated across all four lines. Built-in functions include SUM, AVERAGE, IF, IFERROR, CONCAT, LEFT/RIGHT/MID, and more.',
      },
    },
  },
};

// ─── Formulas / Editor (Phase 2) ────────────────────────────────────────────

@Component({
  selector: 'moz-story-formulas-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdGridAngularComponent, AdeoGridColumnDef],
  template: `
    <div style="display: flex; flex-direction: column; height: 560px; gap: 12px;">
      <div
        style="padding: 12px; background: #f7f9fb; border-radius: 6px; font-size: 13px; line-height: 1.5;"
      >
        <strong>Interactive editor:</strong>
        <ul style="margin: 6px 0 0 18px;">
          <li>
            Double-clic sur une cellule jaune pour ouvrir l’éditeur. Les lettres
            <code>A B C…</code> apparaissent au-dessus des en-têtes pour rappeler l’adresse A1.
          </li>
          <li>
            Tape <code>=C1*D1</code> (ou <code>=[price]*[qty]</code> en raccourci). Sans
            <code>$</code>, la ref est stockée en « même ligne » : la même chaîne sert à chaque
            ligne, et l’éditeur la réaffiche avec le numéro de la ligne ouverte (<code>=C2*D2</code>
            sur la ligne 2…). Les cellules de cet exemple sont seedées une seule fois.
          </li>
          <li>
            Commence à taper <code>=S</code> — le panel d’<strong>autocomplétion</strong> propose
            SUM, SUBSTITUTE… (↑↓ pour naviguer, Entrée/Tab pour insérer, Échap pour fermer.)
          </li>
          <li>
            Clique une cellule pour <strong>insérer sa référence</strong> en notation A1
            (<code>C2</code>), glisse pour une plage (<code>C1:D4</code>), Shift+clic pour une ref
            absolue (<code>$C$2</code>). L’input <em>fx</em> en haut reste purement texte — il
            n’insère pas de refs au clic pour éviter les conflits avec la sélection.
          </li>
          <li>
            Les cellules référencées reçoivent un <strong>contour coloré</strong> synchronisé avec
            la couleur du token dans la formule.
          </li>
          <li>
            Stockage stable en forme longue : <code>REF(COLUMN("price"),ROW(2))</code> pour une ref
            figée, <code>REF(COLUMN("price"))</code> pour une ref même-ligne. L’éditeur reconvertit
            automatiquement en A1 à la réouverture, en utilisant le numéro de la ligne hôte pour les
            refs même-ligne.
          </li>
        </ul>
      </div>

      <div style="flex: 1; min-height: 0;">
        <ad-grid-angular [data]="rows()" [formulas]="true" rowIdField="id" [pagination]="false">
          <ad-grid-column-def field="id" headerName="Row" width="60" />
          <ad-grid-column-def field="product" headerName="Produit" width="160" [editable]="true" />
          <ad-grid-column-def
            field="price"
            headerName="Prix"
            width="110"
            [editable]="true"
            cellEditor="number"
          />
          <ad-grid-column-def
            field="qty"
            headerName="Qté"
            width="80"
            [editable]="true"
            cellEditor="number"
          />
          <ad-grid-column-def
            field="subtotal"
            headerName="Sous-total"
            width="150"
            [editable]="true"
            [allowFormula]="true"
            cellClass="formula-cell"
          />
          <ad-grid-column-def
            field="tax"
            headerName="TVA (20%)"
            width="150"
            [editable]="true"
            [allowFormula]="true"
            cellClass="formula-cell"
          />
          <ad-grid-column-def
            field="total"
            headerName="Total"
            width="150"
            [editable]="true"
            [allowFormula]="true"
            cellClass="formula-cell"
          />
        </ad-grid-angular>
      </div>
    </div>
  `,
  styles: [
    `
      :host ::ng-deep .formula-cell {
        background: #fffbea;
      }
    `,
  ],
})
class FormulasEditorWrapperComponent {
  readonly rows = signal<InvoiceLine[]>(structuredClone(INVOICE_LINES));
}

export const FormulasEditor: Story = {
  name: 'Formulas / Editor',
  render: () => ({
    props: {},
    template: `<moz-story-formulas-editor />`,
    moduleMetadata: {
      imports: [FormulasEditorWrapperComponent],
    },
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Phase 2 — éditeur enrichi : autocomplétion des fonctions, insertion de références par clic/drag (Shift = ref absolue), surlignage coloré des cellules référencées, et refs « même ligne » (`[field]`) qui permettent de partager une seule formule entre toutes les lignes. L’input fx global reste text-only (pas de clic-to-pick) pour ne pas interférer avec la sélection de cellules.',
      },
    },
  },
};

// ============================================================
// Filters stories — requiert l'implémentation de filterMode
// (Phase 1 du plan filter-improvement-plan.md)
// ============================================================

/** Déduplique les valeurs d'une colonne pour en faire des options de filtre "set". */
