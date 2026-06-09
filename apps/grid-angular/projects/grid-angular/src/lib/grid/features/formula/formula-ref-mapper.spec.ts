import {
  a1ToLongForm,
  addressToA1,
  longFormToA1,
  rangeToAddresses,
  resolveAst,
  RefMapperContext,
  structuredRefToAddress,
} from './formula-ref-mapper';
import { parseFormula } from './formula-parser';
import { CellRefNode, RangeRefNode, StructuredRef } from './formula-ast';

const CTX: RefMapperContext = {
  fields: ['price', 'qty', 'total'],
  rowIds: ['r_1', 'r_2', 'r_3'],
};

function ref(field: string, row: number, absField = false, absRow = false): StructuredRef {
  return { field, row, absField, absRow };
}

describe('RefMapper — structuredRefToAddress', () => {
  it('resolves (field, row) to (rowId, field)', () => {
    expect(structuredRefToAddress(ref('price', 1), CTX)).toEqual({
      rowId: 'r_1',
      field: 'price',
    });
  });

  it('returns undefined when the field is unknown', () => {
    expect(structuredRefToAddress(ref('missing', 1), CTX)).toBeUndefined();
  });

  it('returns undefined when the row is out of range', () => {
    expect(structuredRefToAddress(ref('price', 99), CTX)).toBeUndefined();
  });
});

describe('RefMapper — rangeToAddresses', () => {
  it('expands a vertical range (same field)', () => {
    const addrs = rangeToAddresses(ref('price', 1), ref('price', 3), CTX);
    expect(addrs).toEqual([
      { rowId: 'r_1', field: 'price' },
      { rowId: 'r_2', field: 'price' },
      { rowId: 'r_3', field: 'price' },
    ]);
  });

  it('expands a horizontal same-row range', () => {
    const addrs = rangeToAddresses(ref('price', 2), ref('total', 2), CTX);
    expect(addrs).toEqual([
      { rowId: 'r_2', field: 'price' },
      { rowId: 'r_2', field: 'qty' },
      { rowId: 'r_2', field: 'total' },
    ]);
  });

  it('expands a rectangular range row-major', () => {
    const addrs = rangeToAddresses(ref('price', 1), ref('qty', 2), CTX);
    expect(addrs).toEqual([
      { rowId: 'r_1', field: 'price' },
      { rowId: 'r_1', field: 'qty' },
      { rowId: 'r_2', field: 'price' },
      { rowId: 'r_2', field: 'qty' },
    ]);
  });

  it('normalises reversed ranges', () => {
    const addrs = rangeToAddresses(ref('qty', 2), ref('price', 1), CTX);
    expect(addrs.length).toBe(4);
  });

  it('surfaces undefined entries when a row is out of range', () => {
    const addrs = rangeToAddresses(ref('price', 1), ref('price', 99), CTX);
    expect(addrs.slice(0, 3)).toEqual([
      { rowId: 'r_1', field: 'price' },
      { rowId: 'r_2', field: 'price' },
      { rowId: 'r_3', field: 'price' },
    ]);
    // Every row after r_3 is out-of-range and yields undefined.
    expect(addrs.length).toBe(99);
    expect(addrs[98]).toBeUndefined();
  });
});

describe('RefMapper — resolveAst', () => {
  it('attaches resolved addresses to refs', () => {
    const ast = resolveAst(
      parseFormula('=REF(COLUMN("price"),ROW(1))'),
      CTX,
    ) as CellRefNode;
    expect(ast.resolved).toEqual({ rowId: 'r_1', field: 'price' });
  });

  it('attaches resolved addresses to ranges', () => {
    const ast = resolveAst(
      parseFormula('=REF(COLUMN("price"),ROW(1)):REF(COLUMN("qty"),ROW(2))'),
      CTX,
    ) as RangeRefNode;
    expect(ast.resolved?.length).toBe(4);
    expect(ast.resolved?.[3]).toEqual({ rowId: 'r_2', field: 'qty' });
  });

  it('does not mutate the input AST', () => {
    const input = parseFormula('=REF(COLUMN("price"),ROW(1))');
    const out = resolveAst(input, CTX);
    expect(input).not.toBe(out);
    expect((input as CellRefNode).resolved).toBeUndefined();
  });

  it('handles nested function calls', () => {
    const ast = resolveAst(
      parseFormula('=SUM(REF(COLUMN("price"),ROW(1)), REF(COLUMN("qty"),ROW(2)))'),
      CTX,
    );
    expect(ast.kind).toBe('call');
    if (ast.kind !== 'call') return;
    const first = ast.args[0] as CellRefNode;
    const second = ast.args[1] as CellRefNode;
    expect(first.resolved).toEqual({ rowId: 'r_1', field: 'price' });
    expect(second.resolved).toEqual({ rowId: 'r_2', field: 'qty' });
  });
});

describe('RefMapper — addressToA1', () => {
  it('renders an address using the current column order', () => {
    expect(addressToA1({ rowId: 'r_2', field: 'qty' }, CTX)).toBe('B2');
    expect(addressToA1({ rowId: 'r_3', field: 'total' }, CTX)).toBe('C3');
  });

  it('returns undefined when the field is not visible', () => {
    expect(addressToA1({ rowId: 'r_1', field: 'missing' }, CTX)).toBeUndefined();
  });
});

describe('RefMapper — a1ToLongForm', () => {
  it('rewrites a simple ref using the current column order', () => {
    expect(a1ToLongForm('=A1+B2', CTX)).toBe(
      '=REF(COLUMN("price"),ROW(1))+REF(COLUMN("qty"),ROW(2))',
    );
  });

  it('emits a lock marker for absolute refs', () => {
    expect(a1ToLongForm('=$A$1', CTX)).toBe('=REF(COLUMN("price"),ROW(1),"$CR")');
    expect(a1ToLongForm('=$A1', CTX)).toBe('=REF(COLUMN("price"),ROW(1),"$C")');
    expect(a1ToLongForm('=A$1', CTX)).toBe('=REF(COLUMN("price"),ROW(1),"$R")');
  });

  it('replaces refs pointing to unknown columns with #REF!', () => {
    expect(a1ToLongForm('=Z1', CTX)).toBe('=#REF!');
  });

  it('leaves string literals alone', () => {
    expect(a1ToLongForm('=CONCAT("A1 literal", A1)', CTX)).toBe(
      '=CONCAT("A1 literal", REF(COLUMN("price"),ROW(1)))',
    );
  });

  it('does not rewrite function calls that look like A1', () => {
    expect(a1ToLongForm('=ATAN2(1, 2)', CTX)).toBe('=ATAN2(1, 2)');
  });

  it('does not rewrite identifiers containing digits', () => {
    expect(a1ToLongForm('=foo1 + A1', CTX)).toBe('=foo1 + REF(COLUMN("price"),ROW(1))');
  });
});

describe('RefMapper — longFormToA1', () => {
  it('renders refs as A1 using the current column order', () => {
    expect(longFormToA1('=REF(COLUMN("price"),ROW(1))+1', CTX)).toBe('=A1+1');
  });

  it('honors lock markers', () => {
    expect(longFormToA1('=REF(COLUMN("price"),ROW(1),"$CR")', CTX)).toBe('=$A$1');
    expect(longFormToA1('=REF(COLUMN("price"),ROW(1),"$C")', CTX)).toBe('=$A1');
    expect(longFormToA1('=REF(COLUMN("price"),ROW(1),"$R")', CTX)).toBe('=A$1');
  });

  it('emits #REF! for unknown columns', () => {
    expect(longFormToA1('=REF(COLUMN("gone"),ROW(1))', CTX)).toBe('=#REF!');
  });

  it('round-trips through a1ToLongForm', () => {
    const a1 = '=A1+$B$2';
    expect(longFormToA1(a1ToLongForm(a1, CTX), CTX)).toBe(a1);
  });
});

describe('RefMapper — same-row refs', () => {
  const rowCtx: RefMapperContext = { ...CTX, currentRowId: 'r_2' };

  it('resolves [field] to (currentRowId, field)', () => {
    const r: StructuredRef = {
      field: 'price',
      row: 0,
      absField: false,
      absRow: false,
      sameRow: true,
    };
    expect(structuredRefToAddress(r, rowCtx)).toEqual({ rowId: 'r_2', field: 'price' });
  });

  it('returns undefined when currentRowId is missing', () => {
    const r: StructuredRef = {
      field: 'price',
      row: 0,
      absField: false,
      absRow: false,
      sameRow: true,
    };
    expect(structuredRefToAddress(r, CTX)).toBeUndefined();
  });

  it('a1ToLongForm converts [field] → REF(COLUMN("field"))', () => {
    expect(a1ToLongForm('=[price]*[qty]', CTX)).toBe(
      '=REF(COLUMN("price"))*REF(COLUMN("qty"))',
    );
  });

  it('a1ToLongForm emits #REF! for unknown fields inside brackets', () => {
    expect(a1ToLongForm('=[gone]+1', CTX)).toBe('=#REF!+1');
  });

  it('longFormToA1 with currentRowId renders same-row refs as concrete A1', () => {
    const rowCtx: RefMapperContext = { ...CTX, currentRowId: 'r_2' };
    expect(longFormToA1('=REF(COLUMN("price"))*REF(COLUMN("qty"))', rowCtx)).toBe(
      '=A2*B2',
    );
  });

  it('longFormToA1 without currentRowId falls back to [field] shorthand', () => {
    expect(longFormToA1('=REF(COLUMN("price"))*REF(COLUMN("qty"))', CTX)).toBe(
      '=[price]*[qty]',
    );
  });

  it('a1ToLongForm collapses relative refs on the current row to same-row storage', () => {
    const rowCtx: RefMapperContext = { ...CTX, currentRowId: 'r_1' };
    expect(a1ToLongForm('=A1*B1', rowCtx)).toBe(
      '=REF(COLUMN("price"))*REF(COLUMN("qty"))',
    );
  });

  it('a1ToLongForm keeps $-locked refs explicit even when they match the host row', () => {
    const rowCtx: RefMapperContext = { ...CTX, currentRowId: 'r_1' };
    expect(a1ToLongForm('=$A$1', rowCtx)).toBe(
      '=REF(COLUMN("price"),ROW(1),"$CR")',
    );
    expect(a1ToLongForm('=A$1', rowCtx)).toBe(
      '=REF(COLUMN("price"),ROW(1),"$R")',
    );
    expect(a1ToLongForm('=$A1', rowCtx)).toBe(
      '=REF(COLUMN("price"),ROW(1),"$C")',
    );
  });

  it('a1ToLongForm keeps refs pointing at other rows explicit', () => {
    const rowCtx: RefMapperContext = { ...CTX, currentRowId: 'r_1' };
    // Editing row 1 but writing B3 → explicit row, not same-row.
    expect(a1ToLongForm('=B3', rowCtx)).toBe('=REF(COLUMN("qty"),ROW(3))');
  });

  it('round-trips through a1ToLongForm / longFormToA1', () => {
    const a1 = '=[price]*[qty]+A1';
    expect(longFormToA1(a1ToLongForm(a1, CTX), CTX)).toBe(a1);
  });

  it('round-trips A1 ↔ storage for a same-row-host edit', () => {
    // With a host row the display and commit sides reinforce each other:
    // stored same-row → displayed as A1 → committed back as same-row.
    const rowCtx: RefMapperContext = { ...CTX, currentRowId: 'r_2' };
    const stored = '=REF(COLUMN("price"))*REF(COLUMN("qty"))';
    const displayed = longFormToA1(stored, rowCtx);
    expect(displayed).toBe('=A2*B2');
    expect(a1ToLongForm(displayed, rowCtx)).toBe(stored);
  });

  it('preserves an A1 ref when the field name happens to look like one', () => {
    // Field literally named "A1" — the `[A1]` shorthand must not collide
    // with the A1 letter-digit scanner.
    const ctx: RefMapperContext = { fields: ['A1', 'price'], rowIds: ['r1'] };
    expect(a1ToLongForm('=[A1]', ctx)).toBe('=REF(COLUMN("A1"))');
  });

  it('expands a same-row range [a]:[c] across columns on the host row', () => {
    const start: StructuredRef = {
      field: 'price',
      row: 0,
      absField: false,
      absRow: false,
      sameRow: true,
    };
    const end: StructuredRef = {
      field: 'total',
      row: 0,
      absField: false,
      absRow: false,
      sameRow: true,
    };
    expect(rangeToAddresses(start, end, rowCtx)).toEqual([
      { rowId: 'r_2', field: 'price' },
      { rowId: 'r_2', field: 'qty' },
      { rowId: 'r_2', field: 'total' },
    ]);
  });
});
