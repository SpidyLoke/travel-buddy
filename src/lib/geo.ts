import type { LatLng } from '../types'

const R = 6371

/** Further than this from a leg's start, the planned steps no longer apply. */
export const OFF_ROUTE_KM = 1.5

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 100) * 10} m`
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}

/** Rough bounding box for Japan, used to sanity-check GPS fixes. */
export function isInJapan(p: LatLng): boolean {
  return p.lat > 24 && p.lat < 46 && p.lng > 122.5 && p.lng < 146
}
