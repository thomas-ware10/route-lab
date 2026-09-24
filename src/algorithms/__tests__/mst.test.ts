import { describe, expect, it } from 'vitest'
import type { Graph } from '../../types'
import { kruskal } from '../kruskal'
import { prim } from '../prim'
import { isDoneStep } from '../types'

// A 9-node, 14-edge graph. MST cost of 37 verified by hand-tracing Kruskal:
// accepts G-H(1), C-I(2), F-G(2), A-B(4), C-F(4), C-D(7), A-H(8), D-E(9).
function textbookGraph(mode: Graph['mode'] = 'undirected'): Graph {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
  return {
    mode,
    nodes: ids.map((id, i) => ({ id, x: i * 10, y: (i % 3) * 10, label: id })),
    edges: [
      ['A', 'B', 4],
      ['A', 'H', 8],
      ['B', 'C', 8],
      ['B', 'H', 11],
      ['C', 'D', 7],
      ['C', 'F', 4],
      ['C', 'I', 2],
      ['D', 'E', 9],
      ['D', 'F', 14],
      ['E', 'F', 10],
      ['F', 'G', 2],
      ['G', 'H', 1],
      ['G', 'I', 6],
      ['H', 'I', 7],
    ].map(([source, target, weight], i) => ({
      id: `e${i}`,
      source: source as string,
      target: target as string,
      weight: weight as number,
    })),
  }
}

function disconnectedGraph(): Graph {
  return {
    mode: 'undirected',
    nodes: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 1, y: 0, label: 'B' },
      { id: 'C', x: 5, y: 5, label: 'C' },
      { id: 'D', x: 6, y: 5, label: 'D' },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', weight: 1 },
      { id: 'e2', source: 'C', target: 'D', weight: 1 },
    ],
  }
}

describe('kruskal', () => {
  it('finds the known-optimal MST cost on the textbook graph', () => {
    const trace = kruskal(textbookGraph())
    const done = trace.steps.find(isDoneStep)!
    expect(done.totalCost).toBe(37)
    expect(done.resultEdgeIds.length).toBe(8) // V - 1 = 8
  })

  it('never accepts an edge that would form a cycle', () => {
    const trace = kruskal(textbookGraph())
    const uf = new Map<string, string>()
    const find = (x: string): string => (uf.get(x) === x || !uf.has(x) ? (uf.set(x, x), x) : find(uf.get(x)!))
    const union = (a: string, b: string) => uf.set(find(a), find(b))
    const g = textbookGraph()
    const edgeById = new Map(g.edges.map((e) => [e.id, e]))
    for (const step of trace.steps) {
      if (step.kind === 'accept-edge') {
        const e = edgeById.get(step.edgeId)!
        expect(find(e.source)).not.toBe(find(e.target))
        union(e.source, e.target)
      }
    }
  })

  it('produces a spanning forest and warns on a disconnected graph', () => {
    const trace = kruskal(disconnectedGraph())
    const done = trace.steps.find(isDoneStep)!
    expect(done.resultEdgeIds.length).toBe(2)
    expect(trace.warnings.some((w) => /disconnected/i.test(w))).toBe(true)
  })

  it('warns when run on a directed graph', () => {
    const trace = kruskal(textbookGraph('directed'))
    expect(trace.warnings.some((w) => /directed/i.test(w))).toBe(true)
  })
})

describe('prim', () => {
  it('finds the same MST cost as kruskal on the textbook graph', () => {
    const kTrace = kruskal(textbookGraph())
    const pTrace = prim(textbookGraph())
    const kDone = kTrace.steps.find(isDoneStep)!
    const pDone = pTrace.steps.find(isDoneStep)!
    expect(pDone.totalCost).toBe(kDone.totalCost)
    expect(pDone.resultEdgeIds.length).toBe(kDone.resultEdgeIds.length)
  })

  it('matches regardless of chosen start node', () => {
    const pTrace = prim(textbookGraph(), { startNodeId: 'E' })
    const done = pTrace.steps.find(isDoneStep)!
    expect(done.totalCost).toBe(37)
  })

  it('only spans the reachable component and warns on a disconnected graph', () => {
    const trace = prim(disconnectedGraph(), { startNodeId: 'A' })
    const done = trace.steps.find(isDoneStep)!
    expect(done.resultEdgeIds).toEqual(['e1'])
    expect(trace.warnings.some((w) => /disconnected/i.test(w))).toBe(true)
  })

  it('throws for an unknown start node', () => {
    expect(() => prim(textbookGraph(), { startNodeId: 'Z' })).toThrow()
  })

  it('produces monotonically non-decreasing cumulative stats across steps', () => {
    const trace = prim(textbookGraph())
    let prevTotal = 0
    for (const step of trace.steps) {
      expect(step.stats.totalOperations).toBeGreaterThanOrEqual(prevTotal)
      prevTotal = step.stats.totalOperations
    }
  })
})
