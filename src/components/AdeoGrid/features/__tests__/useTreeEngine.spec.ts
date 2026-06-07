import { describe, it, expect } from 'vitest'
import { useGridState } from '../../state/useGridState'
import { useTreeEngine } from '../useTreeEngine'
import type { ColumnDef } from '../../types'

interface Node {
  id: string
  name: string
  children?: Node[]
}

const columns: ColumnDef<Node>[] = [
  { field: 'id', headerName: 'ID' },
  { field: 'name', headerName: 'Name' },
]

const tree: Node[] = [
  {
    id: 'a',
    name: 'A',
    children: [
      {
        id: 'a1',
        name: 'A1',
        children: [{ id: 'a1x', name: 'A1X' }],
      },
      { id: 'a2', name: 'A2' },
    ],
  },
  { id: 'b', name: 'B' },
]

function setup() {
  const state = useGridState<Node>()
  state.initColumns(columns)
  const engine = useTreeEngine<Node>(state)
  return { state, engine }
}

describe('useTreeEngine / flatten', () => {
  it('emits only roots when nothing is expanded', () => {
    const { engine } = setup()
    const rows = engine.flatten(tree, { childrenField: 'children' }, new Set(), 'id')
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.nodeKey)).toEqual(['a', 'b'])
    expect(rows[0]?.hasChildren).toBe(true)
    expect(rows[1]?.hasChildren).toBe(false)
  })

  it('expands children when their parent key is in the set', () => {
    const { engine } = setup()
    const rows = engine.flatten(
      tree,
      { childrenField: 'children' },
      new Set(['a']),
      'id',
    )
    // a, a1, a2, b
    expect(rows.map((r) => r.nodeKey)).toEqual(['a', 'a/a1', 'a/a2', 'b'])
    expect(rows[1]?.depth).toBe(1)
  })

  it('nested expansion builds slash-delimited keys', () => {
    const { engine } = setup()
    const rows = engine.flatten(
      tree,
      { childrenField: 'children' },
      new Set(['a', 'a/a1']),
      'id',
    )
    // a, a/a1, a/a1/a1x, a/a2, b
    expect(rows.map((r) => r.nodeKey)).toEqual(['a', 'a/a1', 'a/a1/a1x', 'a/a2', 'b'])
    expect(rows[2]?.depth).toBe(2)
  })

  it('uses hasChildrenField when provided', () => {
    const { engine } = setup()
    const data = [{ id: 'x', name: 'X', children: [], lazy: true }] as unknown as Node[]
    const rows = engine.flatten(
      data,
      { childrenField: 'children', hasChildrenField: 'lazy' },
      new Set(),
      'id',
    )
    expect(rows[0]?.hasChildren).toBe(true)
  })
})

describe('useTreeEngine / toggleNode + expandAll + collapseAll', () => {
  it('toggleNode flips membership in expandedRowIds', () => {
    const { state, engine } = setup()
    engine.toggleNode('a')
    expect(state.expandedRowIds.value.has('a')).toBe(true)
    engine.toggleNode('a')
    expect(state.expandedRowIds.value.has('a')).toBe(false)
  })

  it('expandAll adds every node that has children (not leaves)', () => {
    const { state, engine } = setup()
    engine.expandAll(tree, { childrenField: 'children' }, 'id')
    // 'a' and 'a/a1' have children; 'a/a2', 'a/a1/a1x', 'b' are leaves
    expect(state.expandedRowIds.value.has('a')).toBe(true)
    expect(state.expandedRowIds.value.has('a/a1')).toBe(true)
    expect(state.expandedRowIds.value.has('b')).toBe(false)
    expect(state.expandedRowIds.value.has('a/a2')).toBe(false)
  })

  it('collapseAll wipes expandedRowIds', () => {
    const { state, engine } = setup()
    state.expandedRowIds.value = new Set(['a', 'a/a1'])
    engine.collapseAll()
    expect(state.expandedRowIds.value.size).toBe(0)
  })
})
