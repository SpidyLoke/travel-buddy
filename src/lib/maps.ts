import type { LatLng, Place, TransportMode } from '../types'

export type GoogleTravelMode = 'transit' | 'walking' | 'bicycling' | 'driving'

export const modeToGoogle: Record<TransportMode, GoogleTravelMode> = {
  train: 'transit',
  walk: 'walking',
  // Google has no scooter mode. Bicycling keeps the route on roads rather than
  // footpaths where it is available; the UI explains the limitation.
  luup: 'bicycling',
}

/**
 * Official Maps URLs format: https://developers.google.com/maps/documentation/urls/get-started
 * Without an origin, Google Maps uses the device's current location.
 */
export function directionsUrl(dest: Place, mode: GoogleTravelMode, origin?: LatLng | Place | null): string {
  const params = new URLSearchParams({ api: '1', destination: dest.mapsQuery, travelmode: mode })
  if (origin) {
    params.set('origin', 'mapsQuery' in origin ? origin.mapsQuery : `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`)
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/**
 * Google Maps takes only a few stops in between on phones (and none for public
 * transport), so a long day becomes several linked routes, each starting where
 * the last one ended.
 */
export const MAX_WAYPOINTS = 3

const pointQuery = (p: LatLng | Place) => ('mapsQuery' in p ? p.mapsQuery : `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)

export interface RoutePart<T> {
  url: string
  points: T[]
}

export function routeParts<T extends LatLng | Place>(points: T[], mode: 'walking' | 'driving'): RoutePart<T>[] {
  const parts: RoutePart<T>[] = []
  for (let i = 0; i < points.length - 1; i += MAX_WAYPOINTS + 1) {
    const chunk = points.slice(i, i + MAX_WAYPOINTS + 2)
    const params = new URLSearchParams({ api: '1', origin: pointQuery(chunk[0]), destination: pointQuery(chunk.at(-1)!), travelmode: mode })
    if (chunk.length > 2) params.set('waypoints', chunk.slice(1, -1).map(pointQuery).join('|'))
    parts.push({ url: `https://www.google.com/maps/dir/?${params.toString()}`, points: chunk })
  }
  return parts
}

export function searchUrl(place: Place): string {
  const params = new URLSearchParams({ api: '1', query: place.mapsQuery })
  return `https://www.google.com/maps/search/?${params.toString()}`
}

export const LUUP_URL = 'https://luup.sc/'
