import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyGraph } from '../../types'
import { resetGraphIdCounter, useGraphStore } from '../graphStore'

beforeEach(() => {
  resetGraphIdCounter()
  useGraphStore.setState({ graph: createEmptyGraph(), startNodeId: null, endNodeId: null, locked: false })
})

describe('graphStore', () => {
  it('adds nodes with generated ids and given coordinates', () => {
    const id = useGraphStore.getState().addNode(10, 20)
    const node = useGraphStore.getState().graph.nodes.find((n) => n.id === id)
    expect(node).toMatchObject({ x: 10, y: 20 })
  })

  it('moves a node', () => {
    const id = useGraphStore.getState().addNode(0, 0)
    useGraphStore.getState().moveNode(id, 50, 60)
    const node = useGraphStore.getState().graph.nodes.find((n) => n.id === id)
    expect(node).toMatchObject({ x: 50, y: 60 })
  })

  it('removes a node and its incident edges', () => {
    const a = useGraphStore.getState().addNode(0, 0)
    const b = useGraphStore.getState().addNode(1, 1)
    useGraphStore.getState().addEdge(a, b, 5)
    useGraphStore.getState().removeNode(a)
    const state = useGraphStore.getState()
    expect(state.graph.nodes.find((n) => n.id === a)).toBeUndefined()
    expect(state.graph.edges).toHaveLength(0)
  })

  it('clears start/end selection when the selected node is removed', () => {
    const a = useGraphStore.getState().addNode(0, 0)
    useGraphStore.getState().setStartNode(a)
    useGraphStore.getState().removeNode(a)
    expect(useGraphStore.getState().startNodeId).toBeNull()
  })

  it('rejects self-loop edges', () => {
    const a = useGraphStore.getState().addNode(0, 0)
    const result = useGraphStore.getState().addEdge(a, a, 1)
    expect(result).toBeNull()
    expect(useGraphStore.getState().graph.edges).toHaveLength(0)
  })

  it('rejects duplicate edges in undirected mode regardless of order', () => {
    const a = useGraphStore.getState().addNode(0, 0)
    const b = useGraphStore.getState().addNode(1, 1)
    useGraphStore.getState().addEdge(a, b, 5)
    const dup = useGraphStore.getState().addEdge(b, a, 7)
    expect(dup).toBeNull()
    expect(useGraphStore.getState().graph.edges).toHaveLength(1)
  })

  it('allows both directions as distinct edges in directed mode', () => {
    useGraphStore.getState().setMode('directed')
    const a = useGraphStore.getState().addNode(0, 0)
    const b = useGraphStore.getState().addNode(1, 1)
    useGraphStore.getState().addEdge(a, b, 5)
    const reverse = useGraphStore.getState().addEdge(b, a, 7)
    expect(reverse).not.toBeNull()
    expect(useGraphStore.getState().graph.edges).toHaveLength(2)
  })

  it('updates an edge weight', () => {
    const a = useGraphStore.getState().addNode(0, 0)
    const b = useGraphStore.getState().addNode(1, 1)
    const edgeId = useGraphStore.getState().addEdge(a, b, 5)!
    useGraphStore.getState().updateEdgeWeight(edgeId, 42)
    expect(useGraphStore.getState().graph.edges[0].weight).toBe(42)
  })

  it('removes an edge without touching its nodes', () => {
    const a = useGraphStore.getState().addNode(0, 0)
    const b = useGraphStore.getState().addNode(1, 1)
    const edgeId = useGraphStore.getState().addEdge(a, b, 5)!
    useGraphStore.getState().removeEdge(edgeId)
    const state = useGraphStore.getState()
    expect(state.graph.edges).toHaveLength(0)
    expect(state.graph.nodes).toHaveLength(2)
  })

  it('clearGraph empties nodes/edges but keeps the current mode', () => {
    useGraphStore.getState().setMode('directed')
    useGraphStore.getState().addNode(0, 0)
    useGraphStore.getState().clearGraph()
    const state = useGraphStore.getState()
    expect(state.graph.nodes).toHaveLength(0)
    expect(state.graph.mode).toBe('directed')
  })
})
