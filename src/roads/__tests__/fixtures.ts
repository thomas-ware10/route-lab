import { vi } from 'vitest'
import type { OverpassResponse, OverpassWay } from '../overpass'

export const CENTER = { lat: 51.5, lng: -0.1 }

/** Points laid out on a small grid near CENTER; 0.001 deg lat ~ 111 m. */
export const P: Record<number, [number, number]> = {
  1: [51.5, -0.1],
  2: [51.5, -0.099],
  3: [51.5, -0.098],
  4: [51.5, -0.096],
  5: [51.501, -0.098],
  6: [51.502, -0.098],
  7: [51.502, -0.096],
  8: [51.505, -0.1],
  9: [51.505, -0.099],
  10: [51.506, -0.0995],
  20: [51.52, -0.12],
  21: [51.52, -0.119],
  30: [51.504, -0.099],
}

export function way(id: number, nodes: number[], tags: Record<string, string> = {}): OverpassWay {
  return {
    type: 'way',
    id,
    nodes,
    geometry: nodes.map((n) => ({ lat: P[n][0], lon: P[n][1] })),
    tags: { highway: 'residential', ...tags },
  }
}

/**
 * Main Street runs 1-2-3-4 east; Side Road (one-way, north) runs 3-5-6; Back Lane
 * (oneway=-1, so traffic flows 4 -> 6) runs 6-7-4, closing a loop; Isolated Close
 * (20-21) is a disconnected fragment, like a road clipped at the download edge.
 */
export function smallTown(): OverpassResponse {
  return {
    elements: [
      way(101, [1, 2, 3, 4], { name: 'Main Street' }),
      way(102, [3, 5, 6], { name: 'Side Road', oneway: 'yes' }),
      way(103, [6, 7, 4], { name: 'Back Lane', oneway: '-1' }),
      way(105, [20, 21], { name: 'Isolated Close' }),
    ],
  }
}

export const POSTCODES: Record<string, [number, number] | null> = {
  'AB1 1AA': [P[1][0] - 0.0001, P[1][1]], // just south of node 1
  'AB1 1AB': [P[6][0] + 0.0001, P[6][1]], // just north of node 6
  'AB1 9ZZ': [51.9, -0.1], // ~45 km away
}

/** A fake network: postcodes.io lookups by URL, Overpass by POST. */
export function fakeFetch(overpassBody: unknown = smallTown()) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith('https://api.postcodes.io/postcodes/')) {
      const pc = decodeURIComponent(url.split('/').pop()!)
      const coords = POSTCODES[pc]
      if (!coords) return new Response(JSON.stringify({ status: 404 }), { status: 404 })
      return new Response(JSON.stringify({ result: { postcode: pc, latitude: coords[0], longitude: coords[1] } }), { status: 200 })
    }
    if (init?.method === 'POST') return new Response(JSON.stringify(overpassBody), { status: 200 })
    throw new Error(`unexpected fetch ${url}`)
  })
}

