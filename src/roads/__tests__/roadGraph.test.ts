import { describe, expect, it } from 'vitest'
import { astar } from '../../algorithms/astar'
import { dijkstra } from '../../algorithms/dijkstra'
import { isDoneStep } from '../../algorithms/types'
import { buildRoadGraph, largestComponent, nearestNode, roadName, travelDirection } from '../roadGraph'
import { CENTER, P, smallTown, way } from './fixtures'

const hasEdge = (g: ReturnType<typeof buildRoadGraph>['graph'], s: string, t: string) =>
  g.edges.some((e) => e.source === s && e.target === t)

describe('travelDirection', () => {
  it('reads explicit oneway tags', () => {
    expect(travelDirection({ oneway: 'yes' })).toBe('forward')
    expect(travelDirection({ oneway: 'true' })).toBe('forward')
    expect(travelDirection({ oneway: '1' })).toBe('forward')
    expect(travelDirection({ oneway: '-1' })).toBe('backward')
    expect(travelDirection({ oneway: 'no' })).toBe('both')
  })
  it('treats roundabouts and motorways as implicitly one-way', () => {
    expect(travelDirection({ junction: 'roundabout' })).toBe('forward')
    expect(travelDirection({ highway: 'motorway' })).toBe('forward')
  })
  it('lets an explicit oneway=no override the motorway implication', () => {
    expect(travelDirection({ highway: 'motorway', oneway: 'no' })).toBe('both')
  })
  it('defaults to two-way', () => {
    expect(travelDirection({ highway: 'residential' })).toBe('both')
    expect(travelDirection(undefined)).toBe('both')
  })
})

describe('roadName', () => {
  it('prefers "name (ref)", then name, then ref, then a readable fallback', () => {
    expect(roadName({ name: 'Euston Road', ref: 'A501' })).toBe('Euston Road (A501)')
    expect(roadName({ name: 'Baker Street' })).toBe('Baker Street')
    expect(roadName({ ref: 'M25' })).toBe('M25')
    expect(roadName({ highway: 'living_street' })).toBe('unnamed living street')
  })
})

describe('buildRoadGraph', () => {
  it('keeps only junctions and way ends as nodes, dropping mid-road bend points', () => {
    const { graph } = buildRoadGraph(smallTown(), CENTER)
    const ids = graph.nodes.map((n) => n.id).sort()
    expect(ids).toEqual(['n1', 'n20', 'n21', 'n3', 'n4', 'n6'])
  })

  it('splits a way at every junction it passes through', () => {
    const road = buildRoadGraph(smallTown(), CENTER)
    const main = [...road.segments.values()].filter((s) => s.wayId === 101)
    expect(main.map((s) => [s.fromNodeId, s.toNodeId])).toEqual([
      ['n1', 'n3'],
      ['n3', 'n4'],
    ])
    // The bend point (node 2) survives as drawing geometry of the first segment.
    expect(main[0].points).toHaveLength(3)
  })

  it('emits both directions for a two-way street', () => {
    const { graph } = buildRoadGraph(smallTown(), CENTER)
    expect(hasEdge(graph, 'n1', 'n3')).toBe(true)
    expect(hasEdge(graph, 'n3', 'n1')).toBe(true)
  })

  it('emits only the drawn direction for oneway=yes', () => {
    const { graph } = buildRoadGraph(smallTown(), CENTER)
    expect(hasEdge(graph, 'n3', 'n6')).toBe(true)
    expect(hasEdge(graph, 'n6', 'n3')).toBe(false)
  })

  it('emits only the reverse of the drawn direction for oneway=-1', () => {
    const { graph } = buildRoadGraph(smallTown(), CENTER)
    expect(hasEdge(graph, 'n4', 'n6')).toBe(true)
    expect(hasEdge(graph, 'n6', 'n4')).toBe(false)
  })

  it('maps every edge back to the road segment it runs along', () => {
    const road = buildRoadGraph(smallTown(), CENTER)
    expect(road.graph.edges).toHaveLength(8)
    for (const e of road.graph.edges) {
      const seg = road.segments.get(road.edgeSegment.get(e.id)!)!
      expect([seg.fromNodeId, seg.toNodeId].sort()).toEqual([e.source, e.target].sort())
    }
  })

  it('measures the true curved length, and never weights an edge below its straight-line span', () => {
    const road = buildRoadGraph(smallTown(), CENTER)
    for (const e of road.graph.edges) {
      const a = road.graph.nodes.find((n) => n.id === e.source)!
      const b = road.graph.nodes.find((n) => n.id === e.target)!
      expect(e.weight).toBeGreaterThanOrEqual(Math.hypot(a.x - b.x, a.y - b.y))
    }
    // 1->2->3 is ~2 x 69 m of longitude at 51.5 deg N.
    const seg13 = [...road.segments.values()].find((s) => s.fromNodeId === 'n1')!
    expect(seg13.lengthMeters).toBeGreaterThan(130)
    expect(seg13.lengthMeters).toBeLessThan(145)
  })

  it('handles a roundabout (closed way) that meets an approach road', () => {
    const road = buildRoadGraph(
      {
        elements: [
          way(201, [8, 9, 10, 8], { junction: 'roundabout' }),
          way(202, [30, 9], { name: 'Approach' }),
        ],
      },
      CENTER,
    )
    // Node 8 appears twice in the closed way, so it is a junction; 9 is shared.
    expect(hasEdge(road.graph, 'n8', 'n9')).toBe(true)
    expect(hasEdge(road.graph, 'n9', 'n8')).toBe(true) // the long way round, via 10
    expect(hasEdge(road.graph, 'n9', 'n30')).toBe(true)
    // Roundabout is one-way: the 8->9 segment has no 9->8 twin of the same length.
    const roundaboutEdges = road.graph.edges.filter((e) => road.segments.get(road.edgeSegment.get(e.id)!)!.wayId === 201)
    expect(roundaboutEdges).toHaveLength(2)
  })

  it('drops a closed loop that connects to nothing (a self-loop segment)', () => {
    const road = buildRoadGraph({ elements: [way(201, [8, 9, 10, 8], { junction: 'roundabout' })] }, CENTER)
    expect(road.graph.edges).toHaveLength(0)
  })

  it('ignores non-way elements, malformed ways, and duplicate way ids', () => {
    const bad = way(301, [1, 2, 3])
    bad.geometry = bad.geometry.slice(0, 2) // geometry/node count mismatch
    const road = buildRoadGraph(
      {
        elements: [
          { type: 'node' },
          bad,
          way(101, [1, 2, 3, 4], { name: 'Main Street' }),
          way(101, [1, 2, 3, 4], { name: 'Main Street' }),
        ],
      },
      CENTER,
    )
    expect(road.graph.edges).toHaveLength(2)
  })

  it('stores real lat/lng for every node for drawing on the map', () => {
    const road = buildRoadGraph(smallTown(), CENTER)
    expect(road.nodeLatLng.get('n4')).toEqual({ lat: P[4][0], lng: P[4][1] })
  })
})

describe('routing on a built road graph', () => {
  it('dijkstra respects one-way streets (must go round via Back Lane, not up Side Road backwards)', () => {
    const road = buildRoadGraph(smallTown(), CENTER)
    // 6 -> 3 is only possible the long way: 6 can't go down Side Road (one-way north)
    // and can't take Back Lane 6->4 (it flows 4->6), so 6 is a dead end for leaving.
    const fromSix = dijkstra(road.graph, { startNodeId: 'n6', endNodeId: 'n3' }).steps.find(isDoneStep)!
    expect(fromSix.success).toBe(false)
    const toSix = dijkstra(road.graph, { startNodeId: 'n1', endNodeId: 'n6' }).steps.find(isDoneStep)!
    expect(toSix.success).toBe(true)
  })

  it('A* on a road graph raises no inadmissible-heuristic warnings (weights are true path lengths)', () => {
    const road = buildRoadGraph(smallTown(), CENTER)
    const trace = astar(road.graph, { startNodeId: 'n1', endNodeId: 'n6' })
    expect(trace.warnings).toEqual([])
  })
})

describe('largestComponent / nearestNode', () => {
  it('finds the main network and excludes the disconnected fragment', () => {
    const road = buildRoadGraph(smallTown(), CENTER)
    const main = largestComponent(road.graph)
    expect([...main].sort()).toEqual(['n1', 'n3', 'n4', 'n6'])
  })

  it('snaps to the nearest node overall', () => {
    const road = buildRoadGraph(smallTown(), CENTER)
    const snap = nearestNode(road, { lat: 51.52, lng: -0.1195 })!
    expect(['n20', 'n21']).toContain(snap.nodeId)
  })

  it('snaps into the allowed component even when a fragment is closer', () => {
    const road = buildRoadGraph(smallTown(), CENTER)
    const snap = nearestNode(road, { lat: 51.52, lng: -0.1195 }, largestComponent(road.graph))!
    expect(['n1', 'n3', 'n4', 'n6']).toContain(snap.nodeId)
    expect(snap.distanceMeters).toBeGreaterThan(1000)
  })

  it('returns null on an empty graph', () => {
    const road = buildRoadGraph({ elements: [] }, CENTER)
    expect(nearestNode(road, CENTER)).toBeNull()
  })
})
