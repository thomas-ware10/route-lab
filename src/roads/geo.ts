export interface LatLng {
  lat: number
  lng: number
}

export interface BoundingBox {
  south: number
  west: number
  north: number
  east: number
}

const EARTH_RADIUS_M = 6_371_008.8
const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

export const METERS_PER_MILE = 1609.344

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface Projection {
  toXY: (p: LatLng) => { x: number; y: number }
  toLatLng: (x: number, y: number) => LatLng
}

/**
 * Local equirectangular projection to meters around `center`. Over the <=25-mile
 * areas this mode supports, distortion is well under 1%. The road graph measures
 * edge lengths in this same projected space, which is what makes A*'s straight-line
 * heuristic exactly consistent (a polyline can never be shorter than the straight
 * line between its ends in the same metric), rather than merely approximately so.
 */
export function makeProjection(center: LatLng): Projection {
  const cosLat = Math.cos(toRad(center.lat))
  return {
    toXY: (p) => ({
      x: EARTH_RADIUS_M * toRad(p.lng - center.lng) * cosLat,
      y: EARTH_RADIUS_M * toRad(p.lat - center.lat),
    }),
    toLatLng: (x, y) => ({
      lat: center.lat + toDeg(y / EARTH_RADIUS_M),
      lng: center.lng + toDeg(x / (EARTH_RADIUS_M * cosLat)),
    }),
  }
}

export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 }
}

/**
 * Box around both points, padded on every side by `padFraction` of the larger
 * span, but never less than `minPadMeters` — real roads rarely run in a straight
 * line, so the route needs room to detour outside the points' own rectangle.
 */
export function paddedBoundingBox(a: LatLng, b: LatLng, padFraction = 0.3, minPadMeters = 1500): BoundingBox {
  const south = Math.min(a.lat, b.lat)
  const north = Math.max(a.lat, b.lat)
  const west = Math.min(a.lng, b.lng)
  const east = Math.max(a.lng, b.lng)
  const centerLat = (south + north) / 2
  const metersPerDegLat = (Math.PI / 180) * EARTH_RADIUS_M
  const metersPerDegLng = metersPerDegLat * Math.cos(toRad(centerLat))

  const spanMeters = Math.max((north - south) * metersPerDegLat, (east - west) * metersPerDegLng)
  const padMeters = Math.max(spanMeters * padFraction, minPadMeters)

  return {
    south: south - padMeters / metersPerDegLat,
    north: north + padMeters / metersPerDegLat,
    west: west - padMeters / metersPerDegLng,
    east: east + padMeters / metersPerDegLng,
  }
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km (${(meters / METERS_PER_MILE).toFixed(1)} mi)`
}
