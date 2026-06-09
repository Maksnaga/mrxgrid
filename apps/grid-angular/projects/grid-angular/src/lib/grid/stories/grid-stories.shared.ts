import { moduleMetadata } from '@storybook/angular';
import type { Meta } from '@storybook/angular';
import { AdGridAngularComponent } from '../grid';
import { AdeoGridColumnDef } from '../directives/grid-column-def';
import { AdeoGridToolbarDef } from '../directives/grid-toolbar-def';
import { MozButtonComponent, MozComboboxOption } from '@mozaic-ds/angular';
import { FilterModel, FilterCondition } from '../models/filter.model';

export interface Product {
  id: number;
  name: string;
  reference: string;
  category: string;
  price: number;
  stock: number;
  supplier: string;
  status: string;
  available: boolean;
  lastUpdated: string;
}

export function generateProducts(count: number): Product[] {
  const categories = [
    'Peinture',
    'Outillage',
    'Plomberie',
    'Électricité',
    'Jardin',
    'Revêtement',
    'Quincaillerie',
    'Menuiserie',
  ];
  const suppliers = [
    'Bosch',
    'Makita',
    'Stanley',
    'Schneider',
    'Legrand',
    'Weber',
    'Sika',
    'Hilti',
  ];
  const statuses = ['En stock', 'Rupture', 'En commande', 'Limité'];

  return Array.from({ length: count }, (_, i) => {
    const day = String((i % 28) + 1).padStart(2, '0');
    const month = String((i % 12) + 1).padStart(2, '0');
    return {
      id: i + 1,
      name: `Produit ${i + 1}`,
      reference: `REF-${String(i + 1).padStart(5, '0')}`,
      category: categories[i % categories.length],
      price: Math.round((Math.random() * 500 + 5) * 100) / 100,
      stock: Math.floor(Math.random() * 1000),
      supplier: suppliers[i % suppliers.length],
      status: statuses[i % statuses.length],
      available: i % 3 !== 0,
      lastUpdated: `2025-${month}-${day}`,
    };
  });
}

export const PRODUCTS_100 = generateProducts(100);
export const PRODUCTS_1000 = generateProducts(1000);

export const GRID_WRAPPER = 'height: 400px; display: flex; flex-direction: column;';

export interface ProductWithTags extends Product {
  tags: string[];
}

export const TAG_LABELS: Record<string, string> = {
  promo: 'Promo',
  new: 'Nouveauté',
  eco: 'Éco-responsable',
  premium: 'Premium',
  bestseller: 'Best-seller',
  fragile: 'Fragile',
  heavy: 'Lourd',
  seasonal: 'Saisonnier',
};

export function generateProductsWithTags(count: number): ProductWithTags[] {
  const tagKeys = Object.keys(TAG_LABELS);
  return generateProducts(count).map((p, i) => ({
    ...p,
    tags: tagKeys.filter((_, ti) => (i + ti) % 3 === 0),
  }));
}

export interface WideRow {
  id: number;
  [key: string]: string | number;
}

export function generateWideRows(rowCount: number, colCount: number): WideRow[] {
  return Array.from({ length: rowCount }, (_, r) => {
    const row: WideRow = { id: r + 1 };
    for (let c = 0; c < colCount; c++) {
      row[`c${c}`] = `R${r + 1}·C${c + 1}`;
    }
    return row;
  });
}

export const WIDE_COL_COUNT = 80;

export const WIDE_ROWS = generateWideRows(500, WIDE_COL_COUNT);

export const WIDE_COLS = Array.from({ length: WIDE_COL_COUNT }, (_, c) => `c${c}`);

// ---------------------------------------------------------------------------
// InfiniteScroll — async data loading on scroll
// ---------------------------------------------------------------------------

export interface ShortcutGroup {
  title: string;
  items: { keys: string; label: string }[];
}

export const EXCEL_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    items: [
      { keys: '← ↑ → ↓', label: 'Déplacer la cellule active' },
      { keys: 'Ctrl + ←/→/↑/↓', label: 'Sauter au bord du bloc de données' },
      { keys: 'Home / End', label: 'Début / fin de la ligne' },
      { keys: 'Ctrl + Home / End', label: 'Première / dernière cellule' },
      { keys: 'PageUp / PageDown', label: 'Page précédente / suivante' },
      { keys: 'Tab / Shift+Tab', label: 'Cellule suivante / précédente' },
      { keys: 'Enter / Shift+Enter', label: 'Descendre / remonter' },
    ],
  },
  {
    title: 'Sélection',
    items: [
      { keys: 'Shift + ← ↑ → ↓', label: 'Étendre la plage' },
      { keys: 'Shift + Ctrl + Flèche', label: "Étendre jusqu'au bord du bloc" },
      { keys: 'Shift + Home / End', label: 'Étendre au début / fin de la ligne' },
      { keys: 'Shift + Ctrl + Home / End', label: 'Étendre au début / fin du tableau' },
      { keys: 'Shift + PageUp / Down', label: "Étendre d'une page" },
      { keys: 'Ctrl + A', label: 'Sélectionner tout' },
      { keys: 'Shift + Space', label: 'Sélectionner la ligne' },
      { keys: 'Ctrl + Space', label: 'Sélectionner la colonne' },
    ],
  },
  {
    title: 'Édition',
    items: [
      { keys: 'Enter / F2', label: 'Entrer en édition' },
      { keys: 'Touche imprimable', label: 'Typing-to-edit (remplace la valeur)' },
      { keys: 'Escape', label: "Annuler l'édition" },
      { keys: 'Enter', label: 'Valider + descendre' },
      { keys: 'Tab / Shift+Tab', label: 'Valider + droite / gauche' },
      { keys: 'Alt + Enter', label: 'Retour à la ligne (texte)' },
      { keys: 'Ctrl + Enter', label: 'Valider + remplir la sélection' },
      { keys: 'Backspace / Delete', label: 'Effacer les cellules sélectionnées' },
    ],
  },
  {
    title: 'Presse-papier',
    items: [
      { keys: 'Ctrl + C', label: 'Copier (TSV)' },
      { keys: 'Ctrl + X', label: 'Couper (marching ants)' },
      { keys: 'Ctrl + V', label: 'Coller (déplace après Ctrl+X)' },
      { keys: 'Ctrl + D', label: 'Remplir vers le bas (fill down)' },
      { keys: 'Ctrl + R', label: 'Remplir vers la droite (fill right)' },
    ],
  },
  {
    title: 'Historique',
    items: [
      { keys: 'Ctrl + Z', label: 'Annuler (undo)' },
      { keys: 'Ctrl + Y / Ctrl + Shift + Z', label: 'Rétablir (redo)' },
      { keys: '→ stateKey', label: 'Historique persisté (localStorage, 50 ops)' },
    ],
  },
];

export interface InvoiceLine {
  id: string;
  product: string;
  price: number;
  qty: number;
  /** Inline storage: starts with `=` when the user enters a formula. */
  subtotal: number | string;
  /** Same as above, for the tax row. */
  tax: number | string;
  /** Same as above, for the grand total. */
  total: number | string;
}

// Formulas are stored in AG-Grid-style long form. Two shapes are supported:
//   - Explicit row: `REF(COLUMN("<field>"),ROW(<n>))` — locks the ref to a
//     specific row index.
//   - Same row:    `REF(COLUMN("<field>"))` — resolves against the cell
//     hosting the formula. Surface syntax is `[field]`, which lets the same
//     formula string live on every row without per-row duplication.
// The editor converts the A1 / `[field]` surface ↔ storage on open/commit,
// so these strings survive column reorder/rename (the field is the stable key).

export const SUBTOTAL_FORMULA = '=REF(COLUMN("price"))*REF(COLUMN("qty"))';

export const TAX_FORMULA = '=REF(COLUMN("subtotal"))*0.2';

export const TOTAL_FORMULA = '=REF(COLUMN("subtotal"))+REF(COLUMN("tax"))';

export const INVOICE_LINES: InvoiceLine[] = [
  {
    id: 'L1',
    product: 'Peinture 5L',
    price: 29.9,
    qty: 3,
    subtotal: SUBTOTAL_FORMULA,
    tax: TAX_FORMULA,
    total: TOTAL_FORMULA,
  },
  {
    id: 'L2',
    product: 'Perceuse',
    price: 149,
    qty: 1,
    subtotal: SUBTOTAL_FORMULA,
    tax: TAX_FORMULA,
    total: TOTAL_FORMULA,
  },
  {
    id: 'L3',
    product: 'Boîte vis',
    price: 4.5,
    qty: 20,
    subtotal: SUBTOTAL_FORMULA,
    tax: TAX_FORMULA,
    total: TOTAL_FORMULA,
  },
  {
    id: 'L4',
    product: 'Câble 100m',
    price: 89,
    qty: 2,
    subtotal: SUBTOTAL_FORMULA,
    tax: TAX_FORMULA,
    total: TOTAL_FORMULA,
  },
];

export function uniqueOptions(data: Product[], key: keyof Product): { value: unknown; label: string }[] {
  return [...new Set(data.map((p) => String(p[key])))].sort().map((v) => ({ value: v, label: v }));
}

/**
 * Évaluation côté story des conditions pour simuler ce que ferait le serveur.
 * Implémente les opérateurs courants — suffisant pour la démo.
 */

export function fakeServerFilter(data: Product[], model: FilterModel): Product[] {
  const complete = model.conditions.filter((c) => {
    if (!c.field) return false;
    const valueless = new Set(['blank', 'notBlank']);
    if (valueless.has(c.operator)) return true;
    return c.value.value != null && c.value.value !== '';
  });
  if (complete.length === 0) return data;

  return data.filter((row) => {
    let pass = evalCondition(row, complete[0]);
    for (let i = 1; i < complete.length; i++) {
      const result = evalCondition(row, complete[i]);
      pass = complete[i].combinator === 'and' ? pass && result : pass || result;
    }
    return pass;
  });
}

export function evalCondition(row: Product, c: FilterCondition): boolean {
  const raw = (row as unknown as Record<string, unknown>)[c.field];
  const { value, valueTo } = c.value;

  switch (c.operator) {
    case 'contains':
      return String(raw ?? '')
        .toLowerCase()
        .includes(String(value ?? '').toLowerCase());
    case 'notContains':
      return !String(raw ?? '')
        .toLowerCase()
        .includes(String(value ?? '').toLowerCase());
    case 'equals':
      if (typeof raw === 'boolean')
        return raw === (value === true || value === 'true' || value === 1);
      return String(raw ?? '').toLowerCase() === String(value ?? '').toLowerCase();
    case 'notEquals':
      return String(raw ?? '').toLowerCase() !== String(value ?? '').toLowerCase();
    case 'startsWith':
      return String(raw ?? '')
        .toLowerCase()
        .startsWith(String(value ?? '').toLowerCase());
    case 'endsWith':
      return String(raw ?? '')
        .toLowerCase()
        .endsWith(String(value ?? '').toLowerCase());
    case 'gt':
      return toNum(raw) > toNum(value);
    case 'gte':
      return toNum(raw) >= toNum(value);
    case 'lt':
      return toNum(raw) < toNum(value);
    case 'lte':
      return toNum(raw) <= toNum(value);
    case 'between':
      return toNum(raw) >= toNum(value) && toNum(raw) <= toNum(valueTo);
    case 'in': {
      const arr = Array.isArray(value) ? value : [value];
      return arr.some((v) => String(v) === String(raw));
    }
    case 'notIn': {
      const arr = Array.isArray(value) ? value : [value];
      return !arr.some((v) => String(v) === String(raw));
    }
    case 'blank':
      return raw == null || raw === '';
    case 'notBlank':
      return raw != null && raw !== '';
    default:
      return true;
  }
}

export function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// ------------------------------------------------------------------
// Filter / Client mode
// ------------------------------------------------------------------

export const ALL_CATEGORY_OPTIONS: MozComboboxOption<string>[] = [
  'Peinture',
  'Outillage',
  'Plomberie',
  'Electricite',
  'Jardin',
  'Revetement',
  'Quincaillerie',
  'Menuiserie',
].map((v) => ({ value: v, label: v }));

/**
 * Filtre custom "combobox autocomplete" :
 *  - MozComboboxComponent multi-select + searchable
 *  - La recherche (searched) declenche un faux appel API (400 ms) qui filtre les options
 *  - La selection emet conditionChange vers le FilterEngine
 */

export const baseMeta: Omit<Meta<AdGridAngularComponent<Product>>, 'title'> = {
  tags: ['experimental'],
  component: AdGridAngularComponent,
  decorators: [
    moduleMetadata({
      imports: [AdGridAngularComponent, AdeoGridColumnDef, AdeoGridToolbarDef, MozButtonComponent],
    }),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A high-performance, enterprise-grade data grid with virtual scrolling, sorting, pagination, column resize, inline editing, and a column header menu.',
      },
    },
  },
};
