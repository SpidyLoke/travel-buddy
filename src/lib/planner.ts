import { PLACES } from '../data/places'
import type { Interest, ItineraryState, ItineraryStop, Pace, Place, TransportMode } from '../types'
import { distanceKm } from './geo'
import { INTEREST_LABEL } from './prefs'
import { recommend } from './pricing'
import { estimateTravel } from './schedule'
import { fmtMin, weekdayOf } from './time'

// Builds a one-day plan from the destination catalogue:
//   1. score each place by popularity and the user's interests
//   2. greedily add the place with the best (value − extra time) at its
//      cheapest position in the route, as long as the whole day still fits
//      opening hours, closed days and the finish time
//   3. respect time-of-day: temples early, views at dusk, nightlife late
// Everything is an estimate built from typical hours, never live data.

export interface PlanInput {
  home: Place
  date: string
  startMin: number
  /** Leave the last stop by this time. */
  endMin: number
  interests: Interest[]
  pace: Pace
  mustIds: string[]
  excludeIds: string[]
  /** Small random nudge so "Shuffle" offers an alternative. */
  jitter?: number
}

export interface PlannedStop {
  place: Place
  arrive: number
  start: number
  depart: number
  durationMin: number
  transport: TransportMode
  travelMin: number
  must: boolean
  note: string
}

export interface PlanResult {
  stops: PlannedStop[]
  warnings: string[]
  homeArrive: number
}

const PACE: Record<Pace, { dur: number; buffer: number; max: number }> = {
  relaxed: { dur: 1.2, buffer: 15, max: 4 },
  balanced: { dur: 1, buffer: 10, max: 6 },
  packed: { dur: 0.85, buffer: 5, max: 8 },
}

/** Score points are worth this many minutes of extra travel. */
const VALUE_MIN = 20

const overlap = (p: Place, interests: Interest[]) => (p.tags ?? []).filter((t) => interests.includes(t))

export function scorePlace(p: Place, interests: Interest[]): number {
  const base = p.score ?? 1
  if (!interests.length) return base
  const n = overlap(p, interests).length
  return base + 2.5 * n - (n === 0 ? 3 : 0)
}

/** Recommendation reason, e.g. "Anime & games · Views · best in the evening". */
export function whyPlace(p: Place, interests: Interest[]): string {
  const parts = overlap(p, interests).map((t) => INTEREST_LABEL[t])
  if (!parts.length && (p.score ?? 0) >= 4) parts.push('Tokyo classic')
  const when = { morning: 'best in the morning', day: '', evening: 'best around dusk', night: 'best at night' }[p.best ?? 'day']
  if (when) parts.push(when)
  return parts.join(' · ') || 'Fits neatly into your route'
}

function timePenalty(p: Place, start: number): number {
  switch (p.best) {
    case 'night':
      return start < 18 * 60 ? (18 * 60 - start) / 2 : 0
    case 'evening':
      return start < 16 * 60 + 30 ? (16 * 60 + 30 - start) / 3 : start > 22 * 60 ? 30 : 0
    case 'morning':
      return start > 12 * 60 ? (start - 12 * 60) / 3 : 0
    default:
      return start > 19 * 60 ? (start - 19 * 60) / 2 : 0
  }
}

interface Sim {
  ok: boolean
  cost: number
  stops: PlannedStop[]
  homeArrive: number
  problems: string[]
}

export function planDuration(p: Place, pace: Pace): number {
  return Math.max(15, Math.round(((p.suggestedMin || 30) * PACE[pace].dur) / 5) * 5)
}

function makeSim(input: PlanInput) {
  const travelCache = new Map<string, { min: number; mode: TransportMode }>()
  const travel = (a: Place, b: Place) => {
    const k = `${a.id}>${b.id}`
    let v = travelCache.get(k)
    if (!v) {
      const mode = recommend(a, b).mode
      v = { min: estimateTravel(a, b, mode).min, mode }
      travelCache.set(k, v)
    }
    return v
  }
  const { buffer } = PACE[input.pace]

  return (route: Place[], musts: Set<string>): Sim => {
    let t = input.startMin
    let prev = input.home
    let cost = 0
    let ok = true
    const problems: string[] = []
    const stops: PlannedStop[] = route.map((p) => {
      const tr = travel(prev, p)
      const arrive = t + tr.min
      const start = Math.max(arrive, p.opensAt ?? 0)
      const wait = start - arrive
      const durationMin = planDuration(p, input.pace)
      const depart = start + durationMin
      if (wait > 45) ok = false
      if (p.closesAt != null && depart > p.closesAt + 10) {
        ok = false
        problems.push(`${p.label ?? p.name} may close (${p.closesLabel ?? fmtMin(p.closesAt)}) before you finish.`)
      }
      cost += tr.min + wait + timePenalty(p, start)
      t = depart + buffer
      prev = p
      return {
        place: p,
        arrive,
        start,
        depart,
        durationMin,
        transport: tr.mode,
        travelMin: tr.min,
        must: musts.has(p.id),
        note: '',
      }
    })
    const last = stops.at(-1)
    if (last && last.depart > input.endMin + 10) {
      ok = false
      problems.push(`The day runs to about ${fmtMin(last.depart)}, past your finish time.`)
    }
    const home = travel(prev, input.home)
    cost += home.min
    return { ok, cost, stops, homeArrive: (last?.depart ?? input.startMin) + home.min, problems }
  }
}

export function planDay(input: PlanInput): PlanResult {
  const weekday = weekdayOf(input.date)
  const musts = new Set(input.mustIds)
  const exclude = new Set(input.excludeIds.filter((id) => !musts.has(id)))
  const warnings: string[] = []
  const sim = makeSim(input)
  const { max } = PACE[input.pace]
  const rand = () => (input.jitter ? (Math.random() - 0.5) * input.jitter : 0)

  // Daytime sights on your doorstep you will see anyway; evening spots near
  // home still make a good end to the day.
  const doorstep = (p: Place) => distanceKm(p, input.home) < 0.3 && p.best !== 'night' && p.best !== 'evening'
  const pool = PLACES.filter((p) => !p.hidden && p.tags?.length && p.kind !== 'shop' && !exclude.has(p.id) && (musts.has(p.id) || !doorstep(p)))
  const value = new Map(pool.map((p) => [p.id, (musts.has(p.id) ? 1000 : scorePlace(p, input.interests)) + rand()]))

  for (const p of pool) {
    if (musts.has(p.id) && p.closedDays?.includes(weekday)) warnings.push(`${p.label ?? p.name}: ${p.closedNote ?? 'may be closed that day.'}`)
  }
  let remaining = pool.filter((p) => musts.has(p.id) || !p.closedDays?.includes(weekday))

  let route: Place[] = []
  let current = sim(route, musts)
  const usedGroups = new Set<string>()

  // Best places first; each goes where it adds the least time, if the day still fits.
  remaining.sort((a, b) => value.get(b.id)! - value.get(a.id)!)
  for (const p of remaining) {
    const isMust = musts.has(p.id)
    if (!isMust && (route.length >= max || (p.group && usedGroups.has(p.group)))) continue
    let best: { route: Place[]; sim: Sim; gain: number } | null = null
    for (let i = 0; i <= route.length; i++) {
      const cand = [...route.slice(0, i), p, ...route.slice(i)]
      const s = sim(cand, musts)
      if (!s.ok && !isMust) continue
      const gain = value.get(p.id)! * VALUE_MIN - (s.cost - current.cost) - (s.ok ? 0 : 500)
      if (!best || gain > best.gain) best = { route: cand, sim: s, gain }
    }
    if (!best || (best.gain <= 0 && !isMust)) continue
    route = best.route
    current = best.sim
    if (p.group) usedGroups.add(p.group)
  }

  // Tidy-up: move single stops to cheaper positions while the day still fits.
  for (let pass = 0; pass < 3; pass++) {
    let improved = false
    for (let i = 0; i < route.length; i++) {
      for (let j = 0; j < route.length; j++) {
        if (i === j) continue
        const r = [...route]
        const [p] = r.splice(i, 1)
        r.splice(j, 0, p)
        const s = sim(r, musts)
        if ((s.ok || !current.ok) && s.cost < current.cost - 1) {
          route = r
          current = s
          improved = true
        }
      }
    }
    // 2-opt: reverse a stretch of the route to undo crossings.
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const r = [...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)]
        const s = sim(r, musts)
        if ((s.ok || !current.ok) && s.cost < current.cost - 1) {
          route = r
          current = s
          improved = true
        }
      }
    }
    if (!improved) break
  }

  for (const id of musts) {
    const p = pool.find((x) => x.id === id)
    if (p && !route.includes(p)) warnings.push(`Could not fit ${p.label ?? p.name}.`)
  }
  warnings.push(...current.problems)

  const stops = current.stops.map((s) => ({ ...s, note: s.must ? `Your pick${whyPlace(s.place, input.interests) ? ` · ${whyPlace(s.place, input.interests)}` : ''}` : whyPlace(s.place, input.interests) }))
  return { stops, warnings: [...new Set(warnings)], homeArrive: current.homeArrive }
}

/** Turns a plan into the itinerary the rest of the app runs on. */
export function planToItinerary(input: PlanInput, plan: PlanResult): ItineraryState {
  const home: Place = { ...input.home, id: 'home', label: 'Home', custom: true, hidden: true }
  const stops: ItineraryStop[] = plan.stops.map((s, i) => ({
    id: s.place.id,
    placeId: s.place.id,
    // Stay includes any wait for opening and the pace buffer, so the live
    // timeline reproduces the planned arrival times.
    durationMin: (plan.stops[i + 1] ? plan.stops[i + 1].arrive - plan.stops[i + 1].travelMin : s.depart) - s.arrive,
    transport: s.transport,
    status: 'pending',
    must: s.must || undefined,
    note: s.note || undefined,
  }))
  return {
    version: 1,
    startPlaceId: 'home',
    startMin: input.startMin,
    endMin: input.endMin,
    stops,
    home: { name: input.home.name, query: input.home.mapsQuery, placeId: 'home', lat: input.home.lat, lng: input.home.lng },
    customPlaces: [home],
    date: input.date,
  }
}
