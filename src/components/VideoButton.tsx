import { CirclePlay } from 'lucide-react'
import { videoUrl } from '../lib/video'
import type { Place } from '../types'
import { LinkButton } from './ui'

/** Opens video previews of a place on YouTube. Renders nothing when there's no preview. */
export function VideoButton({ place, className = '' }: { place: Place; className?: string }) {
  const href = videoUrl(place)
  if (!href) return null
  return (
    <LinkButton className={`text-[14px] ${className}`} href={href}>
      <CirclePlay size={16} className="text-bad" /> Video preview
    </LinkButton>
  )
}
