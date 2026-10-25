import { ArrowRight } from 'lucide-react'
import { placeLabel } from '../data/places'
import type { LatLng, Place, TransportMode } from '../types'
import { CopyJaButton } from './CopyJaButton'
import { ModeContent, TransportCompare } from './Journey'
import { Sheet } from './ui'

interface Props {
  from: Place
  to: Place
  mode: TransportMode
  gps: LatLng | null
  onModeChange: (m: TransportMode) => void
  onClose: () => void
}

export function JourneySheet({ from, to, mode, gps, onModeChange, onClose }: Props) {
  return (
    <Sheet
      title={
        <span className="flex items-center gap-2 truncate">
          {placeLabel(from)} <ArrowRight size={18} className="text-muted shrink-0" /> {placeLabel(to)}
        </span>
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        <TransportCompare from={from} to={to} selected={mode} onSelect={onModeChange} />
        <ModeContent mode={mode} from={from} to={to} origin={gps ?? from} />
        <CopyJaButton place={to} className="w-full" />
      </div>
    </Sheet>
  )
}
