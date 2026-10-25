import type { Interest, LuupPlan, Pace } from '../types'
import { load, save } from './storage'

export interface Prefs {
  luup: LuupPlan
  interests: Interest[]
  pace: Pace
  /** Finished first-run setup. */
  onboarded: boolean
  /** ISO code prices are converted into (default Malaysian ringgit). */
  currency: string
  /** Food needs used for meal suggestions. */
  diet: Diet[]
  /** Best-effort "time to leave" notifications. */
  alerts: boolean
}

export type Diet = 'halal' | 'vegetarian' | 'noseafood'

export const DIET_LABEL: Record<Diet, string> = {
  halal: 'Halal / Muslim-friendly',
  vegetarian: 'Vegetarian',
  noseafood: 'No seafood',
}

const KEY = 'tokyo-day:prefs:v1'
const LEGACY_ITINERARY_KEY = 'tokyo-day:itinerary:v1'

function initial(): Prefs {
  const saved = load<Prefs | null>(KEY, null)
  // Prefs saved before the currency setting existed default to ringgit.
  if (saved) return { ...saved, currency: saved.currency ?? 'MYR', diet: saved.diet ?? [], alerts: saved.alerts ?? false }
  // People who used the app before setup existed: keep their day and their LUUP subscription.
  // Decided once and saved straight away: the app stores a default plan on
  // first load, which must not make a new user look like a returning one.
  const legacy = load<unknown>(LEGACY_ITINERARY_KEY, null) != null
  const first: Prefs = { luup: legacy ? 'sub' : 'none', interests: [], pace: 'balanced', onboarded: legacy, currency: 'MYR', diet: [], alerts: false }
  save(KEY, first)
  return first
}

let current: Prefs = initial()

/** Read anywhere (pricing, planner). Components re-render through usePrefs in App. */
export const getPrefs = (): Prefs => current

export function writePrefs(p: Prefs): void {
  current = p
  save(KEY, p)
}

/** Runs fn as if prefs had `patch` applied, without saving (e.g. previewing a plan). */
export function withPrefs<T>(patch: Partial<Prefs>, fn: () => T): T {
  const before = current
  current = { ...current, ...patch }
  try {
    return fn()
  } finally {
    current = before
  }
}

export const INTEREST_LABEL: Record<Interest, string> = {
  culture: 'Temples & culture',
  shopping: 'Shopping & fashion',
  anime: 'Anime & games',
  food: 'Food & markets',
  views: 'Views',
  nightlife: 'Nightlife',
  nature: 'Parks & gardens',
  quirky: 'Only-in-Tokyo',
}

export const INTERESTS = Object.keys(INTEREST_LABEL) as Interest[]
