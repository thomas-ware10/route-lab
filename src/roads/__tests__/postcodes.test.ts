import { describe, expect, it, vi } from 'vitest'
import { geocodePostcode, isValidUkPostcode, normalizePostcode, PostcodeError } from '../postcodes'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('normalizePostcode / isValidUkPostcode', () => {
  it('uppercases and inserts the single space before the inward code', () => {
    expect(normalizePostcode('sw1a1aa')).toBe('SW1A 1AA')
    expect(normalizePostcode('  ec1a   1bb ')).toBe('EC1A 1BB')
    expect(normalizePostcode('m11ae')).toBe('M1 1AE')
  })
  it('accepts the common UK postcode shapes', () => {
    for (const pc of ['SW1A 1AA', 'M1 1AE', 'B33 8TH', 'CR2 6XH', 'DN55 1PT', 'W1A 0AX', 'EC1A 1BB']) {
      expect(isValidUkPostcode(pc)).toBe(true)
    }
  })
  it('rejects obvious non-postcodes', () => {
    for (const pc of ['', 'hello', '12345', 'SW1A', '1AA SW1']) {
      expect(isValidUkPostcode(pc)).toBe(false)
    }
  })
})

describe('geocodePostcode', () => {
  it('returns lat/lng from postcodes.io for a valid postcode', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { status: 200, result: { postcode: 'SW1A 1AA', latitude: 51.501009, longitude: -0.141588 } }),
    )
    const result = await geocodePostcode('sw1a1aa', { fetchImpl })
    expect(result).toEqual({ postcode: 'SW1A 1AA', lat: 51.501009, lng: -0.141588 })
    expect(fetchImpl).toHaveBeenCalledWith('https://api.postcodes.io/postcodes/SW1A%201AA', expect.any(Object))
  })

  it('rejects a malformed postcode without making a network call', async () => {
    const fetchImpl = vi.fn()
    await expect(geocodePostcode('not a postcode', { fetchImpl })).rejects.toBeInstanceOf(PostcodeError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports a well-formed but unknown postcode clearly', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(404, { status: 404, error: 'Postcode not found' }))
    await expect(geocodePostcode('ZZ99 9ZZ', { fetchImpl })).rejects.toThrow(/wasn't found/)
  })

  it('reports a postcode that exists but has no coordinates', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { status: 200, result: { postcode: 'GY1 1AA', latitude: null, longitude: null } }))
    await expect(geocodePostcode('GY1 1AA', { fetchImpl })).rejects.toThrow(/no known location/)
  })

  it('turns a network failure into a friendly error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(geocodePostcode('SW1A 1AA', { fetchImpl })).rejects.toThrow(/Couldn't reach/)
  })

  it('lets an abort propagate untouched so callers can ignore cancelled lookups', async () => {
    const abort = new DOMException('aborted', 'AbortError')
    const fetchImpl = vi.fn().mockRejectedValue(abort)
    await expect(geocodePostcode('SW1A 1AA', { fetchImpl })).rejects.toBe(abort)
  })

  it('reports other server errors with their status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, {}))
    await expect(geocodePostcode('SW1A 1AA', { fetchImpl })).rejects.toThrow(/500/)
  })
})
