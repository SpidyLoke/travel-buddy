import { findLeg } from '../data/legs'
import type { Place, TransportMode } from '../types'
import { estimateTravel } from './schedule'

// LUUP subscription rate: ¥200 per started 30-minute block.
export const LUUP_BLOCK_MIN = 30
export const LUUP_BLOCK_YEN = 200

export function luupCost(minutes: number): number {
  return Math.max(1, Math.ceil(minutes / LUUP_BLOCK_MIN)) * LUUP_BLOCK_YEN
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
    return { yen, label: `¥${yen}`, approx: false }
  }
  const leg = findLeg(from.id, to.id)
  if (leg?.trainFareYen == null) return { yen: null, label: 'See Maps', approx: false }
  return { yen: leg.trainFareYen, label: `${leg.fareApprox ? '~' : ''}¥${leg.trainFareYen}`, approx: !!leg.fareApprox }
}

export interface Recommendation {
  mode: TransportMode
  why: string
}

/** Hand-picked per leg; for unplanned pairs, a distance rule of thumb. */
export function recommend(from: Place, to: Place): Recommendation {
  const leg = findLeg(from.id, to.id)
  if (leg) return { mode: leg.recommended, why: leg.why }
  const km = estimateTravel(from, to, 'walk').km
  if (km < 1.2) return { mode: 'walk', why: 'Under about 1 km: walking is quickest once you count stations and ports.' }
  if (km <= 4) return { mode: 'luup', why: `About ${km.toFixed(1)} km: one ¥${LUUP_BLOCK_YEN} LUUP block, no transfers. Check both ends have ports.` }
  return { mode: 'train', why: `About ${km.toFixed(1)} km: the train is faster and avoids a long ride in traffic.` }
}
