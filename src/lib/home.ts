import { DEFAULT_HOME } from '../data/itinerary'
import { findTrainLeg } from '../data/legs'
import { getPlace, PLACE_BY_ID } from '../data/places'
import type { ItineraryState, LatLng, Leg, Place } from '../types'
import { distanceKm } from './geo'
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
    lat: h.lat ?? Number.NaN,
    lng: h.lng ?? Number.NaN,
    area: '',
    description: '',
    activities: [],
    suggestedMin: 0,
    nearestStation: '',
  }
}

/** Current home as a starting point for a new plan, if it has a location. */
export function existingHome(state: ItineraryState): Place | null {
  const h = homePlace(state)
  return hasCoords(h) ? { ...h, label: undefined } : null
}

export const hasCoords = (p: Place) => Number.isFinite(p.lat) && Number.isFinite(p.lng)

export interface HomeTrip {
  /** 'here' = from your GPS position, leaving now. 'plan' = after the last planned stop. */
  kind: 'here' | 'plan'
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
  return { kind: 'plan', from, home, leaveMin, travel, arriveMin: travel ? leaveMin + travel.min : null, leg: findTrainLeg(from.id, home.id) }
}

/** Within this distance of a known place, use it as the origin so its hand-written route applies. */
const SNAP_KM = 0.6

/** The trip home from where you are right now. */
export function homeTripFromHere(state: ItineraryState, gps: LatLng, now: number): HomeTrip {
  const home = homePlace(state)
  const known = Object.values(PLACE_BY_ID)
    .map((p) => ({ p, d: distanceKm(gps, p) }))
    .sort((a, b) => a.d - b.d)[0]
  const from: Place =
    known && known.d <= SNAP_KM
      ? known.p
      : {
          id: 'here',
          name: 'Your location',
          label: 'You',
          nameJa: '現在地',
          mapsQuery: `${gps.lat.toFixed(6)},${gps.lng.toFixed(6)}`,
          lat: gps.lat,
          lng: gps.lng,
          area: '',
          description: '',
          activities: [],
          suggestedMin: 0,
          nearestStation: '',
        }
  const travel = hasCoords(home) ? estimateTravel(from, home, 'train') : null
  return { kind: 'here', from, home, leaveMin: now, travel, arriveMin: travel ? now + travel.min : null, leg: findTrainLeg(from.id, home.id) }
}
