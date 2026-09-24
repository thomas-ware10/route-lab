import { haversineMeters, midpoint } from './geo'
import { buildOverpassQuery, fetchOverpass, planQuery, responseTimeoutFor, type OverpassResponse, type QueryPlan } from './overpass'
import { geocodePostcode, normalizePostcode, type FetchFn, type GeocodedPostcode } from './postcodes'
import { buildRoadGraph, largestComponent, nearestNode, type RoadGraph } from './roadGraph'

export class RouteError extends Error {}

export type RouteProgress = 'geocoding' | 'downloading' | 'building'

export interface PlannedRoute {
  from: GeocodedPostcode
  to: GeocodedPostcode
  plan: QueryPlan
  road: RoadGraph
  startNodeId: string
  endNodeId: string
  /** How far each postcode's point is from the junction it was snapped to. */
  startSnapMeters: number
  endSnapMeters: number
  wayCount: number
  downloadMs: number
}

export interface PlanRouteOptions {
  fetchImpl?: FetchFn
  signal?: AbortSignal
  endpoints?: string[]
  /** `detail` is set while falling back to a backup road-data server. */
  onProgress?: (stage: RouteProgress, detail?: string) => void
  responseTimeoutMs?: number
  busyRetryDelayMs?: number
}

const RESPONSE_CACHE_LIMIT = 4
const responseCache = new Map<string, OverpassResponse>()

export function clearRoadDataCache(): void {
  responseCache.clear()
}

async function downloadRoads(query: string, plan: QueryPlan, options: PlanRouteOptions): Promise<OverpassResponse> {
  const cached = responseCache.get(query)
  if (cached) return cached
  const response = await fetchOverpass(query, {
    ...options,
    responseTimeoutMs: options.responseTimeoutMs ?? responseTimeoutFor(plan),
    onAttempt: (attempt, total) => {
      if (attempt > 0) options.onProgress?.('downloading', `main server unavailable \u2014 trying backup ${attempt} of ${total - 1}`)
    },
  })
  responseCache.set(query, response)
  if (responseCache.size > RESPONSE_CACHE_LIMIT) {
    responseCache.delete(responseCache.keys().next().value!)
  }
  return response
}

/**
 * Everything between "two postcodes typed in" and "a graph ready to search":
 * geocode both (in parallel), size the download to the trip, fetch the roads,
 * build the routing graph, and snap each postcode onto the main road network.
 */
export async function planRoute(fromRaw: string, toRaw: string, options: PlanRouteOptions = {}): Promise<PlannedRoute> {
  if (normalizePostcode(fromRaw) === normalizePostcode(toRaw)) {
    throw new RouteError('Those are the same postcode — enter two different ones.')
  }

  options.onProgress?.('geocoding')
  const [from, to] = await Promise.all([geocodePostcode(fromRaw, options), geocodePostcode(toRaw, options)])

  let plan: QueryPlan
  try {
    plan = planQuery(from, to)
  } catch (err) {
    throw new RouteError((err as Error).message)
  }

  options.onProgress?.('downloading')
  const t0 = performance.now()
  const response = await downloadRoads(buildOverpassQuery(plan), plan, options)
  const downloadMs = performance.now() - t0

  options.onProgress?.('building')
  // Graph building is synchronous; yield once so the "Building…" status can paint first.
  await new Promise((resolve) => setTimeout(resolve, 0))
  const road = buildRoadGraph(response, midpoint(from, to))
  if (road.graph.edges.length === 0) {
    throw new RouteError('No drivable roads were found around those postcodes.')
  }

  const mainNetwork = largestComponent(road.graph)
  const start = nearestNode(road, from, mainNetwork)
  const end = nearestNode(road, to, mainNetwork)
  if (!start || !end) {
    throw new RouteError('Couldn’t connect those postcodes to the road network.')
  }
  if (start.nodeId === end.nodeId) {
    throw new RouteError(
      `${from.postcode} and ${to.postcode} are only ${Math.round(haversineMeters(from, to))} m apart and land on the same junction — try postcodes further apart.`,
    )
  }

  return {
    from,
    to,
    plan,
    road,
    startNodeId: start.nodeId,
    endNodeId: end.nodeId,
    startSnapMeters: start.distanceMeters,
    endSnapMeters: end.distanceMeters,
    wayCount: response.elements.filter((e) => e.type === 'way').length,
    downloadMs,
  }
}
