import { Flag, Home, Moon, Navigation, Pencil } from 'lucide-react'
import { useState } from 'react'
import { placeLabel } from '../data/places'
import type { Geo } from '../hooks/useGeolocation'
import type { ItineraryApi } from '../hooks/useItinerary'
import { hasCoords, LATE_LEAVE_MIN, type HomeTrip } from '../lib/home'
import { recommend } from '../lib/pricing'
import { directionsUrl } from '../lib/maps'
import { fmtDuration, fmtMin } from '../lib/time'
import type { LatLng, TransportMode } from '../types'
import { CopyJaButton } from './CopyJaButton'
import { PlaceSearch } from './PlaceSearch'
import { ModeContent, TrainMode, TransportCompare } from './Journey'
import { Button, Card, LinkButton, Notice, Sheet } from './ui'

function LateWarning({ trip }: { trip: HomeTrip }) {
  if (trip.leaveMin < LATE_LEAVE_MIN) return null
  return (
    <Notice tone="bad">
      At this pace you leave {placeLabel(trip.from)} around {fmtMin(trip.leaveMin)}, which risks missing the last train. Skip or shorten a stop, or check the last train now.
    </Notice>
  )
}

function Times({ trip }: { trip: HomeTrip }) {
  return (
    <span>
      {trip.kind === 'here' ? `Leave now from ${trip.from.id === 'here' ? 'your location' : placeLabel(trip.from)}` : `Leave ${placeLabel(trip.from)} ~${fmtMin(trip.leaveMin)}`}
      {trip.arriveMin != null && ` · home ~${fmtMin(trip.arriveMin)} (${fmtDuration(trip.travel!.min)}${trip.travel!.source === 'calc' ? '*' : ''})`}
    </span>
  )
}

interface SheetProps {
  planTrip: HomeTrip
  hereTrip: HomeTrip | null
  gps: LatLng | null
  pendingStops: number
  onEndDay: () => void
  onClose: () => void
}

/** Route home from where you are now, or after the plan: steps, live directions, last train, taxi. */
export function HomeSheet({ planTrip, hereTrip, gps, pendingStops, onEndDay, onClose }: SheetProps) {
  const [kind, setKind] = useState<'here' | 'plan'>(hereTrip ? 'here' : 'plan')
  const trip = kind === 'here' && hereTrip ? hereTrip : planTrip
  const [mode, setMode] = useState<TransportMode>(() => (hasCoords(trip.home) ? recommend(trip.from, trip.home).mode : 'train'))
  const canCompare = hasCoords(trip.home) && trip.from.id !== trip.home.id

  return (
    <Sheet
      title={
        <span className="flex items-center gap-2 truncate">
          <Home size={20} className="text-accent shrink-0" /> Home: {trip.home.name}
        </span>
      }
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 rounded-2xl bg-card p-1 text-[14px] font-semibold">
          <button
            disabled={!hereTrip}
            onClick={() => setKind('here')}
            className={`rounded-xl py-2 disabled:opacity-40 ${kind === 'here' && hereTrip ? 'bg-accent text-white' : 'text-muted'}`}
          >
            From here, now
          </button>
          <button onClick={() => setKind('plan')} className={`rounded-xl py-2 ${kind === 'plan' || !hereTrip ? 'bg-accent text-white' : 'text-muted'}`}>
            After the plan
          </button>
        </div>
        {!hereTrip && <p className="px-1 text-[13px] text-muted">Turn on location on Home to plan the trip from where you are.</p>}

        <div className="px-1 text-[15px] text-muted">
          <Times trip={trip} />
        </div>
        <LateWarning trip={trip} />

        {kind === 'here' && hereTrip && pendingStops > 0 && (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (confirm(`End the day here? The ${pendingStops} remaining stop${pendingStops > 1 ? 's' : ''} will be marked skipped (you can restore them).`)) onEndDay()
            }}
          >
            <Flag size={16} /> End the day here ({pendingStops} stop{pendingStops > 1 ? 's' : ''} left)
          </Button>
        )}

        {canCompare ? (
          <>
            <TransportCompare from={trip.from} to={trip.home} selected={mode} onSelect={setMode} />
            <ModeContent mode={mode} from={trip.from} to={trip.home} origin={gps ?? trip.from} />
          </>
        ) : (
          <TrainMode from={trip.from} to={trip.home} origin={gps ?? trip.from} />
        )}

        <Notice tone="warn">
          <span className="flex gap-2">
            <Moon size={18} className="shrink-0 mt-0.5" />
            <span>Most Tokyo lines stop running around midnight. If it is late, open live directions and check the last train before anything else.</span>
          </span>
        </Notice>
        <Card className="p-4 space-y-2">
          <div className="text-[17px] font-semibold">Missed the last train?</div>
          <p className="text-[15px] text-muted">Take a taxi or use the GO or Uber app. Show the driver the Japanese name:</p>
          <CopyJaButton place={trip.home} className="w-full" />
        </Card>
      </div>
    </Sheet>
  )
}

/** Card at the end of the itinerary list, with an editable home. */
export function HomeCard({ trip, itin, gps, geo, openHome }: { trip: HomeTrip; itin: ItineraryApi; gps: LatLng | null; geo: Geo; openHome: () => void }) {
  const [editing, setEditing] = useState(false)

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="pin start !size-9 shrink-0">
          <Home size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[19px] font-bold leading-tight">Home</div>
          <div className="text-[13px] text-muted truncate">{trip.home.name}</div>
        </div>
        {trip.arriveMin != null && <div className="text-[17px] font-bold tabular-nums">{fmtMin(trip.arriveMin)}</div>}
      </div>
      <div className="text-[13px] text-muted">
        <Times trip={trip} />
      </div>
      <LateWarning trip={trip} />
      {editing ? (
        <div className="space-y-2">
          <PlaceSearch
            geo={geo}
            onPick={(p) => {
              itin.setHome({ name: p.name, query: p.mapsQuery, lat: p.lat, lng: p.lng })
              setEditing(false)
            }}
          />
          <Button className="w-full text-[14px]" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <LinkButton variant="primary" className="px-2 text-[14px]" href={directionsUrl(trip.home, 'transit', gps ?? trip.from)}>
            <Navigation size={16} /> Go
          </LinkButton>
          <Button className="px-2 text-[14px]" onClick={openHome}>
            Steps
          </Button>
          <Button className="px-2 text-[14px]" onClick={() => setEditing(true)}>
            <Pencil size={15} /> Change
          </Button>
        </div>
      )}
    </Card>
  )
}
