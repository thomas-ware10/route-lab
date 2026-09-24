import { describe, expect, it, vi } from 'vitest'
import { buildOverpassQuery, fetchOverpass, OverpassError, planQuery, responseTimeoutFor } from '../overpass'

const A = { lat: 51.5, lng: -0.1 }
const km = (n: number) => ({ lat: A.lat + n / 111.2, lng: A.lng }) // n km due north

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('planQuery', () => {
  it('fetches every drivable street for short trips, with no separate detail zones', () => {
    const plan = planQuery(A, km(3))
    expect(plan.bboxClasses).toContain('residential')
    expect(plan.detailRadiusMeters).toBe(0)
  })

  it('uses major roads across the box plus full detail near each end for medium trips', () => {
    const plan = planQuery(A, km(10))
    expect(plan.bboxClasses).toContain('tertiary')
    expect(plan.bboxClasses).not.toContain('residential')
    expect(plan.detailRadiusMeters).toBe(2000)
  })

  it('drops to secondary-and-above across the box for long trips', () => {
    const plan = planQuery(A, km(30))
    expect(plan.bboxClasses).toContain('secondary')
    expect(plan.bboxClasses).not.toContain('tertiary')
    expect(plan.detailRadiusMeters).toBe(3000)
  })

  it('refuses trips beyond 25 miles with the actual distance in the message', () => {
    expect(() => planQuery(A, km(45))).toThrow(/miles apart/)
  })
})

describe('responseTimeoutFor', () => {
  it('waits longer before abandoning a server for bigger (slower server-side) queries', () => {
    expect(responseTimeoutFor(planQuery(A, km(3)))).toBe(30_000)
    expect(responseTimeoutFor(planQuery(A, km(30)))).toBe(60_000)
  })
})

describe('buildOverpassQuery', () => {
  it('builds a JSON query over the bounding box that returns way geometry', () => {
    const q = buildOverpassQuery(planQuery(A, km(3)))
    expect(q).toMatch(/^\[out:json\]/)
    expect(q).toContain('out geom;')
    expect(q).toContain('"highway"~"^(motorway|')
    expect(q).toContain('"access"!~"^(private|no)$"')
    expect(q).not.toContain('around:')
  })

  it('adds an around-radius clause for each endpoint on longer trips', () => {
    const q = buildOverpassQuery(planQuery(A, km(10)))
    expect(q.match(/around:2000,/g)).toHaveLength(2)
  })
})

describe('fetchOverpass', () => {
  it('returns the parsed response on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { elements: [] }))
    await expect(fetchOverpass('q', { fetchImpl, endpoints: ['https://a'] })).resolves.toEqual({ elements: [] })
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('data=q')
  })

  it('retries a busy server (429/504) once after a short wait before trying backups', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(504, {}))
      .mockResolvedValueOnce(jsonResponse(200, { elements: [] }))
    await expect(
      fetchOverpass('q', { fetchImpl, endpoints: ['https://a', 'https://b'], busyRetryDelayMs: 1 }),
    ).resolves.toEqual({ elements: [] })
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual(['https://a', 'https://a'])
  })

  it('moves on after a busy server stays busy, and does not retry plain 5xx errors', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { elements: [] }))
    await fetchOverpass('q', { fetchImpl, endpoints: ['https://a', 'https://b', 'https://c'], busyRetryDelayMs: 1 })
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual(['https://a', 'https://a', 'https://b', 'https://c'])
  })

  it('honours Retry-After instead of the default wait', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '0.05' } }))
      .mockResolvedValueOnce(jsonResponse(200, { elements: [] }))
    const t0 = performance.now()
    await fetchOverpass('q', { fetchImpl, endpoints: ['https://a'], busyRetryDelayMs: 60_000 })
    expect(performance.now() - t0).toBeLessThan(2000)
  })

  it('a cancel during the busy wait aborts without retrying', async () => {
    const user = new AbortController()
    const fetchImpl = vi.fn().mockImplementation(async () => {
      setTimeout(() => user.abort(), 10)
      return jsonResponse(504, {})
    })
    const err = await fetchOverpass('q', { fetchImpl, signal: user.signal, endpoints: ['https://a'], busyRetryDelayMs: 60_000 }).catch(
      (e) => e,
    )
    expect(err.name).toBe('AbortError')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('falls through on a 403/406 "this server won\'t serve you" (seen live from blocked networks)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('<html>Not Acceptable</html>', { status: 406 }))
      .mockResolvedValueOnce(new Response('forbidden', { status: 403 }))
      .mockResolvedValueOnce(jsonResponse(200, { elements: [] }))
    await expect(fetchOverpass('q', { fetchImpl, endpoints: ['https://a', 'https://b', 'https://c'] })).resolves.toEqual({
      elements: [],
    })
  })

  it('falls through on a network/CORS failure', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(200, { elements: [] }))
    await expect(fetchOverpass('q', { fetchImpl, endpoints: ['https://a', 'https://b'] })).resolves.toEqual({ elements: [] })
  })

  it('gives up on a server that never answers and moves on after the timeout', async () => {
    const hang = (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(hang)
      .mockResolvedValueOnce(jsonResponse(200, { elements: [] }))
    await expect(
      fetchOverpass('q', { fetchImpl, endpoints: ['https://hung', 'https://ok'], responseTimeoutMs: 20 }),
    ).resolves.toEqual({ elements: [] })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('falls through when a server returns an HTML error page instead of JSON', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('<html>runtime error</html>', { status: 200 }))
      .mockResolvedValueOnce(jsonResponse(200, { remark: 'no elements key' }))
      .mockResolvedValueOnce(jsonResponse(200, { elements: [] }))
    await expect(fetchOverpass('q', { fetchImpl, endpoints: ['https://a', 'https://b', 'https://c'] })).resolves.toEqual({
      elements: [],
    })
  })

  it('names every server and what went wrong when all of them fail', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 406 }))
      .mockResolvedValue(jsonResponse(429, {}))
    const err = await fetchOverpass('q', {
      fetchImpl,
      endpoints: ['https://one.example', 'https://two.example'],
      busyRetryDelayMs: 1,
    }).catch(
      (e) => e,
    )
    expect(err).toBeInstanceOf(OverpassError)
    expect(err.message).toMatch(/one\.example: HTTP 406/)
    expect(err.message).toMatch(/two\.example: too many requests/)
  })

  it('stops immediately on HTTP 400 — the query itself is invalid, so every server would reject it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, {}))
    await expect(fetchOverpass('q', { fetchImpl, endpoints: ['https://a', 'https://b'] })).rejects.toBeInstanceOf(OverpassError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('reports each attempt so the UI can say it is trying a backup server', async () => {
    const onAttempt = vi.fn()
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { elements: [] }))
    await fetchOverpass('q', { fetchImpl, endpoints: ['https://a', 'https://b', 'https://c'], onAttempt })
    expect(onAttempt.mock.calls).toEqual([
      [0, 3],
      [1, 3],
    ])
  })

  it('a user cancel propagates as an abort and does not try other servers', async () => {
    const user = new AbortController()
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      queueMicrotask(() => user.abort())
      return new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    })
    const err = await fetchOverpass('q', { fetchImpl, signal: user.signal, endpoints: ['https://a', 'https://b'] }).catch(
      (e) => e,
    )
    expect(err.name).toBe('AbortError')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
