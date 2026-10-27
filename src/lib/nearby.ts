import type { LatLng, Place } from '../types'
import { distanceKm } from './geo'
import { fetchPhotoInfo, type Photo } from './photos'
import { classify } from './discover'
import { osmThingsToDo, samePlace, shoppingAreas, SHOP_FILTER } from './osmPlaces'
import { overpass, type OsmElement } from './overpass'

export { overpass, type OsmElement }

// Live, key-free data sources, all CORS-enabled:
//   OpenStreetMap via Overpass  – shops, food, toilets, ATMs… around a point
//   Wikipedia geosearch         – landmarks around a point, with free-licence photos
//   Photon (komoot)             – place search and reverse geocoding on OSM data
// Results are whatever OSM/Wikipedia hold today: coverage varies, and opening
// hours come from OSM tags when present.

export type CategoryId =
  | 'todo'
  | 'shopping'
  | 'food'
  | 'halal'
  | 'vegetarian'
  | 'prayer'
  | 'cafe'
  | 'konbini'
  | 'souvenirs'
  | 'donki'
  | 'ramen'
  | 'toilets'
  | 'atm'
  | 'drugstore'
  | 'lockers'
  | 'station'

export interface Category {
  id: CategoryId
  label: string
  /** Label outside Japan, when different. */
  labelAbroad?: string
  /** First search radius; widened automatically when little turns up. */
  radiusM: number
  /** Widest search when the first finds little (small towns, countryside). */
  maxRadiusM: number
  /** Overpass filter(s); each is applied with the around() clause. */
  filters?: string[]
  note?: string
  noteAbroad?: string
  /** Only offered in Japan (Don Quijote, ramen, coin lockers). */
  japanOnly?: boolean
}

export const CATEGORIES: Category[] = [
  { id: 'todo', label: 'Things to do', radiusM: 2000, maxRadiusM: 15000, note: 'Landmarks from Wikipedia and attractions mapped on OpenStreetMap.' },
  {
    id: 'shopping',
    label: 'Shopping areas',
    radiusM: 1500,
    maxRadiusM: 10000,
    note: 'Shops close together grouped into one area to wander, plus malls and outlets. Add an area to your day as one stop.',
  },
  { id: 'food', label: 'Food', radiusM: 600, maxRadiusM: 5000, filters: ['["amenity"~"^(restaurant|fast_food|food_court)$"]'] },
  {
    id: 'halal',
    label: 'Halal',
    radiusM: 2000,
    maxRadiusM: 10000,
    filters: ['["diet:halal"~"yes|only"]', '["cuisine"~"halal",i]', '["name"~"halal|ハラル",i]'],
    note: 'From OpenStreetMap tags: confirm halal status with the restaurant.',
    noteAbroad: 'From OpenStreetMap tags. In Malaysia look for the JAKIM halal certificate; many places are halal without being tagged.',
  },
  {
    id: 'vegetarian',
    label: 'Vegetarian',
    radiusM: 1500,
    maxRadiusM: 8000,
    filters: ['["diet:vegetarian"~"yes|only"]', '["diet:vegan"~"yes|only"]', '["cuisine"~"vegetarian|vegan",i]'],
  },
  {
    id: 'prayer',
    label: 'Prayer space',
    radiusM: 5000,
    maxRadiusM: 20000,
    filters: ['["amenity"="place_of_worship"]["religion"="muslim"]', '["amenity"="prayer_room"]'],
    note: 'Mosques and mapped prayer rooms. Many stations and department stores have prayer rooms too: ask at information.',
    noteAbroad: 'Mosques and mapped prayer rooms (surau). Malls and petrol stations often have one: ask or look for the signs.',
  },
  { id: 'cafe', label: 'Café', radiusM: 700, maxRadiusM: 5000, filters: ['["amenity"="cafe"]'] },
  {
    id: 'konbini',
    label: 'Konbini',
    labelAbroad: 'Convenience',
    radiusM: 700,
    maxRadiusM: 5000,
    filters: ['["shop"="convenience"]'],
    note: 'Food, drinks, toilets in many, and 7-Eleven ATMs.',
    noteAbroad: 'Snacks, drinks, SIM top-ups and often an ATM.',
  },
  { id: 'souvenirs', label: 'Souvenirs', radiusM: 900, maxRadiusM: 8000, filters: ['["shop"="gift"]', '["shop"="souvenir"]'] },
  {
    id: 'donki',
    label: 'Don Quijote',
    radiusM: 4000,
    maxRadiusM: 15000,
    filters: ['["name"~"ドン・キホーテ|ドンキ|Don Quijote|DONKI",i]', '["brand"~"ドン・キホーテ|Don Quijote",i]'],
    japanOnly: true,
  },
  { id: 'ramen', label: 'Ramen', radiusM: 1200, maxRadiusM: 6000, filters: ['["cuisine"~"ramen",i]'], japanOnly: true },
  {
    id: 'toilets',
    label: 'Toilets',
    radiusM: 800,
    maxRadiusM: 4000,
    filters: ['["amenity"="toilets"]'],
    note: 'Stations, parks and department stores almost always have free toilets too.',
    noteAbroad: 'Malls, petrol stations and big mosques usually have toilets; some charge a small fee.',
  },
  {
    id: 'atm',
    label: 'ATM',
    radiusM: 1000,
    maxRadiusM: 6000,
    filters: ['["amenity"="atm"]', '["amenity"="bureau_de_change"]'],
    note: '7-Eleven (Seven Bank) ATMs generally accept overseas cards.',
    noteAbroad: 'ATMs and money changers. Bank ATMs inside malls are the safest bet.',
  },
  { id: 'drugstore', label: 'Pharmacy', radiusM: 900, maxRadiusM: 6000, filters: ['["shop"="chemist"]', '["amenity"="pharmacy"]'] },
  {
    id: 'lockers',
    label: 'Lockers',
    radiusM: 1200,
    maxRadiusM: 4000,
    filters: ['["amenity"="locker"]', '["amenity"="luggage_locker"]'],
    note: 'Coin lockers are mostly inside stations; OSM only lists some.',
    japanOnly: true,
  },
  { id: 'station', label: 'Stations', radiusM: 1500, maxRadiusM: 10000, filters: ['["railway"="station"]', '["amenity"="bus_station"]'] },
]

/** Categories for where the plan is, with local labels and notes. */
export function categoriesFor(inJapan: boolean): Category[] {
  return CATEGORIES.filter((c) => inJapan || !c.japanOnly).map((c) =>
    inJapan ? c : { ...c, label: c.labelAbroad ?? c.label, note: c.noteAbroad ?? (c.note?.includes('7-Eleven') || c.note?.includes('Coin') ? undefined : c.note) },
  )
}

export interface NearbyResult {
  place: Place
  km: number
  /** Extra line such as cuisine or opening hours (from OSM tags). */
  detail?: string
  photo?: Photo | null
}


export function makePlace(id: string, name: string, nameJa: string, lat: number, lng: number, area: string, extra: Partial<Place> = {}): Place {
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

function osmToResult(el: OsmElement, at: LatLng, cat: Category): NearbyResult | null {
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  const t = el.tags ?? {}
  const ja = t.name ?? t['name:ja'] ?? t.brand
  if (lat == null || lng == null || !ja) return null
  const en = t['name:en'] ?? t['brand:en'] ?? t['name:ja-Latn'] ?? ja
  const detail = [t.cuisine?.replace(/;/g, ', '), t.opening_hours ? `Hours (OSM): ${t.opening_hours}` : undefined].filter(Boolean).join(' · ')
  const place = makePlace(`osm-${el.type}-${el.id}`, en, ja, lat, lng, cat.label, {
    kind: cat.id === 'todo' ? 'sight' : 'shop',
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

async function searchOnce(cat: Category, at: LatLng, radiusM: number, signal?: AbortSignal): Promise<NearbyResult[]> {
  if (cat.id === 'todo') {
    const [wiki, osm] = await Promise.all([wikiNearby(at, radiusM, signal).catch(() => null), osmThingsToDo(at, radiusM, 0, signal, 8000).catch(() => null)])
    if (!wiki && !osm) throw new Error('Nothing reachable')
    const sights = (wiki ?? []).filter((r) => classify(r.place.description, r.place.name))
    const extra = (osm?.attractions ?? []).filter((p) => !sights.some((r) => samePlace(r.place, p)))
    return [...sights, ...extra.map((p) => ({ place: p, km: distanceKm(at, p), detail: [p.area, p.hours].filter(Boolean).join(' · ') }))]
  }
  if (cat.id === 'shopping') {
    const pt = `${at.lat.toFixed(5)},${at.lng.toFixed(5)}`
    const els = await overpass(`[out:json][timeout:25];(nwr${SHOP_FILTER}(around:${radiusM},${pt});nwr["amenity"="marketplace"]["name"](around:${radiusM},${pt}););out center tags 2000;`, signal)
    const markets = els
      .filter((e) => e.tags?.amenity === 'marketplace')
      .map((el) => osmToResult(el, at, cat))
      .filter((r): r is NearbyResult => !!r)
    const areas = shoppingAreas(els.filter((e) => e.tags?.shop)).map((p) => ({ place: p, km: distanceKm(at, p), detail: p.description }))
    return [...areas, ...markets]
  }
  const around = `(around:${radiusM},${at.lat.toFixed(5)},${at.lng.toFixed(5)})`
  const q = `[out:json][timeout:20];(${cat.filters!.map((f) => `nwr${around}${f};`).join('')});out center 60;`
  return (await overpass(q, signal)).map((el) => osmToResult(el, at, cat)).filter((r): r is NearbyResult => !!r)
}

/**
 * Places of one category around a point, nearest first. When little turns up
 * (a small town, the countryside) the search widens up to the category's limit.
 */
export async function findNearby(cat: Category, at: LatLng, signal?: AbortSignal): Promise<{ results: NearbyResult[]; radiusM: number }> {
  let radiusM = cat.radiusM
  let results = await searchOnce(cat, at, radiusM, signal)
  // A few shopping areas is plenty; single shops and sights want a few more to choose from.
  const enough = cat.id === 'shopping' ? 3 : 5
  // Straight to the widest search rather than creeping outwards: one more request at most.
  if (results.length < enough && radiusM < cat.maxRadiusM) {
    radiusM = cat.maxRadiusM
    results = await searchOnce(cat, at, radiusM, signal)
  }
  const seen = new Set<string>()
  const sorted = results
    .sort((a, b) => a.km - b.km)
    .filter((r) => {
      // Collapse duplicates (same name within ~50 m).
      const k = `${r.place.nameJa || r.place.name}|${r.place.lat.toFixed(3)}|${r.place.lng.toFixed(3)}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  // Shopping: the biggest areas matter more than the nearest single shop.
  if (cat.id === 'shopping') sorted.sort((a, b) => (b.place.score ?? 0) - (a.place.score ?? 0) || a.km - b.km)
  return { results: sorted.slice(0, 30), radiusM }
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
    country?: string
    osm_value?: string
  }
}

const photonArea = (p: PhotonFeature['properties']) => [p.district ?? p.locality, p.city].filter(Boolean).join(', ')

/** Free-text place search anywhere, biased towards a point. */
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
  return feats.map((f) => {
      const [lng, lat] = f.geometry.coordinates
      const p = f.properties
      const name = p.name || [p.street, p.housenumber].filter(Boolean).join(' ') || q
      const place = makePlace(`osm-${p.osm_type}-${p.osm_id}`, name, name, lat, lng, photonArea(p), {
        description: photonArea(p),
        suggestedMin: 30,
        country: p.countrycode?.toUpperCase(),
      })
      return { place, km: distanceKm(origin, place), detail: [p.osm_value?.replace(/_/g, ' '), photonArea(p), p.country].filter(Boolean).join(' · ') }
    })
}

/** ISO country code at a point, from Photon. */
export async function countryAt(at: LatLng, signal?: AbortSignal): Promise<string | null> {
  const res = await fetch(`https://photon.komoot.io/reverse?lat=${at.lat}&lon=${at.lng}&lang=en`, { signal })
  if (!res.ok) return null
  const cc: string | undefined = (await res.json()).features?.[0]?.properties?.countrycode
  return cc ? cc.toUpperCase() : null
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
