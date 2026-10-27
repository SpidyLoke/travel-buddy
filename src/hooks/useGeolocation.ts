import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatLng } from '../types'

export type GeoStatus = 'idle' | 'paused' | 'locating' | 'active' | 'denied' | 'unavailable' | 'unsupported'

export interface GeoState {
  status: GeoStatus
  position: LatLng | null
  accuracy: number | null
  updatedAt: number | null
  error: string | null
}

const INITIAL: GeoState = { status: 'idle', position: null, accuracy: null, updatedAt: null, error: null }

/** Fixes worse than this are kept but flagged as low accuracy. */
export const POOR_ACCURACY_M = 150

export function useGeolocation() {
  const [state, setState] = useState<GeoState>(INITIAL)
  const watchId = useRef<number | null>(null)

  /** User or app turned tracking off. The last fix is kept and labelled as such. */
  const stop = useCallback(() => {
    if (watchId.current != null && watchId.current >= 0) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    setState((s) => ({ ...s, status: 'paused' }))
  }, [])

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, status: 'unsupported', error: 'This browser does not support location.' }))
      return
    }
    // Restart cleanly so "Retry" works after a timeout or permission change.
    if (watchId.current != null && watchId.current >= 0) navigator.geolocation.clearWatch(watchId.current)
    setState((s) => ({ ...s, status: s.position ? s.status : 'locating', error: null }))
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return
        setState((prev) => {
          // Ignore a much worse fix that arrives shortly after a good one.
          if (prev.accuracy != null && prev.updatedAt != null && pos.coords.accuracy > prev.accuracy * 4 && pos.timestamp - prev.updatedAt < 20000) {
            return prev
          }
          return { status: 'active', position: p, accuracy: pos.coords.accuracy, updatedAt: pos.timestamp, error: null }
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          watchId.current = null
          setState((s) => ({ ...s, status: 'denied', error: 'Location permission was denied.' }))
        } else {
          setState((s) => ({ ...s, status: s.position ? s.status : 'unavailable', error: err.code === err.TIMEOUT ? 'Location timed out. Move to open sky or retry.' : 'Location is unavailable right now.' }))
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )
  }, [])

  // Pause tracking while the app is in the background to save battery.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current)
        watchId.current = -1
      } else if (document.visibilityState === 'visible' && watchId.current === -1) {
        // Only resumes if tracking was running when the app was backgrounded.
        watchId.current = null
        start()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [start])

  useEffect(() => () => {
    if (watchId.current != null && watchId.current >= 0) navigator.geolocation.clearWatch(watchId.current)
  }, [])

  return { ...state, start, stop }
}

export type Geo = ReturnType<typeof useGeolocation>
