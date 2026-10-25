import { Home, Moon, Navigation, Pencil } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_HOME } from '../data/itinerary'
import { placeLabel } from '../data/places'
import type { ItineraryApi } from '../hooks/useItinerary'
import { LATE_LEAVE_MIN, type HomeTrip } from '../lib/home'
import { directionsUrl } from '../lib/maps'
import { fmtDuration, fmtMin } from '../lib/time'
import type { LatLng } from '../types'
import { CopyJaButton } from './CopyJaButton'
import { TrainMode } from './Journey'
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
      Leave {placeLabel(trip.from)} ~{fmtMin(trip.leaveMin)}
      {trip.arriveMin != null && ` · home ~${fmtMin(trip.arriveMin)} (${fmtDuration(trip.travel!.min)})`}
    </span>
  )
}

/** Full route home: steps, live directions, late-night and taxi fallback. */
export function HomeSheet({ trip, gps, onClose }: { trip: HomeTrip; gps: LatLng | null; onClose: () => void }) {
  return (
    <Sheet
      title={
        <span className="flex items-center gap-2">
          <Home size={20} className="text-accent" /> Back to {trip.home.name}
        </span>
      }
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="px-1 text-[15px] text-muted">
          <Times trip={trip} />
        </div>
        <LateWarning trip={trip} />
        <Notice tone="warn">
          <span className="flex gap-2">
            <Moon size={18} className="shrink-0 mt-0.5" />
            <span>Most Tokyo lines stop running around midnight. Before you settle in at Shinjuku, open live directions and check the last train home.</span>
          </span>
        </Notice>
        <TrainMode from={trip.from} to={trip.home} origin={gps ?? trip.from} />
        <Card className="p-4 space-y-2">
          <div className="text-[17px] font-semibold">Missed the last train?</div>
          <p className="text-[15px] text-muted">Take a taxi or use the GO or Uber app. Show the driver the Japanese name:</p>
          <CopyJaButton place={trip.home} className="w-full" />
        </Card>
      </div>
    </Sheet>
  )
}

/** Card at the end of the itinerary list, with an editable home address. */
export function HomeCard({ trip, itin, gps, openHome }: { trip: HomeTrip; itin: ItineraryApi; gps: LatLng | null; openHome: () => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const isDefault = trip.home.id === DEFAULT_HOME.placeId

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
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            const v = text.trim()
            if (v) itin.setHome({ name: v, query: v })
            setEditing(false)
          }}
        >
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Hotel name or address"
            className="w-full rounded-xl bg-card-2 px-3 py-2.5 text-[16px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button type="submit" variant="primary" className="text-[14px]">
              Save
            </Button>
            <Button
              type="button"
              className="text-[14px]"
              onClick={() => {
                itin.setHome(DEFAULT_HOME)
                setEditing(false)
              }}
            >
              Use Horikiri Station
            </Button>
          </div>
          <p className="text-[12px] text-muted">A custom address gets live Google Maps directions; step-by-step is only written for Horikiri.</p>
        </form>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <LinkButton variant="primary" className="px-2 text-[14px]" href={directionsUrl(trip.home, 'transit', gps ?? trip.from)}>
            <Navigation size={16} /> Go
          </LinkButton>
          <Button className="px-2 text-[14px]" onClick={openHome}>
            Steps
          </Button>
          <Button
            className="px-2 text-[14px]"
            onClick={() => {
              setText(isDefault ? '' : trip.home.name)
              setEditing(true)
            }}
          >
            <Pencil size={15} /> Change
          </Button>
        </div>
      )}
    </Card>
  )
}
