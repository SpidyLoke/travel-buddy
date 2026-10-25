export type TransportMode = 'train' | 'luup' | 'walk'

export type Interest = 'culture' | 'shopping' | 'anime' | 'food' | 'views' | 'nightlife' | 'nature' | 'quirky'

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night'

export type Pace = 'relaxed' | 'balanced' | 'packed'

export type LuupPlan = 'none' | 'payg' | 'sub'

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
  /** English Wikipedia article whose lead image (free licence) is used as the photo. */
  wiki?: string
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
  /** Shopping stops such as Don Quijote. */
  kind?: 'sight' | 'shop'
  /** Found in the app (search or nearby) rather than built in. */
  custom?: boolean
  /** Planner metadata. Hours are typical, never live. */
  tags?: Interest[]
  /** 1–5: how strongly to recommend to a first-time visitor. */
  score?: number
  /** Places in the same group are close together; the planner picks one per group. */
  group?: string
  best?: TimeOfDay
  opensAt?: number
  /** Days of the week (0 = Sunday) when typically closed or mostly shut. */
  closedDays?: number[]
  closedNote?: string
  /** Not shown in guides or used by the planner (e.g. a personal start point). */
  hidden?: boolean
  /** Mostly outdoors: worth a warning when rain is forecast. */
  outdoor?: boolean
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
  /** The user insisted on this stop: never suggested for skipping. */
  must?: boolean
  /** Why the planner picked it. */
  note?: string
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
  /** Where the day ends up. A known place gets step-by-step routes; a free-text address gets live directions only. */
  home?: HomeSetting
  /** Places added from search or nearby, so stops can refer to them by id. */
  customPlaces?: Place[]
  /** YYYY-MM-DD in Japan time. Undefined = whatever day it is. */
  date?: string
}

export interface HomeSetting {
  name: string
  /** Google Maps search text. */
  query: string
  placeId?: string
  lat?: number
  lng?: number
}

export type ThemePref = 'system' | 'light' | 'dark'
