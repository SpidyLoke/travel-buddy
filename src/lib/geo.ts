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

/** Rough bounding box for Greater Tokyo, used to sanity-check GPS fixes. */
export function isInTokyoArea(p: LatLng): boolean {
  return p.lat > 35.3 && p.lat < 36.1 && p.lng > 139.2 && p.lng < 140.3
}
