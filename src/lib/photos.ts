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

interface Cache {
  at: number
  photos: Record<string, Photo | null>
}

const KEY = 'tokyo-day:photos:v1'
const TTL = 7 * 24 * 60 * 60 * 1000
const WIKI = 'https://en.wikipedia.org/w/api.php'
const COMMONS = 'https://commons.wikimedia.org/w/api.php'

export function cachedPhotos(): Record<string, Photo | null> | null {
  const c = load<Cache | null>(KEY, null)
  return c && Date.now() - c.at < TTL ? c.photos : null
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

const plainText = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? ''

/** Destination photos, cached for a week. */
export async function fetchPhotos(titles: string[], signal?: AbortSignal): Promise<Record<string, Photo | null>> {
  const out = await fetchPhotoInfo(titles, signal)
  save<Cache>(KEY, { at: Date.now(), photos: out })
  return out
}

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
      byTitle.set(p.title, {
        url: ii.thumburl,
        width: ii.thumbwidth,
        height: ii.thumbheight,
        artist: plainText(ii.extmetadata?.Artist?.value ?? '') || 'Unknown author',
        license: ii.extmetadata?.LicenseShortName?.value ?? 'see file page',
        page: ii.descriptionurl,
      })
    }
    for (const f of files) {
      const photo = byTitle.get(toFile(f))
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
