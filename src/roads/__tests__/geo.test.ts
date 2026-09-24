import { describe, expect, it } from 'vitest'
import { formatDistance, haversineMeters, makeProjection, paddedBoundingBox } from '../geo'

const LONDON = { lat: 51.5074, lng: -0.1278 }
const OXFORD = { lat: 51.752, lng: -1.2577 }

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters(LONDON, LONDON)).toBe(0)
  })
  it('matches the known London-Oxford distance (~83 km)', () => {
    const d = haversineMeters(LONDON, OXFORD)
    expect(d).toBeGreaterThan(81_000)
    expect(d).toBeLessThan(85_000)
  })
  it('is symmetric', () => {
    expect(haversineMeters(LONDON, OXFORD)).toBeCloseTo(haversineMeters(OXFORD, LONDON), 6)
  })
})

describe('makeProjection', () => {
  it('maps the center to the origin', () => {
    const p = makeProjection(LONDON).toXY(LONDON)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0)
  })
  it('round-trips lat/lng -> xy -> lat/lng', () => {
    const proj = makeProjection(LONDON)
    const pt = { lat: 51.55, lng: -0.05 }
    const { x, y } = proj.toXY(pt)
    const back = proj.toLatLng(x, y)
    expect(back.lat).toBeCloseTo(pt.lat, 9)
    expect(back.lng).toBeCloseTo(pt.lng, 9)
  })
  it('agrees with haversine to within 0.5% over a 25-mile span', () => {
    const proj = makeProjection(LONDON)
    const far = { lat: 51.75, lng: -0.3 } // ~30 km away
    const a = proj.toXY(LONDON)
    const b = proj.toXY(far)
    const projected = Math.hypot(b.x - a.x, b.y - a.y)
    const real = haversineMeters(LONDON, far)
    expect(Math.abs(projected - real) / real).toBeLessThan(0.005)
  })
})

describe('paddedBoundingBox', () => {
  it('contains both points with margin on every side', () => {
    const a = { lat: 51.5, lng: -0.2 }
    const b = { lat: 51.6, lng: -0.1 }
    const box = paddedBoundingBox(a, b)
    expect(box.south).toBeLessThan(51.5)
    expect(box.north).toBeGreaterThan(51.6)
    expect(box.west).toBeLessThan(-0.2)
    expect(box.east).toBeGreaterThan(-0.1)
  })
  it('applies at least the minimum padding even for points very close together', () => {
    const box = paddedBoundingBox(LONDON, { lat: LONDON.lat + 0.0001, lng: LONDON.lng })
    const heightMeters = haversineMeters({ lat: box.south, lng: LONDON.lng }, { lat: box.north, lng: LONDON.lng })
    expect(heightMeters).toBeGreaterThan(2 * 1500)
  })
})

describe('formatDistance', () => {
  it('uses meters under 1 km', () => {
    expect(formatDistance(850.4)).toBe('850 m')
  })
  it('uses km and miles above 1 km', () => {
    expect(formatDistance(16093.44)).toBe('16.1 km (10.0 mi)')
  })
})
