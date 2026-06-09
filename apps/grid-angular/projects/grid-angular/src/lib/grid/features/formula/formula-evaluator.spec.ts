import {
  CellAddress,
  FormulaEvalContext,
  FormulaValue,
  FormulaValues,
} from '../../models/formula.model';
import { FormulaAst, NumberLiteralNode, StructuredRef } from './formula-ast';
import { evaluate } from './formula-evaluator';
import { DEFAULT_FORMULA_FUNCTIONS } from './formula-functions.default';
import { parseFormula } from './formula-parser';

/**
 * Test harness: build a context with an in-memory store mapping
 * `rowId|field` to `FormulaValue`, and attach synthetic `resolved`
 * addresses to every ref/range node so the evaluator can look them up.
 */
function makeCtx(cells: Record<string, FormulaValue>): FormulaEvalContext {
  return {
    locale: 'en',
    resolveRef(addr: CellAddress): FormulaValue {
      return cells[`${addr.rowId}|${addr.field}`] ?? FormulaValues.empty();
    },
  };
}

/** Identity convention: `StructuredRef { field, row }` → `{ rowId: "r_<row>", field }`. */
function refToAddress(ref: StructuredRef): CellAddress {
  return { rowId: `r_${ref.row}`, field: ref.field };
}

function resolveAst(node: FormulaAst): FormulaAst {
  switch (node.kind) {
    case 'ref':
      return { kind: 'ref', ref: node.ref, resolved: refToAddress(node.ref) };
    case 'range': {
      // Minimal range expansion for the tests: same field set, varying row.
      const fields =
        node.start.field === node.end.field
          ? [node.start.field]
          : [node.start.field, node.end.field];
      const rowLo = Math.min(node.start.row, node.end.row);
      const rowHi = Math.max(node.start.row, node.end.row);
      const resolved: (CellAddress | undefined)[] = [];
      for (let r = rowLo; r <= rowHi; r++) {
        for (const f of fields) resolved.push({ rowId: `r_${r}`, field: f });
      }
      return { kind: 'range', start: node.start, end: node.end, resolved };
    }
    case 'unary':
      return { kind: 'unary', op: node.op, operand: resolveAst(node.operand) };
    case 'binary':
      return {
        kind: 'binary',
        op: node.op,
        left: resolveAst(node.left),
        right: resolveAst(node.right),
      };
    case 'call':
      return { kind: 'call', name: node.name, args: node.args.map((a) => resolveAst(a)) };
    default:
      return node;
  }
}

function parseAndResolve(source: string): FormulaAst {
  return resolveAst(parseFormula(source));
}

const ref = (field: string, row: number): string => `REF(COLUMN("${field}"),ROW(${row}))`;

const n = (value: number): FormulaValue => ({ kind: 'number', value });
const s = (value: string): FormulaValue => ({ kind: 'string', value });
const b = (value: boolean): FormulaValue => ({ kind: 'boolean', value });

function run(source: string, cells: Record<string, FormulaValue> = {}): FormulaValue {
  const ast = parseAndResolve(source);
  return evaluate(ast, DEFAULT_FORMULA_FUNCTIONS, makeCtx(cells));
}

describe('evaluator — arithmetic', () => {
  it('evaluates basic operations', () => {
    expect(run('=1+2')).toEqual(n(3));
    expect(run('=5-3')).toEqual(n(2));
    expect(run('=2*3')).toEqual(n(6));
    expect(run('=10/4')).toEqual(n(2.5));
  });

  it('respects operator precedence', () => {
    expect(run('=1 + 2 * 3')).toEqual(n(7));
    expect(run('=(1 + 2) * 3')).toEqual(n(9));
  });

  it('applies unary minus correctly', () => {
    expect(run('=-5 + 2')).toEqual(n(-3));
  });

  it('raises powers right-associatively', () => {
    expect(run('=2 ^ 3 ^ 2')).toEqual(n(512));
  });

  it('returns #DIV/0! on zero division', () => {
    expect(run('=1/0')).toEqual({ kind: 'error', error: '#DIV/0!' });
  });

  it('returns #NUM! on overflow', () => {
    expect(run('=10 ^ 500')).toEqual({ kind: 'error', error: '#NUM!' });
  });
});

describe('evaluator — comparisons', () => {
  it('compares numbers', () => {
    expect(run('=3 > 2')).toEqual(b(true));
    expect(run('=3 = 3')).toEqual(b(true));
    expect(run('=3 <> 2')).toEqual(b(true));
    expect(run('=3 <= 2')).toEqual(b(false));
  });

  it('compares strings case-insensitively', () => {
    expect(run('="Abc" = "abc"')).toEqual(b(true));
    expect(run('="abc" < "abd"')).toEqual(b(true));
  });

  it('short-circuits errors', () => {
    expect(run('=1/0 = 1')).toEqual({ kind: 'error', error: '#DIV/0!' });
  });
});

describe('evaluator — concatenation', () => {
  it('joins strings and numbers', () => {
    expect(run('="foo" & "bar"')).toEqual(s('foobar'));
    expect(run('="n=" & 42')).toEqual(s('n=42'));
  });
});

describe('evaluator — references', () => {
  it('reads a single cell', () => {
    const ast = parseAndResolve(`=${ref('price', 1)}`);
    const res = evaluate(ast, DEFAULT_FORMULA_FUNCTIONS, makeCtx({ 'r_1|price': n(7) }));
    expect(res).toEqual(n(7));
  });

  it('returns empty for missing cells', () => {
    const ast = parseAndResolve(`=${ref('price', 1)}`);
    const res = evaluate(ast, DEFAULT_FORMULA_FUNCTIONS, makeCtx({}));
    expect(res).toEqual(FormulaValues.empty());
  });

  it('propagates #REF! when the ref has no resolved target', () => {
    const unresolved: FormulaAst = {
      kind: 'ref',
      ref: { field: 'price', row: 1, absField: false, absRow: false },
    };
    const res = evaluate(unresolved, DEFAULT_FORMULA_FUNCTIONS, makeCtx({}));
    expect(res).toEqual({ kind: 'error', error: '#REF!' });
  });
});

describe('evaluator — functions', () => {
  it('evaluates SUM over a range', () => {
    const cells = {
      'r_1|price': n(1),
      'r_2|price': n(2),
      'r_3|price': n(3),
    };
    expect(run(`=SUM(${ref('price', 1)}:${ref('price', 3)})`, cells)).toEqual(n(6));
  });

  it('evaluates AVERAGE ignoring empties', () => {
    const cells = {
      'r_1|price': n(2),
      'r_3|price': n(6),
    };
    expect(run(`=AVERAGE(${ref('price', 1)}:${ref('price', 3)})`, cells)).toEqual(n(4));
  });

  it('returns #DIV/0! for AVERAGE on empty range', () => {
    expect(run(`=AVERAGE(${ref('price', 1)}:${ref('price', 3)})`)).toEqual({
      kind: 'error',
      error: '#DIV/0!',
    });
  });

  it('evaluates IF', () => {
    expect(run('=IF(TRUE, "yes", "no")')).toEqual(s('yes'));
    expect(run('=IF(FALSE, "yes", "no")')).toEqual(s('no'));
    expect(run('=IF(1 > 2, "hi")')).toEqual(b(false));
  });

  it('propagates errors through arguments', () => {
    expect(run('=SUM(1, 1/0, 2)')).toEqual({ kind: 'error', error: '#DIV/0!' });
  });

  it('recovers with IFERROR', () => {
    expect(run('=IFERROR(1/0, "oops")')).toEqual(s('oops'));
    expect(run('=IFERROR(42, "oops")')).toEqual(n(42));
  });

  it('evaluates IFS with short-circuit', () => {
    expect(run('=IFS(FALSE, "a", TRUE, "b", TRUE, "c")')).toEqual(s('b'));
    expect(run('=IFS(FALSE, "a", FALSE, "b")')).toEqual({
      kind: 'error',
      error: '#N/A',
    });
  });

  it('returns #NAME? for unknown functions', () => {
    expect(run('=NOPE(1)')).toEqual({ kind: 'error', error: '#NAME?' });
  });

  it('rejects ranges passed to scalar-only functions', () => {
    const cells = { 'r_1|price': n(1), 'r_2|price': n(2) };
    expect(run(`=ROUND(${ref('price', 1)}:${ref('price', 2)}, 2)`, cells)).toEqual({
      kind: 'error',
      error: '#VALUE!',
    });
  });
});

describe('evaluator — text functions', () => {
  it('computes LEN / LOWER / UPPER / TRIM', () => {
    expect(run('=LEN("hello")')).toEqual(n(5));
    expect(run('=LOWER("AbC")')).toEqual(s('abc'));
    expect(run('=UPPER("AbC")')).toEqual(s('ABC'));
    expect(run('=TRIM("  a   b  ")')).toEqual(s('a b'));
  });

  it('slices with LEFT / RIGHT / MID', () => {
    expect(run('=LEFT("hello", 2)')).toEqual(s('he'));
    expect(run('=RIGHT("hello", 2)')).toEqual(s('lo'));
    expect(run('=MID("hello", 2, 3)')).toEqual(s('ell'));
    expect(run('=RIGHT("hello", 0)')).toEqual(s(''));
  });

  it('substitutes text occurrences', () => {
    expect(run('=SUBSTITUTE("aaa", "a", "b")')).toEqual(s('bbb'));
    expect(run('=SUBSTITUTE("a-b-c", "-", ".", 2)')).toEqual(s('a-b.c'));
    expect(run('=SUBSTITUTE("abc", "", "x")')).toEqual(s('abc'));
  });

  it('concatenates with CONCAT over a range', () => {
    const cells = {
      'r_1|price': s('foo'),
      'r_2|price': s('bar'),
    };
    expect(run(`=CONCAT(${ref('price', 1)}:${ref('price', 2)})`, cells)).toEqual(s('foobar'));
  });
});

describe('evaluator — coercions', () => {
  it('treats empty as zero in arithmetic', () => {
    const ast = parseAndResolve(`=${ref('price', 1)} + 5`);
    const res = evaluate(ast, DEFAULT_FORMULA_FUNCTIONS, makeCtx({}));
    expect(res).toEqual(n(5));
  });

  it('coerces numeric strings', () => {
    expect(run('="3" * 4')).toEqual(n(12));
    expect(run('=LEN(42)')).toEqual(n(2));
  });

  it('surfaces #VALUE! for non-numeric strings in arithmetic', () => {
    expect(run('="abc" + 1')).toEqual({ kind: 'error', error: '#VALUE!' });
  });
});

describe('evaluator — robustness', () => {
  it('does not throw when handed a valid AST', () => {
    // Callers convert FormulaParseError → #PARSE!; here we just make sure the
    // evaluator does not throw when handed a valid AST.
    const ast: NumberLiteralNode = { kind: 'number', value: 1 };
    expect(evaluate(ast, DEFAULT_FORMULA_FUNCTIONS, makeCtx({}))).toEqual(n(1));
  });
});
