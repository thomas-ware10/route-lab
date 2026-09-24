import { describe, expect, it } from 'vitest'
import type { Graph } from '../../types'
import { dijkstra } from '../dijkstra'
import { isDoneStep } from '../types'

function line(mode: Graph['mode'] = 'undirected'): Graph {
  // A -1- B -2- C -1- D, plus a costly direct A-D shortcut
  return {
    mode,
    nodes: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 1, y: 0, label: 'B' },
      { id: 'C', x: 2, y: 0, label: 'C' },
      { id: 'D', x: 3, y: 0, label: 'D' },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', weight: 1 },
      { id: 'e2', source: 'B', target: 'C', weight: 2 },
      { id: 'e3', source: 'C', target: 'D', weight: 1 },
      { id: 'e4', source: 'A', target: 'D', weight: 100 },
    ],
  }
}

describe('dijkstra', () => {
  it('finds the shortest path by total weight, not hop count', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'D' })
    const done = trace.steps.find(isDoneStep)!
    expect(done.success).toBe(true)
    expect(done.totalCost).toBe(4)
    expect(done.resultPathNodeIds).toEqual(['A', 'B', 'C', 'D'])
    expect(done.resultEdgeIds).toEqual(['e1', 'e2', 'e3'])
  })

  it('reports no path when the target is unreachable', () => {
    const g = line()
    g.edges = g.edges.filter((e) => e.id !== 'e3' && e.id !== 'e4')
    const trace = dijkstra(g, { startNodeId: 'A', endNodeId: 'D' })
    const done = trace.steps.find(isDoneStep)!
    expect(done.success).toBe(false)
    expect(done.resultEdgeIds).toEqual([])
  })

  it('respects edge direction in directed mode', () => {
    const g = line('directed')
    g.edges = [{ id: 'e1', source: 'B', target: 'A', weight: 1 }]
    const trace = dijkstra(g, { startNodeId: 'A', endNodeId: 'B' })
    const done = trace.steps.find(isDoneStep)!
    expect(done.success).toBe(false)
  })

  it('produces monotonically non-decreasing cumulative stats across steps', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'D' })
    let prevTotal = 0
    for (const step of trace.steps) {
      expect(step.stats.totalOperations).toBeGreaterThanOrEqual(prevTotal)
      prevTotal = step.stats.totalOperations
    }
  })

  it('warns about negative edge weights but still returns a trace', () => {
    const g = line()
    g.edges[0].weight = -5
    const trace = dijkstra(g, { startNodeId: 'A', endNodeId: 'D' })
    expect(trace.warnings.length).toBe(1)
    expect(trace.warnings[0]).toMatch(/negative/i)
  })

  it('throws for an unknown start or end node', () => {
    const g = line()
    expect(() => dijkstra(g, { startNodeId: 'Z', endNodeId: 'D' })).toThrow()
    expect(() => dijkstra(g, { startNodeId: 'A', endNodeId: 'Z' })).toThrow()
  })

  it('finds the direct path when it is actually cheapest', () => {
    const g = line()
    g.edges.find((e) => e.id === 'e4')!.weight = 1
    const trace = dijkstra(g, { startNodeId: 'A', endNodeId: 'D' })
    const done = trace.steps.find(isDoneStep)!
    expect(done.totalCost).toBe(1)
    expect(done.resultPathNodeIds).toEqual(['A', 'D'])
  })
})
