/**
 * `usePendingMutations` — état "skeleton granulaire" pour la demo.
 *
 * Permet de marquer des cellules ou des rows individuelles comme "en
 * attente d'une mutation serveur" sans setter le `loading` global du
 * `useProductList`. Le `<MrxGrid>` consomme les deux refs exposés ici
 * via les props `pendingCells` + `pendingRowIds` :
 *
 *   - `pendingCells` → shimmer overlay par cellule (la valeur reste
 *     lisible en filigrane pour que l'utilisateur voie EXACTEMENT
 *     quel champ est en train d'être pushé)
 *   - `pendingRowIds` → dim global de la row + mini spinner Mozaic
 *     (pattern bulk delete, drawer save, etc.)
 *
 * Les deux helpers `withCellPending` / `withRowPending` enveloppent
 * un appel API : ils marquent au démarrage, démarquent au resolve OU
 * sur erreur (try/finally). Conséquence : le caller n'a plus à gérer
 * `try/finally` manuellement pour le skeleton state ; il garde juste
 * le try/catch pour les toasts d'erreur.
 *
 * Le scope est délibérément demo-only — voir
 * `docs/plans/granular-skeleton.md` §9.4 pour la décision.
 */

import { ref, type Ref } from 'vue'

export interface PendingCell {
  rowId: string
  field: string
}

export interface UsePendingMutationsReturn {
  /** Cellules ciblées par une mutation en vol — à binder sur `:pending-cells`. */
  pendingCells: Ref<PendingCell[]>
  /** Rows ciblées par une mutation en vol — à binder sur `:pending-row-ids`. */
  pendingRowIds: Ref<string[]>

  /**
   * Exécute `fn` en marquant la cellule `(rowId, field)` pending pour
   * toute la durée de la promesse. Résultat de `fn` retourné tel quel ;
   * exception relance après cleanup (rien d'avalé).
   */
  withCellPending<T>(rowId: string, field: string, fn: () => Promise<T>): Promise<T>

  /**
   * Variante pour N cellules d'un coup (cas fill handle / bulk per-field).
   */
  withCellsPending<T>(cells: PendingCell[], fn: () => Promise<T>): Promise<T>

  /**
   * Variante row-level — drive le dim + spinner sur toutes les rows
   * listées pendant la durée de la promesse.
   */
  withRowPending<T>(rowIds: string[], fn: () => Promise<T>): Promise<T>
}

export function usePendingMutations(): UsePendingMutationsReturn {
  const pendingCells = ref<PendingCell[]>([])
  const pendingRowIds = ref<string[]>([])

  function _cellKey(c: PendingCell): string {
    return `${c.rowId}::${c.field}`
  }

  async function withCellsPending<T>(cells: PendingCell[], fn: () => Promise<T>): Promise<T> {
    if (cells.length === 0) return fn()
    pendingCells.value = [...pendingCells.value, ...cells]
    try {
      return await fn()
    } finally {
      const toRemove = new Set(cells.map(_cellKey))
      pendingCells.value = pendingCells.value.filter((c) => !toRemove.has(_cellKey(c)))
    }
  }

  function withCellPending<T>(
    rowId: string,
    field: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return withCellsPending([{ rowId, field }], fn)
  }

  async function withRowPending<T>(rowIds: string[], fn: () => Promise<T>): Promise<T> {
    if (rowIds.length === 0) return fn()
    pendingRowIds.value = [...pendingRowIds.value, ...rowIds]
    try {
      return await fn()
    } finally {
      const toRemove = new Set(rowIds)
      pendingRowIds.value = pendingRowIds.value.filter((id) => !toRemove.has(id))
    }
  }

  return {
    pendingCells,
    pendingRowIds,
    withCellPending,
    withCellsPending,
    withRowPending,
  }
}
