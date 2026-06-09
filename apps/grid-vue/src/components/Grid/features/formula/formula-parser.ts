// @ts-nocheck — Port verbatim from Angular. Strict typing pending integration with useFormulaEngine (Phase 6b).
/**
 * Formula parser — turns a raw source string (with or without the leading
 * `=`) into a `FormulaAst`. Implementation is a hand-written tokeniser
 * feeding a recursive-descent parser with explicit precedence climbing:
 * no dependency on `Function` or `eval`, and no third-party runtime.
 *
 * The parser operates on the **storage form** of formulas:
 *
 *   =REF(COLUMN("price"),ROW(8))*REF(COLUMN("qty"),ROW(8))
 *
 * A1 notation (`=A1*B1`) is a purely editor-side surface — conversion to /
 * from storage is handled by `a1ToLongForm` / `longFormToA1` in the
 * ref-mapper. Consumers of the parser therefore never see A1 tokens here.
 *
 * Absolute markers are encoded as an optional third argument to `REF`:
 *
 *   REF(COLUMN("price"),ROW(8))        — relative col, relative row ($A1 → A1)
 *   REF(COLUMN("price"),ROW(8),"$C")   — absolute col, relative row ($A1)
 *   REF(COLUMN("price"),ROW(8),"$R")   — relative col, absolute row (A$1)
 *   REF(COLUMN("price"),ROW(8),"$CR")  — absolute both ($A$1)
 *   REF(COLUMN("price"))               — same-row ref ([price] surface), no
 *                                         ROW arg. Row resolves to the host
 *                                         cell's row at evaluation time.
 *
 * Ranges use the same shape for each endpoint, joined with `:`.
 *
 * Grammar (abbreviated):
 *
 *   expression   := comparison
 *   comparison   := concat (('=' | '<>' | '<' | '<=' | '>' | '>=') concat)*
 *   concat       := additive ('&' additive)*
 *   additive     := multiplicative (('+' | '-') multiplicative)*
 *   multiplicative := power (('*' | '/') power)*
 *   power        := unary ('^' unary)*
 *   unary        := ('+' | '-') unary | primary
 *   primary      := NUMBER | STRING | BOOL | ref | call | '(' expression ')'
 *   ref          := REF_PRIMITIVE (':' REF_PRIMITIVE)?
 *   REF_PRIMITIVE := 'REF' '(' 'COLUMN' '(' STRING ')' ',' 'ROW' '(' NUMBER ')' (',' STRING)? ')'
 *   call         := IDENT '(' arglist? ')'
 *   arglist      := expression (SEP expression)*
 */

import type {
  BinaryOp,
  FormulaAst,
  StructuredRef,
  UnaryOp,
} from './formula-ast';

export type ParserLocale = 'en' | 'fr';

export interface ParseOptions {
  readonly locale?: ParserLocale;
  /** Maximum parse depth, guarding against pathological nesting. */
  readonly maxDepth?: number;
}

export class FormulaParseError extends Error {
  constructor(
    message: string,
    /** 0-based column in the source string. */
    readonly position: number,
  ) {
    super(message);
    this.name = 'FormulaParseError';
  }
}

// ─── Token types ────────────────────────────────────────────────────────────

type TokenType =
  | 'number'
  | 'string'
  | 'bool'
  | 'ident'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'colon'
  | 'op'
  | 'eof';

interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly position: number;
}

// ─── Public entry point ─────────────────────────────────────────────────────

/**
 * Parse a formula source string into an AST. Accepts either form with or
 * without a leading `=`. Throws `FormulaParseError` on malformed input —
 * callers should translate that into a `#PARSE!` error value.
 */
export function parseFormula(source: string, options: ParseOptions = {}): FormulaAst {
  const locale = options.locale ?? 'en';
  const maxDepth = options.maxDepth ?? 256;
  const body = source.startsWith('=') ? source.slice(1) : source;
  const tokens = tokenize(body, locale);
  const parser = new RecursiveDescent(tokens, maxDepth);
  const ast = parser.parseExpression();
  parser.expect('eof');
  return ast;
}

// ─── Tokenizer ──────────────────────────────────────────────────────────────

function tokenize(source: string, locale: ParserLocale): Token[] {
  const tokens: Token[] = [];
  const argSeparator = locale === 'fr' ? ';' : ',';
  let i = 0;
  const len = source.length;

  while (i < len) {
    const ch = source[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(', position: i });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')', position: i });
      i++;
      continue;
    }
    if (ch === argSeparator) {
      tokens.push({ type: 'comma', value: argSeparator, position: i });
      i++;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'colon', value: ':', position: i });
      i++;
      continue;
    }

    const twoChar = source.slice(i, i + 2);
    if (twoChar === '<=' || twoChar === '>=' || twoChar === '<>') {
      tokens.push({ type: 'op', value: twoChar, position: i });
      i += 2;
      continue;
    }
    if ('+-*/^&=<>'.includes(ch)) {
      tokens.push({ type: 'op', value: ch, position: i });
      i++;
      continue;
    }

    if (ch === '"') {
      const parsed = scanQuotedString(source, i);
      tokens.push({ type: 'string', value: parsed.value, position: i });
      i = parsed.end;
      continue;
    }

    if (isDigit(ch) || (ch === '.' && isDigit(source[i + 1] ?? ''))) {
      const start = i;
      let seenDot = ch === '.';
      let seenExp = false;
      i++;
      while (i < len) {
        const c = source[i];
        if (isDigit(c)) {
          i++;
          continue;
        }
        if (c === '.' && !seenDot && !seenExp) {
          seenDot = true;
          i++;
          continue;
        }
        if ((c === 'e' || c === 'E') && !seenExp) {
          seenExp = true;
          i++;
          if (source[i] === '+' || source[i] === '-') i++;
          continue;
        }
        break;
      }
      tokens.push({ type: 'number', value: source.slice(start, i), position: start });
      continue;
    }

    if (isAlpha(ch) || ch === '_') {
      const start = i;
      while (i < len && (isAlpha(source[i]) || isDigit(source[i]) || source[i] === '_' || source[i] === '.')) {
        i++;
      }
      const value = source.slice(start, i);
      const upper = value.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'bool', value: upper, position: start });
      } else {
        tokens.push({ type: 'ident', value, position: start });
      }
      continue;
    }

    throw new FormulaParseError(`Unexpected character "${ch}"`, i);
  }

  tokens.push({ type: 'eof', value: '', position: len });
  return tokens;
}

/** Consume a `"…"` literal, treating `""` as an escaped quote. */
function scanQuotedString(source: string, start: number): { value: string; end: number } {
  let i = start + 1;
  let value = '';
  const len = source.length;
  while (i < len) {
    if (source[i] === '"') {
      if (source[i + 1] === '"') {
        value += '"';
        i += 2;
        continue;
      }
      return { value, end: i + 1 };
    }
    value += source[i];
    i++;
  }
  throw new FormulaParseError('Unterminated string literal', start);
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isAlpha(ch: string): boolean {
  return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z');
}

// ─── Parser ─────────────────────────────────────────────────────────────────

class RecursiveDescent {
  private cursor = 0;
  private depth = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly maxDepth: number,
  ) {}

  parseExpression(): FormulaAst {
    return this.guarded(() => this.parseComparison());
  }

  expect(type: TokenType): Token {
    const tok = this.peek();
    if (tok.type !== type) {
      throw new FormulaParseError(`Expected ${type}, got ${tok.type} "${tok.value}"`, tok.position);
    }
    this.cursor++;
    return tok;
  }

  private parseComparison(): FormulaAst {
    let left = this.parseConcat();
    while (true) {
      const op = this.peekOp();
      if (op !== '=' && op !== '<>' && op !== '<' && op !== '<=' && op !== '>' && op !== '>=') break;
      this.cursor++;
      const right = this.parseConcat();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  private parseConcat(): FormulaAst {
    let left = this.parseAdditive();
    while (this.peekOp() === '&') {
      this.cursor++;
      const right = this.parseAdditive();
      left = { kind: 'binary', op: '&', left, right };
    }
    return left;
  }

  private parseAdditive(): FormulaAst {
    let left = this.parseMultiplicative();
    while (true) {
      const op = this.peekOp();
      if (op !== '+' && op !== '-') break;
      this.cursor++;
      const right = this.parseMultiplicative();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): FormulaAst {
    let left = this.parsePower();
    while (true) {
      const op = this.peekOp();
      if (op !== '*' && op !== '/') break;
      this.cursor++;
      const right = this.parsePower();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  /** `^` is right-associative in Excel. */
  private parsePower(): FormulaAst {
    const left = this.parseUnary();
    if (this.peekOp() === '^') {
      this.cursor++;
      const right = this.parsePower();
      return { kind: 'binary', op: '^', left, right };
    }
    return left;
  }

  private parseUnary(): FormulaAst {
    const op = this.peekOp();
    if (op === '+' || op === '-') {
      this.cursor++;
      return { kind: 'unary', op: op as UnaryOp, operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): FormulaAst {
    const tok = this.peek();
    switch (tok.type) {
      case 'number':
        this.cursor++;
        return { kind: 'number', value: Number(tok.value) };
      case 'string':
        this.cursor++;
        return { kind: 'string', value: tok.value };
      case 'bool':
        this.cursor++;
        return { kind: 'boolean', value: tok.value === 'TRUE' };
      case 'ident':
        return this.parseIdentExpression();
      case 'lparen': {
        this.cursor++;
        const inner = this.parseExpression();
        this.expect('rparen');
        return inner;
      }
      default:
        throw new FormulaParseError(`Unexpected token "${tok.value}"`, tok.position);
    }
  }

  /**
   * An ident followed by `(` is either the `REF(COLUMN(...),ROW(...))`
   * ref primitive (possibly chained as a range), or a regular function call.
   */
  private parseIdentExpression(): FormulaAst {
    const ident = this.expect('ident');
    const upper = ident.value.toUpperCase();
    if (upper === 'REF' && this.peek().type === 'lparen') {
      const ref = this.parseRefPrimitive(ident.position);
      if (this.peek().type === 'colon') {
        this.cursor++;
        const endIdent = this.expect('ident');
        if (endIdent.value.toUpperCase() !== 'REF' || this.peek().type !== 'lparen') {
          throw new FormulaParseError('Expected `REF(` after `:` in range', endIdent.position);
        }
        const endRef = this.parseRefPrimitive(endIdent.position);
        return { kind: 'range', start: ref, end: endRef };
      }
      return { kind: 'ref', ref };
    }
    // Regular function call.
    this.expect('lparen');
    const args: FormulaAst[] = [];
    if (this.peek().type !== 'rparen') {
      args.push(this.parseExpression());
      while (this.peek().type === 'comma') {
        this.cursor++;
        args.push(this.parseExpression());
      }
    }
    this.expect('rparen');
    return { kind: 'call', name: upper, args };
  }

  /**
   * Parse `REF(COLUMN("field")[,ROW(N) [,"$C"|"$R"|"$CR"]])` starting from
   * just after the `REF` ident. Returns the `StructuredRef`. A missing
   * `ROW(...)` arg marks the ref as same-row (resolves against the host
   * cell's row at evaluation time).
   */
  private parseRefPrimitive(position: number): StructuredRef {
    this.expect('lparen');

    const colIdent = this.expect('ident');
    if (colIdent.value.toUpperCase() !== 'COLUMN') {
      throw new FormulaParseError('Expected `COLUMN(` inside REF', colIdent.position);
    }
    this.expect('lparen');
    const fieldTok = this.expect('string');
    this.expect('rparen');

    // Same-row form: `REF(COLUMN("field"))` — no ROW arg.
    if (this.peek().type === 'rparen') {
      this.cursor++;
      void position;
      return {
        field: fieldTok.value,
        row: 0,
        absField: false,
        absRow: false,
        sameRow: true,
      };
    }

    this.expect('comma');

    const rowIdent = this.expect('ident');
    if (rowIdent.value.toUpperCase() !== 'ROW') {
      throw new FormulaParseError('Expected `ROW(` inside REF', rowIdent.position);
    }
    this.expect('lparen');
    const rowTok = this.expect('number');
    this.expect('rparen');

    const row = Number(rowTok.value);
    if (!Number.isFinite(row) || row < 1 || !Number.isInteger(row)) {
      throw new FormulaParseError('ROW must be a positive integer', rowTok.position);
    }

    let absField = false;
    let absRow = false;
    if (this.peek().type === 'comma') {
      this.cursor++;
      const lockTok = this.expect('string');
      const lock = lockTok.value;
      if (lock !== '$C' && lock !== '$R' && lock !== '$CR' && lock !== '') {
        throw new FormulaParseError(
          `Invalid REF lock marker: "${lock}" (expected "$C", "$R", or "$CR")`,
          lockTok.position,
        );
      }
      absField = lock === '$C' || lock === '$CR';
      absRow = lock === '$R' || lock === '$CR';
    }

    this.expect('rparen');

    void position;
    return { field: fieldTok.value, row, absField, absRow };
  }

  private peek(): Token {
    return this.tokens[this.cursor];
  }

  private peekOp(): BinaryOp | null {
    const tok = this.tokens[this.cursor];
    if (tok?.type !== 'op') return null;
    return tok.value as BinaryOp;
  }

  private guarded<T>(fn: () => T): T {
    if (++this.depth > this.maxDepth) {
      throw new FormulaParseError(`Formula exceeds max depth (${this.maxDepth})`, this.peek().position);
    }
    try {
      return fn();
    } finally {
      this.depth--;
    }
  }
}