import { Check } from 'lucide-react'
import { getPlace, placeLabel, registerPlace } from '../data/places'
import { homePlace } from '../lib/home'
import { dateLabel, fmtMin } from '../lib/time'
import type { ItineraryState } from '../types'
import { Button, Card, Sheet } from './ui'

/** Shown when the app is opened from a shared plan link. */
export function ImportSheet({ plan, onUse, onClose }: { plan: ItineraryState; onUse: () => void; onClose: () => void }) {
  plan.customPlaces?.forEach(registerPlace)
  const stops = plan.stops.filter((s) => s.status !== 'skipped')
  return (
    <Sheet title="Someone shared a plan" onClose={onClose}>
      <div className="space-y-3">
        <p className="px-1 text-[15px] text-muted">
          {plan.date ? `${dateLabel(plan.date)} · ` : ''}from {fmtMin(plan.startMin)}, staying at {homePlace(plan).name}
        </p>
        <Card className="divide-line">
          {stops.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span className="pin upcoming !size-7 shrink-0 !text-[12px]">{i + 1}</span>
              <span className="font-semibold">{placeLabel(getPlace(s.placeId))}</span>
            </div>
          ))}
        </Card>
        <Button variant="primary" className="w-full min-h-14 text-[17px]" onClick={onUse}>
          <Check size={20} /> Use this plan
        </Button>
        <Button className="w-full" onClick={onClose}>
          Not now
        </Button>
        <p className="px-1 text-[12px] text-muted">This replaces the plan on this phone. Visited places on your own earlier days are kept.</p>
      </div>
    </Sheet>
  )
}
