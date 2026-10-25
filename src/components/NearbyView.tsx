import {
  Banknote, Coffee, Crosshair, ExternalLink, Footprints, Gift, House, Landmark, LoaderCircle, Lock, MapPin, Pill, Plus, Search,
  ShoppingBag, Soup, Store, Toilet, TrainFront, Utensils, X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { placeLabel } from '../data/places'
import type { Geo } from '../hooks/useGeolocation'
import type { ItineraryApi } from '../hooks/useItinerary'
import { formatDistance } from '../lib/geo'
import { directionsUrl } from '../lib/maps'
import { CATEGORIES, findNearby, searchPlaces, type CategoryId, type NearbyResult } from '../lib/nearby'
import { luupCost } from '../lib/pricing'
import type { Timeline } from '../lib/schedule'
import { load, save } from '../lib/storage'
import type { LatLng, Place } from '../types'
import { CopyJaButton } from './CopyJaButton'
import { Button, Card, LinkButton, Notice } from './ui'

const ICONS: Record<CategoryId, typeof Store> = {
  landmarks: Landmark,
  donki: ShoppingBag,
  konbini: Store,
  food: Utensils,
  ramen: Soup,
  cafe: Coffee,
  toilets: Toilet,
  atm: Banknote,
  drugstore: Pill,
  lockers: Lock,
  souvenirs: Gift,
  station: TrainFront,
}

const CAT_KEY = 'tokyo-day:nearby-cat'

interface Props {
  geo: Geo
  timeline: Timeline
  itin: ItineraryApi
  online: boolean
  showOnMap: (p: Place) => void
}

type Status = { state: 'idle' | 'loading' | 'done' } | { state: 'error'; message: string }

export function NearbyView({ geo, timeline, itin, online, showOnMap }: Props) {
  const gps = geo.status === 'active' && !geo.outsideTokyo ? geo.position : null
  const next = timeline.nextIndex >= 0 ? timeline.entries[timeline.nextIndex].place : null
  const [around, setAround] = useState<'me' | 'next'>(gps ? 'me' : 'next')
  const centre: LatLng | null = around === 'me' ? gps : next
  const [cat, setCat] = useState<CategoryId>(() => load<CategoryId>(CAT_KEY, 'landmarks'))
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NearbyResult[]>([])
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const [retry, setRetry] = useState(0)
  const searching = query.trim().length >= 2

  // When GPS arrives, switch to "around me" automatically.
  const hadGps = useRef(!!gps)
  useEffect(() => {
    if (gps && !hadGps.current) setAround('me')
    hadGps.current = !!gps
  }, [gps])

  // Round the centre so GPS jitter does not refetch.
  const centreKey = centre ? `${centre.lat.toFixed(3)},${centre.lng.toFixed(3)}` : ''

  useEffect(() => {
    if (!online) return
    if (!searching && !centre) return
    const ctrl = new AbortController()
    const t = setTimeout(
      () => {
        setStatus({ state: 'loading' })
        const job = searching ? searchPlaces(query.trim(), centre, ctrl.signal) : findNearby(CATEGORIES.find((c) => c.id === cat)!, centre!, ctrl.signal)
        job
          .then((r) => {
            setResults(r)
            setStatus({ state: 'done' })
          })
          .catch(() => {
            if (!ctrl.signal.aborted) setStatus({ state: 'error', message: 'Could not reach OpenStreetMap / Wikipedia. Try again, or search in Google Maps.' })
          })
      },
      searching ? 450 : 0,
    )
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
    // `centre` is tracked through centreKey so GPS jitter does not refetch.
  }, [cat, query, searching, centreKey, online, retry])

  const category = CATEGORIES.find((c) => c.id === cat)!
  const inPlan = new Set(itin.state.stops.map((s) => s.placeId))
  const googleFallback = `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: searching ? query : category.label })}`

  return (
    <div className="pt-safe bottom-nav-space px-4">
      <h1 className="pt-2 text-3xl font-bold tracking-tight">Nearby</h1>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-card px-3">
        <Search size={18} className="text-muted shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any place, shop or address"
          enterKeyHint="search"
          className="flex-1 bg-transparent py-3 text-[16px] outline-none"
        />
        {query && (
          <button aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={18} className="text-muted" />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[13px]">
        <span className="text-muted">{searching ? 'Closest to' : 'Around'}</span>
        <button
          onClick={() => (gps ? setAround('me') : geo.start())}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold ${around === 'me' ? 'bg-accent text-white' : 'bg-card'}`}
        >
          <Crosshair size={14} /> {gps ? 'Me' : geo.status === 'locating' ? 'Locating…' : 'Use my location'}
        </button>
        {next && (
          <button
            onClick={() => setAround('next')}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold truncate ${around === 'next' ? 'bg-accent text-white' : 'bg-card'}`}
          >
            <MapPin size={14} /> {placeLabel(next)}
          </button>
        )}
      </div>

      {!searching && (
        <div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none]">
          <div className="flex gap-2 w-max">
            {CATEGORIES.map((c) => {
              const Icon = ICONS[c.id]
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setCat(c.id)
                    save(CAT_KEY, c.id)
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-semibold ${cat === c.id ? 'bg-accent text-white' : 'bg-card'}`}
                >
                  <Icon size={15} /> {c.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {!online && <Notice tone="warn">You are offline. Nearby search needs a connection.</Notice>}
        {online && !searching && !centre && (
          <Notice tone="info">Turn on location, or pick your next stop above, to see what is around.</Notice>
        )}
        {!searching && category.note && status.state === 'done' && <p className="px-1 text-[13px] text-muted">{category.note}</p>}
        {status.state === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted">
            <LoaderCircle size={18} className="animate-spin" /> Looking…
          </div>
        )}
        {status.state === 'error' && (
          <Notice
            tone="warn"
            action={
              <Button className="min-h-9 px-3 text-[13px]" onClick={() => setRetry((n) => n + 1)}>
                Retry
              </Button>
            }
          >
            {status.message}
          </Notice>
        )}
        {status.state === 'done' && results.length === 0 && (
          <Notice tone="info">Nothing found{searching ? '' : ` within ${formatDistance(category.radiusM / 1000)}`}. OpenStreetMap may not list it.</Notice>
        )}
        {status.state === 'done' &&
          results.map((r) => (
            <ResultCard
              key={r.place.id}
              r={r}
              gps={gps}
              inPlan={inPlan.has(r.place.id)}
              onAdd={() => itin.addCustom(r.place)}
              onHome={() => itin.setHome({ name: r.place.name, query: r.place.mapsQuery, lat: r.place.lat, lng: r.place.lng })}
              onMap={() => showOnMap(r.place)}
            />
          ))}
        {online && (status.state === 'done' || status.state === 'error') && (
          <LinkButton className="w-full text-[14px]" href={googleFallback}>
            <ExternalLink size={16} /> Search “{searching ? query : category.label}” in Google Maps
          </LinkButton>
        )}
        <p className="px-1 text-[12px] text-muted">
          Live data from OpenStreetMap contributors and Wikipedia. Coverage varies; hours shown are from OSM and may be out of date.
        </p>
      </div>
    </div>
  )
}

interface ResultProps {
  r: NearbyResult
  gps: LatLng | null
  inPlan: boolean
  onAdd: () => void
  onHome: () => void
  onMap: () => void
}

function ResultCard({ r, gps, inPlan, onAdd, onHome, onMap }: ResultProps) {
  const [more, setMore] = useState(false)
  const [homeSet, setHomeSet] = useState(false)
  const walkMin = Math.max(1, Math.round(((r.km * 1.3) / 4.5) * 60))
  const luupMin = Math.round(((r.km * 1.3) / 12) * 60 + 6)
  const { place } = r
  return (
    <Card className="p-4 space-y-3">
      {r.photo && (
        <figure>
          <img src={r.photo.url} alt={place.name} loading="lazy" className="w-full aspect-[16/9] object-cover rounded-2xl bg-card-2" />
          <figcaption className="mt-1 text-[11px] text-muted truncate">
            Photo:{' '}
            <a href={r.photo.page} target="_blank" rel="noopener noreferrer" className="underline">
              {r.photo.artist}, {r.photo.license}
            </a>{' '}
            · Wikimedia Commons
          </figcaption>
        </figure>
      )}
      <button className="w-full text-left" onClick={() => setMore((v) => !v)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[17px] font-bold leading-tight">{place.name}</div>
            {place.nameJa !== place.name && <div className="text-[14px] text-muted">{place.nameJa}</div>}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[15px] font-bold tabular-nums">{formatDistance(r.km)}</div>
            <div className="text-[12px] text-muted">~{walkMin} min walk</div>
          </div>
        </div>
        {r.detail && <div className="mt-1 text-[13px] text-muted line-clamp-2">{r.detail}</div>}
      </button>
      <div className="grid grid-cols-3 gap-2">
        <LinkButton variant={r.km < 1.5 ? 'primary' : 'secondary'} className="px-2 text-[14px]" href={directionsUrl(place, 'walking', gps)}>
          <Footprints size={16} /> Walk
        </LinkButton>
        <LinkButton variant={r.km >= 1.5 ? 'primary' : 'secondary'} className="px-2 text-[14px]" href={directionsUrl(place, 'transit', gps)}>
          <TrainFront size={16} /> Train
        </LinkButton>
        <Button className="px-2 text-[14px]" onClick={onAdd} disabled={inPlan}>
          <Plus size={16} /> {inPlan ? 'In day' : 'Add'}
        </Button>
      </div>
      {more && (
        <div className="space-y-2">
          {r.km > 1 && r.km < 5 && (
            <p className="text-[13px] text-muted">
              LUUP: about {luupMin} min, ¥{luupCost(luupMin)} on your plan. Find ports in the LUUP app.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button className="text-[14px]" onClick={onMap}>
              <MapPin size={16} /> On map
            </Button>
            <Button
              className="text-[14px]"
              onClick={() => {
                onHome()
                setHomeSet(true)
              }}
            >
              <House size={16} /> {homeSet ? 'Home set' : 'Set as home'}
            </Button>
          </div>
          <CopyJaButton place={place} className="w-full text-[14px]" />
        </div>
      )}
      {!more && (
        <button className="text-[13px] font-semibold text-accent" onClick={() => setMore(true)}>
          More: map, set as home, copy Japanese name
        </button>
      )}
    </Card>
  )
}
