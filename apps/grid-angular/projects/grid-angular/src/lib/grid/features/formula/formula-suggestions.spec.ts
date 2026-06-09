import type {
  FormulaFunctionImpl,
  FormulaFunctionRegistry,
  FormulaValue,
} from '../../models/formula.model';
import { tokenizeFormulaEditor } from './formula-tokenizer';
import {
  computeFormulaSuggestions,
  suggestionInsertionText,
} from './formula-suggestions';

function stubFn(signature: string, summary: string): FormulaFunctionImpl {
  return {
    arity: 'variadic',
    docs: { signature, summary },
    evaluate: (): FormulaValue => ({ kind: 'empty' }),
  };
}

const REGISTRY: FormulaFunctionRegistry = Object.freeze({
  SUM: stubFn('SUM(n1, [n2, ...])', 'Adds numbers.'),
  SUBSTITUTE: stubFn('SUBSTITUTE(t, f, r)', 'Replaces matches.'),
  PRODUCT: stubFn('PRODUCT(n1, [n2, ...])', 'Multiplies numbers.'),
  POWER: stubFn('POWER(b, e)', 'Raises to power.'),
  IF: stubFn('IF(c, a, b)', 'Conditional.'),
  CUSTOM: {
    arity: 1,
    evaluate: (): FormulaValue => ({ kind: 'empty' }),
  } as FormulaFunctionImpl,
});

function suggestAt(source: string, caret: number): ReturnType<typeof computeFormulaSuggestions> {
  const tokens = tokenizeFormulaEditor(source);
  return computeFormulaSuggestions(tokens, caret, REGISTRY);
}

describe('computeFormulaSuggestions — function names', () => {
  it('returns nothing when the caret is not on an ident/fn token', () => {
    expect(suggestAt('=', 1)).toEqual([]);
    expect(suggestAt('=1+', 3)).toEqual([]);
  });

  it('returns nothing when the prefix is empty', () => {
    const src = '=';
    expect(suggestAt(src, src.length)).toEqual([]);
  });

  it('suggests by prefix match, case-insensitive', () => {
    const names = suggestAt('=po', 3).map((s) => s.name);
    expect(names).toEqual(['POWER']);
  });

  it('ranks prefix matches above substring matches', () => {
    const names = suggestAt('=su', 3).map((s) => s.name);
    expect(names[0]).toBe('SUBSTITUTE');
    expect(names[1]).toBe('SUM');
  });

  it('preserves the replace range so the editor can insert cleanly', () => {
    const result = suggestAt('=sum', 4);
    expect(result.length).toBeGreaterThan(0);
    const top = result[0];
    expect(top.kind).toBe('function');
    expect(top.replaceStart).toBe(1);
    expect(top.replaceEnd).toBe(4);
    expect(top.prefix).toBe('sum');
  });

  it('falls back to empty signature/summary when docs are missing', () => {
    const [entry] = suggestAt('=cust', 5);
    expect(entry.name).toBe('CUSTOM');
    expect(entry.signature).toBe('');
    expect(entry.summary).toBe('');
  });

  it('honours the limit option', () => {
    const all = suggestAt('=s', 2);
    expect(all.length).toBeGreaterThanOrEqual(2);
    const tokens = tokenizeFormulaEditor('=s');
    const limited = computeFormulaSuggestions(tokens, 2, REGISTRY, { limit: 1 });
    expect(limited.length).toBe(1);
  });

  it('returns nothing when the caret is inside — not at the end of — a token', () => {
    const src = '=sum';
    const tokens = tokenizeFormulaEditor(src);
    expect(computeFormulaSuggestions(tokens, 2, REGISTRY)).toEqual([]);
  });
});

describe('suggestionInsertionText', () => {
  it('always opens a paren for function suggestions', () => {
    expect(
      suggestionInsertionText({
        kind: 'function',
        name: 'SUM',
        signature: '',
        summary: '',
        replaceStart: 0,
        replaceEnd: 0,
        prefix: '',
      }),
    ).toBe('SUM(');
  });
});
