export type TransportMode = 'train' | 'luup' | 'walk'

export type StopStatus = 'pending' | 'done' | 'skipped'

export interface LatLng {
  lat: number
  lng: number
}

export interface Place extends LatLng {
  id: string
  name: string
  /** Short name used on itinerary cards, e.g. "Asakusa". Defaults to name. */
  label?: string
  nameJa: string
  /** Text Google Maps resolves reliably, used for external directions. */
  mapsQuery: string
  area: string
  description: string
  activities: string[]
  /** Suggested visit length in minutes. */
  suggestedMin: number
  nearestStation: string
  /** Typical hours. Not live data: always labelled "check before going". */
  hours?: string
  /** Minutes after midnight JST when the main attraction typically closes. */
  closesAt?: number
  closesLabel?: string
  mandatory?: boolean
  /** Places that appear in the destination guide but are not stops by default. */
  guideOnly?: boolean
  notes?: string[]
}

export interface Station extends LatLng {
  name: string
  nameJa: string
  code?: string
}

export interface TrainSegment {
  operator: string
  line: string
  lineJa: string
  /** CSS colour of the line's official signage colour. */
  colour: string
  lineCode?: string
  from: Station
  /** The end station shown on platform signs, e.g. "Asakusa". */
  direction: string
  directionJa: string
  stops: number
  stopNames: string[]
  to: Station
  boardingTip?: string
}

export interface Leg {
  from: string
  to: string
  /** Planning estimate in minutes, door to door. Not a timetable. */
  estimateMin: Partial<Record<TransportMode, number>>
  /** Approximate distance in km along the likely route. */
  distanceKm?: number
  recommended: TransportMode
  /** One-line reason shown next to the recommendation. */
  why: string
  /** Adult IC (Suica) fare in yen for the train option, by the operator's distance band. */
  trainFareYen?: number
  /** Set when the fare sits near a distance-band edge and could be one band off. */
  fareApprox?: boolean
  walkToStation?: string
  segments: TrainSegment[]
  exitTip?: string
  alternatives?: string[]
  luupNote?: string
  walkNote?: string
}

export interface ItineraryStop {
  id: string
  placeId: string
  durationMin: number
  transport: TransportMode
  status: StopStatus
}

export interface ItineraryState {
  version: 1
  startPlaceId: string
  /** Minutes after midnight JST. */
  startMin: number
  /** Minutes after midnight JST when the day should end. */
  endMin: number
  stops: ItineraryStop[]
  /** Unix ms when the user last marked a stop done (used as "departed from" time). */
  lastDepartedAt?: number
}

export type ThemePref = 'system' | 'light' | 'dark'
