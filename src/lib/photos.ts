import type { Place } from '../types'
import { distanceKm } from './geo'
import { load, save } from './storage'

// Lead images of English Wikipedia articles. `pilicense=free` restricts these
// to freely licensed files, and the credit (author + licence) comes from the
// file's Wikimedia Commons metadata, as the CC licences require.

export interface Photo {
  url: string
  width: number
  height: number
  artist: string
  license: string
  /** Commons file page, linked from the credit. */
  page: string
}

interface Entry {
  at: number
  photo: Photo | null
}

const KEY = 'tokyo-day:photos:v2'
const TTL = 7 * 24 * 60 * 60 * 1000
const WIKI = 'https://en.wikipedia.org/w/api.php'
const COMMONS = 'https://commons.wikimedia.org/w/api.php'

/** Saved photos by place id, dropping stale entries. */
export function loadPhotoCache(): Record<string, Photo | null> {
  const all = load<Record<string, Entry>>(KEY, {})
  const now = Date.now()
  return Object.fromEntries(Object.entries(all).filter(([, e]) => now - e.at < TTL).map(([id, e]) => [id, e.photo]))
}

function savePhotoCache(found: Record<string, Photo | null>) {
  const all = load<Record<string, Entry>>(KEY, {})
  const at = Date.now()
  for (const [id, photo] of Object.entries(found)) all[id] = { at, photo }
  save(KEY, all)
}

const api = (base: string, params: Record<string, string>) =>
  `${base}?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params })}`

/** Follows the API's normalisation and redirect maps back to the title we asked for. */
function resolver(query: { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[] }) {
  const n = new Map((query.normalized ?? []).map((x) => [x.from, x.to]))
  const r = new Map((query.redirects ?? []).map((x) => [x.from, x.to]))
  return (t: string) => {
    const a = n.get(t) ?? t
    return r.get(a) ?? a
  }
}

/** File titles come back with spaces; page images are named with underscores. */
const spaced = (t: string) => t.replace(/_/g, ' ')

const plainText = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? ''


/** Lead photo and credit for each article title. Not cached. */
export async function fetchPhotoInfo(titles: string[], signal?: AbortSignal): Promise<Record<string, Photo | null>> {
  const unique = [...new Set(titles)]
  const res = await fetch(api(WIKI, { prop: 'pageimages', piprop: 'name', pilicense: 'free', redirects: '1', titles: unique.join('|') }), { signal })
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`)
  const wiki = (await res.json()).query ?? {}
  const toFinal = resolver(wiki)
  const fileByPage = new Map<string, string>()
  for (const p of wiki.pages ?? []) if (p.pageimage) fileByPage.set(p.title, `File:${p.pageimage}`)

  const files = [...new Set(fileByPage.values())]
  const infoByFile = new Map<string, Photo>()
  if (files.length) {
    const res2 = await fetch(
      api(COMMONS, {
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        iiurlwidth: '800',
        iiextmetadatafilter: 'Artist|LicenseShortName',
        titles: files.join('|'),
      }),
      { signal },
    )
    if (!res2.ok) throw new Error(`Commons ${res2.status}`)
    const commons = (await res2.json()).query ?? {}
    const toFile = resolver(commons)
    const byTitle = new Map<string, Photo>()
    for (const p of commons.pages ?? []) {
      const ii = p.imageinfo?.[0]
      if (!ii?.thumburl) continue
      byTitle.set(spaced(p.title), {
        url: ii.thumburl,
        width: ii.thumbwidth,
        height: ii.thumbheight,
        artist: plainText(ii.extmetadata?.Artist?.value ?? '') || 'Unknown author',
        license: ii.extmetadata?.LicenseShortName?.value ?? 'see file page',
        page: ii.descriptionurl,
      })
    }
    for (const f of files) {
      const photo = byTitle.get(spaced(toFile(f)))
      if (photo) infoByFile.set(f, photo)
    }
  }

  const out: Record<string, Photo | null> = {}
  for (const t of unique) {
    const file = fileByPage.get(toFinal(t))
    out[t] = (file && infoByFile.get(file)) || null
  }
  return out
}

/** Best-effort article title for a place with no (or a photo-less) wiki title: name search, sanity-checked by distance. */
async function searchArticle(place: Place, signal?: AbortSignal): Promise<string | null> {
  const res = await fetch(
    api(WIKI, { generator: 'search', gsrsearch: `${place.name} Tokyo`, gsrlimit: '3', prop: 'pageimages|coordinates', piprop: 'name', pilicense: 'free' }),
    { signal },
  )
  if (!res.ok) return null
  const pages: { title: string; index: number; pageimage?: string; coordinates?: { lat: number; lon: number }[] }[] = (await res.json()).query?.pages ?? []
  const hit = pages
    .sort((a, b) => a.index - b.index)
    .find((p) => {
      const c = p.coordinates?.[0]
      // Only accept an article about something near this place.
      return p.pageimage && c && distanceKm(place, { lat: c.lat, lng: c.lon }) < 1.5
    })
  return hit?.title ?? null
}

/**
 * Photos for places, by place id. Uses each place's wiki title, falls back to
 * a name search near the place, credits from Commons. Saved for a week.
 */
export async function resolvePhotos(places: Place[], signal?: AbortSignal): Promise<Record<string, Photo | null>> {
  const byTitle = await fetchPhotoInfo(places.flatMap((p) => (p.wiki ? [p.wiki] : [])), signal)
  const out: Record<string, Photo | null> = {}
  const missing: Place[] = []
  for (const p of places) {
    const photo = p.wiki ? byTitle[p.wiki] : null
    if (photo) out[p.id] = photo
    else missing.push(p)
  }
  // Fallback searches, a few at a time.
  const titles = new Map<string, string>()
  for (let i = 0; i < missing.length; i += 4) {
    await Promise.all(
      missing.slice(i, i + 4).map(async (p) => {
        const t = await searchArticle(p, signal).catch(() => null)
        if (t) titles.set(p.id, t)
      }),
    )
  }
  const fallback = titles.size ? await fetchPhotoInfo([...titles.values()], signal) : {}
  for (const p of missing) {
    const t = titles.get(p.id)
    out[p.id] = (t && fallback[t]) || null
  }
  savePhotoCache(out)
  return out
}
