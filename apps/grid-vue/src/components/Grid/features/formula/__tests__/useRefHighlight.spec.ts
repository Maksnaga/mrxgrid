// @ts-nocheck — Adapted from Angular `formula-ref-highlight.service.spec.ts`.
// Strict typing pending review.

import { describe, it, expect } from 'vitest'
import { FormulaRefPalette, paletteColorVar } from '../formula-ref-palette'
import { useRefHighlight, type RefHighlight } from '../useRefHighlight'
import type { CellAddress } from '../../../models/formula.model'

describe('FormulaRefPalette', () => {
  it('assigns the same slot to repeated keys', () => {
    const p = new FormulaRefPalette()
    expect(p.indexFor('A1')).toBe(0)
    expect(p.indexFor('A1')).toBe(0)
    expect(p.indexFor('B2')).toBe(1)
  })

  it('wraps around the palette size', () => {
    const p = new FormulaRefPalette()
    for (let i = 0; i < 8; i++) p.indexFor(`k${i}`)
    expect(p.indexFor('k8')).toBe(0)
  })

  it('resets on clear()', () => {
    const p = new FormulaRefPalette()
    p.indexFor('A1')
    p.indexFor('B1')
    p.clear()
    expect(p.indexFor('Z9')).toBe(0)
  })

  it('emits a CSS var reference', () => {
    expect(paletteColorVar(3)).toBe('var(--ad-grid-ref-color-3)')
    expect(paletteColorVar(99)).toBe('var(--ad-grid-ref-color-3)')
  })
})

describe('useRefHighlight (composable)', () => {
  const cellA1: CellAddress = { rowId: 'r1', field: 'price' }
  const cellB1: CellAddress = { rowId: 'r1', field: 'qty' }

  function hl(
    svc: ReturnType<typeof useRefHighlight>,
    key: string,
    cells: CellAddress[],
    tokenStart = 0,
    tokenEnd = 2,
  ): RefHighlight {
    const { index, cssVar } = svc.colorFor(key)
    return { key, cells, tokenStart, tokenEnd, colorIndex: index, cssVar }
  }

  const noopHandler = {
    pickCell: () => undefined,
    pickRangeStart: () => undefined,
    pickRangeExtend: () => undefined,
    pickRangeCommit: () => undefined,
  }

  it('starts inactive and empty', () => {
    const svc = useRefHighlight()
    expect(svc.isActive.value).toBe(false)
    expect(svc.highlights.value).toEqual([])
    expect(svc.colorByCell.value.size).toBe(0)
  })

  it('activate / deactivate drives isActive', () => {
    const svc = useRefHighlight()
    svc.activate(noopHandler)
    expect(svc.isActive.value).toBe(true)
    svc.deactivate()
    expect(svc.isActive.value).toBe(false)
  })

  it('activate defaults to pickMode=true; deactivate resets it', () => {
    const svc = useRefHighlight()
    expect(svc.isPickMode.value).toBe(false)
    svc.activate(noopHandler)
    expect(svc.isPickMode.value).toBe(true)
    svc.deactivate()
    expect(svc.isPickMode.value).toBe(false)
  })

  it('pickMode can be disabled while isActive stays true (text-only editor)', () => {
    const svc = useRefHighlight()
    svc.activate(noopHandler, { pickMode: false })
    expect(svc.isActive.value).toBe(true)
    expect(svc.isPickMode.value).toBe(false)
    svc.deactivate()
  })

  it('colorByCell exposes cssVar for every referenced cell', () => {
    const svc = useRefHighlight()
    svc.setHighlights([hl(svc, 'A1', [cellA1]), hl(svc, 'B1', [cellB1])])
    const map = svc.colorByCell.value
    expect(map.get('r1|price')).toBe('var(--ad-grid-ref-color-0)')
    expect(map.get('r1|qty')).toBe('var(--ad-grid-ref-color-1)')
  })

  it('same ref key across updates keeps the same color slot', () => {
    const svc = useRefHighlight()
    const color1 = svc.colorFor('A1')
    svc.setHighlights([hl(svc, 'Z9', [cellA1])])
    const color2 = svc.colorFor('A1')
    expect(color2.index).toBe(color1.index)
  })

  it('deactivate resets palette assignments', () => {
    const svc = useRefHighlight()
    svc.colorFor('A1')
    svc.colorFor('B1')
    svc.activate(noopHandler)
    svc.deactivate()
    expect(svc.colorFor('Z9').index).toBe(0)
  })

  it('dispatches pick events to the registered handler only', () => {
    const svc = useRefHighlight()
    const seen: unknown[] = []
    svc.activate({
      pickCell: (a, o) => seen.push(['pick', a, o]),
      pickRangeStart: (a) => seen.push(['start', a]),
      pickRangeExtend: (e) => seen.push(['ext', e]),
      pickRangeCommit: () => seen.push(['commit']),
    })
    svc.pickCell(cellA1, { absolute: true })
    svc.pickRangeStart(cellA1, { absolute: false })
    svc.pickRangeExtend(cellB1)
    svc.pickRangeCommit()
    expect(seen).toHaveLength(4)
    svc.deactivate()
    svc.pickCell(cellA1, { absolute: false })
    expect(seen).toHaveLength(4)
  })
})
