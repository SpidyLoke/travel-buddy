import { Car, Footprints, Map as MapIcon } from 'lucide-react'
import { useState } from 'react'
import { getPlace, placeLabel } from '../data/places'
import { hasCoords, homePlace } from '../lib/home'
import { distanceKm } from '../lib/geo'
import { herePlace } from '../lib/schedule'
import { routeParts } from '../lib/maps'
import { dateLabel } from '../lib/time'
import type { ItineraryState, LatLng, Place } from '../types'
import { LinkButton, Sheet } from './ui'

interface Props {
  /** Every day of the trip; the open day is passed live. */
  days: ItineraryState[]
  active: number
  gps: LatLng | null
  onClose: () => void
}

/** The places of one day in order: start, every stop not skipped, and home. */
function dayPoints(day: ItineraryState, onlyLeft: boolean, gps: LatLng | null): Place[] {
  const stops = day.stops.filter((s) => s.status === 'pending' || (!onlyLeft && s.status === 'done')).map((s) => getPlace(s.placeId))
  const home = homePlace(day)
  const start = onlyLeft && gps ? herePlace(gps) : onlyLeft && day.stops.some((s) => s.status === 'done') ? getPlace(day.stops.filter((s) => s.status === 'done').at(-1)!.placeId) : getPlace(day.startPlaceId)
  const end = day.home && (hasCoords(home) || home.mapsQuery) ? [home] : []
  const pts = [start, ...stops, ...end]
  // Drop repeats in a row (e.g. a day that starts at home and the "home" stop).
  return pts.filter((p, i) => i === 0 || p.mapsQuery !== pts[i - 1].mapsQuery)
}

/** Opens a whole day (or what's left of it) as routes in Google Maps. */
export function RouteSheet({ days, active, gps, onClose }: Props) {
  const [dayIdx, setDayIdx] = useState(active)
  const day = days[dayIdx] ?? days[active]
  const started = day.stops.some((s) => s.status !== 'pending')
  const [onlyLeft, setOnlyLeft] = useState(started)
  const points = dayPoints(day, onlyLeft && started, dayIdx === active ? gps : null)
  // Walking for a compact day, driving (taxi) when any hop is long.
  const longHop = points.some((p, i) => i > 0 && distanceKm(points[i - 1], p) > 2.5)
  const [mode, setMode] = useState<'walking' | 'driving' | null>(null)
  const m = mode ?? (longHop ? 'driving' : 'walking')
  const parts = points.length > 1 ? routeParts(points, m) : []
  const seg = (on: boolean) => `flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[14px] font-semibold ${on ? 'bg-accent text-white' : 'text-muted'}`

  return (
    <Sheet title="Route in Google Maps" onClose={onClose}>
      <div className="space-y-3">
        {days.length > 1 && (
          <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
            <div className="flex gap-2 w-max">
              {days.map((d, i) => (
                <button key={d.date ?? i} onClick={() => setDayIdx(i)} className={`rounded-2xl px-3.5 py-2 text-left ${i === dayIdx ? 'bg-accent text-white' : 'bg-card'}`}>
                  <div className="text-[13px] font-bold">Day {i + 1}</div>
                  <div className="text-[12px] opacity-80">{d.date ? dateLabel(d.date) : `${d.stops.length} stops`}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex rounded-2xl bg-card p-1">
          <button className={seg(m === 'walking')} onClick={() => setMode('walking')}>
            <Footprints size={16} /> Walk
          </button>
          <button className={seg(m === 'driving')} onClick={() => setMode('driving')}>
            <Car size={16} /> Drive / taxi
          </button>
        </div>
        {started && (
          <div className="flex rounded-2xl bg-card p-1">
            <button className={seg(!onlyLeft)} onClick={() => setOnlyLeft(false)}>
              Whole day
            </button>
            <button className={seg(onlyLeft)} onClick={() => setOnlyLeft(true)}>
              Only what's left
            </button>
          </div>
        )}
        {parts.length === 0 && <p className="px-1 text-[15px] text-muted">Nothing to route for this day.</p>}
        {parts.map((part, i) => (
          <LinkButton key={i} variant={i === 0 ? 'primary' : 'secondary'} className="w-full !justify-start text-left !py-3 !min-h-14" href={part.url}>
            <MapIcon size={18} className="shrink-0" />
            <span className="min-w-0">
              <span className="block text-[13px] opacity-80">{parts.length > 1 ? `Part ${i + 1} of ${parts.length}` : 'Whole route'}</span>
              <span className="block truncate">{part.points.map((p) => placeLabel(p)).join(' → ')}</span>
            </span>
          </LinkButton>
        ))}
        <p className="px-1 text-[12px] text-muted">
          Google Maps on a phone takes only a few stops per route, so longer days open as parts: each starts where the last one ended. For trains and buses
          between stops, use Navigate on each stop instead (public-transport routes can't include stops in between).
        </p>
      </div>
    </Sheet>
  )
}
