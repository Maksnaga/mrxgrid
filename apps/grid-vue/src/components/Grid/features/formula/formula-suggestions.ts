// @ts-nocheck — Port verbatim from Angular. Strict typing pending integration with useFormulaEngine (Phase 6b).
/**
 * Pure function that turns `(tokens, caret, registry)` into a ranked list
 * of function-name suggestions. Called on every keystroke by the formula
 * editor to refresh its autocomplete panel.
 *
 * Cell references are A1-form and therefore short enough that an
 * autocomplete panel is not helpful — users pick them by clicking the
 * target cell in the grid. Only function names are suggested here.
 *
 * Matching is case-insensitive prefix first, then "contains" as a
 * fallback. Prefix matches rank strictly higher than substring matches
 * so `SU` doesn't promote `SUBSTITUTE` over `SUM`. Results are
 * alphabetical within a rank bucket.
 */

import type { FormulaFunctionRegistry } from '../../models/formula.model';
import type { FormulaEditorToken } from './formula-tokenizer';
import { autocompletePrefixAtCaret } from './formula-tokenizer';

export type FormulaSuggestionKind = 'function';

export interface FormulaSuggestion {
  readonly kind: FormulaSuggestionKind;
  /** Uppercase function name. */
  readonly name: string;
  /** `SUM(number1, [number2, ...])` — empty string when no docs are set. */
  readonly signature: string;
  /** One-line human summary — empty string when no docs are set. */
  readonly summary: string;
  /** 0-based character offset where the replacement should start. */
  readonly replaceStart: number;
  /** 0-based character offset where the replacement should end. */
  readonly replaceEnd: number;
  /** What the panel typed so far, preserved for visual match highlighting. */
  readonly prefix: string;
}

export interface ComputeSuggestionsOptions {
  /** Maximum number of entries to return. Defaults to 8. */
  readonly limit?: number;
}

export function computeFormulaSuggestions(
  tokens: readonly FormulaEditorToken[],
  caret: number,
  registry: FormulaFunctionRegistry,
  options: ComputeSuggestionsOptions = {},
): FormulaSuggestion[] {
  const limit = options.limit ?? 8;

  const match = autocompletePrefixAtCaret(tokens, caret);
  if (!match || match.prefix.length === 0) return [];

  const prefixUpper = match.prefix.toUpperCase();
  const names = Object.keys(registry);

  const starts: string[] = [];
  const contains: string[] = [];
  for (const name of names) {
    if (name.startsWith(prefixUpper)) {
      starts.push(name);
    } else if (name.includes(prefixUpper)) {
      contains.push(name);
    }
  }
  starts.sort();
  contains.sort();

  const ranked = [...starts, ...contains];
  return ranked.slice(0, limit).map((name) => {
    const docs = registry[name]?.docs;
    return {
      kind: 'function',
      name,
      signature: docs?.signature ?? '',
      summary: docs?.summary ?? '',
      replaceStart: match.token.start,
      replaceEnd: match.token.end,
      prefix: match.prefix,
    } satisfies FormulaSuggestion;
  });
}

/**
 * Build the text to insert when accepting a function suggestion — always
 * `NAME(` so the user can immediately start typing the first argument.
 */
export function suggestionInsertionText(suggestion: FormulaSuggestion): string {
  return `${suggestion.name}(`;
}