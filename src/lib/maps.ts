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

export function searchUrl(place: Place): string {
  const params = new URLSearchParams({ api: '1', query: place.mapsQuery })
  return `https://www.google.com/maps/search/?${params.toString()}`
}

export const LUUP_URL = 'https://luup.sc/'
