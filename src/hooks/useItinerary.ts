import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ITINERARY } from '../data/itinerary'
import { PLACE_BY_ID } from '../data/places'
import { load, save } from '../lib/storage'
import type { ItineraryState, ItineraryStop, StopStatus, TransportMode } from '../types'

const KEY = 'tokyo-day:itinerary:v1'

function sanitise(s: ItineraryState): ItineraryState {
  if (!s || s.version !== 1 || !Array.isArray(s.stops)) return DEFAULT_ITINERARY
  return { ...s, stops: s.stops.filter((st) => PLACE_BY_ID[st.placeId]) }
}

export function useItinerary() {
  const [state, setState] = useState<ItineraryState>(() => sanitise(load(KEY, DEFAULT_ITINERARY)))

  useEffect(() => save(KEY, state), [state])

  const updateStop = useCallback((id: string, patch: Partial<ItineraryStop>) => {
    setState((s) => ({ ...s, stops: s.stops.map((st) => (st.id === id ? { ...st, ...patch } : st)) }))
  }, [])

  const setStatus = useCallback((id: string, status: StopStatus) => {
    setState((s) => ({
      ...s,
      lastDepartedAt: status === 'done' ? Date.now() : s.lastDepartedAt,
      stops: s.stops.map((st) => (st.id === id ? { ...st, status } : st)),
    }))
  }, [])

  const move = useCallback((id: string, dir: -1 | 1) => {
    setState((s) => {
      const i = s.stops.findIndex((st) => st.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= s.stops.length) return s
      const stops = [...s.stops]
      ;[stops[i], stops[j]] = [stops[j], stops[i]]
      return { ...s, stops }
    })
  }, [])

  const add = useCallback((placeId: string, transport: TransportMode = 'train') => {
    const place = PLACE_BY_ID[placeId]
    if (!place) return
    setState((s) => {
      const id = s.stops.some((st) => st.id === placeId) ? `${placeId}-${Date.now()}` : placeId
      const stop: ItineraryStop = { id, placeId, durationMin: place.suggestedMin || 30, transport, status: 'pending' }
      // Insert before the final stop so Shinjuku stays the finish.
      const stops = [...s.stops]
      stops.splice(Math.max(0, stops.length - 1), 0, stop)
      return { ...s, stops }
    })
  }, [])

  const remove = useCallback((id: string) => {
    setState((s) => ({ ...s, stops: s.stops.filter((st) => st.id !== id) }))
  }, [])

  const setStart = useCallback((startMin: number) => setState((s) => ({ ...s, startMin })), [])
  const setEnd = useCallback((endMin: number) => setState((s) => ({ ...s, endMin })), [])
  const setAllTransport = useCallback((transport: TransportMode) => {
    setState((s) => ({ ...s, stops: s.stops.map((st) => (st.status === 'pending' ? { ...st, transport } : st)) }))
  }, [])
  const reset = useCallback(() => setState(DEFAULT_ITINERARY), [])

  return { state, updateStop, setStatus, move, add, remove, setStart, setEnd, setAllTransport, reset }
}

export type ItineraryApi = ReturnType<typeof useItinerary>
