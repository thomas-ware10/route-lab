import type { LatLng } from './geo'

export interface GeocodedPostcode extends LatLng {
  postcode: string
}

export type FetchFn = typeof fetch

const POSTCODE_PATTERN = /^[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2}$/

/** Uppercases, strips stray whitespace, and inserts the single space before the inward code. */
export function normalizePostcode(raw: string): string {
  const compact = raw.toUpperCase().replace(/\s+/g, '')
  if (compact.length < 5) return compact
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`
}

export function isValidUkPostcode(raw: string): boolean {
  return POSTCODE_PATTERN.test(normalizePostcode(raw))
}

export class PostcodeError extends Error {}

/**
 * Looks a UK postcode up via postcodes.io (free, no API key). Validates the
 * format locally first so obvious typos fail instantly without a network call.
 */
export async function geocodePostcode(
  raw: string,
  options: { fetchImpl?: FetchFn; signal?: AbortSignal } = {},
): Promise<GeocodedPostcode> {
  const postcode = normalizePostcode(raw)
  if (!POSTCODE_PATTERN.test(postcode)) {
    throw new PostcodeError(`"${raw.trim()}" doesn't look like a UK postcode (e.g. SW1A 1AA).`)
  }

  const fetchImpl = options.fetchImpl ?? fetch
  let response: Response
  try {
    response = await fetchImpl(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
      signal: options.signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new PostcodeError(`Couldn't reach the postcode lookup service to find ${postcode}. Check your connection.`)
  }

  if (response.status === 404) {
    throw new PostcodeError(`Postcode ${postcode} wasn't found. It may be mistyped or no longer in use.`)
  }
  if (!response.ok) {
    throw new PostcodeError(`The postcode lookup service returned an error (${response.status}) for ${postcode}.`)
  }

  const body = (await response.json()) as {
    result?: { postcode?: string; latitude?: number | null; longitude?: number | null }
  }
  const lat = body.result?.latitude
  const lng = body.result?.longitude
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new PostcodeError(`Postcode ${postcode} has no known location on the map.`)
  }
  return { postcode: body.result?.postcode ?? postcode, lat, lng }
}
