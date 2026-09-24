import { outgoingEdges, otherEnd, type Graph } from '../types'
import type { Step, Trace } from './types'
import { PriorityQueue } from './priorityQueue'
import { StatsTracker } from './statsTracker'

export interface ShortestPathOptions {
  startNodeId: string
  endNodeId: string
}

export function findNegativeWeightWarning(graph: Graph): string[] {
  const negativeEdge = graph.edges.find((e) => e.weight < 0)
  if (!negativeEdge) return []
  return [
    `Edge ${negativeEdge.id} has a negative weight (${negativeEdge.weight}). Dijkstra assumes non-negative weights, so the result may be incorrect.`,
  ]
}

export function dijkstra(graph: Graph, options: ShortestPathOptions): Trace {
  const { startNodeId, endNodeId } = options
  if (!graph.nodes.some((n) => n.id === startNodeId)) {
    throw new Error(`Start node "${startNodeId}" is not in the graph`)
  }
  if (!graph.nodes.some((n) => n.id === endNodeId)) {
    throw new Error(`End node "${endNodeId}" is not in the graph`)
  }

  const steps: Step[] = []
  const stats = new StatsTracker()
  const pq = new PriorityQueue<string>()

  const dist = new Map<string, number>()
  const prevEdge = new Map<string, string>()
  const prevNode = new Map<string, string>()
  const finalized = new Set<string>()

  for (const n of graph.nodes) dist.set(n.id, Infinity)
  dist.set(startNodeId, 0)

  let prevPqOps = 0
  let prevPqComparisons = 0
  const flushPq = () => {
    stats.addPriorityQueueOps(pq.operations - prevPqOps)
    stats.addComparisons(pq.comparisons - prevPqComparisons)
    prevPqOps = pq.operations
    prevPqComparisons = pq.comparisons
  }

  pq.push(startNodeId, 0)
  flushPq()

  let success = false

  while (!pq.isEmpty()) {
    const popped = pq.pop()!
    flushPq()
    const nodeId = popped.item
    if (finalized.has(nodeId)) continue

    finalized.add(nodeId)
    stats.addNodeVisited()
    steps.push({
      kind: 'visit-node',
      nodeId,
      description: `Visiting ${nodeId} (current best distance ${dist.get(nodeId)})`,
      stats: stats.snapshot(),
    })

    for (const edge of outgoingEdges(graph, nodeId)) {
      const neighbor = otherEnd(edge, nodeId)
      if (finalized.has(neighbor)) continue

      stats.addEdgeConsidered()
      steps.push({
        kind: 'consider-edge',
        edgeId: edge.id,
        description: `Considering edge ${edge.id} (${nodeId} → ${neighbor}, weight ${edge.weight})`,
        stats: stats.snapshot(),
      })

      const newDist = dist.get(nodeId)! + edge.weight
      stats.addComparisons(1)
      if (newDist < dist.get(neighbor)!) {
        dist.set(neighbor, newDist)
        prevEdge.set(neighbor, edge.id)
        prevNode.set(neighbor, nodeId)
        pq.push(neighbor, newDist)
        flushPq()
        steps.push({
          kind: 'relax-edge',
          edgeId: edge.id,
          description: `Relaxed ${neighbor}: new best distance ${newDist}`,
          stats: stats.snapshot(),
        })
      } else {
        steps.push({
          kind: 'reject-edge',
          edgeId: edge.id,
          description: `No improvement via ${edge.id} (${newDist} ≥ ${dist.get(neighbor)})`,
          stats: stats.snapshot(),
        })
      }
    }

    steps.push({
      kind: 'finalize-node',
      nodeId,
      description: `Finalized ${nodeId} with distance ${dist.get(nodeId)}`,
      stats: stats.snapshot(),
    })

    if (nodeId === endNodeId) {
      success = true
      break
    }
  }

  const resultEdgeIds: string[] = []
  const resultPathNodeIds: string[] = []
  if (success) {
    let cur: string | undefined = endNodeId
    while (cur && cur !== startNodeId) {
      resultPathNodeIds.unshift(cur)
      const e = prevEdge.get(cur)
      if (e) resultEdgeIds.unshift(e)
      cur = prevNode.get(cur)
    }
    resultPathNodeIds.unshift(startNodeId)
  }

  steps.push({
    kind: 'done',
    success,
    resultEdgeIds,
    resultPathNodeIds: success ? resultPathNodeIds : undefined,
    totalCost: success ? dist.get(endNodeId) : undefined,
    description: success
      ? `Shortest path found: cost ${dist.get(endNodeId)}`
      : `No path exists from ${startNodeId} to ${endNodeId}`,
    stats: stats.snapshot(),
  })

  return { algorithm: 'dijkstra', steps, warnings: findNegativeWeightWarning(graph) }
}
