import { useCallback, useEffect, useRef, useState } from 'react'
import { registerPlace } from '../data/places'
import { load, save } from '../lib/storage'
import { todayLocal } from '../lib/time'
import type { ItineraryState } from '../types'
import type { ItineraryApi } from './useItinerary'

// A trip is a list of day plans. The active day lives in useItinerary (so
// everything else works on one day as before); this keeps the other days and
// swaps them in and out. A day is identified by its date: when the active
// plan's date changes to another day of the trip (switching days, or a
// lobby member switching), its content is filed under that day.

const KEY = 'tokyo-day:trip:v1'

interface Saved {
  days: ItineraryState[]
  active: number
}

export function useTrip(itin: ItineraryApi) {
  const [trip, setTrip] = useState<Saved>(() => {
    const s = load<Saved | null>(KEY, null)
    s?.days.forEach((d) => d.customPlaces?.forEach(registerPlace))
    return s && s.days.length ? s : { days: [itin.state], active: 0 }
  })
  const itinRef = useRef(itin)
  itinRef.current = itin

  // File every change to the active plan under the right day.
  useEffect(() => {
    setTrip((t) => {
      const state = itin.state
      const cur = t.days[t.active]
      let active = t.active
      if (state.date && cur?.date && state.date !== cur.date) {
        const idx = t.days.findIndex((d) => d.date === state.date)
        if (idx >= 0) active = idx
      }
      const days = [...t.days]
      days[active] = state
      const next = { days, active }
      save(KEY, next)
      return next
    })
  }, [itin.state])

  const switchDay = useCallback(
    (i: number) => {
      const day = trip.days[i]
      if (day && i !== trip.active) itinRef.current.replace(day)
    },
    [trip],
  )

  /** Replace the whole trip (from the planner). */
  const setDays = useCallback((days: ItineraryState[]) => {
    const next = { days, active: 0 }
    save(KEY, next)
    setTrip(next)
    itinRef.current.replace(days[0])
  }, [])

  /** Files a day under its date (replacing that day if the trip has it, adding it otherwise) and opens it. */
  const putDay = useCallback((day: ItineraryState) => {
    day.customPlaces?.forEach(registerPlace)
    setTrip((t) => {
      const idx = day.date ? t.days.findIndex((d) => d.date === day.date) : t.active
      const days = idx >= 0 ? t.days.map((d, i) => (i === idx ? day : d)) : [...t.days, day].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      const next = { days, active: days.indexOf(day) }
      save(KEY, next)
      return next
    })
    itinRef.current.replace(day)
  }, [])

  const today = todayLocal()
  const todayIndex = trip.days.findIndex((d) => d.date === today)

  return { days: trip.days, active: trip.active, switchDay, setDays, putDay, todayIndex }
}

export type TripApi = ReturnType<typeof useTrip>
