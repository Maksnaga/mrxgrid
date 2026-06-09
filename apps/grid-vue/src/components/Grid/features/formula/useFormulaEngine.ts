// @ts-nocheck — Phase 6b orchestrator. Strict typing pending integration with
// the inline-edit engine. The 10 framework-free utils (tokenizer, parser, AST,
// evaluator, DAG, ref-mapper, palette, shift, suggestions, default functions)
// were ported verbatim from Angular and are typed against `noUncheckedIndexedAccess: true`
// — this orchestrator opts out until tests cover the integration points.

/**
 * `useFormulaEngine` — Vue composable port of Angular `FormulaEngine`.
 *
 * Owns every formula cell, the dependency DAG linking them, and the
 * evaluator that turns stored formulas into `FormulaValue`s. Mirrors the
 * Angular service 1-for-1 with these adaptations:
 *
 *   Angular signal → Vue ref / computed
 *   `inject(GridStateManager)` → `gridState` arg from `useGridContext()`
 *
 * Responsibilities:
 *   - Parse + resolve a raw formula when the user commits an edit.
 *   - Update the dependency graph and detect cycles (`#CYCLE!`).
 *   - Re-evaluate the mutated cell and every descendant in topological order.
 *   - Expose a `values` ref the grid renders against.
 *   - Provide an explicit `invalidate(addr)` so inline-edit can refresh
 *     dependents after a *non-formula* source cell changes — avoiding a
 *     blanket re-eval of the whole dataset.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { GridState } from '../../state/useGridState'
import type {
  CellAddress,
  FormulaError,
  FormulaEvalContext,
  FormulaFunctionRegistry,
  FormulaValue,
} from '../../models/formula.model'
import { FormulaValues } from '../../models/formula.model'
import type { FormulaAst } from './formula-ast'
import { FormulaDag } from './formula-dag'
import { evaluate } from './formula-evaluator'
import { DEFAULT_FORMULA_FUNCTIONS } from './formula-functions.default'
import { FormulaParseError, parseFormula } from './formula-parser'
import {
  a1ToLongForm,
  addressToA1,
  longFormToA1,
  resolveAst,
  type RefMapperContext,
} from './formula-ref-mapper'

interface CellEntry {
  /** Long-form (REF) source after `a1ToLongForm`. Stable across surface
   *  syntax variants, so this is what the parser sees. */
  formula: string
  /** Original surface source as supplied to `set` (or pulled from row data
   *  by `syncFromSource`). Kept so `syncFromSource` can detect a no-op
   *  re-sync without re-running parse + DAG mutations. */
  source: string
  /** Parsed AST with resolved addresses — rebuilt on column/row changes. */
  ast: FormulaAst
  /** Last computed value. `empty` before the first evaluation. */
  value: FormulaValue
}

function makeKey(addr: CellAddress): string {
  return `${addr.rowId}|${addr.field}`
}

function keyToAddress(key: string): CellAddress {
  const sep = key.indexOf('|')
  const rowId = key.slice(0, sep)
  const field = key.slice(sep + 1)
  return { rowId, field }
}

export interface FormulaEngine {
  /** Snapshot of all evaluated formula values, keyed by `rowId|field`. */
  readonly values: Ref<ReadonlyMap<string, FormulaValue>>
  readonly hasAnyFormula: ComputedRef<boolean>
  /** True when the user is editing a cell whose column is formula-enabled. */
  readonly isFormulaEditActive: ComputedRef<boolean>

  setFunctions(functions: FormulaFunctionRegistry): void
  getFunctions(): FormulaFunctionRegistry
  setLocale(locale: 'en' | 'fr'): void

  hasFormula(addr: CellAddress): boolean
  getFormula(addr: CellAddress): string | undefined
  valueAt(addr: CellAddress): FormulaValue | undefined
  /** Formula re-presented as A1 surface syntax for the current column / row order. */
  displayFormula(addr: CellAddress): string | undefined

  set(addr: CellAddress, rawFormula: string): FormulaValue
  remove(addr: CellAddress): void
  /** Notify the engine that a non-formula cell changed — re-evaluates dependents only. */
  invalidate(addr: CellAddress): void
  clear(): void
  /** Reconcile registered formulas against `gridState.sourceData()`. */
  syncFromSource(allowFormula: (field: string) => boolean): void
  /** Re-parse every stored formula (column/row reorder changed positions). */
  rebuild(): void
}

export function useFormulaEngine(gridState: GridState): FormulaEngine {
  const cells = new Map<string, CellEntry>()
  const dag = new FormulaDag()
  const valuesRef = ref<ReadonlyMap<string, FormulaValue>>(new Map())

  let functions: FormulaFunctionRegistry = DEFAULT_FORMULA_FUNCTIONS
  let locale: 'en' | 'fr' = 'en'

  // ─── Public reactive surface ─────────────────────────────────────────────

  const values = valuesRef as Ref<ReadonlyMap<string, FormulaValue>>
  const hasAnyFormula = computed(() => values.value.size > 0)

  const isFormulaEditActive = computed(() => {
    if (gridState.formulaBarEditingActive.value) return true
    const editing = gridState.cellEditState.value.editingCell
    if (!editing) return false
    const field = gridState.visibleColumns.value[editing.col]?.field
    if (!field) return false
    return gridState.columnDefMap.value.get(field)?.allowFormula === true
  })

  // ─── Configuration ───────────────────────────────────────────────────────

  function setFunctions(fns: FormulaFunctionRegistry): void {
    functions = fns
  }
  function getFunctions(): FormulaFunctionRegistry {
    return functions
  }
  function setLocale(loc: 'en' | 'fr'): void {
    locale = loc
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  function hasFormula(addr: CellAddress): boolean {
    return cells.has(makeKey(addr))
  }

  function getFormula(addr: CellAddress): string | undefined {
    return cells.get(makeKey(addr))?.formula
  }

  function valueAt(addr: CellAddress): FormulaValue | undefined {
    return values.value.get(makeKey(addr))
  }

  function displayFormula(addr: CellAddress): string | undefined {
    const entry = cells.get(makeKey(addr))
    if (!entry) return undefined
    return longFormToA1(entry.formula, refMapperContext(addr.rowId))
  }

  // ─── Mutations ───────────────────────────────────────────────────────────

  function set(addr: CellAddress, rawFormula: string): FormulaValue {
    const key = makeKey(addr)
    const trimmed = rawFormula.trim()
    const prefixed = trimmed.startsWith('=') ? trimmed : `=${trimmed}`
    const ctx = refMapperContext(addr.rowId)
    const source = a1ToLongForm(prefixed, ctx)

    let ast: FormulaAst
    try {
      ast = parseFormula(source, { locale })
    } catch (err) {
      return storeError(key, source, err instanceof FormulaParseError ? '#PARSE!' : '#VALUE!')
    }

    ast = resolveAst(ast, ctx)

    const deps = collectDeps(ast)
    dag.setDependencies(key, deps)

    const entry: CellEntry = {
      formula: source,
      source: rawFormula,
      ast,
      value: FormulaValues.empty(),
    }
    cells.set(key, entry)

    revalidateFrom([key])
    return entry.value
  }

  function remove(addr: CellAddress): void {
    const key = makeKey(addr)
    if (!cells.has(key)) return
    cells.delete(key)
    const dependents = [...dag.dependentsOf(key)]
    dag.remove(key)
    revalidateFrom(dependents)
    commitValues()
  }

  function invalidate(addr: CellAddress): void {
    const key = makeKey(addr)
    const dependents = [...dag.dependentsOf(key)]
    if (dependents.length === 0) return
    revalidateFrom(dependents)
  }

  function clear(): void {
    cells.clear()
    dag.clear()
    commitValues()
  }

  function syncFromSource(allowFormula: (field: string) => boolean): void {
    // Use the grid-level rowId resolver (driven by `props.rowId` in Grid)
    // instead of a hard-coded field name — that way grids whose rows have
    // no `id` field still register their formulas. Fixes a regression where
    // stress-test rows shaped as `{col_0, col_1, …}` silently skipped sync.
    batch(() => {
      const resolveRowId = gridState.rowIdResolver.value
      const data = gridState.sourceData.value

      const expected = new Set<string>()
      let index = 0
      for (const row of data) {
        const r = row as Record<string, unknown>
        const rowId = resolveRowId(r, index++)
        if (rowId === undefined || rowId === null) continue
        for (const field of Object.keys(r)) {
          if (!allowFormula(field)) continue
          const raw = r[field]
          if (typeof raw !== 'string' || !raw.trimStart().startsWith('=')) continue
          const k = `${rowId}|${field}`
          expected.add(k)
          const existing = cells.get(k)
          // Compare against the *surface* source we last persisted (not the
          // long-form `formula`) — otherwise lazy-loaded data sources would
          // re-parse / re-eval every formula on every page load and freeze
          // the tab.
          if (existing && existing.source === raw) continue
          set({ rowId, field }, raw)
        }
      }

      for (const key of [...cells.keys()]) {
        if (expected.has(key)) continue
        const sep = key.indexOf('|')
        remove({ rowId: key.slice(0, sep), field: key.slice(sep + 1) })
      }
    })
  }

  function rebuild(): void {
    batch(() => {
      for (const [key, entry] of cells) {
        const addr = keyToAddress(key)
        const ctx = refMapperContext(addr.rowId)
        entry.ast = resolveAst(parseFormulaOrEmpty(entry.formula, locale), ctx)
        dag.setDependencies(key, collectDeps(entry.ast))
      }
      revalidateFrom([...cells.keys()])
    })
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  // Lazy index over `gridState.sourceData` keyed by resolved rowId. Without
  // this, `readSourceValue` would scan the array on every ref lookup —
  // O(N²) total per `revalidateFrom` pass and a hard freeze on grids with
  // 1000+ rows × multiple formula columns. The cache is invalidated by
  // identity comparison on the underlying array reference, so callers do
  // not need to participate in a manual invalidation protocol.
  let _rowIndexCache: {
    src: readonly unknown[]
    rowMap: Map<string | number, Record<string, unknown>>
    rowIds: (string | number)[]
  } | null = null

  function ensureRowIndex(): {
    rowMap: Map<string | number, Record<string, unknown>>
    rowIds: (string | number)[]
  } {
    const data = gridState.sourceData.value
    if (_rowIndexCache && _rowIndexCache.src === data) {
      return { rowMap: _rowIndexCache.rowMap, rowIds: _rowIndexCache.rowIds }
    }
    const resolveRowId = gridState.rowIdResolver.value
    const rowMap = new Map<string | number, Record<string, unknown>>()
    const rowIds: (string | number)[] = new Array(data.length)
    for (let i = 0; i < data.length; i++) {
      const r = data[i] as Record<string, unknown>
      const id = resolveRowId(r, i)
      const safeId = id ?? ''
      rowIds[i] = safeId
      if (id !== undefined && id !== null) rowMap.set(id, r)
    }
    _rowIndexCache = { src: data, rowMap, rowIds }
    return { rowMap, rowIds }
  }

  function refMapperContext(currentRowId?: string | number): RefMapperContext {
    const visible = gridState.visibleColumns.value
    const fields = visible.map((c) => c.field)
    const { rowIds } = ensureRowIndex()
    return { fields, rowIds, currentRowId }
  }

  function storeError(key: string, source: string, error: FormulaError): FormulaValue {
    const value = FormulaValues.error(error)
    dag.setDependencies(key, [])
    cells.set(key, {
      formula: source,
      source,
      ast: { kind: 'string', value: error },
      value,
    })
    commitValues()
    return value
  }

  function revalidateFrom(seeds: string[]): void {
    if (seeds.length === 0) {
      commitValues()
      return
    }
    const cycleError = FormulaValues.error('#CYCLE!')
    const order = dag.topoFrom(seeds)
    for (const key of order) {
      const entry = cells.get(key)
      if (!entry) continue
      const cycle = dag.detectCycle(key)
      if (cycle) {
        entry.value = cycleError
        continue
      }
      entry.value = evaluate(entry.ast, functions, makeEvalContext(key))
    }
    commitValues()
  }

  function makeEvalContext(selfKey: string): FormulaEvalContext {
    return {
      addr: keyToAddress(selfKey),
      locale,
      resolveRef: (target) => resolveRef(target),
    }
  }

  function resolveRef(addr: CellAddress): FormulaValue {
    const key = makeKey(addr)
    const formula = cells.get(key)
    if (formula) return formula.value
    return readSourceValue(addr)
  }

  function readSourceValue(addr: CellAddress): FormulaValue {
    // O(1) row lookup via the lazily-built rowId index — see
    // `ensureRowIndex`. Critical for grids with many rows × multiple
    // formula columns: a per-call `Array.find` was previously turning
    // every formula evaluation into an O(N) scan.
    const { rowMap } = ensureRowIndex()
    let row = rowMap.get(addr.rowId)
    if (!row && typeof addr.rowId === 'number') row = rowMap.get(String(addr.rowId))
    if (!row && typeof addr.rowId === 'string') row = rowMap.get(Number(addr.rowId))
    if (!row) return FormulaValues.empty()
    const raw = row[addr.field]
    return coerceJsValue(raw)
  }

  // Batch flag — when > 0, individual `commitValues` calls are skipped and
  // a single commit fires when the outer batch completes. Bulk operations
  // like `syncFromSource` / `rebuild` register thousands of formulas and
  // each `set()` would otherwise mutate `valuesRef`, invalidating every
  // cell's `formulaDisplayValue` computed and freezing the tab.
  let _batchDepth = 0
  let _commitDeferred = false

  function batch<T>(fn: () => T): T {
    _batchDepth++
    try {
      return fn()
    } finally {
      _batchDepth--
      if (_batchDepth === 0 && _commitDeferred) {
        _commitDeferred = false
        commitValues()
      }
    }
  }

  function commitValues(): void {
    if (_batchDepth > 0) {
      _commitDeferred = true
      return
    }
    // Emit a *new* map instance so downstream `computed`s see a fresh
    // reference and recompute. Map iteration order matches insertion order.
    const next = new Map<string, FormulaValue>()
    for (const [key, entry] of cells) next.set(key, entry.value)
    valuesRef.value = next
  }

  return {
    values,
    hasAnyFormula,
    isFormulaEditActive,
    setFunctions,
    getFunctions,
    setLocale,
    hasFormula,
    getFormula,
    valueAt,
    displayFormula,
    set,
    remove,
    invalidate,
    clear,
    syncFromSource,
    rebuild,
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function collectDeps(ast: FormulaAst): Set<string> {
  const out = new Set<string>()
  visit(ast, out)
  return out
}

function visit(node: FormulaAst, out: Set<string>): void {
  switch (node.kind) {
    case 'ref':
      if (node.resolved) out.add(makeKey(node.resolved))
      return
    case 'range':
      if (node.resolved) {
        for (const a of node.resolved) if (a) out.add(makeKey(a))
      }
      return
    case 'unary':
      visit(node.operand, out)
      return
    case 'binary':
      visit(node.left, out)
      visit(node.right, out)
      return
    case 'call':
      for (const a of node.args) visit(a, out)
      return
    default:
      return
  }
}

function coerceJsValue(raw: unknown): FormulaValue {
  if (raw === null || raw === undefined) return FormulaValues.empty()
  if (typeof raw === 'number') return FormulaValues.number(raw)
  if (typeof raw === 'boolean') return FormulaValues.boolean(raw)
  if (typeof raw === 'string') return FormulaValues.string(raw)
  return FormulaValues.string(String(raw))
}

function parseFormulaOrEmpty(source: string, locale: 'en' | 'fr'): FormulaAst {
  try {
    return parseFormula(source, { locale })
  } catch {
    return { kind: 'string', value: '#PARSE!' }
  }
}

export { addressToA1 }
