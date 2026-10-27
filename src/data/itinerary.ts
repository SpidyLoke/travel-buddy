import type { HomeSetting, ItineraryState } from '../types'

/** Placeholder until the first plan sets where you're staying. */
export const DEFAULT_HOME: HomeSetting = { name: 'Your stay', query: 'Tokyo Station', placeId: 'tokyostation' }

// No plan yet: the setup wizard runs first, and Home shows "Plan a trip"
// whenever a plan has no stops.
export const DEFAULT_ITINERARY: ItineraryState = {
  version: 1,
  startPlaceId: 'tokyostation',
  startMin: 10 * 60,
  endMin: 21 * 60,
  stops: [],
}
