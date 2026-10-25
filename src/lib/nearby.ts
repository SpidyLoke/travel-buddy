import type { LatLng, Place } from '../types'
import { distanceKm } from './geo'
import { fetchPhotoInfo, type Photo } from './photos'

// Live, key-free data sources, all CORS-enabled:
//   OpenStreetMap via Overpass  – shops, food, toilets, ATMs… around a point
//   Wikipedia geosearch         – landmarks around a point, with free-licence photos
//   Photon (komoot)             – place search and reverse geocoding on OSM data
// Results are whatever OSM/Wikipedia hold today: coverage varies, and opening
// hours come from OSM tags when present.

export type CategoryId =
  | 'landmarks'
  | 'donki'
  | 'konbini'
  | 'food'
  | 'ramen'
  | 'cafe'
  | 'toilets'
  | 'atm'
  | 'drugstore'
  | 'lockers'
  | 'souvenirs'
  | 'station'

export interface Category {
  id: CategoryId
  label: string
  radiusM: number
  /** Overpass filter(s); each is applied with the around() clause. */
  filters?: string[]
  note?: string
}

export const CATEGORIES: Category[] = [
  { id: 'landmarks', label: 'Landmarks', radiusM: 1500 },
  {
    id: 'donki',
    label: 'Don Quijote',
    radiusM: 4000,
    filters: ['["name"~"ドン・キホーテ|ドンキ|Don Quijote|DONKI",i]', '["brand"~"ドン・キホーテ|Don Quijote",i]'],
  },
  { id: 'konbini', label: 'Konbini', radiusM: 700, filters: ['["shop"="convenience"]'], note: 'Food, drinks, toilets in many, and 7-Eleven ATMs.' },
  { id: 'food', label: 'Food', radiusM: 600, filters: ['["amenity"~"^(restaurant|fast_food|food_court)$"]'] },
  { id: 'ramen', label: 'Ramen', radiusM: 1200, filters: ['["cuisine"~"ramen",i]'] },
  { id: 'cafe', label: 'Café', radiusM: 700, filters: ['["amenity"="cafe"]'] },
  { id: 'toilets', label: 'Toilets', radiusM: 800, filters: ['["amenity"="toilets"]'], note: 'Stations, parks and department stores almost always have free toilets too.' },
  { id: 'atm', label: 'ATM', radiusM: 1000, filters: ['["amenity"="atm"]'], note: '7-Eleven (Seven Bank) ATMs generally accept overseas cards.' },
  { id: 'drugstore', label: 'Drugstore', radiusM: 900, filters: ['["shop"="chemist"]', '["amenity"="pharmacy"]'] },
  { id: 'lockers', label: 'Lockers', radiusM: 1200, filters: ['["amenity"="locker"]', '["amenity"="luggage_locker"]'], note: 'Coin lockers are mostly inside stations; OSM only lists some.' },
  { id: 'souvenirs', label: 'Souvenirs', radiusM: 900, filters: ['["shop"="gift"]', '["shop"="souvenir"]'] },
  { id: 'station', label: 'Stations', radiusM: 1500, filters: ['["railway"="station"]'] },
]

export interface NearbyResult {
  place: Place
  km: number
  /** Extra line such as cuisine or opening hours (from OSM tags). */
  detail?: string
  photo?: Photo | null
}

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

function makePlace(id: string, name: string, nameJa: string, lat: number, lng: number, area: string, extra: Partial<Place> = {}): Place {
  return {
    id,
    name,
    nameJa,
    // Coordinates make external navigation land on exactly this result.
    mapsQuery: `${lat.toFixed(6)},${lng.toFixed(6)}`,
    lat,
    lng,
    area,
    description: '',
    activities: [],
    suggestedMin: 30,
    nearestStation: '',
    guideOnly: true,
    custom: true,
    ...extra,
  }
}

interface OsmElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

async function overpass(query: string, signal?: AbortSignal): Promise<OsmElement[]> {
  let lastErr: unknown
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), signal })
      if (!res.ok) throw new Error(`Overpass ${res.status}`)
      return (await res.json()).elements ?? []
    } catch (e) {
      if (signal?.aborted) throw e
      lastErr = e
    }
  }
  throw lastErr
}

function osmToResult(el: OsmElement, at: LatLng, cat: Category): NearbyResult | null {
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  const t = el.tags ?? {}
  const ja = t.name ?? t['name:ja'] ?? t.brand
  if (lat == null || lng == null || !ja) return null
  const en = t['name:en'] ?? t['brand:en'] ?? ja
  const detail = [t.cuisine?.replace(/;/g, ', '), t.opening_hours ? `Hours (OSM): ${t.opening_hours}` : undefined].filter(Boolean).join(' · ')
  const place = makePlace(`osm-${el.type}-${el.id}`, en, ja, lat, lng, cat.label, {
    kind: cat.id === 'landmarks' ? 'sight' : 'shop',
    hours: t.opening_hours ? `${t.opening_hours} (from OpenStreetMap, may be out of date)` : undefined,
    suggestedMin: cat.id === 'donki' ? 40 : cat.id === 'food' || cat.id === 'ramen' ? 45 : 20,
  })
  return { place, km: distanceKm(at, place), detail: detail || undefined }
}

async function wikiNearby(at: LatLng, radiusM: number, signal?: AbortSignal): Promise<NearbyResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    generator: 'geosearch',
    ggscoord: `${at.lat}|${at.lng}`,
    ggsradius: String(Math.min(radiusM, 10000)),
    ggslimit: '25',
    prop: 'coordinates|description|langlinks',
    lllang: 'ja',
  })
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { signal })
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`)
  const pages: { pageid: number; title: string; description?: string; coordinates?: { lat: number; lon: number }[]; langlinks?: { title: string }[] }[] =
    (await res.json()).query?.pages ?? []
  const results: NearbyResult[] = pages
    .filter((p) => p.coordinates?.[0])
    .map((p) => {
      const c = p.coordinates![0]
      const place = makePlace(`wiki-${p.pageid}`, p.title, p.langlinks?.[0]?.title ?? p.title, c.lat, c.lon, 'Landmark', {
        wiki: p.title,
        description: p.description ?? '',
        kind: 'sight',
        suggestedMin: 30,
      })
      return { place, km: distanceKm(at, place), detail: p.description }
    })
  // Photos with author/licence credit, in two extra requests.
  try {
    const photos = await fetchPhotoInfo(results.map((r) => r.place.wiki!), signal)
    results.forEach((r) => (r.photo = photos[r.place.wiki!] ?? null))
  } catch {
    // Photos are optional.
  }
  return results
}

/** Places of one category around a point, nearest first. */
export async function findNearby(cat: Category, at: LatLng, signal?: AbortSignal): Promise<NearbyResult[]> {
  let results: NearbyResult[]
  if (cat.id === 'landmarks') {
    results = await wikiNearby(at, cat.radiusM, signal)
  } else {
    const around = `(around:${cat.radiusM},${at.lat.toFixed(5)},${at.lng.toFixed(5)})`
    const q = `[out:json][timeout:20];(${cat.filters!.map((f) => `nwr${around}${f};`).join('')});out center 60;`
    results = (await overpass(q, signal)).map((el) => osmToResult(el, at, cat)).filter((r): r is NearbyResult => !!r)
  }
  const seen = new Set<string>()
  return results
    .sort((a, b) => a.km - b.km)
    .filter((r) => {
      // Collapse duplicates (same name within ~50 m).
      const k = `${r.place.nameJa}|${r.place.lat.toFixed(3)}|${r.place.lng.toFixed(3)}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, 30)
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_type: string
    osm_id: number
    name?: string
    street?: string
    housenumber?: string
    district?: string
    locality?: string
    city?: string
    countrycode?: string
    osm_value?: string
  }
}

const photonArea = (p: PhotonFeature['properties']) => [p.district ?? p.locality, p.city].filter(Boolean).join(', ')

/** Free-text place search, biased towards a point. Japan only. */
export async function searchPlaces(q: string, near: LatLng | null, signal?: AbortSignal): Promise<NearbyResult[]> {
  const params = new URLSearchParams({ q, limit: '12', lang: 'en' })
  if (near) {
    params.set('lat', String(near.lat))
    params.set('lon', String(near.lng))
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal })
  if (!res.ok) throw new Error(`Search ${res.status}`)
  const feats: PhotonFeature[] = (await res.json()).features ?? []
  const origin = near ?? { lat: 35.68, lng: 139.76 }
  return feats
    .filter((f) => f.properties.countrycode === 'JP')
    .map((f) => {
      const [lng, lat] = f.geometry.coordinates
      const p = f.properties
      const name = p.name || [p.street, p.housenumber].filter(Boolean).join(' ') || q
      const place = makePlace(`osm-${p.osm_type}-${p.osm_id}`, name, name, lat, lng, photonArea(p), {
        description: photonArea(p),
        suggestedMin: 30,
      })
      return { place, km: distanceKm(origin, place), detail: [p.osm_value?.replace(/_/g, ' '), photonArea(p)].filter(Boolean).join(' · ') }
    })
}

/** Street / neighbourhood name for a position, for "Where am I?". */
export async function reverseGeocode(at: LatLng, signal?: AbortSignal): Promise<string | null> {
  const res = await fetch(`https://photon.komoot.io/reverse?lat=${at.lat}&lon=${at.lng}&lang=en`, { signal })
  if (!res.ok) return null
  const p: PhotonFeature['properties'] | undefined = (await res.json()).features?.[0]?.properties
  if (!p) return null
  const first = p.name ?? p.street
  return [first, p.district ?? p.locality, p.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || null
}
