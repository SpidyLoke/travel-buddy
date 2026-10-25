import { getPlace } from '../data/places'
import type { ItineraryState, LatLng } from '../types'
import { homePlace, hasCoords } from './home'
import { loadPhotoCache } from './photos'

// "Download for offline": fetches map tiles around each stop and the plan's
// photos so the service worker caches them (see vite.config.ts runtime
// caching). OpenStreetMap's tile policy forbids bulk downloads, so this stays
// small: zooms 14–16 only, ~500 m around each stop, capped, two at a time.

const ZOOMS = [14, 15, 16]
const RADIUS_M = 500
export const TILE_CAP = 400

const tileX = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z)
const tileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

export function tileUrls(points: LatLng[]): string[] {
  const urls = new Set<string>()
  for (const p of points) {
    const dLat = RADIUS_M / 111320
    const dLng = RADIUS_M / (111320 * Math.cos((p.lat * Math.PI) / 180))
    for (const z of ZOOMS) {
      for (let x = tileX(p.lng - dLng, z); x <= tileX(p.lng + dLng, z); x++) {
        for (let y = tileY(p.lat + dLat, z); y <= tileY(p.lat - dLat, z); y++) urls.add(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`)
      }
    }
  }
  return [...urls].slice(0, TILE_CAP)
}

export function planPoints(days: ItineraryState[]): LatLng[] {
  const pts: LatLng[] = []
  for (const d of days) {
    const home = homePlace(d)
    if (hasCoords(home)) pts.push(home)
    for (const s of d.stops) if (s.status !== 'skipped') pts.push(getPlace(s.placeId))
  }
  return pts
}

export interface OfflineResult {
  tiles: number
  photos: number
  failed: number
}

export type OfflineProblem = 'no-worker' | 'offline'

export function offlineProblem(): OfflineProblem | null {
  if (!navigator.onLine) return 'offline'
  // Without an active service worker nothing would be kept.
  if (!navigator.serviceWorker?.controller) return 'no-worker'
  return null
}

export async function downloadForOffline(days: ItineraryState[], onProgress: (done: number, total: number) => void): Promise<OfflineResult> {
  const tiles = tileUrls(planPoints(days))
  const ids = new Set(days.flatMap((d) => d.stops.map((s) => s.placeId)))
  const photoCache = loadPhotoCache()
  const photos = [...ids].map((id) => photoCache[id]?.url).filter((u): u is string => !!u)
  const all = [...tiles, ...photos]
  let done = 0
  let failed = 0
  let next = 0
  const worker = async () => {
    while (next < all.length) {
      const url = all[next++]
      try {
        // Plain CORS requests (both hosts allow it): opaque no-cors responses
        // are counted as megabytes each against storage quota.
        const res = await fetch(url)
        if (!res.ok) failed++
      } catch {
        failed++
      }
      onProgress(++done, all.length)
    }
  }
  await Promise.all([worker(), worker()])
  return { tiles: tiles.length, photos: photos.length, failed }
}
