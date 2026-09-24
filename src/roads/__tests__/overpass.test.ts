import { describe, expect, it, vi } from 'vitest'
import { buildOverpassQuery, fetchOverpass, OverpassError, planQuery } from '../overpass'

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

  it('falls through to the next mirror on a 429 or 5xx', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(504, {}))
      .mockResolvedValueOnce(jsonResponse(200, { elements: [] }))
    await fetchOverpass('q', { fetchImpl, endpoints: ['https://a', 'https://b', 'https://c'] })
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual(['https://a', 'https://b', 'https://c'])
  })

  it('falls through on a network error', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(200, { elements: [] }))
    await expect(fetchOverpass('q', { fetchImpl, endpoints: ['https://a', 'https://b'] })).resolves.toEqual({ elements: [] })
  })

  it('gives a friendly error when every mirror fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(429, {}))
    await expect(fetchOverpass('q', { fetchImpl, endpoints: ['https://a', 'https://b'] })).rejects.toThrow(/rate-limited/)
  })

  it('does not retry a 4xx that is the query itself being rejected', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, {}))
    await expect(fetchOverpass('q', { fetchImpl, endpoints: ['https://a', 'https://b'] })).rejects.toBeInstanceOf(OverpassError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('rejects a response without an elements array', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { remark: 'runtime error' }))
    await expect(fetchOverpass('q', { fetchImpl, endpoints: ['https://a'] })).rejects.toThrow(/unexpected/)
  })

  it('lets an abort propagate without trying other mirrors', async () => {
    const abort = new DOMException('aborted', 'AbortError')
    const fetchImpl = vi.fn().mockRejectedValue(abort)
    await expect(fetchOverpass('q', { fetchImpl, endpoints: ['https://a', 'https://b'] })).rejects.toBe(abort)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
