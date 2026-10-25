import { useState } from 'react'
import { usePhoto } from '../hooks/usePhotos'
import type { Place } from '../types'

/** Freely licensed photo with the author and licence credit. Renders nothing if unavailable. */
export function PlacePhoto({ place, className = '' }: { place: Place; className?: string }) {
  const photo = usePhoto(place.wiki)
  const [failed, setFailed] = useState(false)
  if (!photo || failed) return null
  return (
    <figure className={className}>
      <img
        src={photo.url}
        alt={place.name}
        loading="lazy"
        width={photo.width}
        height={photo.height}
        onError={() => setFailed(true)}
        className="w-full aspect-[16/9] object-cover rounded-2xl bg-card-2"
      />
      <figcaption className="mt-1 text-[11px] text-muted truncate">
        Photo:{' '}
        <a href={photo.page} target="_blank" rel="noopener noreferrer" className="underline">
          {photo.artist}, {photo.license}
        </a>{' '}
        · Wikimedia Commons
      </figcaption>
    </figure>
  )
}
