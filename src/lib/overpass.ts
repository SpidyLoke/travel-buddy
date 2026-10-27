// OpenStreetMap data through the Overpass API (free, keyless, CORS-enabled).
// Public servers sometimes queue a request for half a minute, so the second
// server is asked too if the first hasn't answered within a few seconds (or
// fails), whichever answers first wins, and everything stops at a hard limit.

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
/** Ask the second server too after this long without an answer. */
const HEDGE_MS = 3500

export interface OsmElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export async function overpass(query: string, signal?: AbortSignal, timeoutMs = 15000): Promise<OsmElement[]> {
  const ctrl = new AbortController()
  const stop = () => ctrl.abort()
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  signal?.addEventListener('abort', stop)
  const timer = setTimeout(stop, timeoutMs)
  const run = async (url: string) => {
    const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), signal: ctrl.signal })
    if (!res.ok) throw new Error(`Overpass ${res.status}`)
    return ((await res.json()).elements ?? []) as OsmElement[]
  }
  let startSecond = () => {}
  const second = new Promise<void>((go) => {
    startSecond = go
    setTimeout(go, HEDGE_MS)
  }).then(() => (ctrl.signal.aborted ? Promise.reject(new Error('done')) : run(OVERPASS[1])))
  const first = run(OVERPASS[0]).catch((e) => {
    startSecond()
    throw e
  })
  try {
    return await Promise.any([first, second])
  } catch {
    throw signal?.aborted ? new DOMException('Aborted', 'AbortError') : new Error('OpenStreetMap did not answer in time')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', stop)
    // Cancel whichever request is still running.
    ctrl.abort()
  }
}
