import type { Graph, GraphEdge, GraphMode, GraphNode } from '../types'

export interface RandomGraphOptions {
  nodeCount: number
  /** 0..1 fraction of the maximum possible (undirected) edge count. */
  density: number
  mode?: GraphMode
  seed?: number
  width?: number
  height?: number
  minWeight?: number
  maxWeight?: number
}

/** Deterministic PRNG (mulberry32) so a seed reproduces the same graph. */
function seededRandom(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export const maxUndirectedEdgeCount = (nodeCount: number): number => (nodeCount * (nodeCount - 1)) / 2

export function graphDensity(graph: Graph): number {
  const max = maxUndirectedEdgeCount(graph.nodes.length)
  return max > 0 ? graph.edges.length / max : 0
}

/**
 * Generates a random graph that is always connected: a random spanning tree
 * is built first (so every algorithm demo has a reachable target), then
 * additional random edges are added up to the requested density.
 */
export function generateRandomGraph(options: RandomGraphOptions): Graph {
  const {
    nodeCount,
    density,
    mode = 'undirected',
    seed = Date.now(),
    width = 800,
    height = 500,
    minWeight = 1,
    maxWeight = 20,
  } = options

  if (nodeCount < 0) throw new Error('nodeCount must be >= 0')
  if (minWeight > maxWeight) throw new Error('minWeight must be <= maxWeight')

  const clampedDensity = Math.min(1, Math.max(0, density))
  const rand = seededRandom(seed)
  const randomWeight = () => Math.round(minWeight + rand() * (maxWeight - minWeight))

  // Nodes are placed evenly around a circle rather than scattered randomly: with
  // random placement, higher node counts (up to 30) would frequently overlap or
  // cross each other in confusing ways. A circle guarantees consistent minimum
  // spacing between every pair of nodes for any count in the supported range.
  const centerX = width / 2
  const centerY = height / 2
  const padding = 50
  const layoutRadius = Math.max(10, Math.min(width, height) / 2 - padding)
  const nodes: GraphNode[] = Array.from({ length: nodeCount }, (_, i) => {
    const angle = nodeCount > 1 ? (2 * Math.PI * i) / nodeCount - Math.PI / 2 : 0
    return {
      id: `n${i}`,
      label: `${i}`,
      x: Math.round(centerX + layoutRadius * Math.cos(angle)),
      y: Math.round(centerY + layoutRadius * Math.sin(angle)),
    }
  })

  if (nodeCount <= 1) {
    return { mode, nodes, edges: [] }
  }

  const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)
  const usedPairs = new Set<string>()
  const edges: GraphEdge[] = []
  let edgeIdCounter = 0

  // Random spanning tree: shuffle node order, then attach each node to a
  // random earlier one in the shuffled order. Guarantees connectivity
  // without biasing the "hub" toward node 0.
  const order = Array.from({ length: nodeCount }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  for (let k = 1; k < order.length; k++) {
    const child = order[k]
    const parent = order[Math.floor(rand() * k)]
    usedPairs.add(pairKey(parent, child))
    edges.push({
      id: `e${edgeIdCounter++}`,
      source: nodes[parent].id,
      target: nodes[child].id,
      weight: randomWeight(),
    })
  }

  const targetEdgeCount = Math.round(clampedDensity * maxUndirectedEdgeCount(nodeCount))
  const remainingSlots = Math.max(0, targetEdgeCount - edges.length)

  if (remainingSlots > 0) {
    const remainingPairs: [number, number][] = []
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (!usedPairs.has(pairKey(i, j))) remainingPairs.push([i, j])
      }
    }
    for (let i = remainingPairs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[remainingPairs[i], remainingPairs[j]] = [remainingPairs[j], remainingPairs[i]]
    }
    for (const [a, b] of remainingPairs.slice(0, remainingSlots)) {
      edges.push({
        id: `e${edgeIdCounter++}`,
        source: nodes[a].id,
        target: nodes[b].id,
        weight: randomWeight(),
      })
    }
  }

  return { mode, nodes, edges }
}
