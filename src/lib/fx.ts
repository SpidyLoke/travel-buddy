import { getPrefs } from './prefs'
import { load, save } from './storage'

// Yen exchange rates. Primary: Frankfurter (European Central Bank reference
// rates, updated on working days). Fallback: open.er-api.com. Both free,
// keyless and CORS-enabled. The last rates are kept for offline use.

export interface Fx {
  /** Units of each currency per 1 JPY. */
  rates: Record<string, number>
  /** Date the rates refer to. */
  date: string
  source: string
  fetchedAt: number
}

const KEY = 'tokyo-day:fx:v1'
const REFRESH_MS = 6 * 60 * 60 * 1000

let current: Fx | null = load<Fx | null>(KEY, null)

export const getFx = (): Fx | null => current

export const CURRENCIES = ['MYR', 'SGD', 'IDR', 'THB', 'PHP', 'USD', 'GBP', 'EUR', 'AUD', 'CNY', 'HKD', 'KRW', 'INR'] as const

async function frankfurter(signal?: AbortSignal): Promise<Fx> {
  const res = await fetch('https://api.frankfurter.dev/v1/latest?base=JPY', { signal })
  if (!res.ok) throw new Error(`Frankfurter ${res.status}`)
  const j = await res.json()
  return { rates: j.rates, date: j.date, source: 'European Central Bank (via Frankfurter)', fetchedAt: Date.now() }
}

async function erApi(signal?: AbortSignal): Promise<Fx> {
  const res = await fetch('https://open.er-api.com/v6/latest/JPY', { signal })
  if (!res.ok) throw new Error(`ER-API ${res.status}`)
  const j = await res.json()
  if (j.result !== 'success') throw new Error('ER-API failed')
  return { rates: j.rates, date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10), source: 'ExchangeRate-API', fetchedAt: Date.now() }
}

/** Refreshes rates if they are older than six hours. Returns the rates in use. */
export async function refreshFx(signal?: AbortSignal): Promise<Fx | null> {
  if (current && Date.now() - current.fetchedAt < REFRESH_MS) return current
  try {
    current = await frankfurter(signal).catch(() => erApi(signal))
    save(KEY, current)
  } catch {
    // Keep whatever we had.
  }
  return current
}

export function fromYen(yen: number, currency = getPrefs().currency): number | null {
  const r = current?.rates[currency]
  return r ? yen * r : null
}

export function toYen(amount: number, currency = getPrefs().currency): number | null {
  const r = current?.rates[currency]
  return r ? amount / r : null
}

export function fmtMoney(amount: number, currency: string): string {
  // Malaysian ringgit reads naturally as "RM12.40".
  const locale = currency === 'MYR' ? 'ms-MY' : 'en-GB'
  const digits = amount >= 1000 || ['IDR', 'KRW', 'JPY'].includes(currency) ? 0 : 2
  const out = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(amount)
  return currency === 'MYR' ? out.replace(/RM\s+/, 'RM') : out
}

/** "RM5.10" for a yen amount, or "" when no rate is available. */
export function homeAmount(yen: number | null): string {
  if (yen == null) return ''
  const cur = getPrefs().currency
  const v = fromYen(yen, cur)
  return v == null ? '' : fmtMoney(v, cur)
}

/** " · RM5.10" for a yen amount, or "". */
export const inHome = (yen: number | null): string => (homeAmount(yen) ? ` · ${homeAmount(yen)}` : '')
