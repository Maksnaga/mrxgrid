/**
 * Formula evaluator — walks a `FormulaAst` and produces a `FormulaValue`.
 *
 * Scope of Phase 0:
 *   - Arithmetic, comparison, concatenation, unary operators with Excel
 *     coercion rules (via `toNumber` / `toStringValue` / `toBoolean`).
 *   - Function calls dispatched through a pluggable registry.
 *   - Reference resolution delegated to the caller via `FormulaEvalContext`.
 *   - Range expansion: when a function declares `acceptsRange: true`, range
 *     operands are flattened row-major into the argument array before the
 *     function sees them; otherwise a range passed to an arithmetic op or
 *     a scalar-only function yields `#VALUE!`.
 *
 * Out of scope (handled by the engine in later phases):
 *   - Cycle detection, topological evaluation.
 *   - Ref resolution mapping (structured ref → resolved address).
 */

import {
  CellAddress,
  FormulaError,
  FormulaEvalContext,
  FormulaFunctionRegistry,
  FormulaValue,
  firstError,
  toNumber,
  toStringValue,
} from '../../models/formula.model';
import { BinaryOp, FormulaAst } from './formula-ast';

/**
 * Evaluate a parsed formula. Never throws: every internal exception is
 * converted to a `#VALUE!` / `#REF!` / `#NAME?` value so the caller can
 * safely store the result without wrapping in try/catch.
 */
export function evaluate(
  ast: FormulaAst,
  functions: FormulaFunctionRegistry,
  ctx: FormulaEvalContext
): FormulaValue {
  try {
    const v = evalNode(ast, functions, ctx);
    // Range values escaping to the top are not renderable — surface as #VALUE!.
    if (Array.isArray(v)) return { kind: 'error', error: '#VALUE!' };
    return v;
  } catch (err) {
    if (err instanceof EvalError) {
      return { kind: 'error', error: err.code };
    }
    return { kind: 'error', error: '#VALUE!' };
  }
}

// A "range result" is a flat row-major list of values; it is never a top-level
// result, only an intermediate value that `call` may expand. Represented as an
// array to keep the hot path allocation-free when ranges are not used.
type EvalResult = FormulaValue | FormulaValue[];

class EvalError extends Error {
  constructor(readonly code: FormulaError) {
    super(code);
  }
}

function fail(code: FormulaError): never {
  throw new EvalError(code);
}

function evalNode(
  node: FormulaAst,
  functions: FormulaFunctionRegistry,
  ctx: FormulaEvalContext
): EvalResult {
  switch (node.kind) {
    case 'number':
      return { kind: 'number', value: node.value };
    case 'string':
      return { kind: 'string', value: node.value };
    case 'boolean':
      return { kind: 'boolean', value: node.value };
    case 'ref':
      return resolveRef(node.resolved, ctx);
    case 'range':
      return resolveRange(node.resolved, ctx);
    case 'unary':
      return evalUnary(node.op, evalNode(node.operand, functions, ctx));
    case 'binary':
      return evalBinary(
        node.op,
        evalNode(node.left, functions, ctx),
        evalNode(node.right, functions, ctx)
      );
    case 'call':
      return evalCall(node.name, node.args, functions, ctx);
  }
}

function resolveRef(resolved: CellAddress | undefined, ctx: FormulaEvalContext): FormulaValue {
  if (!resolved) {
    // Un-resolved references surface #REF!. The ref-mapper (Phase 1) is
    // responsible for attaching `resolved` after parsing; Phase 0 tests
    // rely on direct evaluator invocations with synthetic inputs.
    return { kind: 'error', error: '#REF!' };
  }
  return ctx.resolveRef(resolved) ?? { kind: 'empty' };
}

function resolveRange(
  resolved: ReadonlyArray<CellAddress | undefined> | undefined,
  ctx: FormulaEvalContext
): EvalResult {
  if (!resolved) return fail('#REF!');
  const out: FormulaValue[] = new Array(resolved.length);
  for (let i = 0; i < resolved.length; i++) {
    const target = resolved[i];
    out[i] = target ? ctx.resolveRef(target) : { kind: 'error', error: '#REF!' };
  }
  return out;
}

// ─── Unary ──────────────────────────────────────────────────────────────────

function evalUnary(op: '+' | '-', operand: EvalResult): FormulaValue {
  if (Array.isArray(operand)) return { kind: 'error', error: '#VALUE!' };
  if (operand.kind === 'error') return operand;
  const n = toNumber(operand);
  if (typeof n === 'string') return { kind: 'error', error: n };
  return { kind: 'number', value: op === '+' ? n : -n };
}

// ─── Binary ─────────────────────────────────────────────────────────────────

function evalBinary(op: BinaryOp, left: EvalResult, right: EvalResult): FormulaValue {
  if (Array.isArray(left) || Array.isArray(right)) {
    return { kind: 'error', error: '#VALUE!' };
  }
  const err = firstError([left, right]);
  if (err) return { kind: 'error', error: err };

  switch (op) {
    case '+':
    case '-':
    case '*':
    case '/':
    case '^':
      return arith(op, left, right);
    case '&':
      return concat(left, right);
    case '=':
    case '<>':
    case '<':
    case '>':
    case '<=':
    case '>=':
      return compare(op, left, right);
  }
}

function arith(op: '+' | '-' | '*' | '/' | '^', a: FormulaValue, b: FormulaValue): FormulaValue {
  const l = toNumber(a);
  if (typeof l === 'string') return { kind: 'error', error: l };
  const r = toNumber(b);
  if (typeof r === 'string') return { kind: 'error', error: r };

  let result: number;
  switch (op) {
    case '+':
      result = l + r;
      break;
    case '-':
      result = l - r;
      break;
    case '*':
      result = l * r;
      break;
    case '/':
      if (r === 0) return { kind: 'error', error: '#DIV/0!' };
      result = l / r;
      break;
    case '^':
      result = Math.pow(l, r);
      break;
  }
  if (!Number.isFinite(result)) return { kind: 'error', error: '#NUM!' };
  return { kind: 'number', value: result };
}

function concat(a: FormulaValue, b: FormulaValue): FormulaValue {
  const l = toStringValue(a);
  if (typeof l !== 'string') return { kind: 'error', error: l };
  const r = toStringValue(b);
  if (typeof r !== 'string') return { kind: 'error', error: r };
  return { kind: 'string', value: l + r };
}

function compare(
  op: '=' | '<>' | '<' | '>' | '<=' | '>=',
  a: FormulaValue,
  b: FormulaValue
): FormulaValue {
  const ord = compareValues(a, b);
  if (ord === null) return { kind: 'error', error: '#VALUE!' };
  let result: boolean;
  switch (op) {
    case '=':
      result = ord === 0;
      break;
    case '<>':
      result = ord !== 0;
      break;
    case '<':
      result = ord < 0;
      break;
    case '>':
      result = ord > 0;
      break;
    case '<=':
      result = ord <= 0;
      break;
    case '>=':
      result = ord >= 0;
      break;
  }
  return { kind: 'boolean', value: result };
}

/**
 * Excel comparison rules (simplified):
 *   - Numbers compare numerically, ties broken as equal.
 *   - Strings compare case-insensitively, lexicographically.
 *   - Booleans: FALSE < TRUE.
 *   - Cross-type comparison orders are: number < string < boolean.
 *   - `empty` coerces to 0 / "" / FALSE depending on the other side.
 *
 * Returns null when comparison is meaningless (e.g. against an error, though
 * we already filter those out beforehand).
 */
function compareValues(a: FormulaValue, b: FormulaValue): number | null {
  if (a.kind === 'error' || b.kind === 'error') return null;

  const aRank = typeRank(a);
  const bRank = typeRank(b);
  if (aRank !== bRank) return aRank - bRank;

  switch (a.kind) {
    case 'number': {
      const bn = b as Extract<FormulaValue, { kind: 'number' }>;
      return a.value === bn.value ? 0 : a.value < bn.value ? -1 : 1;
    }
    case 'string': {
      const bs = b as Extract<FormulaValue, { kind: 'string' }>;
      const la = a.value.toLowerCase();
      const lb = bs.value.toLowerCase();
      return la === lb ? 0 : la < lb ? -1 : 1;
    }
    case 'boolean': {
      const bb = b as Extract<FormulaValue, { kind: 'boolean' }>;
      const na = a.value ? 1 : 0;
      const nb = bb.value ? 1 : 0;
      return na - nb;
    }
    case 'empty':
      return 0;
  }
  // Unreachable: errors are filtered at the top of the function.
  return null;
}

function typeRank(v: FormulaValue): number {
  switch (v.kind) {
    case 'empty':
    case 'number':
      return 0;
    case 'string':
      return 1;
    case 'boolean':
      return 2;
    case 'error':
      return 3;
  }
}

// ─── Function call ──────────────────────────────────────────────────────────

function evalCall(
  name: string,
  astArgs: readonly FormulaAst[],
  functions: FormulaFunctionRegistry,
  ctx: FormulaEvalContext
): FormulaValue {
  const impl = functions[name];
  if (!impl) return { kind: 'error', error: '#NAME?' };

  const rawArgs = astArgs.map((arg) => evalNode(arg, functions, ctx));

  // Range handling: flatten or reject depending on declaration.
  const args: FormulaValue[] = [];
  for (const r of rawArgs) {
    if (Array.isArray(r)) {
      if (!impl.acceptsRange) return { kind: 'error', error: '#VALUE!' };
      args.push(...r);
    } else {
      args.push(r);
    }
  }

  // Arity check
  if (!arityMatches(impl.arity, args.length)) {
    return { kind: 'error', error: '#N/A' };
  }

  // Propagate first error in arguments for functions that don't opt into
  // handling them (IFERROR is the only built-in that opts in).
  if (!arityAllowsErrorShortCircuit(name)) {
    const err = firstError(args);
    if (err) return { kind: 'error', error: err };
  }

  try {
    return impl.evaluate(args, ctx);
  } catch (err) {
    if (err instanceof EvalError) return { kind: 'error', error: err.code };
    return { kind: 'error', error: '#VALUE!' };
  }
}

function arityMatches(arity: FormulaArityLike, actual: number): boolean {
  if (typeof arity === 'number') return arity === actual;
  if (arity === 'variadic') return true;
  const [min, max] = arity;
  return actual >= min && actual <= max;
}

type FormulaArityLike = number | 'variadic' | readonly [number, number];

/**
 * Built-in functions that expect to see error values as arguments (so they
 * can react to them instead of short-circuiting). `IFERROR` is the canonical
 * case. Everything else follows Excel's "first error wins" rule.
 */
function arityAllowsErrorShortCircuit(name: string): boolean {
  return name === 'IFERROR' || name === 'IFS' || name === 'IF';
}

