import { describe, expect, it } from 'vitest'
import type { Graph } from '../../types'
import { runAlgorithm } from '../runAlgorithm'
import { isDoneStep } from '../types'

function triangle(): Graph {
  return {
    mode: 'undirected',
    nodes: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 1, y: 0, label: 'B' },
      { id: 'C', x: 0, y: 1, label: 'C' },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', weight: 1 },
      { id: 'e2', source: 'B', target: 'C', weight: 1 },
      { id: 'e3', source: 'A', target: 'C', weight: 1 },
    ],
  }
}

describe('runAlgorithm', () => {
  it('dispatches to dijkstra', () => {
    const trace = runAlgorithm({ algorithm: 'dijkstra', graph: triangle(), startNodeId: 'A', endNodeId: 'C' })
    expect(trace.algorithm).toBe('dijkstra')
    expect(trace.steps.find(isDoneStep)?.success).toBe(true)
  })

  it('dispatches to astar', () => {
    const trace = runAlgorithm({ algorithm: 'astar', graph: triangle(), startNodeId: 'A', endNodeId: 'C' })
    expect(trace.algorithm).toBe('astar')
  })

  it('dispatches to kruskal without requiring endpoints', () => {
    const trace = runAlgorithm({ algorithm: 'kruskal', graph: triangle() })
    expect(trace.algorithm).toBe('kruskal')
  })

  it('dispatches to prim, using startNodeId as the root when given', () => {
    const trace = runAlgorithm({ algorithm: 'prim', graph: triangle(), startNodeId: 'B' })
    expect(trace.algorithm).toBe('prim')
    expect(trace.steps[0]).toMatchObject({ kind: 'visit-node', nodeId: 'B' })
  })

  it('throws for dijkstra/astar without start or end node', () => {
    expect(() => runAlgorithm({ algorithm: 'dijkstra', graph: triangle() })).toThrow()
    expect(() => runAlgorithm({ algorithm: 'astar', graph: triangle(), startNodeId: 'A' })).toThrow()
  })
})
