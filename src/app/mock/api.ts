/**
 * API mockée — interface réseau-like pour la demo app.
 *
 * Tous les appels :
 *   - sont async + latence simulée (`delay()`)
 *   - peuvent lever une erreur réseau aléatoire (`maybeThrow()`)
 *   - lisent / écrivent dans `productStore` (en mémoire, reset au refresh)
 *
 * Remplacer ces fonctions par de vraies routes REST se fait sans toucher
 * aux composants consumer — c'est l'intérêt du contrat `Promise<…>`.
 */

import type { FilterModel } from '@/components/MrxGrid'
import { delay, maybeThrow } from './latency'
import { productStore } from './store'
import { generateMovements, type LMProduct, type StockMovement } from './seed'

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

export interface FetchProductsParams {
  page: number
  pageSize: number
  sort?: { field: string; direction: 'asc' | 'desc' } | null
  filterModel?: FilterModel
  /**
   * État de la filter row inline (un input par colonne, vivant à part
   * du `filterModel`). En vrai serveur on encoderait ça en query params
   * (`?filter[name]=foo`) ; ici on l'applique côté mock.
   */
  quickFilters?: Record<string, unknown>
  search?: string
}

export interface FetchProductsResult {
  rows: LMProduct[]
  total: number
}

export interface ProductKpis {
  /** CA estimé du mois (€) — `Σ price` × ratio promotionnel. */
  revenueMonth: number
  /** Nombre d'articles en stock total. */
  stockTotal: number
  /** Produits avec status === 'out'. */
  outOfStock: number
  /** Produits avec `promo === true`. */
  activePromos: number
  /** 30 derniers points pour sparkline CA — déterministe. */
  revenueTrend: number[]
}

// ---------------------------------------------------------------------------
// Lecture — list + detail + KPIs + movements
// ---------------------------------------------------------------------------

export async function fetchProducts(
  params: FetchProductsParams,
): Promise<FetchProductsResult> {
  await delay()
  maybeThrow()

  let rows: LMProduct[] = [...productStore.all()]
  rows = applySearch(rows, params.search)
  rows = applyQuickFilters(rows, params.quickFilters)
  rows = applyFilterModel(rows, params.filterModel)
  rows = applySort(rows, params.sort)

  const total = rows.length
  const start = params.page * params.pageSize
  const slice = rows.slice(start, start + params.pageSize)
  return { rows: slice, total }
}

export async function getProduct(id: number): Promise<LMProduct> {
  await delay()
  maybeThrow()
  const product = productStore.find(id)
  if (!product) throw new Error(`Produit ${id} introuvable`)
  return product
}

export async function getProductMovements(productId: number): Promise<StockMovement[]> {
  await delay()
  maybeThrow()
  const product = productStore.find(productId)
  if (!product) throw new Error(`Produit ${productId} introuvable`)
  return generateMovements(product)
}

export async function getKpis(): Promise<ProductKpis> {
  await delay()
  maybeThrow()
  const rows = productStore.all()
  const stockTotal = rows.reduce((sum, p) => sum + p.stock, 0)
  const outOfStock = rows.filter((p) => p.status === 'out').length
  const activePromos = rows.filter((p) => p.promo).length
  const revenueMonth = Math.round(
    rows.reduce((s, p) => s + (p.promo ? p.price * 0.8 : p.price) * 0.3, 0),
  )
  return {
    revenueMonth,
    stockTotal,
    outOfStock,
    activePromos,
    revenueTrend: makeSparkline(rows.length),
  }
}

// ---------------------------------------------------------------------------
// Mutations — create / update / delete (1 ou N)
// ---------------------------------------------------------------------------

export async function createProduct(
  payload: Omit<LMProduct, 'id' | 'sku'>,
): Promise<LMProduct> {
  await delay()
  maybeThrow()
  return productStore.insert(payload)
}

export async function updateProduct(
  id: number,
  patch: Partial<LMProduct>,
): Promise<LMProduct> {
  await delay()
  maybeThrow()
  const updated = productStore.patch(id, patch)
  if (!updated) throw new Error(`Produit ${id} introuvable`)
  return updated
}

export async function updateProducts(
  ids: readonly number[],
  patch: Partial<LMProduct>,
): Promise<{ updated: number }> {
  await delay()
  maybeThrow()
  return { updated: productStore.patchMany(new Set(ids), patch) }
}

export async function deleteProduct(id: number): Promise<void> {
  await delay()
  maybeThrow()
  if (!productStore.remove(id)) throw new Error(`Produit ${id} introuvable`)
}

export async function deleteProducts(
  ids: readonly number[],
): Promise<{ deleted: number }> {
  await delay()
  maybeThrow()
  return { deleted: productStore.removeMany(new Set(ids)) }
}

// ---------------------------------------------------------------------------
// Helpers privés — pagination / filter / sort / search
// ---------------------------------------------------------------------------

function applySearch(rows: LMProduct[], search: string | undefined): LMProduct[] {
  const q = search?.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q),
  )
}

/**
 * Applique les valeurs du filter row inline. Chaque entrée `[field, v]`
 * filtre selon le type :
 *   - string non vide   → match `contains` (case-insensitive)
 *   - { min, max }      → range numérique (slot custom price)
 *   - autre objet/array → équivalent IN
 */
function applyQuickFilters(
  rows: LMProduct[],
  quickFilters: Record<string, unknown> | undefined,
): LMProduct[] {
  if (!quickFilters) return rows
  let out = rows
  for (const [field, raw] of Object.entries(quickFilters)) {
    if (raw == null || raw === '') continue
    out = out.filter((row) => matchQuickFilter(row, field, raw))
    if (out.length === 0) return out
  }
  return out
}

function matchQuickFilter(row: LMProduct, field: string, raw: unknown): boolean {
  const cell = (row as unknown as Record<string, unknown>)[field]

  // Range numérique — { min, max } depuis `PriceRangeSlider`.
  if (raw && typeof raw === 'object' && 'min' in raw && 'max' in raw) {
    const r = raw as { min: number; max: number }
    return typeof cell === 'number' && cell >= r.min && cell <= r.max
  }
  // Multi-select (set / combobox).
  if (Array.isArray(raw)) {
    if (raw.length === 0) return true
    return raw.map(String).includes(String(cell))
  }
  // String — match `contains`.
  return String(cell ?? '').toLowerCase().includes(String(raw).toLowerCase())
}

function applySort(
  rows: LMProduct[],
  sort: FetchProductsParams['sort'],
): LMProduct[] {
  if (!sort) return rows
  const field = sort.field as keyof LMProduct
  const dir = sort.direction === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (av == null) return 1
    if (bv == null) return -1
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })
}

/**
 * Évalue les conditions du `FilterModel` côté serveur mocké. Reproduit la
 * logique minimale du `useFilterEngine` pour les types built-in (text /
 * number / set / boolean) + le custom via `condition.model`. Suffisant
 * pour la démo — les vraies APIs auront leur propre query builder.
 */
function applyFilterModel(
  rows: LMProduct[],
  model: FilterModel | undefined,
): LMProduct[] {
  if (!model || model.conditions.length === 0) return rows

  return rows.filter((row) => {
    // Évaluation gauche-droite avec combinator (AND/OR) — l'engine grid
    // utilise la même règle.
    const first = model.conditions[0]
    if (!first) return true
    let pass = matchCondition(row, first)
    for (let i = 1; i < model.conditions.length; i++) {
      const cond = model.conditions[i]!
      const result = matchCondition(row, cond)
      pass = cond.combinator === 'and' ? pass && result : pass || result
    }
    return pass
  })
}

function matchCondition(row: LMProduct, condition: FilterModel['conditions'][number]): boolean {
  const field = condition.field as keyof LMProduct
  const cell = row[field]

  // Filtre custom AG-Grid-style → `condition.model` porte l'état. La
  // logique d'évaluation par champ est inline plutôt que générique : la
  // démo expose 2 filtres custom (category + price), c'est plus lisible
  // d'avoir le code de chaque ici.
  if (condition.model != null) {
    if (field === 'category' && Array.isArray(condition.model)) {
      return condition.model.length === 0 || condition.model.includes(String(cell))
    }
    if (field === 'price' && Array.isArray(condition.model)) {
      const [min, max] = condition.model as [number, number]
      return typeof cell === 'number' && cell >= min && cell <= max
    }
    return true
  }

  const value = condition.value?.value
  const valueTo = condition.value?.valueTo

  switch (condition.operator) {
    case 'contains':
      return value == null || String(cell ?? '').toLowerCase().includes(String(value).toLowerCase())
    case 'notContains':
      return !String(cell ?? '').toLowerCase().includes(String(value).toLowerCase())
    case 'equals':
      return value == null || String(cell) === String(value)
    case 'notEquals':
      return String(cell) !== String(value)
    case 'startsWith':
      return String(cell ?? '').toLowerCase().startsWith(String(value).toLowerCase())
    case 'endsWith':
      return String(cell ?? '').toLowerCase().endsWith(String(value).toLowerCase())
    case 'gt':
      return Number(cell) > Number(value)
    case 'gte':
      return Number(cell) >= Number(value)
    case 'lt':
      return Number(cell) < Number(value)
    case 'lte':
      return Number(cell) <= Number(value)
    case 'between':
      return Number(cell) >= Number(value) && Number(cell) <= Number(valueTo)
    case 'in':
      return Array.isArray(value) ? value.map(String).includes(String(cell)) : String(cell) === String(value)
    case 'notIn':
      return Array.isArray(value) ? !value.map(String).includes(String(cell)) : String(cell) !== String(value)
    case 'blank':
      return cell == null || cell === ''
    case 'notBlank':
      return cell != null && cell !== ''
    default:
      return true
  }
}

/** Sparkline 30 points pseudo-aléatoires — déterministe selon le seed. */
function makeSparkline(seedValue: number): number[] {
  let seed = (seedValue % 1000) + 1
  return Array.from({ length: 30 }, () => {
    seed = (seed * 9301 + 49297) % 233280
    return Math.round(50 + (seed / 233280) * 100)
  })
}
