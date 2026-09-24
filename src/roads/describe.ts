import type { Step } from '../algorithms/types'
import { formatDistance } from './geo'
import type { RoadGraph } from './roadGraph'

const nodeNamesCache = new WeakMap<RoadGraph, Map<string, string[]>>()

/** Distinct road names meeting at each junction, e.g. ["Baker Street", "Marylebone Road"]. */
export function roadNamesAtNodes(road: RoadGraph): Map<string, string[]> {
  const cached = nodeNamesCache.get(road)
  if (cached) return cached
  const names = new Map<string, Set<string>>()
  const add = (nodeId: string, name: string) => {
    let set = names.get(nodeId)
    if (!set) names.set(nodeId, (set = new Set()))
    set.add(name)
  }
  for (const seg of road.segments.values()) {
    add(seg.fromNodeId, seg.name)
    add(seg.toNodeId, seg.name)
  }
  const result = new Map([...names].map(([id, set]) => [id, [...set]]))
  nodeNamesCache.set(road, result)
  return result
}

function junctionName(road: RoadGraph, nodeId: string): string {
  const names = (roadNamesAtNodes(road).get(nodeId) ?? []).filter((n) => !n.startsWith('unnamed'))
  if (names.length === 0) return 'an unnamed junction'
  if (names.length === 1) return names[0]
  return `${names[0]} / ${names[1]}`
}

export function routeLengthMeters(road: RoadGraph, edgeIds: string[]): number {
  let total = 0
  for (const id of edgeIds) total += road.segments.get(road.edgeSegment.get(id)!)?.lengthMeters ?? 0
  return total
}

export interface RouteLeg {
  name: string
  meters: number
}

/** The route as a short list of roads, merging consecutive segments of the same road. */
export function routeLegs(road: RoadGraph, edgeIds: string[]): RouteLeg[] {
  const legs: RouteLeg[] = []
  for (const id of edgeIds) {
    const seg = road.segments.get(road.edgeSegment.get(id)!)
    if (!seg) continue
    const last = legs[legs.length - 1]
    if (last && last.name === seg.name) last.meters += seg.lengthMeters
    else legs.push({ name: seg.name, meters: seg.lengthMeters })
  }
  return legs
}

/**
 * A human description of a trace step in road terms. The generic algorithm
 * engines describe steps with internal ids ("Relaxed n21573812..."); on a real
 * map, "Found a shorter way along Baker Street" is what actually means something.
 */
export function describeRoadStep(step: Step, road: RoadGraph): string {
  switch (step.kind) {
    case 'visit-node':
      return `Exploring from ${junctionName(road, step.nodeId)}`
    case 'finalize-node':
      return `Locked in the shortest distance to ${junctionName(road, step.nodeId)}`
    case 'consider-edge':
    case 'relax-edge':
    case 'reject-edge':
    case 'accept-edge': {
      const seg = road.segments.get(road.edgeSegment.get(step.edgeId) ?? '')
      const name = seg?.name ?? 'a road'
      if (step.kind === 'consider-edge') return `Checking ${name}${seg ? ` (${formatDistance(seg.lengthMeters)})` : ''}`
      if (step.kind === 'reject-edge') return `${name} doesn’t give a shorter way`
      return `Found a shorter way along ${name}`
    }
    case 'done':
      return step.success
        ? `Route found: ${formatDistance(routeLengthMeters(road, step.resultEdgeIds))}`
        : 'No drivable route between those postcodes in the downloaded area (one-way streets or missing roads may block it).'
  }
}
