import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import type { Place } from '../types'
import { Button } from './ui'

/** Copies the Japanese name so it can be pasted into a taxi app or shown to staff. */
export function CopyJaButton({ place, className = '' }: { place: Place; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(place.nameJa)
      setState('copied')
    } catch {
      setState('failed')
    }
    setTimeout(() => setState('idle'), 2000)
  }
  return (
    <Button variant="secondary" className={className} onClick={copy}>
      {state === 'copied' ? <Check size={18} className="text-ok" /> : <Copy size={18} />}
      {state === 'copied' ? 'Copied' : state === 'failed' ? `Copy failed: ${place.nameJa}` : `Copy ${place.nameJa}`}
    </Button>
  )
}
