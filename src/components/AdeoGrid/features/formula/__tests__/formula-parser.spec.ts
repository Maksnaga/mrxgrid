// @ts-nocheck — Port verbatim from Angular spec. Strict typing pending review against the ported utils.
import { describe, it, expect, beforeEach } from 'vitest'
import { FormulaParseError, parseFormula } from '../formula-parser';
import {
  BinaryOpNode,
  CellRefNode,
  FunctionCallNode,
  NumberLiteralNode,
  RangeRefNode,
  UnaryOpNode,
  cellRefToA1,
  cellRefToLongForm,
  columnIndexToLetters,
  columnLettersToIndex,
  formatField,
} from '../formula-ast';

const ref = (field: string, row: number): string => `REF(COLUMN("${field}"),ROW(${row}))`;

describe('parseFormula — literals', () => {
  it('parses numbers', () => {
    expect(parseFormula('=42')).toEqual({ kind: 'number', value: 42 });
    expect(parseFormula('=3.14')).toEqual({ kind: 'number', value: 3.14 });
    expect(parseFormula('=.5')).toEqual({ kind: 'number', value: 0.5 });
    expect(parseFormula('=1e3')).toEqual({ kind: 'number', value: 1000 });
    expect(parseFormula('=2.5e-3')).toEqual({ kind: 'number', value: 0.0025 });
  });

  it('parses strings with doubled-quote escapes', () => {
    expect(parseFormula('="hello"')).toEqual({ kind: 'string', value: 'hello' });
    expect(parseFormula('="she said ""hi"""')).toEqual({
      kind: 'string',
      value: 'she said "hi"',
    });
  });

  it('parses booleans case-insensitively', () => {
    expect(parseFormula('=TRUE')).toEqual({ kind: 'boolean', value: true });
    expect(parseFormula('=false')).toEqual({ kind: 'boolean', value: false });
  });

  it('accepts formulas without the leading equals sign', () => {
    expect(parseFormula('42')).toEqual({ kind: 'number', value: 42 });
  });
});

describe('parseFormula — arithmetic & precedence', () => {
  it('respects * over +', () => {
    const ast = parseFormula('=1 + 2 * 3') as BinaryOpNode;
    expect(ast.kind).toBe('binary');
    expect(ast.op).toBe('+');
    const right = ast.right as BinaryOpNode;
    expect(right.op).toBe('*');
  });

  it('respects parentheses', () => {
    const ast = parseFormula('=(1 + 2) * 3') as BinaryOpNode;
    expect(ast.op).toBe('*');
    expect((ast.left as BinaryOpNode).op).toBe('+');
  });

  it('treats ^ as right-associative', () => {
    const ast = parseFormula('=2 ^ 3 ^ 2') as BinaryOpNode;
    expect(ast.op).toBe('^');
    expect((ast.left as NumberLiteralNode).value).toBe(2);
    const right = ast.right as BinaryOpNode;
    expect(right.op).toBe('^');
    expect((right.left as NumberLiteralNode).value).toBe(3);
    expect((right.right as NumberLiteralNode).value).toBe(2);
  });

  it('handles unary minus', () => {
    const ast = parseFormula('=-5') as UnaryOpNode;
    expect(ast.kind).toBe('unary');
    expect(ast.op).toBe('-');
    expect((ast.operand as NumberLiteralNode).value).toBe(5);
  });
});

describe('parseFormula — REF long-form references', () => {
  it('parses a relative ref', () => {
    const ast = parseFormula(`=${ref('price', 1)}`) as CellRefNode;
    expect(ast.kind).toBe('ref');
    expect(ast.ref).toEqual({ field: 'price', row: 1, absField: false, absRow: false });
  });

  it('parses an absolute-column lock', () => {
    const ast = parseFormula(`=REF(COLUMN("price"),ROW(5),"$C")`) as CellRefNode;
    expect(ast.ref).toEqual({ field: 'price', row: 5, absField: true, absRow: false });
  });

  it('parses an absolute-row lock', () => {
    const ast = parseFormula(`=REF(COLUMN("price"),ROW(5),"$R")`) as CellRefNode;
    expect(ast.ref).toEqual({ field: 'price', row: 5, absField: false, absRow: true });
  });

  it('parses a fully absolute lock', () => {
    const ast = parseFormula(`=REF(COLUMN("price"),ROW(5),"$CR")`) as CellRefNode;
    expect(ast.ref).toEqual({ field: 'price', row: 5, absField: true, absRow: true });
  });

  it('parses a quoted field name with special characters', () => {
    const ast = parseFormula(`=REF(COLUMN("Unit Price"),ROW(1))`) as CellRefNode;
    expect(ast.ref.field).toBe('Unit Price');
  });

  it('parses a quoted field name with escaped quotes', () => {
    const ast = parseFormula(`=REF(COLUMN("he said ""hi"""),ROW(1))`) as CellRefNode;
    expect(ast.ref.field).toBe('he said "hi"');
  });

  it('parses a vertical range', () => {
    const ast = parseFormula(`=${ref('price', 1)}:${ref('price', 5)}`) as RangeRefNode;
    expect(ast.kind).toBe('range');
    expect(ast.start).toEqual({ field: 'price', row: 1, absField: false, absRow: false });
    expect(ast.end).toEqual({ field: 'price', row: 5, absField: false, absRow: false });
  });

  it('parses a horizontal same-row range', () => {
    const ast = parseFormula(`=${ref('price', 1)}:${ref('total', 1)}`) as RangeRefNode;
    expect(ast.start.field).toBe('price');
    expect(ast.end.field).toBe('total');
    expect(ast.start.row).toBe(1);
  });

  it('parses ref keywords case-insensitively', () => {
    const ast = parseFormula(`=ref(column("price"),row(1))`) as CellRefNode;
    expect(ast.ref).toEqual({ field: 'price', row: 1, absField: false, absRow: false });
  });

  it('parses a same-row ref (no ROW arg)', () => {
    const ast = parseFormula('=REF(COLUMN("price"))') as CellRefNode;
    expect(ast.kind).toBe('ref');
    expect(ast.ref).toEqual({
      field: 'price',
      row: 0,
      absField: false,
      absRow: false,
      sameRow: true,
    });
  });

  it('parses a mix of same-row and explicit-row refs in one expression', () => {
    const ast = parseFormula(
      '=REF(COLUMN("price"))*REF(COLUMN("qty"),ROW(1))',
    );
    expect(ast.kind).toBe('binary');
  });
});

describe('parseFormula — functions', () => {
  it('parses calls with no arguments', () => {
    const ast = parseFormula('=NOW()') as FunctionCallNode;
    expect(ast.kind).toBe('call');
    expect(ast.name).toBe('NOW');
    expect(ast.args).toEqual([]);
  });

  it('parses calls with multiple arguments (comma locale)', () => {
    const ast = parseFormula('=SUM(1, 2, 3)') as FunctionCallNode;
    expect(ast.name).toBe('SUM');
    expect(ast.args.length).toBe(3);
  });

  it('parses calls with semicolon separator when locale is fr', () => {
    const ast = parseFormula('=SUM(1; 2; 3)', { locale: 'fr' }) as FunctionCallNode;
    expect(ast.args.length).toBe(3);
  });

  it('up-cases function names', () => {
    const ast = parseFormula('=sum(1)') as FunctionCallNode;
    expect(ast.name).toBe('SUM');
  });

  it('parses nested calls with REF refs', () => {
    const ast = parseFormula(
      `=SUM(1, AVERAGE(${ref('price', 1)}:${ref('price', 3)}))`,
    ) as FunctionCallNode;
    expect(ast.args.length).toBe(2);
    expect((ast.args[1] as FunctionCallNode).kind).toBe('call');
  });
});

describe('parseFormula — errors', () => {
  it('throws FormulaParseError on dangling operator', () => {
    expect(() => parseFormula('=1 +')).toThrowError(FormulaParseError);
  });

  it('throws on unterminated string', () => {
    expect(() => parseFormula('="abc')).toThrowError(FormulaParseError);
  });

  it('throws on unknown character', () => {
    expect(() => parseFormula('=@')).toThrowError(FormulaParseError);
  });

  it('throws on unbalanced parentheses', () => {
    expect(() => parseFormula('=(1 + 2')).toThrowError(FormulaParseError);
  });

  it('throws when REF lock marker is invalid', () => {
    expect(() =>
      parseFormula(`=REF(COLUMN("price"),ROW(1),"NOPE")`),
    ).toThrowError(FormulaParseError);
  });

  it('throws on zero / missing row numbers', () => {
    expect(() => parseFormula(`=REF(COLUMN("price"),ROW(0))`)).toThrowError(FormulaParseError);
  });
});

describe('column-letter helpers', () => {
  it('round-trips single-letter columns', () => {
    expect(columnIndexToLetters(0)).toBe('A');
    expect(columnIndexToLetters(25)).toBe('Z');
    expect(columnLettersToIndex('A')).toBe(0);
    expect(columnLettersToIndex('Z')).toBe(25);
  });

  it('round-trips multi-letter columns', () => {
    expect(columnIndexToLetters(26)).toBe('AA');
    expect(columnIndexToLetters(701)).toBe('ZZ');
    expect(columnIndexToLetters(702)).toBe('AAA');
    expect(columnLettersToIndex('AA')).toBe(26);
    expect(columnLettersToIndex('ZZ')).toBe(701);
    expect(columnLettersToIndex('AAA')).toBe(702);
  });

  it('accepts lowercase letters', () => {
    expect(columnLettersToIndex('a')).toBe(0);
    expect(columnLettersToIndex('aa')).toBe(26);
  });

  it('returns -1 on invalid input', () => {
    expect(columnLettersToIndex('')).toBe(-1);
    expect(columnLettersToIndex('1')).toBe(-1);
  });
});

describe('field-name helpers', () => {
  it('leaves bare field names unquoted in COLUMN(…) form', () => {
    expect(formatField('price')).toBe('price');
    expect(formatField('unit_price')).toBe('unit_price');
  });

  it('quotes field names with special chars and escapes embedded quotes', () => {
    expect(formatField('Unit Price')).toBe('"Unit Price"');
    expect(formatField('he said "hi"')).toBe('"he said ""hi"""');
  });
});

describe('ref formatters', () => {
  const fields = ['id', 'price', 'qty', 'total'];

  it('renders A1 form using the current column order', () => {
    expect(
      cellRefToA1({ field: 'price', row: 1, absField: false, absRow: false }, fields),
    ).toBe('B1');
    expect(
      cellRefToA1({ field: 'qty', row: 5, absField: true, absRow: true }, fields),
    ).toBe('$C$5');
  });

  it('returns #REF! when the field is not visible', () => {
    expect(cellRefToA1({ field: 'gone', row: 1, absField: false, absRow: false }, fields)).toBe(
      '#REF!',
    );
  });

  it('renders REF long-form storage', () => {
    expect(cellRefToLongForm({ field: 'price', row: 1, absField: false, absRow: false })).toBe(
      'REF(COLUMN("price"),ROW(1))',
    );
  });
});