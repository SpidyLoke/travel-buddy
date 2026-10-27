import type { Region } from '../types'

// The active plan's country and guide region, set by App on every render so
// helpers deep in the tree know whether Japan-only features apply.

let current: { country: string; region: Region } = { country: 'JP', region: 'tokyo' }

export function setDestination(country: string | undefined, region: Region): void {
  current = { country: country ?? 'JP', region }
}

export const destCountry = (): string => current.country
export const inJapan = (): boolean => current.country === 'JP'
/** LUUP runs in the big cities covered by the built-in guides, not around Fuji or abroad. */
export const luupHere = (): boolean => inJapan() && current.region !== 'live'
/** Hand-written train steps and Suica fares exist only for the built-in Japanese cities. */
export const curatedCity = (): boolean => inJapan() && current.region !== 'live'
