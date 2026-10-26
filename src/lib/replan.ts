import { getPlace, placeLabel } from '../data/places'
import type { ItineraryState, ItineraryStop, LatLng } from '../types'
import { homePlace, hasCoords } from './home'
import { planDay } from './planner'
import { getPrefs } from './prefs'
import { herePlace } from './schedule'
import { todayJst } from './time'

// "Re-plan the rest of today from here": reorders the stops you haven't
// visited for a start from your position at the current time, keeps your
// visit lengths and must-sees, and drops what no longer fits (closing times,
// finish time). Visited and skipped stops are left as they are.

export interface Replan {
  state: ItineraryState
  keep: string[]
  drop: string[]
  /** Projected time back home. */
  homeArrive: number
  /** Visits were shortened to this fraction to fit more in. */
  shortened: number | null
}

export function replanFromNow(state: ItineraryState, now: number, here: LatLng | null): Replan | null {
  const pending = state.stops.filter((s) => s.status === 'pending')
  if (!pending.length) return null
  const byPlace = new Map<string, ItineraryStop>()
  pending.forEach((s) => byPlace.has(s.placeId) || byPlace.set(s.placeId, s))

  const lastDone = [...state.stops].reverse().find((s) => s.status === 'done')
  const from = here ? herePlace(here) : getPlace(lastDone?.placeId ?? state.startPlaceId)
  const home = homePlace(state)
  const prefs = getPrefs()

  const run = (scale: number) =>
    planDay({
    home: hasCoords(home) ? home : from,
    startFrom: from,
    date: state.date ?? todayJst(),
    startMin: now,
    // Keep the planned finish, but always allow at least an hour from now.
    endMin: Math.max(state.endMin, now + 60),
    interests: prefs.interests,
    pace: prefs.pace,
    mustIds: pending.filter((s) => s.must).map((s) => s.placeId),
    excludeIds: [],
    onlyIds: [...byPlace.keys()],
    durations: Object.fromEntries([...byPlace].map(([id, s]) => [id, Math.max(20, Math.round((s.durationMin * scale) / 5) * 5)])),
  })

  // Shorter visits beat dropping stops: try full length, then 75%, then 50%.
  let plan = run(1)
  let scale = 1
  for (const sc of [0.75, 0.5]) {
    if (plan.stops.length === byPlace.size) break
    const tryPlan = run(sc)
    if (tryPlan.stops.length > plan.stops.length) {
      plan = tryPlan
      scale = sc
    }
  }

  const keptIds = plan.stops.map((p) => p.place.id)
  const kept = plan.stops.map((p) => ({ ...byPlace.get(p.place.id)!, transport: p.transport, durationMin: p.durationMin }))
  const dropped = pending.filter((s) => !keptIds.includes(s.placeId)).map((s) => ({ ...s, status: 'skipped' as const }))
  const settled = state.stops.filter((s) => s.status !== 'pending')

  return {
    state: { ...state, stops: [...settled, ...kept, ...dropped], lastDepartedAt: Date.now() },
    keep: kept.map((s) => placeLabel(getPlace(s.placeId))),
    drop: dropped.map((s) => placeLabel(getPlace(s.placeId))),
    homeArrive: plan.homeArrive,
    shortened: scale < 1 ? scale : null,
  }
}
