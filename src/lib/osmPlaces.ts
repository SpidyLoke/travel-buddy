import type { Interest, LatLng, Place, TimeOfDay } from '../types'
import { distanceKm } from './geo'
import { overpass, type OsmElement } from './overpass'
import { fmtMin } from './time'

// Things to do from OpenStreetMap, for places Wikipedia covers thinly (small
// towns, Fuji, suburbs): mapped attractions, plus shopping areas built by
// grouping shops that sit close together ("12 shops on Jalan Alor",
// "AEON Mall and 8 shops around it"). An area is one stop: wander, browse,
// move on, which plans better than a list of single shops.

const CJK = /[぀-ヿ一-鿿]/

/** English name where OSM has one, else romaji, else the local name. */
function names(t: Record<string, string>): { name: string; local: string } | null {
  const local = t.name ?? t.brand
  if (!local) return null
  return { name: t['name:en'] ?? t['brand:en'] ?? t['name:ja-Latn'] ?? t['name:ja_rm'] ?? local, local }
}

const coords = (el: OsmElement): LatLng | null => {
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  return lat == null || lng == null ? null : { lat, lng }
}

/**
 * Opening hours when OSM has one simple daily range ("09:00-17:00",
 * "Mo-Su 10:00-20:00"); anything more involved is shown as text only.
 */
export function simpleHours(oh: string | undefined): [number, number] | null {
  if (!oh || /off|closed|;|,|PH|SH/.test(oh)) return null
  const m = oh.match(/^(?:Mo-Su\s+)?(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const open = +m[1] * 60 + +m[2]
  const close = +m[3] * 60 + +m[4]
  return close > open ? [open, close] : null
}

interface OsmKind {
  match: (t: Record<string, string>) => boolean
  tags: Interest[]
  min: number
  best: TimeOfDay
  score: number
  label: string
  outdoor?: boolean
  open?: [number, number]
}

const KINDS: OsmKind[] = [
  { match: (t) => t.tourism === 'theme_park', tags: ['quirky'], min: 180, best: 'day', score: 3, label: 'Theme park', open: [10 * 60, 18 * 60] },
  { match: (t) => t.leisure === 'water_park', tags: ['quirky'], min: 150, best: 'day', score: 2, label: 'Water park', open: [10 * 60, 18 * 60], outdoor: true },
  { match: (t) => t.tourism === 'zoo' || t.tourism === 'aquarium', tags: ['nature', 'quirky'], min: 120, best: 'day', score: 3, label: 'Zoo / aquarium', open: [9 * 60 + 30, 17 * 60] },
  { match: (t) => t.tourism === 'museum' || t.tourism === 'gallery', tags: ['culture'], min: 60, best: 'day', score: 2, label: 'Museum', open: [10 * 60, 17 * 60] },
  { match: (t) => t.historic === 'castle' || t.historic === 'fort', tags: ['culture', 'views'], min: 60, best: 'day', score: 3, label: 'Castle', outdoor: true },
  { match: (t) => t.tourism === 'viewpoint', tags: ['views'], min: 30, best: 'evening', score: 2, label: 'Viewpoint', outdoor: true },
  { match: (t) => ['waterfall', 'beach', 'cave_entrance'].includes(t.natural), tags: ['nature', 'views'], min: 45, best: 'day', score: 2, label: 'Nature spot', outdoor: true },
  { match: (t) => t.leisure === 'garden', tags: ['nature'], min: 45, best: 'day', score: 2, label: 'Garden', outdoor: true },
  {
    match: (t) => t.amenity === 'public_bath' && (t['bath:type'] === 'onsen' || /onsen|温泉|hot spring/i.test(t.name ?? '')),
    tags: ['nature'],
    min: 90,
    best: 'evening',
    score: 2,
    label: 'Hot spring',
  },
  { match: (t) => t.amenity === 'marketplace', tags: ['food', 'shopping'], min: 45, best: 'day', score: 2, label: 'Market' },
  { match: (t) => t.historic === 'ruins', tags: ['culture'], min: 30, best: 'day', score: 1, label: 'Ruins', outdoor: true },
  { match: (t) => t.tourism === 'attraction' && !t.attraction, tags: ['culture'], min: 40, best: 'day', score: 2, label: 'Attraction' },
]

/** A mapped attraction as a plannable place, or null when it isn't one. */
function attraction(el: OsmElement): Place | null {
  const t = el.tags ?? {}
  const at = coords(el)
  const n = names(t)
  const kind = KINDS.find((k) => k.match(t))
  if (!at || !n || !kind || t.access === 'private') return null
  const hours = simpleHours(t.opening_hours)
  const wiki = t.wikipedia?.startsWith('en:') ? t.wikipedia.slice(3) : undefined
  // Mapped with a Wikipedia/Wikidata link: notable enough to rank a little higher.
  const score = Math.min(4, kind.score + (t.wikidata || t.wikipedia ? 1 : 0))
  // A named "attraction" can still be a temple, lake or tower: refine its interest.
  const nm = `${n.name} ${n.local}`.toLowerCase()
  const tags: Interest[] =
    kind.label === 'Attraction'
      ? /temple|shrine|寺|神社|mosque|church/.test(nm)
        ? ['culture']
        : /lake|湖|falls|滝|park|公園|garden/.test(nm)
          ? ['nature', 'views']
          : /tower|view|展望/.test(nm)
            ? ['views']
            : ['culture', 'quirky']
      : kind.tags
  return {
    id: `osm-${el.type}-${el.id}`,
    name: n.name,
    nameJa: CJK.test(n.local) ? n.local : '',
    mapsQuery: `${at.lat.toFixed(6)},${at.lng.toFixed(6)}`,
    wiki,
    lat: at.lat,
    lng: at.lng,
    area: kind.label,
    description: t.description ?? `${kind.label}${t['addr:city'] ? ` in ${t['addr:city']}` : ''}.`,
    activities: [],
    suggestedMin: kind.min,
    nearestStation: '',
    hours: t.opening_hours ? `${t.opening_hours} (OpenStreetMap)` : undefined,
    opensAt: hours?.[0] ?? kind.open?.[0],
    closesAt: hours?.[1] ?? kind.open?.[1],
    closesLabel: hours ? `closes ${fmtMin(hours[1])} (OpenStreetMap)` : kind.open ? 'hours not known, check before going' : undefined,
    tags,
    score,
    best: kind.best,
    outdoor: kind.outdoor,
    region: 'live',
    custom: true,
    guideOnly: true,
  }
}

// ---- Shopping areas

const SHOP_TYPES: Record<string, string> = {
  mall: 'mall',
  department_store: 'department store',
  clothes: 'clothes',
  shoes: 'fashion',
  bag: 'fashion',
  boutique: 'fashion',
  fashion_accessories: 'fashion',
  jewelry: 'fashion',
  second_hand: 'second-hand',
  charity: 'second-hand',
  gift: 'souvenirs',
  souvenir: 'souvenirs',
  variety_store: 'variety',
  outdoor: 'outdoor & sports',
  sports: 'outdoor & sports',
  books: 'books',
  electronics: 'electronics',
  toys: 'toys & games',
  anime: 'toys & games',
  games: 'toys & games',
  video_games: 'toys & games',
  music: 'music',
  cosmetics: 'cosmetics',
  craft: 'crafts',
  art: 'crafts',
  antiques: 'antiques',
  tea: 'tea & sweets',
  confectionery: 'tea & sweets',
  houseware: 'homeware',
  interior_decoration: 'homeware',
}
export const SHOP_FILTER = `["shop"~"^(${Object.keys(SHOP_TYPES).join('|')})$"]`

interface Shop extends LatLng {
  el: OsmElement
  type: string
  name?: string
  anchor: boolean
}

/** Close enough to walk between in a couple of minutes. */
const AREA_KM = 0.25
const MIN_SHOPS = 4

/** Fast distance for short hops. */
function nearKm(a: LatLng, b: LatLng): number {
  const x = (b.lng - a.lng) * 111.32 * Math.cos((a.lat * Math.PI) / 180)
  const y = (b.lat - a.lat) * 110.57
  return Math.hypot(x, y)
}

function toShops(els: OsmElement[]): Shop[] {
  const out: Shop[] = []
  for (const el of els) {
    const t = el.tags ?? {}
    const type = SHOP_TYPES[t.shop]
    const at = coords(el)
    if (!type || !at) continue
    const n = names(t)
    const anchor = t.shop === 'mall' || t.shop === 'department_store' || /outlet/i.test(t.name ?? '')
    out.push({ ...at, el, type, name: n?.name, anchor })
  }
  return out
}

function areaPlace(members: Shop[]): Place {
  const anchor = members.find((m) => m.anchor && m.name)
  const centre = anchor ?? { lat: members.reduce((a, m) => a + m.lat, 0) / members.length, lng: members.reduce((a, m) => a + m.lng, 0) / members.length }
  const streets = new Map<string, number>()
  members.forEach((m) => {
    const st = m.el.tags?.['addr:street:en'] ?? m.el.tags?.['addr:street']
    if (st) streets.set(st, (streets.get(st) ?? 0) + 1)
  })
  const street = [...streets].sort((a, b) => b[1] - a[1])[0]
  const named = members.filter((m) => m.name)
  // Second-hand and clothing chains are what people go out of their way for.
  const pick = [...named].sort((a, b) => Number(b.type === 'second-hand' || b.type === 'clothes') - Number(a.type === 'second-hand' || a.type === 'clothes'))[0]
  const others = members.length - 1
  const name = anchor
    ? others >= 3
      ? `${anchor.name} and nearby shops`
      : anchor.name!
    : street && street[1] >= 2
      ? `Shops on ${street[0]}`
      : pick
        ? `Shopping around ${pick.name}`
        : 'Shopping area'
  const types = new Map<string, number>()
  members.forEach((m) => types.set(m.type, (types.get(m.type) ?? 0) + 1))
  const topTypes = [...types].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t)
  const n = members.length
  const score = Math.max(anchor ? 3 : 1, n >= 30 ? 4 : n >= 12 ? 3 : n >= 6 ? 2 : 1)
  const listed = named.slice(0, 6).map((m) => `${m.name} (${m.type})`)
  const id = `area-${centre.lat.toFixed(4)}-${centre.lng.toFixed(4)}`
  return {
    id,
    name,
    label: name.length > 28 ? (anchor?.name ?? 'Shopping area') : undefined,
    nameJa: '',
    mapsQuery: `${centre.lat.toFixed(6)},${centre.lng.toFixed(6)}`,
    lat: centre.lat,
    lng: centre.lng,
    area: 'Shopping area',
    description:
      n === 1
        ? `${members[0].type[0].toUpperCase()}${members[0].type.slice(1)}: shops and food under one roof.`
        : `${n} shops within a few minutes' walk: ${topTypes.join(', ')}.`,
    activities: n > 1 && listed.length ? listed : ['Browse the shops', 'Food court or cafés'],
    suggestedMin: Math.min(120, 30 + 3 * n),
    nearestStation: '',
    opensAt: 10 * 60,
    closesAt: anchor ? 21 * 60 : 20 * 60,
    closesLabel: `shops typically close around ${anchor ? '21:00' : '20:00'}, check`,
    tags: ['shopping'],
    score,
    best: 'day',
    group: id,
    region: 'live',
    custom: true,
    guideOnly: true,
  }
}

/** Groups shops that sit close together into areas, biggest first. Lone malls and outlets count as areas too. */
export function shoppingAreas(els: OsmElement[]): Place[] {
  const shops = toShops(els)
  // Neighbours within walking range, found through a grid so big cities stay fast.
  const cell = (p: LatLng) => [Math.floor(p.lat / 0.0025), Math.floor(p.lng / 0.0025)]
  const grid = new Map<string, number[]>()
  shops.forEach((s, i) => {
    const k = cell(s).join()
    grid.set(k, [...(grid.get(k) ?? []), i])
  })
  const near = shops.map((s) => {
    const [a, b] = cell(s)
    const out: number[] = []
    for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) for (const j of grid.get(`${a + da},${b + db}`) ?? []) if (nearKm(s, shops[j]) <= AREA_KM) out.push(j)
    return out
  })
  const free = new Set(shops.map((_, i) => i))
  const count = near.map((n) => n.length)
  const areas: Place[] = []
  for (;;) {
    let best = -1
    for (const i of free) if (best < 0 || count[i] > count[best]) best = i
    if (best < 0 || count[best] < MIN_SHOPS) break
    const members = near[best].filter((j) => free.has(j))
    for (const j of members) {
      free.delete(j)
      for (const k of near[j]) count[k]--
    }
    areas.push(areaPlace(members.map((j) => shops[j])))
  }
  for (const i of free) if (shops[i].anchor && shops[i].name) areas.push(areaPlace([shops[i]]))
  return areas.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}

const ATTRACTION_FILTERS = [
  '["tourism"~"^(attraction|museum|gallery|viewpoint|theme_park|zoo|aquarium)$"]["name"]',
  '["natural"~"^(waterfall|beach|cave_entrance)$"]["name"]',
  '["historic"~"^(castle|fort|ruins)$"]["name"]',
  '["leisure"~"^(water_park|garden)$"]["name"]',
  '["amenity"="public_bath"]["name"]',
  '["amenity"="marketplace"]["name"]',
]

/**
 * Attractions within `radiusM` and shopping areas within `shopRadiusM` of a
 * point, in one Overpass request.
 */
export async function osmThingsToDo(at: LatLng, radiusM: number, shopRadiusM: number, signal?: AbortSignal, timeoutMs?: number): Promise<{ attractions: Place[]; areas: Place[] }> {
  const pt = `${at.lat.toFixed(5)},${at.lng.toFixed(5)}`
  const shops = shopRadiusM > 0 ? `nwr${SHOP_FILTER}(around:${shopRadiusM},${pt});` : ''
  // "qt" skips sorting on the server, which is noticeably quicker for big areas.
  const q = `[out:json][timeout:15];(${ATTRACTION_FILTERS.map((f) => `nwr${f}(around:${radiusM},${pt});`).join('')}${shops});out center qt 2000;`
  const els = await overpass(q, signal, timeoutMs)
  const attractions = els.map(attraction).filter((p): p is Place => !!p)
  return { attractions, areas: shoppingAreas(els.filter((e) => e.tags?.shop)) }
}

/** Same sight under two names (Wikipedia vs OpenStreetMap)? */
export function samePlace(a: Place, b: Place): boolean {
  const d = distanceKm(a, b)
  if (d < 0.12) return true
  if (d > 0.6) return false
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]/g, '')
  const [x, y] = [norm(a.name), norm(b.name)]
  return !!x && !!y && (x.includes(y) || y.includes(x) || (a.wiki != null && a.wiki === b.wiki))
}
