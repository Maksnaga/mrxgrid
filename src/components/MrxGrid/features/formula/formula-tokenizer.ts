// @ts-nocheck — Port verbatim from Angular. Strict typing pending integration with useFormulaEngine (Phase 6b).
/**
 * Tolerant tokenizer used by the live formula editor.
 *
 * Unlike the strict parser tokeniser in `formula-parser.ts` — which throws
 * on malformed input (appropriate at commit time) — this one is designed
 * to run on every keystroke. It never throws, and produces a best-effort
 * token stream even for partial or broken input (`=A`, `=SUM(`, `="hi`,
 * `=1 +`). Consumers rely on it for three things:
 *
 *   1. Syntax + ref highlighting in the editor overlay.
 *   2. Detecting the autocomplete trigger (caret at the end of a function
 *      ident).
 *   3. Finding the token under the caret for click-to-pick insertion.
 *
 * The editor surface is **A1 notation**: refs look like `A1`, `$A$1`,
 * `AA12`, and ranges use `:` (`A1:B5`). The tokenizer decodes the letter
 * part against a supplied `fieldOrder` list so each ref carries its
 * stable field name.
 */

import type { StructuredRef } from './formula-ast';
import { columnLettersToIndex } from './formula-ast';

export type FormulaEditorTokenKind =
  | 'ws'
  | 'eq'
  | 'ref'
  | 'number'
  | 'string'
  | 'bool'
  | 'fn'
  | 'ident'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'colon'
  | 'unknown';

export interface FormulaEditorToken {
  readonly kind: FormulaEditorTokenKind;
  readonly text: string;
  /** 0-based inclusive position in the source string. */
  readonly start: number;
  /** 0-based exclusive end position. */
  readonly end: number;
  /** Parsed structured ref — present only when `kind === 'ref'`. */
  readonly ref?: StructuredRef;
}

export interface EditorTokenizeOptions {
  readonly locale?: 'en' | 'fr';
  /**
   * Ordered list of visible column fields — used to map A1 letters to
   * field names. When absent, A1 refs are emitted with `field: ''` so the
   * highlight layer can still position them (pending resolution).
   */
  readonly fieldOrder?: readonly string[];
}

export function tokenizeFormulaEditor(
  source: string,
  options: EditorTokenizeOptions = {},
): FormulaEditorToken[] {
  const locale = options.locale ?? 'en';
  const fieldOrder = options.fieldOrder ?? [];
  const argSeparator = locale === 'fr' ? ';' : ',';
  const out: FormulaEditorToken[] = [];
  const len = source.length;
  let i = 0;

  if (source[0] === '=') {
    out.push({ kind: 'eq', text: '=', start: 0, end: 1 });
    i = 1;
  }

  while (i < len) {
    const ch = source[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      const start = i;
      while (
        i < len &&
        (source[i] === ' ' || source[i] === '\t' || source[i] === '\n' || source[i] === '\r')
      ) {
        i++;
      }
      out.push({ kind: 'ws', text: source.slice(start, i), start, end: i });
      continue;
    }

    if (ch === '(') {
      out.push({ kind: 'lparen', text: '(', start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === ')') {
      out.push({ kind: 'rparen', text: ')', start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === ':') {
      out.push({ kind: 'colon', text: ':', start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === argSeparator) {
      out.push({ kind: 'comma', text: argSeparator, start: i, end: i + 1 });
      i++;
      continue;
    }

    const two = source.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>') {
      out.push({ kind: 'op', text: two, start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if ('+-*/^&=<>'.includes(ch)) {
      out.push({ kind: 'op', text: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    if (ch === '"') {
      const start = i;
      i++;
      while (i < len) {
        if (source[i] === '"') {
          if (source[i + 1] === '"') {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      out.push({ kind: 'string', text: source.slice(start, i), start, end: i });
      continue;
    }

    // Same-row ref surface: `[field]`. Emitted as a ref token so the
    // coloured overlay picks it up and the click-to-pick machinery can
    // replace it in place. An unclosed `[…` is still emitted (field is the
    // tail) so highlights update live while the user types.
    if (ch === '[') {
      const start = i;
      i++;
      while (i < len && source[i] !== ']') i++;
      const hasClose = i < len;
      if (hasClose) i++;
      const text = source.slice(start, i);
      const inner = hasClose ? text.slice(1, -1) : text.slice(1);
      const field = fieldOrder.includes(inner) ? inner : '';
      out.push({
        kind: 'ref',
        text,
        start,
        end: i,
        ref: { field, row: 0, absField: false, absRow: false, sameRow: true },
      });
      continue;
    }

    // A1 cell ref: `$?LETTERS$?DIGITS`. Detected before identifier scan so
    // `A1` is a ref, not an ident `A` + number `1`.
    const refMatch = tryScanA1(source, i, fieldOrder);
    if (refMatch) {
      out.push({
        kind: 'ref',
        text: source.slice(i, refMatch.end),
        start: i,
        end: refMatch.end,
        ref: refMatch.ref,
      });
      i = refMatch.end;
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
      out.push({ kind: 'number', text: source.slice(start, i), start, end: i });
      continue;
    }

    if (isAlpha(ch) || ch === '_') {
      const start = i;
      while (
        i < len &&
        (isAlpha(source[i]) || isDigit(source[i]) || source[i] === '_' || source[i] === '.')
      ) {
        i++;
      }
      const text = source.slice(start, i);
      const upper = text.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') {
        out.push({ kind: 'bool', text, start, end: i });
        continue;
      }
      let k = i;
      while (k < len && (source[k] === ' ' || source[k] === '\t')) k++;
      const isFn = source[k] === '(';
      out.push({ kind: isFn ? 'fn' : 'ident', text, start, end: i });
      continue;
    }

    out.push({ kind: 'unknown', text: ch, start: i, end: i + 1 });
    i++;
  }

  return out;
}

interface A1ScanResult {
  readonly end: number;
  readonly ref: StructuredRef;
}

/**
 * Try to scan an A1 cell reference starting at `source[pos]`. Returns null
 * when the position does not start a ref. The scan is strict: letters MUST
 * be followed by at least one digit (possibly after a `$`) — a bare `A`
 * is an ident, not a ref.
 */
function tryScanA1(
  source: string,
  pos: number,
  fieldOrder: readonly string[],
): A1ScanResult | null {
  const len = source.length;
  let i = pos;
  const absField = source[i] === '$';
  if (absField) i++;

  const lettersStart = i;
  while (i < len && isAlpha(source[i])) i++;
  if (i === lettersStart) return null;
  const letters = source.slice(lettersStart, i);

  const absRow = source[i] === '$';
  const digitsCandidateStart = absRow ? i + 1 : i;
  let j = digitsCandidateStart;
  while (j < len && isDigit(source[j])) j++;
  if (j === digitsCandidateStart) return null;

  // `A1(` → function-call-like identifier (e.g. `ATAN2(`). Skip so the
  // scanner falls back to the ident branch and emits `fn`.
  if (source[j] === '(') return null;

  const digits = source.slice(digitsCandidateStart, j);
  const row = Number(digits);
  if (!Number.isFinite(row) || row < 1) return null;
  const colIdx = columnLettersToIndex(letters);
  const field = fieldOrder[colIdx] ?? '';

  return {
    end: j,
    ref: { field, row, absField, absRow },
  };
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}
function isAlpha(ch: string): boolean {
  return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z');
}

// ─── Public helpers ─────────────────────────────────────────────────────────

/**
 * Token whose `[start, end]` range contains `caret`. When the caret sits
 * exactly between two tokens, the one ending at the caret wins — this is
 * what the autocomplete needs to match an identifier the user just typed.
 */
export function tokenAtCaret(
  tokens: readonly FormulaEditorToken[],
  caret: number,
): FormulaEditorToken | null {
  for (let idx = tokens.length - 1; idx >= 0; idx--) {
    const t = tokens[idx];
    if (caret >= t.start && caret <= t.end) return t;
  }
  return null;
}

/**
 * Detect the function-name autocomplete trigger: the caret sits at the
 * end of an ident/fn/bool token whose text is non-empty.
 */
export function autocompletePrefixAtCaret(
  tokens: readonly FormulaEditorToken[],
  caret: number,
): { token: FormulaEditorToken; prefix: string } | null {
  const tok = tokenAtCaret(tokens, caret);
  if (!tok) return null;
  if (tok.kind !== 'fn' && tok.kind !== 'ident' && tok.kind !== 'bool') return null;
  if (caret !== tok.end) return null;
  return { token: tok, prefix: tok.text.slice(0, caret - tok.start) };
}

export interface EditorRefToken {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  /** `[ref]` for a simple ref, `[start, end]` for a range. */
  readonly refs: readonly StructuredRef[];
  readonly isRange: boolean;
}

/**
 * Group adjacent `ref colon ref` patterns into range tokens while keeping
 * simple refs as single-cell entries. Whitespace between the components
 * is not tolerated (Excel rule).
 */
export function extractEditorRefTokens(tokens: readonly FormulaEditorToken[]): EditorRefToken[] {
  const out: EditorRefToken[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== 'ref' || !t.ref) continue;
    const next = tokens[i + 1];
    const after = tokens[i + 2];
    if (next?.kind === 'colon' && after?.kind === 'ref' && after.ref) {
      out.push({
        start: t.start,
        end: after.end,
        text: t.text + next.text + after.text,
        refs: [t.ref, after.ref],
        isRange: true,
      });
      i += 2;
      continue;
    }
    out.push({
      start: t.start,
      end: t.end,
      text: t.text,
      refs: [t.ref],
      isRange: false,
    });
  }
  return out;
}