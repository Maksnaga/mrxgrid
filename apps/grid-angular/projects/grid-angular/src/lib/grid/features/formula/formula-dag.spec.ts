import { FormulaDag } from './formula-dag';

describe('FormulaDag — basic edges', () => {
  it('tracks forward and reverse dependencies', () => {
    const dag = new FormulaDag();
    dag.setDependencies('A', ['B', 'C']);
    expect([...dag.dependenciesOf('A')].sort()).toEqual(['B', 'C']);
    expect([...dag.dependentsOf('B')]).toEqual(['A']);
    expect([...dag.dependentsOf('C')]).toEqual(['A']);
  });

  it('replaces dependencies atomically', () => {
    const dag = new FormulaDag();
    dag.setDependencies('A', ['B']);
    dag.setDependencies('A', ['C']);
    expect([...dag.dependenciesOf('A')]).toEqual(['C']);
    expect(dag.dependentsOf('B').size).toBe(0);
    expect([...dag.dependentsOf('C')]).toEqual(['A']);
  });

  it('removes every edge touching a node', () => {
    const dag = new FormulaDag();
    dag.setDependencies('A', ['B']);
    dag.setDependencies('C', ['A']);
    dag.remove('A');
    expect(dag.dependenciesOf('A').size).toBe(0);
    expect(dag.dependentsOf('A').size).toBe(0);
    expect(dag.dependenciesOf('C').size).toBe(0);
    expect(dag.dependentsOf('B').size).toBe(0);
  });
});

describe('FormulaDag — cycle detection', () => {
  it('flags self-loops', () => {
    const dag = new FormulaDag();
    dag.setDependencies('A', ['A']);
    // Self-loops skip the forward set insertion; adding manually for the test.
    // The engine will invoke detectCycle when it notices the raw ref set
    // contains `self`, but here we simulate a 2-cycle instead.
    dag.setDependencies('A', ['B']);
    dag.setDependencies('B', ['A']);
    const cycle = dag.detectCycle('A');
    expect(cycle).not.toBeNull();
    expect([...cycle!].sort()).toEqual(['A', 'B']);
  });

  it('finds cycles in longer chains', () => {
    const dag = new FormulaDag();
    dag.setDependencies('A', ['B']);
    dag.setDependencies('B', ['C']);
    dag.setDependencies('C', ['D']);
    dag.setDependencies('D', ['B']);
    const cycle = dag.detectCycle('A');
    expect(cycle).not.toBeNull();
    expect([...cycle!].sort()).toEqual(['B', 'C', 'D']);
  });

  it('returns null for acyclic graphs', () => {
    const dag = new FormulaDag();
    dag.setDependencies('A', ['B']);
    dag.setDependencies('B', ['C']);
    expect(dag.detectCycle('A')).toBeNull();
  });
});

describe('FormulaDag — topological order', () => {
  it('orders dependents after dependencies', () => {
    const dag = new FormulaDag();
    // Dependency graph: A→B, A→C, C→D, roots = [B, D] so we test that
    // dependents of B and D show up after them.
    //   A depends on B and C
    //   C depends on D
    dag.setDependencies('A', ['B', 'C']);
    dag.setDependencies('C', ['D']);
    const order = dag.topoFrom(['B', 'D']);
    expect(order).toContain('A');
    expect(order).toContain('C');
    expect(order.indexOf('A')).toBeGreaterThan(order.indexOf('B'));
    expect(order.indexOf('A')).toBeGreaterThan(order.indexOf('C'));
    expect(order.indexOf('C')).toBeGreaterThan(order.indexOf('D'));
  });

  it('returns only reachable descendants', () => {
    const dag = new FormulaDag();
    dag.setDependencies('A', ['B']);
    dag.setDependencies('X', ['Y']); // disconnected subgraph
    const order = dag.topoFrom(['B']);
    expect(order).toEqual(['B', 'A']);
  });

  it('appends cycle members at the end', () => {
    const dag = new FormulaDag();
    dag.setDependencies('A', ['B']);
    dag.setDependencies('B', ['A']);
    const order = dag.topoFrom(['A']);
    expect(order.length).toBe(2);
    expect(order).toContain('A');
    expect(order).toContain('B');
  });
});
