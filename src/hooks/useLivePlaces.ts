import { useEffect, useState } from 'react'
import { cachedNearby, curatedNear, discoverNearby } from '../lib/discover'
import { inJapan } from '../lib/destination'
import type { LatLng, Place } from '../types'

export type LiveStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Things to do around home outside the city guides: built-in ones in reach plus places found live. */
export function useLivePlaces(home: LatLng | null, online: boolean): { places: Place[]; status: LiveStatus } {
  const key = home ? `${home.lat.toFixed(3)},${home.lng.toFixed(3)}` : ''
  const [live, setLive] = useState<{ key: string; places: Place[]; status: LiveStatus }>(() => {
    const cached = home ? cachedNearby(home) : null
    return { key, places: cached ?? [], status: cached ? 'ready' : 'idle' }
  })
  useEffect(() => {
    if (!home) return
    const cached = cachedNearby(home)
    if (cached) setLive({ key, places: cached, status: 'ready' })
    if (!online) {
      if (!cached) setLive({ key, places: [], status: 'error' })
      return
    }
    const ctrl = new AbortController()
    if (!cached) setLive({ key, places: [], status: 'loading' })
    discoverNearby(home, { inJapan: inJapan(), signal: ctrl.signal }).then(
      (places) => setLive({ key, places, status: 'ready' }),
      () => !ctrl.signal.aborted && !cached && setLive({ key, places: [], status: 'error' }),
    )
    return () => ctrl.abort()
  }, [key, online])
  const curated = home ? curatedNear(home) : []
  const places = live.key === key ? live.places : []
  return { places: [...curated, ...places], status: live.key === key ? live.status : 'loading' }
}
