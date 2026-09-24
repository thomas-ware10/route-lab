import type { Graph, GraphNode } from '../types'

export function euclideanDistance(a: GraphNode, b: GraphNode): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Checks the consistency condition h(u) <= w(u, v) + h(v) for every edge.
 * A consistent heuristic (relative to a fixed goal) is always admissible,
 * so this is the practical, O(E) check we run before A* rather than trying
 * to prove admissibility directly.
 */
export function findInadmissibleHeuristicWarning(
  graph: Graph,
  heuristic: (nodeId: string) => number,
): string[] {
  const warnings: string[] = []
  for (const edge of graph.edges) {
    const hSource = heuristic(edge.source)
    const hTarget = heuristic(edge.target)
    // undirected: check both directions; directed: only source -> target
    if (hSource > edge.weight + hTarget + 1e-9) {
      warnings.push(
        `Heuristic may be inadmissible: h(${edge.source})=${hSource.toFixed(2)} exceeds ` +
          `edge ${edge.id} weight (${edge.weight}) + h(${edge.target})=${hTarget.toFixed(2)}. ` +
          `A* may not find the true shortest path.`,
      )
    }
    if (graph.mode === 'undirected' && hTarget > edge.weight + hSource + 1e-9) {
      warnings.push(
        `Heuristic may be inadmissible: h(${edge.target})=${hTarget.toFixed(2)} exceeds ` +
          `edge ${edge.id} weight (${edge.weight}) + h(${edge.source})=${hSource.toFixed(2)}. ` +
          `A* may not find the true shortest path.`,
      )
    }
  }
  if (warnings.length > 4) {
    return [
      ...warnings.slice(0, 3),
      `...and ${warnings.length - 3} more edge(s) with a possibly-inadmissible heuristic.`,
    ]
  }
  return warnings
}
