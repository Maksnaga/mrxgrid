// @ts-nocheck — Port verbatim from Angular. Strict typing pending integration with useFormulaEngine (Phase 6b).
/**
 * Default registry of formula functions (Phase 1 scope).
 *
 * Implementations are intentionally compact and reuse the coercion helpers
 * in `models/formula.model.ts`. Each entry is pure, side-effect free and
 * returns a `FormulaValue` — errors are data, never exceptions.
 *
 * Naming: keys are uppercase; the parser uppercases every identifier before
 * dispatch so consumers can write `sum(a, b)` or `SUM(a,b)` interchangeably.
 */

import {
  FormulaValues,
  firstError,
  toBoolean,
  toNumber,
  toStringValue,
} from '../../models/formula.model';
import type {
  FormulaError,
  FormulaFunctionImpl,
  FormulaFunctionRegistry,
  FormulaValue,
} from '../../models/formula.model';

// ─── Helpers ────────────────────────────────────────────────────────────────

function requireNumbers(args: FormulaValue[]): number[] | FormulaError {
  const out: number[] = [];
  for (const a of args) {
    // Skip empties — SUM({1, empty, 2}) = 3, matches Excel.
    if (a.kind === 'empty') continue;
    const n = toNumber(a);
    if (typeof n === 'string') return n;
    out.push(n);
  }
  return out;
}

function numberResult(fn: () => number): FormulaValue {
  const v = fn();
  return Number.isFinite(v)
    ? { kind: 'number', value: v }
    : { kind: 'error', error: '#NUM!' };
}

// ─── Math / stats ───────────────────────────────────────────────────────────

const SUM: FormulaFunctionImpl = {
  arity: 'variadic',
  acceptsRange: true,
  docs: {
    signature: 'SUM(valeur1, [valeur2, ...])',
    summary: 'Additionne les nombres fournis ou contenus dans les plages.',
  },
  evaluate(args) {
    const nums = requireNumbers(args);
    if (typeof nums === 'string') return FormulaValues.error(nums);
    return numberResult(() => nums.reduce((acc, n) => acc + n, 0));
  },
};

const PRODUCT: FormulaFunctionImpl = {
  arity: 'variadic',
  acceptsRange: true,
  docs: {
    signature: 'PRODUCT(valeur1, [valeur2, ...])',
    summary: 'Multiplie les nombres fournis ou contenus dans les plages.',
  },
  evaluate(args) {
    const nums = requireNumbers(args);
    if (typeof nums === 'string') return FormulaValues.error(nums);
    if (nums.length === 0) return FormulaValues.number(0);
    return numberResult(() => nums.reduce((acc, n) => acc * n, 1));
  },
};

const AVERAGE: FormulaFunctionImpl = {
  arity: 'variadic',
  acceptsRange: true,
  docs: {
    signature: 'AVERAGE(valeur1, [valeur2, ...])',
    summary: 'Moyenne arithmétique des nombres fournis.',
  },
  evaluate(args) {
    const nums = requireNumbers(args);
    if (typeof nums === 'string') return FormulaValues.error(nums);
    if (nums.length === 0) return FormulaValues.error('#DIV/0!');
    return numberResult(() => nums.reduce((a, b) => a + b, 0) / nums.length);
  },
};

const MIN: FormulaFunctionImpl = {
  arity: 'variadic',
  acceptsRange: true,
  docs: {
    signature: 'MIN(valeur1, [valeur2, ...])',
    summary: 'Renvoie la plus petite valeur numérique.',
  },
  evaluate(args) {
    const nums = requireNumbers(args);
    if (typeof nums === 'string') return FormulaValues.error(nums);
    if (nums.length === 0) return FormulaValues.number(0);
    return numberResult(() => Math.min(...nums));
  },
};

const MAX: FormulaFunctionImpl = {
  arity: 'variadic',
  acceptsRange: true,
  docs: {
    signature: 'MAX(valeur1, [valeur2, ...])',
    summary: 'Renvoie la plus grande valeur numérique.',
  },
  evaluate(args) {
    const nums = requireNumbers(args);
    if (typeof nums === 'string') return FormulaValues.error(nums);
    if (nums.length === 0) return FormulaValues.number(0);
    return numberResult(() => Math.max(...nums));
  },
};

/** Counts numeric values only — ignores text, booleans and empties. */
const COUNT: FormulaFunctionImpl = {
  arity: 'variadic',
  acceptsRange: true,
  docs: {
    signature: 'COUNT(valeur1, [valeur2, ...])',
    summary: 'Compte les valeurs numériques (ignore le texte et les cases vides).',
  },
  evaluate(args) {
    let n = 0;
    for (const a of args) {
      if (a.kind === 'number') n++;
      else if (a.kind === 'string') {
        const parsed = Number(a.value);
        if (Number.isFinite(parsed)) n++;
      }
    }
    return FormulaValues.number(n);
  },
};

/** Counts every non-empty value. */
const COUNTA: FormulaFunctionImpl = {
  arity: 'variadic',
  acceptsRange: true,
  docs: {
    signature: 'COUNTA(valeur1, [valeur2, ...])',
    summary: 'Compte toutes les valeurs non vides.',
  },
  evaluate(args) {
    let n = 0;
    for (const a of args) if (a.kind !== 'empty') n++;
    return FormulaValues.number(n);
  },
};

const ROUND: FormulaFunctionImpl = {
  arity: [1, 2],
  docs: {
    signature: 'ROUND(nombre, [décimales])',
    summary: 'Arrondit un nombre au nombre de décimales indiqué (0 par défaut).',
  },
  evaluate([value, digits]) {
    const v = toNumber(value);
    if (typeof v === 'string') return FormulaValues.error(v);
    const d = digits ? toNumber(digits) : 0;
    if (typeof d === 'string') return FormulaValues.error(d);
    const factor = Math.pow(10, d);
    return numberResult(() => Math.round(v * factor) / factor);
  },
};

const ABS: FormulaFunctionImpl = {
  arity: 1,
  docs: {
    signature: 'ABS(nombre)',
    summary: 'Valeur absolue d’un nombre.',
  },
  evaluate([value]) {
    const v = toNumber(value);
    if (typeof v === 'string') return FormulaValues.error(v);
    return numberResult(() => Math.abs(v));
  },
};

const MOD: FormulaFunctionImpl = {
  arity: 2,
  docs: {
    signature: 'MOD(dividende, diviseur)',
    summary: 'Reste de la division euclidienne (signe du diviseur).',
  },
  evaluate([dividend, divisor]) {
    const a = toNumber(dividend);
    if (typeof a === 'string') return FormulaValues.error(a);
    const b = toNumber(divisor);
    if (typeof b === 'string') return FormulaValues.error(b);
    if (b === 0) return FormulaValues.error('#DIV/0!');
    // Excel's MOD preserves the sign of the divisor.
    return numberResult(() => ((a % b) + b) % b);
  },
};

const POWER: FormulaFunctionImpl = {
  arity: 2,
  docs: {
    signature: 'POWER(base, exposant)',
    summary: 'Élève la base à la puissance donnée.',
  },
  evaluate([base, exponent]) {
    const b = toNumber(base);
    if (typeof b === 'string') return FormulaValues.error(b);
    const e = toNumber(exponent);
    if (typeof e === 'string') return FormulaValues.error(e);
    return numberResult(() => Math.pow(b, e));
  },
};

// ─── Logical ────────────────────────────────────────────────────────────────

const IF: FormulaFunctionImpl = {
  arity: [2, 3],
  docs: {
    signature: 'IF(condition, si_vrai, [si_faux])',
    summary: 'Renvoie une valeur selon le résultat d’une condition booléenne.',
  },
  evaluate([cond, whenTrue, whenFalse]) {
    if (cond.kind === 'error') return cond;
    const b = toBoolean(cond);
    if (typeof b !== 'boolean') return FormulaValues.error(b);
    if (b) return whenTrue;
    return whenFalse ?? FormulaValues.boolean(false);
  },
};

const AND: FormulaFunctionImpl = {
  arity: 'variadic',
  acceptsRange: true,
  docs: {
    signature: 'AND(valeur1, [valeur2, ...])',
    summary: 'Renvoie VRAI si toutes les conditions sont vraies.',
  },
  evaluate(args) {
    if (args.length === 0) return FormulaValues.error('#VALUE!');
    for (const a of args) {
      if (a.kind === 'error') return a;
      const b = toBoolean(a);
      if (typeof b !== 'boolean') return FormulaValues.error(b);
      if (!b) return FormulaValues.boolean(false);
    }
    return FormulaValues.boolean(true);
  },
};

const OR: FormulaFunctionImpl = {
  arity: 'variadic',
  acceptsRange: true,
  docs: {
    signature: 'OR(valeur1, [valeur2, ...])',
    summary: 'Renvoie VRAI si au moins une condition est vraie.',
  },
  evaluate(args) {
    if (args.length === 0) return FormulaValues.error('#VALUE!');
    for (const a of args) {
      if (a.kind === 'error') return a;
      const b = toBoolean(a);
      if (typeof b !== 'boolean') return FormulaValues.error(b);
      if (b) return FormulaValues.boolean(true);
    }
    return FormulaValues.boolean(false);
  },
};

const NOT: FormulaFunctionImpl = {
  arity: 1,
  docs: {
    signature: 'NOT(valeur)',
    summary: 'Inverse un booléen.',
  },
  evaluate([a]) {
    if (a.kind === 'error') return a;
    const b = toBoolean(a);
    if (typeof b !== 'boolean') return FormulaValues.error(b);
    return FormulaValues.boolean(!b);
  },
};

/** Returns the fallback iff the tested value is an error. */
const IFERROR: FormulaFunctionImpl = {
  arity: 2,
  docs: {
    signature: 'IFERROR(valeur, valeur_si_erreur)',
    summary: 'Renvoie la valeur de secours si le premier argument est une erreur.',
  },
  evaluate([tested, fallback]) {
    return tested.kind === 'error' ? fallback : tested;
  },
};

/** `IFS(cond1, then1, cond2, then2, ...)` — returns the first truthy branch. */
const IFS: FormulaFunctionImpl = {
  arity: [2, 254],
  docs: {
    signature: 'IFS(cond1, valeur1, [cond2, valeur2, ...])',
    summary: 'Renvoie la valeur associée à la première condition vraie.',
  },
  evaluate(args) {
    if (args.length % 2 !== 0) return FormulaValues.error('#N/A');
    for (let i = 0; i < args.length; i += 2) {
      const cond = args[i];
      if (cond.kind === 'error') return cond;
      const b = toBoolean(cond);
      if (typeof b !== 'boolean') return FormulaValues.error(b);
      if (b) return args[i + 1];
    }
    return FormulaValues.error('#N/A');
  },
};

// ─── Text ───────────────────────────────────────────────────────────────────

const CONCAT: FormulaFunctionImpl = {
  arity: 'variadic',
  acceptsRange: true,
  docs: {
    signature: 'CONCAT(texte1, [texte2, ...])',
    summary: 'Concatène toutes les valeurs en une seule chaîne.',
  },
  evaluate(args) {
    const err = firstError(args);
    if (err) return FormulaValues.error(err);
    let out = '';
    for (const a of args) {
      const s = toStringValue(a);
      if (typeof s !== 'string') return FormulaValues.error(s);
      out += s;
    }
    return FormulaValues.string(out);
  },
};

const LEN: FormulaFunctionImpl = {
  arity: 1,
  docs: {
    signature: 'LEN(texte)',
    summary: 'Renvoie le nombre de caractères.',
  },
  evaluate([a]) {
    const s = toStringValue(a);
    if (typeof s !== 'string') return FormulaValues.error(s);
    return FormulaValues.number(s.length);
  },
};

const LOWER: FormulaFunctionImpl = {
  arity: 1,
  docs: {
    signature: 'LOWER(texte)',
    summary: 'Convertit la chaîne en minuscules.',
  },
  evaluate([a]) {
    const s = toStringValue(a);
    if (typeof s !== 'string') return FormulaValues.error(s);
    return FormulaValues.string(s.toLowerCase());
  },
};

const UPPER: FormulaFunctionImpl = {
  arity: 1,
  docs: {
    signature: 'UPPER(texte)',
    summary: 'Convertit la chaîne en majuscules.',
  },
  evaluate([a]) {
    const s = toStringValue(a);
    if (typeof s !== 'string') return FormulaValues.error(s);
    return FormulaValues.string(s.toUpperCase());
  },
};

const TRIM: FormulaFunctionImpl = {
  arity: 1,
  docs: {
    signature: 'TRIM(texte)',
    summary: 'Retire les espaces superflus (début, fin, doublons internes).',
  },
  evaluate([a]) {
    const s = toStringValue(a);
    if (typeof s !== 'string') return FormulaValues.error(s);
    return FormulaValues.string(s.trim().replace(/\s+/g, ' '));
  },
};

const LEFT: FormulaFunctionImpl = {
  arity: [1, 2],
  docs: {
    signature: 'LEFT(texte, [nombre])',
    summary: 'Renvoie les n premiers caractères (1 par défaut).',
  },
  evaluate([a, count]) {
    const s = toStringValue(a);
    if (typeof s !== 'string') return FormulaValues.error(s);
    const n = count ? toNumber(count) : 1;
    if (typeof n === 'string') return FormulaValues.error(n);
    if (n < 0) return FormulaValues.error('#VALUE!');
    return FormulaValues.string(s.slice(0, Math.floor(n)));
  },
};

const RIGHT: FormulaFunctionImpl = {
  arity: [1, 2],
  docs: {
    signature: 'RIGHT(texte, [nombre])',
    summary: 'Renvoie les n derniers caractères (1 par défaut).',
  },
  evaluate([a, count]) {
    const s = toStringValue(a);
    if (typeof s !== 'string') return FormulaValues.error(s);
    const n = count ? toNumber(count) : 1;
    if (typeof n === 'string') return FormulaValues.error(n);
    if (n < 0) return FormulaValues.error('#VALUE!');
    const take = Math.floor(n);
    return FormulaValues.string(take === 0 ? '' : s.slice(-take));
  },
};

const MID: FormulaFunctionImpl = {
  arity: 3,
  docs: {
    signature: 'MID(texte, début, longueur)',
    summary: 'Extrait un sous-texte à partir de la position indiquée (1-based).',
  },
  evaluate([a, startRaw, lengthRaw]) {
    const s = toStringValue(a);
    if (typeof s !== 'string') return FormulaValues.error(s);
    const start = toNumber(startRaw);
    if (typeof start === 'string') return FormulaValues.error(start);
    const length = toNumber(lengthRaw);
    if (typeof length === 'string') return FormulaValues.error(length);
    if (start < 1 || length < 0) return FormulaValues.error('#VALUE!');
    const zeroBased = Math.floor(start) - 1;
    return FormulaValues.string(s.slice(zeroBased, zeroBased + Math.floor(length)));
  },
};

const SUBSTITUTE: FormulaFunctionImpl = {
  arity: [3, 4],
  docs: {
    signature: 'SUBSTITUTE(texte, cherché, remplacement, [occurrence])',
    summary: 'Remplace toutes les occurrences (ou la n‑ième) d’un motif par un autre.',
  },
  evaluate([textRaw, findRaw, replaceRaw, occurrenceRaw]) {
    const text = toStringValue(textRaw);
    if (typeof text !== 'string') return FormulaValues.error(text);
    const find = toStringValue(findRaw);
    if (typeof find !== 'string') return FormulaValues.error(find);
    const replace = toStringValue(replaceRaw);
    if (typeof replace !== 'string') return FormulaValues.error(replace);
    if (!find) return FormulaValues.string(text);
    if (!occurrenceRaw) {
      return FormulaValues.string(text.split(find).join(replace));
    }
    const occurrence = toNumber(occurrenceRaw);
    if (typeof occurrence === 'string') return FormulaValues.error(occurrence);
    if (occurrence < 1) return FormulaValues.error('#VALUE!');
    let idx = -1;
    for (let k = 0; k < occurrence; k++) {
      idx = text.indexOf(find, idx + 1);
      if (idx === -1) return FormulaValues.string(text);
    }
    return FormulaValues.string(text.slice(0, idx) + replace + text.slice(idx + find.length));
  },
};

// ─── Export ─────────────────────────────────────────────────────────────────

/**
 * Default function registry. Consumers can spread this into their own
 * registry to extend it:
 *
 * ```
 * const registry = { ...DEFAULT_FORMULA_FUNCTIONS, TVA: myTvaFn };
 * ```
 */
export const DEFAULT_FORMULA_FUNCTIONS: FormulaFunctionRegistry = Object.freeze({
  // Math
  SUM,
  PRODUCT,
  AVERAGE,
  MIN,
  MAX,
  COUNT,
  COUNTA,
  ROUND,
  ABS,
  MOD,
  POWER,
  // Logical
  IF,
  AND,
  OR,
  NOT,
  IFERROR,
  IFS,
  // Text
  CONCAT,
  LEN,
  LOWER,
  UPPER,
  TRIM,
  LEFT,
  RIGHT,
  MID,
  SUBSTITUTE,
});