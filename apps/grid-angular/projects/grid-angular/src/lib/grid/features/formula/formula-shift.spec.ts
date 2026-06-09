import { shiftFormulaRefs } from './formula-shift';

const FIELDS = ['id', 'price', 'qty', 'subtotal', 'total'];

const relRef = (field: string, row: number): string => `REF(COLUMN("${field}"),ROW(${row}))`;
const absRef = (field: string, row: number, lock: '$C' | '$R' | '$CR'): string =>
  `REF(COLUMN("${field}"),ROW(${row}),"${lock}")`;

describe('shiftFormulaRefs', () => {
  it('is a no-op when both deltas are 0', () => {
    const src = `=${relRef('price', 1)}*${relRef('qty', 1)}`;
    expect(shiftFormulaRefs(src, { rowDelta: 0, colDelta: 0, fieldOrder: FIELDS })).toBe(src);
  });

  it('shifts relative rows by the row delta', () => {
    const src = `=${relRef('price', 1)}*${relRef('qty', 1)}`;
    expect(shiftFormulaRefs(src, { rowDelta: 2, colDelta: 0, fieldOrder: FIELDS })).toBe(
      `=${relRef('price', 3)}*${relRef('qty', 3)}`,
    );
  });

  it('supports negative row shifts', () => {
    const src = `=${relRef('price', 5)}*${relRef('qty', 5)}`;
    expect(shiftFormulaRefs(src, { rowDelta: -2, colDelta: 0, fieldOrder: FIELDS })).toBe(
      `=${relRef('price', 3)}*${relRef('qty', 3)}`,
    );
  });

  it('keeps row-absolute refs stable when shifting rows', () => {
    const src = `=${absRef('price', 1, '$R')}*${relRef('qty', 1)}`;
    expect(shiftFormulaRefs(src, { rowDelta: 2, colDelta: 0, fieldOrder: FIELDS })).toBe(
      `=${absRef('price', 1, '$R')}*${relRef('qty', 3)}`,
    );
  });

  it('shifts relative columns by the col delta', () => {
    const src = `=${relRef('price', 1)}`;
    expect(shiftFormulaRefs(src, { rowDelta: 0, colDelta: 2, fieldOrder: FIELDS })).toBe(
      `=${relRef('subtotal', 1)}`,
    );
  });

  it('keeps col-absolute refs stable when shifting columns', () => {
    const src = `=${absRef('price', 1, '$C')}`;
    expect(shiftFormulaRefs(src, { rowDelta: 0, colDelta: 2, fieldOrder: FIELDS })).toBe(
      `=${absRef('price', 1, '$C')}`,
    );
  });

  it('keeps fully absolute refs stable', () => {
    const src = `=${absRef('price', 1, '$CR')}`;
    expect(shiftFormulaRefs(src, { rowDelta: 3, colDelta: 1, fieldOrder: FIELDS })).toBe(
      `=${absRef('price', 1, '$CR')}`,
    );
  });

  it('emits #REF! when a row shift goes below 1', () => {
    const src = `=${relRef('price', 1)}`;
    expect(shiftFormulaRefs(src, { rowDelta: -5, colDelta: 0, fieldOrder: FIELDS })).toBe(
      '=#REF!',
    );
  });

  it('emits #REF! when a column shift runs out of visible range', () => {
    const src = `=${relRef('total', 1)}`;
    expect(shiftFormulaRefs(src, { rowDelta: 0, colDelta: 5, fieldOrder: FIELDS })).toBe(
      '=#REF!',
    );
  });

  it('shifts both endpoints of a range', () => {
    const src = `=SUM(${relRef('price', 1)}:${relRef('price', 3)})`;
    expect(shiftFormulaRefs(src, { rowDelta: 1, colDelta: 0, fieldOrder: FIELDS })).toBe(
      `=SUM(${relRef('price', 2)}:${relRef('price', 4)})`,
    );
  });

  it('leaves string literals untouched', () => {
    const src = `=${relRef('price', 1)} + 2 * "foo"`;
    expect(shiftFormulaRefs(src, { rowDelta: 1, colDelta: 0, fieldOrder: FIELDS })).toBe(
      `=${relRef('price', 2)} + 2 * "foo"`,
    );
  });

  it('leaves a plain non-formula string alone when both deltas are 0', () => {
    expect(shiftFormulaRefs('hello', { rowDelta: 0, colDelta: 0, fieldOrder: FIELDS })).toBe(
      'hello',
    );
  });
});
