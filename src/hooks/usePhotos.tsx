import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadPhotoCache, resolvePhotos, type Photo } from '../lib/photos'
import type { Place } from '../types'

const PhotosContext = createContext<Record<string, Photo | null>>({})

/**
 * Loads photos for the given places, only fetching ones not already saved
 * (so new destinations and places added from Nearby get photos too).
 */
export function PhotosProvider({ online, places, children }: { online: boolean; places: Place[]; children: ReactNode }) {
  const [photos, setPhotos] = useState(loadPhotoCache)
  const missingKey = places
    .filter((p) => !(p.id in photos))
    .map((p) => p.id)
    .join(',')

  useEffect(() => {
    if (!online || !missingKey) return
    const ids = new Set(missingKey.split(','))
    const ctrl = new AbortController()
    resolvePhotos(
      places.filter((p) => ids.has(p.id)),
      ctrl.signal,
    )
      .then((found) => setPhotos((prev) => ({ ...prev, ...found })))
      .catch(() => {
        // Photos are optional; cards render without them.
      })
    return () => ctrl.abort()
    // `places` is tracked through missingKey.
  }, [online, missingKey])

  return <PhotosContext.Provider value={photos}>{children}</PhotosContext.Provider>
}

export function usePhoto(place: Place): Photo | null {
  return useContext(PhotosContext)[place.id] ?? null
}
