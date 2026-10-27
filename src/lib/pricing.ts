import { findLeg } from '../data/legs'
import type { LuupPlan, Place, TransportMode } from '../types'
import { luupHere } from './destination'
import { getPrefs } from './prefs'
import { estimateTravel } from './schedule'

// LUUP prices, Tokyo. Subscription: ¥200 per started 30-minute block.
// Pay as you go: ¥50 unlock + per minute; Tokyo's per-minute rate changed on
// 1 Sep 2026 (reported as ¥25/min), so it is shown as approximate.
export const LUUP_BLOCK_MIN = 30
export const LUUP_BLOCK_YEN = 200
export const LUUP_PAYG_UNLOCK = 50
export const LUUP_PAYG_PER_MIN = 25

/** Your LUUP plan where LUUP operates; 'none' anywhere else. */
export const luupPlan = (): LuupPlan => (luupHere() ? getPrefs().luup : 'none')

export function luupCost(minutes: number): number | null {
  const plan = luupPlan()
  if (plan === 'none') return null
  if (plan === 'payg') return LUUP_PAYG_UNLOCK + LUUP_PAYG_PER_MIN * Math.ceil(minutes)
  return Math.max(1, Math.ceil(minutes / LUUP_BLOCK_MIN)) * LUUP_BLOCK_YEN
}

export function luupRateLabel(): string {
  const plan = luupPlan()
  if (plan === 'none') return 'No LUUP account'
  if (plan === 'payg') return `~¥${LUUP_PAYG_UNLOCK} + ¥${LUUP_PAYG_PER_MIN}/min`
  return `¥${LUUP_BLOCK_YEN}/${LUUP_BLOCK_MIN} min`
}

export interface Cost {
  yen: number | null
  label: string
  approx: boolean
}

export function costFor(from: Place, to: Place, mode: TransportMode): Cost {
  if (mode === 'walk') return { yen: 0, label: 'Free', approx: false }
  if (mode === 'luup') {
    const yen = luupCost(estimateTravel(from, to, 'luup').min)
    if (yen == null) return { yen: null, label: 'Not set up', approx: false }
    const approx = luupPlan() === 'payg'
    return { yen, label: `${approx ? '~' : ''}¥${yen}`, approx }
  }
  const leg = findLeg(from.id, to.id)
  if (leg?.trainFareYen == null) return { yen: null, label: 'See Maps', approx: false }
  return { yen: leg.trainFareYen, label: `${leg.fareApprox ? '~' : ''}¥${leg.trainFareYen}`, approx: !!leg.fareApprox }
}

export interface Recommendation {
  mode: TransportMode
  why: string
}

/** Longest ride worth recommending LUUP for, by plan. */
const LUUP_MAX_KM = { none: 0, payg: 2.5, sub: 4 }

/**
 * Hand-picked per leg where one exists; otherwise a distance rule of thumb.
 * LUUP is only suggested when the user has it, and for shorter hops when
 * paying per minute.
 */
export function recommend(from: Place, to: Place): Recommendation {
  const plan = luupPlan()
  const leg = findLeg(from.id, to.id)
  const km = leg?.distanceKm ?? estimateTravel(from, to, 'walk').km
  if (leg && (leg.recommended !== 'luup' || km <= LUUP_MAX_KM[plan])) return { mode: leg.recommended, why: leg.why }
  if (km < 1.2) return { mode: 'walk', why: 'Under about 1 km: walking is quickest once you count stations.' }
  if (km <= LUUP_MAX_KM[plan]) return { mode: 'luup', why: `About ${km.toFixed(1)} km: a short LUUP ride with no transfers. Check both ends have ports.` }
  if (km < 2 && plan === 'none') return { mode: 'walk', why: `About ${km.toFixed(1)} km: a 20–25 minute walk, often as quick as the train door to door.` }
  if (!luupHere() && !leg) return { mode: 'train', why: `About ${km.toFixed(1)} km: take public transport, or a taxi if the connection is poor.` }
  return { mode: 'train', why: `About ${km.toFixed(1)} km: the train is fastest${plan === 'none' ? '' : ' and avoids a long ride in traffic'}.` }
}
