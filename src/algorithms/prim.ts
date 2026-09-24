import { buildAdjacency, otherEnd, type Graph } from '../types'
import type { Step, Trace } from './types'
import { PriorityQueue } from './priorityQueue'
import { StatsTracker } from './statsTracker'

export interface PrimOptions {
  /** Root the growing tree at this node. Defaults to the first node. */
  startNodeId?: string
}

interface FrontierItem {
  edgeId: string
  fromNodeId: string
}

/**
 * Minimum spanning tree via Prim's algorithm. Like Kruskal, MST is only
 * well-defined for undirected graphs; a directed graph is treated as its
 * underlying undirected graph and a warning is surfaced.
 */
export function prim(graph: Graph, options: PrimOptions = {}): Trace {
  const warnings: string[] = []
  if (graph.mode === 'directed') {
    warnings.push(
      'Graph is directed; Prim’s algorithm ignores edge direction and runs on the underlying undirected graph.',
    )
  }

  if (graph.nodes.length === 0) {
    return {
      algorithm: 'prim',
      warnings,
      steps: [
        {
          kind: 'done',
          success: true,
          resultEdgeIds: [],
          totalCost: 0,
          description: 'Graph is empty; nothing to span.',
          stats: { comparisons: 0, edgesConsidered: 0, nodesVisited: 0, priorityQueueOps: 0, unionFindOps: 0, totalOperations: 0 },
        },
      ],
    }
  }

  const startNodeId = options.startNodeId ?? graph.nodes[0].id
  if (!graph.nodes.some((n) => n.id === startNodeId)) {
    throw new Error(`Start node "${startNodeId}" is not in the graph`)
  }

  const steps: Step[] = []
  const stats = new StatsTracker()
  const edgeById = new Map(graph.edges.map((e) => [e.id, e]))
  const adjacency = buildAdjacency(graph)
  const pq = new PriorityQueue<FrontierItem>()
  const visited = new Set<string>()

  let prevPqOps = 0
  let prevPqComparisons = 0
  const flushPq = () => {
    stats.addPriorityQueueOps(pq.operations - prevPqOps)
    stats.addComparisons(pq.comparisons - prevPqComparisons)
    prevPqOps = pq.operations
    prevPqComparisons = pq.comparisons
  }

  const visit = (nodeId: string) => {
    visited.add(nodeId)
    stats.addNodeVisited()
    steps.push({
      kind: 'visit-node',
      nodeId,
      description: `Added ${nodeId} to the tree`,
      stats: stats.snapshot(),
    })
    for (const edge of adjacency.get(nodeId) ?? []) {
      const neighbor = otherEnd(edge, nodeId)
      if (visited.has(neighbor)) continue
      pq.push({ edgeId: edge.id, fromNodeId: nodeId }, edge.weight)
      flushPq()
    }
  }

  visit(startNodeId)

  const resultEdgeIds: string[] = []
  let totalCost = 0

  while (!pq.isEmpty()) {
    const popped = pq.pop()!
    flushPq()
    const edge = edgeById.get(popped.item.edgeId)!
    const outsideNode = otherEnd(edge, popped.item.fromNodeId)

    stats.addEdgeConsidered()
    steps.push({
      kind: 'consider-edge',
      edgeId: edge.id,
      description: `Considering frontier edge ${edge.id} (weight ${edge.weight})`,
      stats: stats.snapshot(),
    })

    if (visited.has(outsideNode)) {
      steps.push({
        kind: 'reject-edge',
        edgeId: edge.id,
        description: `Rejected ${edge.id}: ${outsideNode} is already in the tree`,
        stats: stats.snapshot(),
      })
      continue
    }

    resultEdgeIds.push(edge.id)
    totalCost += edge.weight
    steps.push({
      kind: 'accept-edge',
      edgeId: edge.id,
      description: `Accepted ${edge.id} into the MST (running cost ${totalCost})`,
      stats: stats.snapshot(),
    })

    visit(outsideNode)
  }

  const spansAllNodes = visited.size === graph.nodes.length
  if (!spansAllNodes) {
    warnings.push(
      `Graph is disconnected from ${startNodeId}: Prim only spans the ${visited.size}-node component reachable from the start.`,
    )
  }

  steps.push({
    kind: 'done',
    success: true,
    resultEdgeIds,
    totalCost,
    description: spansAllNodes
      ? `Minimum spanning tree complete: total cost ${totalCost}`
      : `Spanning tree of the reachable component complete: total cost ${totalCost}`,
    stats: stats.snapshot(),
  })

  return { algorithm: 'prim', steps, warnings }
}
