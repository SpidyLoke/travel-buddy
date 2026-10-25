import { Check, MapPin, ShoppingBag, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { getPlace, placeLabel } from '../data/places'
import { distanceKm, formatDistance } from '../lib/geo'
import { directionsUrl } from '../lib/maps'
import type { Timeline } from '../lib/schedule'
import { load, save } from '../lib/storage'
import { fmtMin } from '../lib/time'
import type { LatLng, Place } from '../types'
import { Button, Card, LinkButton } from './ui'

/** Don Quijote stores next to itinerary stops, best first. */
export const DONKI_AT: { stopPlaceId: string; storeId: string; walk: string }[] = [
  { stopPlaceId: 'shinjuku', storeId: 'donki-shinjuku', walk: '~5 min walk from the East Exit' },
  { stopPlaceId: 'shibuya', storeId: 'donki-shibuya', walk: '~5 min walk from the Scramble Crossing' },
]

const DONE_KEY = 'tokyo-day:donki-done'

/** A new plan starts with Donki not yet done. */
export const resetDonki = () => save(DONE_KEY, false)

interface Props {
  timeline: Timeline
  gps: LatLng | null
  showOnMap: (p: Place) => void
}

/** Home card: which Donki to visit given the remaining plan, and when you will be there. */
export function DonkiCard({ timeline, gps, showOnMap }: Props) {
  const [done, setDone] = useState(() => load(DONE_KEY, false))
  const toggle = (v: boolean) => {
    save(DONE_KEY, v)
    setDone(v)
  }

  const pendingAt = (placeId: string) =>
    timeline.entries.find((e, i) => e.place.id === placeId && i >= timeline.nextIndex && timeline.nextIndex >= 0)
  const options = DONKI_AT.map((d) => ({ ...d, store: getPlace(d.storeId), entry: pendingAt(d.stopPlaceId) }))
  const planned = options.filter((o) => o.entry)
  // Best: first store whose stop is still ahead. Otherwise the nearest one.
  const best =
    planned[0] ?? (gps ? [...options].sort((a, b) => distanceKm(gps, a.store) - distanceKm(gps, b.store))[0] : options[0])
  const backup = planned.find((o) => o !== best)
  // Only for plans that pass a store; the Nearby tab finds Donki anywhere else.
  if (!planned.length) return null

  if (done) {
    return (
      <div className="flex items-center justify-between px-1 text-[14px] text-muted">
        <span className="flex items-center gap-1.5">
          <Check size={16} className="text-ok" /> Don Quijote done
        </span>
        <button className="flex items-center gap-1 font-semibold text-accent" onClick={() => toggle(false)}>
          <Undo2 size={14} /> Undo
        </button>
      </div>
    )
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="size-11 shrink-0 rounded-2xl bg-[#ffd900] text-[#1a1a1a] grid place-items-center">
          <ShoppingBag size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold uppercase tracking-wider text-muted">Don Quijote</div>
          <div className="text-[18px] font-bold leading-tight">{best.store.name}</div>
          <div className="text-[13px] text-muted">
            {best.entry
              ? `During your ${placeLabel(best.entry.place)} stop, ~${fmtMin(best.entry.projectedArrive)} · ${best.walk}`
              : best.walk}
            {gps && ` · ${formatDistance(distanceKm(gps, best.store))} from you`}
          </div>
        </div>
      </div>
      {best.entry && best.stopPlaceId === 'shinjuku' && (
        <p className="text-[14px] leading-snug">No extra travel, usually open 24 h, and you don't carry bags all day. Bring your passport for tax-free.</p>
      )}
      {backup && (
        <p className="text-[13px] text-muted">
          Backup: {backup.store.name}, during your {placeLabel(backup.entry!.place)} stop.
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        <LinkButton variant="primary" className="px-2 text-[14px]" href={directionsUrl(best.store, 'walking', gps)}>
          Walk there
        </LinkButton>
        <Button className="px-2 text-[14px]" onClick={() => showOnMap(best.store)}>
          <MapPin size={16} /> Map
        </Button>
        <Button className="px-2 text-[14px]" onClick={() => toggle(true)}>
          <Check size={16} className="text-ok" /> Done
        </Button>
      </div>
    </Card>
  )
}

/** Small chip on itinerary stops that have a Donki next door. */
export function ShopChips({ stopPlaceId }: { stopPlaceId: string }) {
  return (
    <>
      {DONKI_AT.filter((d) => d.stopPlaceId === stopPlaceId).map((d) => {
        const store = getPlace(d.storeId)
        return (
          <a
            key={d.storeId}
            href={directionsUrl(store, 'walking')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-[#ffd900] px-2.5 py-1 text-xs font-semibold text-[#1a1a1a]"
          >
            <ShoppingBag size={12} /> Donki nearby
          </a>
        )
      })}
    </>
  )
}
