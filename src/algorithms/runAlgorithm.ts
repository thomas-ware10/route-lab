import type { Graph } from '../types'
import { astar } from './astar'
import type { AlgorithmId } from './complexity'
import { dijkstra } from './dijkstra'
import { kruskal } from './kruskal'
import { prim } from './prim'
import type { Trace } from './types'

export interface RunAlgorithmOptions {
  algorithm: AlgorithmId
  graph: Graph
  startNodeId?: string | null
  endNodeId?: string | null
}

export function requiresEndpoints(algorithm: AlgorithmId): boolean {
  return algorithm === 'dijkstra' || algorithm === 'astar'
}

export function runAlgorithm({ algorithm, graph, startNodeId, endNodeId }: RunAlgorithmOptions): Trace {
  switch (algorithm) {
    case 'dijkstra':
      if (!startNodeId || !endNodeId) throw new Error('Dijkstra requires a start and end node')
      return dijkstra(graph, { startNodeId, endNodeId })
    case 'astar':
      if (!startNodeId || !endNodeId) throw new Error('A* requires a start and end node')
      return astar(graph, { startNodeId, endNodeId })
    case 'kruskal':
      return kruskal(graph)
    case 'prim':
      return prim(graph, { startNodeId: startNodeId ?? undefined })
  }
}
