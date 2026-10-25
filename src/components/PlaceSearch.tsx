import { Crosshair, LoaderCircle, MapPin, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Geo } from '../hooks/useGeolocation'
import { searchPlaces, type NearbyResult } from '../lib/nearby'
import type { Place } from '../types'

interface Props {
  geo: Geo
  placeholder?: string
  onPick: (p: Place) => void
}

/** Search box for any place in Japan, plus "use my current location". */
export function PlaceSearch({ geo, placeholder = 'Hotel name or address', onPick }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<NearbyResult[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [wantHere, setWantHere] = useState(false)

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setState('loading')
      searchPlaces(query, geo.position, ctrl.signal)
        .then((r) => {
          setResults(r)
          setState('idle')
        })
        .catch(() => !ctrl.signal.aborted && setState('error'))
    }, 400)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, geo.position])

  // "Use my location" waits for the first GPS fix.
  useEffect(() => {
    if (wantHere && geo.position) {
      setWantHere(false)
      const { lat, lng } = geo.position
      onPick({
        id: 'here-pick',
        name: 'My accommodation',
        nameJa: '宿泊先',
        mapsQuery: `${lat.toFixed(6)},${lng.toFixed(6)}`,
        lat,
        lng,
        area: '',
        description: '',
        activities: [],
        suggestedMin: 0,
        nearestStation: '',
        custom: true,
      })
    }
  }, [wantHere, geo.position, onPick])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-2xl bg-card px-3">
        <Search size={18} className="text-muted shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          enterKeyHint="search"
          className="flex-1 bg-transparent py-3 text-[16px] outline-none"
        />
        {state === 'loading' && <LoaderCircle size={18} className="animate-spin text-muted" />}
        {q && state !== 'loading' && (
          <button aria-label="Clear" onClick={() => setQ('')}>
            <X size={18} className="text-muted" />
          </button>
        )}
      </div>
      <button
        onClick={() => {
          setWantHere(true)
          if (!geo.position) geo.start()
        }}
        className="flex w-full items-center gap-2 rounded-2xl bg-card px-4 py-3 text-left text-[15px] font-semibold text-accent"
      >
        <Crosshair size={18} /> {wantHere && !geo.position ? 'Finding you…' : "I'm there now: use my location"}
      </button>
      {(geo.status === 'denied' || geo.status === 'unavailable') && wantHere && (
        <p className="px-1 text-[13px] text-bad">Location is unavailable. Search by name instead.</p>
      )}
      {state === 'error' && <p className="px-1 text-[13px] text-bad">Search is unavailable right now. Check your connection.</p>}
      {results.map((r) => (
        <button key={r.place.id} onClick={() => onPick(r.place)} className="flex w-full items-start gap-3 rounded-2xl bg-card px-4 py-3 text-left">
          <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
          <span className="min-w-0">
            <span className="block font-semibold">{r.place.name}</span>
            {r.detail && <span className="block text-[13px] text-muted truncate">{r.detail}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
