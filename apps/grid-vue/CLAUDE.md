# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AdeoGrid is a high-performance Vue 3 + TypeScript data grid component (AG-Grid-style) built on Mozaic Design System (`@mozaic-ds/vue`). Designed for 100k+ rows × 150+ columns with dual-axis virtual scroll. The repo is mid-migration from a legacy composable-based architecture toward an "Angular-parity" engine architecture (mirroring `mozaic-ng`'s `moz-grid`); both layers coexist today — see Architecture below.

The README.md is the comprehensive user-facing API reference (props, events, slots, ColumnDef, every feature). Treat it as authoritative for public API.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (localhost:5173) |
| Build | `npm run build` (parallel type-check + vite build) |
| Type-check only | `npx vue-tsc --build` |
| Unit tests | `npm run test:unit` (vitest, watch mode) |
| Single test file | `npx vitest run path/to/File.spec.ts` |
| E2E tests | `npm run test:e2e` (playwright — chromium, firefox, webkit) |
| Single E2E test | `npm run test:e2e -- e2e/SomeFile.spec.ts --project=chromium` |
| Lint (all) | `npm run lint` (oxlint then eslint, both with --fix) |
| Format | `npm run format` |
| Storybook | `npm run storybook` (port 6006) |
| Build Storybook | `npm run build-storybook` |
| CSS parity audit | `node scripts/css-audit.mjs --base <ng-url> --target <vue-url> --selector ... --properties ...` |

E2E tests auto-start the dev server and run **headed** locally; CI uses `npm run preview` (port 4173) and runs headless. First-time setup: `npx playwright install`.

Unit tests live in two places: `src/__tests__/` (Vue/composable tests) and `src/components/AdeoGrid/features/__tests__/` (engine tests).

## Architecture

### Two coexisting layers (mid-migration)

The grid currently runs on **two parallel implementations** of the same features. Don't pick one over the other arbitrarily — match the surrounding code:

1. **Legacy composables** (`src/composables/use*.ts`) — owns most of the runtime today. `AdeoGrid.vue` imports ~20 of these directly and wires them by hand. Each composable holds its own local state.
2. **Engine layer** (`src/components/AdeoGrid/{state,engine,features,models}/`) — the Angular-parity port. Central `GridState` + `useGridEngine()` orchestrates a pure-computed pipeline:
   `sourceData → sortedData → filteredData → paginatedData → displayRows`
   Each `*Engine.ts` reads/writes `GridState` instead of owning local state. New features and refactors land here. `AdeoGrid.vue` already creates a `GridState` and calls `useGridEngine()` alongside the legacy composables — they're wired in parallel and both write to the same DOM.

When in doubt about engine semantics, the comment headers in `state/useGridState.ts` and `engine/useGridEngine.ts` explicitly reference the Angular source files (`projects/mozaic-ng/src/lib/grid/...`) for 1:1 comparison.

### Component hierarchy (`src/components/AdeoGrid/`)

```
AdeoGrid.vue                 root orchestrator (props/events, provides GridState + ColumnRegistry)
AdeoColumn.vue               declarative column API — registers via ADEO_GRID_COLUMN_REGISTRY_KEY
components/
  header/                   AdeoGridHeader, AdeoGridHeaderCell, AdeoGridHeaderMenu, AdeoGridFilterRow,
                            AdeoGridFilterCell, AdeoColumnFilterOverlay, AdeoGridGroupBar,
                            AdeoGridHiddenBar, AdeoGridSpreadsheetHeader, AdeoGridTagBar
  body/                     AdeoGridBody, AdeoGridRow, AdeoGridCell, AdeoGridGroupRow,
                            AdeoGridDetailRow, AdeoGridFormulaEditor, AdeoGridEmptyState
  footer/                   AdeoGridFooter, AdeoGridLoadingIndicator
  overlays/                 toolbar, drawers, panels, formula bar/reference,
                            keyboard shortcuts, filter builder/drawer, selection bar
__stories__/                Storybook stories per feature area
styles/                     scoped SCSS partials, see styles/README.md
```

`index.ts` is the barrel — consumers `import { AdeoGrid, ... } from '@/components/AdeoGrid'`. It also re-exports `useGridState`, `useGridEngine`, `defineStatusRenderer`, formula APIs, and the plugin contract.

`types.ts` holds legacy interfaces (`ColumnDef`, `RowData`, `CellFlags`, `SelectionRange`, `FillEvent`, `GroupRowMeta`, …) and `isGroupRow()` type guard. Newer typed shapes live as split `models/*.model.ts` files (cell, column, filter, sort, pagination, grid-events, grid-options, plugin, formula, display-row).

### Composables (`src/composables/`)

Legacy feature implementations wired into `AdeoGrid.vue`:

`useColumns`, `useSorting`, `useGrouping`, `useServerGrouping`, `useFiltering`, `usePinnedColumns`, `useColumnResize`, `useColumnDnD`, `useAutosize`, `useVirtualScroll`, `useVirtualColumns`, `useVirtualGrid`, `useDataSource`, `useLazyRows`, `usePagination`, `useRowSelection`, `useRowExpansion`, `useActiveCell`, `useCellSelection`, `useMouseSelection`, `useCellEditing`, `useFillHandle`, `useClipboard`, `useKeyboard`, `useTeleportListbox`, `useUndoRedoPlugin`.

Engine equivalents under `src/components/AdeoGrid/features/` end in `Engine.ts` (e.g. `useSortEngine`, `useFilterEngine`, `useCellSelectionEngine`, `useFormulaEngine`, …) plus formula sub-package and `renderers/` (built-in cell renderers + `defineStatusRenderer`).

### Key invariants

- **GridState provide/inject** — `AdeoGrid.vue` calls `useGridState()` and provides under `GRID_STATE_KEY`. Sub-components read it via `useGridContext()` (alias `injectGridState` for back-compat).
- **Column registry** — `AdeoColumn` children register via `ADEO_GRID_COLUMN_REGISTRY_KEY`. When both `:columns` prop and `<AdeoColumn>` children are provided, the registry overrides the prop on matching `field`.
- **Slots context** — provided under `ADEO_GRID_SLOTS_KEY`. Per-field slots (`#cell-{field}`, `#header-{field}`, `#filter-{field}`, `#edit-{field}`) resolve before generic ones.
- **Plugin contract** — `<AdeoGrid :plugins="[plugin]" />`. Each plugin receives `{ state, engine }` on `init` and returns a cleanup function.
- **Imperative ref API** — `grid.value.exportCsv()`, `undo()`, `setFormula()`, `validateAll()`, `persistView()`, `tree.flatten()`, etc. Full list in README "Imperative ref API" table.
- **Density row heights** (must match SCSS padding): `compact: 32`, `default: 48`, `comfortable: 64` — defined in `AdeoGrid.vue` as `DENSITY_ROW_HEIGHT`. (The legacy `defaults.ts` constant uses different numbers for the engine layer; treat the `AdeoGrid.vue` constants as authoritative for visual rendering.)
- **Group row metadata** — group rows use `__adg`-prefixed fields (`__adgType`, `__adgKey`, `__adgDepth`, …) to avoid collisions with user data. Use `isGroupRow()` from `types.ts`.
- **Formula engine** — active iff any column has `allowFormula: true`. Auto-detects `=...` strings in `props.rows`, evaluates via topological DAG, re-evaluates dependents on upstream edits.

### Virtual scroll architecture

- `useVirtualScroll` is index-based — exposes `visibleRange` integer array + `getRow(i)`, never allocates row arrays on scroll.
- `rowHeight` is reactive (`Ref<number> | number`) — changes with density. Scroll position is preserved proportionally when it changes (first visible row stays stable).
- Max rendered rows capped at 80 to prevent perf degradation with small row heights.
- `totalCount` decouples scrollbar height from `rows.length` for lazy loading — no feedback loops.
- **Top spacer div (height-based) replaces `translateY`** because CSS transforms create a containing block that traps `position: sticky` pinned columns.
- Rows and header use `min-width: totalContentWidth` so sticky pinned columns have room to stick.
- DOM `scrollTop` is clamped when content height shrinks (e.g. grouping collapses 100k rows to 4 groups).
- Container height is synced via `ResizeObserver` for fullscreen/density changes.
- For unknown row heights (detail rows, rich group rows), use `useVariableHeightVirtualScroll` from the `features/` directory (exported from the barrel).

### State & routing

Pinia and vue-router are installed but currently unused — no stores or routes defined.

## Code Conventions

- **Vue 3 `<script setup>`** + Composition API everywhere
- **TypeScript strict mode** with `noUncheckedIndexedAccess: true`
- **No semicolons**, single quotes, 100-char print width (Prettier)
- **Path alias:** `@` → `./src` (mirrored in Storybook's `viteFinal`)
- **Scoped CSS** in SFCs; shared SCSS partials in `src/components/AdeoGrid/styles/`
- **Dual linting:** oxlint runs first (correctness), then eslint (vue/ts rules)
- **Node:** `^20.19.0 || >=22.12.0`