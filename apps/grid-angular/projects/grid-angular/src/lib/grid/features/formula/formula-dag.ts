/**
 * Dependency graph for formula cells.
 *
 * Each node is identified by a stable string key (the engine uses
 * `rowId|field`). Edges go **from** a formula cell **to** every cell it
 * references — so reading the graph "forward" yields dependencies
 * ("what do I need?"), and "reverse" yields dependents ("who needs me?").
 *
 *   A = B + C           ▶ forward(A) = {B, C}, reverse(B) ⊇ {A}
 *
 * The DAG also exposes:
 *   - `detectCycle(from)` — returns the cycle membership if the node
 *     participates in one, to be marked as `#CYCLE!` by the engine.
 *   - `topoFrom(roots)`  — topological order of descendants of `roots`,
 *     used to re-evaluate only the impacted slice after a mutation.
 *
 * The implementation is deliberately pure (no Angular DI) so it can be
 * unit-tested and reused outside the grid context.
 */

export type NodeKey = string;

export class FormulaDag {
  /** Forward edges: node → set of nodes it depends on. */
  private readonly forward = new Map<NodeKey, Set<NodeKey>>();
  /** Reverse edges: node → set of nodes that depend on it. */
  private readonly reverse = new Map<NodeKey, Set<NodeKey>>();

  /** Replaces every outgoing edge of `node` with the given `deps`. */
  setDependencies(node: NodeKey, deps: Iterable<NodeKey>): void {
    this.clearForward(node);
    const next = new Set<NodeKey>();
    for (const d of deps) {
      if (d === node) continue; // self-loop is handled via cycle detection
      next.add(d);
      let back = this.reverse.get(d);
      if (!back) {
        back = new Set();
        this.reverse.set(d, back);
      }
      back.add(node);
    }
    if (next.size > 0) this.forward.set(node, next);
  }

  /** Removes every edge touching `node` (both directions). */
  remove(node: NodeKey): void {
    this.clearForward(node);
    const dependents = this.reverse.get(node);
    if (dependents) {
      for (const dep of dependents) {
        this.forward.get(dep)?.delete(node);
        if (this.forward.get(dep)?.size === 0) this.forward.delete(dep);
      }
      this.reverse.delete(node);
    }
  }

  /** Direct dependencies of `node` (what `node` needs). */
  dependenciesOf(node: NodeKey): ReadonlySet<NodeKey> {
    return this.forward.get(node) ?? EMPTY_SET;
  }

  /** Direct dependents of `node` (who needs `node`). */
  dependentsOf(node: NodeKey): ReadonlySet<NodeKey> {
    return this.reverse.get(node) ?? EMPTY_SET;
  }

  /**
   * Returns the **membership** of the cycle containing `start`, or `null`
   * when no cycle is reachable. Uses an iterative DFS with a path stack to
   * stay linear and avoid recursion blow-ups for long chains.
   */
  detectCycle(start: NodeKey): ReadonlySet<NodeKey> | null {
    // Self-loop special case
    if (this.forward.get(start)?.has(start)) {
      return new Set([start]);
    }

    const colour = new Map<NodeKey, 'grey' | 'black'>();
    const parent = new Map<NodeKey, NodeKey>();
    const stack: Array<{ node: NodeKey; iter: Iterator<NodeKey> }> = [];

    const pushNode = (node: NodeKey): void => {
      colour.set(node, 'grey');
      stack.push({ node, iter: (this.forward.get(node) ?? EMPTY_SET).values() });
    };

    pushNode(start);

    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const { value: dep, done } = top.iter.next();
      if (done) {
        colour.set(top.node, 'black');
        stack.pop();
        continue;
      }
      if (colour.get(dep) === 'grey') {
        // Found a back-edge. Walk the parent chain from `top.node` back to
        // `dep` to reconstruct the cycle members.
        const members = new Set<NodeKey>([dep]);
        let cursor: NodeKey | undefined = top.node;
        while (cursor && cursor !== dep) {
          members.add(cursor);
          cursor = parent.get(cursor);
        }
        return members;
      }
      if (!colour.has(dep)) {
        parent.set(dep, top.node);
        pushNode(dep);
      }
    }
    return null;
  }

  /**
   * Kahn-style topological order over the descendants of `roots` (inclusive).
   * Guaranteed to be deterministic for a given insertion order. If the sub-
   * graph contains a cycle, nodes inside the cycle are returned **after** the
   * acyclic prefix in arbitrary order — the engine is expected to mark them
   * as `#CYCLE!` via `detectCycle` beforehand, so ordering does not matter.
   */
  topoFrom(roots: Iterable<NodeKey>): NodeKey[] {
    // 1. Collect every descendant reachable via reverse edges.
    const reachable = new Set<NodeKey>();
    const stack: NodeKey[] = [];
    for (const r of roots) {
      if (!reachable.has(r)) {
        reachable.add(r);
        stack.push(r);
      }
    }
    while (stack.length > 0) {
      const node = stack.pop()!;
      for (const dep of this.reverse.get(node) ?? EMPTY_SET) {
        if (!reachable.has(dep)) {
          reachable.add(dep);
          stack.push(dep);
        }
      }
    }

    // 2. Kahn: compute in-degrees restricted to `reachable`, then drain.
    const inDegree = new Map<NodeKey, number>();
    for (const node of reachable) inDegree.set(node, 0);
    for (const node of reachable) {
      for (const dep of this.forward.get(node) ?? EMPTY_SET) {
        if (reachable.has(dep)) {
          inDegree.set(node, (inDegree.get(node) ?? 0) + 1);
        }
      }
    }
    const queue: NodeKey[] = [];
    for (const [node, deg] of inDegree) {
      if (deg === 0) queue.push(node);
    }
    const ordered: NodeKey[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      ordered.push(node);
      for (const dependent of this.reverse.get(node) ?? EMPTY_SET) {
        if (!reachable.has(dependent)) continue;
        const nextDeg = (inDegree.get(dependent) ?? 0) - 1;
        inDegree.set(dependent, nextDeg);
        if (nextDeg === 0) queue.push(dependent);
      }
    }

    // Any remaining reachable nodes belong to cycles — append them so
    // callers that rely on "every descendant appears once" still work.
    if (ordered.length < reachable.size) {
      for (const node of reachable) {
        if (!ordered.includes(node)) ordered.push(node);
      }
    }
    return ordered;
  }

  /** Empties every edge — used when the grid is reset. */
  clear(): void {
    this.forward.clear();
    this.reverse.clear();
  }

  private clearForward(node: NodeKey): void {
    const prev = this.forward.get(node);
    if (!prev) return;
    for (const dep of prev) {
      const back = this.reverse.get(dep);
      back?.delete(node);
      if (back && back.size === 0) this.reverse.delete(dep);
    }
    this.forward.delete(node);
  }
}

const EMPTY_SET: ReadonlySet<NodeKey> = new Set();
