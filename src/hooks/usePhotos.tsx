import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { PLACES } from '../data/places'
import { cachedPhotos, fetchPhotos, type Photo } from '../lib/photos'

const PhotosContext = createContext<Record<string, Photo | null>>({})

/** Loads all destination photos in two requests, cached for a week. */
export function PhotosProvider({ online, children }: { online: boolean; children: ReactNode }) {
  const [photos, setPhotos] = useState(() => cachedPhotos() ?? {})
  useEffect(() => {
    if (!online || cachedPhotos()) return
    const ctrl = new AbortController()
    const titles = PLACES.flatMap((p) => (p.wiki ? [p.wiki] : []))
    fetchPhotos(titles, ctrl.signal)
      .then(setPhotos)
      .catch(() => {
        // Photos are optional; cards render without them.
      })
    return () => ctrl.abort()
  }, [online])
  return <PhotosContext.Provider value={photos}>{children}</PhotosContext.Provider>
}

export function usePhoto(wiki?: string): Photo | null {
  const photos = useContext(PhotosContext)
  return wiki ? (photos[wiki] ?? null) : null
}
