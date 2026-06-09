import {
  autocompletePrefixAtCaret,
  extractEditorRefTokens,
  tokenAtCaret,
  tokenizeFormulaEditor,
} from './formula-tokenizer';

const FIELDS = ['price', 'qty', 'total'];

describe('tokenizeFormulaEditor — basics', () => {
  it('emits the leading `=` as its own token', () => {
    const toks = tokenizeFormulaEditor('=');
    expect(toks).toHaveSize(1);
    expect(toks[0]).toEqual({ kind: 'eq', text: '=', start: 0, end: 1 });
  });

  it('tokenises a simple A1 formula end-to-end', () => {
    const toks = tokenizeFormulaEditor('=SUM(A1, 3.14)', { fieldOrder: FIELDS });
    expect(toks.map((t) => t.kind)).toEqual([
      'eq',
      'fn',
      'lparen',
      'ref',
      'comma',
      'ws',
      'number',
      'rparen',
    ]);
  });

  it('parses a relative A1 ref against the field order', () => {
    const toks = tokenizeFormulaEditor('=A1', { fieldOrder: FIELDS });
    expect(toks[1].kind).toBe('ref');
    expect(toks[1].text).toBe('A1');
    expect(toks[1].ref).toEqual({ field: 'price', row: 1, absField: false, absRow: false });
  });

  it('parses an absolute A1 ref', () => {
    const toks = tokenizeFormulaEditor('=$B$2', { fieldOrder: FIELDS });
    expect(toks[1].kind).toBe('ref');
    expect(toks[1].ref).toEqual({ field: 'qty', row: 2, absField: true, absRow: true });
  });

  it('parses a mixed $A1 / A$1 lock', () => {
    expect(tokenizeFormulaEditor('=$A1', { fieldOrder: FIELDS })[1].ref).toEqual({
      field: 'price',
      row: 1,
      absField: true,
      absRow: false,
    });
    expect(tokenizeFormulaEditor('=A$1', { fieldOrder: FIELDS })[1].ref).toEqual({
      field: 'price',
      row: 1,
      absField: false,
      absRow: true,
    });
  });

  it('emits a ref with an empty field when the letter is outside the field order', () => {
    const toks = tokenizeFormulaEditor('=Z1', { fieldOrder: FIELDS });
    expect(toks[1].kind).toBe('ref');
    expect(toks[1].ref?.field).toBe('');
  });

  it('distinguishes fn (followed by `(`) from plain ident', () => {
    const fn = tokenizeFormulaEditor('=SUM(');
    expect(fn[1].kind).toBe('fn');
    const ident = tokenizeFormulaEditor('=SUM');
    expect(ident[1].kind).toBe('ident');
  });

  it('does not read `ATAN2(` as an A1 ref', () => {
    const toks = tokenizeFormulaEditor('=ATAN2(1, 2)', { fieldOrder: FIELDS });
    expect(toks[1].kind).toBe('fn');
    expect(toks[1].text).toBe('ATAN2');
  });

  it('emits booleans case-insensitively', () => {
    const toks = tokenizeFormulaEditor('=true');
    expect(toks[1].kind).toBe('bool');
  });

  it('emits multi-char operators as one token', () => {
    const toks = tokenizeFormulaEditor('=A1<=B1', { fieldOrder: FIELDS });
    expect(toks.map((t) => t.text)).toEqual(['=', 'A1', '<=', 'B1']);
  });

  it('handles the fr locale separator `;`', () => {
    const toks = tokenizeFormulaEditor('=SUM(A1;B1)', { locale: 'fr', fieldOrder: FIELDS });
    expect(toks.find((t) => t.kind === 'comma')?.text).toBe(';');
  });
});

describe('tokenizeFormulaEditor — partial / malformed input', () => {
  it('does not throw on an unterminated string', () => {
    const toks = tokenizeFormulaEditor('="hello');
    expect(toks[1].kind).toBe('string');
    expect(toks[1].text).toBe('"hello');
  });

  it('preserves a trailing dangling operator', () => {
    const toks = tokenizeFormulaEditor('=1+');
    expect(toks.map((t) => t.kind)).toEqual(['eq', 'number', 'op']);
  });

  it('emits an ident for a bare letter sequence', () => {
    const toks = tokenizeFormulaEditor('=AB');
    expect(toks[1].kind).toBe('ident');
    expect(toks[1].text).toBe('AB');
  });

  it('retains stray unknown characters rather than dropping them', () => {
    const toks = tokenizeFormulaEditor('=?');
    expect(toks[1].kind).toBe('unknown');
    expect(toks[1].text).toBe('?');
  });
});

describe('tokenAtCaret', () => {
  it('returns the token ending at the caret when caret sits between two tokens', () => {
    const src = '=SUM';
    const toks = tokenizeFormulaEditor(src);
    const tok = tokenAtCaret(toks, src.length);
    expect(tok?.kind).toBe('ident');
    expect(tok?.text).toBe('SUM');
  });

  it('returns null when caret is out of bounds', () => {
    expect(tokenAtCaret([], 0)).toBeNull();
  });
});

describe('autocompletePrefixAtCaret', () => {
  it('fires at the end of an identifier', () => {
    const src = '=P';
    const toks = tokenizeFormulaEditor(src);
    const hit = autocompletePrefixAtCaret(toks, src.length);
    expect(hit?.prefix).toBe('P');
  });

  it('does not fire inside a string literal', () => {
    const src = '="P';
    const toks = tokenizeFormulaEditor(src);
    expect(autocompletePrefixAtCaret(toks, src.length)).toBeNull();
  });

  it('does not fire on an operator', () => {
    const src = '=1+';
    const toks = tokenizeFormulaEditor(src);
    expect(autocompletePrefixAtCaret(toks, src.length)).toBeNull();
  });
});

describe('extractEditorRefTokens', () => {
  it('pairs adjacent ref : ref into a range', () => {
    const toks = tokenizeFormulaEditor('=A1:B2', { fieldOrder: FIELDS });
    const refs = extractEditorRefTokens(toks);
    expect(refs).toHaveSize(1);
    expect(refs[0].isRange).toBeTrue();
    expect(refs[0].text).toBe('A1:B2');
    expect(refs[0].refs).toHaveSize(2);
  });

  it('emits simple refs for a mixed formula', () => {
    const toks = tokenizeFormulaEditor('=A1+B2', { fieldOrder: FIELDS });
    const refs = extractEditorRefTokens(toks);
    expect(refs.map((r) => r.text)).toEqual(['A1', 'B2']);
    expect(refs.every((r) => !r.isRange)).toBeTrue();
  });

  it('ignores whitespace-separated ref : ref (Excel rule)', () => {
    const toks = tokenizeFormulaEditor('=A1 : B2', { fieldOrder: FIELDS });
    const refs = extractEditorRefTokens(toks);
    expect(refs.every((r) => !r.isRange)).toBeTrue();
    expect(refs).toHaveSize(2);
  });
});
