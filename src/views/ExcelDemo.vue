<script setup lang="ts">
/**
 * Excel-focused demo — small in-memory dataset showing every Excel-style
 * interaction the grid supports. Use this view to exercise:
 *
 *   • Click cell → focused (blue outline)
 *   • Shift+Click → range
 *   • Click+drag → range
 *   • Ctrl+Click → multi-range
 *   • Arrow keys / Tab / Enter → navigation
 *   • Ctrl+A → select all
 *   • Ctrl+Home / End → jump to corners
 *   • F2 or any printable key → enter edit
 *   • Enter / Tab / Esc → commit / cancel
 *   • Ctrl+C / Ctrl+X / Ctrl+V → copy / cut (marching ants) / paste
 *   • Drag the blue square at bottom-right of selection → fill replicate
 *   • Backspace / Delete → clear selected cells
 *   • Ctrl+Z / Ctrl+Y → undo / redo
 *   • Type `=A1+B1` or `=[qty]*[price]` in a formula column → formula registered + evaluated
 *
 * Kept tiny (8 cols × 30 rows, no lazy loading) so every interaction is
 * immediately visible.
 */

import { computed, ref } from 'vue'
import {
  MrxGrid,
  MrxFormulaBar,
  MrxFormulaReferenceDrawer,
  MrxKeyboardShortcutsDrawer,
} from '@/components/MrxGrid'
import type { ColumnDef, RowData, CellEditEvent, FillEvent } from '@/components/MrxGrid'

// ─── Columns ──────────────────────────────────────────────────────────────

const columns: ColumnDef[] = [
  { field: 'id', headerName: 'ID', width: '60px', pinned: 'left' },
  { field: 'name', headerName: 'Name', width: '160px', editable: true },
  { field: 'role', headerName: 'Role', width: '120px', editable: true },
  {
    field: 'email',
    headerName: 'Email',
    width: '220px',
    editable: true,
    cellValidator: (v) =>
      typeof v === 'string' && v.includes('@') ? true : 'Invalid email',
  },
  { field: 'qty', headerName: 'Qty', width: '90px', editable: true },
  { field: 'price', headerName: 'Price', width: '110px', editable: true },
  // Phase 1.0 — formula columns: type `=[qty]*[price]` or `=E1*F1` to register
  {
    field: 'subtotal',
    headerName: 'Subtotal (formula)',
    width: '180px',
    editable: true,
    allowFormula: true,
  },
  {
    field: 'tax',
    headerName: 'Tax 20% (formula)',
    width: '180px',
    editable: true,
    allowFormula: true,
  },
]

// ─── Rows — kept small + with baked-in formulas in last 2 cols ────────────

function makeRow(i: number): RowData {
  return {
    id: i + 1,
    name: ['Alice', 'Bob', 'Charlie', 'Dana', 'Erik', 'Fiona', 'George', 'Hana'][i % 8],
    role: ['Admin', 'Editor', 'Viewer', 'Moderator'][i % 4],
    email: i === 5 ? 'invalid-email' : `user${i + 1}@example.com`,
    qty: (i + 1) * 2,
    price: 10 + (i % 5) * 5,
    // Same-row formulas — refer to the host row's qty/price.
    subtotal: '=[qty]*[price]',
    tax: '=[subtotal]*0.20',
  }
}

const rows = ref<RowData[]>(Array.from({ length: 30 }, (_, i) => makeRow(i)))

// ─── Grid ref + actions for the imperative API demo ───────────────────────

const gridRef = ref<InstanceType<typeof MrxGrid>>()
const formulaBarRef = ref<InstanceType<typeof MrxFormulaBar>>()

const formulaReferenceOpen = ref(false)
const keyboardShortcutsOpen = ref(false)

const flatColumns = computed(() => columns)

function onCellEdit(event: CellEditEvent) {
  const row = rows.value[event.rowIndex]
  if (!row) return
  // Coerce numeric columns
  if (event.field === 'qty' || event.field === 'price') {
    const n = Number(event.newValue)
    row[event.field] = Number.isFinite(n) ? n : event.newValue
  } else {
    row[event.field] = event.newValue
  }
}

function onFill(event: FillEvent) {
  for (const fill of event.fills) {
    const row = rows.value[fill.rowIndex]
    if (row) row[fill.field] = fill.value
  }
}

function onFormulaInsert(text: string) {
  formulaBarRef.value?.insertText(text)
  formulaBarRef.value?.focusInput()
}

function onExportCsv() {
  gridRef.value?.exportCsv({ filename: 'excel-demo.csv' })
}
function onUndo() {
  gridRef.value?.undo()
}
function onRedo() {
  gridRef.value?.redo()
}
</script>

<template>
  <div class="excel-demo">
    <header class="excel-demo__header">
      <h1>MrxGrid · Excel-style demo</h1>
      <p class="excel-demo__subtitle">
        Small focused dataset — every Excel interaction is immediately testable.
      </p>
    </header>

    <section class="excel-demo__instructions">
      <strong>Try these:</strong>
      <ul>
        <li><kbd>Click</kbd> a cell · <kbd>Shift+Click</kbd> for a range · <kbd>Ctrl+Click</kbd> for multi-range · drag to select</li>
        <li><kbd>F2</kbd> or just type to edit · <kbd>Enter</kbd> to commit · <kbd>Esc</kbd> to cancel</li>
        <li><kbd>Ctrl+C</kbd> · <kbd>Ctrl+X</kbd> (marching ants) · <kbd>Ctrl+V</kbd> · <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd></li>
        <li>Drag the small blue square at the bottom-right of a selection to <strong>fill</strong></li>
        <li>Type <code>=[qty]*[price]</code> or <code>=E1*F1</code> in the formula columns</li>
        <li>The <code>email</code> column has a validator — try an invalid value</li>
      </ul>
    </section>

    <div class="excel-demo__bar">
      <button type="button" @click="onExportCsv">Export CSV</button>
      <button type="button" @click="onUndo">Undo</button>
      <button type="button" @click="onRedo">Redo</button>
      <button type="button" @click="formulaReferenceOpen = !formulaReferenceOpen">
        {{ formulaReferenceOpen ? 'Hide' : 'Show' }} formula reference
      </button>
      <button type="button" @click="keyboardShortcutsOpen = !keyboardShortcutsOpen">
        {{ keyboardShortcutsOpen ? 'Hide' : 'Show' }} keyboard shortcuts
      </button>
    </div>

    <!-- Formula bar lives in the same DOM tree as the grid — but inject only
         reaches descendants, so for now the bar shows a placeholder until
         we wire a shared context. The grid itself handles formula commits
         through its own internal flush, no bar needed for it to work. -->
    <MrxFormulaBar ref="formulaBarRef" :all-columns="flatColumns" :rows="rows" />

    <MrxGrid
      ref="gridRef"
      :columns="columns"
      :rows="rows"
      :container-height="600"
      virtual-scroll
      history-id="excel-demo"
      @cell-edit="onCellEdit"
      @fill="onFill"
    />

    <!-- Sprint 7 — drawers own their MDrawer wrapper now. -->
    <MrxKeyboardShortcutsDrawer
      :open="keyboardShortcutsOpen"
      @update:open="keyboardShortcutsOpen = $event"
    />
    <MrxFormulaReferenceDrawer
      :open="formulaReferenceOpen"
      @update:open="formulaReferenceOpen = $event"
      @insert="onFormulaInsert"
    />
  </div>
</template>

<style scoped>
.excel-demo {
  padding: 20px 24px 80px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: system-ui, -apple-system, sans-serif;
}

.excel-demo__header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #1a73e8;
}

.excel-demo__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: #555;
}

.excel-demo__instructions {
  margin: 16px 0;
  padding: 12px 16px;
  border: 1px solid #cdd4d8;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 13px;
  color: #333;
}

.excel-demo__instructions ul {
  margin: 6px 0 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.excel-demo__instructions code,
.excel-demo__instructions kbd {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
  background: #fff;
  border: 1px solid #cdd4d8;
  border-radius: 3px;
  padding: 1px 5px;
}

.excel-demo__bar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.excel-demo__bar button {
  padding: 6px 12px;
  border: 1px solid #cdd4d8;
  border-radius: 4px;
  background: #fff;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.excel-demo__bar button:hover {
  background: #eef6ff;
  border-color: #1a73e8;
}

.excel-demo__drawer {
  position: fixed;
  top: 80px;
  left: 24px;
  width: 400px;
  max-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #cdd4d8;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 100;
}

.excel-demo__drawer--right {
  left: auto;
  right: 24px;
}

.excel-demo__drawer header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #e0e0e0;
}

.excel-demo__drawer h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.excel-demo__drawer header button {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  border-radius: 50%;
}

.excel-demo__drawer header button:hover {
  background: #f0f0f0;
}
</style>
