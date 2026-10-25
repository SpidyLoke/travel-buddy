import type { ItineraryState, ItineraryStop, TransportMode } from '../types'

const stop = (placeId: string, durationMin: number, transport: TransportMode): ItineraryStop => ({
  id: placeId,
  placeId,
  durationMin,
  transport,
  status: 'pending',
})

// Reproduces the planned day: 11:00 start at Horikiri, finish 22:30 in Shinjuku.
export const DEFAULT_ITINERARY: ItineraryState = {
  version: 1,
  startPlaceId: 'horikiri',
  startMin: 11 * 60,
  endMin: 22 * 60 + 30,
  stops: [
    stop('skytree', 20, 'train'),
    stop('sensoji', 75, 'train'),
    stop('akihabara', 60, 'train'),
    stop('ginza', 45, 'train'),
    stop('tokyotower', 75, 'train'),
    stop('takeshita', 60, 'train'),
    stop('shibuya', 90, 'walk'),
    stop('shinjuku', 120, 'train'),
  ],
}
