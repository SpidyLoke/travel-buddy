import type { LatLng } from '../types'
import { isInJapan } from './geo'
import { countryAt } from './nearby'

// What changes with the destination country: time zone, money and how you
// get around. Japan is the default and the best-supported country.

/** Countries with a single time zone (the common case for travel). */
const COUNTRY_TZ: Record<string, string> = {
  JP: 'Asia/Tokyo',
  MY: 'Asia/Kuala_Lumpur',
  SG: 'Asia/Singapore',
  TH: 'Asia/Bangkok',
  VN: 'Asia/Ho_Chi_Minh',
  KR: 'Asia/Seoul',
  TW: 'Asia/Taipei',
  HK: 'Asia/Hong_Kong',
  MO: 'Asia/Macau',
  CN: 'Asia/Shanghai',
  PH: 'Asia/Manila',
  KH: 'Asia/Phnom_Penh',
  LA: 'Asia/Vientiane',
  BN: 'Asia/Brunei',
  IN: 'Asia/Kolkata',
  LK: 'Asia/Colombo',
  NP: 'Asia/Kathmandu',
  AE: 'Asia/Dubai',
  SA: 'Asia/Riyadh',
  QA: 'Asia/Qatar',
  TR: 'Europe/Istanbul',
  GB: 'Europe/London',
  IE: 'Europe/Dublin',
  FR: 'Europe/Paris',
  DE: 'Europe/Berlin',
  IT: 'Europe/Rome',
  ES: 'Europe/Madrid',
  NL: 'Europe/Amsterdam',
  CH: 'Europe/Zurich',
  AT: 'Europe/Vienna',
  NZ: 'Pacific/Auckland',
}

export const COUNTRY_CURRENCY: Record<string, string> = {
  JP: 'JPY',
  MY: 'MYR',
  SG: 'SGD',
  TH: 'THB',
  VN: 'VND',
  KR: 'KRW',
  TW: 'TWD',
  HK: 'HKD',
  MO: 'MOP',
  CN: 'CNY',
  PH: 'PHP',
  ID: 'IDR',
  KH: 'USD',
  LA: 'LAK',
  BN: 'BND',
  IN: 'INR',
  LK: 'LKR',
  NP: 'NPR',
  AE: 'AED',
  SA: 'SAR',
  QA: 'QAR',
  TR: 'TRY',
  GB: 'GBP',
  IE: 'EUR',
  FR: 'EUR',
  DE: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  AT: 'EUR',
  PT: 'EUR',
  GR: 'EUR',
  BE: 'EUR',
  FI: 'EUR',
  CH: 'CHF',
  US: 'USD',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
}

export const COUNTRY_NAME: Record<string, string> = {
  JP: 'Japan',
  MY: 'Malaysia',
  SG: 'Singapore',
  TH: 'Thailand',
  VN: 'Vietnam',
  KR: 'South Korea',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  CN: 'China',
  PH: 'the Philippines',
  ID: 'Indonesia',
  GB: 'the UK',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  DE: 'Germany',
  AU: 'Australia',
  US: 'the US',
}

export const currencyOf = (country: string | undefined): string => COUNTRY_CURRENCY[country ?? 'JP'] ?? 'USD'

/** Best guess of the country from a time zone (e.g. the phone's own, before any plan exists). */
export const countryOfZone = (tz: string): string | undefined => Object.entries(COUNTRY_TZ).find(([, z]) => z === tz)?.[0]

export const deviceTz = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Open-Meteo works out the time zone for any coordinate. */
async function tzAt(at: LatLng, signal?: AbortSignal): Promise<string | null> {
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${at.lat.toFixed(3)}&longitude=${at.lng.toFixed(3)}&timezone=auto&forecast_days=1&daily=weather_code`, {
    signal,
  })
  if (!res.ok) return null
  const tz: string | undefined = (await res.json()).timezone
  return tz && tz !== 'GMT' ? tz : null
}

export interface Locale {
  country: string
  tz: string
}

/**
 * Country and time zone for where you're staying, from Photon and
 * Open-Meteo, falling back to a rough Japan check and the phone's own zone.
 */
export async function localeAt(at: LatLng, countryHint?: string, signal?: AbortSignal): Promise<Locale> {
  const country = countryHint ?? (await within(countryAt(at, signal))) ?? (isInJapan(at) ? 'JP' : '??')
  if (COUNTRY_TZ[country]) return { country, tz: COUNTRY_TZ[country] }
  const tz = await within(tzAt(at, signal))
  return { country, tz: tz ?? deviceTz() }
}

/** A lookup that hasn't answered in a few seconds is treated as unknown, so setup never stalls on it. */
const within = <T,>(p: Promise<T | null>, ms = 4000): Promise<T | null> =>
  Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))])
