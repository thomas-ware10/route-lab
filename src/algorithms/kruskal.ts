import type { Graph } from '../types'
import type { Step, Trace } from './types'
import { UnionFind } from './unionFind'
import { StatsTracker } from './statsTracker'

/**
 * Minimum spanning tree via Kruskal's algorithm. MST is only well-defined
 * for undirected graphs, so directed graphs are treated as their underlying
 * undirected graph (edge direction ignored) and a warning is surfaced.
 */
export function kruskal(graph: Graph): Trace {
  const steps: Step[] = []
  const stats = new StatsTracker()
  const warnings: string[] = []

  if (graph.mode === 'directed') {
    warnings.push(
      'Graph is directed; Kruskal’s algorithm ignores edge direction and runs on the underlying undirected graph.',
    )
  }

  const uf = new UnionFind(graph.nodes.map((n) => n.id))
  let prevUfOps = 0
  const flushUf = () => {
    stats.addUnionFindOps(uf.operations - prevUfOps)
    prevUfOps = uf.operations
  }

  const sortedEdges = [...graph.edges].sort((a, b) => a.weight - b.weight)
  stats.addComparisons(sortedEdges.length > 1 ? Math.ceil(sortedEdges.length * Math.log2(sortedEdges.length)) : 0)

  const resultEdgeIds: string[] = []
  let totalCost = 0
  const targetEdgeCount = Math.max(0, graph.nodes.length - 1)

  for (const edge of sortedEdges) {
    stats.addEdgeConsidered()
    steps.push({
      kind: 'consider-edge',
      edgeId: edge.id,
      description: `Considering edge ${edge.id} (${edge.source} – ${edge.target}, weight ${edge.weight})`,
      stats: stats.snapshot(),
    })

    const wouldFormCycle = uf.connected(edge.source, edge.target)
    flushUf()

    if (wouldFormCycle) {
      steps.push({
        kind: 'reject-edge',
        edgeId: edge.id,
        description: `Rejected ${edge.id}: ${edge.source} and ${edge.target} are already connected (would form a cycle)`,
        stats: stats.snapshot(),
      })
      continue
    }

    uf.union(edge.source, edge.target)
    flushUf()
    resultEdgeIds.push(edge.id)
    totalCost += edge.weight
    steps.push({
      kind: 'accept-edge',
      edgeId: edge.id,
      description: `Accepted ${edge.id} into the MST (running cost ${totalCost})`,
      stats: stats.snapshot(),
    })

    if (resultEdgeIds.length === targetEdgeCount) break
  }

  const spansAllNodes = resultEdgeIds.length === targetEdgeCount
  if (!spansAllNodes && graph.nodes.length > 0) {
    warnings.push('Graph is disconnected: Kruskal produced a minimum spanning forest, not a single tree.')
  }

  steps.push({
    kind: 'done',
    success: true,
    resultEdgeIds,
    totalCost,
    description: spansAllNodes
      ? `Minimum spanning tree complete: total cost ${totalCost}`
      : `Minimum spanning forest complete: total cost ${totalCost}`,
    stats: stats.snapshot(),
  })

  return { algorithm: 'kruskal', steps, warnings }
}
