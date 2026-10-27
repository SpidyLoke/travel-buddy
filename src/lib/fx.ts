import { getPrefs } from './prefs'
import { load, save } from './storage'

import { destCountry } from './destination'
import { currencyOf } from './locale'

// Exchange rates against the US dollar, so any pair can be converted (yen to
// ringgit in Japan, ringgit to pounds in Malaysia…). Primary: Frankfurter
// (European Central Bank reference rates, working days). Fallback, and for
// currencies the ECB doesn't publish: open.er-api.com. Both free, keyless and
// CORS-enabled. The last rates are kept for offline use.

export interface Fx {
  /** Units of each currency per 1 USD. */
  rates: Record<string, number>
  /** Date the rates refer to. */
  date: string
  source: string
  fetchedAt: number
}

const KEY = 'tokyo-day:fx:v2'
const REFRESH_MS = 6 * 60 * 60 * 1000

let current: Fx | null = load<Fx | null>(KEY, null)

export const getFx = (): Fx | null => current

export const CURRENCIES = ['MYR', 'SGD', 'IDR', 'THB', 'PHP', 'USD', 'GBP', 'EUR', 'AUD', 'CNY', 'HKD', 'KRW', 'INR', 'JPY'] as const

/** Currency used where the active plan is. */
export const localCurrency = (): string => currencyOf(destCountry())

async function frankfurter(signal?: AbortSignal): Promise<Fx> {
  const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD', { signal })
  if (!res.ok) throw new Error(`Frankfurter ${res.status}`)
  const j = await res.json()
  return { rates: { ...j.rates, USD: 1 }, date: j.date, source: 'European Central Bank (via Frankfurter)', fetchedAt: Date.now() }
}

async function erApi(signal?: AbortSignal): Promise<Fx> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal })
  if (!res.ok) throw new Error(`ER-API ${res.status}`)
  const j = await res.json()
  if (j.result !== 'success') throw new Error('ER-API failed')
  return { rates: j.rates, date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10), source: 'ExchangeRate-API', fetchedAt: Date.now() }
}

/** Refreshes rates if they are older than six hours or miss a currency you need. */
export async function refreshFx(signal?: AbortSignal): Promise<Fx | null> {
  const need = [localCurrency(), getPrefs().currency, 'JPY']
  const complete = (fx: Fx | null) => !!fx && need.every((c) => fx.rates[c])
  if (current && complete(current) && Date.now() - current.fetchedAt < REFRESH_MS) return current
  try {
    let fx = await frankfurter(signal).catch(() => null)
    if (!complete(fx)) fx = await erApi(signal).catch(() => fx)
    if (fx) {
      current = fx
      save(KEY, current)
    }
  } catch {
    // Keep whatever we had.
  }
  return current
}

/** Converts between any two currencies, or null without a rate. */
export function convert(amount: number, from: string, to: string): number | null {
  const a = current?.rates[from]
  const b = current?.rates[to]
  return a && b ? (amount / a) * b : null
}

export const fromYen = (yen: number, currency = getPrefs().currency): number | null => convert(yen, 'JPY', currency)
export const toYen = (amount: number, currency = getPrefs().currency): number | null => convert(amount, currency, 'JPY')

/** Handy amounts to tap in a currency: ¥100–¥10,000, RM5–RM200 and so on. */
export function quickAmounts(currency: string): number[] {
  if (currency === 'JPY') return [100, 500, 1000, 3000, 5000, 10000]
  const perUsd = convert(1, 'USD', currency) ?? 1
  const nice = (x: number) => {
    const k = 10 ** Math.floor(Math.log10(x))
    return Math.round(x / k) * k
  }
  return [...new Set([1, 3, 5, 10, 25, 50].map((u) => nice(u * perUsd)))]
}

/** "RM", "¥", "£"… */
export function currencySymbol(currency: string): string {
  if (currency === 'MYR') return 'RM'
  const part = new Intl.NumberFormat('en-GB', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')
  return part?.value ?? currency
}

export function fmtMoney(amount: number, currency: string): string {
  // Malaysian ringgit reads naturally as "RM12.40".
  const locale = currency === 'MYR' ? 'ms-MY' : 'en-GB'
  const digits = amount >= 1000 || ['IDR', 'KRW', 'JPY', 'VND'].includes(currency) ? 0 : 2
  // "¥1,000" rather than "JP¥1,000".
  const display = currency === 'JPY' ? 'narrowSymbol' : 'symbol'
  const out = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: display, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(amount)
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
