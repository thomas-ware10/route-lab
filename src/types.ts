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

/**
 * Precomputed node -> outgoing-edges index. Algorithms should build this once
 * rather than calling outgoingEdges() per node, which scans every edge and makes
 * a search O(V*E) — fine for hand-drawn graphs, unusable on real road networks.
 * Edge order per node matches graph.edges order, so results are identical.
 */
export function buildAdjacency(graph: Graph): Map<string, GraphEdge[]> {
  const adjacency = new Map<string, GraphEdge[]>()
  const push = (nodeId: string, edge: GraphEdge) => {
    const list = adjacency.get(nodeId)
    if (list) list.push(edge)
    else adjacency.set(nodeId, [edge])
  }
  for (const edge of graph.edges) {
    push(edge.source, edge)
    if (graph.mode === 'undirected' && edge.target !== edge.source) push(edge.target, edge)
  }
  return adjacency
}

/** The neighbor-side node id of an edge, relative to `fromNodeId`. */
export function otherEnd(edge: GraphEdge, fromNodeId: string): string {
  return edge.source === fromNodeId ? edge.target : edge.source
}
