import { create } from 'zustand'
import { createEmptyGraph, type Graph, type GraphMode } from '../types'

let idCounter = 0
/** Exposed for tests so ids are predictable across runs. */
export function resetGraphIdCounter(): void {
  idCounter = 0
}
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}${idCounter}`
}

interface GraphState {
  graph: Graph
  startNodeId: string | null
  endNodeId: string | null
  /** True while a trace is playing back; the editor UI should disable mutation. */
  locked: boolean

  addNode: (x: number, y: number) => string
  moveNode: (id: string, x: number, y: number) => void
  removeNode: (id: string) => void
  /** Returns the new edge id, or null if the edge is invalid (self-loop or duplicate). */
  addEdge: (source: string, target: string, weight: number) => string | null
  updateEdgeWeight: (id: string, weight: number) => void
  removeEdge: (id: string) => void
  setMode: (mode: GraphMode) => void
  setStartNode: (id: string | null) => void
  setEndNode: (id: string | null) => void
  setLocked: (locked: boolean) => void
  loadGraph: (graph: Graph) => void
  clearGraph: () => void
}

function edgeExists(graph: Graph, source: string, target: string): boolean {
  return graph.edges.some((e) => {
    if (e.source === source && e.target === target) return true
    if (graph.mode === 'undirected' && e.source === target && e.target === source) return true
    return false
  })
}

export const useGraphStore = create<GraphState>((set, get) => ({
  graph: createEmptyGraph(),
  startNodeId: null,
  endNodeId: null,
  locked: false,

  addNode: (x, y) => {
    const id = nextId('n')
    const label = id.replace('n', '')
    set((state) => ({
      graph: { ...state.graph, nodes: [...state.graph.nodes, { id, x, y, label }] },
    }))
    return id
  },

  moveNode: (id, x, y) => {
    set((state) => ({
      graph: {
        ...state.graph,
        nodes: state.graph.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
      },
    }))
  },

  removeNode: (id) => {
    set((state) => ({
      graph: {
        ...state.graph,
        nodes: state.graph.nodes.filter((n) => n.id !== id),
        edges: state.graph.edges.filter((e) => e.source !== id && e.target !== id),
      },
      startNodeId: state.startNodeId === id ? null : state.startNodeId,
      endNodeId: state.endNodeId === id ? null : state.endNodeId,
    }))
  },

  addEdge: (source, target, weight) => {
    if (source === target) return null
    const graph = get().graph
    if (edgeExists(graph, source, target)) return null
    const id = nextId('e')
    set((state) => ({
      graph: { ...state.graph, edges: [...state.graph.edges, { id, source, target, weight }] },
    }))
    return id
  },

  updateEdgeWeight: (id, weight) => {
    set((state) => ({
      graph: {
        ...state.graph,
        edges: state.graph.edges.map((e) => (e.id === id ? { ...e, weight } : e)),
      },
    }))
  },

  removeEdge: (id) => {
    set((state) => ({
      graph: { ...state.graph, edges: state.graph.edges.filter((e) => e.id !== id) },
    }))
  },

  setMode: (mode) => set((state) => ({ graph: { ...state.graph, mode } })),
  setStartNode: (id) => set({ startNodeId: id }),
  setEndNode: (id) => set({ endNodeId: id }),
  setLocked: (locked) => set({ locked }),

  loadGraph: (graph) => set({ graph, startNodeId: null, endNodeId: null }),

  clearGraph: () =>
    set((state) => ({
      graph: createEmptyGraph(state.graph.mode),
      startNodeId: null,
      endNodeId: null,
    })),
}))
