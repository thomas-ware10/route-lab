export interface GraphNode {
  id: string
  x: number
  y: number
  label: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  weight: number
}

export type GraphMode = 'undirected' | 'directed'

export interface Graph {
  mode: GraphMode
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export function createEmptyGraph(mode: GraphMode = 'undirected'): Graph {
  return { mode, nodes: [], edges: [] }
}

/** Edges reachable from `nodeId` respecting graph directionality. */
export function outgoingEdges(graph: Graph, nodeId: string): GraphEdge[] {
  return graph.edges.filter((e) => {
    if (e.source === nodeId) return true
    if (graph.mode === 'undirected' && e.target === nodeId) return true
    return false
  })
}

/** The neighbor-side node id of an edge, relative to `fromNodeId`. */
export function otherEnd(edge: GraphEdge, fromNodeId: string): string {
  return edge.source === fromNodeId ? edge.target : edge.source
}
