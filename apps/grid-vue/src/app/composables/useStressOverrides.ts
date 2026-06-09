/**
 * Overrides cellule pour les colonnes "stress-test" générées via
 * `valueGetter`. Les valeurs par défaut sont calculées à la volée depuis
 * `row.id` (pas de stockage) ; cet override layer permet à l'utilisateur
 * d'éditer ces cellules sans avoir à étendre l'interface `LMProduct` ni
 * pré-allouer 100k × 200 fields en mémoire.
 *
 * Stratégie :
 *   - clé `${rowId}:${field}` → valeur éditée
 *   - shallowRef + Map pour minimiser le coût réactivité (la Map elle-
 *     même est la trigger ; on swap la référence après chaque mutation)
 *   - le valueGetter checke `getOverride(rowId, field)` avant de retomber
 *     sur la valeur calculée
 *
 * État volontairement non persistant — un refresh repart de zéro,
 * cohérent avec le store mock (`store.ts`) qui ne sérialise rien non plus.
 */

import { shallowRef } from 'vue'

const overrides = shallowRef<Map<string, unknown>>(new Map())

function key(rowId: string | number, field: string): string {
  return `${rowId}:${field}`
}

export function useStressOverrides() {
  function getOverride(rowId: string | number, field: string): unknown {
    return overrides.value.get(key(rowId, field))
  }

  function hasOverride(rowId: string | number, field: string): boolean {
    return overrides.value.has(key(rowId, field))
  }

  function setOverride(rowId: string | number, field: string, value: unknown): void {
    const next = new Map(overrides.value)
    next.set(key(rowId, field), value)
    overrides.value = next
  }

  function setManyOverrides(
    cells: ReadonlyArray<{ rowId: string | number; field: string; value: unknown }>,
  ): void {
    if (cells.length === 0) return
    const next = new Map(overrides.value)
    for (const c of cells) next.set(key(c.rowId, c.field), c.value)
    overrides.value = next
  }

  return {
    /** Reactive map — useful for tracking the override count in the UI. */
    overrides,
    getOverride,
    hasOverride,
    setOverride,
    setManyOverrides,
  }
}
