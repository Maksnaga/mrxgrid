# AdeoGrid

A high-performance, feature-rich data grid component for Vue 3, built with the Composition API and TypeScript. Designed to handle **100,000+ rows** and **150+ columns** with smooth 60fps scrolling thanks to dual-axis virtual rendering.

Built on top of the [Mozaic Design System](https://mozaic.adeo.cloud/) (`@mozaic-ds/vue`).

---

## Table of Contents

- [Features at a Glance](#features-at-a-glance)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
  - [Component Hierarchy](#component-hierarchy)
  - [Data Pipeline](#data-pipeline)
  - [How Virtual Scrolling Works](#how-virtual-scrolling-works)
- [API Reference](#api-reference)
  - [AdeoGrid Props](#adeo-grid-props)
  - [AdeoGrid Events](#adeo-grid-events)
  - [AdeoGrid Slots](#adeo-grid-slots)
  - [Column Definition (ColumnDef)](#column-definition-columndef)
- [Core Concepts](#core-concepts)
  - [Virtual Scrolling](#virtual-scrolling)
  - [Lazy Loading (Data Source)](#lazy-loading-data-source)
  - [Cell Selection](#cell-selection)
  - [Cell Editing](#cell-editing)
  - [Cell Validation](#cell-validation)
  - [Fill Handle (Excel-style Drag)](#fill-handle-excel-style-drag)
  - [Copy / Paste / Cut](#copy--paste--cut)
  - [Sorting](#sorting)
  - [Grouping](#grouping)
  - [Column Pinning](#column-pinning)
  - [Column Resizing](#column-resizing)
  - [Column Reordering](#column-reordering)
  - [Column Visibility](#column-visibility)
  - [Row Selection](#row-selection)
  - [Row Expansion](#row-expansion)
  - [Data Density](#data-density)
  - [Keyboard Navigation](#keyboard-navigation)
- [Composables Deep Dive](#composables-deep-dive)
  - [useVirtualScroll](#usevirtualscroll)
  - [useVirtualColumns](#usevirtualcolumns)
  - [useVirtualGrid](#usevirtualgrid)
  - [useDataSource](#usedatasource)
  - [useSorting](#usesorting)
  - [useGrouping](#usegrouping)
  - [useColumns](#usecolumns)
  - [usePinnedColumns](#usepinnedcolumns)
  - [useColumnResize](#usecolumnresize)
  - [useColumnDnD](#usecolumndnd)
  - [useActiveCell](#useactivecell)
  - [useCellSelection](#usecellselection)
  - [useCellEditing](#usecellediting)
  - [useFillHandle](#usefillhandle)
  - [useClipboard](#useclipboard)
  - [useKeyboard](#usekeyboard)
  - [useMouseSelection](#usemouseselection)
  - [useRowSelection](#userowselection)
  - [useRowExpansion](#userowexpansion)
  - [useTeleportListbox](#useteleportlistbox)
- [Performance Patterns](#performance-patterns)
- [Styling & CSS Architecture](#styling--css-architecture)
- [Project Commands](#project-commands)
- [Code Conventions](#code-conventions)

---

## What's new in Phase 1.0

Capabilities added during the Angular → Vue migration push beyond the base
features below. See [`docs/MIGRATION-PLAN.md`](docs/MIGRATION-PLAN.md) for
the full rationale.

| Capability | Surface |
|---|---|
| **Formula engine** | Spreadsheet-style formulas (`=SUM(A1:A10)`, `=IF(...)`, …) on columns flagged `allowFormula: true`. Tokenizer / parser / evaluator / DAG / cycle detection / 30+ built-in functions. Auto-syncs from `=…` strings baked in `props.rows`. Custom functions via `useFormulaEngine.setFunctions(…)`. |
| **Excel-style cut/paste** | `Ctrl+X` marks the source range with marching-ants outline; `Ctrl+V` then moves (clears the source after pasting). `Esc` cancels the pending cut. |
| **`<AdeoColumn>` declarative API** | Alternative to `:columns` prop — `<AdeoColumn field="..." header-name="..."><template #cell="...">…</template></AdeoColumn>`. Slots wired via the registry. |
| **Per-field slots** | `#cell-{field}`, `#header-{field}`, `#filter-{field}`, `#edit-{field}` resolve before the generic ones. |
| **`<AdeoFormulaBar>`** | A1-style cell label + `fx` indicator + edit input. Shows `displayFormula` when the active cell is formula-backed. Imperative `insertText()` for wiring with the reference drawer. |
| **`<AdeoFormulaReferenceDrawer>`** | Categorised list of formula functions; emits `insert` with `name + '('` for direct wiring with the formula bar. |
| **`<AdeoColumnVisibilityPanel>`** | Popover listing hidden columns with restore buttons. |
| **`<AdeoKeyboardShortcutsDrawer>`** | Drawer with the full shortcut reference (FR-localised). |
| **Variable-height virtual scroll** | `useVariableHeightVirtualScroll` engine for grids with detail rows / wrapped cells / rich group rows whose heights are unknown ahead of time. |
| **Plugin model** | `<AdeoGrid :plugins="[useMyPlugin()]">` — plugins receive `{ state, engine }` on init, return a cleanup function. |
| **Imperative ref API** | `grid.value.exportCsv()`, `undo()`, `validateAll()`, `setFormula()`, `persistView()`, `tree.flatten()`, … See [Imperative ref API](#imperative-ref-api) below. |
| **Auto-persist** | `persistKey` prop auto-saves columns + sorts + filters to `localStorage`; `historyId` mirrors undo/redo stacks. |
| **Cell validation auto-run** | When any column declares `cellValidator`, the grid auto-validates on `rows`/`columns` change. |
| **Cut visual + ref-color borders** | `gridState.cutSource` drives the marching-ants edges; `useRefHighlight` colours cells referenced by the formula being edited. |

## Imperative ref API

```ts
import type { AdeoGrid as AdeoGridType } from '@/components/AdeoGrid'
const grid = ref<InstanceType<typeof AdeoGridType>>()
```

Methods exposed on the ref:

| Group | Methods |
|---|---|
| Filter | `clearFilters()` · `setFilter(field, value)` · `getFilterModel()` |
| Sort / group | `getSortModel()` · `clearSort()` · `getGroupModel()` · `clearGroups()` |
| Selection | `selectionModel` · `selectedCount` · `selectAll()` · `clearSelection()` · `getSelectedRows()` |
| Export | `exportCsv({ filename?, separator?, columns? })` · `exportJson({ filename?, columns? })` |
| History | `undo()` · `redo()` · `clearHistory()` |
| Validation | `validateAll()` · `getCellError(rowIndex, field)` · `hasCellError(rowIndex, field)` |
| Formula | `setFormula({ rowId, field }, '=A1+B1')` · `getFormula(addr)` · `getFormulaValue(addr)` |
| Persistence | `persistView(key)` · `restoreView(key)` |
| Tree | `tree.flatten(data, config, expanded, idField)` · `tree.toggleNode(key)` · `tree.expandAll(...)` · `tree.collapseAll()` |

## Plugin example

```ts
import type { AdeoGridPlugin } from '@/components/AdeoGrid'
import { watch } from 'vue'

export function useAuditPlugin(): AdeoGridPlugin {
  return {
    name: 'audit',
    init({ state }) {
      const stop = watch(state.activeSorts, (s) => console.log('sort changed', s))
      return () => stop()
    },
  }
}

// usage
<AdeoGrid :plugins="[useAuditPlugin()]" />
```

## Formula example

```ts
const columns = [
  { field: 'qty', headerName: 'Qty', editable: true, allowFormula: true },
  { field: 'price', headerName: 'Price', editable: true, allowFormula: true },
  { field: 'total', headerName: 'Total', editable: true, allowFormula: true },
]
const rows = [
  { id: 1, qty: 5, price: 10, total: '=[qty]:1 * [price]:1' },
  { id: 2, qty: 3, price: 20, total: '=SUM([total]:1, [qty]:2 * [price]:2)' },
]
```

The grid auto-detects the `=…` strings, registers them with `useFormulaEngine`,
evaluates them, and displays the computed values. Editing a value upstream
(e.g. row 1's `qty`) re-evaluates every dependent cell in topological order.

---

## Features at a Glance

| Feature | Description |
|---|---|
| **Dual-axis virtual scroll** | Renders only visible rows AND columns. Handles 100k+ rows x 150+ cols. |
| **Lazy loading** | Page-based data source fetches rows on demand as the user scrolls. |
| **Multi-column sorting** | Click headers to sort. Hold Shift for multi-column sort stack. |
| **Hierarchical grouping** | Group rows by one or more fields. Expand/collapse groups. |
| **Cell selection** | Rectangular range selection (click + drag, Shift+click, Ctrl+click for multi-range). |
| **Inline editing** | Double-click or type to edit. Built-in text input or custom editors via slots. |
| **Cell validation** | Per-column validators with visual error indicators (red border + danger icon + tooltip). |
| **Fill handle** | Excel-style drag handle to replicate values across cells. |
| **Clipboard** | Copy/paste/cut in TSV format (compatible with Excel, Google Sheets). |
| **Column pinning** | Pin columns to left or right edge. Sticky positioning during scroll. |
| **Column resize** | Drag column edges to resize. |
| **Column reorder** | Drag column headers to reorder. |
| **Column visibility** | Hide/show columns via settings drawer or column menu. |
| **Row selection** | Checkbox-based row selection (none/some/all states). |
| **Row expansion** | Expandable row detail via custom slot. |
| **Data density** | Compact (25px), default (37px), comfortable (45px) row heights. |
| **Keyboard navigation** | Full keyboard support: arrows, Tab, Enter, Home/End, Page Up/Down, Ctrl+A. |
| **Fullscreen mode** | Toggle fullscreen view. |

---

## Getting Started

### Prerequisites

- **Node.js:** ^20.19.0 || >=22.12.0
- **Vue 3** with Composition API
- **TypeScript** (strict mode recommended)

### Installation

```bash
npm install
```

### Quick Start

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { AdeoGrid } from '@/components/AdeoGrid'
import type { ColumnDef, RowData } from '@/components/AdeoGrid'

const columns: ColumnDef[] = [
  { field: 'id', headerName: 'ID', width: '80px' },
  { field: 'name', headerName: 'Name', width: '200px', editable: true },
  { field: 'email', headerName: 'Email', width: '250px', editable: true },
]

const rows = ref<RowData[]>([
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' },
])
</script>

<template>
  <AdeoGrid :columns="columns" :rows="rows" />
</template>
```

For a fully-featured demo with 100k rows, lazy loading, sorting, grouping, editing, and more, see [`src/App.vue`](src/App.vue).

---

## Architecture Overview

### Component Hierarchy

```
AdeoGrid.vue                    <-- Root orchestrator (wires ~20 composables)
 |
 +-- AdeoGridGroupBar.vue        <-- "Grouped by: [Field] [x]" bar
 +-- AdeoGridHiddenBar.vue       <-- "N columns hidden [Show all]" bar
 +-- <slot #toolbar />          <-- Optional toolbar (AdeoGridToolbar)
 |
 +-- AdeoGridHeader.vue          <-- Sticky column headers (sort, resize, menu)
 |    +-- AdeoColumnMenu.vue     <-- Per-column context menu (teleported to body)
 |
 +-- AdeoGridGroupRow.vue        <-- Group header (when grouping is active)
 +-- AdeoGridRow.vue             <-- Data row container
 |    +-- AdeoGridCell.vue       <-- Individual cell (display + edit + validation)
 +-- AdeoGridExpandedRow.vue     <-- Expanded row detail (slot content)
```

**Companion components** (imported separately):
- `AdeoGridToolbar` -- Fullscreen, grouping, settings buttons
- `AdeoGroupingDrawer` -- Side drawer to configure grouping
- `AdeoTableMenuDrawer` -- Side drawer for density, column visibility, column order

### Data Pipeline

Data flows through a transformation pipeline inside `AdeoGrid.vue`:

```
props.rows
   |
   v
useSorting          --> sortedRows (multi-column sort applied)
   |
   v
useGrouping         --> flatRows (group headers + data rows, respecting expand/collapse)
   |
   v
renderableRows      --> the array fed to the virtual scroller
   |
   v
useVirtualGrid      --> renderRange (only the visible row indices)
   |
   v
Template renders only the visible slice of renderableRows
```

Each step is a `computed` -- Vue automatically tracks dependencies and only recomputes what changed.

### How Virtual Scrolling Works

The grid uses a clever layout to support both virtual scrolling and sticky pinned columns:

```html
<div class="adeo-grid-wrapper" @scroll="handleScroll">

  <!-- Sticky header: position: sticky; top: 0 -->
  <AdeoGridHeader />

  <!-- Virtual body -->
  <div class="adeo-grid-body">

    <!-- Sizer div: sets scrollbar height = totalCount x rowHeight -->
    <div :style="{ height: totalHeight + 'px' }">

      <!-- Top spacer: pushes visible rows to correct scroll position -->
      <div :style="{ height: offsetY + 'px' }" />

      <!-- Only the visible rows are rendered here -->
      <AdeoGridRow v-for="i in renderRange" :key="i" ... />

    </div>
  </div>
</div>
```

**Why a top spacer instead of `transform: translateY`?**
A CSS `transform` creates a new containing block that traps `position: sticky` children. Pinned columns use `position: sticky`, so they would break. The height-based spacer avoids this entirely.

**Why `min-width` on body rows?**
All rows and the header have `min-width: totalContentWidth`. This gives sticky (pinned) columns room to "stick" within their scrolling container.

---

## API Reference

### AdeoGrid Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `columns` | `ColumnDef[]` | *required* | Column definitions |
| `rows` | `RowData[]` | *required* | Row data array |
| `rowId` | `(row, index) => string` | index as string | Extract a stable unique id from each row |
| `selectable` | `boolean` | `false` | Show row checkboxes |
| `expandable` | `boolean` | `false` | Show row expand buttons |
| `virtualScroll` | `boolean` | `false` | Enable vertical virtualization |
| `virtualColumns` | `boolean` | `false` | Enable horizontal virtualization |
| `containerHeight` | `number` | `600` | Viewport height in px (when `virtualScroll` is true) |
| `overscan` | `number` | `5` | Extra rows rendered above/below viewport |
| `columnOverscan` | `number` | `2` | Extra columns rendered left/right of viewport |
| `totalCount` | `number` | `rows.length` | Total dataset size (for scrollbar with lazy loading) |
| `onVisibleRangeChange` | `(start, end) => void` | -- | Callback when visible row range changes (for lazy loading) |
| `pagination` | `boolean \| PaginationConfig` | `false` | Enable pagination. Pass an object for `defaultPageSize` / `pageSizeOptions` |
| `serverFilter` | `boolean` | `false` | Delegate filtering to the server (grid emits `filterChange` and leaves rows untouched) |
| `serverGrouping` | `ServerGroupingOptions` | -- | Delegate grouping to the server (async `fetchGroups` / `fetchGroupRows`) |
| `hiddenFields` | `string[]` | `[]` | Fields of hidden columns (controlled — pair with `update:hiddenFields`) |
| `groupFields` | `string[]` | `[]` | Fields to group by |
| `columnOrder` | `string[]` | `[]` | Custom column display order |
| `density` | `'compact' \| 'default' \| 'comfortable'` | `'default'` | Row height preset |
| `fullscreen` | `boolean` | `false` | Fullscreen mode |

### AdeoGrid Events

| Event | Payload | Description |
|---|---|---|
| `update:selectedRows` | `number[]` | Selected row indices changed |
| `update:hiddenFields` | `string[]` | Hidden fields list changed |
| `cellEdit` | `CellEditEvent` | A cell was edited and committed |
| `fill` | `FillEvent` | Fill handle drag completed |
| `columnMenuAction` | `ColumnMenuAction` | Column menu action triggered |

### AdeoGrid Slots

#### `#toolbar`

Place a toolbar above the grid header. Typically used with `AdeoGridToolbar`:

```vue
<AdeoGrid ...>
  <template #toolbar>
    <AdeoGridToolbar
      :fullscreen="isFullscreen"
      @toggle-fullscreen="toggleFullscreen"
      @open-grouping="groupingDrawerOpen = true"
      @open-settings="settingsDrawerOpen = true"
    />
  </template>
</AdeoGrid>
```

#### `#cell`

Customize how cells render and edit. Receives the full cell context:

```vue
<AdeoGrid ...>
  <template #cell="{ value, field, editing, editValue, updateValue, commit, cancel }">
    <!-- Custom editor for the "role" column -->
    <template v-if="field === 'role'">
      <MyRoleEditor
        v-if="editing"
        :value="editValue"
        @change="updateValue"
        @save="commit('down')"
        @cancel="cancel()"
      />
      <RoleBadge v-else :role="value" />
    </template>

    <!-- Default behavior for other columns (return nothing = built-in fallback) -->
  </template>
</AdeoGrid>
```

**Slot props:**

| Prop | Type | Description |
|---|---|---|
| `value` | `unknown` | Current cell value from `row[field]` |
| `row` | `RowData` | Full row data object |
| `field` | `string` | Column field name |
| `rowIndex` | `number` | Row index in the dataset |
| `column` | `ColumnDef` | Full column definition |
| `active` | `boolean` | Whether this cell is the active (focused) cell |
| `editing` | `boolean` | Whether this cell is in edit mode |
| `editValue` | `unknown` | Draft value during editing |
| `startEdit` | `() => void` | Programmatically enter edit mode |
| `updateValue` | `(v: unknown) => void` | Update the draft value |
| `commit` | `(dir?: 'down'\|'right'\|'left') => void` | Commit edit and move focus |
| `cancel` | `() => void` | Cancel edit, revert to original value |

#### `#expand-row`

Custom content shown when a row is expanded:

```vue
<AdeoGrid expandable ...>
  <template #expand-row="{ row }">
    <div>
      <h3>Details for {{ row.name }}</h3>
      <p>{{ row.description }}</p>
    </div>
  </template>
</AdeoGrid>
```

### Column Definition (ColumnDef)

```typescript
interface ColumnDef {
  field: string                // Key in row data object
  headerName: string           // Display label in header
  width?: string               // CSS width (e.g. "150px", "10rem")
  resizable?: boolean          // Allow drag-to-resize (default: true)
  pinned?: 'left' | 'right' | null  // Pin to left or right edge
  editable?: boolean           // Allow inline editing
  renderer?: 'text' | Component     // Custom cell renderer component
  rendererProps?: Record<string, unknown>  // Extra props for renderer
  valueValidator?: (value: unknown) => boolean           // Pre-paste validation
  cellValidator?: (value: unknown, row: RowData) => true | string  // Display-time validation
}
```

---

## Core Concepts

### Virtual Scrolling

The grid only renders rows and columns that are visible in the viewport, plus a small overscan buffer. This is what makes it possible to handle 100k+ rows without any lag.

**How it works:**

1. The scroll container has a "sizer" div whose height equals `totalRows x rowHeight`. This gives the browser the correct scrollbar size.
2. On every scroll event, the composable computes which row indices are visible: `firstVisible = Math.floor(scrollTop / rowHeight)`.
3. Only those rows (plus overscan) are rendered in the DOM.
4. A "top spacer" div pushes the visible rows to the correct vertical position.

**Write-on-change guard:** If the user scrolls by less than one row height, the visible range doesn't change, so Vue skips the render entirely. This is the single biggest performance win -- most scroll events become zero-cost.

**Horizontal virtualization** works similarly: column positions are pre-computed, and a binary search finds the first visible column on each scroll tick. Left/right spacer divs replace the off-screen columns.

### Lazy Loading (Data Source)

For large datasets, you don't want to load all rows upfront. `useDataSource` provides page-based lazy loading:

```typescript
import { useDataSource } from '@/composables/useDataSource'

const { rows, isLoading, loadedCount, requestRange } = useDataSource({
  totalRows: ref(100_000),
  fetchRows: async (start, end) => {
    const response = await fetch(`/api/rows?start=${start}&end=${end}`)
    return response.json()
  },
  pageSize: 200,  // Fetch 200 rows per request
})
```

**How it works:**

1. `rows` is a dense array of length `totalRows`. Unfetched slots contain a frozen `LOADING_ROW` sentinel (`{ __mrxSkeleton: true }`).
2. When the grid reports a visible range change via `onVisibleRangeChange`, you call `requestRange(start, end)`.
3. The composable quantizes the range into page boundaries and fetches only pages that aren't cached or in-flight.
4. Fetched rows are stored in a sparse `Map<index, RowData>` cache. A version counter bump triggers `rows` to recompute.
5. Cells render `value ?? ''` for skeleton rows, so they appear as blank cells with a shimmer animation.

**Duplicate prevention:** A `Set<number>` tracks in-flight page numbers. If page 7 is already being fetched, a second scroll into that region doesn't trigger another request.

### Cell Selection

The grid supports Excel-style rectangular cell selection:

- **Click** a cell to activate it (blue outline)
- **Shift+Click** to select a rectangular range from the active cell to the clicked cell
- **Ctrl+Click** to add a new range (multi-range selection)
- **Click+Drag** to select a range by dragging
- **Ctrl+A** to select all cells
- **Escape** (first press) to clear selection, (second press) to deactivate

The selection model stores:
- **Active cell:** The single focused cell (row + column)
- **Anchor cell:** Fixed corner for Shift-extend operations
- **Frozen ranges:** Previously committed ranges (from Ctrl+Click)
- **Current range:** Live range from anchor to active cell

Visual feedback:
- Selected cells get a blue background
- Range edges get blue borders (top, bottom, left, right)
- The fill handle (6x6 blue square) appears at the bottom-right corner of the selection

### Cell Editing

Double-click a cell (or start typing) to enter edit mode.

**Built-in editor:** A plain `<input>` appears inside the cell. Press Enter to commit and move down, Tab to commit and move right, Escape to cancel.

**Custom editors:** Use the `#cell` slot to provide custom editors per column:

```vue
<template #cell="{ field, editing, editValue, updateValue, commit, cancel }">
  <template v-if="field === 'role'">
    <MyCombobox
      v-if="editing"
      :value="editValue"
      @update:value="updateValue"
      @select="commit('down')"
    />
    <span v-else>{{ value }}</span>
  </template>
</template>
```

**Key design detail:** The editing state lives in the `useCellEditing` composable, not in the cell component. This means if a cell is scrolled out of the virtual window (unmounted) and then scrolled back in (remounted), its editing state and draft value survive. The cell picks up where it left off.

**Cursor stability:** The built-in input uses a local `ref` instead of binding directly to the prop. This avoids cursor position resets: the prop round-trip (input -> emit -> composable -> prop) is async, but the local ref updates synchronously so the browser's caret never jumps.

### Cell Validation

Columns can define validators that highlight invalid cells:

```typescript
const columns: ColumnDef[] = [
  {
    field: 'email',
    headerName: 'Email',
    editable: true,
    // Display-time validation: runs on every render
    cellValidator: (value) => {
      if (!value || !String(value).includes('@')) return 'Must be a valid email'
      return true
    },
    // Paste/fill-time validation: gates what values are accepted
    valueValidator: (value) => String(value).includes('@'),
  },
]
```

**`cellValidator`** runs on every render. If it returns a string (error message):
- The cell gets a red bottom border
- A danger icon (triangle with `!`) appears at the right edge of the cell
- Hovering the icon shows a tooltip with the error message (teleported to `<body>` to escape scroll container clipping)
- When the cell is active (focused), it also gets a light red background

**`valueValidator`** runs before paste operations. If it returns `false`, the value is rejected and the cell is not updated. It does not affect the fill handle — a column marked `editable: true` always accepts fills.

### Fill Handle (Excel-style Drag)

The small blue square at the bottom-right corner of the selection is the **fill handle**. Drag it to replicate cell values:

- **Drag down:** Copies source values into rows below, cycling if the target is larger than the source
- **Drag up/left/right:** Same, in the respective direction
- **Direction detection:** Uses pixel distance (not cell count) so the fill feels natural regardless of row height vs column width differences

A column with `editable: true` always accepts fills — `valueValidator` does not block the fill handle (it only applies to paste).

### Copy / Paste / Cut

The grid uses **TSV format** (tab-separated values) for clipboard operations, which is the standard used by Excel, Google Sheets, and AG Grid.

| Shortcut | Action |
|---|---|
| `Ctrl+C` | Copy selected cells |
| `Ctrl+X` | Cut (copy + clear) |
| `Ctrl+V` | Paste at active cell |
| `Delete` / `Backspace` | Clear selected cells |

**Paste behavior:**
- **No selection (single active cell):** Paste starting from active cell, one clipboard cell per grid cell
- **Selection exists:** Tile (repeat) clipboard data cyclically to fill entire selection rectangle

Paste respects `valueValidator`: columns that reject a value are skipped.

### Sorting

Click a column header to sort. The sort cycles through: **unsorted -> ascending -> descending -> unsorted**.

**Multi-column sort:** Hold **Shift** while clicking to add to the sort stack. A badge shows the sort position (e.g., "1" = primary sort, "2" = secondary).

```
Comparison logic:
1. null/undefined values sort first
2. Numbers: numeric comparison
3. Strings: localeCompare
4. Everything else: coerce to string
```

The sort always creates a **shallow copy** of the rows array -- it never mutates the source data.

### Grouping

Group rows by one or more columns. When grouping is active, the grid displays a flat list of **group headers** and **data rows**.

Group headers show:
- Expand/collapse chevron
- Column name + group value (e.g., "STATUS **Active** 1,234")
- Row count

**Metadata convention:** Group rows use `__mrx`-prefixed fields to avoid collisions with user data:

```typescript
// Type guard to check if a row is a group header:
import { isGroupRow } from '@/components/AdeoGrid'

if (isGroupRow(row)) {
  console.log(row.__mrxField)   // "status"
  console.log(row.__mrxValue)   // "active"
  console.log(row.__mrxCount)   // 1234
  console.log(row.__mrxDepth)   // 0 (nesting level)
}
```

**Performance:**
- Tree build: O(n x d) where n = rows, d = group depth
- Flatten: O(visible) -- collapsed branches are skipped entirely, making expand/collapse nearly instant even with 100k+ rows

### Column Pinning

Pin columns to the left or right edge so they stay visible while scrolling horizontally:

```typescript
const columns: ColumnDef[] = [
  { field: 'id', headerName: 'ID', pinned: 'left' },
  { field: 'name', headerName: 'Name' },  // scrollable center
  { field: 'actions', headerName: '', pinned: 'right' },
]
```

Pinned columns use `position: sticky` with computed `left` / `right` offsets. They get a subtle box-shadow at the edge to indicate the pinned boundary.

When any column is pinned, the checkbox and expand button columns also become sticky (pinned to the left).

### Column Resizing

Drag the right edge of any column header to resize. The minimum width is **50px**.

Runtime widths are stored in a reactive object. If a column doesn't have a runtime width, it falls back to `ColumnDef.width`, then a default of 150px.

### Column Reordering

Drag a column header to reorder it within its zone:
- Left-pinned columns can only be reordered among left-pinned columns
- Center columns among center columns
- Right-pinned columns among right-pinned columns

A visual drop indicator shows where the column will land. The drag activates after a 5px movement threshold to distinguish from clicks.

### Column Visibility

Hide columns via the column menu (right-click a header) or the settings drawer. A `AdeoGridHiddenBar` appears above the grid showing how many columns are hidden with a "Show all" button.

### Row Selection

When `selectable` is true, each row gets a checkbox. The header checkbox has three states:
- **Unchecked:** No rows selected
- **Indeterminate:** Some rows selected
- **Checked:** All rows selected

```vue
<AdeoGrid selectable v-model:selected-rows="selected" ...>
```

### Row Expansion

When `expandable` is true, each row gets an expand button. Provide the `#expand-row` slot to render custom detail content:

```vue
<AdeoGrid expandable ...>
  <template #expand-row="{ row }">
    <pre>{{ JSON.stringify(row, null, 2) }}</pre>
  </template>
</AdeoGrid>
```

### Data Density

Three density presets control row height:

| Density | Row Height |
|---|---|
| `compact` | 25px |
| `default` | 37px |
| `comfortable` | 45px |

When density changes, scroll position is preserved proportionally (the first visible row stays stable).

### Keyboard Navigation

| Shortcut | Action |
|---|---|
| `Arrow keys` | Move active cell |
| `Shift+Arrow` | Extend selection |
| `Ctrl+Arrow` | Jump to edge of data |
| `Ctrl+Shift+Arrow` | Jump to edge + extend selection |
| `Tab` / `Shift+Tab` | Move right/left (wraps to next/prev row) |
| `Enter` / `Shift+Enter` | Move down/up |
| `Home` / `End` | Jump to first/last column |
| `Ctrl+Home` / `Ctrl+End` | Jump to first/last cell in grid |
| `Page Up` / `Page Down` | Scroll by one viewport height |
| `Ctrl+A` | Select all cells |
| `Escape` | Clear selection (1st press) / deactivate cell (2nd press) |
| `F2` or any character | Enter edit mode |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copy / Cut / Paste |
| `Delete` / `Backspace` | Clear selected cells |

---

## Composables Deep Dive

The grid's features are split into focused composables, each owning one concern. They are all wired together in `AdeoGrid.vue`.

### useVirtualScroll

**File:** `src/composables/useVirtualScroll.ts`

Vertical virtual scrolling engine. Takes a scroll event and computes which row indices to render. The output is an integer range `[startIndex, endIndex)` -- no arrays are allocated on scroll.

**Key design decisions:**

1. **Index-based, not array-based.** No `slice()` or `push()` on every scroll tick. The template reads `getRow(i)` directly.
2. **Synchronous onScroll.** The scroll handler writes to `shallowRef` in the same frame as the browser scroll, so the row container and scrollbar are always in sync.
3. **Write-on-change guard.** If `scrollTop` moves by less than one row height, the indices don't change and no shallowRef is written. Vue skips the render entirely. This is the biggest win for 60fps.
4. **totalHeight decoupled from rows.length.** When `totalCount` is provided, scrollbar height is fixed from the start. Loading more data never changes `scrollHeight`, so no feedback loop is possible.
5. **Max rendered cap (80 rows).** Prevents perf degradation when row height is very small (compact density).

```typescript
const { startIndex, endIndex, getRow, onScroll, totalHeight } = useVirtualScroll({
  rows,
  rowHeight: 37,
  containerHeight: ref(500),
  overscan: 5,
  totalCount: ref(100_000),
})
```

### useVirtualColumns

**File:** `src/composables/useVirtualColumns.ts`

Horizontal virtual scrolling for columns. Pre-computes column positions once, then uses **binary search** to find the first visible column on each horizontal scroll. Uses `requestAnimationFrame` throttling to collapse multiple scroll events between paints into a single recompute.

### useVirtualGrid

**File:** `src/composables/useVirtualGrid.ts`

Unified 2D virtualization orchestrator. Combines `useVirtualScroll` (rows) and `useVirtualColumns` (columns) into one. Provides a single `handleScroll` handler and computed render ranges for both axes. Also manages the scroll container ref and `ResizeObserver` for container height sync.

### useDataSource

**File:** `src/composables/useDataSource.ts`

Page-based lazy data loading.

```
Architecture:

  useVirtualScroll (visible range)
         |
         v
  useDataSource
    1. Quantize [start, end] into page numbers
    2. Skip pages already cached or in-flight
    3. Fetch missing pages via fetchRows()
    4. Write results into sparse cache (Map<index, row>)
    5. Bump version counter -> rows recomputes
         |
         v
  AdeoGrid (receives dense rows array)
```

The sparse cache (`Map<number, RowData>`) avoids making 100k entries reactive. A version counter (`shallowRef`) is bumped after each cache write, triggering the `rows` computed to rebuild from the cache.

### useSorting

**File:** `src/composables/useSorting.ts`

Multi-column sort with a sort stack. Toggling a column cycles: **not sorted -> asc -> desc -> removed**. Maintains a stack of `SortState` objects. Multi-sort (Shift+click) adds to the stack instead of replacing.

Comparison: nulls first, then numeric comparison for numbers, `localeCompare` for strings.

### useGrouping

**File:** `src/composables/useGrouping.ts`

Full hierarchical grouping engine. Internally builds a tree structure (`GroupNode`) using `Map` for O(1) group lookup at each level. The tree is then flattened into a renderable `RowData[]` list, emitting group headers and data rows with `__mrx`-prefixed metadata.

**Performance trick:** `flattenTree` only traverses expanded branches. Collapsed groups emit just their header row and skip all children. This makes expand/collapse nearly instant even with 100k rows.

### useColumns

**File:** `src/composables/useColumns.ts`

Column visibility, pinning overrides, filter toggles, and display order. Maintains the single source of truth for column order. When new columns arrive, existing order is preserved for fields still present, new fields are appended, removed fields are dropped.

### usePinnedColumns

**File:** `src/composables/usePinnedColumns.ts`

Splits columns into left-pinned, center, right-pinned groups and computes sticky CSS offsets.

Layout: `[checkbox?] [expand?] [left-pinned] [center (scrollable)] [right-pinned]`

Z-index strategy: header pinned = 3, body pinned = 2, active cell = 1.

### useColumnResize

**File:** `src/composables/useColumnResize.ts`

Drag-to-resize columns. Minimum width: 50px. Attaches document-level `mousemove`/`mouseup` handlers during drag. Stores runtime widths in a reactive object, falling back to `ColumnDef.width` when no override exists.

### useColumnDnD

**File:** `src/composables/useColumnDnD.ts`

Drag-and-drop column reordering. Uses a 5px movement threshold before activating drag. Creates ghost + drop indicator elements. Auto-scrolls near viewport edges. Respects pin zones (left/center/right columns can only reorder within their zone).

### useActiveCell

**File:** `src/composables/useActiveCell.ts`

Single focused cell tracking + auto-scroll. Provides navigation methods: `move()`, `jumpToEdge()`, `tab()`, `enter()`, `homeEnd()`, `page()`. Each method clamps to grid bounds and scrolls the container so the active cell stays in view.

Auto-scroll only scrolls for center (non-pinned) columns. Left/right pinned columns are always visible.

### useCellSelection

**File:** `src/composables/useCellSelection.ts`

Rectangular range selection model. Stores an anchor cell (fixed corner) and active cell (moving corner). The current range is the normalized rectangle between them. Supports frozen ranges (Ctrl+click) for multi-range selection.

### useCellEditing

**File:** `src/composables/useCellEditing.ts`

Inline cell editing lifecycle. **Key invariant:** At most one cell in edit mode at any time. Stores `{ rowIndex, field, originalValue, draftValue }`. Committing returns a `CellEditEvent` with old and new values. Cancelling reverts to `originalValue`.

### useFillHandle

**File:** `src/composables/useFillHandle.ts`

Excel-style fill-handle drag. Direction is detected using **pixel distance** (not cell count). Source values are replicated cyclically into the target range. Any column with `editable: true` always accepts the fill — `valueValidator` is not consulted.

### useClipboard

**File:** `src/composables/useClipboard.ts`

Copy/paste/cut in TSV format. Paste tiling: when a selection exists, clipboard data is repeated cyclically to fill the entire selection rectangle (same behavior as Excel).

### useKeyboard

**File:** `src/composables/useKeyboard.ts`

Pure event-to-callback translator. Translates raw `KeyboardEvent`s into semantic callbacks. Does not own any state. Handles the full modifier matrix (plain, Shift, Ctrl/Cmd, Ctrl+Shift).

### useMouseSelection

**File:** `src/composables/useMouseSelection.ts`

Converts mouse drag events into cell selection. Handles coordinate mapping from `clientX/clientY` to grid cell indices, accounting for sticky header height, utility column width, border compensation (`el.clientLeft`, `el.clientTop`), and scroll offset. Auto-scrolls when the mouse approaches viewport edges.

### useRowSelection

**File:** `src/composables/useRowSelection.ts`

Checkbox-based row selection with none/some/all states.

### useRowExpansion

**File:** `src/composables/useRowExpansion.ts`

Toggle row expansion state.

### useTeleportListbox

**File:** `src/composables/useTeleportListbox.ts`

Teleports dropdown listboxes to `<body>` with `position: fixed`. Used for combobox editors inside grid cells. The grid's scroll container has `overflow: auto` which clips dropdowns. This composable moves the dropdown to `<body>` and positions it using `getBoundingClientRect()`, with scroll/resize listeners for repositioning and `MutationObserver` for auto-cleanup.

---

## Performance Patterns

These are the key patterns that make AdeoGrid handle 100k+ rows at 60fps:

| Pattern | Why |
|---|---|
| **Index-based virtual scroll** | No `slice()` per scroll tick. Template reads `getRow(i)` directly. |
| **Write-on-change guard** | `shallowRef` only written when visible range shifts by >= 1 row. Sub-row-height scrolls are free. |
| **Top spacer, not transform** | `translateY` creates a containing block that traps `position: sticky`. Height-based spacer avoids this. |
| **Decoupled totalHeight** | `totalCount x rowHeight` is fixed from the start. No scrollbar recalibration on data load. No feedback loops. |
| **Sparse cache, not reactive array** | Data stored in `Map<number, RowData>`. Version counter triggers recompute. No 100k reactive entries. |
| **Binary search for columns** | O(log n) to find first visible column during horizontal scroll. |
| **RAF throttling** | Multiple scroll events between paints collapse to one column recompute. |
| **Group tree memoization** | Tree build runs O(n x d) only when rows/groupFields change. Flatten runs O(visible). |
| **Single getCellFlags call** | AdeoGridRow calls `getCellFlags` once per cell, not 7x (once per visual flag). |
| **Max rendered cap (80)** | Prevents DOM overload when row height is very small (compact density). |
| **`contain: layout style paint`** | CSS containment on each cell: browser can skip layout/paint for off-screen cells. |
| **`contain: size layout style`** | On editing cells: prevents editor content (combobox, input) from expanding the row height. |
| **Proportional scroll preservation** | On density change, first visible row stays stable. No jarring scroll jumps. |

---

## Styling & CSS Architecture

- All components use **scoped CSS** (`<style scoped>`)
- Teleported elements (column menu, error tooltips) use **unscoped styles** in a separate `<style>` block
- Cell containment: `contain: layout style paint` for maximum rendering isolation
- Editing cells: `contain: size layout style` with `overflow: visible` -- prevents content from expanding the row, while allowing dropdown overlays to escape
- Invalid cells: `border-bottom: 2px solid #ef4444` (red border only, no background unless focused)
- Selection colors: `#dbeafe` (selected), `#3b82f6` (selection edges and active outline)
- Pinned column shadows: `box-shadow: 2px 0 4px rgba(0,0,0,0.08)` for visual depth
- Skeleton rows: shimmer animation using `background-size: 200%` with linear gradient

---

## Project Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (localhost:5173) |
| Build | `npm run build` (type-check + vite build) |
| Type-check only | `npx vue-tsc --build` |
| Unit tests | `npm run test:unit` (vitest, watch mode) |
| Single test file | `npx vitest run src/__tests__/SomeFile.spec.ts` |
| E2E tests | `npm run test:e2e` (playwright: chromium, firefox, webkit) |
| Single E2E test | `npm run test:e2e -- e2e/SomeFile.spec.ts --project=chromium` |
| Lint (all) | `npm run lint` (oxlint then eslint, both with --fix) |
| Format | `npm run format` |

E2E tests auto-start the dev server and run headed locally. First-time setup: `npx playwright install`.

---

## Code Conventions

- **Vue 3 `<script setup>`** with Composition API for all components
- **TypeScript strict mode** with `noUncheckedIndexedAccess: true`
- **No semicolons**, single quotes, 100-char print width (Prettier)
- **Path alias:** `@` maps to `./src`
- **Scoped CSS** in all SFCs
- **Dual linting:** oxlint (correctness errors) then eslint (vue/ts rules)
- **Reactive patterns:**
  - `Ref<T>` for mutable state
  - `Computed<T>` for derived state
  - `shallowRef<T>` for large objects (no deep reactivity)
  - Manual `triggerRef()` for controlled reactivity triggers
