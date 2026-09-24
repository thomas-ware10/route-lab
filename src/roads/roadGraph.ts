import { UnionFind } from '../algorithms/unionFind'
import type { Graph, GraphEdge, GraphNode } from '../types'
import { makeProjection, type LatLng, type Projection } from './geo'
import type { OverpassResponse, OverpassWay } from './overpass'

/** One stretch of road between two junctions, drawn with its real curve. */
export interface RoadSegment {
  id: string
  wayId: number
  name: string
  highway: string
  /** Full shape in the way's own drawing order, from fromNodeId to toNodeId. */
  points: LatLng[]
  lengthMeters: number
  fromNodeId: string
  toNodeId: string
  direction: TravelDirection
}

export type TravelDirection = 'both' | 'forward' | 'backward'

export interface RoadGraph {
  /** Always directed: a two-way street is two opposite edges, a one-way street one. */
  graph: Graph
  segments: Map<string, RoadSegment>
  edgeSegment: Map<string, string>
  nodeLatLng: Map<string, LatLng>
  projection: Projection
}

/**
 * OSM's oneway conventions, including the implied cases: roundabouts and
 * motorways are one-way unless tagged otherwise.
 */
export function travelDirection(tags: Record<string, string> = {}): TravelDirection {
  const oneway = tags.oneway?.toLowerCase()
  if (oneway === 'yes' || oneway === 'true' || oneway === '1') return 'forward'
  if (oneway === '-1' || oneway === 'reverse') return 'backward'
  if (oneway === 'no' || oneway === 'false' || oneway === '0') return 'both'
  if (tags.junction === 'roundabout' || tags.junction === 'circular') return 'forward'
  if (tags.highway === 'motorway') return 'forward'
  return 'both'
}

export function roadName(tags: Record<string, string> = {}): string {
  const { name, ref, highway } = tags
  if (name && ref) return `${name} (${ref})`
  if (name) return name
  if (ref) return ref
  return `unnamed ${(highway ?? 'road').replace(/_/g, ' ')}`
}

function isUsableWay(el: { type: string }): el is OverpassWay {
  const way = el as OverpassWay
  return (
    el.type === 'way' &&
    Array.isArray(way.nodes) &&
    Array.isArray(way.geometry) &&
    way.nodes.length >= 2 &&
    way.nodes.length === way.geometry.length &&
    way.geometry.every((p) => p && typeof p.lat === 'number' && typeof p.lon === 'number')
  )
}

/**
 * Collapses OSM ways into a routing graph. OSM stores a point at every bend of
 * a road; routing only needs the points where a choice exists. A point becomes a
 * graph node if it is the end of a way or is shared by more than one way (or
 * appears twice in the same way, e.g. where a closed loop meets itself). Every
 * other point is kept only as drawing geometry and to measure the segment's true
 * curved length.
 */
export function buildRoadGraph(response: OverpassResponse, center: LatLng): RoadGraph {
  const projection = makeProjection(center)

  const seenWays = new Set<number>()
  const ways: OverpassWay[] = []
  for (const el of response.elements) {
    if (!isUsableWay(el) || seenWays.has(el.id)) continue
    seenWays.add(el.id)
    ways.push(el)
  }

  const usage = new Map<number, number>()
  for (const way of ways) {
    for (const id of way.nodes) usage.set(id, (usage.get(id) ?? 0) + 1)
  }

  const nodes = new Map<string, GraphNode>()
  const nodeLatLng = new Map<string, LatLng>()
  const segments = new Map<string, RoadSegment>()
  const edgeSegment = new Map<string, string>()
  const edges: GraphEdge[] = []
  let segmentCounter = 0
  let edgeCounter = 0

  const ensureNode = (osmId: number, p: LatLng): string => {
    const id = `n${osmId}`
    if (!nodes.has(id)) {
      const { x, y } = projection.toXY(p)
      nodes.set(id, { id, x, y, label: '' })
      nodeLatLng.set(id, p)
    }
    return id
  }

  for (const way of ways) {
    const tags = way.tags ?? {}
    const direction = travelDirection(tags)
    const name = roadName(tags)
    const highway = tags.highway ?? 'road'
    const points = way.geometry.map((g) => ({ lat: g.lat, lng: g.lon }))
    const last = way.nodes.length - 1

    let startIndex = 0
    for (let i = 1; i <= last; i++) {
      const isJunction = i === last || (usage.get(way.nodes[i]) ?? 0) >= 2
      if (!isJunction) continue

      const fromOsm = way.nodes[startIndex]
      const toOsm = way.nodes[i]
      const shape = points.slice(startIndex, i + 1)
      startIndex = i
      // A stretch that starts and ends at the same point can never help a route.
      if (fromOsm === toOsm) continue

      let length = 0
      for (let k = 1; k < shape.length; k++) {
        const a = projection.toXY(shape[k - 1])
        const b = projection.toXY(shape[k])
        length += Math.hypot(b.x - a.x, b.y - a.y)
      }

      const fromNodeId = ensureNode(fromOsm, shape[0])
      const toNodeId = ensureNode(toOsm, shape[shape.length - 1])
      const segmentId = `s${segmentCounter++}`
      segments.set(segmentId, { id: segmentId, wayId: way.id, name, highway, points: shape, lengthMeters: length, fromNodeId, toNodeId, direction })

      // Rounding UP to whole meters keeps weights readable while preserving the
      // "never shorter than the straight line" property A* relies on.
      const weight = Math.max(1, Math.ceil(length))
      if (direction === 'both' || direction === 'forward') {
        const id = `e${edgeCounter++}`
        edges.push({ id, source: fromNodeId, target: toNodeId, weight })
        edgeSegment.set(id, segmentId)
      }
      if (direction === 'both' || direction === 'backward') {
        const id = `e${edgeCounter++}`
        edges.push({ id, source: toNodeId, target: fromNodeId, weight })
        edgeSegment.set(id, segmentId)
      }
    }
  }

  return {
    graph: { mode: 'directed', nodes: [...nodes.values()], edges },
    segments,
    edgeSegment,
    nodeLatLng,
    projection,
  }
}

/**
 * Node ids of the largest weakly connected piece of the network. The downloaded
 * box always contains stray fragments (a road clipped at the box edge, a private
 * estate), and snapping a postcode onto one would make every route "not found".
 */
export function largestComponent(graph: Graph): Set<string> {
  const uf = new UnionFind(graph.nodes.map((n) => n.id))
  for (const e of graph.edges) uf.union(e.source, e.target)
  const sizes = new Map<string, number>()
  for (const n of graph.nodes) {
    const root = uf.find(n.id)
    sizes.set(root, (sizes.get(root) ?? 0) + 1)
  }
  let bestRoot: string | null = null
  let bestSize = 0
  for (const [root, size] of sizes) {
    if (size > bestSize) {
      bestRoot = root
      bestSize = size
    }
  }
  return new Set(graph.nodes.filter((n) => uf.find(n.id) === bestRoot).map((n) => n.id))
}

export interface SnapResult {
  nodeId: string
  distanceMeters: number
}

/** Nearest graph node to a real-world point, optionally restricted to an allowed set. */
export function nearestNode(road: RoadGraph, point: LatLng, allowed?: Set<string>): SnapResult | null {
  const { x, y } = road.projection.toXY(point)
  let best: SnapResult | null = null
  for (const node of road.graph.nodes) {
    if (allowed && !allowed.has(node.id)) continue
    const d = Math.hypot(node.x - x, node.y - y)
    if (!best || d < best.distanceMeters) best = { nodeId: node.id, distanceMeters: d }
  }
  return best
}
