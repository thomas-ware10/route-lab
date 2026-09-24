import { haversineMeters, paddedBoundingBox, type BoundingBox, type LatLng } from './geo'
import type { FetchFn } from './postcodes'

export interface OverpassWay {
  type: 'way'
  id: number
  nodes: number[]
  geometry: { lat: number; lon: number }[]
  tags?: Record<string, string>
}

export interface OverpassResponse {
  elements: Array<OverpassWay | { type: string }>
}

const ALL_DRIVABLE = [
  'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
  'secondary', 'secondary_link', 'tertiary', 'tertiary_link',
  'unclassified', 'residential', 'living_street', 'road',
]
const UP_TO_TERTIARY = ALL_DRIVABLE.slice(0, 10)
const UP_TO_SECONDARY = ALL_DRIVABLE.slice(0, 8)

export const MAX_ROUTE_METERS = 25 * 1609.344

export interface QueryPlan {
  bbox: BoundingBox
  straightLineMeters: number
  /** Road classes fetched across the whole bounding box. */
  bboxClasses: string[]
  /** Full-detail radius around each endpoint (0 = no separate detail zones needed). */
  detailRadiusMeters: number
  endpoints: [LatLng, LatLng]
}

/**
 * Chooses how much road network to download. Short trips get every drivable
 * street in the box. Longer trips get full street detail only near each end
 * (so the postcode can reach the road network) plus major roads across the box
 * — the same hierarchy real routers use, and what keeps a 25-mile download and
 * search small enough to stay interactive instead of pulling every cul-de-sac
 * in a whole region.
 */
export function planQuery(from: LatLng, to: LatLng): QueryPlan {
  const straightLineMeters = haversineMeters(from, to)
  if (straightLineMeters > MAX_ROUTE_METERS) {
    throw new RangeError(
      `Those postcodes are ${(straightLineMeters / 1609.344).toFixed(1)} miles apart; this mode supports up to 25 miles.`,
    )
  }
  const bbox = paddedBoundingBox(from, to)
  const endpoints: [LatLng, LatLng] = [from, to]
  if (straightLineMeters <= 6000) {
    return { bbox, straightLineMeters, bboxClasses: ALL_DRIVABLE, detailRadiusMeters: 0, endpoints }
  }
  if (straightLineMeters <= 15000) {
    return { bbox, straightLineMeters, bboxClasses: UP_TO_TERTIARY, detailRadiusMeters: 2000, endpoints }
  }
  return { bbox, straightLineMeters, bboxClasses: UP_TO_SECONDARY, detailRadiusMeters: 3000, endpoints }
}

const ACCESS_FILTER = '["access"!~"^(private|no)$"]["motor_vehicle"!~"^(private|no)$"]["area"!="yes"]'

function highwayFilter(classes: string[]): string {
  return `["highway"~"^(${classes.join('|')})$"]`
}

export function buildOverpassQuery(plan: QueryPlan): string {
  const { south, west, north, east } = plan.bbox
  const bbox = `(${south.toFixed(6)},${west.toFixed(6)},${north.toFixed(6)},${east.toFixed(6)})`
  const lines = [`way${highwayFilter(plan.bboxClasses)}${ACCESS_FILTER}${bbox};`]
  if (plan.detailRadiusMeters > 0) {
    for (const p of plan.endpoints) {
      lines.push(
        `way${highwayFilter(ALL_DRIVABLE)}${ACCESS_FILTER}(around:${Math.round(plan.detailRadiusMeters)},${p.lat.toFixed(6)},${p.lng.toFixed(6)});`,
      )
    }
  }
  return `[out:json][timeout:90];\n(\n  ${lines.join('\n  ')}\n);\nout geom;`
}

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export class OverpassError extends Error {}

/** POSTs the query, falling through to the next public mirror on network errors, 429s, or 5xx. */
export async function fetchOverpass(
  query: string,
  options: { fetchImpl?: FetchFn; signal?: AbortSignal; endpoints?: string[] } = {},
): Promise<OverpassResponse> {
  const fetchImpl = options.fetchImpl ?? fetch
  const endpoints = options.endpoints ?? OVERPASS_ENDPOINTS
  let lastProblem = 'no endpoints tried'

  for (const endpoint of endpoints) {
    let response: Response
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: options.signal,
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      lastProblem = 'network error'
      continue
    }
    if (response.status === 429 || response.status >= 500) {
      lastProblem = response.status === 429 ? 'rate-limited (too many requests)' : `server error ${response.status}`
      continue
    }
    if (!response.ok) {
      throw new OverpassError(`The road-data service rejected the request (${response.status}).`)
    }
    const body = (await response.json()) as OverpassResponse
    if (!body || !Array.isArray(body.elements)) {
      throw new OverpassError('The road-data service returned an unexpected response.')
    }
    return body
  }
  throw new OverpassError(`Couldn't download road data — the OpenStreetMap service was ${lastProblem}. Try again in a minute.`)
}
