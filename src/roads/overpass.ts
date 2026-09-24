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

/**
 * Public Overpass instances, tried in order. They are volunteer-run and
 * individually unreliable (rate limits, maintenance, networks they refuse), so
 * the client falls through them rather than depending on any one. Set
 * VITE_OVERPASS_URL to put your own or a preferred instance first.
 */
export const PUBLIC_OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

export function defaultOverpassEndpoints(): string[] {
  const custom = (import.meta.env?.VITE_OVERPASS_URL as string | undefined)?.trim()
  return custom ? [custom, ...PUBLIC_OVERPASS_ENDPOINTS.filter((e) => e !== custom)] : PUBLIC_OVERPASS_ENDPOINTS
}

/**
 * How long to wait for a server to start answering before moving to the next.
 * Overpass sends nothing until the whole query has run, so this has to cover
 * server-side execution: a dense 2 km central-London query measured ~7 s to
 * first byte, and a 25-mile query can take several times that. Too short and a
 * healthy-but-busy server gets abandoned for a worse one.
 */
export const DEFAULT_RESPONSE_TIMEOUT_MS = 30_000

export function responseTimeoutFor(plan: QueryPlan): number {
  return plan.straightLineMeters <= 6000 ? 30_000 : 60_000
}

export class OverpassError extends Error {}

export interface FetchOverpassOptions {
  fetchImpl?: FetchFn
  signal?: AbortSignal
  endpoints?: string[]
  responseTimeoutMs?: number
  /** Wait before retrying a server that said it was busy (429/504), unless it sends Retry-After. */
  busyRetryDelayMs?: number
  /** Called before each server is tried (0-based), so the UI can show "trying backup server". */
  onAttempt?: (attempt: number, total: number) => void
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

const abortError = () => new DOMException('Aborted', 'AbortError')

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

type Attempt =
  | { kind: 'ok'; body: OverpassResponse }
  | { kind: 'failed'; problem: string; busy: boolean; retryAfterMs?: number }

async function attemptServer(endpoint: string, query: string, timeoutMs: number, options: FetchOverpassOptions): Promise<Attempt> {
  const fetchImpl = options.fetchImpl ?? fetch
  const host = hostOf(endpoint)
  const controller = new AbortController()
  const forwardAbort = () => controller.abort()
  options.signal?.addEventListener('abort', forwardAbort)
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    let response: Response
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      })
    } catch (err) {
      if (options.signal?.aborted) throw err
      return { kind: 'failed', busy: false, problem: `${host}: ${timedOut ? `no response in ${Math.round(timeoutMs / 1000)}s` : 'unreachable'}` }
    } finally {
      // Headers arrived (or the attempt failed): a large area's body can
      // legitimately take a while to stream, so the timeout stops here.
      clearTimeout(timer)
    }

    if (response.status === 400) {
      throw new OverpassError('The road-data server rejected the query as invalid (HTTP 400).')
    }
    if (!response.ok) {
      const busy = response.status === 429 || response.status === 504
      const retryAfterSeconds = Number(response.headers.get('Retry-After'))
      return {
        kind: 'failed',
        busy,
        retryAfterMs: Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : undefined,
        problem: `${host}: ${response.status === 429 ? 'too many requests' : response.status === 504 ? 'busy (HTTP 504)' : `HTTP ${response.status}`}`,
      }
    }

    let body: OverpassResponse
    try {
      body = (await response.json()) as OverpassResponse
    } catch (err) {
      if (options.signal?.aborted) throw err
      return { kind: 'failed', busy: false, problem: `${host}: unreadable response` }
    }
    if (!body || !Array.isArray(body.elements)) {
      return { kind: 'failed', busy: false, problem: `${host}: unexpected response` }
    }
    return { kind: 'ok', body }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', forwardAbort)
  }
}

const MAX_RETRY_AFTER_MS = 15_000

/**
 * POSTs the query to each server in turn until one returns usable data.
 *
 * Only an HTTP 400 stops everything — the query itself is malformed and every
 * server would reject it. A 429 or 504 means "busy, no free query slot for you
 * right now" (the main server allows two concurrent queries per IP), which
 * usually clears within seconds, so that same server gets one polite retry
 * after a short wait (or its Retry-After) before moving on. Anything else —
 * network/CORS failure, 403/406, a non-JSON error page, or no response within
 * the timeout — moves straight to the next server. Without the timeout a hung
 * server would leave the user on "Downloading…" indefinitely.
 */
export async function fetchOverpass(query: string, options: FetchOverpassOptions = {}): Promise<OverpassResponse> {
  const endpoints = options.endpoints ?? defaultOverpassEndpoints()
  const timeoutMs = options.responseTimeoutMs ?? DEFAULT_RESPONSE_TIMEOUT_MS
  const busyDelayMs = options.busyRetryDelayMs ?? 5000
  const problems: string[] = []

  for (let attempt = 0; attempt < endpoints.length; attempt++) {
    if (options.signal?.aborted) throw abortError()
    options.onAttempt?.(attempt, endpoints.length)

    let result = await attemptServer(endpoints[attempt], query, timeoutMs, options)
    if (result.kind === 'failed' && result.busy) {
      await sleep(Math.min(result.retryAfterMs ?? busyDelayMs, MAX_RETRY_AFTER_MS), options.signal)
      result = await attemptServer(endpoints[attempt], query, timeoutMs, options)
    }
    if (result.kind === 'ok') return result.body
    problems.push(result.problem)
  }

  throw new OverpassError(
    `Couldn't download road data from any OpenStreetMap server (${problems.join('; ') || 'no servers configured'}). ` +
      'The free public servers are sometimes busy or refuse certain networks — try again in a few minutes, or on a different connection.',
  )
}
