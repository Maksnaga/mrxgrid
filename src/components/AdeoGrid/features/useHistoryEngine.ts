/**
 * History engine — Angular parity (moz-grid / `HistoryEngine`).
 *
 * Keeps past/future stacks of cell-change groups and delegates undo/redo
 * to the clipboard engine's `applyChanges`. Optional `attach(gridId)` mirrors
 * the stacks to `localStorage` under `adeo-grid-history:<gridId>`.
 *
 * Size is capped at `MAX_HISTORY` (50) to keep localStorage payloads bounded.
 */

import { computed, ref, type ComputedRef } from 'vue'
import type { ClipboardEngine, HistoryCellChange } from './useClipboardEngine'
import type { RowData } from '../types'

export type HistoryOpType =
  | 'edit'
  | 'paste'
  | 'cut'
  | 'fill'
  | 'delete'
  | 'fill-down'
  | 'fill-right'
  | 'fill-selection'

export interface HistoryOp {
  type: HistoryOpType
  changes: HistoryCellChange[]
  timestamp: number
}

const MAX_HISTORY = 50
const STORAGE_PREFIX = 'adeo-grid-history:'

export interface HistoryEngine {
  readonly canUndo: ComputedRef<boolean>
  readonly canRedo: ComputedRef<boolean>
  attach(gridId: string | null): void
  record(type: HistoryOpType, changes: HistoryCellChange[]): void
  undo(): HistoryOp | null
  redo(): HistoryOp | null
  clear(): void
}

export function useHistoryEngine<T = RowData>(
  clipboard: ClipboardEngine<T>,
): HistoryEngine {
  const past = ref<HistoryOp[]>([])
  const future = ref<HistoryOp[]>([])
  let storageKey: string | null = null

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function attach(gridId: string | null): void {
    storageKey = gridId ? `${STORAGE_PREFIX}${gridId}` : null
    if (!storageKey) {
      past.value = []
      future.value = []
      return
    }
    restore()
  }

  function record(type: HistoryOpType, changes: HistoryCellChange[]): void {
    if (changes.length === 0) return
    const op: HistoryOp = { type, changes, timestamp: Date.now() }
    const next = [...past.value, op]
    past.value = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
    future.value = []
    persist()
  }

  function undo(): HistoryOp | null {
    const stack = past.value
    if (stack.length === 0) return null
    const op = stack[stack.length - 1]
    if (!op) return null
    clipboard.applyChanges(op.changes, 'before')
    past.value = stack.slice(0, -1)
    future.value = [...future.value, op]
    persist()
    return op
  }

  function redo(): HistoryOp | null {
    const stack = future.value
    if (stack.length === 0) return null
    const op = stack[stack.length - 1]
    if (!op) return null
    clipboard.applyChanges(op.changes, 'after')
    future.value = stack.slice(0, -1)
    past.value = [...past.value, op]
    persist()
    return op
  }

  function clear(): void {
    past.value = []
    future.value = []
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey)
      } catch {
        // Storage unavailable (private mode, quota) — non-fatal.
      }
    }
  }

  function persist(): void {
    if (!storageKey) return
    try {
      const payload = JSON.stringify({
        past: past.value,
        future: future.value,
      })
      localStorage.setItem(storageKey, payload)
    } catch {
      // Quota exceeded or storage disabled — silently drop persistence.
    }
  }

  function restore(): void {
    if (!storageKey) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) {
        past.value = []
        future.value = []
        return
      }
      const parsed = JSON.parse(raw) as { past?: HistoryOp[]; future?: HistoryOp[] }
      past.value = Array.isArray(parsed.past) ? parsed.past : []
      future.value = Array.isArray(parsed.future) ? parsed.future : []
    } catch {
      past.value = []
      future.value = []
    }
  }

  return { canUndo, canRedo, attach, record, undo, redo, clear }
}
