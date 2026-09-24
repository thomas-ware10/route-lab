import { describe, expect, it } from 'vitest'
import { dijkstra } from '../../algorithms/dijkstra'
import type { Graph } from '../../types'
import { deriveVisualState } from '../deriveVisualState'

function line(): Graph {
  return {
    mode: 'undirected',
    nodes: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 1, y: 0, label: 'B' },
      { id: 'C', x: 2, y: 0, label: 'C' },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', weight: 1 },
      { id: 'e2', source: 'B', target: 'C', weight: 1 },
    ],
  }
}

describe('deriveVisualState', () => {
  it('returns empty state for a null trace', () => {
    const state = deriveVisualState(null, 0)
    expect(state.nodes).toEqual({})
    expect(state.edges).toEqual({})
  })

  it('returns empty state at index -1 (before playback starts)', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    const state = deriveVisualState(trace, -1)
    expect(Object.keys(state.nodes)).toHaveLength(0)
  })

  it('accumulates visited nodes as the index advances', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    const firstVisitIndex = trace.steps.findIndex((s) => s.kind === 'visit-node')
    const state = deriveVisualState(trace, firstVisitIndex)
    expect(state.nodes['A']).toBe('visited')
    expect(state.currentNodeId).toBe('A')
  })

  it('marks the final path at the done step', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    const state = deriveVisualState(trace, trace.steps.length - 1)
    expect(state.nodes['A']).toBe('path')
    expect(state.nodes['B']).toBe('path')
    expect(state.nodes['C']).toBe('path')
    expect(state.edges['e1']).toBe('path')
    expect(state.edges['e2']).toBe('path')
  })

  it('clamps an out-of-range index instead of throwing', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    expect(() => deriveVisualState(trace, 9999)).not.toThrow()
    const overshoot = deriveVisualState(trace, 9999)
    const exact = deriveVisualState(trace, trace.steps.length - 1)
    expect(overshoot).toEqual(exact)
  })

  it('is monotonic: state at index i is a superset of visited ids at index i-1', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    let prevNodeIds = new Set<string>()
    for (let i = 0; i < trace.steps.length; i++) {
      const state = deriveVisualState(trace, i)
      const curNodeIds = new Set(Object.keys(state.nodes))
      for (const id of prevNodeIds) expect(curNodeIds.has(id)).toBe(true)
      prevNodeIds = curNodeIds
    }
  })
})
