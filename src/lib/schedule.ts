import { findLeg } from '../data/legs'
import { getPlace, placeLabel } from '../data/places'
import type { ItineraryState, ItineraryStop, Place, TransportMode } from '../types'
import { distanceKm } from './geo'
import { fmtMin, nowMinJst } from './time'

export type EstimateSource = 'plan' | 'calc'

export interface TravelEstimate {
  min: number
  source: EstimateSource
  /** Approximate route distance, km. */
  km: number
}

// Rough city speeds. Only used when no hand-planned estimate exists, and always
// labelled as a calculation in the UI.
const ROUTE_FACTOR = 1.3
const WALK_KMH = 4.5
const LUUP_KMH = 12
const LUUP_OVERHEAD = 6 // find a port, unlock, park, photo
const TRAIN_OVERHEAD = 12 // walk to platform, wait, walk out
const TRAIN_MIN_PER_KM = 2.5

export function estimateTravel(from: Place, to: Place, mode: TransportMode): TravelEstimate {
  const leg = findLeg(from.id, to.id)
  const km = leg?.distanceKm ?? distanceKm(from, to) * ROUTE_FACTOR
  const planned = leg?.estimateMin[mode]
  if (planned != null) return { min: planned, source: 'plan', km }
  let min: number
  if (mode === 'walk') min = (km / WALK_KMH) * 60
  else if (mode === 'luup') min = (km / LUUP_KMH) * 60 + LUUP_OVERHEAD
  else min = TRAIN_OVERHEAD + km * TRAIN_MIN_PER_KM
  return { min: Math.max(3, Math.round(min / 5) * 5), source: 'calc', km }
}

export interface TimelineEntry {
  stop: ItineraryStop
  place: Place
  prev: Place
  travel: TravelEstimate
  plannedArrive: number
  plannedDepart: number
  projectedArrive: number
  projectedDepart: number
}

export interface Timeline {
  entries: TimelineEntry[]
  /** Index into entries of the next pending stop, or -1 when the day is complete. */
  nextIndex: number
  /** Projected minus planned departure from the current stop. Positive = behind. */
  delayMin: number
  started: boolean
  projectedEnd: number
  plannedEnd: number
}

/** Builds planned and projected times for every non-skipped stop. */
export function buildTimeline(state: ItineraryState, now = nowMinJst()): Timeline {
  const active = state.stops.filter((s) => s.status !== 'skipped')
  const entries: TimelineEntry[] = []
  let prev = getPlace(state.startPlaceId)
  let plannedT = state.startMin
  let projT = state.startMin
  const nextIndex = active.findIndex((s) => s.status === 'pending')
  const lastDone = state.lastDepartedAt != null ? nowMinJst(new Date(state.lastDepartedAt)) : null

  active.forEach((stop, i) => {
    const place = getPlace(stop.placeId)
    const travel = estimateTravel(prev, place, stop.transport)
    const plannedArrive = plannedT + travel.min
    const plannedDepart = plannedArrive + stop.durationMin

    let projectedArrive: number
    let projectedDepart: number
    if (nextIndex === -1 || i < nextIndex) {
      projectedArrive = plannedArrive
      projectedDepart = plannedDepart
    } else {
      if (i === nextIndex && i > 0 && lastDone != null) projT = lastDone
      projectedArrive = projT + travel.min
      projectedDepart = projectedArrive + stop.durationMin
      // You cannot leave the current stop in the past.
      if (i === nextIndex && now > state.startMin) projectedDepart = Math.max(projectedDepart, now)
    }

    entries.push({ stop, place, prev, travel, plannedArrive, plannedDepart, projectedArrive, projectedDepart })
    prev = place
    plannedT = plannedDepart
    projT = projectedDepart
  })

  const cur = nextIndex >= 0 ? entries[nextIndex] : undefined
  return {
    entries,
    nextIndex,
    delayMin: cur ? cur.projectedDepart - cur.plannedDepart : 0,
    started: now >= state.startMin || state.stops.some((s) => s.status === 'done'),
    projectedEnd: entries.at(-1)?.projectedDepart ?? state.startMin,
    plannedEnd: entries.at(-1)?.plannedDepart ?? state.startMin,
  }
}

export interface Advice {
  tone: 'ok' | 'warn' | 'bad'
  message: string
  skipStopId?: string
  skipLabel?: string
}

/** Turns the projected timeline into one recommendation. Based on estimates only. */
export function adviseSchedule(state: ItineraryState, tl: Timeline): Advice {
  if (tl.nextIndex === -1) return { tone: 'ok', message: 'Day complete. Nice work.' }
  if (!tl.started) return { tone: 'ok', message: `Your day starts at ${fmtMin(state.startMin)} JST.` }

  const pending = tl.entries.slice(tl.nextIndex)
  const delay = Math.round(tl.delayMin)
  const behind = delay > 0 ? `You are running about ${delay} min behind. ` : ''

  // A stop with a known closing time that the projection now misses.
  const atRisk = pending.find((e) => e.place.closesAt != null && e.projectedArrive > e.place.closesAt - 30)
  if (atRisk) {
    const skippable = pending
      .filter((e) => e !== atRisk && !e.place.mandatory && tl.entries.indexOf(e) < tl.entries.indexOf(atRisk))
      .sort((a, b) => b.stop.durationMin + b.travel.min - (a.stop.durationMin + a.travel.min))
    const pick = skippable[0]
    const target = `${placeLabel(atRisk.place)} before ${atRisk.place.closesLabel ?? 'closing'}`
    if (pick) {
      return {
        tone: 'bad',
        message: `${behind}Skip ${placeLabel(pick.place)} to reach ${target}.`,
        skipStopId: pick.stop.id,
        skipLabel: placeLabel(pick.place),
      }
    }
    return { tone: 'bad', message: `${behind}At this pace you may miss ${target}. Shorten your current stop.` }
  }

  const overrun = Math.round(tl.projectedEnd - state.endMin)
  if (overrun > 15) {
    const pick = pending.filter((e) => !e.place.mandatory).sort((a, b) => b.stop.durationMin - a.stop.durationMin)[0]
    return {
      tone: 'warn',
      message: `${behind}Your plan now ends around ${fmtMin(tl.projectedEnd)}, ${overrun} min past ${fmtMin(state.endMin)}.${pick ? ` Consider skipping ${placeLabel(pick.place)}.` : ''}`,
      skipStopId: pick?.stop.id,
      skipLabel: pick ? placeLabel(pick.place) : undefined,
    }
  }

  if (delay > 10) return { tone: 'warn', message: `${behind}Still on track for the must-see stops.` }
  if (delay < -10) return { tone: 'ok', message: `About ${-delay} min ahead of plan.` }
  return { tone: 'ok', message: 'On schedule.' }
}
