import { RotateCcw } from 'lucide-react'
import type { Geo } from '../hooks/useGeolocation'
import { Button, Notice } from './ui'

export function LocationHelp({ geo }: { geo: Geo }) {
  if (geo.status === 'unsupported') return <Notice tone="warn">This browser cannot share location. Use Safari on iPhone, or navigate with the Google Maps buttons.</Notice>
  if (geo.status === 'denied') {
    return (
      <div className="space-y-2">
        <Notice tone="bad">Location is blocked for this site. Everything else still works.</Notice>
        <ol className="list-decimal pl-5 text-[14px] space-y-1 text-muted">
          <li>
            iPhone <b>Settings → Privacy &amp; Security → Location Services</b>: make sure it is on and <b>Safari Websites</b> is set to <b>While Using</b>.
          </li>
          <li>
            In Safari, tap <b>aA</b> in the address bar → <b>Website Settings → Location → Allow</b>.
          </li>
          <li>Reload the page, then tap the button below.</li>
        </ol>
        <Button variant="secondary" className="w-full" onClick={geo.start}>
          <RotateCcw size={16} /> Try again
        </Button>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <Notice tone="warn">{geo.error ?? 'Cannot get a location fix.'} Underground stations and tall buildings block GPS.</Notice>
      <Button variant="secondary" className="w-full" onClick={geo.start}>
        <RotateCcw size={16} /> Retry
      </Button>
    </div>
  )
}
