import { PLACES, registerPlace } from '../data/places'
import type { Interest, LatLng, Place, TimeOfDay } from '../types'
import { distanceKm } from './geo'
import { load, save } from './storage'

// Things to do anywhere, found live from Wikipedia: every article with
// coordinates near where you're staying, kept only if its short description
// says it's something to visit (temple, museum, park, market…). Popularity
// comes from the article's page views. Hours are never known here, so every
// place is labelled "check before going".

const WIKI = 'https://en.wikipedia.org/w/api.php'
const KEY = 'tokyo-day:discover:v1'
const TTL = 14 * 24 * 3600 * 1000
/** How far from home places are looked for and planned. */
export const LIVE_KM = 25

interface Kind {
  re: RegExp
  tags: Interest[]
  min: number
  best: TimeOfDay
  outdoor?: boolean
  /** Typical opening window, used only to avoid planning visits at night. */
  open?: [number, number]
  activities: string[]
}

// First match wins, so specific kinds come before general ones.
const KINDS: Kind[] = [
  { re: /amusement park|theme park|water park|funfair/, tags: ['quirky'], min: 180, best: 'day', open: [10 * 60, 18 * 60], activities: ['Rides and shows'] },
  { re: /circuit|speedway|race ?track|raceway|motorsport/, tags: ['quirky'], min: 90, best: 'day', open: [9 * 60, 17 * 60], activities: ['Check the event calendar'] },
  {
    re: /aquarium|\bzoo\b|safari|bird park|wildlife park|butterfly/,
    tags: ['nature', 'quirky'],
    min: 120,
    best: 'day',
    open: [9 * 60 + 30, 17 * 60],
    activities: ['Animals and feeding times'],
  },
  { re: /museum|gallery|art cent(re|er)|science cent(re|er)|exhibition/, tags: ['culture'], min: 75, best: 'day', open: [10 * 60, 17 * 60], activities: ['Exhibits'] },
  { re: /night market|food street|hawker/, tags: ['food', 'nightlife'], min: 60, best: 'night', activities: ['Street food', 'Stalls'] },
  {
    re: /temple|shrine|mosque|church|cathedral|basilica|pagoda|monastery|gurdwara|synagogue|stupa|\bwat\b|chapel/,
    tags: ['culture'],
    min: 40,
    best: 'morning',
    open: [8 * 60, 17 * 60],
    activities: ['Look around', 'Dress modestly'],
  },
  {
    re: /castle|palace|\bfort\b|fortress|ruins|archaeological|heritage site|historic|monument|memorial|mausoleum|\btomb\b|old town/,
    tags: ['culture'],
    min: 50,
    best: 'day',
    activities: ['Look around'],
  },
  {
    re: /tower|skyscraper|observation|observatory|viewpoint|lookout|ropeway|cable car|gondola|sky ?bridge|ferris wheel/,
    tags: ['views'],
    min: 45,
    best: 'evening',
    activities: ['Views'],
  },
  { re: /market|food court|bazaar/, tags: ['food', 'shopping'], min: 45, best: 'day', activities: ['Local food', 'Browse'] },
  { re: /shopping|\bmall\b|arcade|outlet|department store/, tags: ['shopping'], min: 60, best: 'day', open: [10 * 60, 22 * 60], activities: ['Shops', 'Food court'] },
  {
    re: /waterfall|\bfalls\b|gorge|\bcaves?\b|\blakes?\b|\bponds?\b|beach|island|forest|national park|nature park|hot springs?|onsen|botanic|garden|\bparks?\b|wetland|valley|canyon|crater|lagoon|mangrove/,
    tags: ['nature'],
    min: 60,
    best: 'day',
    outdoor: true,
    activities: ['Walk around'],
  },
  {
    re: /chinatown|little india|square|plaza|landmark|street art|mural|waterfront|promenade|pier|boardwalk/,
    tags: ['culture', 'food'],
    min: 40,
    best: 'evening',
    outdoor: true,
    activities: ['Walk around'],
  },
  { re: /nightlife|entertainment district|bar street|nightclub/, tags: ['nightlife'], min: 90, best: 'night', activities: ['Bars and food'] },
]

/** Never things to visit, whatever else the description says. */
const NEVER =
  /station|railway|\bline\b|school|universit|college|hospital|clinic|compan|corporation|airline|airport|expressway|highway|motorway|interchange|\broad\b|tunnel|electoral|constituency|\bhotel\b|condominium|apartment|office|power plant|\bdam\b|factory|cemetery|prison|embassy|consulate|\bbank\b|government|ministry|courthouse|law court|police|footballer|politician|businessman|actor|actress|singer|\bband\b|album|\bfilm\b|television|newspaper|magazine|software|video game|election|battle|disambiguation|list of|car park|parking|residential|housing|\bbus\b/
/** Settlements and areas: dropped unless the description is about the sight itself. */
const AREA = /\b(town|city|village|municipality|district|neighbou?rhood|suburb|township|ward|prefecture|province|state|county|region|commune|area)\b/

/** `text` is "<short description> <title>"; `head` is the description up to " in …". */
export function classify(desc: string, title: string): Kind | null {
  const t = `${desc} ${title}`.toLowerCase()
  if (NEVER.test(t)) return null
  const kind = KINDS.find((k) => k.re.test(t)) ?? null
  if (!kind) return null
  // "city in Tochigi known for its national park" is a place to stay, not a stop;
  // "shopping district in Kuala Lumpur" and "state mosque of Selangor" are stops.
  const head = desc.toLowerCase().split(/\b(?:in|of|on|near|located|at)\b/)[0]
  if (AREA.test(head) && !kind.re.test(head)) return null
  return kind
}

/** Page views a day to a 1–5 recommendation. */
function scoreFor(daily: number): number {
  if (daily >= 3000) return 5
  if (daily >= 800) return 4
  if (daily >= 250) return 3
  if (daily >= 80) return 2
  return 1
}

interface WikiPage {
  pageid: number
  title: string
  description?: string
  coordinates?: { lat: number; lon: number }[]
  pageviews?: Record<string, number | null>
  langlinks?: { lang: string; title: string }[]
  extract?: string
}

async function wikiQuery(params: Record<string, string>, signal?: AbortSignal): Promise<WikiPage[]> {
  const q = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params })
  const res = await fetch(`${WIKI}?${q}`, { signal })
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`)
  return (await res.json()).query?.pages ?? []
}

/** Up to 50 articles within 10 km of a point (Wikipedia's limit per search). */
const around = (at: LatLng, signal?: AbortSignal) =>
  wikiQuery(
    {
      generator: 'geosearch',
      ggscoord: `${at.lat.toFixed(5)}|${at.lng.toFixed(5)}`,
      ggsradius: '10000',
      ggslimit: '50',
      prop: 'coordinates|description|pageviews|langlinks',
      colimit: 'max',
      pvipdays: '30',
      lllang: 'ja',
      lllimit: 'max',
    },
    signal,
  )

/** A centre search plus six around it covers about 25 km. */
function searchPoints(home: LatLng): LatLng[] {
  const R = 14
  const dLat = R / 111
  const dLng = R / (111 * Math.cos((home.lat * Math.PI) / 180))
  return [
    home,
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i * Math.PI) / 3
      return { lat: home.lat + dLat * Math.sin(a), lng: home.lng + dLng * Math.cos(a) }
    }),
  ]
}

/** "Buddhist temple in Fujikawaguchiko, Yamanashi" → "Fujikawaguchiko". */
const areaFrom = (desc: string) => desc.match(/\b(?:in|near|on) ([A-Z][^,;()]+)/)?.[1]?.trim() ?? ''

function toPlace(page: WikiPage, kind: Kind, home: LatLng, inJapan: boolean): Place {
  const c = page.coordinates![0]
  const views = Object.values(page.pageviews ?? {}).filter((v): v is number => v != null)
  const daily = views.length ? views.reduce((a, b) => a + b, 0) / views.length : 0
  const desc = page.description ?? ''
  const area = areaFrom(desc)
  const ja = page.langlinks?.find((l) => l.lang === 'ja')?.title
  const name = page.title.replace(/ \([^)]*\)$/, '')
  return {
    id: `wiki-${page.pageid}`,
    name,
    nameJa: inJapan && ja ? ja : '',
    mapsQuery: area ? `${name}, ${area}` : `${c.lat.toFixed(6)},${c.lon.toFixed(6)}`,
    wiki: page.title,
    lat: c.lat,
    lng: c.lon,
    area: area || `${distanceKm(home, { lat: c.lat, lng: c.lon }).toFixed(0)} km from your stay`,
    description: desc ? desc[0].toUpperCase() + desc.slice(1) + '.' : '',
    activities: kind.activities,
    suggestedMin: kind.min,
    nearestStation: '',
    opensAt: kind.open?.[0],
    closesAt: kind.open?.[1],
    closesLabel: kind.open ? 'hours not known, check before going' : undefined,
    tags: /lake|beach|\bbay\b|island|waterfall|falls/i.test(`${desc} ${page.title}`) && !kind.tags.includes('views') ? [...kind.tags, 'views'] : kind.tags,
    score: scoreFor(daily),
    best: kind.best,
    outdoor: kind.outdoor,
    region: 'live',
    custom: true,
    guideOnly: true,
  }
}

/** First two sentences of each article, to describe the top places. */
async function addExtracts(places: Place[], signal?: AbortSignal): Promise<void> {
  for (let i = 0; i < places.length; i += 20) {
    const batch = places.slice(i, i + 20)
    const pages = await wikiQuery({ prop: 'extracts', exintro: '1', explaintext: '1', exsentences: '2', exlimit: '20', titles: batch.map((p) => p.wiki!).join('|') }, signal).catch(
      () => [],
    )
    for (const pg of pages) {
      const p = batch.find((b) => b.wiki === pg.title)
      if (p && pg.extract)
        p.description = pg.extract
          .replace(/\s*\([^()]*\)/g, '')
          .replace(/\s+/g, ' ')
          .trim()
    }
  }
}

interface CacheEntry {
  key: string
  at: number
  places: Place[]
}

const cacheKey = (home: LatLng) => `${home.lat.toFixed(2)},${home.lng.toFixed(2)}`

/** Places already found near home (no network). Registers them so plans can use them. */
export function cachedNearby(home: LatLng): Place[] | null {
  const hit = load<CacheEntry[]>(KEY, []).find((e) => e.key === cacheKey(home))
  if (!hit) return null
  hit.places.forEach(registerPlace)
  return hit.places
}

/** Curated places that are this close to a live place are the same sight. */
const SAME_KM = 0.3

/**
 * Things to do within ~25 km of home, best first. Cached for two weeks per
 * home; throws only when nothing could be fetched and nothing is cached.
 */
export async function discoverNearby(home: LatLng, opts: { inJapan: boolean; signal?: AbortSignal; fresh?: boolean }): Promise<Place[]> {
  const cache = load<CacheEntry[]>(KEY, [])
  const hit = cache.find((e) => e.key === cacheKey(home))
  if (hit && !opts.fresh && Date.now() - hit.at < TTL) {
    hit.places.forEach(registerPlace)
    return hit.places
  }
  const results = await Promise.allSettled(searchPoints(home).map((p) => around(p, opts.signal)))
  const pages = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  if (!pages.length) {
    if (hit) return hit.places
    throw new Error('Could not reach Wikipedia')
  }
  const curated = PLACES.filter((p) => !p.hidden && distanceKm(p, home) < LIVE_KM + 5)
  const curatedWiki = new Set(curated.map((p) => p.wiki))
  const seen = new Set<number>()
  const found: Place[] = []
  for (const pg of pages) {
    if (seen.has(pg.pageid) || !pg.coordinates?.length) continue
    seen.add(pg.pageid)
    const kind = classify(pg.description ?? '', pg.title)
    if (!kind || curatedWiki.has(pg.title)) continue
    const p = toPlace(pg, kind, home, opts.inJapan)
    if (distanceKm(p, home) > LIVE_KM) continue
    if (curated.some((c) => distanceKm(c, p) < SAME_KM)) continue
    found.push(p)
  }
  found.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const top = found.slice(0, 60)
  await addExtracts(top.slice(0, 40), opts.signal)
  top.forEach(registerPlace)
  save(KEY, [{ key: cacheKey(home), at: Date.now(), places: top }, ...cache.filter((e) => e.key !== cacheKey(home))].slice(0, 4))
  return top
}

/** Curated places (Fuji, Kamakura…) within reach of a home outside the city guides. */
export const curatedNear = (home: LatLng): Place[] => PLACES.filter((p) => !p.hidden && p.tags?.length && p.kind !== 'shop' && distanceKm(p, home) <= LIVE_KM)
