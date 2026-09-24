import { describe, expect, it } from 'vitest'
import type { Graph } from '../../types'
import { astar } from '../astar'
import { dijkstra } from '../dijkstra'
import { isDoneStep } from '../types'

// Straight line, positions match weights exactly -> heuristic is consistent.
function consistentLine(): Graph {
  return {
    mode: 'undirected',
    nodes: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 1, y: 0, label: 'B' },
      { id: 'C', x: 3, y: 0, label: 'C' },
      { id: 'D', x: 6, y: 0, label: 'D' },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', weight: 1 },
      { id: 'e2', source: 'B', target: 'C', weight: 2 },
      { id: 'e3', source: 'C', target: 'D', weight: 3 },
      { id: 'e4', source: 'A', target: 'D', weight: 100 },
    ],
  }
}

describe('astar', () => {
  it('matches dijkstra total cost on a consistent-heuristic graph', () => {
    const g = consistentLine()
    const aTrace = astar(g, { startNodeId: 'A', endNodeId: 'D' })
    const dTrace = dijkstra(g, { startNodeId: 'A', endNodeId: 'D' })
    const aDone = aTrace.steps.find(isDoneStep)!
    const dDone = dTrace.steps.find(isDoneStep)!
    expect(aDone.totalCost).toBe(dDone.totalCost)
    expect(aDone.resultPathNodeIds).toEqual(dDone.resultPathNodeIds)
  })

  it('reports no warnings when the heuristic is consistent', () => {
    const trace = astar(consistentLine(), { startNodeId: 'A', endNodeId: 'D' })
    expect(trace.warnings).toEqual([])
  })

  it('warns when node positions make the Euclidean heuristic inadmissible', () => {
    // B and D placed far apart on screen but connected by a tiny-weight edge:
    // h(B) will badly overestimate the true remaining cost via that edge.
    const g: Graph = {
      mode: 'undirected',
      nodes: [
        { id: 'A', x: 0, y: 0, label: 'A' },
        { id: 'B', x: 0, y: 0, label: 'B' },
        { id: 'D', x: 1000, y: 0, label: 'D' },
      ],
      edges: [
        { id: 'e1', source: 'A', target: 'B', weight: 1 },
        { id: 'e2', source: 'B', target: 'D', weight: 1 },
      ],
    }
    const trace = astar(g, { startNodeId: 'A', endNodeId: 'D' })
    expect(trace.warnings.length).toBeGreaterThan(0)
    expect(trace.warnings[0]).toMatch(/inadmissible/i)
  })

  it('reports no path when the target is unreachable', () => {
    const g = consistentLine()
    g.edges = g.edges.filter((e) => e.id === 'e1')
    const trace = astar(g, { startNodeId: 'A', endNodeId: 'D' })
    const done = trace.steps.find(isDoneStep)!
    expect(done.success).toBe(false)
  })

  it('produces monotonically non-decreasing cumulative stats across steps', () => {
    const trace = astar(consistentLine(), { startNodeId: 'A', endNodeId: 'D' })
    let prevTotal = 0
    for (const step of trace.steps) {
      expect(step.stats.totalOperations).toBeGreaterThanOrEqual(prevTotal)
      prevTotal = step.stats.totalOperations
    }
  })

  it('throws for an unknown start or end node', () => {
    const g = consistentLine()
    expect(() => astar(g, { startNodeId: 'Z', endNodeId: 'D' })).toThrow()
    expect(() => astar(g, { startNodeId: 'A', endNodeId: 'Z' })).toThrow()
  })
})
