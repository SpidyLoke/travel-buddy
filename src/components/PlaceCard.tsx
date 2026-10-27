import { Check, Clock, Footprints, MapPin, Plus, TrainFront } from 'lucide-react'
import { curatedCity } from '../lib/destination'
import { distanceKm, formatDistance } from '../lib/geo'
import { directionsUrl } from '../lib/maps'
import { fmtDuration } from '../lib/time'
import type { LatLng, Place } from '../types'
import { CopyJaButton } from './CopyJaButton'
import { PlacePhoto } from './PlacePhoto'
import { Button, Card, LinkButton, Pill } from './ui'

interface Props {
  place: Place
  gps: LatLng | null
  inPlan: boolean
  onAdd: () => void
  onMap: () => void
}

export function PlaceCard({ place, gps, inPlan, onAdd, onMap }: Props) {
  return (
    <Card className="p-4 space-y-3">
      <PlacePhoto place={place} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[19px] font-bold leading-tight">{place.name}</div>
          {place.nameJa && place.nameJa !== place.name && <div className="text-[15px] text-muted">{place.nameJa}</div>}
        </div>
        <Pill className="bg-card-2 shrink-0">{place.area}</Pill>
      </div>
      <p className="text-[15px] leading-snug">{place.description}</p>
      <ul className="text-[14px] space-y-1">
        {place.activities.map((a) => (
          <li key={a} className="flex gap-2">
            <span className="text-accent">•</span>
            {a}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 text-[13px]">
        <Pill className="bg-card-2">
          <Clock size={13} /> {fmtDuration(place.suggestedMin)}
        </Pill>
        {place.nearestStation && (
          <Pill className="bg-card-2">
            <TrainFront size={13} /> {place.nearestStation}
          </Pill>
        )}
        {gps && <Pill className="bg-card-2">{formatDistance(distanceKm(gps, place))} away</Pill>}
      </div>
      {place.hours ? (
        <p className="text-[13px] text-muted">Typical hours: {place.hours} Check before going.</p>
      ) : (
        place.region === 'live' && <p className="text-[13px] text-muted">Opening hours not known here: check before going.</p>
      )}
      {place.notes?.map((n) => (
        <p key={n} className="text-[13px] text-muted">
          {n}
        </p>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <LinkButton variant="primary" className="text-[14px]" href={directionsUrl(place, 'transit', gps)}>
          <TrainFront size={16} /> {curatedCity() ? 'By train' : 'Transit'}
        </LinkButton>
        <LinkButton className="text-[14px]" href={directionsUrl(place, 'walking', gps)}>
          <Footprints size={16} /> Walking
        </LinkButton>
        <Button className="text-[14px]" onClick={onMap}>
          <MapPin size={16} /> On map
        </Button>
        <Button className="text-[14px]" onClick={onAdd} disabled={inPlan}>
          {inPlan ? <Check size={16} className="text-ok" /> : <Plus size={16} />} {inPlan ? 'In plan' : 'Add'}
        </Button>
      </div>
      <CopyJaButton place={place} className="w-full text-[14px]" />
    </Card>
  )
}
