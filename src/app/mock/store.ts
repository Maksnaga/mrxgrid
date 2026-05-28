/**
 * Store en mémoire — la "base de données" mockée de l'app.
 *
 * Volontairement non-réactif (`let` + array natif, pas de `ref`/`reactive`)
 * — c'est de la donnée serveur, pas du state UI. La réactivité côté UI
 * vient du re-fetch que `useProductList` déclenche après chaque mutation.
 *
 * Le module se ré-évalue au refresh du navigateur → `DB` redevient le
 * seed initial, sans complexité localStorage.
 */

import { SEED_PRODUCTS, type LMProduct } from './seed'

let DB: LMProduct[] = [...SEED_PRODUCTS]

/** ID auto-incrémenté pour les nouveaux produits — démarre après le dernier seed. */
let nextProductId = DB.reduce((max, p) => Math.max(max, p.id), 0) + 1

export const productStore = {
  /** Snapshot complet — read-only par convention. Pour itérer / filtrer / trier. */
  all(): readonly LMProduct[] {
    return DB
  },

  find(id: number): LMProduct | null {
    return DB.find((p) => p.id === id) ?? null
  },

  /** Insert prepend — l'utilisateur voit son ajout en haut du tableau. */
  insert(payload: Omit<LMProduct, 'id' | 'sku'>): LMProduct {
    const id = nextProductId++
    const product: LMProduct = {
      ...(payload as LMProduct),
      id,
      sku: `LM-${String(id).padStart(6, '0')}`,
    }
    DB = [product, ...DB]
    return product
  },

  patch(id: number, patch: Partial<LMProduct>): LMProduct | null {
    let updated: LMProduct | null = null
    DB = DB.map((p) => {
      if (p.id !== id) return p
      updated = { ...p, ...patch }
      return updated
    })
    return updated
  },

  patchMany(ids: ReadonlySet<number>, patch: Partial<LMProduct>): number {
    let count = 0
    DB = DB.map((p) => {
      if (!ids.has(p.id)) return p
      count++
      return { ...p, ...patch }
    })
    return count
  },

  remove(id: number): boolean {
    const before = DB.length
    DB = DB.filter((p) => p.id !== id)
    return DB.length < before
  },

  removeMany(ids: ReadonlySet<number>): number {
    const before = DB.length
    DB = DB.filter((p) => !ids.has(p.id))
    return before - DB.length
  },
}
