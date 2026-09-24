import { describe, expect, it } from 'vitest'
import { generateRandomGraph, graphDensity, maxUndirectedEdgeCount } from '../randomGraph'

function isConnected(nodeIds: string[], edges: { source: string; target: string }[]): boolean {
  if (nodeIds.length === 0) return true
  const adjacency = new Map<string, string[]>(nodeIds.map((id) => [id, []]))
  for (const e of edges) {
    adjacency.get(e.source)!.push(e.target)
    adjacency.get(e.target)!.push(e.source)
  }
  const seen = new Set<string>([nodeIds[0]])
  const queue = [nodeIds[0]]
  while (queue.length) {
    const cur = queue.pop()!
    for (const next of adjacency.get(cur)!) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return seen.size === nodeIds.length
}

describe('generateRandomGraph', () => {
  it('is always connected regardless of density', () => {
    for (const density of [0, 0.1, 0.5, 1]) {
      const g = generateRandomGraph({ nodeCount: 15, density, seed: 42 })
      expect(isConnected(g.nodes.map((n) => n.id), g.edges)).toBe(true)
    }
  })

  it('is deterministic for a given seed', () => {
    const a = generateRandomGraph({ nodeCount: 10, density: 0.4, seed: 123 })
    const b = generateRandomGraph({ nodeCount: 10, density: 0.4, seed: 123 })
    expect(a).toEqual(b)
  })

  it('produces a different graph for a different seed', () => {
    const a = generateRandomGraph({ nodeCount: 10, density: 0.4, seed: 1 })
    const b = generateRandomGraph({ nodeCount: 10, density: 0.4, seed: 2 })
    expect(a).not.toEqual(b)
  })

  it('has no self-loops or duplicate edges', () => {
    const g = generateRandomGraph({ nodeCount: 20, density: 0.8, seed: 7 })
    expect(g.edges.every((e) => e.source !== e.target)).toBe(true)
    const seen = new Set<string>()
    for (const e of g.edges) {
      const key = [e.source, e.target].sort().join('-')
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('approaches the requested density for a sparse graph', () => {
    const g = generateRandomGraph({ nodeCount: 30, density: 0.1, seed: 5 })
    expect(graphDensity(g)).toBeGreaterThanOrEqual(29 / maxUndirectedEdgeCount(30)) // at least the spanning tree
    expect(graphDensity(g)).toBeLessThan(0.25)
  })

  it('produces the complete graph at density 1', () => {
    const g = generateRandomGraph({ nodeCount: 12, density: 1, seed: 9 })
    expect(g.edges.length).toBe(maxUndirectedEdgeCount(12))
  })

  it('produces a spanning tree (V-1 edges) at density 0', () => {
    const g = generateRandomGraph({ nodeCount: 12, density: 0, seed: 9 })
    expect(g.edges.length).toBe(11)
  })

  it('handles zero and one node without throwing', () => {
    expect(generateRandomGraph({ nodeCount: 0, density: 0.5 }).nodes.length).toBe(0)
    expect(generateRandomGraph({ nodeCount: 1, density: 0.5 }).edges.length).toBe(0)
  })

  it('keeps enough space between node centers to avoid overlap, even at 30 nodes', () => {
    const g = generateRandomGraph({ nodeCount: 30, density: 0.5, seed: 11, width: 900, height: 540 })
    const NODE_DIAMETER = 40 // matches NODE_RADIUS = 20 in graphVisualStyles.ts
    for (let i = 0; i < g.nodes.length; i++) {
      for (let j = i + 1; j < g.nodes.length; j++) {
        const dist = Math.hypot(g.nodes[i].x - g.nodes[j].x, g.nodes[i].y - g.nodes[j].y)
        expect(dist).toBeGreaterThan(NODE_DIAMETER)
      }
    }
  })

  it('places nodes on a circle centered in the canvas', () => {
    const g = generateRandomGraph({ nodeCount: 6, density: 0.3, seed: 4, width: 900, height: 540 })
    const centerX = 450
    const centerY = 270
    const radii = g.nodes.map((n) => Math.hypot(n.x - centerX, n.y - centerY))
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 0)
  })

  it('respects the weight range', () => {
    const g = generateRandomGraph({ nodeCount: 20, density: 0.6, seed: 3, minWeight: 5, maxWeight: 9 })
    for (const e of g.edges) {
      expect(e.weight).toBeGreaterThanOrEqual(5)
      expect(e.weight).toBeLessThanOrEqual(9)
    }
  })
})
