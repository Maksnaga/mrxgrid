/**
 * Données seed — produits LM + mouvements de stock simulés.
 *
 * Le générateur `generateLMProducts` vit dans les fixtures Storybook ;
 * on le réutilise tel quel pour que la même donnée alimente la story
 * Filtering / Grouping / etc. et la demo app.
 */

import {
  generateLMProducts,
  type LMProduct,
} from '@/components/MrxGrid/__stories__/_fixtures'

export type { LMProduct }

/**
 * Mouvement de stock — entrée, sortie, ou ajustement d'inventaire pour
 * un produit. Utilisé dans le mini-grid embarqué de la `#expand-row`.
 */
export interface StockMovement {
  id: number
  productId: number
  type: 'in' | 'out' | 'adjustment'
  quantity: number
  /** Solde après l'opération. */
  balance: number
  date: string
  reason: string
  operator: string
}

/**
 * Combien de produits dans la démo.
 *
 * 100 000 — assez pour démontrer que le grid encaisse une vraie volumétrie
 * "enterprise" (catalogue national) avec le virtual-scroll expansion-aware.
 * Le `generateLMProducts` reste rapide à ce volume (~150 ms au boot,
 * fait une seule fois en module load).
 */
export const INITIAL_PRODUCT_COUNT = 100_000

export const SEED_PRODUCTS: LMProduct[] = generateLMProducts(INITIAL_PRODUCT_COUNT)

const MOVEMENT_REASONS = [
  'Réception fournisseur',
  'Vente magasin',
  'Vente en ligne',
  'Ajustement inventaire',
  'Transfert inter-magasin',
  'Retour client',
  'Casse / perte',
  'Démarque',
] as const

const OPERATORS = ['Sophie M.', 'Marc D.', 'Laure B.', 'Tarek K.', 'Élise P.'] as const

/**
 * Génère un historique de 8-12 mouvements déterministes pour un produit
 * donné. Les soldes décroissent / augmentent de façon cohérente avec
 * le stock courant.
 */
export function generateMovements(product: LMProduct): StockMovement[] {
  const count = 8 + (product.id % 5)
  const movements: StockMovement[] = []
  let balance = product.stock
  let seed = product.id * 131

  for (let i = 0; i < count; i++) {
    seed = (seed * 9301 + 49297) % 233280
    const r = seed / 233280
    const type: StockMovement['type'] =
      r < 0.55 ? 'out' : r < 0.85 ? 'in' : 'adjustment'
    const quantity =
      type === 'adjustment'
        ? Math.floor(r * 10) - 5
        : Math.max(1, Math.floor(r * 18) + 1)
    balance += type === 'out' ? quantity : -quantity
    movements.push({
      id: product.id * 100 + i,
      productId: product.id,
      type,
      quantity: type === 'out' ? quantity : Math.abs(quantity),
      balance: Math.max(0, balance),
      date: daysAgo(i * 4 + Math.floor(r * 3)),
      reason: MOVEMENT_REASONS[Math.floor(r * MOVEMENT_REASONS.length)]!,
      operator: OPERATORS[Math.floor(r * OPERATORS.length)]!,
    })
  }
  return movements
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
