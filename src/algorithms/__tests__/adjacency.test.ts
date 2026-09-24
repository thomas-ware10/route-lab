import { describe, expect, it } from 'vitest'
import { buildAdjacency, outgoingEdges, type Graph, type GraphEdge, type GraphNode } from '../../types'
import { dijkstra } from '../dijkstra'
import { astar } from '../astar'
import { isDoneStep } from '../types'

function triangle(mode: Graph['mode']): Graph {
  return {
    mode,
    nodes: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 1, y: 0, label: 'B' },
      { id: 'C', x: 0, y: 1, label: 'C' },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', weight: 1 },
      { id: 'e2', source: 'B', target: 'C', weight: 1 },
      { id: 'e3', source: 'C', target: 'A', weight: 1 },
    ],
  }
}

/** A size x size grid, 4-connected, with both directions as separate directed edges. */
function grid(size: number): Graph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const id = (r: number, c: number) => `${r}_${c}`
  let k = 0
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      nodes.push({ id: id(r, c), x: c, y: r, label: '' })
      if (c + 1 < size) {
        edges.push({ id: `e${k++}`, source: id(r, c), target: id(r, c + 1), weight: 1 })
        edges.push({ id: `e${k++}`, source: id(r, c + 1), target: id(r, c), weight: 1 })
      }
      if (r + 1 < size) {
        edges.push({ id: `e${k++}`, source: id(r, c), target: id(r + 1, c), weight: 1 })
        edges.push({ id: `e${k++}`, source: id(r + 1, c), target: id(r, c), weight: 1 })
      }
    }
  }
  return { mode: 'directed', nodes, edges }
}

describe('buildAdjacency', () => {
  it('matches outgoingEdges exactly (same edges, same order) in undirected mode', () => {
    const g = triangle('undirected')
    const adj = buildAdjacency(g)
    for (const n of g.nodes) expect(adj.get(n.id) ?? []).toEqual(outgoingEdges(g, n.id))
  })

  it('matches outgoingEdges exactly in directed mode', () => {
    const g = triangle('directed')
    const adj = buildAdjacency(g)
    for (const n of g.nodes) expect(adj.get(n.id) ?? []).toEqual(outgoingEdges(g, n.id))
  })

  it('does not list a self-loop twice in undirected mode', () => {
    const g: Graph = {
      mode: 'undirected',
      nodes: [{ id: 'A', x: 0, y: 0, label: 'A' }],
      edges: [{ id: 'loop', source: 'A', target: 'A', weight: 1 }],
    }
    expect(buildAdjacency(g).get('A')).toHaveLength(1)
  })
})

describe('shortest-path engines at road-network scale', () => {
  // ~22.5k nodes / ~90k edges. With the old per-visit outgoingEdges() scan this
  // was O(V*E) (~2e9 filter checks) and would take minutes; with the adjacency
  // index it is well under a second. The budget is generous to avoid CI flake.
  it('dijkstra solves a 150x150 grid corner-to-corner quickly', () => {
    const g = grid(150)
    const t0 = performance.now()
    const trace = dijkstra(g, { startNodeId: '0_0', endNodeId: '149_149' })
    const elapsed = performance.now() - t0
    expect(trace.steps.find(isDoneStep)?.totalCost).toBe(298)
    expect(elapsed).toBeLessThan(5000)
  })

  it('astar finds the same optimal cost as dijkstra on the grid', () => {
    const g = grid(60)
    const d = dijkstra(g, { startNodeId: '0_0', endNodeId: '59_59' }).steps.find(isDoneStep)!
    const a = astar(g, { startNodeId: '0_0', endNodeId: '59_59' }).steps.find(isDoneStep)!
    expect(a.totalCost).toBe(d.totalCost)
  })
})
