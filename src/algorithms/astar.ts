import { outgoingEdges, otherEnd, type Graph } from '../types'
import type { Step, Trace } from './types'
import { PriorityQueue } from './priorityQueue'
import { StatsTracker } from './statsTracker'
import { euclideanDistance, findInadmissibleHeuristicWarning } from './heuristic'
import { findNegativeWeightWarning } from './dijkstra'

export interface ShortestPathOptions {
  startNodeId: string
  endNodeId: string
}

export function astar(graph: Graph, options: ShortestPathOptions): Trace {
  const { startNodeId, endNodeId } = options
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  if (!nodeById.has(startNodeId)) {
    throw new Error(`Start node "${startNodeId}" is not in the graph`)
  }
  if (!nodeById.has(endNodeId)) {
    throw new Error(`End node "${endNodeId}" is not in the graph`)
  }

  const goal = nodeById.get(endNodeId)!
  const heuristic = (nodeId: string) => euclideanDistance(nodeById.get(nodeId)!, goal)

  const steps: Step[] = []
  const stats = new StatsTracker()
  const pq = new PriorityQueue<string>()

  const gScore = new Map<string, number>()
  const prevEdge = new Map<string, string>()
  const prevNode = new Map<string, string>()
  const finalized = new Set<string>()

  for (const n of graph.nodes) gScore.set(n.id, Infinity)
  gScore.set(startNodeId, 0)

  let prevPqOps = 0
  let prevPqComparisons = 0
  const flushPq = () => {
    stats.addPriorityQueueOps(pq.operations - prevPqOps)
    stats.addComparisons(pq.comparisons - prevPqComparisons)
    prevPqOps = pq.operations
    prevPqComparisons = pq.comparisons
  }

  pq.push(startNodeId, heuristic(startNodeId))
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
      description: `Visiting ${nodeId} (g=${gScore.get(nodeId)}, h=${heuristic(nodeId).toFixed(2)})`,
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

      const tentativeG = gScore.get(nodeId)! + edge.weight
      stats.addComparisons(1)
      if (tentativeG < gScore.get(neighbor)!) {
        gScore.set(neighbor, tentativeG)
        prevEdge.set(neighbor, edge.id)
        prevNode.set(neighbor, nodeId)
        const f = tentativeG + heuristic(neighbor)
        pq.push(neighbor, f)
        flushPq()
        steps.push({
          kind: 'relax-edge',
          edgeId: edge.id,
          description: `Relaxed ${neighbor}: g=${tentativeG}, f=${f.toFixed(2)}`,
          stats: stats.snapshot(),
        })
      } else {
        steps.push({
          kind: 'reject-edge',
          edgeId: edge.id,
          description: `No improvement via ${edge.id} (${tentativeG} ≥ ${gScore.get(neighbor)})`,
          stats: stats.snapshot(),
        })
      }
    }

    steps.push({
      kind: 'finalize-node',
      nodeId,
      description: `Finalized ${nodeId} with g=${gScore.get(nodeId)}`,
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
    totalCost: success ? gScore.get(endNodeId) : undefined,
    description: success
      ? `Shortest path found: cost ${gScore.get(endNodeId)}`
      : `No path exists from ${startNodeId} to ${endNodeId}`,
    stats: stats.snapshot(),
  })

  const warnings = [
    ...findNegativeWeightWarning(graph),
    ...findInadmissibleHeuristicWarning(graph, endNodeId, heuristic),
  ]

  return { algorithm: 'astar', steps, warnings }
}
