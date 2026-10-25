import { DEFAULT_HOME } from '../data/itinerary'
import { findTrainLeg } from '../data/legs'
import { getPlace, PLACE_BY_ID } from '../data/places'
import type { ItineraryState, Leg, Place } from '../types'
import { estimateTravel, type Timeline, type TravelEstimate } from './schedule'

/** Home as a Place. A free-text address has no coordinates, so no distances or steps. */
export function homePlace(state: ItineraryState): Place {
  const h = state.home ?? DEFAULT_HOME
  if (h.placeId && PLACE_BY_ID[h.placeId]) return { ...getPlace(h.placeId), label: 'Home' }
  return {
    id: 'home-custom',
    name: h.name,
    label: 'Home',
    nameJa: h.name,
    mapsQuery: h.query,
    lat: Number.NaN,
    lng: Number.NaN,
    area: '',
    description: '',
    activities: [],
    suggestedMin: 0,
    nearestStation: '',
  }
}

export const hasCoords = (p: Place) => Number.isFinite(p.lat) && Number.isFinite(p.lng)

export interface HomeTrip {
  from: Place
  home: Place
  leaveMin: number
  travel: TravelEstimate | null
  arriveMin: number | null
  leg?: Leg
}

/**
 * Leaving later than this is risky for the last train. Deliberately early:
 * actual last departures vary by line and are only in live directions.
 */
export const LATE_LEAVE_MIN = 23 * 60 + 15

/** The trip home from the last planned stop, after the projected end of the day. */
export function homeTrip(state: ItineraryState, tl: Timeline, now: number): HomeTrip {
  const home = homePlace(state)
  const from = tl.entries.at(-1)?.place ?? getPlace(state.startPlaceId)
  const leaveMin = tl.nextIndex === -1 ? Math.max(now, tl.projectedEnd) : tl.projectedEnd
  const travel = hasCoords(home) ? estimateTravel(from, home, 'train') : null
  return { from, home, leaveMin, travel, arriveMin: travel ? leaveMin + travel.min : null, leg: findTrainLeg(from.id, home.id) }
}
