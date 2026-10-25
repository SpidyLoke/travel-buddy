import type { LatLng } from '../types'

// FOSSGIS-hosted OSRM with the foot profile (free, no key, CORS enabled).
// The path segment says "driving" for every profile on this server; the
// profile is chosen by the "routed-foot" prefix.
const FOOT_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving'

export interface WalkRoute {
  coords: [number, number][]
  km: number
  min: number
}

const cache = new Map<string, WalkRoute | null>()

const key = (a: LatLng, b: LatLng) => [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(4)).join(',')

/** Returns null when the routing service is unreachable or finds no route. */
export async function walkRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<WalkRoute | null> {
  const k = key(from, to)
  if (cache.has(k)) return cache.get(k)!
  try {
    const url = `${FOOT_URL}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    const r = data?.routes?.[0]
    if (!r?.geometry?.coordinates?.length) {
      cache.set(k, null)
      return null
    }
    const route: WalkRoute = {
      coords: r.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
      km: r.distance / 1000,
      // OSRM's foot profile assumes ~5 km/h; city crossings make 4.5 km/h more realistic.
      min: Math.round(((r.distance / 1000) / 4.5) * 60),
    }
    cache.set(k, route)
    return route
  } catch {
    // Not cached, so a later attempt can succeed once the connection is back.
    return null
  }
}
