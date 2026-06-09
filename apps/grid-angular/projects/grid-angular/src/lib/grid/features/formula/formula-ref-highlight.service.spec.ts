import { FormulaRefPalette, paletteColorVar } from './formula-ref-palette';
import { FormulaRefHighlightService, RefHighlight } from './formula-ref-highlight.service';
import type { CellAddress } from '../../models/formula.model';

describe('FormulaRefPalette', () => {
  it('assigns the same slot to repeated keys', () => {
    const p = new FormulaRefPalette();
    expect(p.indexFor('A1')).toBe(0);
    expect(p.indexFor('A1')).toBe(0);
    expect(p.indexFor('B2')).toBe(1);
  });

  it('wraps around the palette size', () => {
    const p = new FormulaRefPalette();
    for (let i = 0; i < 8; i++) p.indexFor(`k${i}`);
    expect(p.indexFor('k8')).toBe(0);
  });

  it('resets on clear()', () => {
    const p = new FormulaRefPalette();
    p.indexFor('A1');
    p.indexFor('B1');
    p.clear();
    expect(p.indexFor('Z9')).toBe(0);
  });

  it('emits a CSS var reference', () => {
    expect(paletteColorVar(3)).toBe('var(--ad-grid-ref-color-3)');
    expect(paletteColorVar(99)).toBe('var(--ad-grid-ref-color-3)');
  });
});

describe('FormulaRefHighlightService', () => {
  function make(): FormulaRefHighlightService {
    return new FormulaRefHighlightService();
  }

  const cellA1: CellAddress = { rowId: 'r1', field: 'price' };
  const cellB1: CellAddress = { rowId: 'r1', field: 'qty' };

  function hl(
    svc: FormulaRefHighlightService,
    key: string,
    cells: CellAddress[],
    tokenStart = 0,
    tokenEnd = 2,
  ): RefHighlight {
    const { index, cssVar } = svc.colorFor(key);
    return { key, cells, tokenStart, tokenEnd, colorIndex: index, cssVar };
  }

  it('starts inactive and empty', () => {
    const svc = make();
    expect(svc.isActive()).toBeFalse();
    expect(svc.highlights()).toEqual([]);
    expect(svc.colorByCell().size).toBe(0);
  });

  it('activate / deactivate drives isActive', () => {
    const svc = make();
    svc.activate({
      pickCell: () => undefined,
      pickRangeStart: () => undefined,
      pickRangeExtend: () => undefined,
      pickRangeCommit: () => undefined,
    });
    expect(svc.isActive()).toBeTrue();
    svc.deactivate();
    expect(svc.isActive()).toBeFalse();
  });

  it('activate defaults to pickMode=true; deactivate resets it', () => {
    const svc = make();
    expect(svc.isPickMode()).toBeFalse();
    svc.activate({
      pickCell: () => undefined,
      pickRangeStart: () => undefined,
      pickRangeExtend: () => undefined,
      pickRangeCommit: () => undefined,
    });
    expect(svc.isPickMode()).toBeTrue();
    svc.deactivate();
    expect(svc.isPickMode()).toBeFalse();
  });

  it('pickMode can be disabled while isActive stays true (text-only editor)', () => {
    const svc = make();
    svc.activate(
      {
        pickCell: () => undefined,
        pickRangeStart: () => undefined,
        pickRangeExtend: () => undefined,
        pickRangeCommit: () => undefined,
      },
      { pickMode: false },
    );
    expect(svc.isActive()).toBeTrue();
    expect(svc.isPickMode()).toBeFalse();
    svc.deactivate();
  });

  it('colorByCell exposes cssVar for every referenced cell', () => {
    const svc = make();
    svc.setHighlights([hl(svc, 'A1', [cellA1]), hl(svc, 'B1', [cellB1])]);
    const map = svc.colorByCell();
    expect(map.get('r1|price')).toBe('var(--ad-grid-ref-color-0)');
    expect(map.get('r1|qty')).toBe('var(--ad-grid-ref-color-1)');
  });

  it('same ref key across updates keeps the same color slot', () => {
    const svc = make();
    const color1 = svc.colorFor('A1');
    svc.setHighlights([hl(svc, 'Z9', [cellA1])]);
    const color2 = svc.colorFor('A1');
    expect(color2.index).toBe(color1.index);
  });

  it('deactivate resets palette assignments', () => {
    const svc = make();
    svc.colorFor('A1');
    svc.colorFor('B1');
    svc.activate({
      pickCell: () => undefined,
      pickRangeStart: () => undefined,
      pickRangeExtend: () => undefined,
      pickRangeCommit: () => undefined,
    });
    svc.deactivate();
    expect(svc.colorFor('Z9').index).toBe(0);
  });

  it('dispatches pick events to the registered handler only', () => {
    const svc = make();
    const seen: unknown[] = [];
    svc.activate({
      pickCell: (a, o) => seen.push(['pick', a, o]),
      pickRangeStart: (a) => seen.push(['start', a]),
      pickRangeExtend: (e) => seen.push(['ext', e]),
      pickRangeCommit: () => seen.push(['commit']),
    });
    svc.pickCell(cellA1, { absolute: true });
    svc.pickRangeStart(cellA1, { absolute: false });
    svc.pickRangeExtend(cellB1);
    svc.pickRangeCommit();
    expect(seen).toHaveSize(4);
    svc.deactivate();
    svc.pickCell(cellA1, { absolute: false });
    expect(seen).toHaveSize(4);
  });
});
